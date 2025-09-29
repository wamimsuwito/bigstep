/*
  LALISA HOME CONTROL - ESP32 FIRMWARE
  Dibuat untuk integrasi dengan Firebase Realtime Database
  Oleh: Gemini
*/

// --- PUSTAKA (LIBRARY) ---
// Pastikan Anda sudah menginstal pustaka "Firebase ESP32 Client" oleh Mobizt
// melalui Library Manager di Arduino IDE.
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// --- KONFIGURASI WIFI ---
#define WIFI_SSID "i don't know"
#define WIFI_PASSWORD "hutabarat"

// --- KONFIGURASI FIREBASE ---
// Ganti dengan API Key dan URL Realtime Database Anda dari Firebase Console
#define API_KEY "AIzaSyDQHD5hWDvY_Jp7kTsvOJ4Yei_fRYVgA3Y"
#define DATABASE_URL "https://batchscale-monitor-default-rtdb.asia-southeast1.firebasedatabase.app"

// --- DEFINISI PIN PERANGKAT (RELAY) ---
const int ledPins[] = {2, 4, 5, 18, 19, 21, 22, 23, 25, 26, 27};
const String deviceIds[] = {
  "lampu_teras", "lampu_taman", "lampu_ruang_tamu", "lampu_dapur", 
  "lampu_kamar_utama", "lampu_kamar_anak", "lampu_ruang_keluarga", 
  "lampu_ruang_makan", "ac_kamar_utama", "ac_kamar_anak", "pintu_garasi"
};
const int deviceCount = sizeof(ledPins) / sizeof(ledPins[0]);

// --- DEFINISI PIN SENSOR ---
const int motionSensorPin = 13;
const int lightSensorPin = 12;

// Variabel untuk sensor timeout
unsigned long motionTriggerTime = 0;
unsigned long lightTriggerTime = 0;
const long sensorActiveDuration = 60000; // 60 detik dalam milidetik

// --- OBJEK FIREBASE ---
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// --- DEKLARASI FUNGSI ---
void streamCallback(FirebaseStream data);
void streamTimeoutCallback(bool timeout);
void setupWifi();

// --- FUNGSI SETUP (Berjalan sekali saat ESP32 menyala) ---
void setup() {
  Serial.begin(115200);
  
  // Inisialisasi semua pin perangkat sebagai OUTPUT dan set ke LOW (mati)
  for (int i = 0; i < deviceCount; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }

  // Inisialisasi pin sensor sebagai INPUT
  pinMode(motionSensorPin, INPUT);
  pinMode(lightSensorPin, INPUT);

  // Hubungkan ke WiFi
  setupWifi();

  // Konfigurasi Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  // Callback untuk data stream dari Firebase
  Firebase.RTDB.setStreamCallback(&fbdo, streamCallback, streamTimeoutCallback);
  
  // Otentikasi ke Firebase secara anonim
  Firebase.begin(&config, &auth);
  Firebase.signUp(&config, &auth, "", ""); // Masuk sebagai pengguna anonim

  // Mulai mendengarkan perubahan pada path '/devices'
  if (!Firebase.RTDB.beginStream(&fbdo, "/devices")) {
    Serial.println("------------------------------------");
    Serial.println("Gagal memulai stream... Alasan: " + fbdo.errorReason());
    Serial.println("------------------------------------");
  } else {
    Serial.println("Stream Firebase berhasil dimulai untuk /devices");
  }
}

// --- FUNGSI LOOP (Berjalan terus-menerus) ---
void loop() {
  // Logika untuk sensor gerak
  if (digitalRead(motionSensorPin) == HIGH && motionTriggerTime == 0) {
    Serial.println("Gerakan terdeteksi!");
    motionTriggerTime = millis();
    Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_gerak/state", true);
  }
  // Matikan sensor setelah 60 detik
  if (motionTriggerTime > 0 && millis() - motionTriggerTime > sensorActiveDuration) {
    Serial.println("Sensor gerak kembali non-aktif.");
    motionTriggerTime = 0;
    Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_gerak/state", false);
  }

  // Logika untuk sensor cahaya (asumsi: HIGH = terang, LOW = gelap)
  if (digitalRead(lightSensorPin) == HIGH && lightTriggerTime == 0) {
    Serial.println("Cahaya terang terdeteksi!");
    lightTriggerTime = millis();
    Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_cahaya/state", true);
  }
  // Matikan sensor setelah 60 detik
  if (lightTriggerTime > 0 && millis() - lightTriggerTime > sensorActiveDuration) {
    Serial.println("Sensor cahaya kembali non-aktif.");
    lightTriggerTime = 0;
    Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_cahaya/state", false);
  }
  
  delay(100); // Jeda singkat untuk stabilitas
}

// --- KONEKSI WIFI ---
void setupWifi() {
  delay(10);
  Serial.println();
  Serial.print("Menghubungkan ke WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi terhubung!");
  Serial.print("Alamat IP: ");
  Serial.println(WiFi.localIP());
}

// --- FUNGSI CALLBACK FIREBASE ---

// Fungsi ini akan dipanggil setiap kali ada perubahan data di path '/devices'
void streamCallback(FirebaseStream data) {
  Serial.printf("Stream data diterima: %s, %s, %s, %s\n", data.streamPath().c_str(), data.dataPath().c_str(), data.eventType().c_str(), data.dataType().c_str());

  if (data.dataTypeEnum() == fb_esp_rtdb_data_type_json) {
    FirebaseJson *json = data.to<FirebaseJson *>();
    String jsonStr;
    json->toString(jsonStr, true);
    Serial.println(jsonStr);

    size_t len = json->iteratorBegin();
    FirebaseJson::IteratorValue value;
    for (size_t i = 0; i < len; i++) {
        value = json->iteratorGet(i);
        if (value.type == "object" && value.key.length() > 0) {
            String deviceId = value.key;
            FirebaseJsonData result;
            json->get(result, deviceId + "/state");
            
            if (result.success && (result.type == "boolean" || result.type == "bool")) {
                bool state = result.to<bool>();
                Serial.printf("Perangkat: %s, Status: %s\n", deviceId.c_str(), state ? "NYALA" : "MATI");

                // Temukan pin yang sesuai dan ubah status relay
                for (int j = 0; j < deviceCount; j++) {
                    if (deviceIds[j] == deviceId) {
                        digitalWrite(ledPins[j], state ? HIGH : LOW);
                        break;
                    }
                }
            }
        }
    }
    json->iteratorEnd();
    json->clear();
  } else if (data.dataTypeEnum() == fb_esp_rtdb_data_type_boolean) {
    // Jika hanya satu nilai yang berubah
    String path = data.dataPath();
    path.remove(0, 1); // Hapus '/' di awal
    String deviceId = path.substring(0, path.indexOf('/'));
    bool state = data.to<bool>();

    Serial.printf("Perangkat: %s, Status: %s\n", deviceId.c_str(), state ? "NYALA" : "MATI");

    // Temukan pin yang sesuai dan ubah status relay
    for (int j = 0; j < deviceCount; j++) {
        if (deviceIds[j] == deviceId) {
            digitalWrite(ledPins[j], state ? HIGH : LOW);
            break;
        }
    }
  }
}

// Fungsi ini dipanggil jika stream timeout
void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("Stream timeout, memulai ulang stream...");
    if (!Firebase.RTDB.beginStream(&fbdo, "/devices")) {
        Serial.println("Gagal memulai ulang stream... Alasan: " + fbdo.errorReason());
    }
  }
}
