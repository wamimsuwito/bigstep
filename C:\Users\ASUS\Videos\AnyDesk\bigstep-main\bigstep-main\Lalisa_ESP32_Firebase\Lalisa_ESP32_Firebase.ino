/**
 * Lalisa Home Automation Control
 * 
 * This sketch connects an ESP32 to Firebase Realtime Database to control various devices 
 * (lights, AC, etc.) and monitor sensors. It listens for changes in the '/devices' path 
 * in the database and updates the GPIO pins accordingly.
 * 
 * Written for Firebase ESP Client Library v4.x.x
 */

#include <Arduino.h>
#if defined(ESP32)
#include <WiFi.h>
#elif defined(ESP8266)
#include <ESP8266WiFi.h>
#endif

#include <Firebase_ESP_Client.h>

// Provide the token generation process info.
#include "addons/TokenHelper.h"
// Provide the RTDB payload printing info and other helper functions.
#include "addons/RTDBHelper.h"

// --- WiFi and Firebase Credentials ---
// Replace with your actual WiFi credentials
#define WIFI_SSID "I don't know"
#define WIFI_PASSWORD "hutabarat"

// Replace with your Firebase project's credentials
#define API_KEY "AIzaSyDQHD5hWDvY_Jp7kTsvOJ4Yei_fRYVgA3Y"
#define DATABASE_URL "https://batchscale-monitor-default-rtdb.asia-southeast1.firebasedatabase.app"

// --- Device and Sensor Pin Definitions ---
// Define device pins
const int LAMPU_TERAS_PIN = 2;
const int LAMPU_TAMAN_PIN = 4;
const int LAMPU_RUANG_TAMU_PIN = 5;
const int LAMPU_DAPUR_PIN = 18;
const int LAMPU_KAMAR_UTAMA_PIN = 19;
const int LAMPU_KAMAR_ANAK_PIN = 21;
const int LAMPU_RUANG_KELUARGA_PIN = 22;
const int LAMPU_RUANG_MAKAN_PIN = 23;
const int AC_KAMAR_UTAMA_PIN = 25;
const int AC_KAMAR_ANAK_PIN = 26;
const int PINTU_GARASI_PIN = 27;

// Define sensor pins
const int SENSOR_GERAK_PIN = 13;
const int SENSOR_CAHAYA_PIN = 12;

// --- Firebase Global Objects ---
FirebaseData stream; // Main object for stream data
FirebaseData fbdo;   // Main object for other RTDB operations
FirebaseAuth auth;
FirebaseConfig config;

// --- Function Prototypes ---
void setupWiFi();
void setupFirebase();
void streamCallback(FirebaseStream data);
void streamTimeoutCallback(bool timeout);
void handleDeviceControl(String deviceId, bool state);

// --- Main Setup Function ---
void setup() {
  Serial.begin(115200);
  Serial.println();

  // Initialize GPIO pins
  pinMode(LAMPU_TERAS_PIN, OUTPUT);
  pinMode(LAMPU_TAMAN_PIN, OUTPUT);
  pinMode(LAMPU_RUANG_TAMU_PIN, OUTPUT);
  pinMode(LAMPU_DAPUR_PIN, OUTPUT);
  pinMode(LAMPU_KAMAR_UTAMA_PIN, OUTPUT);
  pinMode(LAMPU_KAMAR_ANAK_PIN, OUTPUT);
  pinMode(LAMPU_RUANG_KELUARGA_PIN, OUTPUT);
  pinMode(LAMPU_RUANG_MAKAN_PIN, OUTPUT);
  pinMode(AC_KAMAR_UTAMA_PIN, OUTPUT);
  pinMode(AC_KAMAR_ANAK_PIN, OUTPUT);
  pinMode(PINTU_GARASI_PIN, OUTPUT);
  pinMode(SENSOR_GERAK_PIN, INPUT);
  pinMode(SENSOR_CAHAYA_PIN, INPUT);

  setupWiFi();
  if (WiFi.status() == WL_CONNECTED) {
    setupFirebase();
  }
}

// --- Main Loop Function ---
void loop() {
  unsigned long currentMillis = millis();

  // Check Firebase stream status and read data if available
  if (Firebase.ready()) {
    if (!stream.isStream()) {
        Serial.println("Stream disconnected, restarting...");
        Firebase.RTDB.endStream(stream); // Make sure to end the old stream
        if (!Firebase.RTDB.beginStream(stream, "/devices")) {
            Serial.printf("Could not begin stream: %s\n", stream.errorReason().c_str());
        }
    } else {
        if (!Firebase.RTDB.readStream(stream)) {
            Serial.printf("Read stream failed: %s\n", stream.errorReason().c_str());
        }
    }
  }

  // Sensor reading logic (can be added here)
  // e.g., read sensor values and update Firebase
}

