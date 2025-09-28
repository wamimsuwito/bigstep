
#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// --- Kredensial WiFi & Firebase ---
// Ganti dengan kredensial Anda
#define WIFI_SSID "NAMA_WIFI_ANDA"
#define WIFI_PASSWORD "PASSWORD_WIFI_ANDA"
#define API_KEY "API_KEY_FIREBASE_ANDA"
#define DATABASE_URL "URL_REALTIME_DATABASE_ANDA" // Contoh: "project-id.firebaseio.com"

// Objek untuk Firebase
FirebaseData fbdo;
FirebaseData stream;
FirebaseAuth auth;
FirebaseConfig config;

// --- Pinout Perangkat ---
const int ledPins[] = {2, 4, 5, 18, 19, 21, 22, 23, 25, 26, 27};
const char* deviceIds[] = {
  "lampu_teras", "lampu_taman", "lampu_ruang_tamu", "lampu_dapur", 
  "lampu_kamar_utama", "lampu_kamar_anak", "lampu_ruang_keluarga", 
  "lampu_ruang_makan", "ac_kamar_utama", "ac_kamar_anak", "pintu_garasi"
};
const int deviceCount = sizeof(ledPins) / sizeof(ledPins[0]);

// --- Pinout Sensor ---
const int motionSensorPin = 13;
const int lightSensorPin = 12;

// --- Variabel Status & Waktu ---
bool motionSensorState = false;
unsigned long motionTriggerTime = 0;
const long motionDuration = 60000; // 60 detik

// --- Deklarasi Fungsi ---
void streamCallback(FirebaseStream data);
void streamTimeoutCallback(bool timeout);
void setupWifi();
void firebaseInit();
void checkSensors();

void setup() {
  Serial.begin(115200);
  
  // Inisialisasi semua pin perangkat sebagai output dan set ke LOW (mati)
  for (int i = 0; i < deviceCount; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }

  // Inisialisasi pin sensor
  pinMode(motionSensorPin, INPUT_PULLUP);
  pinMode(lightSensorPin, INPUT_PULLUP);

  setupWifi();
  firebaseInit();

  // Memulai 'listener' ke path 'devices' di Firebase
  if (!Firebase.RTDB.beginStream(&stream, "/devices")) {
    Serial.println("------------------------------------");
    Serial.println("Can't begin stream on /devices");
    Serial.println("REASON: " + stream.errorReason());
    Serial.println("------------------------------------");
    Serial.println();
  } else {
    Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback);
  }
}

void loop() {
  Firebase.loop();
  checkSensors();

  // Logika untuk mematikan sensor gerak setelah durasi tertentu
  if (motionSensorState && millis() - motionTriggerTime > motionDuration) {
    motionSensorState = false;
    // Update status ke Firebase
    if (Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_gerak/state", false)) {
        Serial.println("PASSED: Reset motion sensor state");
    } else {
        Serial.println("FAILED: Reset motion sensor state");
        Serial.println("REASON: " + fbdo.errorReason());
    }
  }
}

void setupWifi() {
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
}

void firebaseInit() {
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

// Fungsi ini dipanggil setiap kali ada perubahan data di path '/devices'
void streamCallback(FirebaseStream data) {
  Serial.printf("Stream callback, path: %s, event: %s, type: %s\n",
                data.streamPath().c_str(),
                data.eventType().c_str(),
                data.dataType().c_str());

  if (data.dataTypeEnum() == fb_esp_rtdb_data_type_json) {
    FirebaseJson *json = data.to<FirebaseJson *>();
    String jsonStr;
    json->toString(jsonStr, true);
    Serial.println(jsonStr);

    FirebaseJsonData result;
    for (int i = 0; i < deviceCount; i++) {
        String path = String("/") + deviceIds[i] + "/state";
        if (json->get(result, path)) {
            if (result.typeNum == FirebaseJson::JSON_BOOL) {
                bool state = result.to<bool>();
                digitalWrite(ledPins[i], state ? HIGH : LOW);
                Serial.printf("Device %s is now %s\n", deviceIds[i], state ? "ON" : "OFF");
            }
        }
    }
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("Stream timeout, resuming...");
  }
}

void checkSensors() {
  // --- Sensor Gerak ---
  bool currentMotion = digitalRead(motionSensorPin) == HIGH;
  if (currentMotion && !motionSensorState) {
    motionSensorState = true;
    motionTriggerTime = millis();
    Serial.println("Motion Detected!");
    // Kirim update ke Firebase
    if (Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_gerak/state", true)) {
        Serial.println("PASSED: Set motion sensor state to true");
        Firebase.RTDB.set(&fbdo, "/sensors/sensor_gerak/last_triggered", FirebaseJson().set("['.sv']", "timestamp"));
    } else {
        Serial.println("FAILED: Set motion sensor state");
        Serial.println("REASON: " + fbdo.errorReason());
    }
  }
  
  // --- Sensor Cahaya ---
  // Catatan: Sensor cahaya analog (seperti LDR) mungkin perlu pembacaan analog.
  // Kode ini mengasumsikan sensor digital (HIGH/LOW).
  bool currentLight = digitalRead(lightSensorPin) == LOW; // Asumsi LOW berarti gelap
  static bool lastLightState = false;
  
  if (currentLight != lastLightState) {
    lastLightState = currentLight;
    Serial.printf("Light Sensor State: %s\n", currentLight ? "Terang" : "Gelap");
    if (Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_cahaya/state", currentLight)) {
        Serial.println("PASSED: Updated light sensor state");
    } else {
        Serial.println("FAILED: Update light sensor state");
        Serial.println("REASON: " + fbdo.errorReason());
    }
  }
}

