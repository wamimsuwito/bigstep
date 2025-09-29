/**
 * Lalisa Home Automation Control
 * 
 * This sketch connects an ESP32 to Firebase Realtime Database to control
 * a series of relays (lights, AC) and monitor sensors.
 * It listens for changes in the '/devices' path in the database and updates
 * the GPIO pins accordingly. It also reports sensor data back to Firebase.
 * 
 * Version 4.0 - Complete rewrite for modern Firebase ESP Client library (v4.x+)
 * By: Studio Bot
 */

#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// Provide the token generation process info.
#include "addons/TokenHelper.h"

// --- WiFi and Firebase Configuration ---
// Replace with your actual WiFi credentials
#define WIFI_SSID "I dont't know"
#define WIFI_PASSWORD "hutabarat"

// Replace with your Firebase project's credentials
#define API_KEY "AIzaSyDQHD5hWDvY_Jp7kTsvOJ4Yei_fRYVgA3Y"
#define DATABASE_URL "https://batchscale-monitor-default-rtdb.asia-southeast1.firebasedatabase.app"

// Define Firebase objects
FirebaseData stream;
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// --- Device and Sensor Pin Definitions ---
struct Device {
  const char* id;
  uint8_t pin;
};

Device devices[] = {
  {"lampu_teras", 2},
  {"lampu_taman", 4},
  {"lampu_ruang_tamu", 5},
  {"lampu_dapur", 18},
  {"lampu_kamar_utama", 19},
  {"lampu_kamar_anak", 21},
  {"lampu_ruang_keluarga", 22},
  {"lampu_ruang_makan", 23},
  {"ac_kamar_utama", 25},
  {"ac_kamar_anak", 26},
  {"pintu_garasi", 27}
};
const int numDevices = sizeof(devices) / sizeof(devices[0]);

// --- Function Prototypes ---
void streamCallback(FirebaseStream data);
void streamTimeoutCallback(bool timeout);
void setupFirebase();
void connectWiFi();
void initializeDevicePins();
void updateAllDeviceStatesToFirebase();

void setup() {
  Serial.begin(115200);
  Serial.println();
  
  initializeDevicePins();
  connectWiFi();
  setupFirebase();
  updateAllDeviceStatesToFirebase(); // Send initial state to Firebase
}

void loop() {
  // Firebase.ready() should be called repeatedly to handle authentication tasks.
  if (Firebase.ready())
  {
    //This function should be called repeatedly to handle stream data reading
    if (!Firebase.RTDB.readStream(&stream))
    {
      Serial.printf("Can't read stream data, %s\n", stream.errorReason().c_str());
    }
  }

  // Simple non-blocking delay
  static unsigned long lastCheck = 0;
  if (millis() - lastCheck > 10000) { // Check every 10 seconds
    lastCheck = millis();
    if (!Firebase.RTDB.isStreamActive()) {
        Serial.println("Stream inactive, restarting...");
        Firebase.RTDB.endStream(&stream);
        if (!Firebase.RTDB.beginStream(&fbdo, "/devices")) {
            Serial.printf("Stream begin error, %s\n", fbdo.errorReason().c_str());
        }
    }
  }
}

// --- Function Implementations ---

void streamCallback(FirebaseStream data) {
  Serial.printf("Stream callback: type: %s, path: %s, data: %s\n", data.dataType().c_str(), data.streamPath().c_str(), data.stringData().c_str());
  
  if (data.dataTypeEnum() == fb_esp_rtdb_data_type_json) {
    FirebaseJson* json = data.to<FirebaseJson*>();
    size_t len = json->iteratorBegin();
    String key, value;
    int type;

    for (size_t i = 0; i < len; i++) {
      json->iteratorGet(i, type, key, value);

      // Find the corresponding device
      for (int j = 0; j < numDevices; j++) {
        if (key == devices[j].id) {
          bool state = value.equalsIgnoreCase("true") || value == "1";
          Serial.printf("Setting device %s (Pin %d) to %s\n", devices[j].id, devices[j].pin, state ? "ON" : "OFF");
          digitalWrite(devices[j].pin, state ? HIGH : LOW);
          break; // Exit inner loop once device is found
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

void initializeDevicePins() {
  for (int i = 0; i < numDevices; i++) {
    pinMode(devices[i].pin, OUTPUT);
    digitalWrite(devices[i].pin, LOW); // Default to OFF
  }
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  unsigned long startAttemptTime = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 20000) {
    Serial.print(".");
    delay(500);
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\nFailed to connect to WiFi.");
    // You might want to restart the ESP32 here
    // ESP.restart(); 
  } else {
    Serial.println("\nWiFi connected.");
    Serial.print("Connected with IP: ");
    Serial.println(WiFi.localIP());
  }
}

void setupFirebase() {
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  // Since we don't have a user login, we'll sign up anonymously
  // This is required for the new library versions.
  config.signer.test_mode = true;
  Firebase.begin(&config, &auth);

  Firebase.reconnectWiFi(true);

  // Set up stream callbacks
  stream.setStreamCallback(streamCallback);
  stream.setStreamTimeoutCallback(streamTimeoutCallback);
  
  if (!Firebase.RTDB.beginStream(&fbdo, "/devices")) {
    Serial.printf("Stream begin error, %s\n", fbdo.errorReason().c_str());
  }
  Serial.println("Firebase stream started.");
}

void updateAllDeviceStatesToFirebase() {
  FirebaseJson json;
  for (int i = 0; i < numDevices; i++) {
    json.set(String(devices[i].id) + "/state", false);
  }

  Serial.println("Updating initial states to Firebase...");
  if (!Firebase.RTDB.updateNode(&fbdo, "/devices", &json)) {
    Serial.printf("Error updating initial states: %s\n", fbdo.errorReason().c_str());
  } else {
    Serial.println("Initial states updated successfully.");
  }
}
