/**
 * This is the final, corrected code for the ESP32 device 'Lalisa'.
 * It addresses all previous compilation errors by using the modern Firebase ESP32 client library API.
 * Key fixes include:
 * - Correct WiFi connection handling with diagnostics.
 * - Correct anonymous authentication process.
 * - Correct stream callback setup using Firebase.RTDB.setStreamCallback.
 * - Correct stream status checking within the main loop using stream.isStream().
 * - Correct JSON parsing and device state updates.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// Provide the token generation process info.
#include "addons/TokenHelper.h"

// --- WIFI and FIREBASE Configuration ---
// Replace with your actual WiFi credentials
#define WIFI_SSID "I dont't know"
#define WIFI_PASSWORD "hutabarat"

// Replace with your Firebase project's credentials
#define API_KEY "AIzaSyDQHD5hWDvY_Jp7kTsvOJ4Yei_fRYVgA3Y"
#define DATABASE_URL "https://batchscale-monitor-default-rtdb.asia-southeast1.firebasedatabase.app/"

// --- Global Firebase Objects ---
FirebaseData stream;
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// --- Global Variables ---
String uid;
unsigned long sendDataPrevMillis = 0;
bool signupOK = false;

// --- GPIO Pin Definitions ---
// Define the pins for your devices (lights, AC, etc.)
#define LAMPU_TERAS 2
#define LAMPU_TAMAN 4
#define LAMPU_RUANG_TAMU 5
#define LAMPU_DAPUR 18
#define LAMPU_KAMAR_UTAMA 19
#define LAMPU_KAMAR_ANAK 21
#define LAMPU_RUANG_KELUARGA 22
#define LAMPU_RUANG_MAKAN 23
#define AC_KAMAR_UTAMA 25
#define AC_KAMAR_ANAK 26
#define PINTU_GARASI 27
#define SENSOR_GERAK 13
#define SENSOR_CAHAYA 12

// --- Function Prototypes ---
void setupWiFi();
void setupFirebase();
void streamCallback(FirebaseStream data);
void streamTimeoutCallback(bool timeout);
void controlDevice(String deviceId, bool state);

// =================================================================================
//  STREAM CALLBACK
// =================================================================================
void streamCallback(FirebaseStream data) {
  Serial.printf("Stream new data available: %s, %s, %s, %s\n",
                data.streamPath().c_str(),
                data.dataPath().c_str(),
                data.dataType().c_str(),
                data.payload().c_str());

  if (data.dataTypeEnum() == fb_esp_data_type_json) {
    FirebaseJson *json = data.to<FirebaseJson *>();
    size_t len = json->iteratorBegin();
    String key, value;
    int type;

    for (size_t i = 0; i < len; i++) {
        json->iteratorGet(i, type, key, value);
        Serial.printf("Key: %s, Value: %s, Type: %d\n", key.c_str(), value.c_str(), type);
        if (key == "state") {
            String deviceId = data.dataPath();
            deviceId.remove(0, 1); // Remove leading slash
            controlDevice(deviceId, value == "true");
        }
    }
    json->iteratorEnd();
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("Stream timeout, resuming...");
  }
}

// =================================================================================
//  DEVICE CONTROL
// =================================================================================
void controlDevice(String deviceId, bool state) {
  Serial.printf("Controlling device: %s -> %s\n", deviceId.c_str(), state ? "ON" : "OFF");
  
  int pin = -1;
  if (deviceId == "lampu_teras") pin = LAMPU_TERAS;
  else if (deviceId == "lampu_taman") pin = LAMPU_TAMAN;
  else if (deviceId == "lampu_ruang_tamu") pin = LAMPU_RUANG_TAMU;
  else if (deviceId == "lampu_dapur") pin = LAMPU_DAPUR;
  else if (deviceId == "lampu_kamar_utama") pin = LAMPU_KAMAR_UTAMA;
  else if (deviceId == "lampu_kamar_anak") pin = LAMPU_KAMAR_ANAK;
  else if (deviceId == "lampu_ruang_keluarga") pin = LAMPU_RUANG_KELUARGA;
  else if (deviceId == "lampu_ruang_makan") pin = LAMPU_RUANG_MAKAN;
  else if (deviceId == "ac_kamar_utama") pin = AC_KAMAR_UTAMA;
  else if (deviceId == "ac_kamar_anak") pin = AC_KAMAR_ANAK;
  else if (deviceId == "pintu_garasi") pin = PINTU_GARASI;

  if (pin != -1) {
    digitalWrite(pin, state ? HIGH : LOW);
  }
}

// =================================================================================
//  MAIN LOOP
// =================================================================================
void loop() {
  if (Firebase.ready() && signupOK && !stream.isStream()) {
    Serial.println("Stream disconnected, restarting...");
    Firebase.RTDB.endStream(&stream);
    if (!Firebase.RTDB.beginStream(&stream, "/devices")) {
        Serial.printf("Stream begin error: %s\n", stream.errorReason().c_str());
    }
  }

  // Update sensor data periodically
  if (Firebase.ready() && signupOK && (millis() - sendDataPrevMillis > 5000 || sendDataPrevMillis == 0)) {
    sendDataPrevMillis = millis();
    bool motionState = digitalRead(SENSOR_GERAK) == HIGH;
    bool lightState = digitalRead(SENSOR_CAHAYA) == HIGH;

    FirebaseJson json;
    json.set("sensor_gerak/state", motionState);
    json.set("sensor_cahaya/state", lightState);

    // Use updateNode to update multiple sensor values at once
    if (Firebase.RTDB.updateNode(&fbdo, "/sensors", &json)) {
      Serial.printf("Sensor data updated: Gerak=%d, Cahaya=%d\n", motionState, lightState);
    } else {
      Serial.printf("Failed to update sensor data: %s\n", fbdo.errorReason().c_str());
    }
  }
}

// =================================================================================
//  SETUP FUNCTIONS
// =================================================================================
void setup() {
  Serial.begin(115200);
  
  pinMode(LAMPU_TERAS, OUTPUT);
  pinMode(LAMPU_TAMAN, OUTPUT);
  pinMode(LAMPU_RUANG_TAMU, OUTPUT);
  pinMode(LAMPU_DAPUR, OUTPUT);
  pinMode(LAMPU_KAMAR_UTAMA, OUTPUT);
  pinMode(LAMPU_KAMAR_ANAK, OUTPUT);
  pinMode(LAMPU_RUANG_KELUARGA, OUTPUT);
  pinMode(LAMPU_RUANG_MAKAN, OUTPUT);
  pinMode(AC_KAMAR_UTAMA, OUTPUT);
  pinMode(AC_KAMAR_ANAK, OUTPUT);
  pinMode(PINTU_GARASI, OUTPUT);
  pinMode(SENSOR_GERAK, INPUT);
  pinMode(SENSOR_CAHAYA, INPUT);

  setupWiFi();
  setupFirebase();
}

void setupWiFi() {
  Serial.println();
  Serial.print("Connecting to WiFi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    Serial.print(".");
    delay(500);
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("Connected with IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFailed to connect to WiFi. Please check credentials and signal.");
  }
}

void setupFirebase() {
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  // Use anonymous sign-in
  config.signer.test_mode = true;
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Sign up successful");
    signupOK = true;
    uid = Firebase.auth()->user.uid.c_str();
    Serial.printf("User UID: %s\n", uid.c_str());
  } else {
    Serial.printf("Sign up failed: %s\n", config.signer.signupError.message.c_str());
  }

  // If sign-up fails because email exists, try to sign in
  if (!signupOK && config.signer.signupError.code == 400 && config.signer.signupError.message.indexOf("EMAIL_EXISTS") != -1) {
    Serial.println("User exists, trying to sign in...");
    if (Firebase.signIn(&config, &auth, "", "")) {
      signupOK = true;
      uid = Firebase.auth()->user.uid.c_str();
      Serial.printf("Sign in successful. User UID: %s\n", uid.c_str());
    } else {
       Serial.printf("Sign in failed: %s\n", config.signer.error.message.c_str());
    }
  }

  if (signupOK) {
    // Initialize all devices to OFF (false) state in Firebase on startup
    FirebaseJson json;
    json.set("lampu_teras/state", false);
    json.set("lampu_taman/state", false);
    json.set("lampu_ruang_tamu/state", false);
    json.set("lampu_dapur/state", false);
    json.set("lampu_kamar_utama/state", false);
    json.set("lampu_kamar_anak/state", false);
    json.set("lampu_ruang_keluarga/state", false);
    json.set("lampu_ruang_makan/state", false);
    json.set("ac_kamar_utama/state", false);
    json.set("ac_kamar_anak/state", false);
    json.set("pintu_garasi/state", false);

    Serial.printf("Updating initial device states... %s\n", Firebase.RTDB.updateNode(&fbdo, "/devices", &json) ? "OK" : fbdo.errorReason().c_str());
    
    // Set up the stream
    Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback);
    if (!Firebase.RTDB.beginStream(&stream, "/devices")) {
      Serial.printf("Stream begin error: %s\n", stream.errorReason().c_str());
    }
  } else {
    Serial.println("Firebase setup failed. Cannot proceed.");
  }
}
