// Nama File: Lalisa_ESP32_Firebase.ino
// Deskripsi: Kode untuk ESP32 guna mengontrol perangkat rumah (lampu, AC, dll.)
// dan membaca sensor, terintegrasi dengan Firebase Realtime Database.

// --- Instalasi Pustaka ---
// 1. Buka Arduino IDE
// 2. Pergi ke Sketch > Include Library > Manage Libraries...
// 3. Cari dan instal "Firebase ESP32 Client" oleh Mobizt.
// 4. Pastikan Anda juga memiliki pustaka "ArduinoJson" terinstal.

#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// --- Konfigurasi WiFi Anda ---
#define WIFI_SSID "NAMA_WIFI_ANDA"
#define WIFI_PASSWORD "PASSWORD_WIFI_ANDA"

// --- Konfigurasi Firebase ---
// 1. Ganti dengan API Key dari Project Settings > General di Firebase Console
#define API_KEY "API_KEY_ANDA"
// 2. Ganti dengan URL Realtime Database Anda (tanpa https:// dan tanpa slash di akhir)
#define DATABASE_URL "NAMA_PROYEK_ANDA.firebaseio.com"

// Objek Firebase
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Status koneksi
bool firebaseConnected = false;

// --- Definisi Pin Hardware ---
struct Device {
  const char* id;
  uint8_t pin;
  bool state;
};

struct Sensor {
  const char* id;
  uint8_t pin;
  bool state;
  unsigned long lastTriggerTime;
};

// Definisikan semua perangkat yang terhubung ke relay
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
const int numDevices = sizeof(devices) / sizeof(devices[0]);

// Definisikan semua sensor
Sensor sensors[] = {
  {"sensor_gerak", 13, false, 0},
  {"sensor_cahaya", 12, false, 0}
};
const int numSensors = sizeof(sensors) / sizeof(sensors[0]);

const int SENSOR_ACTIVE_DURATION = 60000; // 60 detik

// --- Fungsi Callback untuk Stream Data ---
void streamCallback(FirebaseStream data) {
  if (data.dataType() == "json") {
    FirebaseJson &json = data.to<FirebaseJson>();
    String path = data.dataPath();
    
    // Proses hanya jika ada data di dalam path
    if (path != "/") {
      size_t count = json.iteratorBegin();
      FirebaseJson::IteratorValue value;
      for (size_t i = 0; i < count; i++) {
        value = json.valueAt(i);
        String key = value.key;

        for (int j = 0; j < numDevices; j++) {
          if (key == devices[j].id) {
            bool newState = value.value == "true";
            if (devices[j].state != newState) {
              devices[j].state = newState;
              digitalWrite(devices[j].pin, devices[j].state ? HIGH : LOW);
              Serial.printf("Device '%s' turned %s\n", devices[j].id, devices[j].state ? "ON" : "OFF");
            }
            break;
          }
        }
      }
      json.iteratorEnd();
    }
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("Stream timeout, resuming...");
  }
}

// --- Fungsi Setup ---
void setup() {
  Serial.begin(115200);

  // Inisialisasi pin perangkat sebagai OUTPUT dan matikan semua
  for (int i = 0; i < numDevices; i++) {
    pinMode(devices[i].pin, OUTPUT);
    digitalWrite(devices[i].pin, LOW); // Pastikan semua mati saat start
  }

  // Inisialisasi pin sensor sebagai INPUT
  for (int i = 0; i < numSensors; i++) {
    pinMode(sensors[i].pin, INPUT_PULLUP); // Menggunakan PULLUP jika sensor adalah saklar ke GND
  }

  // Koneksi ke WiFi
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

  // Konfigurasi Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.signer.test_mode = true; // Gunakan mode tes untuk otentikasi anonim

  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(4096);

  Firebase.begin(&config, &auth);

  // Mulai stream untuk mendengarkan perubahan pada path "/devices"
  if (!Firebase.beginStream(fbdo, "/devices")) {
    Serial.println("------------------------------------");
    Serial.println("Can't begin stream path... Reason: " + fbdo.errorReason());
    Serial.println("------------------------------------");
    Serial.println();
  }
  
  Firebase.setStreamCallback(fbdo, streamCallback, streamTimeoutCallback);
  Serial.println("Firebase stream started.");
}

// --- Fungsi Loop Utama ---
void loop() {
  unsigned long currentMillis = millis();

  // Cek koneksi dan sinkronisasi awal
  if (Firebase.ready() && !firebaseConnected) {
    firebaseConnected = true;
    Serial.println("Firebase is connected.");
    // Sinkronisasi status awal dari Firebase saat pertama kali terhubung
    if (Firebase.getJSON(fbdo, "/devices")) {
      if (fbdo.dataType() == "json") {
        FirebaseJson &json = fbdo.to<FirebaseJson>();
        size_t count = json.iteratorBegin();
        FirebaseJson::IteratorValue value;
        for (size_t i = 0; i < count; i++) {
            value = json.valueAt(i);
            String key = value.key;
            for (int j = 0; j < numDevices; j++) {
              if (key == devices[j].id) {
                devices[j].state = (value.value == "true");
                digitalWrite(devices[j].pin, devices[j].state ? HIGH : LOW);
              }
            }
        }
        json.iteratorEnd();
        Serial.println("Initial device states synchronized.");
      }
    }
  }
  
  // Logika untuk membaca sensor
  for (int i = 0; i < numSensors; i++) {
    // Asumsi sensor HIGH saat tidak aktif dan LOW saat aktif (karena PULLUP)
    bool currentState = digitalRead(sensors[i].pin) == LOW; 
    
    if (currentState && !sensors[i].state) {
      // Sensor baru saja terdeteksi
      sensors[i].state = true;
      sensors[i].lastTriggerTime = currentMillis;
      Serial.printf("Sensor '%s' triggered!\n", sensors[i].id);
      
      // Update status ke Firebase
      if (Firebase.ready()) {
        Firebase.setBool(fbdo, String("/sensors/") + sensors[i].id + "/state", true);
      }
    }
    
    // Cek untuk mematikan pin setelah durasi tertentu
    if (sensors[i].state && (currentMillis - sensors[i].lastTriggerTime > SENSOR_ACTIVE_DURATION)) {
      sensors[i].state = false;
      Serial.printf("Sensor '%s' duration ended. Resetting.\n", sensors[i].id);

      // Update status ke Firebase
      if (Firebase.ready()) {
        Firebase.setBool(fbdo, String("/sensors/") + sensors[i].id + "/state", false);
      }
    }
  }

  delay(100); // Penundaan kecil untuk stabilitas
}
