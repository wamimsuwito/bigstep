/**
 * PT. Farika Riau Perkasa
 *
 * This code is for ESP32 to control various devices (lights, AC, doors)
 * and read sensors, communicating with a Firebase Realtime Database.
 *
 * It connects to Wi-Fi, signs into Firebase, and then listens for commands
 * from the database to toggle GPIO pins connected to relays. It also
 * initializes the device states on Firebase upon first connect.
 *
 * Make sure to install the required libraries:
 * - Firebase ESP Client by Mobizt
 * - Adafruit Unified Sensor
 * - DHT sensor library
 */
#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// Provide the token generation process info.
#include "addons/TokenHelper.h"
// Provide the RTDB payload printing info and other helper functions.
#include "addons/RTDBHelper.h"

// --- Wi-Fi Credentials ---
// Replace with your actual Wi-Fi credentials
#define WIFI_SSID "I dont't know"
#define WIFI_PASSWORD "hutabarat"

// --- Firebase Project Configuration ---
// Replace with your Firebase project config
#define API_KEY "AIzaSyDQHD5hWDvY_Jp7kTsvOJ4Yei_fRYVgA3Y"
#define DATABASE_URL "https://batchscale-monitor-default-rtdb.asia-southeast1.firebasedatabase.app"
#define USER_EMAIL "esp32@farika.com"
#define USER_PASSWORD "esp32password"


// Define Firebase objects
FirebaseData stream;
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Variable to store user UID
String uid;

// --- Device and Sensor Definitions ---
// Match these pins with your actual hardware wiring
struct Device {
  const char* id;
  uint8_t pin;
  bool state;
};

Device devices[] = {
  {"lampu_teras", 2, false},
  {"lampu_taman", 4, false},
  {"lampu_ruang_tamu", 5, false},
  {"lampu_dapur", 18, false},
  {"lampu_kamar_utama", 19, false},
  {"lampu_kamar_anak", 21, false},
  {"lampu_ruang_keluarga", 22, false},
  {"lampu_ruang_makan", 23, false},
  {"ac_kamar_utama", 25, false},
  {"ac_kamar_anak", 26, false},
  {"pintu_garasi", 27, false}
};
const int numDevices = sizeof(devices) / sizeof(Device);

// Callback function to handle stream data
void streamCallback(FirebaseStream data) {
  if (data.dataTypeEnum() == fb_esp_rtdb_data_type_json) {
    FirebaseJson *json = data.to<FirebaseJson *>();
    size_t len = json->iteratorBegin();
    String key, value;
    int type;

    Serial.println("--- Stream Data ---");
    for (size_t i = 0; i < len; i++) {
        json->iteratorGet(i, type, key, value);
        Serial.printf("Key: %s, Value: %s, Type: %s\n", key.c_str(), value.c_str(), json->typeStr(type).c_str());

        // Update the state of the corresponding device
        for (int j = 0; j < numDevices; j++) {
            if (key == devices[j].id) {
                bool newState = (value == "true");
                devices[j].state = newState;
                digitalWrite(devices[j].pin, newState ? HIGH : LOW);
                Serial.printf("Device %s is now %s\n", devices[j].id, newState ? "ON" : "OFF");
                break;
            }
        }
    }
    json->iteratorEnd();
    Serial.println("--- End Stream ---");
  } else {
    Serial.println("Stream data type is not JSON");
    Serial.println("Data: " + data.stringData());
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("Stream timeout, resuming...");
  }
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    Serial.print(".");
    delay(500);
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("Connected with IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFailed to connect to WiFi. Please check your credentials or signal.");
  }
}

// Function to initialize device states on Firebase
void initDevicesOnFirebase() {
    FirebaseJson json;
    for (int i = 0; i < numDevices; i++) {
        json.set(String(devices[i].id) + "/state", false);
    }
    
    Serial.println("Initializing device states on Firebase...");
    if (Firebase.RTDB.updateNode(&fbdo, "/devices", &json)) {
        Serial.println("Device states initialized successfully.");
    } else {
        Serial.println("Failed to initialize device states.");
        Serial.println("REASON: " + fbdo.errorReason());
    }
}


void setupFirebase() {
  // Assign the API key
  config.api_key = API_KEY;

  // Assign the RTDB URL
  config.database_url = DATABASE_URL;

  // Sign up
  if (Firebase.signUp(&config, &auth, "", "")){
    Serial.println("Sign Up Success");
    signupOK = true;
  }
  else{
    Serial.printf("Sign Up Failed: %s\n", config.signer.signupError.message.c_str());
  }
  
  // Assign the user sign-in credentials
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  // Assign the callback function for the long running token generation task
  config.token_status_callback = tokenStatusCallback;
  config.max_token_generation_retry = 5;

  Firebase.begin(&config, &auth);
  
  Firebase.reconnectWiFi(true);

  // Set up stream callback
  Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback);
  
  // Start stream
  if (!Firebase.RTDB.beginStream(&stream, "/devices")) {
    Serial.printf("Stream begin error: %s\n", stream.errorReason().c_str());
  }

  // Initialize devices on Firebase if they don't exist
  initDevicesOnFirebase();
}

void setup() {
  Serial.begin(115200);
  
  // Initialize device pins
  for (int i = 0; i < numDevices; i++) {
    pinMode(devices[i].pin, OUTPUT);
    digitalWrite(devices[i].pin, LOW);
  }

  connectWiFi();
  
  if (WiFi.status() == WL_CONNECTED) {
    setupFirebase();
  }
}

void loop() {
  // Firebase.ready() should be called repeatedly to handle authentication tasks.
  if (Firebase.ready()) {
      // Your other loop code can go here
  }
  delay(1000);
}
