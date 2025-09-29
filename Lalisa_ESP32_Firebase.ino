/**
 * Wamin's Home - ESP32 Firebase Controller
 * 
 * This code connects an ESP32 to Firebase Realtime Database to control home appliances
 * and monitor sensors. It listens for changes in the '/devices' path to control relays
 * and updates the '/sensors' path when a sensor is triggered.
 * 
 * Make sure to install the "Firebase ESP32 Client" library by Mobizt
 * through the Arduino IDE's Library Manager.
 *
 * Board: "ESP32 Dev Module"
 */

#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// --- WIFI CONFIGURATION ---
#define WIFI_SSID "i don't know"
#define WIFI_PASSWORD "hutabarat"

// --- FIREBASE PROJECT CONFIGURATION ---
#define API_KEY "AIzaSyDQHD5hWDvY_Jp7kTsvOJ4Yei_fRYVgA3Y"
#define DATABASE_URL "https://batchscale-monitor-default-rtdb.asia-southeast1.firebasedatabase.app"

// --- PIN DEFINITIONS ---
// Define the GPIO pins connected to your relays
const int ledPins[] = {2, 4, 5, 18, 19, 21, 22, 23, 25, 26, 27}; 
const char* ledNames[] = {
  "lampu_teras", "lampu_taman", "lampu_ruang_tamu", "lampu_dapur", 
  "lampu_kamar_utama", "lampu_kamar_anak", "lampu_ruang_keluarga", 
  "lampu_ruang_makan", "ac_kamar_utama", "ac_kamar_anak", "pintu_garasi"
};
const int numLeds = sizeof(ledPins) / sizeof(ledPins[0]);

// Define sensor pins
const int motionSensorPin = 13;
const int lightSensorPin = 12;

// --- FIREBASE OBJECTS ---
FirebaseData stream;
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

volatile bool dataChanged = false;

// --- CALLBACK FUNCTION FOR STREAM ---
// This function is executed when a change is detected in the '/devices' path
void streamCallback(FirebaseStream data) {
  Serial.printf("Stream new data available, path: %s, type: %s\n", data.streamPath().c_str(), data.dataType().c_str());
  
  if (data.dataType() == "json") {
    FirebaseJson *json = data.to<FirebaseJson *>();
    size_t len = json->iteratorBegin();
    FirebaseJson::IteratorValue value;
    for (size_t i = 0; i < len; i++) {
      value = json->iteratorGet(i);
      Serial.printf("key: %s, value: %s, type: %s\n", value.key.c_str(), value.value.c_str(), value.type == FirebaseJson::JSON_OBJECT ? "object" : "array");
      
      for (int j = 0; j < numLeds; j++) {
        if (strcmp(value.key.c_str(), ledNames[j]) == 0) {
          bool state = (strcmp(value.value.c_str(), "true") == 0);
          digitalWrite(ledPins[j], state ? HIGH : LOW);
          Serial.printf("Device %s is now %s\n", ledNames[j], state ? "ON" : "OFF");
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

void setup() {
  Serial.begin(115200);
  
  // Initialize device pins
  for (int i = 0; i < numLeds; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }

  // Initialize sensor pins
  pinMode(motionSensorPin, INPUT_PULLUP);
  pinMode(lightSensorPin, INPUT_PULLUP);

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

  Firebase.reconnectWiFi(true);

  // Assign the callback function for the stream
  config.stream_callback = streamCallback;
  config.stream_timeout_callback = streamTimeoutCallback;

  // Initialize Firebase
  Firebase.begin(&config, &auth);

  // Start the stream to listen for changes in the '/devices' path
  if (!Firebase.RTDB.beginStream(&stream, "/devices")) {
    Serial.printf("------------------------------------\n");
    Serial.printf("Can't begin stream Firebase\n");
    Serial.printf("REASON: %s\n", stream.errorReason().c_str());
    Serial.printf("------------------------------------\n");
  }
}

unsigned long motionSensorTimer = 0;
unsigned long lightSensorTimer = 0;
const unsigned long sensorActiveDuration = 60000; // 60 seconds

void loop() {
  unsigned long currentMillis = millis();

  // Motion Sensor Logic
  if (digitalRead(motionSensorPin) == HIGH) {
    if (motionSensorTimer == 0) { // First detection
      Serial.println("Motion detected!");
      Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_gerak/state", true);
      motionSensorTimer = currentMillis;
    }
  }
  
  if (motionSensorTimer != 0 && currentMillis - motionSensorTimer >= sensorActiveDuration) {
    Serial.println("Motion sensor timer ended. Turning off.");
    Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_gerak/state", false);
    motionSensorTimer = 0; // Reset timer
  }

  // Light Sensor Logic (assuming HIGH means bright)
  if (digitalRead(lightSensorPin) == HIGH) {
     if (lightSensorTimer == 0) { // First detection
      Serial.println("Light detected!");
      Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_cahaya/state", true);
      lightSensorTimer = currentMillis;
    }
  }

  if (lightSensorTimer != 0 && currentMillis - lightSensorTimer >= sensorActiveDuration) {
    Serial.println("Light sensor timer ended. Turning off.");
    Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_cahaya/state", false);
    lightSensorTimer = 0; // Reset timer
  }

  delay(100); // Small delay to prevent spamming
}
