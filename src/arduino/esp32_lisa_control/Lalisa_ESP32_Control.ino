/*
 * KODE UNTUK ARDUINO MEGA 2560 + BLUETOOTH HC-05
 * ===============================================
 * CATATAN PENTING:
 * 1.  MODUL HC-05: Kode ini menggunakan komunikasi Serial. Hubungkan pin TX dari HC-05
 *     ke pin RX1 (Pin 19) di Arduino Mega, dan pin RX dari HC-05 ke pin TX1 (Pin 18).
 * 2.  KONEKSI LED: LED terhubung antara pin GPIO dan GND (Active HIGH).
 *     Pastikan menggunakan resistor (misal 220 Ohm) untuk setiap LED.
 *     Contoh: Pin 22 -> Resistor -> Kaki panjang LED -> Kaki pendek LED -> GND.
 * 3.  KOMPATIBILITAS APLIKASI: Aplikasi web yang ada saat ini TIDAK AKAN BEKERJA
 *     dengan HC-05. Anda memerlukan aplikasi Android (atau sejenisnya) yang dapat
 *     mengirim data karakter tunggal melalui Bluetooth Serial Port Profile (SPP).
 *
 *     Perintah yang Diterima via Bluetooth:
 *     '1' : Toggle Lampu Ruang Tamu
 *     '2' : Toggle Lampu Kamar Mandi
 *     '3' : Toggle Lampu Ruang Dapur
 *     '4' : Toggle Lampu Teras
 *     'A' : Nyalakan Semua Lampu
 *     'a' : Matikan Semua Lampu
 */

// --- KONFIGURASI PIN ---
const int ledPins[] = {22, 24, 26, 28}; // Pin untuk 4 LED (Ruang Tamu, Kamar Mandi, Dapur, Teras)
const int ledCount = 4;
const int buttonPin = 30; // Pin untuk push button
const int pirPin = 32;    // Pin untuk sensor gerak PIR

// --- VARIABEL GLOBAL ---
bool ledStates[ledCount] = {false, false, false, false}; // Menyimpan status setiap LED (false = OFF)
bool allLightsOn = false; // Menyimpan status untuk tombol 'toggle semua'

// Variabel untuk push button (mencegah bouncing)
int buttonState;
int lastButtonState = HIGH;
unsigned long lastDebounceTime = 0;
unsigned long debounceDelay = 50;

// Variabel untuk sensor gerak (PIR)
bool pirState = false;
unsigned long lastMotionTime = 0;
const unsigned long motionTimeout = 60000; // 1 menit dalam milidetik

void setup() {
  // Inisialisasi Serial untuk debugging di Serial Monitor Arduino IDE
  Serial.begin(9600);
  
  // Inisialisasi Serial1 untuk komunikasi dengan modul HC-05
  // Pastikan baud rate ini sesuai dengan konfigurasi HC-05 Anda (default biasanya 9600)
  Serial1.begin(9600);

  // Inisialisasi pin LED sebagai OUTPUT dan pastikan semua mati saat start
  for (int i = 0; i < ledCount; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW); // LOW untuk mematikan (logika Active HIGH)
  }

  // Inisialisasi pin tombol dan sensor
  pinMode(buttonPin, INPUT_PULLUP); // Menggunakan pull-up internal
  pinMode(pirPin, INPUT);

  Serial.println("Arduino Mega siap menerima perintah via HC-05.");
}

void loop() {
  // 1. Cek perintah dari Bluetooth (HC-05)
  if (Serial1.available() > 0) {
    char command = Serial1.read();
    Serial.print("Perintah diterima: ");
    Serial.println(command);
    
    switch (command) {
      case '1':
        toggleLight(0); // Ruang Tamu
        break;
      case '2':
        toggleLight(1); // Kamar Mandi
        break;
      case '3':
        toggleLight(2); // Ruang Dapur
        break;
      case '4':
        toggleLight(3); // Lampu Teras
        break;
      case 'A': // Perintah custom untuk menyalakan semua
        setAllLights(true);
        break;
      case 'a': // Perintah custom untuk mematikan semua
        setAllLights(false);
        break;
    }
  }

  // 2. Cek status push button
  checkPushButton();

  // 3. Cek status sensor gerak (PIR)
  checkPirSensor();
}

// Fungsi untuk menyalakan/mematikan satu lampu
void toggleLight(int ledIndex) {
  if (ledIndex < 0 || ledIndex >= ledCount) return;
  ledStates[ledIndex] = !ledStates[ledIndex];
  digitalWrite(ledPins[ledIndex], ledStates[ledIndex] ? HIGH : LOW);
  Serial.print("Lampu ");
  Serial.print(ledIndex + 1);
  Serial.println(ledStates[ledIndex] ? " ON" : " OFF");
}

// Fungsi untuk menyalakan/mematikan semua lampu
void setAllLights(bool turnOn) {
  allLightsOn = turnOn;
  for (int i = 0; i < ledCount; i++) {
    ledStates[i] = turnOn;
    digitalWrite(ledPins[i], turnOn ? HIGH : LOW);
  }
  Serial.println(turnOn ? "Semua lampu ON" : "Semua lampu OFF");
}

// Fungsi untuk membaca push button dengan debouncing
void checkPushButton() {
  int reading = digitalRead(buttonPin);

  // Jika ada perubahan state, reset debounce timer
  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  }

  if ((millis() - lastDebounceTime) > debounceDelay) {
    // Jika state tombol sudah stabil
    if (reading != buttonState) {
      buttonState = reading;

      // Jika tombol ditekan (karena pakai PULLUP, state tertekannya adalah LOW)
      if (buttonState == LOW) {
        setAllLights(!allLightsOn);
      }
    }
  }

  lastButtonState = reading;
}

// Fungsi untuk sensor gerak
void checkPirSensor() {
  bool motionDetected = digitalRead(pirPin) == HIGH;

  if (motionDetected) {
    if (!pirState) {
      Serial.println("Gerakan terdeteksi! Menyalakan semua lampu.");
      setAllLights(true);
      pirState = true;
    }
    lastMotionTime = millis(); // Reset timer setiap ada gerakan
  } else {
    if (pirState && (millis() - lastMotionTime > motionTimeout)) {
      Serial.println("Tidak ada gerakan selama 1 menit. Mematikan semua lampu.");
      setAllLights(false);
      pirState = false;
    }
  }
}