// --- WiFi Setup ---
void setupWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long startAttemptTime = millis();

  // Try to connect for 20 seconds
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 20000) {
    Serial.print(".");
    delay(500);
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\nFailed to connect to WiFi.");
  } else {
    Serial.println("\nWiFi connected.");
    Serial.print("Connected with IP: ");
    Serial.println(WiFi.localIP());
  }
}

// --- Firebase Setup ---
void setupFirebase() {
  Serial.println("Initializing Firebase...");

  // Assign the API key
  config.api_key = API_KEY;
  // Assign the RTDB URL
  config.database_url = DATABASE_URL;

  // Sign up anonymously
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase anonymous sign-up successful.");
  } else {
    Serial.printf("Firebase sign-up failed: %s\n", config.signer.signupError.message.c_str());
    // Check if the error is because the user already exists
    if (config.signer.signupError.message.indexOf("EMAIL_EXISTS") != -1) {
      Serial.println("User exists, trying to sign in...");
      if (Firebase.signIn(&config, &auth, "", "")) {
         Serial.println("Firebase anonymous sign-in successful.");
      } else {
         Serial.printf("Sign in failed: %s\n", config.signer.error.message.c_str());
      }
    }
  }
  
  // Assign the user UID to the auth object
  config.token_status_callback = tokenStatusCallback;
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  
  Serial.println("Starting Firebase Realtime Database stream...");

  // Set up the stream callbacks
  Firebase.RTDB.setStreamCallback(stream, streamCallback, streamTimeoutCallback);
  
  // Begin the stream on the "/devices" path
  if (!Firebase.RTDB.beginStream(stream, "/devices")) {
    Serial.printf("Could not begin stream: %s\n", stream.errorReason().c_str());
  } else {
    Serial.println("Stream started successfully.");
  }
}

// --- Firebase Stream Callback ---
void streamCallback(FirebaseStream data) {
  Serial.printf("Stream received, path: %s, event: %s, type: %s\n",
                data.streamPath().c_str(),
                data.eventType().c_str(),
                data.dataType().c_str());

  if (data.dataTypeEnum() == fb_esp_data_type_json) {
    FirebaseJson *json = data.to<FirebaseJson *>();
    size_t len = json->iteratorCount();
    String key, value;
    int type = 0;

    for (size_t i = 0; i < len; i++) {
        json->iteratorGet(i, type, key, value);
        Serial.printf("Key: %s, Value: %s, Type: %d\n", key.c_str(), value.c_str(), type);
        
        // Find the device configuration by its ID (key)
        if (key == "lampu_teras") handleDeviceControl(key, value == "true");
        else if (key == "lampu_taman") handleDeviceControl(key, value == "true");
        else if (key == "lampu_ruang_tamu") handleDeviceControl(key, value == "true");
        else if (key == "lampu_dapur") handleDeviceControl(key, value == "true");
        else if (key == "lampu_kamar_utama") handleDeviceControl(key, value == "true");
        else if (key == "lampu_kamar_anak") handleDeviceControl(key, value == "true");
        else if (key == "lampu_ruang_keluarga") handleDeviceControl(key, value == "true");
        else if (key == "lampu_ruang_makan") handleDeviceControl(key, value == "true");
        else if (key == "ac_kamar_utama") handleDeviceControl(key, value == "true");
        else if (key == "ac_kamar_anak") handleDeviceControl(key, value == "true");
        else if (key == "pintu_garasi") handleDeviceControl(key, value == "true");
    }
  }
}

// --- Firebase Stream Timeout Callback ---
void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("Stream timeout, will reconnect...");
  }
}

// --- Device Control Logic ---
void handleDeviceControl(String deviceId, bool state) {
  int pin = -1;
  if (deviceId == "lampu_teras") pin = LAMPU_TERAS_PIN;
  else if (deviceId == "lampu_taman") pin = LAMPU_TAMAN_PIN;
  else if (deviceId == "lampu_ruang_tamu") pin = LAMPU_RUANG_TAMU_PIN;
  else if (deviceId == "lampu_dapur") pin = LAMPU_DAPUR_PIN;
  else if (deviceId == "lampu_kamar_utama") pin = LAMPU_KAMAR_UTAMA_PIN;
  else if (deviceId == "lampu_kamar_anak") pin = LAMPU_KAMAR_ANAK_PIN;
  else if (deviceId == "lampu_ruang_keluarga") pin = LAMPU_RUANG_KELUARGA_PIN;
  else if (deviceId == "lampu_ruang_makan") pin = LAMPU_RUANG_MAKAN_PIN;
  else if (deviceId == "ac_kamar_utama") pin = AC_KAMAR_UTAMA_PIN;
  else if (deviceId == "ac_kamar_anak") pin = AC_KAMAR_ANAK_PIN;
  else if (deviceId == "pintu_garasi") pin = PINTU_GARASI_PIN;

  if (pin != -1) {
    digitalWrite(pin, state ? HIGH : LOW);
    Serial.printf("Set %s (Pin %d) to %s\n", deviceId.c_str(), pin, state ? "ON" : "OFF");
  }
}
