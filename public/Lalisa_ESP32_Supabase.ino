
#include <WiFi.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <string>

// --- KONFIGURASI WIFI & SUPABASE ---
const char* ssid = "NAMA_WIFI_ANDA";
const char* password = "PASSWORD_WIFI_ANDA";
String supabaseUrl = "URL_SUPABASE_ANDA";
String supabaseKey = "KUNCI_ANON_SUPABASE_ANDA";

// --- KONFIGURASI PIN PERANGKAT ---
struct Device {
  const char* id;
  int pin;
  bool state;
};

Device devices[] = {
  {"lampu_teras", 2, false},
  {"lampu_taman", 4, false},
  {"lampu_ruang_tamu", 5, false},
  {"lampu_dapur", 18, false},
  {"lampu_kamar_utama", 19, false},
  {"lampu_kamar_anak", 21, false},
  {"lampu_ruang_keluarga", 22, false},
  {"lampu_ruang_makan", 23, false},
  {"ac_kamar_utama", 25, false},
  {"ac_kamar_anak", 26, false},
  {"pintu_garasi", 27, false}
};

// --- KONFIGURASI PIN SENSOR ---
const int MOTION_SENSOR_PIN = 13;
const int LIGHT_SENSOR_PIN = 12; // Pin untuk LDR
const int LED_BUILTIN_PIN = 15; // LED Biru di board untuk indikator status

unsigned long motionTriggerTime = 0;
unsigned long lightTriggerTime = 0;
const long SENSOR_ACTIVE_DURATION = 60000; // 60 detik

bool lastMotionState = false;
bool lastLightState = false;

// Variabel untuk interval pengecekan
unsigned long lastCheckTime = 0;
const long checkInterval = 2000; // Cek status setiap 2 detik

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Inisialisasi pin perangkat sebagai OUTPUT
  for (auto &device : devices) {
    pinMode(device.pin, OUTPUT);
    digitalWrite(device.pin, LOW); // Pastikan semua relay mati saat awal
  }

  // Inisialisasi pin sensor sebagai INPUT
  pinMode(MOTION_SENSOR_PIN, INPUT);
  pinMode(LIGHT_SENSOR_PIN, INPUT);
  pinMode(LED_BUILTIN_PIN, OUTPUT);
  digitalWrite(LED_BUILTIN_PIN, LOW);

  connectToWiFi();
  fetchInitialStates();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Koneksi WiFi terputus. Mencoba menghubungkan kembali...");
    digitalWrite(LED_BUILTIN_PIN, LOW);
    connectToWiFi();
  }

  unsigned long currentTime = millis();

  // Hanya cek status jika interval sudah tercapai
  if (currentTime - lastCheckTime > checkInterval) {
    lastCheckTime = currentTime;
    fetchInitialStates(); // Cek status dari Supabase secara berkala
  }

  handleSensors(currentTime);
  
  delay(100); // Jeda singkat
}

void connectToWiFi() {
  Serial.print("Menghubungkan ke ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  int attempt = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    attempt++;
    if (attempt > 20) { // Coba selama 10 detik
        Serial.println("\nGagal terhubung ke WiFi. Restart dalam 5 detik.");
        delay(5000);
        ESP.restart();
    }
  }

  Serial.println("\nWiFi terhubung!");
  Serial.print("Alamat IP: ");
  Serial.println(WiFi.localIP());
  digitalWrite(LED_BUILTIN_PIN, HIGH); // Nyalakan LED biru jika terhubung
}

