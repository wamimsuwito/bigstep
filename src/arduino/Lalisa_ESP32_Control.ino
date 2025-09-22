/*
  Lalisa Home Control - ESP32 BLE Server

  This code creates a Bluetooth Low Energy (BLE) server on an ESP32
  that can be controlled by the "Lisa Home Control" web application.

  Functionality:
  1. Controls 4 individual lights via BLE commands from the web app.
  2. A physical push button to toggle all lights ON/OFF simultaneously.
  3. A PIR motion sensor that turns all lights ON when motion is detected
     and turns them OFF after a 1-minute timeout.

  Pinout:
  - GPIO 23: LED "Ruang Tamu"
  - GPIO 22: LED "Kamar Mandi"
  - GPIO 21: LED "Ruang Dapur"
  - GPIO 19: LED "Lampu Teras"
  - GPIO 18: Push Button input (connect to GND when pressed)
  - GPIO 5:  PIR Motion Sensor output
*/

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

// See the following for generating UUIDs:
// https://www.uuidgenerator.net/
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// Pin Definitions
const int ledPins[] = {23, 22, 21, 19}; // Ruang Tamu, Kamar Mandi, Ruang Dapur, Lampu Teras
const int numLeds = 4;
const int buttonPin = 18;
const int pirPin = 5;

// State Variables
bool ledStates[numLeds] = {false, false, false, false};
bool allLightsOn = false;
volatile bool buttonPressed = false;
volatile long lastPirMotionTime = 0;
const long pirTimeout = 60000; // 1 minute in milliseconds

// Function to toggle a specific light
void toggleLight(int lightIndex) {
  if (lightIndex >= 0 && lightIndex < numLeds) {
    ledStates[lightIndex] = !ledStates[lightIndex];
    digitalWrite(ledPins[lightIndex], ledStates[lightIndex]);
    Serial.printf("Toggled light %d to %s\n", lightIndex + 1, ledStates[lightIndex] ? "ON" : "OFF");
  }
}

// Function to control all lights
void setAllLights(bool state) {
  allLightsOn = state;
  for (int i = 0; i < numLeds; i++) {
    ledStates[i] = state;
    digitalWrite(ledPins[i], ledStates[i]);
  }
  Serial.printf("All lights turned %s\n", state ? "ON" : "OFF");
}

// Interrupt Service Routine for the button
void IRAM_ATTR handleButtonInterrupt() {
  // Simple debounce
  static unsigned long last_interrupt_time = 0;
  unsigned long interrupt_time = millis();
  if (interrupt_time - last_interrupt_time > 200) {
    buttonPressed = true;
  }
  last_interrupt_time = interrupt_time;
}

// BLE Callbacks
class MyCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      std::string value = pCharacteristic->getValue();

      if (value.length() > 0) {
        // The command is the first byte of the value received.
        int command = value[0];
        Serial.printf("Received command: %d\n", command);

        switch (command) {
          case 1: toggleLight(0); break; // Ruang Tamu
          case 2: toggleLight(1); break; // Kamar Mandi
          case 3: toggleLight(2); break; // Ruang Dapur
          case 4: toggleLight(3); break; // Lampu Teras
          default:
            Serial.printf("Unknown command: %d\n", command);
            break;
        }
      }
    }
};

void setup() {
  Serial.begin(115200);
  Serial.println("Starting Lisa Home Control ESP32...");

  // Initialize GPIOs
  for (int i = 0; i < numLeds; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }
  pinMode(pirPin, INPUT);
  pinMode(buttonPin, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(buttonPin), handleButtonInterrupt, FALLING);

  // Create the BLE Device
  BLEDevice::init("Lisa Home Control ESP32");
  
  // Create the BLE Server
  BLEServer *pServer = BLEDevice::createServer();
  
  // Create the BLE Service
  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Create a BLE Characteristic
  BLECharacteristic *pCharacteristic = pService->createCharacteristic(
                                         CHARACTERISTIC_UUID,
                                         BLECharacteristic::PROPERTY_WRITE
                                       );
  pCharacteristic->setCallbacks(new MyCallbacks());

  // Start the service
  pService->start();

  // Start advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  
  Serial.println("Characteristic defined! Now advertising...");
}

void loop() {
  // Handle physical button press
  if (buttonPressed) {
    buttonPressed = false; // Reset flag
    setAllLights(!allLightsOn);
  }

  // Handle PIR sensor logic
  if (digitalRead(pirPin) == HIGH) {
    if (lastPirMotionTime == 0) { // Motion just started
      Serial.println("Motion detected! Turning all lights ON.");
      setAllLights(true);
    }
    lastPirMotionTime = millis(); // Update the time of the last motion
  } else {
    if (lastPirMotionTime > 0 && (millis() - lastPirMotionTime > pirTimeout)) {
      Serial.println("No motion for 1 minute. Turning all lights OFF.");
      setAllLights(false);
      lastPirMotionTime = 0; // Reset motion timer
    }
  }

  // A small delay to prevent the loop from running too fast
  delay(100);
}
