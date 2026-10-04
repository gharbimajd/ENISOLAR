# ☀️ ENISOLAR — Autonomous Solar Panel Drone Inspection System

[![Angular](https://img.shields.io/badge/Angular-20.0-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.dev/)
[![Ionic](https://img.shields.io/badge/Ionic_Framework-8.0-3880FF?style=for-the-badge&logo=ionic&logoColor=white)](https://ionicframework.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-7.4-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![ESP32](https://img.shields.io/badge/ESP32-Dual--Core_Xtensa-E7352C?style=for-the-badge&logo=espressif&logoColor=white)](https://www.espressif.com/)
[![MQTT](https://img.shields.io/badge/MQTT-HiveMQ_Cloud-F37021?style=for-the-badge&logo=mqtt&logoColor=white)](https://www.hivemq.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

**ENISOLAR** is a comprehensive, cyber-physical platform designed for automated aerial thermography and inspection of photovoltaic (PV) solar farms. The system integrates a cross-platform mobile Ground Control Station (GCS) built with **Ionic 8**, **Angular 20**, and **Capacitor 7** alongside a distributed **3-Node ESP32 Avionics Architecture** running real-time flight control, GPS navigation, mission buffer management, and payload camera synchronization.

---

## 📑 Table of Contents

- [System Architecture](#-system-architecture)
  - [Distributed 3-Node Hardware Breakdown](#distributed-3-node-hardware-breakdown)
  - [5-Buffer Memory Architecture](#5-buffer-memory-architecture)
  - [UART Packet Communication Protocol](#uart-packet-communication-protocol)
- [Key Features](#-key-features)
- [Project Directory Structure](#-project-directory-structure)
- [Security & Credentials Management](#-security--credentials-management)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Running the Mobile Ground Control Station](#running-the-mobile-ground-control-station)
  - [Building for Android](#building-for-android)
  - [Flashing the ESP32 Firmware](#flashing-the-esp32-firmware)
- [Git & Repository Guidelines](#-git--repository-guidelines)
- [Authors & Acknowledgments](#-authors--acknowledgments)

---

## 🛰️ System Architecture

ENISOLAR adopts a decoupled, distributed flight controller and mission execution model. High-level networking and logic are separated from critical motor control and sensor loops to ensure fail-safe operation.

```
                    ┌────────────────────────────────────────┐
                    │      ENISOLAR Mobile GCS (Ionic/NG)    │
                    │  - Mission Planner & Polygon Grids     │
                    │  - Live Telemetry & Control Cockpit    │
                    │  - BLE Hardware Config & WiFi Setup    │
                    └───────────┬────────────────┬───────────┘
                                │ BLE            │ MQTT (WSS / TLS)
                                │ (Provisioning) │ (HiveMQ Cloud)
                                ▼                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        MASTER ESP32-WROOM                              │
│                    (Mission & Communications Controller)                │
│                                                                        │
│   • WiFi & Secure MQTT Client       • SPI MicroSD Mission Sync         │
│   • BLE Provisioning Server         • HTTP Boot & Telemetry Fallback   │
│   • 5-Buffer State Machine Manager  • Camera Interval Triggering       │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │ UART2 (115200 Baud)            │ UART (Trigger)
                    │ 12-byte framed packets         │ 
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│         SLAVE ESP32-WROOM            │  │          ESP32-CAM           │
│         (Flight Controller)          │  │       (Inspection Node)      │
│                                      │  │                              │
│  • Core 1: High-rate PID loop        │  │  • OV2640 Image Sensor       │
│  • Core 0: Navigation & NMEA GPS     │  │  • Dedicated MicroSD Storage │
│  • NEO-6M GPS over UART1 (GPIO26/27) │  │  • Hardware Trigger on ACK   │
│  • 4x ESC Motors via MCPWM           │  │  • High-Res Solar Panel Phot.│
└──────────────────────────────────────┘  └──────────────────────────────┘
```

### Distributed 3-Node Hardware Breakdown

1. **Master ESP32-WROOM (Mission Controller)**:
   - Central decision-maker and gateway.
   - Interfaces with the mobile app via **BLE** during initial setup, then transitions to **WiFi / HiveMQ Cloud MQTT** for flight operations.
   - Reads missions from onboard **SPI SD Card**, feeds waypoint coordinates sequentially to the flight controller, and triggers the camera node.
2. **Slave ESP32-WROOM (Flight Controller & Navigation)**:
   - Dedicated navigation and flight stability node.
   - Reads **NEO-6M GPS** via UART1 (GPIO26/27) with non-blocking NMEA sentence parsing.
   - Calculates speed, heading, and dead-reckoning telemetry, sending 24-byte telemetry packets back to the master.
   - Completely decoupled from cloud networking to guarantee deterministic flight dynamics.
3. **ESP32-CAM (Optical / Thermal Inspection Payload)**:
   - Passive shooter triggered via UART command packets.
   - Stores captured high-resolution solar panel imagery onto its local SD card for post-mission defect detection and analysis.

---

### 5-Buffer Memory Architecture

The Master ESP32 acts as the single source of truth, managing five distinct hardware memory buffers:

| Buffer | Name | Contents | Ownership / Distribution |
| :--- | :--- | :--- | :--- |
| **Buffer 1** | Target Waypoint | Latitude, Longitude, Altitude | Owned by Master, cloned to Slave FC |
| **Buffer 2** | Home Position | First GPS 3D fix (Lat, Lng, Alt) | Locked by Master on boot for failsafe RTH |
| **Buffer 3** | Mission State | Mode (Matrix/Polygon), Point Index, Total Points | Cloned to Slave FC and Camera |
| **Buffer 4** | Telemetry Stream | Lat, Lng, Alt, Speed, Heading, Battery %, RF Signal | Gathered from Slave, published to MQTT/HTTP |
| **Buffer 5** | Camera Trigger | Trigger flag, interval (ms), image sequence number | Cloned to ESP32-CAM node |

---

### UART Packet Communication Protocol

#### Master ➔ Slave (12 Bytes Fixed Packet)
```
[0xAA (START)] [CMD (1B)] [LAT (4B Float)] [LNG (4B Float)] [ALT (1B Uint)] [CHECKSUM (1B)]
```
- `CMD_WAYPOINT (0x01)`: Dispatch next waypoint coordinates.
- `CMD_RTH (0x02)`: Command drone to return to Home location stored in Buffer 2.
- `CMD_LAND (0x03)`: Execute immediate controlled landing.
- `CMD_ABORT (0x04)`: Immediate flight termination.

#### Slave ➔ Master Responses
- `RESP_NEXT_REQ (0x06)`: Waypoint reached; requesting next target point.
- `RESP_HOME_POINT (0x07)`: Initial GPS lock confirmed; payload carries home coordinates.
- `RESP_ARRIVED_HOME (0x08)`: Return-To-Home sequence complete.
- `RESP_LANDED (0x09)`: Drone touched down safely.
- `RESP_TELEMETRY (0x0A)`: 24-byte live telemetry packet.
- `RESP_NACK (0x15)`: Command rejected / invalid state.

---

## ✨ Key Features

- 🛰️ **Interactive Mission Planner (`aux-map-planner` / `manage-missions`)**:
  - Solar array polygon selection and automatic grid waypoint path generation.
  - Native **KML import** support (`test-solaire.kml`) for existing solar farm geo-fences.
- 🎮 **Real-Time Control Cockpit (`cockpit`)**:
  - Mapbox GL & Leaflet interactive satellite map showing live drone position, heading arrow, and breadcrumb path.
  - Real-time flight instruments: Altitude gauge, Ground Speed, Heading, Battery status, Satellite count, and Signal strength.
  - Quick action controls: Arm, Launch Mission, Return To Home (RTH), and Emergency Land.
- 📡 **HiveMQ Cloud MQTT Integration (`Mqtt.service.ts`)**:
  - Secure TLS WebSocket connection (`wss://`) for zero-latency bidirectional drone telemetry and telemetry broadcasting.
- 📶 **BLE & In-App WiFi Setup (`wifi-setup` / `link-drone`)**:
  - Scan and pair with ESP32 drones nearby via Bluetooth Low Energy.
  - Dynamically configure field WiFi credentials without reflashing firmware.
- 💾 **MicroSD & Buffer Manager (`sd-manager` / `slot-assign`)**:
  - Browse, upload, and inspect mission files stored on the drone's SD card.
  - Multi-mission queue slot allocation for large-scale solar farms.
- 🛠️ **Admin & Hardware Diagnostic Cockpit (`admin-cockpit`)**:
  - Low-level telemetry debugging, UART packet tracing, manual command overrides, and simulation monitoring.

---

## 📂 Project Directory Structure

```
ENISOLAR/
├── android/                   # Capacitor native Android platform project
├── docs/                      # Technical documentation, architecture diagrams & PDFs
│   ├── docu/                  # Hardware architecture, UART vs ESP-NOW studies
│   └── test-solaire.kml       # Sample solar farm polygon KML file
├── resources/                 # Application icons and splash screen assets
├── src/
│   ├── app/
│   │   ├── admin-cockpit/     # Diagnostic cockpit for hardware & telemetry debugging
│   │   ├── aux-map-planner/   # Solar panel polygon path & survey planner
│   │   ├── cockpit/           # Ground control station cockpit with live map
│   │   ├── drone-detail/      # Drone status, battery, telemetry, and link controls
│   │   ├── drone-manager/     # Drone fleet management & status
│   │   ├── link-drone/        # BLE scanner and hardware pairing
│   │   ├── sd-manager/        # SD card mission file synchronization
│   │   ├── services/          # Angular injectable services (Mqtt, BLE, Telemetry, Auth)
│   │   ├── wifi-setup/        # BLE-based field WiFi credential configuration
│   │   ├── masterespwithgps.txt # Master ESP32 production firmware source
│   │   ├── slaveespwithgps.txt  # Slave ESP32 flight controller & GPS firmware source
│   │   └── espmasterfakegps.txt # Simulation / test firmware with GPS mocking
│   ├── environments/          # Application environment configs (local, dev, prod)
│   ├── main.ts                # Application bootstrap & global MQTT provider setup
│   └── index.html             # Application HTML shell
├── .env.example               # Template for environment variables (API, MQTT, Mapbox)
├── .gitignore                 # Comprehensive security and build exclusion rules
├── capacitor.config.ts        # Capacitor configuration
├── credentials.example.h      # Template for ESP32 firmware credentials
├── db_config.example.php      # Template for backend database credentials
├── package.json               # Node.js dependencies & build scripts
└── send_reset_code.php        # Password reset backend endpoint
```

---

## 🔒 Security & Credentials Management

To ensure safety when collaborating on public or private Git repositories, sensitive credentials must **never** be checked into version control.

### Protected Files (`.gitignore`)
The project `.gitignore` automatically blocks:
- `.env`, `.env.*` (Environment secrets)
- `db_config.php`, `config.php`, `config.local.php` (Database credentials)
- `credentials.h` (Hardware WiFi and MQTT secrets)
- `*.pem`, `*.key`, `*.cert`, `*.pfx` (SSL/TLS certificates)
- `*.jks`, `*.keystore` (Android app release signing keys)
- `google-services.json` (Firebase / Cloud services configuration)
- `src/environments/environment.local.ts` (Local developer overrides)

### Template Files
Always copy the provided templates when configuring your local environment:

| Template File | Target File | Purpose |
| :--- | :--- | :--- |
| `.env.example` | `.env` | Ground Control Station API and HiveMQ credentials |
| `db_config.example.php` | `db_config.php` | Backend PHP MySQL database connection |
| `credentials.example.h` | `credentials.h` | ESP32 WiFi SSID, HiveMQ TLS credentials |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v18.x` or `v20.x` (LTS recommended)
- **npm**: `v9.x` or higher
- **Angular CLI**: `npm install -g @angular/cli`
- **Ionic CLI**: `npm install -g @ionic/cli`
- **Android Studio** (Optional, for building native Android APKs)
- **Arduino IDE** or **PlatformIO / ESP-IDF** (for ESP32 firmware)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/gharbimajd/ENISOLAR.git
   cd ENISOLAR
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Configuration

1. Create your local `.env` and `db_config.php` from the templates:
   ```bash
   cp .env.example .env
   cp db_config.example.php db_config.php
   ```

2. Update `src/environments/environment.ts` with your HiveMQ Cloud broker credentials and backend API URL:
   ```typescript
   export const environment = {
     production: false,
     apiUrl: 'http://your-backend-api.com/',
     mqtt: {
       hostname: 'your-cluster.s1.eu.hivemq.cloud',
       port: 8884,
       path: '/mqtt',
       protocol: 'wss',
       username: 'your_username',
       password: 'your_password'
     }
   };
   ```

### Running the Mobile Ground Control Station

Start the local development server with hot-reload:
```bash
npm start
# or
ionic serve
```
Open your browser at `http://localhost:8100/`.

### Building for Android

1. Build the production Angular bundle:
   ```bash
   npm run build
   ```

2. Synchronize web assets with the Capacitor Android project:
   ```bash
   npx cap sync android
   ```

3. Open the project in Android Studio to build or deploy to a device:
   ```bash
   npx cap open android
   ```

---

### Flashing the ESP32 Firmware

1. Open the Arduino IDE or PlatformIO.
2. Install required libraries:
   - `PubSubClient` (Nick O'Leary)
   - `ArduinoJson` (v6 or v7)
   - `WiFiClientSecure`
   - `Preferences`, `SD`, `FS`, `BLEDevice`
3. Copy `credentials.example.h` to `credentials.h` and configure your WiFi and HiveMQ credentials.
4. **Master ESP32**:
   - Open and compile `src/app/masterespwithgps.txt`.
   - Set partition scheme to `Default 4MB with SPIFFS` or `Huge APP (3MB No OTA/1MB SPIFFS)`.
   - Flash to Master ESP32 board.
5. **Slave ESP32 (Flight Controller)**:
   - Open and compile `src/app/slaveespwithgps.txt`.
   - Connect NEO-6M GPS to `GPIO26 (RX)` and `GPIO27 (TX)`.
   - Connect Master-Slave UART link (`GPIO16/17` crossed).
   - Flash to Slave ESP32 board.

---

## 🛠️ Git & Repository Guidelines

- Keep all credentials, keys, and private configuration files out of commits.
- Follow conventional commits where possible (`feat:`, `fix:`, `docs:`, `refactor:`).
- Always verify builds before pushing:
  ```bash
  npm run build
  ```

---

## 👥 Authors & Acknowledgments

- **Majd Gharbi** — Project Lead, Architecture & Full-Stack / Embedded Development
- **ENISOLAR Team** — Solar Farm Aerial Thermography & Robotics Research

---

*Developed with ❤️ for clean renewable energy inspection and smart robotics.*
