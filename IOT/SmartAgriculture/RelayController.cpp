
#include "RelayController.h"

RelayController::RelayController(
    uint8_t pin,
    bool activeHigh
)
{
    _pin = pin;
    _activeHigh = activeHigh;
    _state = false;
}

void RelayController::begin()
{
    pinMode(_pin, OUTPUT);

    off();
}

void RelayController::on()
{
    if (_activeHigh)
        digitalWrite(_pin, HIGH);
    else
        digitalWrite(_pin, LOW);

    _state = true;
}

void RelayController::off()
{
    if (_activeHigh)
        digitalWrite(_pin, LOW);
    else
        digitalWrite(_pin, HIGH);

    _state = false;
}

bool RelayController::isOn()
{
    return _state;
}
