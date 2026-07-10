# Project Summary

## Frontend

React/Vite dashboard with routes for dashboard, history, simulation, settings, and statistics. UI components use Tailwind, Recharts, Framer Motion, and React Icons. `FarmContext` provides local farm data and a one-second sensor/pump/weather simulation.

## Backend

Express app with Helmet, CORS, JSON parsing, Morgan, Swagger, centralized errors, validation middleware, and layered controllers/services/repositories. It exposes CRUD resources and dashboard/statistics APIs.

## Database

Mongoose models define users, farms, sensors, sensor logs, pump logs, weather logs, and MQTT logs. Relations are stored as ObjectId references and domain-specific compound indexes support common queries.

## Deployment

The frontend can be built with Vite and the backend started with Node/Nodemon. MongoDB connection configuration and seeders exist. Docker is described as a target stack but Docker deployment files are not present.

## Folder structure

`src/` contains the React app, pages, components, simulation services, context, and sample data. `backend/src/` contains configuration, models, repositories, services, controllers, routes, middleware, utilities, seeders, and Swagger. `docs/architecture/` contains the generated reports and diagrams.
