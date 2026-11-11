
#include "MqttManager.h"

#include <WiFi.h>
#include <PubSubClient.h>

#include "AppConfig.h"
#include "IrrigationController.h"


// ============================================================
// MQTT OBJECTS
// ============================================================

static WiFiClient wifiClient;

static PubSubClient mqttClient(
    wifiClient
);


// ============================================================
// LATEST SENSOR DATA
// ============================================================

static float latestTemperature = NAN;
static float latestHumidity = NAN;
static float latestSoil = NAN;

static bool latestPump = false;


// ============================================================
// IRRIGATION POINTER
// ============================================================

static IrrigationController* irrigationController = nullptr;

// Set by a remote command so update() reports the new relay/mode at once
// instead of waiting for the next 2.5 s sensor cycle.
static bool telemetryRequested = false;


// ============================================================
// MQTT CALLBACK
// ============================================================

void mqttCallback(
    char* topic,
    byte* payload,
    unsigned int length
)
{
    String message;

    for (unsigned int i = 0; i < length; i++)
    {
        message += (char)payload[i];
    }

    message.trim();

    Serial.println();
    Serial.println("================================");
    Serial.println("MQTT COMMAND RECEIVED");
    Serial.print("Topic   : ");
    Serial.println(topic);
    Serial.print("Message : ");
    Serial.println(message);
    Serial.println("================================");


    // --------------------------------------------------------
    // PUMP COMMAND
    // --------------------------------------------------------

    if (
        String(topic)
        == MQTT_TOPIC_PUMP_COMMAND
    )
    {
        if (irrigationController == nullptr)
            return;


        // Pump ON
        if (
            message.equalsIgnoreCase("ON")
        )
        {
            irrigationController->manualPump(
                true
            );

            Serial.println(
                "Remote command: PUMP ON"
            );
        }


        // Pump OFF
        else if (
            message.equalsIgnoreCase("OFF")
        )
        {
            irrigationController->manualPump(
                false
            );

            Serial.println(
                "Remote command: PUMP OFF"
            );
        }
    }


    // --------------------------------------------------------
    // MODE COMMAND
    // --------------------------------------------------------

    else if (
        String(topic)
        == MQTT_TOPIC_MODE_COMMAND
    )
    {
        if (irrigationController == nullptr)
            return;


        // AUTO
        if (
            message.equalsIgnoreCase("AUTO")
        )
        {
            irrigationController->setAutoMode(
                true
            );

            Serial.println(
                "Remote command: MODE AUTO"
            );
        }


        // MANUAL
        else if (
            message.equalsIgnoreCase("MANUAL")
        )
        {
            irrigationController->setAutoMode(
                false
            );

            Serial.println(
                "Remote command: MODE MANUAL"
            );
        }
    }

    telemetryRequested = true;
}


// ============================================================
// BEGIN
// ============================================================

void MqttManager::begin(
    IrrigationController* irrigation
)
{
    irrigationController = irrigation;


    Serial.println(
        "MQTT manager initialized."
    );

    Serial.print(
        "MQTT broker: "
    );

    Serial.print(
        MQTT_BROKER
    );

    Serial.print(":");

    Serial.println(
        MQTT_PORT
    );


    mqttClient.setServer(
        MQTT_BROKER,
        MQTT_PORT
    );


    mqttClient.setCallback(
        mqttCallback
    );


    // Prevent long network blocking
    mqttClient.setSocketTimeout(1);

    mqttClient.setKeepAlive(15);

    _lastAttempt = 0;
}


// ============================================================
// UPDATE
// ============================================================

