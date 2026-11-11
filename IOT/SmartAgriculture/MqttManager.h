
#ifndef MQTT_MANAGER_H
#define MQTT_MANAGER_H

#include <Arduino.h>

// Forward declaration
class IrrigationController;


// ============================================================
// MQTT MANAGER
// ============================================================

class MqttManager
{
public:

    // --------------------------------------------------------
    // Initialize MQTT
    // --------------------------------------------------------

    void begin(
        IrrigationController* irrigation
    );


    // --------------------------------------------------------
    // MQTT background processing
    // --------------------------------------------------------

    void update();


    // --------------------------------------------------------
    // Connection status
    // --------------------------------------------------------

    bool isConnected();


    // --------------------------------------------------------
    // Publish sensor telemetry
    // --------------------------------------------------------

    void publishTelemetry(
        float temperature,
        float humidity,
        float soilMoisture,
        bool pumpState
    );


    // --------------------------------------------------------
    // Publish pump state
    // --------------------------------------------------------

    void publishPumpState(
        bool pumpState
    );


private:

    // --------------------------------------------------------
    // MQTT retry timer
    // --------------------------------------------------------

    unsigned long _lastAttempt = 0;


    // Retry MQTT every 10 seconds
    static const unsigned long RETRY_INTERVAL = 10000;


    // --------------------------------------------------------
    // Irrigation controller
    // --------------------------------------------------------

    IrrigationController* _irrigation = nullptr;
};

#endif
