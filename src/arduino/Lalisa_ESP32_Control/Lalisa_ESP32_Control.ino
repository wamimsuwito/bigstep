/*
  Lalisa Home Control - ESP32 Code
  Dibuat untuk PT. Farika Riau Perkasa
  Versi: 2.0 (Active HIGH Logic)

  Logika:
  - Menggunakan Bluetooth Low Energy (BLE) untuk berkomunikasi dengan aplikasi web.
  - ACTIVE HIGH: Mengirim sinyal HIGH untuk menyalakan LED.
  - Pin diatur ke LOW saat startup untuk memastikan semua LED mati.
  - Mendukung kontrol via tombol fisik dan sensor gerak.
*/

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

// --- Konfigurasi Pin ---
const int ledPins[] = {2, 4, 5, 18}; // Pin untuk LED: Ruang Tamu, Kamar Mandi, Dapur, Teras
const int numLeds = 4;
const int pirPin = 21;      // Sensor Gerak (PIR)
const int buttonPin = 19;   // Push Button
const int onboardLedPin = 2; // LED biru bawaan ESP32

// UUID untuk Service dan Characteristic Bluetooth
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// --- Variabel Global ---
bool deviceConnected = false;
bool oldDeviceConnected = false;
unsigned long pirTimer = 0;
const long pirInterval = 30000; // 30 detik

// Status lampu (true = nyala, false = mati)
bool lightStates[numLeds] = {false, false, false, false};

// Deklarasi fungsi
void toggleLight(int ledIndex);

// Callback class saat ada koneksi atau data masuk via Bluetooth
class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    digitalWrite(onboardLedPin, HIGH); // Nyalakan LED biru saat terhubung
  }

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    digitalWrite(onboardLedPin, LOW); // Matikan LED biru saat koneksi putus
  }
};

class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      // Ambil data yang dikirim dari aplikasi web
      std::string value_str = pCharacteristic->getValue();

      if (value_str.length() > 0) {
        // Ambil karakter pertama sebagai perintah
        char command = value_str[0];
        
        // Logika untuk menyalakan/mematikan lampu berdasarkan perintah
        switch(command) {
          case '1': toggleLight(0); break; // Ruang Tamu
          case '2': toggleLight(1); break; // Kamar Mandi
          case '3': toggleLight(2); break; // Dapur
          case '4': toggleLight(3); break; // Teras
        }
      }
    }
};

void setup() {
  Serial.begin(115200);

  // Inisialisasi semua pin LED sebagai OUTPUT
  // dan pastikan semua LED mati saat startup (logika Active HIGH)
  for (int i = 0; i < numLeds; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW); // LOW = LED mati
  }

  // Inisialisasi pin lainnya
  pinMode(onboardLedPin, OUTPUT);
  pinMode(pirPin, INPUT);
  pinMode(buttonPin, INPUT_PULLUP);

  digitalWrite(onboardLedPin, LOW); // Pastikan LED biru mati di awal

  // Inisialisasi Bluetooth
  BLEDevice::init("Lisa Home Control ESP32");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);
  BLECharacteristic *pCharacteristic = pService->createCharacteristic(
                                         CHARACTERISTIC_UUID,
                                         BLECharacteristic::PROPERTY_READ |
                                         BLECharacteristic::PROPERTY_WRITE
                                       );
  pCharacteristic->setCallbacks(new MyCallbacks());
  pService->start();

  // Mulai advertising (agar bisa ditemukan oleh aplikasi)
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("Server BLE siap. Menunggu koneksi...");
}

void loop() {
  // Logika untuk sensor gerak (menyalakan lampu teras)
  if (digitalRead(pirPin) == HIGH) {
    if (!lightStates[3]) { // Jika lampu teras mati
      lightStates[3] = true;
      digitalWrite(ledPins[3], HIGH);
    }
    pirTimer = millis(); // Reset timer setiap ada gerakan
  }

  // Matikan lampu teras jika tidak ada gerakan selama interval waktu
  if (lightStates[3] && (millis() - pirTimer > pirInterval)) {
    lightStates[3] = false;
    digitalWrite(ledPins[3], LOW);
  }

  // Logika untuk tombol fisik (menyalakan/mematikan semua lampu)
  if (digitalRead(buttonPin) == LOW) {
    delay(200); // Debounce
    bool allOn = true;
    for (int i = 0; i < numLeds; i++) {
      if (!lightStates[i]) {
        allOn = false;
        break;
      }
    }
    for (int i = 0; i < numLeds; i++) {
      lightStates[i] = !allOn;
      digitalWrite(ledPins[i], lightStates[i] ? HIGH : LOW);
    }
  }

  // Logika untuk menangani koneksi yang terputus
  if (!deviceConnected && oldDeviceConnected) {
    delay(500); // Beri waktu untuk proses disconnect
    BLEDevice::startAdvertising(); // Mulai advertising lagi
    Serial.println("Mulai advertising lagi");
    oldDeviceConnected = deviceConnected;
  }
  
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }
}

// Fungsi untuk mengubah status satu lampu
void toggleLight(int ledIndex) {
  if (ledIndex >= 0 && ledIndex < numLeds) {
    lightStates[ledIndex] = !lightStates[ledIndex];
    digitalWrite(ledPins[ledIndex], lightStates[ledIndex] ? HIGH : LOW);
  }
}
