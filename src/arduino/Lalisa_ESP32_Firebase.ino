/**
 * @file Lalisa_ESP32_Firebase.ino
 * @brief Kontrol Perangkat Rumah dan Sensor via Firebase Realtime Database.
 * 
 * Kode ini dirancang untuk ESP32 guna mengontrol serangkaian relay (lampu, AC, pintu)
 * dan memonitor sensor (gerak, cahaya). ESP32 terhubung ke WiFi dan Firebase
 * Realtime Database untuk menerima perintah dari aplikasi web dan mengirim
 * pembaruan status sensor.
 * 
 * @version 1.1
 * @date 2024-09-28
 * 
 * @note Pastikan semua library yang dibutuhkan (Firebase ESP32 Client, dll.) sudah
 * terpasang di Arduino IDE Anda. Ganti placeholder untuk WiFi dan Firebase
 * dengan kredensial Anda.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// -- KONFIGURASI PENGGUNA --
#define WIFI_SSID "NAMA_WIFI_ANDA"
#define WIFI_PASSWORD "PASSWORD_WIFI_ANDA"
#define DATABASE_URL "URL_REALTIME_DATABASE_ANDA" // Contoh: https://nama-projek-anda-default-rtdb.firebaseio.com/

// -- Objek Firebase --
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
bool firebaseReady = false;

// -- Definisi Pin untuk Perangkat --
const int ledPins[] = {2, 4, 5, 18, 19, 21, 22, 23, 25, 26, 27};
const char* deviceIds[] = {
  "lampu_teras", "lampu_taman", "lampu_ruang_tamu", "lampu_dapur", 
  "lampu_kamar_utama", "lampu_kamar_anak", "lampu_ruang_keluarga", 
  "lampu_ruang_makan", "ac_kamar_utama", "ac_kamar_anak", "pintu_garasi"
};
const int numDevices = sizeof(ledPins) / sizeof(ledPins[0]);

// -- Definisi Pin untuk Sensor --
struct Sensor {
  const char* id;
  int pin;
  bool state;
  unsigned long lastTriggered;
};

Sensor sensors[] = {
  {"sensor_gerak", 13, false, 0},
  {"sensor_cahaya", 12, false, 0}
};
const int numSensors = sizeof(sensors) / sizeof(sensors[0]);
const unsigned long SENSOR_ON_DURATION = 60000; // 60 detik

void setup() {
  Serial.begin(115200);
  
  // Inisialisasi pin perangkat sebagai output dan set ke LOW (mati)
  for (int i = 0; i < numDevices; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }

  // Inisialisasi pin sensor sebagai input
  for (int i = 0; i < numSensors; i++) {
    pinMode(sensors[i].pin, INPUT_PULLUP); // Menggunakan pull-up internal
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

  // Inisialisasi Firebase
  config.database_url = DATABASE_URL;
  config.signer.test_mode = true; // Gunakan mode tes untuk awal
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  
  firebaseReady = true; // Tandai Firebase siap
  Serial.println("Firebase Initialized.");

  // Set nilai awal 'state' ke false untuk semua perangkat di Firebase
  for (int i = 0; i < numDevices; i++) {
    String path = "devices/";
    path += deviceIds[i];
    if (Firebase.RTDB.setBool(&fbdo, path + "/state", false)) {
      Serial.println("Initial state set for: " + String(deviceIds[i]));
    } else {
      Serial.println("Failed to set initial state for: " + String(deviceIds[i]));
    }
  }

  // Set nilai awal 'state' ke false untuk semua sensor di Firebase
  for (int i = 0; i < numSensors; i++) {
    String path = "sensors/";
    path += sensors[i].id;
    if (Firebase.RTDB.setBool(&fbdo, path + "/state", false)) {
      Serial.println("Initial state set for: " + String(sensors[i].id));
    }
  }
}

void loop() {
  if (!firebaseReady) {
    return;
  }

  // 1. Membaca Perintah dari Firebase untuk Perangkat
  for (int i = 0; i < numDevices; i++) {
    String path = "devices/";
    path += deviceIds[i];
    path += "/state";
    
    if (Firebase.RTDB.getBool(&fbdo, path)) {
      if (fbdo.dataType() == "boolean") {
        bool state = fbdo.boolData();
        digitalWrite(ledPins[i], state ? HIGH : LOW);
      }
    }
  }

  // 2. Membaca status sensor dan mengirim update ke Firebase
  unsigned long currentMillis = millis();
  for (int i = 0; i < numSensors; i++) {
    // Sensor PIR (gerak) dan LDR (cahaya) dengan pull-up biasanya LOW saat aktif
    bool isSensorActive = (digitalRead(sensors[i].pin) == LOW);

    // Jika sensor aktif dan sebelumnya tidak aktif
    if (isSensorActive && !sensors[i].state) {
      sensors[i].state = true;
      sensors[i].lastTriggered = currentMillis;

      String path = "sensors/";
      path += sensors[i].id;
      Firebase.RTDB.setBool(&fbdo, path + "/state", true); // Update Firebase ke true
      Serial.println(String(sensors[i].id) + " triggered!");
    }

    // Jika sensor aktif dan sudah lebih dari 60 detik
    if (sensors[i].state && (currentMillis - sensors[i].lastTriggered > SENSOR_ON_DURATION)) {
      sensors[i].state = false;
      
      String path = "sensors/";
      path += sensors[i].id;
      Firebase.RTDB.setBool(&fbdo, path + "/state", false); // Update Firebase ke false
      Serial.println(String(sensors[i].id) + " reset.");
    }
  }

  delay(200); // Penundaan singkat untuk menghindari spamming request
}
