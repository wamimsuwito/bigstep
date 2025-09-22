/*
  Lisa Home Control - ESP32 BLE Server

  Deskripsi Fungsionalitas:
  1.  Membuat server Bluetooth Low Energy (BLE) yang bisa diakses oleh aplikasi web.
  2.  Mengontrol 4 buah LED yang terhubung ke pin GPIO.
  3.  Membaca input dari sebuah push button:
      - Tekan sekali untuk menyalakan semua LED.
      - Tekan sekali lagi untuk mematikan semua LED.
  4.  Membaca input dari sensor gerak (PIR):
      - Jika ada gerakan, semua LED menyala.
      - Jika tidak ada gerakan selama 1 menit, semua LED mati.

  Koneksi Pin (PENTING! GUNAKAN RESISTOR!):
  - Hubungkan LED ke pin GPIO melalui resistor (misalnya 220 Ohm) untuk menghindari kerusakan.
  - Skema: Pin GPIO -> Resistor -> Kaki Panjang LED (Anoda) -> Kaki Pendek LED (Katoda) -> GND.
  
  - LED 1 (Ruang Tamu): GPIO 2
  - LED 2 (Kamar Mandi): GPIO 4
  - LED 3 (Ruang Dapur): GPIO 5
  - LED 4 (Lampu Teras): GPIO 18
  - Push Button: GPIO 19
  - Sensor Gerak (PIR): GPIO 21
*/

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

// UUID untuk Service dan Characteristic (HARUS SAMA DENGAN DI APLIKASI WEB)
#define LIGHT_CONTROL_SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define LIGHT_CONTROL_CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// Definisi Pin
const int lampPin1 = 2;  // Ruang Tamu
const int lampPin2 = 4;  // Kamar Mandi
const int lampPin3 = 5;  // Ruang Dapur
const int lampPin4 = 18; // Lampu Teras
const int buttonPin = 19;
const int pirPin = 21;

const int lampPins[] = {lampPin1, lampPin2, lampPin3, lampPin4};
const int numLamps = sizeof(lampPins) / sizeof(lampPins[0]);

// Variabel untuk status
bool buttonState = true;
unsigned long lastPirMotionTime = 0;
const unsigned long pirTimeout = 60000; // 1 menit

// Menyalakan semua lampu
void allLightsOn() {
  for (int i = 0; i < numLamps; i++) {
    digitalWrite(lampPins[i], HIGH);
  }
}

// Mematikan semua lampu
void allLightsOff() {
  for (int i = 0; i < numLamps; i++) {
    digitalWrite(lampPins[i], LOW);
  }
}

// Callback class untuk menangani data yang masuk dari aplikasi web
class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String value = pCharacteristic->getValue().c_str();

      if (value.length() > 0) {
        char command = value[0];
        int lampPin = -1;

        switch(command) {
          case '1': lampPin = lampPin1; break;
          case '2': lampPin = lampPin2; break;
          case '3': lampPin = lampPin3; break;
          case '4': lampPin = lampPin4; break;
        }

        if (lampPin != -1) {
          // Toggle state lampu
          digitalWrite(lampPin, !digitalRead(lampPin));
        }
      }
    }
};

void setup() {
  Serial.begin(115200);

  // Setup semua pin lampu sebagai OUTPUT dan pastikan mati
  for (int i = 0; i < numLamps; i++) {
    pinMode(lampPins[i], OUTPUT);
    digitalWrite(lampPins[i], LOW); // LOW untuk mematikan LED
  }
  
  // Setup pin tombol dan sensor
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(pirPin, INPUT);

  // Setup Server BLE
  BLEDevice::init("Lisa Home Control ESP32");
  BLEServer *pServer = BLEDevice::createServer();
  BLEService *pService = pServer->createService(LIGHT_CONTROL_SERVICE_UUID);

  BLECharacteristic *pCharacteristic = pService->createCharacteristic(
                                         LIGHT_CONTROL_CHARACTERISTIC_UUID,
                                         BLECharacteristic::PROPERTY_READ |
                                         BLECharacteristic::PROPERTY_WRITE
                                       );

  pCharacteristic->setCallbacks(new MyCallbacks());
  pService->start();

  // Mulai advertising agar bisa ditemukan
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(LIGHT_CONTROL_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  
  Serial.println("Lisa Home Control Siap Dihubungkan!");
}

void loop() {
  // Logika Push Button
  if (digitalRead(buttonPin) == LOW) {
    delay(50); // Debounce
    if (digitalRead(buttonPin) == LOW) {
      buttonState = !buttonState;
      if (buttonState) {
        allLightsOff();
      } else {
        allLightsOn();
      }
      while(digitalRead(buttonPin) == LOW); // Tunggu sampai tombol dilepas
    }
  }

  // Logika Sensor Gerak (PIR)
  if (digitalRead(pirPin) == HIGH) {
    lastPirMotionTime = millis();
    allLightsOn();
  } else {
    if (millis() - lastPirMotionTime > pirTimeout) {
      allLightsOff();
    }
  }
}
