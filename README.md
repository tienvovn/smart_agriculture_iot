# FarmGuard — Irrigation Outcome Assurance

**Hackathon MVP:** a pump command can receive a successful controller ACK while
the motor draws 0 A and soil moisture keeps falling. FarmGuard detects this
silent failure from MongoDB telemetry, opens an incident, and proves the repair
with measured current and rising moisture.

- **Primary demo:** `/simulation` → inject silent pump failure → `/incidents` →
  restore pump power → issue a new repair command → inspect MongoDB evidence.
- **MongoDB:** time series telemetry, command lineage, incidents, and aggregation
  for detection and recovery proof. `/statistics` slices readings by day, month,
  or year across hot raw, warm daily, and cold monthly collections. The Leafy
  inspired pipeline adds optional MQTT ingestion, a regular collection watched
  by Change Streams, and rolling statistical anomaly evidence.
- **Datadog:** structured logs, DogStatsD metrics, optional APM tracing, plus a
  dashboard and monitor provisioning script. A Datadog trial and API keys are
  required to activate the remote resources.
- **Run locally:** [MVP runbook](docs/MVP_RUNBOOK.md). The published link below
  reflects the earlier general platform and is not the current incident demo.

---

# 🌾 Smart Agriculture IoT Platform
![React](https://img.shields.io/badge/React-19-blue)
![Express](https://img.shields.io/badge/Express-5-green)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-success)
![Swagger](https://img.shields.io/badge/API-Swagger-brightgreen)
![Docker](https://img.shields.io/badge/Docker-Enabled-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

A complete **Full Stack Smart Agriculture IoT Platform** built with **React + Vite**, **Express.js**, **MongoDB**, and **Docker**.

The system simulates an intelligent farming environment capable of monitoring environmental sensors, controlling irrigation automatically, managing historical sensor data, and exposing REST APIs with Swagger documentation.

---

# 🌐 Live Demo

Frontend

https://gia-lap-iot-6ogt-nine.vercel.app/

GitHub Repository

https://github.com/tienvovn/Gia_lap_IOT

---

# 📷 System Architecture

```
               Smart Farm A
          ┌──────────────────┐
          │ Temperature       │
          │ Humidity          │
          │ Soil pH           │
          │ Water Pump        │
          │ ESP32             │
          └────────┬──────────┘
                   │
                   │ WiFi
                   ▼
             MQTT Broker
                   │
                   ▼
           Express Backend
                   │
           REST API / Swagger
                   │
                   ▼
              MongoDB
                   │
                   ▼
          React Dashboard
                   │
                   ▼
              Administrator
```

---

# 🚀 Features

## 🌡 Real-time Monitoring

- Air Temperature
- Soil Humidity
- Soil pH
- Pump Status
- MQTT Status
- Farm Status

---

## 🚜 Smart Irrigation

Automatic irrigation

```
Humidity < 50%

↓

Pump ON

↓

Run 30 minutes

↓

Pump OFF
```

Manual Control

- Manual ON/OFF
- Auto Mode
- Manual Mode

---

## 📊 Dashboard

- Real-time Sensor Cards
- Farm Overview
- Live Charts
- Notifications
- Pump Status

---

## 📈 Statistics

- Pump Usage
- Average Temperature
- Average Humidity
- Average Soil pH
- Farm Comparison
- Charts

---

## 🌦 Weather Simulation

Supported

- ☀ Sunny
- ☁ Cloudy
- 🌧 Rain
- 🌙 Night

Weather automatically changes

- Temperature
- Humidity

---

## 📡 MQTT Simulation

Publish MQTT messages

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

## 📚 Backend REST API

Implemented using

- Express.js
- MongoDB
- Mongoose

Features

- CRUD APIs
- Pagination
- Filtering
- Sorting
- Searching
- Validation
- Centralized Error Handling
- Analytics APIs

---

## 📖 Swagger Documentation

Interactive API Documentation

```
http://localhost:5000/api/docs
```

Includes

- 45+ REST APIs
- Request Examples
- Response Examples
- Validation Errors

---

## 🗄 MongoDB Database

Collections

- Users
- Farms
- Sensors
- Sensor Logs
- Pump Logs
- Weather Logs
- MQTT Logs

---

# 📂 Project Structure

```
Gia_lap_IOT
│
├── backend
│   ├── src
│   │   ├── config
│   │   ├── controllers
│   │   ├── docs
│   │   ├── middlewares
│   │   ├── models
│   │   ├── repositories
│   │   ├── routes
│   │   ├── services
│   │   ├── seeders
│   │   └── utils
│   │
│   ├── package.json
│   └── server.js
│
├── src
│   ├── assets
│   ├── components
│   ├── context
│   ├── pages
│   ├── services
│   └── utils
│
├── public
├── docs
├── README.md
└── package.json
```

---

# 🛠 Technology Stack

## Frontend

- React 19
- Vite
- Tailwind CSS
- React Router
- Framer Motion
- Recharts
- React Icons

## Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- Swagger
- Express Validator

## DevOps

- Docker
- Git
- GitHub
- Vercel

---

# ⚙ Installation

Clone

```bash
git clone https://github.com/tienvovn/Gia_lap_IOT.git
```

Frontend

```bash
npm install
npm run dev
```

Backend

```bash
cd backend

npm install

npm run dev
```

---

# 📡 REST API

Health

```
GET /health
```

Resources

```
GET /api/users
GET /api/farms
GET /api/sensors
GET /api/sensor-logs
GET /api/pump-logs
GET /api/weather-logs
GET /api/mqtt-logs
```

Dashboard

```
GET /api/dashboard
```

Statistics

```
GET /api/statistics
```

Swagger

```
GET /api/docs
```

---

# 📸 Screenshots

## Dashboard

- Real-time Monitoring
- Live Charts
- Pump Status

---

## Statistics

- Average Values
- Farm Comparison

---

## Simulation

- MQTT Simulator
- Weather Simulation

---

## Swagger

- Interactive REST API Documentation

---

# 🚀 Future Development

- MQTT Broker (Mosquitto)
- ESP32 Hardware Integration
- Real Sensor Data
- Socket.IO Realtime Dashboard
- AI Crop Recommendation
- Camera Monitoring
- Disease Detection
- Mobile Application
- User Authentication (JWT)
- Role-based Access Control

---

# 👨‍💻 Author

**Tien Vo**

GitHub

https://github.com/tienvovn

---

# 📄 License

MIT License

---

⭐ If you find this project useful, please consider giving it a star on GitHub.
