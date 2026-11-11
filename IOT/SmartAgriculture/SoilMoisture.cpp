
#include "SoilMoisture.h"

SoilMoisture::SoilMoisture(
    uint8_t pin,
    int dryValue,
    int wetValue,
    int samples
)
{
    _pin = pin;
    _dryValue = dryValue;
    _wetValue = wetValue;
    _samples = samples;
}

void SoilMoisture::begin()
{
    pinMode(_pin, INPUT);

    analogReadResolution(12);

    analogSetPinAttenuation(
        _pin,
        ADC_11db
    );
}

int SoilMoisture::readRaw()
{
    long total = 0;

    for (int i = 0; i < _samples; i++)
    {
        total += analogRead(_pin);

        delay(2);
    }

    return total / _samples;
}

float SoilMoisture::readPercent()
{
    int raw = readRaw();

    float percent = map(
        raw,
        _dryValue,
        _wetValue,
        0,
        100
    );

    percent = constrain(
        percent,
        0,
        100
    );

    return percent;
}
