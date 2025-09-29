// Dibuat oleh AI untuk PT. Farika Riau Perkasa
// Versi Kode: 4.0 - Final Build with Modern Firebase Library

// --- Termasuk Pustaka ---
#include <Arduino.h>
#if defined(ESP32)
#include <WiFi.h>
#elif defined(ESP8266)
#include <ESP8266WiFi.h>
#endif

#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// --- Konfigurasi WiFi ---
// Ganti dengan kredensial WiFi Anda
#define WIFI_SSID "i don't know"
#define WIFI_PASSWORD "hutabarat"

// --- Konfigurasi Firebase ---
// Ganti dengan kredensial proyek Firebase Anda
#define API_KEY "AIzaSyDQHD5hWDvY_Jp7kTsvOJ4Yei_fRYVgA3Y"
#define DATABASE_URL "https://batchscale-monitor-default-rtdb.asia-southeast1.firebasedatabase.app"

// --- Objek Global Firebase ---
FirebaseData fbdo;
FirebaseData stream;
FirebaseAuth auth;
FirebaseConfig config;
String uid;

// --- Variabel Global ---
unsigned long sendDataPrevMillis = 0;
unsigned long count = 0;

// --- Deklarasi Fungsi ---
void setupWiFi();
void setupFirebase();
void streamCallback(FirebaseStream data);
void streamTimeoutCallback(bool timeout);
void handleDeviceControl(String deviceId, String state);

// --- Implementasi Fungsi ---

void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println("================================");
  Serial.println("  Lalisa Home Control - ESP32");
  Serial.println("================================");

  setupWiFi();
  setupFirebase();
}

void loop() {
  if (Firebase.ready() && millis() - sendDataPrevMillis > 15000) {
    sendDataPrevMillis = millis();
    if (stream.isStream()) {
       Serial.println("Stream is active.");
    } else {
       Serial.println("Stream is not active. Attempting to reconnect...");
       Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback);
       if (!Firebase.RTDB.beginStream(&stream, "/devices")) {
         Serial.printf("Stream begin error: %s\n", stream.errorReason().c_str());
       }
    }
  }

  // Handle sensor readings and other loop logic here if needed
  delay(100); 
}

void streamCallback(FirebaseStream data) {
  Serial.printf("Stream data available, path: %s, event: %s, type: %s\n",
                data.streamPath().c_str(),
                data.eventType().c_str(),
                data.dataType().c_str());

  if (data.dataTypeEnum() == fb_esp_rtdb_data_type_json) {
    FirebaseJson *json = data.to<FirebaseJson *>();
    size_t len = json->iteratorBegin();
    String key, value;
    int type;

    Serial.println("Iterating through JSON data:");
    for (size_t i = 0; i < len; i++) {
      json->iteratorGet(i, type, key, value);
      if (key.endsWith("/state")) { // We only care about state changes
        String deviceId = key;
        deviceId.replace("/state", ""); // Extract device ID
        Serial.printf("Device: %s, New State: %s\n", deviceId.c_str(), value.c_str());
        handleDeviceControl(deviceId, value);
      }
    }
    json->iteratorEnd();
    json->clear();
  } else if (data.dataTypeEnum() == fb_esp_rtdb_data_type_boolean) {
      String devicePath = data.dataPath();
      if(devicePath.endsWith("/state")) {
          String deviceId = devicePath;
          deviceId.replace("/state", "");
          deviceId.replace("/", ""); // remove leading slash
          bool state = data.to<bool>();
          Serial.printf("Direct state change for Device: %s, New State: %s\n", deviceId.c_str(), state ? "true" : "false");
          handleDeviceControl(deviceId, state ? "true" : "false");
      }
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("Stream timeout, will reconnect.");
  }
}

void handleDeviceControl(String deviceId, String state) {
  int pin = -1;
  // This is a simple mapping. A more robust solution might use a struct or map.
  if (deviceId == "lampu_teras") pin = 2;
  else if (deviceId == "lampu_taman") pin = 4;
  else if (deviceId == "lampu_ruang_tamu") pin = 5;
  else if (deviceId == "lampu_dapur") pin = 18;
  else if (deviceId == "lampu_kamar_utama") pin = 19;
  else if (deviceId == "lampu_kamar_anak") pin = 21;
  else if (deviceId == "lampu_ruang_keluarga") pin = 22;
  else if (deviceId == "lampu_ruang_makan") pin = 23;
  else if (deviceId == "ac_kamar_utama") pin = 25;
  else if (deviceId == "ac_kamar_anak") pin = 26;
  else if (deviceId == "pintu_garasi") pin = 27;

  if (pin != -1) {
    bool newState = (state == "true");
    digitalWrite(pin, newState ? HIGH : LOW);
    Serial.printf("Set pin %d to %s\n", pin, newState ? "HIGH" : "LOW");
  }
}


void setupWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long startAttemptTime = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 20000) {
    Serial.print(".");
    delay(500);
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\nFailed to connect to WiFi. Please check credentials or signal.");
    // We'll let it proceed so Firebase can maybe connect later, or show errors.
  } else {
    Serial.println("\nWiFi Connected.");
    Serial.print("Connected with IP: ");
    Serial.println(WiFi.localIP());
  }
}

void setupFirebase() {
  Serial.println("Initializing Firebase...");

  // Assign the API key
  config.api_key = API_KEY;
  // Assign the RTDB URL
  config.database_url = DATABASE_URL;

  // Sign up anonymously
  Serial.println("Signing up new anonymous user...");
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Sign up successful");
    uid = Firebase.auth()->user.uid.c_str();
    Serial.printf("User UID: %s\n", uid.c_str());
  } else {
    Serial.printf("Sign up failed: %s\n", config.signer.signupError.message.c_str());
    // If user already exists, try to sign in
    if (config.signer.signupError.message.indexOf("EMAIL_EXISTS") != -1) {
      Serial.println("User exists, trying to sign in...");
      if (Firebase.Auth.signInAnonymously(auth)) {
        Serial.println("Sign in successful");
        uid = Firebase.Auth.getUid();
        Serial.printf("User UID: %s\n", uid.c_str());
      } else {
        Serial.printf("Sign in failed: %s\n", Firebase.Auth.getError().message.c_str());
      }
    }
  }

  // Assign the callback function for token status processing
  config.token_status_callback = tokenStatusCallback;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Initialize all device pins as OUTPUT
  int pins[] = {2, 4, 5, 18, 19, 21, 22, 23, 25, 26, 27};
  for (int pin : pins) {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW); // Default to OFF
  }

  // Set up the stream
  if (!Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback)) {
    Serial.printf("Stream callback setup failed: %s\n", stream.errorReason().c_str());
  }
  
  if (!Firebase.RTDB.beginStream(&stream, "/devices")) {
    Serial.printf("Stream begin error: %s\n", stream.errorReason().c_str());
  } else {
    Serial.println("Stream started successfully on /devices");
  }
}