void MqttManager::update()
{
    // --------------------------------------------------------
    // Wi-Fi not available
    // --------------------------------------------------------

    if (
        WiFi.status()
        != WL_CONNECTED
    )
    {
        return;
    }


    // --------------------------------------------------------
    // MQTT already connected
    // --------------------------------------------------------

    if (
        mqttClient.connected()
    )
    {
        mqttClient.loop();

        if (
            telemetryRequested
            && irrigationController != nullptr
        )
        {
            telemetryRequested = false;

            publishTelemetry(
                latestTemperature,
                latestHumidity,
                latestSoil,
                irrigationController->isPumpOn()
            );
        }

        return;
    }


    // --------------------------------------------------------
    // Retry timer
    // --------------------------------------------------------

    unsigned long now = millis();

    if (
        now - _lastAttempt
        < RETRY_INTERVAL
    )
    {
        return;
    }

    _lastAttempt = now;


    Serial.println(
        "MQTT connection attempt..."
    );


    // --------------------------------------------------------
    // CONNECT
    // --------------------------------------------------------

    if (
        mqttClient.connect(
            MQTT_CLIENT_ID
        )
    )
    {
        Serial.println(
            "MQTT connected."
        );


        // ----------------------------------------------------
        // STATUS
        // ----------------------------------------------------

        mqttClient.publish(
            MQTT_TOPIC_STATUS,
            "online",
            true
        );


        // ----------------------------------------------------
        // SUBSCRIBE
        // ----------------------------------------------------

        mqttClient.subscribe(
            MQTT_TOPIC_PUMP_COMMAND
        );

        mqttClient.subscribe(
            MQTT_TOPIC_MODE_COMMAND
        );


        // ----------------------------------------------------
        // Send latest sensor data
        // ----------------------------------------------------

        publishTelemetry(
            latestTemperature,
            latestHumidity,
            latestSoil,
            latestPump
        );
    }

    else
    {
        Serial.println(
            "MQTT unavailable."
        );

        Serial.println(
            "ESP32 continues locally."
        );
    }
}


// ============================================================
// CONNECTION STATUS
// ============================================================

bool MqttManager::isConnected()
{
    return mqttClient.connected();
}


// ============================================================
// TELEMETRY
// ============================================================

void MqttManager::publishTelemetry(
    float temperature,
    float humidity,
    float soilMoisture,
    bool pumpState
)
{
    // --------------------------------------------------------
    // Always keep latest data locally
    // --------------------------------------------------------

    latestTemperature = temperature;
    latestHumidity = humidity;
    latestSoil = soilMoisture;
    latestPump = pumpState;


    // --------------------------------------------------------
    // MQTT unavailable
    // --------------------------------------------------------

    if (
        !mqttClient.connected()
    )
    {
        return;
    }


    char payload[256];


    snprintf(
        payload,
        sizeof(payload),

        "{"
        "\"temperature\":%.2f,"
        "\"humidity\":%.2f,"
        "\"soil\":%.2f,"
        "\"pump\":%s,"
        "\"mode\":\"%s\""
        "}",

        temperature,
        humidity,
        soilMoisture,

        pumpState
            ? "true"
            : "false",

        (irrigationController == nullptr
            || irrigationController->isAutoMode())
            ? "AUTO"
            : "MANUAL"
    );


    mqttClient.publish(
        MQTT_TOPIC_TELEMETRY,
        payload
    );
}


// ============================================================
// PUMP STATE
// ============================================================

// loop() calls this every ~10 ms. Publishing each time floods the broker
// (~100 msg/s), blocks PubSubClient and delays telemetry, so only publish
// when the relay changes, plus a heartbeat so the backend still sees it.
static const unsigned long PUMP_STATE_HEARTBEAT_MS = 5000;
static int lastPublishedPump = -1;          // -1 = force publish
static unsigned long lastPumpPublishAt = 0;

void MqttManager::publishPumpState(
    bool pumpState
)
{
    latestPump = pumpState;


    if (
        !mqttClient.connected()
    )
    {
        lastPublishedPump = -1;             // re-send after reconnect
        return;
    }


    unsigned long now = millis();

    if (
        lastPublishedPump == (pumpState ? 1 : 0)
        && now - lastPumpPublishAt < PUMP_STATE_HEARTBEAT_MS
    )
    {
        return;
    }

    lastPublishedPump = pumpState ? 1 : 0;
    lastPumpPublishAt = now;


    mqttClient.publish(
        MQTT_TOPIC_PUMP_STATE,

        pumpState
            ? "ON"
            : "OFF"
    );
}
