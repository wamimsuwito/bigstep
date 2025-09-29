// Cek apakah pustaka sudah terinstal. Jika belum, kompilasi akan berhenti dengan pesan error di bawah.
// Untuk mengatasinya: Buka Arduino IDE > Sketch > Include Library > Manage Libraries... > Cari "Firebase ESP32 Client" oleh Mobizt > Install.
#ifndef Firebase_ESP_Client_H
#error "Pustaka Firebase ESP Client belum terinstal. Silakan instal dari Library Manager (Cari 'Firebase ESP32 Client' oleh Mobizt) lalu restart Arduino IDE."
#endif

#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// --- KONFIGURASI PENTING ---
#define WIFI_SSID "i don't know"
#define WIFI_PASSWORD "hutabarat"

// Ganti dengan URL Database dari Firebase Console Anda (Pengaturan Proyek > Service accounts > Database secrets)
#define DATABASE_URL "batchscale-monitor-default-rtdb.asia-southeast1.firebasedatabase.app"

// --- Pinout ESP32 ---
// Sesuaikan nomor pin ini dengan rangkaian fisik Anda
const int ledPins[] = {2, 4, 5, 18, 19, 21, 22, 23, 25, 26, 27};
const char* deviceIds[] = {
  "lampu_teras", "lampu_taman", "lampu_ruang_tamu", "lampu_dapur", 
  "lampu_kamar_utama", "lampu_kamar_anak", "lampu_ruang_keluarga", 
  "lampu_ruang_makan", "ac_kamar_utama", "ac_kamar_anak", "pintu_garasi"
};
const int motionSensorPin = 13;
const int lightSensorPin = 12;

// Variabel global
FirebaseData stream;
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
bool signupOK = false;

// Variabel untuk sensor
volatile bool motionDetected = false;
unsigned long motionStopTime = 0;
bool lightSensorState = false;
unsigned long lightStopTime = 0;

// Fungsi untuk menangani perubahan data dari Firebase (Callback)
void streamCallback(FirebaseStream data) {
  if (data.dataTypeEnum() == fb_esp_data_type_json) {
    FirebaseJson *json = data.to<FirebaseJson>();
    size_t len = json->iteratorBegin();
    FirebaseJson::IteratorValue value;
    for (size_t i = 0; i < len; i++) {
      value = json->valueAt(i);
      for (size_t j = 0; j < (sizeof(deviceIds) / sizeof(deviceIds[0])); j++) {
        if (value.key == deviceIds[j]) {
          Serial.printf("Device: %s, State: %s\n", value.key.c_str(), value.value.c_str());
          digitalWrite(ledPins[j], value.value == "true" ? HIGH : LOW);
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

  // Inisialisasi semua pin perangkat sebagai OUTPUT dan set ke LOW
  for (int pin : ledPins) {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
  }
  // Inisialisasi pin sensor
  pinMode(motionSensorPin, INPUT_PULLUP);
  pinMode(lightSensorPin, INPUT_PULLUP);

  // Koneksi ke WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println();
  Serial.print("Connected with IP: ");
  Serial.println(WiFi.localIP());

  // Konfigurasi Firebase
  config.database_url = DATABASE_URL;
  config.signer.test_mode = true; // Gunakan mode anonim

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Memulai 'listening' ke path /devices di Firebase
  if (!Firebase.RTDB.beginStream(&stream, "/devices")) {
    Serial.printf("------------------------------------\n");
    Serial.printf("Reason: %s\n", stream.errorReason().c_str());
    Serial.printf("------------------------------------\n");
  }
  Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback);

  Serial.println("Setup selesai. Menunggu perintah dari aplikasi...");
}

void loop() {
  // Cek sensor gerak
  if (digitalRead(motionSensorPin) == HIGH && !motionDetected) {
    motionDetected = true;
    motionStopTime = millis() + 60000; // Set timer untuk 60 detik
    digitalWrite(ledPins[0], HIGH); // Contoh: menyalakan lampu teras
    Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_gerak/state", true);
    Serial.println("Gerakan terdeteksi! Relay aktif selama 60 detik.");
  }
  
  // Matikan relay sensor gerak setelah 60 detik
  if (motionDetected && millis() >= motionStopTime) {
    motionDetected = false;
    digitalWrite(ledPins[0], LOW);
    Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_gerak/state", false);
    Serial.println("Relay sensor gerak dimatikan.");
  }

  // Cek sensor cahaya
  bool currentLightState = (digitalRead(lightSensorPin) == HIGH);
  if (currentLightState != lightSensorState) {
    lightSensorState = currentLightState;
    Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_cahaya/state", lightSensorState);
    Serial.printf("Sensor cahaya: %s\n", lightSensorState ? "Terang" : "Gelap");
    if(lightSensorState == false) { // Jika gelap
        lightStopTime = millis() + 60000;
        digitalWrite(ledPins[1], HIGH); // Contoh: nyalakan lampu taman
    }
  }

  // Matikan relay sensor cahaya setelah 60 detik jika kondisi gelap
  if(!lightSensorState && millis() >= lightStopTime) {
      digitalWrite(ledPins[1], LOW);
  }

  delay(100); // Penundaan singkat untuk stabilitas
}