void fetchInitialStates() {
    HTTPClient http;
    String url = supabaseUrl + "/rest/v1/devices?select=*";
    http.begin(url);
    http.addHeader("apikey", supabaseKey);
    http.addHeader("Authorization", "Bearer " + supabaseKey);

    int httpCode = http.GET();
    if (httpCode == HTTP_CODE_OK) {
        String payload = http.getString();
        // Serial.println("Response dari Supabase:");
        // Serial.println(payload);

        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, payload);

        if (error) {
            Serial.print(F("deserializeJson() gagal: "));
            Serial.println(error.f_str());
            return;
        }

        JsonArray array = doc.as<JsonArray>();
        for (JsonObject obj : array) {
            std::string id = obj["id"];
            bool state = obj["state"];
            for (auto &device : devices) {
                if (id == device.id) {
                    if (device.state != state) {
                        device.state = state;
                        Serial.print("Mengubah status ");
                        Serial.print(device.id);
                        Serial.print(" menjadi ");
                        Serial.println(device.state ? "ON" : "OFF");
                        digitalWrite(device.pin, device.state ? HIGH : LOW);
                    }
                    break;
                }
            }
        }
    } else {
        Serial.printf("[HTTP] GET... gagal, error: %d - %s\n", httpCode, http.errorToString(httpCode).c_str());
    }
    http.end();
}


void handleSensors(unsigned long currentTime) {
  // Sensor Gerak (PIR)
  bool motionDetected = (digitalRead(MOTION_SENSOR_PIN) == HIGH);
  if (motionDetected && !lastMotionState) {
    Serial.println("Gerakan terdeteksi!");
    motionTriggerTime = currentTime;
    updateSensorState("sensor_gerak", true);
  }
  lastMotionState = motionDetected;

  // Matikan pin sensor gerak setelah durasi tertentu
  if (motionTriggerTime > 0 && currentTime - motionTriggerTime > SENSOR_ACTIVE_DURATION) {
    Serial.println("Timer sensor gerak selesai.");
    motionTriggerTime = 0;
    updateSensorState("sensor_gerak", false);
  }

  // Sensor Cahaya (LDR) - diasumsikan LOW saat gelap
  bool isDark = (digitalRead(LIGHT_SENSOR_PIN) == LOW);
  if (isDark && !lastLightState) {
    Serial.println("Kondisi gelap terdeteksi!");
    lightTriggerTime = currentTime;
    updateSensorState("sensor_cahaya", false); // False = gelap
  } else if (!isDark && lastLightState) {
    Serial.println("Kondisi terang terdeteksi!");
    lightTriggerTime = currentTime;
    updateSensorState("sensor_cahaya", true); // True = terang
  }
  lastLightState = isDark;

  // Untuk sensor cahaya, kita bisa buat dia mati sendiri jika diperlukan,
  // tapi biasanya statusnya akan terus mengikuti kondisi cahaya.
  // Kode di bawah ini opsional, jika Anda ingin status "terang" kembali ke "gelap" otomatis setelah 60 detik.
  /*
  if (lightTriggerTime > 0 && currentTime - lightTriggerTime > SENSOR_ACTIVE_DURATION) {
    Serial.println("Timer sensor cahaya selesai.");
    lightTriggerTime = 0;
    // Mungkin tidak perlu di-reset, tergantung logika yang diinginkan
    // updateSensorState("sensor_cahaya", false); 
  }
  */
}


void updateSensorState(const char* sensorId, bool state) {
  HTTPClient http;
  String url = supabaseUrl + "/rest/v1/sensors?id=eq." + sensorId;
  http.begin(url);
  http.addHeader("apikey", supabaseKey);
  http.addHeader("Authorization", "Bearer " + supabaseKey);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal");

  JsonDocument doc;
  doc["state"] = state;
  doc["last_triggered"] = String(millis()); // Atau gunakan RTC jika ada

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.PATCH(requestBody);

  if (httpCode == HTTP_CODE_NO_CONTENT) {
    Serial.print("Status sensor ");
    Serial.print(sensorId);
    Serial.print(" berhasil diupdate ke ");
    Serial.println(state ? "ON" : "OFF");
  } else {
    Serial.printf("[HTTP] PATCH... gagal, error: %d - %s\n", httpCode, http.errorToString(httpCode).c_str());
    String payload = http.getString();
    Serial.println("Payload: " + payload);
  }

  http.end();
}
