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
#define USER_EMAIL "user@example.com" // Bisa diisi email apa saja untuk legacy auth
#define USER_PASSWORD "password"     // Bisa diisi password apa saja untuk legacy auth

// Definisikan Objek Firebase
FirebaseData stream;
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// State untuk melacak koneksi stream
bool stream_active = false;

// Definisikan Pin untuk Perangkat dan Sensor
struct Device {
  const char* id;
  int pin;
};

struct Sensor {
  const char* id;
  int pin;
  bool lastState;
  unsigned long triggerTime;
};

// Daftar perangkat yang dikontrol oleh relay
Device ledPins[] = {
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

// Daftar sensor
Sensor sensors[] = {
  {"sensor_gerak", 13, false, 0},
  {"sensor_cahaya", 12, false, 0}
};

// Callback function untuk menangani data stream
void streamCallback(FirebaseStream data) {
  if (data.dataType() == "json") {
    FirebaseJson *json = data.to<FirebaseJson *>();
    size_t len = json->iteratorBegin();
    FirebaseJson::IteratorValue value;

    for (size_t i = 0; i < len; i++) {
      int type = 0;
      String key, val;
      json->iteratorGet(i, type, key, val);
      
      // Hapus tanda kutip dari nilai string
      val.remove(0, 1);
      val.remove(val.length() - 1);
      
      bool state = (val == "true");

      for (const auto& device : ledPins) {
        if (key == device.id) {
          digitalWrite(device.pin, state ? HIGH : LOW);
          Serial.printf("Mengatur %s ke %s\n", device.id, state ? "NYALA" : "MATI");
          break;
        }
      }
    }
    json->iteratorEnd();
    delete json;
  }
}

// Callback function untuk menangani timeout stream
void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("Stream timeout, memulai ulang stream...");
    stream_active = false;
  }
}

void setup() {
  Serial.begin(115200);

  // Inisialisasi pin relay sebagai output
  for (const auto& device : ledPins) {
    pinMode(device.pin, OUTPUT);
    digitalWrite(device.pin, LOW); // Pastikan semua mati saat startup
  }

  // Inisialisasi pin sensor sebagai input
  for (const auto& sensor : sensors) {
    pinMode(sensor.pin, INPUT);
  }

  // Koneksi ke WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Menghubungkan ke WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println();
  Serial.print("Terhubung dengan IP: ");
  Serial.println(WiFi.localIP());
  Serial.println();

  // Konfigurasi Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Mulai stream data dari path "/devices"
  if (!Firebase.RTDB.beginStream(&stream, "/devices")) {
    Serial.println("Gagal memulai stream: " + stream.errorReason());
  } else {
    Serial.println("Stream berhasil dimulai.");
    Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback);
    stream_active = true;
  }
}

void loop() {
  // Cek dan proses data sensor
  for (auto& sensor : sensors) {
    bool currentState = digitalRead(sensor.pin);
    if (currentState != sensor.lastState) {
      sensor.lastState = currentState;
      if (currentState) { // Jika sensor terpicu (HIGH)
        sensor.triggerTime = millis();
        Serial.printf("Sensor %s terpicu!\n", sensor.id);
        
        // Kirim status ke Firebase
        if (Firebase.RTDB.setBool(&fbdo, String("sensors/") + sensor.id + "/state", true)) {
          Serial.printf("Status sensor %s dikirim ke Firebase: true\n", sensor.id);
        } else {
          Serial.printf("Gagal mengirim status sensor %s: %s\n", sensor.id, fbdo.errorReason().c_str());
        }
      }
    }

    // Logika timer untuk mematikan sensor gerak setelah 60 detik
    if (strcmp(sensor.id, "sensor_gerak") == 0 && sensor.lastState && (millis() - sensor.triggerTime > 60000)) {
        sensor.lastState = false; // Reset state secara logis
        sensor.triggerTime = 0; // Reset timer
        Serial.println("Sensor gerak kembali ke status aman (timer).");
        
        // Kirim status false ke Firebase
        if (Firebase.RTDB.setBool(&fbdo, String("sensors/") + sensor.id + "/state", false)) {
            Serial.println("Status sensor gerak dikirim ke Firebase: false");
        } else {
            Serial.printf("Gagal mengirim status sensor gerak: %s\n", fbdo.errorReason().c_str());
        }
    }
  }

  // Cek apakah stream perlu dimulai ulang
  if (!stream_active) {
    Serial.println("Mencoba memulai ulang stream...");
    if (Firebase.RTDB.beginStream(&stream, "/devices")) {
      Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback);
      stream_active = true;
      Serial.println("Stream berhasil dimulai ulang.");
    } else {
      Serial.println("Gagal memulai ulang stream: " + stream.errorReason());
      delay(2000); // Tunggu sebelum mencoba lagi
    }
  }

  delay(100); // Delay kecil untuk stabilitas
}
