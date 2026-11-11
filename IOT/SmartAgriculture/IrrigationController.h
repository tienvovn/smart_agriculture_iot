
#ifndef IRRIGATION_CONTROLLER_H
#define IRRIGATION_CONTROLLER_H

#include <Arduino.h>
#include "RelayController.h"

class IrrigationController
{
public:

    IrrigationController(
        RelayController& relay
    );

    void begin();

    void setAutoMode(bool enabled);

    bool isAutoMode();

    void control(
        float soilMoisture,
        float temperature
    );

    void manualPump(bool state);

    bool isPumpOn();

private:

    RelayController& _relay;

    bool _autoMode;
};

#endif
