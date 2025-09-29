/**
 * Kontrol Rumah Pintar "Lalisa" dengan Firebase & ESP32
 * 
 * Dibuat untuk: Project Aplikasi PT. Farika Riau Perkasa
 * Deskripsi:
 * - Menghubungkan ESP32 ke WiFi dan Firebase Realtime Database.
 * - Mengontrol beberapa perangkat (lampu, AC, pintu) melalui relay berdasarkan data dari Firebase.
 * - Membaca data dari sensor gerak dan cahaya, lalu mengirimkan statusnya ke Firebase.
 * - Jika sensor aktif, pin relay yang sesuai akan menyala selama 60 detik.
 * 
 * Pastikan Anda sudah menginstal pustaka berikut di Arduino IDE:
 * 1. WiFi.h (bawaan ESP32)
 * 2. Firebase ESP32 Client by Mobizt (dari Library Manager)
 * 
 * Konfigurasi Pin:
 * Perangkat (Output):
 * - Lampu Teras: GPIO 2
 * - Lampu Taman: GPIO 4
 * - Lampu Ruang Tamu: GPIO 5
 * - Lampu Dapur: GPIO 18
 * - Lampu Kamar Utama: GPIO 19
 * - Lampu Kamar Anak: GPIO 21
 * - Lampu Ruang Keluarga: GPIO 22
 * - Lampu Ruang Makan: GPIO 23
 * - AC Kamar Utama: GPIO 25
 * - AC Kamar Anak: GPIO 26
 * - Pintu Garasi: GPIO 27
 * 
 * Sensor (Input):
 * - Sensor Gerak: GPIO 13
 * - Sensor Cahaya: GPIO 12
 */

#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// --- Konfigurasi WiFi ---
#define WIFI_SSID "i don't know"
#define WIFI_PASSWORD "hutabarat"

// --- Konfigurasi Firebase ---
#define API_KEY "AIzaSyDQHD5hWDvY_Jp7kTsvOJ4Yei_fRYVgA3Y"
#define DATABASE_URL "https://batchscale-monitor-default-rtdb.asia-southeast1.firebasedatabase.app"

// Objek Firebase
FirebaseData stream;
FirebaseAuth auth;
FirebaseConfig config;

// --- Definisi Pin ---
const int ledPins[] = {2, 4, 5, 18, 19, 21, 22, 23, 25, 26, 27};
const char* deviceIds[] = {"lampu_teras", "lampu_taman", "lampu_ruang_tamu", "lampu_dapur", "lampu_kamar_utama", "lampu_kamar_anak", "lampu_ruang_keluarga", "lampu_ruang_makan", "ac_kamar_utama", "ac_kamar_anak", "pintu_garasi"};
const int numDevices = sizeof(ledPins) / sizeof(ledPins[0]);

const int motionSensorPin = 13;
const int lightSensorPin = 12;

unsigned long motionTriggerTime = 0;
unsigned long lightTriggerTime = 0;
const unsigned long SENSOR_ACTIVE_DURATION = 60000; // 60 detik

// Callback saat data stream diterima dari Firebase
void streamCallback(FirebaseStream data) {
  Serial.printf("Stream path: %s, event path: %s, data type: %s, event type: %s\n",
                data.streamPath().c_str(),
                data.dataPath().c_str(),
                data.dataType().c_str(),
                data.eventType().c_str());

  if (data.dataType() == "json") {
    FirebaseJson *json = data.to<FirebaseJson *>();
    size_t len = json->iteratorBegin();
    String key, value;
    int type;

    for (size_t i = 0; i < len; i++) {
      json->iteratorGet(i, type, key, value);

      // Cetak data yang diterima untuk debugging
      Serial.printf("Key: %s, Value: %s, Type: %d\n", key.c_str(), value.c_str(), type);

      // Cari perangkat yang cocok dengan key dari Firebase
      for (int j = 0; j < numDevices; j++) {
        if (key == deviceIds[j]) {
          bool state = (value == "true");
          Serial.printf("Mengatur %s ke %s\n", deviceIds[j], state ? "NYALA" : "MATI");
          digitalWrite(ledPins[j], state ? HIGH : LOW);
          break;
        }
      }
    }
    json->iteratorEnd();
    delete json;
  }
}


// Callback saat stream timeout
void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("Stream timeout, akan mencoba menghubungkan kembali...");
  }
}

void setup() {
  Serial.begin(115200);

  // Inisialisasi semua pin perangkat sebagai OUTPUT
  for (int i = 0; i < numDevices; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW); // Matikan semua saat startup
  }

  // Inisialisasi pin sensor sebagai INPUT
  pinMode(motionSensorPin, INPUT_PULLUP);
  pinMode(lightSensorPin, INPUT_PULLUP);

  // Koneksi ke WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Menghubungkan ke WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println();
  Serial.print("Terhubung! Alamat IP: ");
  Serial.println(WiFi.localIP());

  // Konfigurasi Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  
  // Karena kita menggunakan database yang terbuka, kita bisa sign up secara anonim
  auth.user.email = "";
  auth.user.password = "";

  Firebase.reconnectWiFi(true);

  // Mulai stream data dari path "devices"
  if (!Firebase.beginStream(stream, "/devices")) {
    Serial.println("Gagal memulai stream: " + stream.errorReason());
  }

  Firebase.setStreamCallback(stream, streamCallback, streamTimeoutCallback);
  
  Serial.println("Setup selesai. Menunggu data dari Firebase...");
}

void loop() {
  unsigned long currentTime = millis();

  // Logika untuk Sensor Gerak
  bool motionDetected = digitalRead(motionSensorPin) == HIGH;
  if (motionDetected) {
    if (motionTriggerTime == 0) { // Hanya trigger saat pertama kali terdeteksi
      Serial.println("Sensor Gerak Aktif! Mengirim status ke Firebase.");
      Firebase.RTDB.setBool(&stream, "/sensors/sensor_gerak/state", true);
      Firebase.RTDB.setString(&stream, "/sensors/sensor_gerak/last_triggered", String(currentTime));
      motionTriggerTime = currentTime;
    }
  }

  if (motionTriggerTime != 0 && currentTime - motionTriggerTime > SENSOR_ACTIVE_DURATION) {
    Serial.println("Sensor Gerak non-aktif setelah 60 detik.");
    Firebase.RTDB.setBool(&stream, "/sensors/sensor_gerak/state", false);
    motionTriggerTime = 0;
  }

  // Logika untuk Sensor Cahaya (Asumsi HIGH = Terang, LOW = Gelap)
  bool isLight = digitalRead(lightSensorPin) == HIGH;
  // Cek apakah status berubah sebelum mengirim update
  static bool lastLightState = !isLight;
  if (isLight != lastLightState) {
    Serial.printf("Sensor Cahaya berubah: %s. Mengirim status ke Firebase.\n", isLight ? "Terang" : "Gelap");
    Firebase.RTDB.setBool(&stream, "/sensors/sensor_cahaya/state", isLight);
    lastLightState = isLight;
  }


  // Cek koneksi stream secara berkala
  if (!stream.httpConnected()) {
    Serial.println("Stream terputus! Error: " + stream.errorReason());
    Serial.println("Mencoba memulai ulang stream...");
    if (!Firebase.beginStream(stream, "/devices")) {
      Serial.println("Gagal memulai ulang stream: " + stream.errorReason());
    }
  }

  delay(100); // Delay singkat untuk stabilitas
}
