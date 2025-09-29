
/*
  Aplikasi Kontrol Rumah ESP32 untuk Firebase Realtime Database
  Dibuat untuk PT. Farika Riau Perkasa
  Dibuat oleh: Tim Engineering
  Versi: 2.1

  Fungsionalitas:
  - Terhubung ke WiFi.
  - Terhubung ke Firebase Realtime Database.
  - Mendengarkan perubahan pada path "/devices" di Firebase.
  - Mengontrol pin relay berdasarkan status dari Firebase.
  - Membaca data sensor (gerak dan cahaya) dan mengirimkannya ke Firebase.
  - Implementasi logika timer untuk sensor gerak.
*/

#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// Masukkan kredensial WiFi Anda
#define WIFI_SSID "i don't know"
#define WIFI_PASSWORD "hutabarat"

// Masukkan Konfigurasi Firebase Anda
#define API_KEY "AIzaSyDQHD5hWDvY_Jp7kTsvOJ4Yei_fRYVgA3Y"
#define DATABASE_URL "https://batchscale-monitor-default-rtdb.asia-southeast1.firebasedatabase.app"

// Objek-objek Firebase
FirebaseData stream;
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Deklarasi fungsi
void streamCallback(FirebaseStream data);
void streamTimeoutCallback(bool timeout);
void initDevices();
void updateDeviceState(String key, bool state);

// Variabel global
unsigned long sendDataPrevMillis = 0;
unsigned long pir_timer;
bool motion_detected = false;

// Definisi Pin
const int PIR_PIN = 13;
const int LDR_PIN = 12;

struct Device {
  const char* name;
  int pin;
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

void streamCallback(FirebaseStream data) {
  Serial.printf("Stream callback: %s, %s, %s\n", data.streamPath().c_str(), data.dataPath().c_str(), data.dataType().c_str());

  if (data.dataType() == "json") {
    FirebaseJson* json = data.to<FirebaseJson*>();
    size_t len = json->iteratorBegin();
    String key, value, type;
    int intValue;
    for (size_t i = 0; i < len; i++) {
        json->iteratorGet(i, type, key, value);
        if (key.length() > 0) {
            updateDeviceState(key, value == "true");
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

void initDevices() {
  FirebaseJson json;
  for (int i = 0; i < numDevices; i++) {
    pinMode(devices[i].pin, OUTPUT);
    digitalWrite(devices[i].pin, LOW);
    json.set(devices[i].name, "false");
  }
  Serial.printf("Updating initial device states on Firebase... %s\n", Firebase.RTDB.updateNode(&fbdo, "/devices", &json) ? "ok" : fbdo.errorReason().c_str());
}

void updateDeviceState(String key, bool state) {
  for (int i = 0; i < numDevices; i++) {
    if (key == devices[i].name) {
      digitalWrite(devices[i].pin, state ? HIGH : LOW);
      Serial.printf("Set %s to %s\n", key.c_str(), state ? "ON" : "OFF");
      break;
    }
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println();

  for (int i = 0; i < numDevices; i++) {
    pinMode(devices[i].pin, OUTPUT);
  }
  pinMode(PIR_PIN, INPUT);
  pinMode(LDR_PIN, INPUT_PULLUP);

  // --- WiFi Connection with Diagnostics ---
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");

  unsigned long startAttemptTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 20000) { // 20-second timeout
    Serial.print(".");
    delay(500);
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\nFailed to connect to WiFi.");
    // We stop here if WiFi fails to connect
    while(true) { delay(1000); } 
  }

  Serial.println();
  Serial.print("Connected with IP: ");
  Serial.println(WiFi.localIP());
  Serial.println();
  // --- End of WiFi Connection ---

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(4096);

  auth.user.email = "admin@example.com";
  auth.user.password = "password";

  Firebase.begin(&config, &auth);

  String uid;
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Sign up successful");
    uid = Firebase.UID();
    Serial.printf("User UID: %s\n", uid.c_str());
  } else {
    Serial.printf("Sign up failed: %s\n", config.signer.signupError.message.c_str());
    if (config.signer.signupError.code == 400 && config.signer.signupError.message.indexOf("EMAIL_EXISTS") != -1) {
      Serial.println("Attempting to sign in...");
      if (Firebase.signInUser(&config, &auth, "", "")) {
        Serial.println("Sign in successful");
        uid = Firebase.UID();
        Serial.printf("User UID: %s\n", uid.c_str());
      } else {
        Serial.printf("Sign in failed: %s\n", config.signer.signinError.message.c_str());
      }
    }
  }

  if (!Firebase.RTDB.beginStream(&stream, "/devices")) {
    Serial.printf("Can't begin stream, %s\n", stream.errorReason().c_str());
  }
  
  Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback);
  
  initDevices();
}

void loop() {
  unsigned long currentMillis = millis();

  if (Firebase.ready()) {
    if (currentMillis - sendDataPrevMillis > 5000) {
      sendDataPrevMillis = currentMillis;
      
      bool pirState = digitalRead(PIR_PIN);
      bool ldrState = digitalRead(LDR_PIN);
      
      if (pirState && !motion_detected) {
        motion_detected = true;
        pir_timer = currentMillis;
        Serial.println("Motion detected, sending to Firebase...");
        Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_gerak/state", true);
      }
      
      if (motion_detected && currentMillis - pir_timer > 30000) {
        motion_detected = false;
        Serial.println("Motion timeout, resetting on Firebase...");
        Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_gerak/state", false);
      }

      Serial.println("Sending LDR state...");
      Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_cahaya/state", !ldrState);
    }
  } else if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi Disconnected. Reconnecting...");
      WiFi.reconnect();
  }
}
