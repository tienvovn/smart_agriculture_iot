
#ifndef APP_CONFIG_H
#define APP_CONFIG_H

// ============================================================
// ESP32 SMART AGRICULTURE
// Application Configuration
// ============================================================


// ============================================================
// PIN CONFIGURATION
// ============================================================

#define SOIL_MOISTURE_PIN 5
#define DHT_PIN           4
#define RELAY_PIN         6

// DHT sensor type
// DHT22 = 22
#define DHT_TYPE 22


// ============================================================
// SOIL CALIBRATION
// ============================================================

// ADC value when soil is dry
#define SOIL_DRY 2038

// ADC value when soil is wet
#define SOIL_WET 1090

// Number of ADC samples for averaging
#define ADC_SAMPLES 20


// ============================================================
// RELAY CONFIGURATION
// ============================================================

// true  -> Relay ON when GPIO is HIGH
// false -> Relay ON when GPIO is LOW
#define RELAY_ACTIVE_HIGH true


// ============================================================
// SENSOR INTERVAL
// ============================================================

// Sensor reading interval: 2.5 seconds
#define SENSOR_INTERVAL_MS 2500


// ============================================================
// IRRIGATION CONFIGURATION
// ============================================================

// Soil moisture below this value -> Pump ON
#define SOIL_DRY_THRESHOLD 35.0

// Soil moisture reaches this value -> Pump OFF
#define SOIL_WET_THRESHOLD 75.0

// Temperature above this value -> Pump OFF
#define MAX_SAFE_TEMPERATURE 38.0


// ============================================================
// WIFI CONFIGURATION
// ============================================================

#define WIFI_SSID     "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"


// ============================================================
// MQTT CONFIGURATION
// ============================================================

#define MQTT_BROKER "192.168.1.10"   // LAN IP of the machine running the MQTT broker
#define MQTT_PORT   1883

#define MQTT_CLIENT_ID "ESP32_SMART_GARDEN_01"


// ============================================================
// MQTT TOPICS
// ============================================================

#define MQTT_TOPIC_TELEMETRY \
    "smartgarden/garden01/telemetry"

#define MQTT_TOPIC_PUMP_STATE \
    "smartgarden/garden01/pump/state"

#define MQTT_TOPIC_PUMP_COMMAND \
    "smartgarden/garden01/pump/command"

#define MQTT_TOPIC_MODE_COMMAND \
    "smartgarden/garden01/mode/command"

#define MQTT_TOPIC_STATUS \
    "smartgarden/garden01/status"


// ============================================================
// DEVICE CONFIGURATION
// ============================================================

#define DEVICE_NAME "Garden01"


#endif // APP_CONFIG_H  