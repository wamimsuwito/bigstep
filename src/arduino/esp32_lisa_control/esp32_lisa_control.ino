
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// UUID untuk Service dan Characteristic, HARUS SAMA dengan di aplikasi web
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// Pin untuk setiap LED/lampu. Gunakan resistor 220 Ohm untuk setiap LED.
const int ledPins[] = {2, 4, 5, 18}; // Ruang Tamu, Kamar Mandi, Dapur, Teras
const int numLeds = 4;
bool ledStates[numLeds] = {false, false, false, false};

// Pin untuk tombol fisik dan sensor gerak
const int buttonPin = 19;
const int pirPin = 21;

// Pin untuk LED indikator koneksi Bluetooth
const int bleStatusLed = 22; // Gunakan LED biru di board atau LED eksternal

// Variabel untuk debouncing tombol
bool buttonState = HIGH;
bool lastButtonState = HIGH;
unsigned long lastDebounceTime = 0;
unsigned long debounceDelay = 50;

// Variabel untuk sensor gerak (PIR)
bool motionDetected = false;
unsigned long lastMotionTime = 0;
const unsigned long motionTimeout = 60000; // 1 menit

// --- FUNGSI UTILITY UNTUK KONTROL LAMPU ---

void setAllLights(bool state) {
  for (int i = 0; i < numLeds; i++) {
    ledStates[i] = state;
    digitalWrite(ledPins[i], state ? HIGH : LOW);
  }
}

void toggleLight(int lightId) {
  if (lightId >= 1 && lightId <= numLeds) {
    int index = lightId - 1;
    ledStates[index] = !ledStates[index];
    digitalWrite(ledPins[index], ledStates[index] ? HIGH : LOW);
  }
}

// --- CALLBACK UNTUK KONEKSI BLUETOOTH ---

class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    digitalWrite(bleStatusLed, HIGH); // Nyalakan LED biru saat terhubung
    Serial.println("Client Connected");
  }

  void onDisconnect(BLEServer* pServer) {
    digitalWrite(bleStatusLed, LOW); // Matikan LED biru saat terputus
    Serial.println("Client Disconnected");
    BLEDevice::startAdvertising(); // Mulai advertising lagi agar bisa dihubungkan kembali
  }
};

// --- CALLBACK UNTUK MENERIMA PERINTAH DARI APLIKASI WEB ---

class MyCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    // Menggunakan Arduino String object yang lebih aman untuk library ini
    String value_str = pCharacteristic->getValue().c_str();

    if (value_str.length() > 0) {
      Serial.print("Received command: ");
      Serial.println(value_str);

      // Konversi karakter pertama ke integer
      int command = value_str.charAt(0) - '0';
      toggleLight(command);
    }
  }
};

void setup() {
  Serial.begin(115200);

  // Inisialisasi semua pin LED dan pastikan mati saat boot
  for (int i = 0; i < numLeds; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW); // Logika Active HIGH: LOW berarti mati
  }

  // Inisialisasi pin lainnya
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(pirPin, INPUT);
  pinMode(bleStatusLed, OUTPUT);
  digitalWrite(bleStatusLed, LOW); // Pastikan LED status mati di awal

  // --- SETUP SERVER BLE ---
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
  pCharacteristic->setValue("Ready");

  pService->start();

  // --- MULAI ADVERTISING ---
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  Serial.println("Characteristic defined! Now advertising...");
}

void loop() {
  // --- LOGIKA UNTUK TOMBOL FISIK ---
  int reading = digitalRead(buttonPin);
  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  }

  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (reading != buttonState) {
      buttonState = reading;
      if (buttonState == LOW) { // Tombol ditekan
        // Jika salah satu lampu menyala, matikan semua. Jika semua mati, nyalakan semua.
        bool anyLightOn = false;
        for(int i=0; i<numLeds; i++) {
          if (ledStates[i]) {
            anyLightOn = true;
            break;
          }
        }
        setAllLights(!anyLightOn);
      }
    }
  }
  lastButtonState = reading;

  // --- LOGIKA UNTUK SENSOR GERAK (PIR) ---
  if (digitalRead(pirPin) == HIGH) {
    if (!motionDetected) {
      Serial.println("Motion detected!");
      setAllLights(true);
      motionDetected = true;
    }
    lastMotionTime = millis();
  } else {
    if (motionDetected) {
      if (millis() - lastMotionTime > motionTimeout) {
        Serial.println("Motion stopped. Turning off lights.");
        setAllLights(false);
        motionDetected = false;
      }
    }
  }

  // Tunda sedikit untuk efisiensi
  delay(50);
}
