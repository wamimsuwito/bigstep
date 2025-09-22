/*
  Lisa Sparkle Home - ESP32 Bluetooth Low Energy (BLE) Control
  
  This code creates a BLE server on an ESP32 that can be controlled by a web application.
  It's designed to control multiple LEDs, simulating home lights, and also includes
  functionality for a physical button and a motion sensor.
  
  Version: Active-HIGH Final
  This version uses "Active HIGH" logic, meaning a HIGH signal on a GPIO pin turns the LED ON.
  This is suitable for a circuit where the LED is connected between a GPIO pin and GND, with a
  current-limiting resistor in series.
  
  Hardware Connections:
  - LED 1 (Ruang Tamu):   GPIO 2 -> Resistor -> LED -> GND
  - LED 2 (Kamar Mandi):  GPIO 4 -> Resistor -> LED -> GND
  - LED 3 (Ruang Dapur):  GPIO 5 -> Resistor -> LED -> GND
  - LED 4 (Lampu Teras):  GPIO 18 -> Resistor -> LED -> GND
  - Push Button:          GPIO 19 -> (connected to GND, uses internal pull-up)
  - PIR Motion Sensor:    GPIO 21
  - Status LED (onboard): GPIO 2 (BUILTIN_LED)

  IMPORTANT: Always use a current-limiting resistor (e.g., 220 Ohm) for each LED 
  to prevent damage to the LED and the ESP32's GPIO pin.
*/

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <Arduino.h>

// BLE Service and Characteristic UUIDs
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// Pin definitions
const int ledPins[] = {2, 4, 5, 18}; // Ruang Tamu, Kamar Mandi, Ruang Dapur, Lampu Teras
const int numLeds = sizeof(ledPins) / sizeof(ledPins[0]);
const int buttonPin = 19;
const int pirPin = 21;
const int statusLedPin = BUILTIN_LED; // Onboard LED

// Global state variables
bool ledStates[numLeds] = {false, false, false, false};
bool deviceConnected = false;

// Debouncing variables for the physical button
unsigned long lastDebounceTime = 0;
unsigned long debounceDelay = 50;
int lastButtonState = HIGH;

// Forward declaration for the callback class
class MyCallbacks;

// Callback class for handling BLE characteristic write events
class MyCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    std::string value_str = pCharacteristic->getValue();

    if (value_str.length() > 0) {
      char cmd = value_str[0];
      int ledIndex = -1;

      // Map received character to LED index
      if (cmd >= '1' && cmd <= '4') {
        ledIndex = cmd - '1';
      }

      if (ledIndex != -1) {
        ledStates[ledIndex] = !ledStates[ledIndex];
        digitalWrite(ledPins[ledIndex], ledStates[ledIndex] ? HIGH : LOW);
        Serial.printf("LED %d toggled to %s\n", ledIndex + 1, ledStates[ledIndex] ? "ON" : "OFF");
      }
    }
  }
};


// Callback class for handling BLE server connection events
class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    digitalWrite(statusLedPin, HIGH); // Turn on status LED when connected
    Serial.println("Device connected");
  }

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    digitalWrite(statusLedPin, LOW); // Turn off status LED when disconnected
    Serial.println("Device disconnected");
    // Restart advertising to allow new connections
    BLEDevice::startAdvertising();
    Serial.println("Restart advertising...");
  }
};

void setup() {
  Serial.begin(115200);

  // Initialize LED pins
  for (int i = 0; i < numLeds; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW); // Ensure all LEDs are OFF at startup
  }

  // Initialize other pins
  pinMode(statusLedPin, OUTPUT);
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(pirPin, INPUT);

  // --- BLE Setup ---
  Serial.println("Starting BLE server...");
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
  pCharacteristic->setValue("Hello World");
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
  // --- Physical Button Logic ---
  int reading = digitalRead(buttonPin);
  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  }
  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (reading == LOW) { // Button pressed (connected to GND)
      // Turn all lights ON if they are all OFF, otherwise turn all OFF
      bool allOff = true;
      for (int i = 0; i < numLeds; i++) {
        if (ledStates[i]) {
          allOff = false;
          break;
        }
      }

      bool targetState = allOff; // If all are off, target is ON, otherwise target is OFF
      for (int i = 0; i < numLeds; i++) {
        ledStates[i] = targetState;
        digitalWrite(ledPins[i], targetState ? HIGH : LOW);
      }
      Serial.printf("Button pressed. All lights set to %s\n", targetState ? "ON" : "OFF");
      
      // A small delay to prevent multiple toggles from one long press
      delay(200); 
    }
  }
  lastButtonState = reading;

  // --- PIR Motion Sensor Logic for Lampu Teras (LED 4, index 3) ---
  int motion = digitalRead(pirPin);
  if (motion == HIGH) {
    if (!ledStates[3]) { // If Lampu Teras is OFF, turn it ON
      ledStates[3] = true;
      digitalWrite(ledPins[3], HIGH);
      Serial.println("Motion detected! Teras light ON.");
    }
  }

  // The BLE stack runs in the background, no need for explicit loop code for it.
  delay(20); // Small delay for stability
}
