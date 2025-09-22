/*
 *  LALISA HOME CONTROL - ESP32 FIRMWARE
 *  
 *  Deskripsi:
 *  Kode ini mengubah ESP32 menjadi server Bluetooth Low Energy (BLE) untuk
 *  mengontrol 4 buah lampu. Bisa dikontrol melalui aplikasi web atau
 *  secara fisik melalui push button dan sensor gerak PIR.
 *
 *  Fungsionalitas:
 *  1. BLE Control: Menerima perintah (byte 1-4) dari web app untuk menyalakan/mematikan lampu secara individual.
 *  2. Push Button: Satu tombol fisik untuk menyalakan/mematikan semua lampu secara bersamaan.
 *  3. PIR Sensor: Sensor gerak yang akan menyalakan semua lampu jika ada gerakan, 
 *     dan mematikannya setelah 1 menit tidak ada gerakan.
 *
 *  Dibuat untuk project Firebase Studio.
 *  Pastikan Anda telah menginstal library "BLE" untuk ESP32 di Arduino IDE Anda.
 *  (Tools -> Manage Libraries... -> cari "ESP32 BLE Arduino")
*/

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// -- KONFIGURASI PIN --
// Ubah pin ini sesuai dengan koneksi hardware Anda
#define RELAY_PIN_1 23 // Lampu Ruang Tamu
#define RELAY_PIN_2 22 // Lampu Kamar Mandi
#define RELAY_PIN_3 21 // Lampu Ruang Dapur
#define RELAY_PIN_4 19 // Lampu Teras
#define PUSH_BUTTON_PIN 18 // Tombol fisik
#define PIR_SENSOR_PIN 5   // Sensor Gerak (PIR)

// -- KONFIGURASI BLUETOOTH --
// UUID ini HARUS SAMA dengan yang ada di aplikasi web
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// Variabel Global
BLECharacteristic *pCharacteristic;
bool deviceConnected = false;

// State untuk setiap lampu (relay)
bool lightStates[4] = {false, false, false, false};

// Variabel untuk Push Button (dengan debouncing)
int buttonState;
int lastButtonState = HIGH; 
unsigned long lastDebounceTime = 0;
unsigned long debounceDelay = 50;
bool allLightsOn = false;

// Variabel untuk Sensor Gerak (PIR)
volatile bool motionDetected = false;
unsigned long lastMotionTime = 0;
const unsigned long motionTimeout = 60000; // 60 detik (1 menit)

// Fungsi untuk mengupdate semua lampu berdasarkan state
void updateAllLights() {
  digitalWrite(RELAY_PIN_1, lightStates[0] ? HIGH : LOW);
  digitalWrite(RELAY_PIN_2, lightStates[1] ? HIGH : LOW);
  digitalWrite(RELAY_PIN_3, lightStates[2] ? HIGH : LOW);
  digitalWrite(RELAY_PIN_4, lightStates[3] ? HIGH : LOW);
}

// Fungsi untuk menyalakan/mematikan semua lampu
void setAllLights(bool turnOn) {
  for (int i = 0; i < 4; i++) {
    lightStates[i] = turnOn;
  }
  updateAllLights();
}

// Callback untuk server connection status
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      Serial.println("Device connected");
    }

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("Device disconnected");
      // Mulai ulang advertising agar bisa ditemukan lagi
      pServer->startAdvertising(); 
    }
};

// Callback untuk menerima data dari client (web app)
class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      std::string value = pCharacteristic->getValue();

      if (value.length() > 0) {
        int command = value[0];
        Serial.print("Received command: ");
        Serial.println(command);

        if (command >= 1 && command <= 4) {
          int lightIndex = command - 1;
          lightStates[lightIndex] = !lightStates[lightIndex];
          updateAllLights();
          Serial.printf("Toggled Light %d. New state: %s\n", command, lightStates[lightIndex] ? "ON" : "OFF");
        }
      }
    }
};

void setup() {
  Serial.begin(115200);

  // Inisialisasi pin relay sebagai output
  pinMode(RELAY_PIN_1, OUTPUT);
  pinMode(RELAY_PIN_2, OUTPUT);
  pinMode(RELAY_PIN_3, OUTPUT);
  pinMode(RELAY_PIN_4, OUTPUT);

  // Inisialisasi pin tombol & sensor sebagai input
  pinMode(PUSH_BUTTON_PIN, INPUT_PULLUP);
  pinMode(PIR_SENSOR_PIN, INPUT);

  // Set semua lampu mati pada awalnya
  setAllLights(false);

  // --- Setup BLE ---
  Serial.println("Starting BLE server...");
  BLEDevice::init("Lisa Home Control (ESP32)"); // Nama device BLE
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_WRITE
                    );
  pCharacteristic->setCallbacks(new MyCallbacks());

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  
  BLEDevice::startAdvertising();
  Serial.println("Characteristic defined! Now advertising...");
}

void loop() {
  // --- Logika Push Button ---
  int reading = digitalRead(PUSH_BUTTON_PIN);
  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  }
  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (reading != buttonState) {
      buttonState = reading;
      if (buttonState == LOW) { // Tombol ditekan
        allLightsOn = !allLightsOn;
        setAllLights(allLightsOn);
        Serial.printf("Button pressed. All lights turned %s\n", allLightsOn ? "ON" : "OFF");
      }
    }
  }
  lastButtonState = reading;

  // --- Logika Sensor Gerak (PIR) ---
  if (digitalRead(PIR_SENSOR_PIN) == HIGH) {
    if (!motionDetected) {
      Serial.println("Motion detected!");
      setAllLights(true); // Nyalakan semua lampu
      motionDetected = true;
    }
    lastMotionTime = millis(); // Reset timer setiap ada gerakan
  } else {
    motionDetected = false;
  }

  // Jika tidak ada gerakan selama durasi timeout, matikan lampu
  if (!motionDetected && (millis() - lastMotionTime > motionTimeout)) {
    // Cek apakah lampu menyala karena sensor, jika iya, matikan
    // Kita cek apakah semua lampu menyala (kondisi saat sensor aktif)
    bool areAllLightsOnBySensor = lightStates[0] && lightStates[1] && lightStates[2] && lightStates[3];
    if(areAllLightsOnBySensor) {
        Serial.println("Motion timeout. Turning all lights OFF.");
        setAllLights(false);
    }
    // Reset timer agar tidak terus menerus mematikan lampu
    lastMotionTime = millis(); 
  }

  // Delay kecil untuk stabilitas
  delay(10);
}
