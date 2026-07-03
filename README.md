# 🌾 Smart Agriculture IoT Simulation

A Smart Agriculture IoT Dashboard built with **React + Vite** that simulates an intelligent farming system with real-time sensor monitoring, automatic irrigation, MQTT simulation, and weather effects.

---

## Live Demo

https://gia-lap-iot-6ogt-nine.vercel.app/

---

# Features

## 🌡 Real-time Monitoring

- Temperature
- Soil Humidity
- Soil pH
- Pump Status
- MQTT Connection Status

---

## 🚜 Smart Irrigation

Automatic irrigation logic

```
Humidity < 50%

↓

Pump ON

↓

Run for 30 minutes

↓

Pump OFF
```

Manual Mode

- Manual Pump ON
- Manual Pump OFF
- Auto / Manual Switching

---

## 📊 Dashboard

- Farm Overview
- Sensor Cards
- Realtime Charts
- Notification System
- Pump Status

---

## 📈 Statistics

- Pump Count
- Average Temperature
- Average Humidity
- Average Soil pH
- Farm Comparison Charts

---

## 🌦 Weather Simulation

Supported Weather

- ☀ Sunny
- ☁ Cloudy
- 🌧 Rain
- 🌙 Night

Weather automatically affects

- Temperature
- Humidity

---

## 📡 MQTT Simulator

Simulate publishing MQTT messages

Example

Topic

```
farm/pump
```

Payload

```json
{
    "pump": true
}
```

---

## 📱 Responsive UI

- Dashboard
- Statistics
- History
- Simulation
- Settings

---

# Project Structure

```
src
│
├── assets
├── components
│   ├── dashboard
│   ├── farm
│   ├── history
│   ├── simulation
│   ├── statistics
│   ├── layout
│   └── common
│
├── context
├── data
├── hooks
├── pages
├── services
└── utils
```

---

# Technology

- React 19
- Vite
- Tailwind CSS
- React Router
- Recharts
- Framer Motion
- React Icons

---

# Installation

Clone repository

```bash
git clone https://github.com/tienvovn/Gia_lap_IOT.git
```

Install packages

```bash
npm install
```

Run project

```bash
npm run dev
```

Build

```bash
npm run build
```

Preview

```bash
npm run preview
```

---

# Screenshots

## Dashboard

- Real-time Monitoring
- Pump Status
- Sensor Charts

---

## Simulation

- Weather Simulation
- MQTT Simulator
- Demo Mode

---

## Statistics

- Pump Statistics
- Average Sensor Values
- Charts

---

# Future Development

- MQTT Broker (Mosquitto)
- ESP32 Integration
- Firebase Realtime Database
- AI Crop Recommendation
- Camera Monitoring
- Disease Detection
- Mobile Application
- Multi-user Authentication

---

# Author

**Tien Vo**

GitHub

https://github.com/tienvovn

---

# License

MIT License
