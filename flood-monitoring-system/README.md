# ESP32 Flood Monitoring System

Complete project based on the requested architecture:

Water Sensors → Ultrasonic Sensor → ESP32 → Wi-Fi → Server → Website

The website supports:
- SAFE / WARNING / CRITICAL status
- LOW / MEDIUM / HIGH sensor indicators
- Ultrasonic distance
- Water-level percentage
- Configurable maximum height and thresholds
- Real-time WebSocket updates
- REST API fallback/test
- Alert history
- Search/filter alerts
- CSV export
- LocalStorage settings/history
- Demo mode
- Responsive mobile dashboard

## Folder structure

```text
flood-monitoring-system/
├── index.html
├── style.css
├── script.js
├── README.md
├── server/
│   ├── server.js
│   └── package.json
└── esp32/
    └── FloodMonitorESP32.ino
```

## 1. Run the server

Install Node.js, then:

```bash
cd server
npm install
npm start
```

The server runs at:

```text
http://localhost:8080
```

## 2. Run the website locally

The simplest option is VS Code + Live Server, or any static HTTP server.

Example:

```bash
python -m http.server 5500
```

Then open:

```text
http://localhost:5500
```

In Settings:
- WebSocket URL: `ws://localhost:8080`
- REST API URL: `http://localhost:8080`

## 3. ESP32 setup

Open:

```text
esp32/FloodMonitorESP32.ino
```

Change:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL = "http://192.168.1.100:8080/api/telemetry";
```

Replace `192.168.1.100` with the LAN IP address of the computer running the Node.js server.

Do not use `localhost` in the ESP32 code because `localhost` would mean the ESP32 itself.

## 4. JSON format

The ESP32 sends:

```json
{
  "lowSensor": false,
  "mediumSensor": true,
  "highSensor": false,
  "distance": 18.5,
  "waterLevel": 53.75,
  "status": "WARNING",
  "wifiConnected": true,
  "timestamp": "123456"
}
```

The server broadcasts this JSON to connected website clients.

## 5. Water-level calculation

The website and ESP32 use:

```text
Water Level % =
((Maximum Height - Distance) / Maximum Height) × 100
```

The result is clamped between 0% and 100%.

Default maximum height:

```text
40 cm
```

Default thresholds:

```text
LOW:     0–39%
MEDIUM: 40–69%
HIGH:   70–100%
```

The thresholds can be changed in Settings.

## 6. Suggested wiring

ESP32:

| Component | ESP32 |
|---|---:|
| Low water sensor | GPIO 32 |
| Medium water sensor | GPIO 33 |
| High water sensor | GPIO 34 |
| Ultrasonic TRIG | GPIO 5 |
| Ultrasonic ECHO | GPIO 18 |
| Piezo + | GPIO 25 |
| OLED SDA | GPIO 21 |
| OLED SCL | GPIO 22 |
| Common GND | GND |

Power the sensors/OLED according to their actual specifications.

### Important ultrasonic warning

If your ultrasonic sensor's ECHO output is 5 V, do not connect it directly to an ESP32 GPIO. Use an appropriate level-shifting/voltage-divider arrangement so the ESP32 input remains within its allowed voltage.

## 7. Sensor logic

The example code assumes the water sensors become LOW when activated:

```cpp
const bool SENSOR_ACTIVE_LOW = true;
```

If your modules become HIGH when activated, change it to:

```cpp
const bool SENSOR_ACTIVE_LOW = false;
```

## 8. GitHub Pages

The frontend files:

```text
index.html
style.css
script.js
```

can be placed in a GitHub Pages repository.

However, GitHub Pages is static. A browser hosted on GitHub Pages generally cannot use an ESP32's private LAN IP from an unrelated network.

For a school/local demonstration, use:

```text
ESP32 → local Node.js server → browser
```

For a remote/public deployment, use a publicly reachable HTTPS/WSS backend or another suitable gateway.

## 9. Troubleshooting

### Website says ESP32 OFFLINE

Check:
1. Node server is running.
2. Website WebSocket URL is correct.
3. Computer firewall allows port 8080.
4. ESP32 and computer are on the same network for a local setup.
5. ESP32 SERVER_URL uses the computer's LAN IP.

### ESP32 connects to Wi-Fi but server gets no data

Check the server IP:

```text
ipconfig
```

on Windows.

Use the computer's IPv4 address, for example:

```text
192.168.1.100
```

Then:

```cpp
const char* SERVER_URL = "http://192.168.1.100:8080/api/telemetry";
```

### Water percentage looks wrong

Verify `MAX_HEIGHT_CM`. If the sensor-to-bottom distance is 40 cm:

```cpp
float MAX_HEIGHT_CM = 40.0;
```

### Water sensor is reversed

Change:

```cpp
const bool SENSOR_ACTIVE_LOW = true;
```

to:

```cpp
const bool SENSOR_ACTIVE_LOW = false;
```

### OLED does not display

Common I2C address:

```text
0x3C
```

Some OLED modules use another address. Verify your module's actual I2C address.

### Data becomes N/A

The system intentionally rejects invalid ultrasonic readings instead of displaying misleading old values.
