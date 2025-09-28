/**
 * @file Lalisa_ESP32_Firebase.ino
 * @brief Kontrol rumah pintar menggunakan ESP32 dan Firebase Realtime Database.
 *
 * Kode ini menghubungkan ESP32 ke WiFi, lalu ke Firebase Realtime Database untuk
 * membaca status perintah kontrol (misalnya, menyalakan/mematikan lampu) dan
 * memperbarui status sensor (gerak dan cahaya).
 *
 * Koneksi Hardware:
 * - Relay untuk perangkat elektronik terhubung ke pin yang didefinisikan di `ledPins`.
 * - Sensor gerak (PIR) terhubung ke `PIR_SENSOR_PIN`.
 * - Sensor cahaya (LDR) terhubung ke `LDR_SENSOR_PIN`.
 *
 * Pastikan untuk menginstal pustaka "Firebase ESP32 Client" oleh Mobizt
 * melalui Arduino IDE Library Manager.
 *
 * Ganti placeholder berikut dengan kredensial Anda:
 * - WIFI_SSID: Nama jaringan WiFi Anda.
 * - WIFI_PASSWORD: Kata sandi WiFi Anda.
 * - FIREBASE_API_KEY: API Key dari proyek Firebase Anda.
 * - FIREBASE_DATABASE_URL: URL Realtime Database Anda.
 */

#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// --- GANTI DENGAN KREDENSIAL ANDA ---
#define WIFI_SSID "NAMA_WIFI_ANDA"
#define WIFI_PASSWORD "PASSWORD_WIFI_ANDA"
#define FIREBASE_API_KEY "API_KEY_ANDA"
#define FIREBASE_DATABASE_URL "URL_DATABASE_ANDA" // contoh: https://nama-proyek-anda-default-rtdb.firebaseio.com/
// -------------------------------------

// Definisikan pin untuk setiap perangkat yang terhubung ke relay
const int ledPins[] = {2, 4, 5, 18, 19, 21, 22, 23, 25, 26, 27};
const char* deviceIds[] = {
  "lampu_teras", "lampu_taman", "lampu_ruang_tamu", "lampu_dapur", 
  "lampu_kamar_utama", "lampu_kamar_anak", "lampu_ruang_keluarga", 
  "lampu_ruang_makan", "ac_kamar_utama", "ac_kamar_anak", "pintu_garasi"
};
const int deviceCount = sizeof(ledPins) / sizeof(ledPins[0]);

// Definisikan pin untuk sensor
const int PIR_SENSOR_PIN = 13; // Sensor Gerak
const int LDR_SENSOR_PIN = 12; // Sensor Cahaya

// Variabel untuk Firebase
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
bool firebaseReady = false;

// Variabel untuk sensor
unsigned long pirTriggerTime = 0;
unsigned long ldrTriggerTime = 0;
const long SENSOR_ACTIVE_DURATION = 60000; // 60 detik

void streamCallback(FirebaseStream data) {
  // Callback ini akan dipanggil setiap kali ada perubahan data di Firebase
  Serial.printf("Stream path: %s, event path: %s, data type: %s, value: %s\n",
                data.streamPath().c_str(),
                data.dataPath().c_str(),
                data.dataType().c_str(),
                data.stringData().c_str());

  // Logika untuk mengontrol relay berdasarkan perubahan data
  for (int i = 0; i < deviceCount; ++i) {
    String path = "/devices/" + String(deviceIds[i]) + "/state";
    if (data.dataPath() == path) {
      bool state = data.boolData();
      digitalWrite(ledPins[i], state ? HIGH : LOW);
      Serial.printf("Device %s is now %s\n", deviceIds[i], state ? "ON" : "OFF");
    }
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("Stream timeout, will reconnect...");
  }
}

void setup() {
  Serial.begin(115200);
  
  // Inisialisasi semua pin perangkat sebagai OUTPUT dan set ke LOW (mati)
  for (int i = 0; i < deviceCount; ++i) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }

  // Inisialisasi pin sensor sebagai INPUT
  pinMode(PIR_SENSOR_PIN, INPUT);
  pinMode(LDR_SENSOR_PIN, INPUT);

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
  config.api_key = FIREBASE_API_KEY;
  config.database_url = FIREBASE_DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  if (firebaseReady) {
    // Logika untuk sensor gerak (PIR)
    if (digitalRead(PIR_SENSOR_PIN) == HIGH && pirTriggerTime == 0) {
      Serial.println("PIR Sensor triggered!");
      pirTriggerTime = millis();
      Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_gerak/state", true);
    }
    
    if (pirTriggerTime > 0 && millis() - pirTriggerTime > SENSOR_ACTIVE_DURATION) {
      Serial.println("PIR Sensor timer finished.");
      pirTriggerTime = 0; // Reset timer
      Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_gerak/state", false);
    }

    // Logika untuk sensor cahaya (LDR)
    // Asumsi: LOW berarti gelap, HIGH berarti terang. Ubah jika perlu.
    if (digitalRead(LDR_SENSOR_PIN) == LOW && ldrTriggerTime == 0) {
      Serial.println("LDR Sensor triggered (dark)!");
      ldrTriggerTime = millis();
      Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_cahaya/state", true);
    }

    if (ldrTriggerTime > 0 && millis() - ldrTriggerTime > SENSOR_ACTIVE_DURATION) {
      Serial.println("LDR Sensor timer finished.");
      ldrTriggerTime = 0; // Reset timer
      Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_cahaya/state", false);
    }

  } else {
    Serial.println("Waiting for Firebase connection...");
    delay(2000);
  }
}

void tokenStatusCallback(TokenInfo info) {
  if (info.status == token_status_ready) {
    Serial.println("Firebase token ready.");
    if (!firebaseReady) {
      // Set up streaming hanya sekali saat koneksi pertama berhasil
      if (!Firebase.RTDB.beginStream(&fbdo, "/devices")) {
        Serial.printf("Stream setup failed: %s\n", fbdo.errorReason().c_str());
      } else {
        Firebase.RTDB.setStreamCallback(&fbdo, streamCallback, streamTimeoutCallback);
        Serial.println("Firebase stream started successfully.");
      }
    }
    firebaseReady = true;
  } else {
    Serial.printf("Firebase token status: %s\n", info.error.message.c_str());
    firebaseReady = false;
  }
}
