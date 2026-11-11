
#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>

class WiFiManager
{
public:

    void begin();

    void update();

    bool isConnected();

    String getIP();

private:

    unsigned long _lastAttempt;

    const unsigned long RETRY_INTERVAL = 10000;
};

#endif