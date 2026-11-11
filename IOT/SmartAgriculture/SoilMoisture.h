
#ifndef SOIL_MOISTURE_H
#define SOIL_MOISTURE_H

#include <Arduino.h>

class SoilMoisture
{
public:

    SoilMoisture(
        uint8_t pin,
        int dryValue,
        int wetValue,
        int samples
    );

    void begin();

    int readRaw();

    float readPercent();

private:

    uint8_t _pin;

    int _dryValue;
    int _wetValue;
    int _samples;
};

#endif
