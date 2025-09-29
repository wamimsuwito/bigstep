// Dibuat untuk Aplikasi Kontrol Rumah "Lalisa"
// Mikrokontroler: ESP32
// Konektivitas: WiFi & Firebase Realtime Database
// Dibuat oleh: Tim Aplikasi PT. Farika Riau Perkasa

// --- PUSTAKA YANG DIPERLUKAN ---
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// --- PENGATURAN KONEKSI (GANTI DENGAN KREDENSIAL ANDA) ---
#define WIFI_SSID "i don't know"
#define WIFI_PASSWORD "hutabarat"
#define API_KEY "AIzaSyDQHD5hWDvY_Jp7kTsvOJ4Yei_fRYVgA3Y"
#define DATABASE_URL "https://batchscale-monitor-default-rtdb.asia-southeast1.firebasedatabase.app"

// --- DEFINISI PIN PERANGKAT ---
// Perangkat yang dikontrol (Lampu, AC, dll.) terhubung ke Relay
const int ledPins[] = {2, 4, 5, 18, 19, 21, 22, 23, 25, 26, 27};
const char* deviceIds[] = {"lampu_teras", "lampu_taman", "lampu_ruang_tamu", "lampu_dapur", "lampu_kamar_utama", "lampu_kamar_anak", "lampu_ruang_keluarga", "lampu_ruang_makan", "ac_kamar_utama", "ac_kamar_anak", "pintu_garasi"};
const int numDevices = sizeof(ledPins) / sizeof(ledPins[0]);

// Sensor eksternal
const int motionSensorPin = 13;
const int lightSensorPin = 12;

// --- OBJEK FIREBASE ---
FirebaseData stream;
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// --- VARIABEL GLOBAL ---
volatile bool motionDetected = false;
volatile unsigned long motionTriggerTime = 0;
const unsigned long motionActiveDuration = 60000; // 60 detik

// Fungsi untuk menangani data stream dari Firebase
void streamCallback(StreamData data) {
    if (data.dataType() == "json") {
        FirebaseJson &json = data.jsonObject();
        size_t len = json.iteratorBegin();
        String key, value;
        int type;
        for (size_t i = 0; i < len; i++) {
            json.iteratorGet(i, type, key, value);
            for (int j = 0; j < numDevices; j++) {
                if (key == deviceIds[j]) {
                    Serial.printf("Perintah diterima untuk %s: %s\n", key.c_str(), value.c_str());
                    digitalWrite(ledPins[j], value == "true" ? HIGH : LOW);
                }
            }
        }
    }
}

void streamTimeoutCallback(bool timeout) {
    if (timeout) {
        Serial.println("Stream timeout, akan coba lagi...");
    }
}

// Fungsi interrupt untuk sensor gerak
void IRAM_ATTR detectsMovement() {
    motionDetected = true;
    motionTriggerTime = millis();
}

void setup() {
    Serial.begin(115200);

    // Inisialisasi pin perangkat sebagai output dan set ke LOW (mati)
    for (int i = 0; i < numDevices; i++) {
        pinMode(ledPins[i], OUTPUT);
        digitalWrite(ledPins[i], LOW);
    }
    
    // Inisialisasi pin sensor
    pinMode(motionSensorPin, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(motionSensorPin), detectsMovement, RISING); // Asumsi sensor HIGH saat ada gerakan
    pinMode(lightSensorPin, INPUT);

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
    config.signer.test_mode = true; // Ganti ke false jika menggunakan akun service

    Firebase.reconnectWiFi(true);
    fbdo.setResponseSize(4096);
    
    // Mulai koneksi ke Firebase
    Firebase.begin(&config, &auth);

    // Mulai stream untuk mendengarkan perubahan pada path '/devices'
    if (!Firebase.RTDB.beginStream(&stream, "/devices")) {
        Serial.println("Gagal memulai stream: " + stream.errorReason());
    }

    Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback);

    Serial.println("Setup selesai. Menunggu perintah dari aplikasi...");
}

void loop() {
    // Cek status sensor gerak
    if (motionDetected) {
        // Kirim status 'true' ke Firebase
        Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_gerak/state", true);
        Serial.println("Gerakan terdeteksi! Mengirim status ke Firebase.");
        motionDetected = false; // Reset flag setelah dikirim
    }

    // Cek apakah durasi aktif sensor gerak sudah habis
    if (motionTriggerTime > 0 && millis() - motionTriggerTime > motionActiveDuration) {
        // Kirim status 'false' kembali ke Firebase
        Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_gerak/state", false);
        Serial.println("Durasi sensor gerak selesai. Mengirim status non-aktif.");
        motionTriggerTime = 0; // Reset timer
    }

    // Cek status sensor cahaya (contoh sederhana: HIGH = terang, LOW = gelap)
    bool isLight = digitalRead(lightSensorPin) == HIGH;
    static bool lastLightState = !isLight;
    if (isLight != lastLightState) {
        Firebase.RTDB.setBool(&fbdo, "/sensors/sensor_cahaya/state", isLight);
        Serial.printf("Sensor cahaya berubah: %s\n", isLight ? "Terang" : "Gelap");
        lastLightState = isLight;
    }

    delay(200); // Penundaan singkat untuk stabilitas
}
