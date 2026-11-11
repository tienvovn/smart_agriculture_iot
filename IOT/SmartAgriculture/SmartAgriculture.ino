#include <Arduino.h>

#include "AppConfig.h"
#include "DHTSensor.h"
#include "SoilMoisture.h"
#include "RelayController.h"
#include "IrrigationController.h"
#include "WiFiManager.h"
#include "MqttManager.h"

// ============================================================
// ESP32 SMART AGRICULTURE
// Main Application
// ============================================================

// ---------------- OBJECTS ----------------

DHTSensor dht(DHT_PIN, DHT_TYPE);

SoilMoisture soil(
    SOIL_MOISTURE_PIN,
    SOIL_DRY,
    SOIL_WET,
    ADC_SAMPLES
);

RelayController relay(
    RELAY_PIN,
    RELAY_ACTIVE_HIGH
);

IrrigationController irrigation(relay);

WiFiManager wifi;
MqttManager mqtt;

// ---------------- SENSOR DATA ----------------

unsigned long lastSensorRead = 0;

float temperature = 0.0;
float humidity = 0.0;
float soilMoisture = 0.0;


// ============================================================
// SETUP
// ============================================================

void setup()
{
    Serial.begin(115200);

    delay(1000);

    Serial.println();
    Serial.println("========================================");
    Serial.println("       ESP32 SMART AGRICULTURE");
    Serial.println("========================================");

    // ---------------- LOCAL HARDWARE ----------------

    Serial.println("[SYSTEM] Initializing DHT22...");
    dht.begin();

    Serial.println("[SYSTEM] Initializing soil sensor...");
    soil.begin();

    Serial.println("[SYSTEM] Initializing relay...");
    relay.begin();

    Serial.println("[SYSTEM] Initializing irrigation controller...");
    irrigation.begin();

    // AUTO mode is handled locally by ESP32
    irrigation.setAutoMode(true);

    // ---------------- NETWORK ----------------

    Serial.println("[WIFI] Starting WiFi...");
    wifi.begin();

    Serial.println("[MQTT] Starting MQTT manager...");
    mqtt.begin(&irrigation);

    Serial.println();
    Serial.println("[SYSTEM] SYSTEM READY");
    Serial.println("[SYSTEM] Local sensor + irrigation control are independent");
    Serial.println("[SYSTEM] WiFi/MQTT are optional");
    Serial.println();
}


// ============================================================
// LOOP
// ============================================================

void loop()
{
    unsigned long now = millis();

    // ========================================================
    // 1. READ SENSORS
    // ========================================================

    if (now - lastSensorRead >= SENSOR_INTERVAL_MS)
    {
        lastSensorRead = now;

        // Read DHT22
        temperature = dht.readTemperature();
        humidity = dht.readHumidity();

        // Read capacitive soil moisture sensor
        soilMoisture = soil.readPercent();


        // ====================================================
        // SERIAL MONITOR
        // ====================================================

        Serial.println();
        Serial.println("----------------------------------------");

        Serial.print("Temperature : ");
        Serial.print(temperature, 1);
        Serial.println(" °C");

        Serial.print("Humidity    : ");
        Serial.print(humidity, 1);
        Serial.println(" %");

        Serial.print("Soil        : ");
        Serial.print(soilMoisture, 1);
        Serial.println(" %");

        Serial.print("Pump        : ");

        Serial.println(
            irrigation.isPumpOn()
                ? "ON"
                : "OFF"
        );

        Serial.println("----------------------------------------");


        // ====================================================
        // LOCAL IRRIGATION CONTROL
        // ====================================================
        //
        // AUTO irrigation runs locally on ESP32.
        // It does NOT depend on WiFi/MQTT/Tinker.
        //

        irrigation.control(
            soilMoisture,
            temperature
        );


        // ====================================================
        // MQTT TELEMETRY
        // ====================================================
        //
        // If MQTT is connected -> publish.
        // If MQTT is disconnected -> ignored.
        //

        mqtt.publishTelemetry(
            temperature,
            humidity,
            soilMoisture,
            irrigation.isPumpOn()
        );
    }


    // ========================================================
    // 2. WIFI BACKGROUND UPDATE
    // ========================================================
    //
    // Handles WiFi connection/reconnection.
    // Does not control local irrigation.
    //

    wifi.update();


    // ========================================================
    // 3. MQTT BACKGROUND UPDATE
    // ========================================================
    //
    // Handles MQTT connection/reconnection
    // and incoming commands.
    //

    mqtt.update();


    // ========================================================
    // 4. PUBLISH PUMP STATE
    // ========================================================

    mqtt.publishPumpState(
        irrigation.isPumpOn()
    );


    // ========================================================
    // 5. SMALL LOOP DELAY
    // ========================================================

    delay(10);
}