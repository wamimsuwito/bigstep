/**
 * @file Lalisa_ESP32_Firebase.ino
 * @author Google Gemini
 * @brief Kontrol perangkat rumah pintar dan monitor sensor menggunakan ESP32 dan Firebase Realtime Database.
 * 
 * Hardware:
 *  - ESP32 Development Board
 *  - Relay Module (untuk setiap perangkat)
 *  - Sensor Gerak (PIR)
 *  - Sensor Cahaya (LDR)
 *
 * Koneksi Pin (Contoh):
 *  - Lampu Teras: GPIO 2
 *  - Lampu Taman: GPIO 4
 *  - Lampu Ruang Tamu: GPIO 5
 *  - Lampu Dapur: GPIO 18
 *  - Lampu Kamar Utama: GPIO 19
 *  - Lampu Kamar Anak: GPIO 21
 *  - Lampu Ruang Keluarga: GPIO 22
 *  - Lampu Ruang Makan: GPIO 23
 *  - AC Kamar Utama: GPIO 25
 *  - AC Kamar Anak: GPIO 26
 *  - Pintu Garasi: GPIO 27
 *  - Sensor Gerak: GPIO 13
 *  - Sensor Cahaya: GPIO 12
 *
 * Pastikan untuk menginstal pustaka berikut melalui Arduino Library Manager:
 * 1. Firebase ESP32 Client by Mobizt
 * 2. ArduinoJson by Benoit Blanchon
 */

#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// --- KONFIGURASI PENGGUNA ---
#define WIFI_SSID "i don't know"
#define WIFI_PASSWORD "hutabarat"

#define FIREBASE_HOST "batchscale-monitor-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_AUTH "REPLACE_WITH_YOUR_FIREBASE_DATABASE_SECRET" // Ganti dengan Database Secret Anda

// --- Definisi Pin ---
struct Device {
  const char* id;
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

Device sensors[] = {
  {"sensor_gerak", 13},
  {"sensor_cahaya", 12}
};

const int NUM_DEVICES = sizeof(devices) / sizeof(Device);
const int NUM_SENSORS = sizeof(sensors) / sizeof(Device);
unsigned long sensor_trigger_time[NUM_SENSORS] = {0};
const unsigned long SENSOR_ON_DURATION = 60000; // 60 detik

// Objek Firebase
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Callback function saat data di Firebase berubah
void streamCallback(FirebaseStream data) {
  if (data.dataType() == "json") {
    FirebaseJson &json = data.to<FirebaseJson>();
    String path = data.dataPath();
    
    for (int i = 0; i < NUM_DEVICES; i++) {
      String devicePath = "/" + String(devices[i].id) + "/state";
      if (path == devicePath) {
        FirebaseJsonData result;
        json.get(result, "data");
        bool state = result.to<bool>();
        digitalWrite(devices[i].pin, state ? HIGH : LOW);
        Serial.printf("Perangkat %s diubah menjadi %s\n", devices[i].id, state ? "NYALA" : "MATI");
      }
    }
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("Stream timeout, resuming...");
  }
}

void setup() {
  Serial.begin(115200);

  // Inisialisasi pin perangkat sebagai OUTPUT
  for (int i = 0; i < NUM_DEVICES; i++) {
    pinMode(devices[i].pin, OUTPUT);
    digitalWrite(devices[i].pin, LOW); // Pastikan semua mati saat startup
  }

  // Inisialisasi pin sensor sebagai INPUT
  for (int i = 0; i < NUM_SENSORS; i++) {
    pinMode(sensors[i].pin, INPUT);
  }

  // Koneksi WiFi
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
  config.host = FIREBASE_HOST;
  config.signer.test_mode = true;
  
  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(4096);

  // Mulai Firebase dengan secret (untuk akses server-ke-server)
  Firebase.begin(FIREBASE_HOST, FIREBASE_AUTH);
  
  // Setup listener untuk path 'devices'
  if (!Firebase.RTDB.beginStream(&fbdo, "/devices")) {
    Serial.println("------------------------------------");
    Serial.println("Gagal memulai stream: " + fbdo.errorReason());
    Serial.println("------------------------------------");
  }

  Firebase.RTDB.setStreamCallback(&fbdo, streamCallback, streamTimeoutCallback);
  Serial.println("Firebase stream dimulai, mendengarkan perubahan...");
}

void loop() {
  // Cek dan handle sensor
  for (int i = 0; i < NUM_SENSORS; i++) {
    bool currentState = digitalRead(sensors[i].pin) == HIGH;
    
    // Jika sensor terdeteksi (dan sebelumnya tidak)
    if (currentState && sensor_trigger_time[i] == 0) {
      Serial.printf("Sensor %s terdeteksi!\n", sensors[i].id);
      sensor_trigger_time[i] = millis();
      Firebase.RTDB.setBool(&fbdo, "/sensors/" + String(sensors[i].id) + "/state", true);
    }
    
    // Jika sensor aktif, cek durasi
    if (sensor_trigger_time[i] > 0) {
      if (millis() - sensor_trigger_time[i] >= SENSOR_ON_DURATION) {
        Serial.printf("Durasi sensor %s selesai.\n", sensors[i].id);
        sensor_trigger_time[i] = 0; // Reset timer
        Firebase.RTDB.setBool(&fbdo, "/sensors/" + String(sensors[i].id) + "/state", false);
      }
    }
  }

  delay(100); // Small delay to prevent overwhelming the CPU
}
