/**
 * ENISOLAR Firmware Credentials Template
 * 
 * To securely manage firmware credentials without committing them to git:
 * 1. Copy this file to 'credentials.h'
 * 2. Fill in your WiFi, MQTT, and API credentials below
 * 3. #include "credentials.h" in your ESP32 code
 * 
 * NOTE: 'credentials.h' is ignored by .gitignore to protect your secrets.
 */

#ifndef CREDENTIALS_H
#define CREDENTIALS_H

// WiFi Credentials
#define WIFI_SSID         "YOUR_WIFI_SSID"
#define WIFI_PASSWORD     "YOUR_WIFI_PASSWORD"

// HiveMQ Cloud MQTT Broker
#define MQTT_HOST         "your-cluster-id.s1.eu.hivemq.cloud"
#define MQTT_PORT         8883
#define MQTT_USER         "your_hivemq_username"
#define MQTT_PASS         "your_hivemq_password"

// Backend HTTP URLs
#define BOOT_URL          "http://enisolardienicar.atwebpages.com/esp_boot.php"
#define TELEMETRY_URL     "http://enisolardienicar.atwebpages.com/esp_telemetry.php"
#define SLOT_URL          "http://enisolardienicar.atwebpages.com/esp_slot.php"

#endif // CREDENTIALS_H
