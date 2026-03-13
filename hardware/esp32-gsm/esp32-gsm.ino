/*
  ESP32 + SIM800L GSM SMS Gateway
  Receives JSON commands over USB Serial from the browser (Web Serial API).
  Sends SMS via SIM800L AT commands.

  Wiring:
    ESP32 TX2 (GPIO17) -> SIM800L RX
    ESP32 RX2 (GPIO16) -> SIM800L TX
    ESP32 GPIO2         -> Status LED
    SIM800L VCC         -> 3.7-4.2V (use LiPo or buck converter, NOT 3.3V)
    SIM800L GND         -> ESP32 GND
*/

#include <ArduinoJson.h>
#include <HardwareSerial.h>

#define SIM800_TX 17
#define SIM800_RX 16
#define LED_PIN 2
#define SIM800_BAUD 9600
#define USB_BAUD 115200

HardwareSerial sim800(1);

String serialBuffer = "";

// LED states
enum LedState { LED_OFF, LED_BLINK, LED_SOLID };
LedState ledState = LED_OFF;
unsigned long lastBlink = 0;
bool ledOn = false;

void setLed(LedState state) {
  ledState = state;
  if (state == LED_OFF) { digitalWrite(LED_PIN, LOW); ledOn = false; }
  if (state == LED_SOLID) { digitalWrite(LED_PIN, HIGH); ledOn = true; }
}

void updateLed() {
  if (ledState == LED_BLINK && millis() - lastBlink > 500) {
    ledOn = !ledOn;
    digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
    lastBlink = millis();
  }
}

// Send AT command and wait for expected response
String sendAT(const String& cmd, const String& expected, unsigned long timeout) {
  sim800.println(cmd);
  unsigned long start = millis();
  String response = "";
  while (millis() - start < timeout) {
    while (sim800.available()) {
      response += (char)sim800.read();
    }
    if (response.indexOf(expected) >= 0) return response;
  }
  return response;
}

bool initGSM() {
  String r;
  r = sendAT("AT", "OK", 2000);
  if (r.indexOf("OK") < 0) return false;

  sendAT("ATE0", "OK", 1000);           // Disable echo
  sendAT("AT+CMGF=1", "OK", 1000);      // Text mode SMS
  sendAT("AT+CSCS=\"GSM\"", "OK", 1000); // GSM character set

  // Check SIM ready
  r = sendAT("AT+CPIN?", "READY", 3000);
  if (r.indexOf("READY") < 0) return false;

  // Wait for network registration (up to 30s)
  for (int i = 0; i < 15; i++) {
    r = sendAT("AT+CREG?", "+CREG:", 2000);
    if (r.indexOf(",1") >= 0 || r.indexOf(",5") >= 0) return true;
    delay(2000);
  }
  return false;
}

bool sendSMS(const String& phone, const String& message) {
  setLed(LED_SOLID);

  String cmd = "AT+CMGS=\"" + phone + "\"";
  sim800.println(cmd);
  delay(300);

  // Wait for '>' prompt
  unsigned long start = millis();
  bool gotPrompt = false;
  while (millis() - start < 5000) {
    if (sim800.available()) {
      char c = sim800.read();
      if (c == '>') { gotPrompt = true; break; }
    }
  }

  if (!gotPrompt) {
    setLed(LED_OFF);
    return false;
  }

  sim800.print(message);
  sim800.write(0x1A); // Ctrl+Z to send

  // Wait for +CMGS (sent confirmation) or ERROR
  String response = "";
  start = millis();
  while (millis() - start < 30000) {
    while (sim800.available()) {
      response += (char)sim800.read();
    }
    if (response.indexOf("+CMGS:") >= 0) {
      setLed(LED_OFF);
      return true;
    }
    if (response.indexOf("ERROR") >= 0) {
      setLed(LED_OFF);
      return false;
    }
  }

  setLed(LED_OFF);
  return false;
}

void handleCommand(const String& line) {
  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, line);
  if (err) {
    Serial.println("{\"error\":\"invalid json\"}");
    return;
  }

  const char* type = doc["type"];
  if (!type) {
    Serial.println("{\"error\":\"missing type\"}");
    return;
  }

  if (strcmp(type, "ping") == 0) {
    Serial.println("{\"type\":\"pong\"}");
    return;
  }

  if (strcmp(type, "sms") == 0) {
    const char* phone = doc["phone"];
    const char* message = doc["message"];
    if (!phone || !message) {
      Serial.println("{\"error\":\"missing phone or message\"}");
      return;
    }
    bool ok = sendSMS(String(phone), String(message));
    if (ok) {
      Serial.println("{\"type\":\"sms_sent\",\"success\":true}");
    } else {
      Serial.println("{\"type\":\"sms_sent\",\"success\":false,\"error\":\"send failed\"}");
    }
    return;
  }

  Serial.println("{\"error\":\"unknown type\"}");
}

void setup() {
  Serial.begin(USB_BAUD);
  sim800.begin(SIM800_BAUD, SERIAL_8N1, SIM800_RX, SIM800_TX);
  pinMode(LED_PIN, OUTPUT);

  setLed(LED_BLINK);
  Serial.println("{\"type\":\"boot\",\"status\":\"initializing\"}");

  bool gsmReady = initGSM();
  if (gsmReady) {
    Serial.println("{\"type\":\"boot\",\"status\":\"ready\"}");
    setLed(LED_OFF);
  } else {
    Serial.println("{\"type\":\"boot\",\"status\":\"gsm_error\"}");
    // Keep blinking to indicate error
  }
}

void loop() {
  updateLed();

  // Read lines from USB Serial
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      serialBuffer.trim();
      if (serialBuffer.length() > 0) {
        handleCommand(serialBuffer);
      }
      serialBuffer = "";
    } else {
      serialBuffer += c;
    }
  }
}
