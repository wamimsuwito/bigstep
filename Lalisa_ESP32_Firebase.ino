// --- KONFIGURASI PENTING ---
#define WIFI_SSID "i don't know"
#define WIFI_PASSWORD "hutabarat"

// Ganti dengan URL Database dari Firebase Console Anda (Pengaturan Proyek > Service accounts > Database secrets)
#define DATABASE_URL "batchscale-monitor-default-rtdb.asia-southeast1.firebasedatabase.app"

#include <WiFi.h>
#include <Firebase_ESP_Client.h>

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
unsigned long motionTriggerTime = 0;
unsigned long lightTriggerTime = 0;
const unsigned long sensorActiveDuration = 60000; // 60 detik

void streamCallback(FirebaseStream data) {
  if (data.dataType() == "json") {
    FirebaseJson &json = data.jsonObject();
    size_t len = json.iteratorBegin();
    FirebaseJson::IteratorValue value;
    for (size_t i = 0; i < len; i++) {
      value = json.iteratorGet(i);
      if (value.type == FirebaseJson::JSON_BOOL) {
        String deviceId = value.key;
        bool state = value.value == "true";
        for (int j = 0; j < (sizeof(deviceIds) / sizeof(deviceIds[0])); j++) {
          if (deviceId == deviceIds[j]) {
            digitalWrite(ledPins[j], state ? HIGH : LOW);
            Serial.printf("Device %s is %s\n", deviceId.c_str(), state ? "ON" : "OFF");
            break;
          }
        }
      }
    }
    json.iteratorEnd();
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("Stream timeout, resuming...");
  }
}

void setup() {
  Serial.begin(115200);

  // Inisialisasi pin perangkat sebagai output
  for (int pin : ledPins) {
    pinMode(pin, OUTPUT);
  }
  // Inisialisasi pin sensor sebagai input
  pinMode(motionSensorPin, INPUT);
  pinMode(lightSensorPin, INPUT);

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
  config.database_url = DATABASE_URL;
  config.signer.test_mode = true; // Gunakan mode anonim

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Men-setup listener untuk path '/devices'
  if (!Firebase.RTDB.beginStream(&stream, "/devices")) {
    Serial.println("------------------------------------");
    Serial.println("Can't begin stream path...");
    Serial.println("REASON: " + stream.errorReason());
    Serial.println("------------------------------------");
    Serial.println();
  }

  Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback);
}

void loop() {
  unsigned long currentTime = millis();

  // --- Logika Sensor Gerak ---
  if (digitalRead(motionSensorPin) == HIGH) {
    if (motionTriggerTime == 0) { // Hanya update saat pertama kali terdeteksi
      Serial.println("Motion Detected!");
      Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_gerak/state", true);
      motionTriggerTime = currentTime;
    }
  }

  if (motionTriggerTime != 0 && (currentTime - motionTriggerTime > sensorActiveDuration)) {
    Serial.println("Motion sensor timeout. Turning off.");
    Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_gerak/state", false);
    motionTriggerTime = 0; // Reset timer
  }

  // --- Logika Sensor Cahaya ---
  // Asumsi: HIGH = Terang, LOW = Gelap. Balik logikanya jika perlu.
  if (digitalRead(lightSensorPin) == HIGH) {
    if (lightTriggerTime == 0) { // Hanya update saat pertama kali terdeteksi
      Serial.println("Light is bright!");
      Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_cahaya/state", true);
      lightTriggerTime = currentTime;
    }
  }

  if (lightTriggerTime != 0 && (currentTime - lightTriggerTime > sensorActiveDuration)) {
    Serial.println("Light sensor timeout. Setting to dark.");
    Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_cahaya/state", false);
    lightTriggerTime = 0; // Reset timer
  }

  delay(100); // Penundaan singkat untuk stabilitas
}
