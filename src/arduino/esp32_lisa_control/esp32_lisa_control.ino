/*
  LISA-SPARKLE-HOME
  ESP32 Bluetooth Low Energy (BLE) Controller
  
  Logic: Active HIGH
  - LED menyala ketika pin GPIO diberi sinyal HIGH.
  - LED mati ketika pin GPIO diberi sinyal LOW.
  
  Koneksi Fisik (Direkomendasikan):
  - Kaki pendek LED (Katoda) -> Pin GND di ESP32.
  - Kaki panjang LED (Anoda) -> Salah satu ujung Resistor (220 Ohm).
  - Ujung resistor lainnya -> Pin GPIO di ESP32 (misal: Pin 2).
  
  Pastikan Anda selalu menggunakan resistor untuk melindungi LED dan pin ESP32 Anda!
*/

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// UUID untuk Service dan Characteristic, harus sama dengan di aplikasi web
#define SERVICE_UUID           "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID    "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// Pinout untuk LED, Tombol, dan Sensor
const int ledPins[] = {2, 4, 5, 18}; // Ruang Tamu, Kamar Mandi, Dapur, Teras
const int buttonPin = 19;
const int pirPin = 21;
const int blueLedPin = 22; // Pin untuk LED indikator koneksi Bluetooth

// Variabel state
bool ledStates[] = {false, false, false, false};
bool deviceConnected = false;

// Callback class untuk menangani event koneksi server BLE
class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    digitalWrite(blueLedPin, HIGH); // Nyalakan LED biru saat terhubung
  }

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    digitalWrite(blueLedPin, LOW); // Matikan LED biru saat koneksi terputus
    BLEDevice::startAdvertising(); // Mulai advertising lagi agar bisa ditemukan
  }
};

// Callback class untuk menangani event penulisan data ke characteristic
class MyCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    std::string value = pCharacteristic->getValue();

    if (value.length() > 0) {
      char command = value[0];
      int ledIndex = -1;

      switch(command) {
        case '1': ledIndex = 0; break; // Ruang Tamu
        case '2': ledIndex = 1; break; // Kamar Mandi
        case '3': ledIndex = 2; break; // Ruang Dapur
        case '4': ledIndex = 3; break; // Lampu Teras
      }

      if (ledIndex != -1) {
        ledStates[ledIndex] = !ledStates[ledIndex];
        digitalWrite(ledPins[ledIndex], ledStates[ledIndex] ? HIGH : LOW);
      }
    }
  }
};

void setup() {
  Serial.begin(115200);

  // Inisialisasi semua pin LED sebagai OUTPUT dan set ke LOW (mati)
  for (int i = 0; i < 4; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }
  
  // Inisialisasi pin untuk indikator koneksi
  pinMode(blueLedPin, OUTPUT);
  digitalWrite(blueLedPin, LOW);

  // Setup BLE
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

  // Setup advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  Serial.println("Characteristic defined! Now you can connect with your phone!");
}

void loop() {
  // Logika lain bisa ditambahkan di sini jika perlu,
  // misalnya untuk membaca tombol atau sensor.
  delay(100); 
}
