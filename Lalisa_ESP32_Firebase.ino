/*
  Lalisa - Home Automation System
  Copyright (C) 2024 Farid Afr-nsor

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// Provide the token generation process info.
#include "addons/TokenHelper.h"
// Provide the RTDB payload printing info and other helper functions.
#include "addons/RTDBHelper.h"

// --- WiFi and Firebase Configuration ---
// (SECRET) Replace with your actual WiFi credentials
#define WIFI_SSID "I don't know"
#define WIFI_PASSWORD "hutabarat"

// (SECRET) Replace with your Firebase project's API Key and Database URL
#define API_KEY "AIzaSyDQHD5hWDvY_Jp7kTsvOJ4Yei_fRYVgA3Y"
#define DATABASE_URL "https://batchscale-monitor-default-rtdb.asia-southeast1.firebasedatabase.app/"

// --- User Account for ESP32 ---
// (SECRET) This is the account the ESP32 will use to log in to Firebase
#define USER_EMAIL "esp32-device@farika.com"
#define USER_PASSWORD "passwordesp32"

// --- Global Firebase Objects ---
FirebaseData stream;
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
String uid;

// --- Device and Sensor Pin Definitions ---
struct Device {
  const char* id;
  const int pin;
};

Device devices[] = {
  { "lampu_teras", 2 },
  { "lampu_taman", 4 },
  { "lampu_ruang_tamu", 5 },
  { "lampu_dapur", 18 },
  { "lampu_kamar_utama", 19 },
  { "lampu_kamar_anak", 21 },
  { "lampu_ruang_keluarga", 22 },
  { "lampu_ruang_makan", 23 },
  { "ac_kamar_utama", 25 },
  { "ac_kamar_anak", 26 },
  { "pintu_garasi", 27 }
};

struct Sensor {
  const char* id;
  const int pin;
};

Sensor sensors[] = {
  { "sensor_gerak", 13 },
  { "sensor_cahaya", 12 }
};

const int numDevices = sizeof(devices) / sizeof(devices[0]);
const int numSensors = sizeof(sensors) / sizeof(sensors[0]);

// --- Function Declarations ---
void streamCallback(FirebaseStream data);
void streamTimeoutCallback(bool timeout);
void setupWiFi();
void setupFirebase();
void initializeDeviceStates();
void readAndSendSensorData();

// --- Main Program ---

void setup() {
  Serial.begin(115200);
  Serial.println();

  for (int i = 0; i < numDevices; i++) {
    pinMode(devices[i].pin, OUTPUT);
    digitalWrite(devices[i].pin, LOW);
  }
  for (int i = 0; i < numSensors; i++) {
    pinMode(sensors[i].pin, INPUT);
  }

  setupWiFi();
  if (WiFi.status() == WL_CONNECTED) {
    setupFirebase();
  }
}

void loop() {
  // Main loop only handles sensor reading and Firebase connection maintenance
  if (Firebase.ready() && WiFi.status() == WL_CONNECTED) {
    readAndSendSensorData();
  }
  delay(1000); // Check sensors every second
}


// --- Function Definitions ---

void streamCallback(FirebaseStream data) {
  Serial.printf("Stream callback: %s, %s, %s\n", data.streamPath().c_str(), data.dataPath().c_str(), data.dataType().c_str());

  if (data.dataTypeEnum() == fb_esp_rtdb_data_type_json) {
    FirebaseJson *json = data.to<FirebaseJson *>();
    size_t len = json->iteratorBegin();
    FirebaseJsonData value;
    int type = 0;
    String key;
    for (size_t i = 0; i < len; i++) {
        json->iteratorGet(i, type, key, value);
        Serial.printf("key: %s, value: %s, type: %d\n", key.c_str(), value.stringValue.c_str(), type);
         // Find the device by key (name) and update its state
        for (int j = 0; j < numDevices; j++) {
          if (key == devices[j].id) {
            bool state = value.to<bool>();
            digitalWrite(devices[j].pin, state ? HIGH : LOW);
            Serial.printf("Device %s is now %s\n", devices[j].id, state ? "ON" : "OFF");
            break;
          }
        }
    }
    json->iteratorEnd();
    delete json;
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("Stream timeout, resuming...");
  }
}

void setupWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    Serial.print(".");
    delay(500);
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFailed to connect to WiFi. Please check credentials or signal.");
  }
}

void setupFirebase() {
  Serial.println("Initializing Firebase...");

  // Assign the project API key
  config.api_key = API_KEY;
  // Assign the RTDB URL
  config.database_url = DATABASE_URL;

  // Sign up the new user
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Sign up successful");
    uid = Firebase.getUID();
    Serial.printf("User UID: %s\n", uid.c_str());
  } else {
    Serial.printf("Sign up failed: %s\n", config.signer.signupError.message.c_str());
    // If user already exists, sign in
    if (config.signer.signupError.message.indexOf("EMAIL_EXISTS") != -1) {
      Serial.println("User exists, trying to sign in...");
      if (Firebase.signInUser(&config, &auth, USER_EMAIL, USER_PASSWORD)) {
        Serial.println("Sign in successful");
        uid = Firebase.getUID();
        Serial.printf("User UID: %s\n", uid.c_str());
      } else {
        Serial.printf("Sign in failed: %s\n", config.signer.error.message.c_str());
      }
    }
  }

  // Assign the user sign-in credentials
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Initialize device states in Firebase
  initializeDeviceStates();

  // Set up the stream
  if (!Firebase.RTDB.beginStream(&stream, "/devices")) {
    Serial.printf("Could not begin stream: %s\n", stream.errorReason().c_str());
  } else {
    Serial.println("Stream started successfully.");
    Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback);
  }
}

void initializeDeviceStates() {
  FirebaseJson json;
  for (int i = 0; i < numDevices; i++) {
    json.set(String(devices[i].id) + "/state", false);
  }
  Serial.println("Initializing device states in Firebase...");
  if (!Firebase.RTDB.updateNode(&fbdo, "/devices", &json)) {
      Serial.printf("Failed to initialize device states: %s\n", fbdo.errorReason().c_str());
  }
}

void readAndSendSensorData() {
  static unsigned long lastSensorSend = 0;
  if (millis() - lastSensorSend < 5000) { // Send sensor data every 5 seconds
    return;
  }
  lastSensorSend = millis();

  FirebaseJson json;
  for (int i = 0; i < numSensors; i++) {
    bool state = digitalRead(sensors[i].pin) == HIGH;
    json.set(String(sensors[i].id) + "/state", state);
  }

  if (!Firebase.RTDB.updateNode(&fbdo, "/sensors", &json)) {
    Serial.printf("Failed to send sensor data: %s\n", fbdo.errorReason().c_str());
  } else {
    Serial.println("Sensor data sent.");
  }
}
