
#include "DHTSensor.h"
#include <DHT.h>

static DHT* dhtSensor = nullptr;

DHTSensor::DHTSensor(uint8_t pin, uint8_t type)
{
    _pin = pin;
    _type = type;
}

void DHTSensor::begin()
{
    dhtSensor = new DHT(_pin, _type);
    dhtSensor->begin();
}

float DHTSensor::readTemperature()
{
    if (dhtSensor == nullptr)
        return NAN;

    return dhtSensor->readTemperature();
}

float DHTSensor::readHumidity()
{
    if (dhtSensor == nullptr)
        return NAN;

    return dhtSensor->readHumidity();
}
