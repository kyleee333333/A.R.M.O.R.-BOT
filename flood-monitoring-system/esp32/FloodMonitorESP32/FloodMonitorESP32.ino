/*
  ESP32 FLOOD MONITORING SYSTEM

  Hardware:
    Sensor 1 = LOW
    Sensor 2 = MEDIUM
    Sensor 3 = HIGH
    Ultrasonic = water distance
    OLED = 128x64 I2C
    Piezo = alert buzzer

  Libraries:
    WiFi (ESP32 core)
    HTTPClient (ESP32 core)
    Wire (ESP32 core)
    Adafruit_GFX
    Adafruit_SSD1306
    ArduinoJson

  This version sends telemetry to the Node.js REST gateway.
  The gateway broadcasts it to the website over WebSocket.

  IMPORTANT:
  Adjust the GPIO pins and sensor logic for your exact hardware.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
  #include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>

// ---------- Wi-Fi ----------
const char* WIFI_SSID = "POCO C65";
const char* WIFI_PASSWORD = "anaoj_09";

// Use the computer/server IP, NOT localhost, when the server runs on your PC.
// Example: http://192.168.1.100:8080
const char* SERVER_URL = "http://10.33.99.191:3000/api/telemetry";

// ---------- Pins ----------
const int LOW_SENSOR_PIN    = 32;
const int MEDIUM_SENSOR_PIN = 33;
const int HIGH_SENSOR_PIN   = 34;

const int TRIG_PIN  = 5;
const int ECHO_PIN  = 18;

const int BUZZER_PIN = 25;

// OLED I2C
const int OLED_SDA = 21;
const int OLED_SCL = 22;
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ---------- Settings ----------
float MAX_HEIGHT_CM = 40.0;

float LOW_THRESHOLD_PERCENT = 0.0;
float MEDIUM_THRESHOLD_PERCENT = 40.0;
float HIGH_THRESHOLD_PERCENT = 70.0;

const unsigned long SEND_INTERVAL_MS = 1000;
const unsigned long WIFI_RETRY_MS = 5000;

unsigned long lastSend = 0;
unsigned long lastWiFiAttempt = 0;

bool lastCritical = false;
bool lastWarning = false;

// Set true if your water sensors output LOW when water is detected.
// Set false if they output HIGH when water is detected.
const bool SENSOR_ACTIVE_LOW = true;

bool sensorActive(int pin) {
  int value = digitalRead(pin);
  return SENSOR_ACTIVE_LOW ? (value == LOW) : (value == HIGH);
}

float readDistanceCM() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(3);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000UL);

  if (duration == 0) {
    return -1.0;
  }

  float distance = duration * 0.0343 / 2.0;

  if (!isfinite(distance) || distance < 0) {
    return -1.0;
  }

  return distance;
}

float calculateWaterLevel(float distance) {
  if (distance < 0) return -1.0;

  float percentage =
    ((MAX_HEIGHT_CM - distance) / MAX_HEIGHT_CM) * 100.0;

  return constrain(percentage, 0.0, 100.0);
}

String determineStatus(bool lowSensor, bool mediumSensor, bool highSensor, float level) {
  if (highSensor || (level >= HIGH_THRESHOLD_PERCENT && level >= 0)) {
    return "CRITICAL";
  }

  if (mediumSensor || (level >= MEDIUM_THRESHOLD_PERCENT && level >= 0)) {
    return "WARNING";
  }

  return "SAFE";
}

void showOLED(bool lowSensor, bool mediumSensor, bool highSensor,
              float distance, float level, String status) {

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("FLOOD MONITOR");

  display.setCursor(0, 12);
  display.print("Status: ");
  display.println(status);

  display.setCursor(0, 25);
  display.print("Level: ");
  if (level < 0) display.println("N/A");
  else {
    display.print(level, 1);
    display.println("%");
  }

  display.setCursor(0, 37);
  display.print("Distance: ");
  if (distance < 0) display.println("N/A");
  else {
    display.print(distance, 1);
    display.println(" cm");
  }

  display.setCursor(0, 50);
  display.print("L:");
  display.print(lowSensor ? "ON " : "OFF");
  display.print(" M:");
  display.print(mediumSensor ? "ON " : "OFF");
  display.print(" H:");
  display.print(highSensor ? "ON" : "OFF");

  display.display();
}

void updateBuzzer(String status) {
  if (status == "CRITICAL") {
    // Repeating critical tone.
    tone(BUZZER_PIN, 2200, 180);
  } else if (status == "WARNING") {
    tone(BUZZER_PIN, 1200, 100);
  } else {
    noTone(BUZZER_PIN);
  }
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if (now - lastWiFiAttempt < WIFI_RETRY_MS) return;
  lastWiFiAttempt = now;

  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void sendTelemetry(bool lowSensor, bool mediumSensor, bool highSensor,
                  float distance, float level, String status) {

  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(2500);

  StaticJsonDocument<512> doc;

  doc["lowSensor"] = lowSensor;
  doc["mediumSensor"] = mediumSensor;
  doc["highSensor"] = highSensor;

  if (distance >= 0) doc["distance"] = distance;
  else doc["distance"] = nullptr;

  if (level >= 0) doc["waterLevel"] = level;
  else doc["waterLevel"] = nullptr;

  doc["status"] = status;
  doc["wifiConnected"] = true;
  doc["timestamp"] = String((unsigned long)millis());

  String payload;
  serializeJson(doc, payload);

  int code = http.POST(payload);

  Serial.print("HTTP POST: ");
  Serial.println(code);

  http.end();
}

void setup() {
  Serial.begin(115200);

  pinMode(LOW_SENSOR_PIN, INPUT);
  pinMode(MEDIUM_SENSOR_PIN, INPUT);
  pinMode(HIGH_SENSOR_PIN, INPUT);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  pinMode(BUZZER_PIN, OUTPUT);
  noTone(BUZZER_PIN);

  Wire.begin(OLED_SDA, OLED_SCL);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED not found.");
  } else {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("FLOOD MONITOR");
    display.println("Starting...");
    display.display();
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  connectWiFi();
}

void loop() {
  connectWiFi();

  bool lowSensor = sensorActive(LOW_SENSOR_PIN);
  bool mediumSensor = sensorActive(MEDIUM_SENSOR_PIN);
  bool highSensor = sensorActive(HIGH_SENSOR_PIN);

  float distance = readDistanceCM();
  float level = calculateWaterLevel(distance);

  String status = determineStatus(
    lowSensor,
    mediumSensor,
    highSensor,
    level
  );

  showOLED(
    lowSensor,
    mediumSensor,
    highSensor,
    distance,
    level,
    status
  );

  updateBuzzer(status);

  if (millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();

    sendTelemetry(
      lowSensor,
      mediumSensor,
      highSensor,
      distance,
      level,
      status
    );
  }

  delay(50);
}