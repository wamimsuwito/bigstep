
#include <Arduino.h>
#if defined(ESP32)
#include <WiFi.h>
#elif defined(ESP8266)
#include <ESP8266WiFi.h>
#endif

// This library is required for ESP32 and ESP8266 board add-on versions 2.0.x
#include <Firebase_ESP_Client.h>

// Provide the token generation process info.
#include "addons/TokenHelper.h"
// Provide the RTDB payload printing info and other helper functions.
#include "addons/RTDBHelper.h"

// --- WiFi Credentials ---
// Ganti dengan nama WiFi dan password Anda
#define WIFI_SSID "I don't know"
#define WIFI_PASSWORD "hutabarat"

// --- Firebase Project Configuration ---
#define API_KEY "AIzaSyDQHD5hWDvY_Jp7kTsvOJ4Yei_fRYVgA3Y"
#define DATABASE_URL "https://batchscale-monitor-default-rtdb.asia-southeast1.firebasedatabase.app/"

// --- User Account for Firebase ---
// Kita akan membuat akun ini secara otomatis
#define USER_EMAIL "lalisa@example.com"
#define USER_PASSWORD "password123"

// --- Define Firebase objects ---
FirebaseData stream;
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// --- Global Variables ---
String uid;
unsigned long sendDataPrevMillis = 0;
unsigned long count = 0;

// --- Pin Definitions ---
// Define pins for all devices
const int pin_lampu_teras = 2;
const int pin_lampu_taman = 4;
const int pin_lampu_ruang_tamu = 5;
const int pin_lampu_dapur = 18;
const int pin_lampu_kamar_utama = 19;
const int pin_lampu_kamar_anak = 21;
const int pin_lampu_ruang_keluarga = 22;
const int pin_lampu_ruang_makan = 23;
const int pin_ac_kamar_utama = 25;
const int pin_ac_kamar_anak = 26;
const int pin_pintu_garasi = 27;

// --- Function Prototypes ---
void streamCallback(FirebaseStream data);
void streamTimeoutCallback(bool timeout);
void setupFirebase();
void connectWiFi();
void initDevicesOnFirebase();

