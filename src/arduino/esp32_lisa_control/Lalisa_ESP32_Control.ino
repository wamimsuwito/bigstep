/*
  Lisa Home Control - Kode ESP32
  Dibuat untuk diintegrasikan dengan aplikasi web PT. Farika Riau Perkasa

  Fungsionalitas:
  1. Kontrol 4 Lampu (LED) via Bluetooth Low Energy (BLE).
  2. Satu tombol fisik untuk menyalakan/mematikan semua lampu.
  3. Satu sensor gerak (PIR) untuk menyalakan semua lampu saat ada gerakan.
*/

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <Arduino.h>

// == PENTING: Pengaturan Pin ==
// Pin untuk setiap lampu (LED)
const int ledPins[] = {2, 4, 5, 18}; 
const int NUM_LEDS = 4;

// Pin untuk komponen input
const int pushButtonPin = 19; 
const int pirSensorPin = 21;  

// == PENTING: Pengaturan Bluetooth ==
// UUID ini HARUS SAMA dengan yang ada di aplikasi web
#define LIGHT_CONTROL_SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define LIGHT_CONTROL_CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// Variabel global untuk state
bool lightStates[NUM_LEDS] = {false, false, false, false};
bool allLightsOn = false;
volatile bool buttonPressed = false;
volatile long lastDebounceTime = 0;
long debounceDelay = 50;

// Variabel untuk sensor gerak (PIR)
volatile bool motionDetected = false;
unsigned long lastMotionTime = 0;
const unsigned long motionTimeout = 60000; // 1 menit

// Logika terbalik: HIGH untuk mematikan, LOW untuk menyalakan
// Ini adalah praktik yang lebih aman untuk memastikan LED mati saat boot
const int LED_ON = LOW;
const int LED_OFF = HIGH;

// Fungsi untuk mengupdate status satu lampu
void setLightState(int index, bool state) {
  if (index >= 0 && index < NUM_LEDS) {
    lightStates[index] = state;
    digitalWrite(ledPins[index], state ? LED_ON : LED_OFF);
  }
}

// Fungsi untuk mengupdate semua lampu sekaligus
void setAllLights(bool state) {
  for (int i = 0; i < NUM_LEDS; i++) {
    setLightState(i, state);
  }
  allLightsOn = state;
}

// Callback untuk menangani perintah tulis dari aplikasi web
class MyCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) override {
    // Menggunakan String dari Arduino, bukan std::string
    String value = pCharacteristic->getValue().c_str();

    if (value.length() > 0) {
      char command = value[0];
      int lightIndex = command - '1'; // Konversi '1' -> 0, '2' -> 1, dst.

      if (lightIndex >= 0 && lightIndex < NUM_LEDS) {
        // Toggle state lampu yang dipilih
        setLightState(lightIndex, !lightStates[lightIndex]);
      }
    }
  }
};

// Interrupt Service Routine (ISR) untuk tombol
void IRAM_ATTR handleButtonInterrupt() {
  if ((millis() - lastDebounceTime) > debounceDelay) {
    buttonPressed = true;
    lastDebounceTime = millis();
  }
}

// Interrupt Service Routine (ISR) untuk sensor PIR
void IRAM_ATTR handleMotionInterrupt() {
  motionDetected = true;
}

void setup() {
  Serial.begin(115200);

  // Inisialisasi semua pin LED sebagai OUTPUT dan matikan (set ke HIGH)
  for (int i = 0; i < NUM_LEDS; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LED_OFF); // Pastikan semua LED mati saat start
  }

  // Inisialisasi pin tombol sebagai INPUT dengan pull-up internal
  pinMode(pushButtonPin, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(pushButtonPin), handleButtonInterrupt, FALLING);

  // Inisialisasi pin sensor PIR sebagai INPUT
  pinMode(pirSensorPin, INPUT);
  attachInterrupt(digitalPinToInterrupt(pirSensorPin), handleMotionInterrupt, RISING);

  // Inisialisasi Server BLE
  BLEDevice::init("Lisa Home ESP32");
  BLEServer *pServer = BLEDevice::createServer();
  BLEService *pService = pServer->createService(LIGHT_CONTROL_SERVICE_UUID);

  BLECharacteristic *pCharacteristic = pService->createCharacteristic(
      LIGHT_CONTROL_CHARACTERISTIC_UUID,
      BLECharacteristic::PROPERTY_READ |
      BLECharacteristic::PROPERTY_WRITE
  );

  pCharacteristic->setCallbacks(new MyCallbacks());
  pService->start();

  // Mulai advertising agar bisa ditemukan aplikasi web
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(LIGHT_CONTROL_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("Lisa Home Control Siap Dihubungkan!");
}

void loop() {
  // Logika untuk tombol fisik
  if (buttonPressed) {
    buttonPressed = false; // Reset flag
    setAllLights(!allLightsOn);
  }

  // Logika untuk sensor gerak (PIR)
  if (motionDetected) {
    motionDetected = false; // Reset flag
    setAllLights(true); // Nyalakan semua lampu jika ada gerakan
    lastMotionTime = millis(); // Catat waktu gerakan terakhir
  }

  // Cek jika sudah tidak ada gerakan selama interval timeout
  if (allLightsOn && (millis() - lastMotionTime > motionTimeout)) {
     // Pastikan sensor benar-benar tidak mendeteksi gerakan sebelum mematikan
     if (digitalRead(pirSensorPin) == LOW) {
        setAllLights(false); // Matikan semua lampu
     }
  }

  // Delay kecil untuk stabilitas
  delay(50);
}
