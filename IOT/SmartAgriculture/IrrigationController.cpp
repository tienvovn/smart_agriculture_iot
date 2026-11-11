
#include "IrrigationController.h"

IrrigationController::IrrigationController(
    RelayController& relay
)
    : _relay(relay)
{
    _autoMode = true;
}

void IrrigationController::begin()
{
    _relay.off();
}

void IrrigationController::setAutoMode(bool enabled)
{
    _autoMode = enabled;

    if (!_autoMode)
    {
        _relay.off();
    }
}

bool IrrigationController::isAutoMode()
{
    return _autoMode;
}

void IrrigationController::control(
    float soilMoisture,
    float temperature
)
{
    // --------------------------------------------------------
    // LOCAL CONTROL ONLY
    //
    // Không Wi-Fi
    // Không MQTT
    // Không Tinker Board
    // --------------------------------------------------------

    if (!_autoMode)
        return;

    // Sensor lỗi
    if (isnan(soilMoisture))
    {
        _relay.off();
        return;
    }

    if (isnan(temperature))
    {
        _relay.off();
        return;
    }

    // Safety temperature
    if (temperature > 38.0)
    {
        _relay.off();
        return;
    }

    // Đất khô
    if (soilMoisture < 35.0)
    {
        _relay.on();
    }

    // Đất đủ ẩm
    else if (soilMoisture >= 75.0)
    {
        _relay.off();
    }

    // Khoảng 35-75%
    // giữ nguyên trạng thái pump
}

void IrrigationController::manualPump(bool state)
{
    if (state)
        _relay.on();
    else
        _relay.off();
}

bool IrrigationController::isPumpOn()
{
    return _relay.isOn();
}