void streamCallback(FirebaseStream data) {
  Serial.printf("Stream changed, path: %s, event: %s\n", data.streamPath().c_str(), data.eventType().c_str());

  if (data.dataTypeEnum() == fb_esp_rtdb_data_type_json) {
    FirebaseJson *json = data.to<FirebaseJson *>();
    size_t len = json->iteratorBegin();
    FirebaseJson::IteratorValue value;
    int type;
    String key;
    
    for (size_t i = 0; i < len; i++) {
        value = json->valueAt(i);
        key = value.key;
        
        Serial.printf("Key: %s, Value: %s, Type: %s\n", key.c_str(), value.value.c_str(), data.dataType().c_str());

        int pin = -1;
        if (key == "lampu_teras") pin = pin_lampu_teras;
        else if (key == "lampu_taman") pin = pin_lampu_taman;
        else if (key == "lampu_ruang_tamu") pin = pin_lampu_ruang_tamu;
        else if (key == "lampu_dapur") pin = pin_lampu_dapur;
        else if (key == "lampu_kamar_utama") pin = pin_lampu_kamar_utama;
        else if (key == "lampu_kamar_anak") pin = pin_lampu_kamar_anak;
        else if (key == "lampu_ruang_keluarga") pin = pin_lampu_ruang_keluarga;
        else if (key == "lampu_ruang_makan") pin = pin_lampu_ruang_makan;
        else if (key == "ac_kamar_utama") pin = pin_ac_kamar_utama;
        else if (key == "ac_kamar_anak") pin = pin_ac_kamar_anak;
        else if (key == "pintu_garasi") pin = pin_pintu_garasi;

        if (pin != -1) {
            bool state = value.value == "true";
            digitalWrite(pin, state);
            Serial.printf("Set pin %d to %s\n", pin, state ? "HIGH" : "LOW");
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

void loop() {
  if (Firebase.ready() && (millis() - sendDataPrevMillis > 15000 || sendDataPrevMillis == 0)) {
    sendDataPrevMillis = millis();

    // Check if stream is still active
    if (!stream.isStream()) {
      Serial.println("Stream is not active, restarting...");
      Firebase.RTDB.setStreamCallback(stream, streamCallback, streamTimeoutCallback);
      Firebase.RTDB.beginStream(fbdo, "/devices");
    }
  }
}

void setup() {
  Serial.begin(115200);

  // Initialize all device pins as OUTPUT and set to LOW (off)
  pinMode(pin_lampu_teras, OUTPUT); digitalWrite(pin_lampu_teras, LOW);
  pinMode(pin_lampu_taman, OUTPUT); digitalWrite(pin_lampu_taman, LOW);
  pinMode(pin_lampu_ruang_tamu, OUTPUT); digitalWrite(pin_lampu_ruang_tamu, LOW);
  pinMode(pin_lampu_dapur, OUTPUT); digitalWrite(pin_lampu_dapur, LOW);
  pinMode(pin_lampu_kamar_utama, OUTPUT); digitalWrite(pin_lampu_kamar_utama, LOW);
  pinMode(pin_lampu_kamar_anak, OUTPUT); digitalWrite(pin_lampu_kamar_anak, LOW);
  pinMode(pin_lampu_ruang_keluarga, OUTPUT); digitalWrite(pin_lampu_ruang_keluarga, LOW);
  pinMode(pin_lampu_ruang_makan, OUTPUT); digitalWrite(pin_lampu_ruang_makan, LOW);
  pinMode(pin_ac_kamar_utama, OUTPUT); digitalWrite(pin_ac_kamar_utama, LOW);
  pinMode(pin_ac_kamar_anak, OUTPUT); digitalWrite(pin_ac_kamar_anak, LOW);
  pinMode(pin_pintu_garasi, OUTPUT); digitalWrite(pin_pintu_garasi, LOW);
  
  connectWiFi();
  setupFirebase();
  initDevicesOnFirebase();
}


void setupFirebase() {
  Serial.println("Setting up Firebase...");
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  bool signupOK = false;
  Serial.println("Signing up new user...");
  signupOK = Firebase.signUp(&config, &auth, USER_EMAIL, USER_PASSWORD);
  
  if (signupOK) {
    uid = Firebase.getUid();
    Serial.printf("Sign up successful, UID: %s\n", uid.c_str());
  } else {
    Serial.printf("Sign up failed: %s\n", config.signer.signupError.message.c_str());
    if (config.signer.signupError.message.indexOf("EMAIL_EXISTS") != -1) {
      Serial.println("Email exists, trying to sign in...");
      if (Firebase.signInUser(config, auth, USER_EMAIL, USER_PASSWORD)) {
        uid = Firebase.getUid();
        Serial.printf("Sign in successful, UID: %s\n", uid.c_str());
      } else {
        Serial.printf("Sign in failed: %s\n", config.signer.error.message.c_str());
      }
    }
  }

  if (uid.length() > 0) {
    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);
    
    Firebase.RTDB.setStreamCallback(stream, streamCallback, streamTimeoutCallback);
    if (!Firebase.RTDB.beginStream(fbdo, "/devices")) {
      Serial.printf("Stream begin error: %s\n", stream.errorReason().c_str());
    }
  } else {
    Serial.println("Could not get UID, Firebase setup failed.");
  }
}

void initDevicesOnFirebase() {
  if (uid.length() > 0) {
    FirebaseJson json;
    json.add("lampu_teras", false);
    json.add("lampu_taman", false);
    json.add("lampu_ruang_tamu", false);
    json.add("lampu_dapur", false);
    json.add("lampu_kamar_utama", false);
    json.add("lampu_kamar_anak", false);
    json.add("lampu_ruang_keluarga", false);
    json.add("lampu_ruang_makan", false);
    json.add("ac_kamar_utama", false);
    json.add("ac_kamar_anak", false);
    json.add("pintu_garasi", false);

    Serial.println("Initializing devices on Firebase...");
    if (Firebase.RTDB.updateNode(&fbdo, "/devices", &json)) {
      Serial.println("Device initialization successful.");
    } else {
      Serial.printf("Device initialization failed: %s\n", fbdo.errorReason().c_str());
    }
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
  } else {
    Serial.println("\nWiFi connected.");
    Serial.print("Connected with IP: ");
    Serial.println(WiFi.localIP());
  }
}
