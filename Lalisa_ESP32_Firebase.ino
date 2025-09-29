/*
  Project: Home Control App for "Lalisa"
  Description: Connects ESP32 to Firebase Realtime Database to control home appliances and monitor sensors.
  Author: Gemini
  Date: 28 September 2025
*/

#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// --- KREDENSIAL PENGGUNA --- (Ganti dengan data Anda)
#define WIFI_SSID "i don't know"
#define WIFI_PASSWORD "hutabarat"
#define API_KEY "AIzaSyDQHD5hWDvY_Jp7kTsvOJ4Yei_fRYVgA3Y"
#define DATABASE_URL "https://batchscale-monitor-default-rtdb.asia-southeast1.firebasedatabase.app"

// --- KONFIGURASI PIN ---
// Definisikan pin untuk setiap perangkat (sesuai dengan rangkaian relay)
const int ledPins[] = {2, 4, 5, 18, 19, 21, 22, 23, 25, 26, 27};
const char* deviceIds[] = {
  "lampu_teras", "lampu_taman", "lampu_ruang_tamu", "lampu_dapur", 
  "lampu_kamar_utama", "lampu_kamar_anak", "lampu_ruang_keluarga", 
  "lampu_ruang_makan", "ac_kamar_utama", "ac_kamar_anak", "pintu_garasi"
};

// Definisikan pin untuk sensor
const int MOTION_SENSOR_PIN = 13;
const int LIGHT_SENSOR_PIN = 12;

// --- OBJEK FIREBASE ---
FirebaseData stream;
FirebaseAuth auth;
FirebaseConfig config;

// --- FUNGSI CALLBACK ---
// Fungsi ini akan dipanggil setiap kali ada perubahan data di path '/devices'
void streamCallback(FirebaseStream data) {
  Serial.printf("Stream data available for path: %s, event type: %s\n", data.streamPath().c_str(), data.eventType().c_str());
  
  if (data.dataTypeEnum() == fb_esp_data_type::d_json) {
    FirebaseJson *json = data.to<FirebaseJson *>();
    size_t len = json->iteratorBegin();
    String key, value_str;
    int type;

    for (size_t i = 0; i < len; i++) {
      json->iteratorGet(i, type, key, value_str); // Ini adalah cara yang benar
      
      bool state = (value_str == "true");
      Serial.printf("Path: %s, Key: %s, Value: %s, State: %s\n", data.dataPath().c_str(), key.c_str(), value_str.c_str(), state ? "ON" : "OFF");

      // Temukan pin yang sesuai dengan deviceId (key)
      for (int j = 0; j < sizeof(deviceIds) / sizeof(deviceIds[0]); j++) {
        if (key == deviceIds[j]) {
          digitalWrite(ledPins[j], state ? HIGH : LOW);
          Serial.printf("  > Toggling pin %d to %s\n", ledPins[j], state ? "HIGH" : "LOW");
          break;
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

// --- FUNGSI SETUP ---
void setup() {
  Serial.begin(115200);

  // Inisialisasi semua pin perangkat sebagai OUTPUT
  for (int pin : ledPins) {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
  }
  // Inisialisasi pin sensor sebagai INPUT
  pinMode(MOTION_SENSOR_PIN, INPUT_PULLUP);
  pinMode(LIGHT_SENSOR_PIN, INPUT);

  // Koneksi ke WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  Serial.println();
  Serial.print("Connected, IP address: ");
  Serial.println(WiFi.localIP());

  // Konfigurasi Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.signer.test_mode = true; // Gunakan ini untuk testing, ganti jika perlu

  Firebase.reconnectWiFi(true);
  Firebase.begin(&config, &auth);

  // Mulai mendengarkan perubahan pada path '/devices'
  if (!Firebase.RTDB.beginStream(&stream, "/devices")) {
    Serial.printf("------------------------------------\n");
    Serial.printf("Could not begin stream\n");
    Serial.printf("REASON: %s\n", stream.errorReason().c_str());
    Serial.printf("------------------------------------\n");
  }

  Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback);
}

// --- FUNGSI LOOP ---
unsigned long motion_last_triggered = 0;
unsigned long light_last_triggered = 0;
const long sensor_active_duration = 60000; // 60 detik

void loop() {
  // --- Logika Sensor Gerak ---
  if (digitalRead(MOTION_SENSOR_PIN) == HIGH && millis() - motion_last_triggered > sensor_active_duration) {
    Serial.println("Motion Detected!");
    Firebase.RTDB.setBool(&stream, "/sensors/sensor_gerak/state", true);
    // Logika tambahan jika ingin menyalakan sesuatu
    motion_last_triggered = millis();
  }
  
  if (motion_last_triggered > 0 && millis() - motion_last_triggered >= sensor_active_duration) {
    Serial.println("Motion sensor timeout. Turning off.");
    Firebase.RTDB.setBool(&stream, "/sensors/sensor_gerak/state", false);
    motion_last_triggered = 0; // Reset timer
  }

  // --- Logika Sensor Cahaya ---
  // Anggap nilai < 1000 adalah "Gelap" (sesuaikan threshold ini)
  int lightValue = analogRead(LIGHT_SENSOR_PIN); 
  bool isDark = lightValue < 1000;

  if (isDark && millis() - light_last_triggered > sensor_active_duration) {
    Serial.printf("Light Sensor is DARK (Value: %d)! Triggering...\n", lightValue);
    Firebase.RTDB.setBool(&stream, "/sensors/sensor_cahaya/state", true); // true = gelap
    light_last_triggered = millis();
  }

  if (light_last_triggered > 0 && millis() - light_last_triggered >= sensor_active_duration) {
     Serial.println("Light sensor timeout. Resetting state.");
     Firebase.RTDB.setBool(&stream, "/sensors/sensor_cahaya/state", false); // false = terang/reset
     light_last_triggered = 0;
  }

  delay(100); // Penundaan kecil untuk stabilitas
}
