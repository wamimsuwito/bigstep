/**
 * @file esp32_lisa_control.ino
 * @author Firebase AI
 * @brief ESP32 code to control 4 lights via BLE, a physical button, and a PIR sensor.
 *
 * Hardware Connections:
 * - Light 1 (Ruang Tamu): GPIO 23
 * - Light 2 (Kamar Mandi): GPIO 22
 * - Light 3 (Ruang Dapur): GPIO 21
 * - Light 4 (Lampu Teras): GPIO 19
 * - Physical Push Button: GPIO 18 (with a pulldown resistor)
 * - PIR Sensor: GPIO 5
 */

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

// UUIDs - MUST MATCH THE WEB APP
#define LIGHT_CONTROL_SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define LIGHT_CONTROL_CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// GPIO Pin Definitions
#define LIGHT1_PIN 23 // Ruang Tamu
#define LIGHT2_PIN 22 // Kamar Mandi
#define LIGHT3_PIN 21 // Ruang Dapur
#define LIGHT4_PIN 19 // Lampu Teras
#define BUTTON_PIN 18 // Push Button
#define PIR_PIN    5  // PIR Sensor

// State variables
bool lightStates[4] = {false, false, false, false};
bool buttonState = HIGH;
bool lastButtonState = HIGH;
bool allLightsOn = false;

// PIR Sensor variables
volatile bool motionDetected = false;
unsigned long lastMotionTime = 0;
const unsigned long motionTimeout = 60000; // 1 minute in milliseconds

// Function Prototypes
void updateAllLights(bool turnOn);
void toggleLight(int lightIndex);
void IRAM_ATTR detectsMovement();

class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String value = pCharacteristic->getValue().c_str();

      if (value.length() > 0) {
        char command = value[0];
        int lightIndex = -1;

        switch(command) {
          case '1':
            lightIndex = 0; // Ruang Tamu
            break;
          case '2':
            lightIndex = 1; // Kamar Mandi
            break;
          case '3':
            lightIndex = 2; // Ruang Dapur
            break;
          case '4':
            lightIndex = 3; // Lampu Teras
            break;
          default:
            Serial.print("Perintah tidak dikenal: ");
            Serial.println(command);
            break;
        }

        if (lightIndex != -1) {
          toggleLight(lightIndex);
          Serial.print("Lampu ");
          Serial.print(lightIndex + 1);
          Serial.println(lightStates[lightIndex] ? " ON" : " OFF");
        }
      }
    }
};

void setup() {
  Serial.begin(115200);
  Serial.println("Starting Lisa Home Control ESP32");

  // Initialize GPIOs
  pinMode(LIGHT1_PIN, OUTPUT);
  pinMode(LIGHT2_PIN, OUTPUT);
  pinMode(LIGHT3_PIN, OUTPUT);
  pinMode(LIGHT4_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP); // Using internal pull-up resistor
  pinMode(PIR_PIN, INPUT);

  // Set initial light states to OFF
  updateAllLights(false);

  // Attach interrupt for PIR sensor
  attachInterrupt(digitalPinToInterrupt(PIR_PIN), detectsMovement, RISING);

  // Create the BLE Device
  BLEDevice::init("Lisa Home Control ESP32");
  
  // Create the BLE Server
  BLEServer *pServer = BLEDevice::createServer();
  
  // Create the BLE Service
  BLEService *pService = pServer->createService(LIGHT_CONTROL_SERVICE_UUID);
  
  // Create a BLE Characteristic
  BLECharacteristic *pCharacteristic = pService->createCharacteristic(
                                         LIGHT_CONTROL_CHARACTERISTIC_UUID,
                                         BLECharacteristic::PROPERTY_WRITE
                                       );

  pCharacteristic->setCallbacks(new MyCallbacks());
  
  // Start the service
  pService->start();
  
  // Start advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(LIGHT_CONTROL_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  // functions that help with iPhone connections issue
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  
  Serial.println("Characteristic defined! Now advertising...");
}

void loop() {
  // --- Push Button Logic ---
  buttonState = digitalRead(BUTTON_PIN);
  if (buttonState == LOW && lastButtonState == HIGH) {
    // Button was just pressed
    delay(50); // Debounce delay
    allLightsOn = !allLightsOn;
    updateAllLights(allLightsOn);
    Serial.println(allLightsOn ? "Tombol ditekan: Semua lampu ON" : "Tombol ditekan: Semua lampu OFF");
  }
  lastButtonState = buttonState;

  // --- PIR Sensor Logic ---
  if (motionDetected) {
    if (!allLightsOn) { // Only turn on if they are not already on by button
        Serial.println("Gerakan terdeteksi! Menyalakan semua lampu.");
        updateAllLights(true);
    }
    lastMotionTime = millis();
    motionDetected = false; // Reset flag after handling
  }

  // Check if motion timeout has been reached
  if (allLightsOn && lastMotionTime > 0 && (millis() - lastMotionTime > motionTimeout)) {
      Serial.println("Tidak ada gerakan, mematikan lampu.");
      updateAllLights(false);
      lastMotionTime = 0; // Reset timer
      allLightsOn = false; // Reset button logic state as well
  }
  
  delay(100);
}

// --- Helper Functions ---

// Function to control all lights at once
void updateAllLights(bool turnOn) {
  for (int i = 0; i < 4; i++) {
    lightStates[i] = turnOn;
    digitalWrite(i == 0 ? LIGHT1_PIN : i == 1 ? LIGHT2_PIN : i == 2 ? LIGHT3_PIN : LIGHT4_PIN, turnOn ? HIGH : LOW);
  }
}

// Function to toggle a single light
void toggleLight(int lightIndex) {
  if (lightIndex >= 0 && lightIndex < 4) {
    lightStates[lightIndex] = !lightStates[lightIndex];
    digitalWrite(lightIndex == 0 ? LIGHT1_PIN : lightIndex == 1 ? LIGHT2_PIN : lightIndex == 2 ? LIGHT3_PIN : LIGHT4_PIN, lightStates[lightIndex] ? HIGH : LOW);
  }
}

// Interrupt Service Routine for PIR sensor
void IRAM_ATTR detectsMovement() {
  motionDetected = true;
}
