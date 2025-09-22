
/*
  Lisa Home Control - ESP32 BLE Server
  
  Fungsionalitas:
  1. Kontrol 4 LED melalui Bluetooth Low Energy (BLE) dari aplikasi web.
  2. Menggunakan 1 tombol fisik untuk menyalakan/mematikan semua lampu secara bersamaan.
  3. Menggunakan 1 sensor gerak (PIR) untuk menyalakan semua lampu saat ada gerakan.
  4. LED akan mati otomatis setelah 1 menit tidak ada gerakan.

  Koneksi Pin (Saran dengan Resistor):
  - LED 1 (Ruang Tamu): 3.3V -> LED -> Resistor 220 Ohm -> Pin 2
  - LED 2 (Kamar Mandi): 3.3V -> LED -> Resistor 220 Ohm -> Pin 4
  - LED 3 (Ruang Dapur): 3.3V -> LED -> Resistor 220 Ohm -> Pin 5
  - LED 4 (Lampu Teras): 3.3V -> LED -> Resistor 220 Ohm -> Pin 18
  - Tombol Fisik: Pin 19 -> Tombol -> GND
  - Sensor PIR: Pin 21 (Output sensor)
*/

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

// UUID yang SAMA PERSIS dengan di aplikasi web
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// === Pengaturan Pin ===
const int ledPins[] = {2, 4, 5, 18}; // Ruang Tamu, Kamar Mandi, Dapur, Teras
const int numLeds = 4;
const int buttonPin = 19;
const int pirPin = 21;

// === Variabel Global ===
bool lightStates[numLeds] = {false, false, false, false}; // false = OFF, true = ON
bool allLightsState = false;
volatile bool buttonPressed = false;
unsigned long lastMotionTime = 0;
const unsigned long motionTimeout = 60000; // 60 detik

// Callback untuk menangani data yang masuk dari aplikasi web
class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String value_str = pCharacteristic->getValue().c_str();

      if (value_str.length() > 0) {
        char command = value_str[0];
        
        int lightIndex = -1;

        switch(command) {
          case '1': lightIndex = 0; break; // Ruang Tamu
          case '2': lightIndex = 1; break; // Kamar Mandi
          case '3': lightIndex = 2; break; // Dapur
          case '4': lightIndex = 3; break; // Teras
        }

        if (lightIndex != -1) {
          lightStates[lightIndex] = !lightStates[lightIndex];
          // Logika terbalik: LOW untuk ON, HIGH untuk OFF
          digitalWrite(ledPins[lightIndex], lightStates[lightIndex] ? LOW : HIGH);
          Serial.print("Lampu ");
          Serial.print(lightIndex + 1);
          Serial.println(lightStates[lightIndex] ? " ON" : " OFF");
        }
      }
    }
};

void IRAM_ATTR handleButtonInterrupt() {
  buttonPressed = true;
}

void setup() {
  Serial.begin(115200);

  // Inisialisasi semua pin LED dan matikan (set ke HIGH)
  for (int i = 0; i < numLeds; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], HIGH); // HIGH mematikan LED
  }

  // Inisialisasi pin tombol dengan pull-up internal
  pinMode(buttonPin, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(buttonPin), handleButtonInterrupt, FALLING);

  // Inisialisasi pin sensor PIR
  pinMode(pirPin, INPUT);

  // === Setup Server BLE ===
  Serial.println("Starting BLE server...");
  BLEDevice::init("Lisa Home Control ESP32");
  BLEServer *pServer = BLEDevice::createServer();
  BLEService *pService = pServer->createService(SERVICE_UUID);
  BLECharacteristic *pCharacteristic = pService->createCharacteristic(
                                         CHARACTERISTIC_UUID,
                                         BLECharacteristic::PROPERTY_READ |
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
  // === Logika Tombol Fisik ===
  if (buttonPressed) {
    delay(50); // Debounce
    allLightsState = !allLightsState;
    for (int i = 0; i < numLeds; i++) {
      lightStates[i] = allLightsState;
      digitalWrite(ledPins[i], allLightsState ? LOW : HIGH);
    }
    Serial.println(allLightsState ? "All lights ON" : "All lights OFF");
    buttonPressed = false; // Reset flag
  }

  // === Logika Sensor Gerak (PIR) ===
  if (digitalRead(pirPin) == HIGH) {
    if (lastMotionTime == 0) { // Gerakan pertama terdeteksi
      Serial.println("Motion detected! Turning all lights ON.");
      for (int i = 0; i < numLeds; i++) {
        digitalWrite(ledPins[i], LOW); // Nyalakan semua lampu
      }
    }
    lastMotionTime = millis(); // Perbarui waktu gerakan terakhir terdeteksi
  }

  // Cek jika sudah tidak ada gerakan selama timeout
  if (lastMotionTime != 0 && millis() - lastMotionTime > motionTimeout) {
    Serial.println("No motion for 1 minute. Turning all lights OFF.");
    for (int i = 0; i < numLeds; i++) {
       // Hanya matikan lampu jika tidak sedang ON dari perintah BLE atau tombol
       if (!lightStates[i] && !allLightsState) {
          digitalWrite(ledPins[i], HIGH);
       }
    }
    lastMotionTime = 0; // Reset timer
  }

  // Tunda sedikit untuk stabilitas
  delay(100);
}
