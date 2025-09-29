/**
 * This is an example for Firebase Home Automation using Firebase Realtime Database.
 * 
 * This example is written for ESP32 boards.
 * 
 * The following functions are demonstrated in this example.
 * 
 * - Stream callback for monitoring the value changes.
 * 
 * 
 * This example is based on the RTDB examples from ESP8266/ESP32 Firebase client library.
 * https://github.com/mobizt/Firebase-ESP-Client
 * 
*/

#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

//Provide the token generation process info.
#include "addons/TokenHelper.h"
//Provide the RTDB payload printing info and other helper functions.
#include "addons/RTDBHelper.h"

// Insert your network credentials
#define WIFI_SSID "IGD"
#define WIFI_PASSWORD "Siwd2020"

// Insert Firebase project API Key
#define API_KEY "AIzaSyDQHD5hWDvY_Jp7kTsvOJ4Yei_fRYVgA3Y"

// Insert RTDB URLefine the RTDB URL */
#define DATABASE_URL "https://batchscale-monitor-default-rtdb.asia-southeast1.firebasedatabase.app"

//Define Firebase objects
FirebaseData stream;
FirebaseData fbdo;

FirebaseAuth auth;
FirebaseConfig config;

// Variable to save USER UID
String uid;

// Database path
String dbPath = "/devices";

// Variable to save currentMillis
unsigned long currentMillis;

void streamCallback(FirebaseStream data) {
  if (data.dataType() == "json") {
    FirebaseJson *json = data.to<FirebaseJson *>();
    size_t len = json->iteratorBegin();
    String key, value, type;
    int int_value;
    for (size_t i = 0; i < len; i++) {
        json->iteratorGet(i, type, key, value);
        if (key.c_str() && value.c_str()) {
          Serial.printf("key: %s, value: %s, type: %s, isDigital: %d\n", key.c_str(), value.c_str(), type.c_str(), json->isDigital(value.c_str()));
        }
        
        if (key == "state") {
          value.toLowerCase();
          if (value == "true") {
            int_value = 1;
          } else {
            int_value = 0;
          }
          // Get the device parent key
          String parentKey = json->toString();
          parentKey.remove(parentKey.length() - 1);
          parentKey = parentKey.substring(parentKey.lastIndexOf("/") + 1);

          // Find the pin for the device
          int pin = -1;
          if (parentKey == "lampu_teras") pin = 2;
          else if (parentKey == "lampu_taman") pin = 4;
          else if (parentKey == "lampu_ruang_tamu") pin = 5;
          else if (parentKey == "lampu_dapur") pin = 18;
          else if (parentKey == "lampu_kamar_utama") pin = 19;
          else if (parentKey == "lampu_kamar_anak") pin = 21;
          else if (parentKey == "lampu_ruang_keluarga") pin = 22;
          else if (parentKey == "lampu_ruang_makan") pin = 23;
          else if (parentKey == "ac_kamar_utama") pin = 25;
          else if (parentKey == "ac_kamar_anak") pin = 26;
          else if (parentKey == "pintu_garasi") pin = 27;

          if (pin != -1) {
            digitalWrite(pin, int_value);
          }
        }

    }
    json->iteratorEnd();
    delete json;
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("stream timeout, resuming...\n");
  }
}

void setup() {

  Serial.begin(115200);

  // Initialize device pins
  pinMode(2, OUTPUT);
  pinMode(4, OUTPUT);
  pinMode(5, OUTPUT);
  pinMode(18, OUTPUT);
  pinMode(19, OUTPUT);
  pinMode(21, OUTPUT);
  pinMode(22, OUTPUT);
  pinMode(23, OUTPUT);
  pinMode(25, OUTPUT);
  pinMode(26, OUTPUT);
  pinMode(27, OUTPUT);

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

  /* Assign the api key (required) */
  config.api_key = API_KEY;

  /* Assign the RTDB URL (required) */
  config.database_url = DATABASE_URL;

  /* Sign up */
  if (Firebase.signUp(&config, &auth, "", "")){
    Serial.println("Sign Up Success");
    uid = Firebase.auth.token.uid.c_str();
  }
  else{
    Serial.printf("Sign Up Error: %s\n", config.signer.signupError.message.c_str());
  }

  /* Assign the callback function for the long running token generation task */
  config.token_status_callback = tokenStatusCallback; //see addons/TokenHelper.h
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  if (!Firebase.RTDB.beginStream(&stream, "/devices")) {
    Serial.printf("Stream begin error: %s\n", stream.errorReason().c_str());
  }
  
  Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback);
  
  // Set initial state for all devices to off
  if (Firebase.ready()) {
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
    Firebase.RTDB.updateNode(fbdo, "/devices", &json);
  }
}

void loop() {
  currentMillis = millis();

  // Keep alive the stream
  if (Firebase.ready() && (currentMillis - stream.last_stream_millis > 60000 || stream.stream_millis == 0)) {
    if (!Firebase.RTDB.beginStream(&stream, "/devices")) {
      Serial.printf("sStream begin error, %s\n", stream.errorReason().c_str());
    }
  }

  //this function must be called in loop to handle token generation
  if(Firebase.ready()){
    //your main code here
  }
}

