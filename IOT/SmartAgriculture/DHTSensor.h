
#ifndef DHT_SENSOR_H
#define DHT_SENSOR_H

#include <Arduino.h>

class DHTSensor
{
public:

    DHTSensor(uint8_t pin, uint8_t type);

    void begin(); 

    float readTemperature();

    float readHumidity();

private:

    uint8_t _pin;
    uint8_t _type;
};

#endif