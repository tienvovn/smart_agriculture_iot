
#ifndef RELAY_CONTROLLER_H
#define RELAY_CONTROLLER_H

#include <Arduino.h>

class RelayController
{
public:

    RelayController(
        uint8_t pin,
        bool activeHigh
    );

    void begin();

    void on();

    void off();

    bool isOn();

private:

    uint8_t _pin;
    bool _activeHigh;
    bool _state;
};

#endif
