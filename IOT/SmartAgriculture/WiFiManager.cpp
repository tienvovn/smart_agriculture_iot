
#include "WiFiManager.h"

#include <WiFi.h>

#include "AppConfig.h"


// ============================================================
// WIFI MANAGER
// ============================================================

void WiFiManager::begin()
{
    Serial.println();
    Serial.println("================================");
    Serial.println("Wi-Fi initialization");
    Serial.println("================================");

    Serial.println(
        "Wi-Fi starts in background."
    );

    Serial.println(
        "Local system does NOT wait for Wi-Fi."
    );

    Serial.println(
        "Wi-Fi is OPTIONAL."
    );

    Serial.println();


    // --------------------------------------------------------
    // Configure Wi-Fi station mode
    // --------------------------------------------------------

    WiFi.mode(WIFI_STA);


    // --------------------------------------------------------
    // Start Wi-Fi connection
    //
    // IMPORTANT:
    // WiFi.begin() is called but we DO NOT wait here.
    // --------------------------------------------------------

    Serial.print(
        "Connecting to Wi-Fi in background: "
    );

    Serial.println(
        WIFI_SSID
    );

    WiFi.begin(
        WIFI_SSID,
        WIFI_PASSWORD
    );


    _lastAttempt = millis();
}


// ============================================================
// UPDATE
// ============================================================

void WiFiManager::update()
{
    static bool connectedMessagePrinted = false;

    // ========================================================
    // WIFI CONNECTED
    // ========================================================

    if (
        WiFi.status() == WL_CONNECTED
    )
    {
        // ----------------------------------------------------
        // Print connection information only once
        // ----------------------------------------------------

        if (!connectedMessagePrinted)
        {
            Serial.println();
            Serial.println(
                "================================"
            );

            Serial.println(
                "Wi-Fi connected"
            );

            Serial.print(
                "SSID    : "
            );

            Serial.println(
                WiFi.SSID()
            );

            Serial.print(
                "IP      : "
            );

            Serial.println(
                WiFi.localIP()
            );

            Serial.print(
                "Gateway : "
            );

            Serial.println(
                WiFi.gatewayIP()
            );

            Serial.print(
                "Subnet  : "
            );

            Serial.println(
                WiFi.subnetMask()
            );

            Serial.print(
                "DNS     : "
            );

            Serial.println(
                WiFi.dnsIP()
            );

            Serial.print(
                "RSSI    : "
            );

            Serial.print(
                WiFi.RSSI()
            );

            Serial.println(
                " dBm"
            );

            Serial.println(
                "================================"
            );

            connectedMessagePrinted = true;
        }

        // ----------------------------------------------------
        // Nothing else to do while connected
        // ----------------------------------------------------

        return;
    }


    // ========================================================
    // WIFI NOT CONNECTED
    // ========================================================

    // Nếu trước đó đã connected nhưng bây giờ mất Wi-Fi
    // thì cho phép in lại thông tin khi kết nối lại.

    if (connectedMessagePrinted)
    {
        Serial.println();
        Serial.println(
            "Wi-Fi connection lost."
        );

        Serial.println(
            "Local system continues running."
        );

        connectedMessagePrinted = false;
    }


    // ========================================================
    // RETRY TIMER
    // ========================================================

    unsigned long now = millis();

    if (
        now - _lastAttempt
        < RETRY_INTERVAL
    )
    {
        return;
    }


    // --------------------------------------------------------
    // Save retry time
    // --------------------------------------------------------

    _lastAttempt = now;


    // --------------------------------------------------------
    // Retry Wi-Fi
    // --------------------------------------------------------

    Serial.println();
    Serial.println(
        "Wi-Fi reconnect attempt..."
    );

    Serial.println(
        "Local system continues independently."
    );


    // Disconnect old connection state
    WiFi.disconnect(
        false,
        false
    );


    // Start connection again
    WiFi.begin(
        WIFI_SSID,
        WIFI_PASSWORD
    );
}


// ============================================================
// CONNECTION STATUS
// ============================================================

bool WiFiManager::isConnected()
{
    return (
        WiFi.status()
        == WL_CONNECTED
    );
}


// ============================================================
// GET IP ADDRESS
// ============================================================

String WiFiManager::getIP()
{
    if (!isConnected())
    {
        return "0.0.0.0";
    }

    return WiFi.localIP().toString();
}
