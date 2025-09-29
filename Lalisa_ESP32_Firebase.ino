// Kode untuk ESP32 - Kontrol Rumah Pintar via Firebase Realtime Database

// Penting: Instal pustaka "Firebase ESP32 Client" oleh Mobizt dari Library Manager di Arduino IDE.
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// --- Konfigurasi WiFi ---
#define WIFI_SSID "i don't know"
#define WIFI_PASSWORD "hutabarat"

// --- Konfigurasi Firebase ---
#define API_KEY "AIzaSyDQHD5hWDvY_Jp7kTsvOJ4Yei_fRYVgA3Y"
#define DATABASE_URL "https://batchscale-monitor-default-rtdb.asia-southeast1.firebasedatabase.app"

// Objek Firebase
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// State untuk stream
bool streamActive = false;

// --- Definisi Pin ---
// Perangkat (Relay)
const int ledPins[] = {2, 4, 5, 18, 19, 21, 22, 23, 25, 26, 27};
const char* deviceIds[] = {"lampu_teras", "lampu_taman", "lampu_ruang_tamu", "lampu_dapur", "lampu_kamar_utama", "lampu_kamar_anak", "lampu_ruang_keluarga", "lampu_ruang_makan", "ac_kamar_utama", "ac_kamar_anak", "pintu_garasi"};

// Sensor
const int motionSensorPin = 13;
const int lightSensorPin = 12;

// Variabel untuk timer sensor
unsigned long motionTriggerTime = 0;
unsigned long lightSensorTriggerTime = 0;
const unsigned long SENSOR_ON_DURATION = 60000; // 60 detik

// Callback saat data stream diterima
void streamCallback(FirebaseStream data) {
  if (data.dataType() == "json") {
    FirebaseJson &json = data.to<FirebaseJson>();
    String path = data.streamPath();

    if (path == "/") { // Data awal saat stream dimulai
      // Iterasi semua perangkat
      for (size_t i = 0; i < sizeof(ledPins) / sizeof(ledPins[0]); i++) {
        String key = "devices/";
        key += deviceIds[i];
        key += "/state";
        
        FirebaseJsonData result;
        if (json.get(result, key)) {
          if (result.type == "boolean") {
            digitalWrite(ledPins[i], result.boolValue ? HIGH : LOW);
            Serial.printf("Device %s is %s\n", deviceIds[i], result.boolValue ? "ON" : "OFF");
          }
        }
      }
    } else { // Perubahan data spesifik
      String deviceKey = data.dataPath();
      if (deviceKey.startsWith("/devices/")) {
        for (size_t i = 0; i < sizeof(ledPins) / sizeof(ledPins[0]); i++) {
          if (String(deviceIds[i]) == deviceKey.substring(9, deviceKey.lastIndexOf('/'))) {
             if (data.dataType() == "boolean") {
                digitalWrite(ledPins[i], data.boolValue() ? HIGH : LOW);
                Serial.printf("Device %s changed to %s\n", deviceIds[i], data.boolValue() ? "ON" : "OFF");
             }
            break;
          }
        }
      }
    }
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("Stream timeout, resuming...");
    streamActive = false; // Tandai untuk memulai ulang stream di loop()
  }
}

void setup() {
  Serial.begin(115200);

  // Inisialisasi pin perangkat sebagai OUTPUT
  for (int pin : ledPins) {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
  }

  // Inisialisasi pin sensor sebagai INPUT
  pinMode(motionSensorPin, INPUT_PULLUP);
  pinMode(lightSensorPin, INPUT_PULLUP);

  // Koneksi WiFi
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
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  // Jika stream tidak aktif, coba mulai
  if (!streamActive && Firebase.ready()) {
    Serial.println("Starting Firebase stream...");
    if (!Firebase.RTDB.beginStream(&fbdo, "/")) {
      Serial.printf("Stream start failed: %s\n", fbdo.errorReason().c_str());
    } else {
      Firebase.RTDB.setStreamCallback(&fbdo, streamCallback, streamTimeoutCallback);
      streamActive = true;
      Serial.println("Stream started successfully.");
    }
  }

  // Baca sensor gerak
  if (digitalRead(motionSensorPin) == HIGH) {
    if (motionTriggerTime == 0) { // Hanya picu saat pertama kali terdeteksi
      motionTriggerTime = millis();
      Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_gerak/state", true);
      Serial.println("Motion Detected! Sent to Firebase.");
    }
  }

  // Cek timer sensor gerak
  if (motionTriggerTime > 0 && millis() - motionTriggerTime > SENSOR_ON_DURATION) {
    motionTriggerTime = 0; // Reset timer
    Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_gerak/state", false);
    Serial.println("Motion sensor timer reset. State set to false in Firebase.");
  }

  // Baca sensor cahaya (asumsi HIGH = Gelap, LOW = Terang)
  if (digitalRead(lightSensorPin) == HIGH) { // Jika gelap
    if (lightSensorTriggerTime == 0) {
      lightSensorTriggerTime = millis();
      Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_cahaya/state", false); // false = gelap
    }
  } else { // Jika terang
    lightSensorTriggerTime = 0; // Reset jika menjadi terang kapan saja
    Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_cahaya/state", true); // true = terang
  }
}
