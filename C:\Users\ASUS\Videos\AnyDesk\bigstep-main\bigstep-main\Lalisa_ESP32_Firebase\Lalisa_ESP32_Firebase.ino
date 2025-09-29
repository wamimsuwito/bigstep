/**
 * Lalisa Home Automation - ESP32 Firmware
 * 
 * This code connects an ESP32 to a Firebase Realtime Database to control various devices 
 * (lights, AC, doors) and monitor sensors. It listens for changes in the '/devices' path 
 * in Firebase and updates the GPIO pins accordingly. It also initializes the default state 
 * of devices in Firebase on first boot or reconnection.
 * 
 * @version 3.0.0
 * @author Firebase Studio
 */

// =================================================================================================
// LIBRARY INCLUSIONS
// =================================================================================================
#include <Arduino.h>
#if defined(ESP32)
#include <WiFi.h>
#elif defined(ESP8266)
#include <ESP8266WiFi.h>
#endif

// This is the main library for Firebase communication.
#include <Firebase_ESP_Client.h>

// Helper libraries for Firebase data handling.
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// =================================================================================================
// WIFI & FIREBASE CONFIGURATION
// =================================================================================================
// --- WiFi Credentials ---
#define WIFI_SSID "I don't know"
#define WIFI_PASSWORD "hutabarat"

// --- Firebase Project Configuration ---
// These details are found in your Firebase project settings.
#define API_KEY "AIzaSyDQHD5hWDvY_Jp7kTsvOJ4Yei_fRYVgA3Y"
#define DATABASE_URL "https://batchscale-monitor-default-rtdb.asia-southeast1.firebasedatabase.app"

// --- Firebase Authentication ---
// Using an anonymous account for this example.
#define USER_EMAIL ""
#define USER_PASSWORD ""

// =================================================================================================
// GLOBAL OBJECTS & VARIABLES
// =================================================================================================
// Define Firebase objects
FirebaseData stream; // Used for the data stream
FirebaseData fbdo;   // Used for all other database operations

FirebaseAuth auth;   // For authentication
FirebaseConfig config; // For overall Firebase configuration

String uid;          // To store the user ID after anonymous login

// Structure to hold device information
struct Device {
  const char* id;
  int pin;
};

// Array of all controllable devices
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

// =================================================================================================
// FIREBASE CALLBACK FUNCTIONS
// =================================================================================================

// This function is called whenever new data is received from the stream.
void streamCallback(FirebaseStream data) {
  Serial.printf("Stream path: %s\n", data.streamPath().c_str());
  Serial.printf("Event type: %s\n", data.eventType().c_str());

  // Check if the data received is JSON
  if (data.dataType() == "json") {
    FirebaseJson json;
    json.setJsonData(data.payload()); // Get the JSON data

    // Variables for iterating through the JSON
    size_t len = json.iteratorBegin();
    String key, value;
    int type;

    // Loop through all key-value pairs in the received JSON
    for (size_t i = 0; i < len; i++) {
      json.iteratorGet(i, type, key, value); // Get data at the current index

      Serial.printf("Key: %s, Value: %s, Type: %s\n", key.c_str(), value.c_str(), json.typeStr(type).c_str());

      // Find the device that matches the key from Firebase
      for (int j = 0; j < numDevices; j++) {
        if (key == devices[j].id) {
          // Determine the state and set the GPIO pin
          bool state = (value == "true");
          Serial.printf("Setting pin %d to %s\n", devices[j].pin, state ? "HIGH" : "LOW");
          digitalWrite(devices[j].pin, state);
          break; // Exit inner loop once device is found
        }
      }
    }
    json.iteratorEnd(); // Clean up the iterator
  }
}

// This function is called when the stream connection times out.
void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("Stream timeout, resuming...");
  }
}

// =================================================================================================
// INITIALIZATION AND SETUP
// =================================================================================================

void initializeDevices() {
  FirebaseJson json;

  // Set the initial state of all devices to 'false' (off)
  for (int i = 0; i < numDevices; i++) {
    pinMode(devices[i].pin, OUTPUT);
    digitalWrite(devices[i].pin, LOW);
    json.set(devices[i].id + "/state", false);
  }
  
  // Update the entire '/devices' node in Firebase with the initial states
  Serial.println("Initializing devices on Firebase...");
  if (Firebase.RTDB.updateNode(&fbdo, "/devices", &json)) {
    Serial.println("Devices initialized successfully.");
  } else {
    Serial.printf("Failed to initialize devices: %s\n", fbdo.errorReason().c_str());
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println("Lalisa Home Automation - ESP32");

  // Connect to Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println();
  Serial.print("Connected with IP: ");
  Serial.println(WiFi.localIP());
  Serial.println();

  // Configure Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  // Sign up anonymously
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  // Assign the callback function for token generation
  config.token_status_callback = tokenStatusCallback; 

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Wait for Firebase to be ready
  Serial.println("Waiting for Firebase connection...");
  while (!Firebase.ready()) {
    Serial.print(".");
    delay(500);
  }
  Serial.println("Firebase is ready.");

  // Get the anonymous user UID
  uid = Firebase.UID();
  Serial.printf("User UID: %s\n", uid.c_str());

  // Initialize all device pins and their default state on Firebase
  initializeDevices();

  // Start the stream to listen for changes on the "/devices" path
  if (!Firebase.RTDB.beginStream(&stream, "/devices")) {
    Serial.printf("Could not begin stream: %s\n", stream.errorReason().c_str());
  }

  // Assign the callback functions for the stream
  Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback);
}

// =================================================================================================
// MAIN LOOP
// =================================================================================================

void loop() {
  // This is the main function that keeps the Firebase connection alive.
  // It must be called repeatedly in the loop.
  if (!Firebase.ready()) {
    Serial.println("Firebase not ready, trying to reconnect...");
    // If Firebase is not ready, you might want to handle reconnection logic here
    // or simply wait for it to become ready again.
    delay(1000);
  }

  // A small delay to prevent the loop from running too fast.
  delay(100);
}
