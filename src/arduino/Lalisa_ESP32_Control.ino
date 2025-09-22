/**
 * @file esp32_lisa_control.ino
 * @author Gemini
 * @brief ESP32 code for Lisa's Home Control project.
 * 
 * This code creates a BLE server to control 4 LEDs, read a push button, and a PIR motion sensor.
 * It's designed to work with the "Lisa Home Control" web application.
 *
 * HARDWARE CONNECTIONS:
 * =======================
 * IMPORTANT: It is highly recommended to use a current-limiting resistor (e.g., 220 Ohm) for each LED.
 * The recommended connection method to ensure LEDs are OFF on boot is:
 * ESP32 Pin 3V3 --> LED Anode (longer leg) --> Resistor --> GPIO Pin
 * 
 * - LED 1 (Ruang Tamu):     GPIO 2
 * - LED 2 (Kamar Mandi):    GPIO 4
 * - LED 3 (Ruang Dapur):    GPIO 5
 * - LED 4 (Lampu Teras):    GPIO 18
 * - Push Button:            GPIO 19 to GND
 * - PIR Sensor:             GPIO 21
 */

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

// --- PIN DEFINITIONS ---
const int ledPins[] = {2, 4, 5, 18};
const int numLeds = sizeof(ledPins) / sizeof(ledPins[0]);
const int buttonPin = 19;
const int pirPin = 21;

// --- STATE VARIABLES ---
bool ledStates[numLeds] = {false, false, false, false};
bool allLightsOn = false;
volatile bool buttonPressed = false;
unsigned long lastMotionTime = 0;
const unsigned long motionTimeout = 60000; // 1 minute in milliseconds

// See the following for generating UUIDs:
// https://www.uuidgenerator.net/
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// --- FUNCTION PROTOTYPES ---
void updateAllLeds();
void IRAM_ATTR handleButtonInterrupt();

// --- BLE CALLBACKS ---
class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String value = pCharacteristic->getValue().c_str();

      if (value.length() > 0) {
        char command = value[0];
        int ledIndex = -1;

        switch(command) {
          case '1': ledIndex = 0; break; // Ruang Tamu
          case '2': ledIndex = 1; break; // Kamar Mandi
          case '3': ledIndex = 2; break; // Ruang Dapur
          case '4': ledIndex = 3; break; // Lampu Teras
          default:
            Serial.print("Unknown command: ");
            Serial.println(command);
            return;
        }

        if (ledIndex != -1) {
          Serial.print("Toggling LED: ");
          Serial.println(ledIndex + 1);
          ledStates[ledIndex] = !ledStates[ledIndex]; // Toggle state
          digitalWrite(ledPins[ledIndex], ledStates[ledIndex] ? LOW : HIGH); // ACTIVE LOW: LOW is ON
        }
      }
    }
};

// --- ARDUINO SETUP ---
void setup() {
  Serial.begin(115200);

  // Initialize LEDs and set them to OFF state (HIGH for active-low)
  for (int i = 0; i < numLeds; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], HIGH); // ACTIVE LOW: Set to HIGH to turn OFF
  }

  // Initialize button with internal pull-up and interrupt
  pinMode(buttonPin, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(buttonPin), handleButtonInterrupt, FALLING);

  // Initialize PIR sensor
  pinMode(pirPin, INPUT);

  Serial.println("Starting BLE server...");

  BLEDevice::init("Lisa Home ESP32");
  BLEServer *pServer = BLEDevice::createServer();
  BLEService *pService = pServer->createService(SERVICE_UUID);
  BLECharacteristic *pCharacteristic = pService->createCharacteristic(
                                         CHARACTERISTIC_UUID,
                                         BLECharacteristic::PROPERTY_READ |
                                         BLECharacteristic::PROPERTY_WRITE
                                       );

  pCharacteristic->setCallbacks(new MyCallbacks());
  pCharacteristic->setValue("Hello from Lisa's ESP32!");
  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  Serial.println("Characteristic defined! Now you can pair.");
}

// --- ARDUINO LOOP ---
void loop() {
  // Handle button press
  if (buttonPressed) {
    allLightsOn = !allLightsOn;
    updateAllLeds();
    Serial.println(allLightsOn ? "Button: All lights ON" : "Button: All lights OFF");
    buttonPressed = false; // Reset flag
    delay(200); // Debounce
  }

  // Handle PIR sensor
  if (digitalRead(pirPin) == HIGH) {
    if (lastMotionTime == 0) { // First detection
        Serial.println("Motion detected! Turning all lights ON.");
        updateAllLeds(true); // Force all lights on
    }
    lastMotionTime = millis();
  } else {
    if (lastMotionTime != 0 && (millis() - lastMotionTime > motionTimeout)) {
      Serial.println("No motion for 1 minute. Turning all lights OFF.");
      updateAllLeds(false); // Force all lights off
      lastMotionTime = 0; // Reset motion timer
    }
  }

  delay(100);
}

// --- HELPER FUNCTIONS ---

/**
 * Updates all LEDs based on a forced state or their individual states.
 * If a forcedState (true for ON, false for OFF) is provided,
 * it overrides the individual states. Otherwise, it uses the global `allLightsOn` state.
 */
void updateAllLeds(bool forcedState) {
    // This overload is for the PIR sensor to force lights ON/OFF
    for (int i = 0; i < numLeds; i++) {
        ledStates[i] = forcedState;
        digitalWrite(ledPins[i], forcedState ? LOW : HIGH); // ACTIVE LOW
    }
}

void updateAllLeds() {
    // This overload is for the physical button toggle
    for (int i = 0; i < numLeds; i++) {
        ledStates[i] = allLightsOn;
        digitalWrite(ledPins[i], allLightsOn ? LOW : HIGH); // ACTIVE LOW
    }
}

/**
 * Interrupt Service Routine for the button.
 * It's kept short and simple, only setting a flag.
 */
void IRAM_ATTR handleButtonInterrupt() {
  buttonPressed = true;
}
