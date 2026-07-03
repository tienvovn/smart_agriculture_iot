import { createContext, useContext, useEffect, useState } from "react";
import { farms as initialData } from "../data/farms";
import { updatePumpLogic } from "../services/pumpController";
import { WEATHER, applyWeather } from "../services/weatherServices";

const FarmContext = createContext();

export function FarmProvider({ children }) {
  const [farms, setFarms] = useState(initialData);

  const [events, setEvents] = useState([]);

  const [selectedFarm, setSelectedFarm] = useState(null);

  // History Sensor
  const [history, setHistory] = useState({});

  // Weather Simulation
  const [weather, setWeather] = useState(WEATHER.SUNNY);

  // Luôn cập nhật Farm đang mở Drawer
  useEffect(() => {
    if (!selectedFarm) return;

    const farm = farms.find((f) => f.id === selectedFarm.id);

    if (farm) {
      setSelectedFarm(farm);
    }
  }, [farms]);

  // ==========================
  // Sensor Simulation
  // ==========================
  useEffect(() => {
    const timer = setInterval(() => {
      setFarms((prev) => {
        const updated = prev.map((farm) => {
          // Weather Effect
          const weatherSensor = applyWeather(farm, weather);

          let temperature =
            weatherSensor.temperature +
            (Math.random() - 0.5) * 0.2;

          let humidity =
            weatherSensor.humidity +
            Math.floor(Math.random() * 3 - 1);

          let ph =
            farm.ph +
            (Math.random() - 0.5) * 0.1;

          temperature = Number(temperature.toFixed(1));
          humidity = Math.max(30, Math.min(90, humidity));
          ph = Number(ph.toFixed(1));

          const previousPump = farm.pump;

          const updatedFarm = updatePumpLogic({
            ...farm,
            temperature,
            humidity,
            ph,
          });

          // ==========================
          // History
          // ==========================
          setHistory((old) => {
            const current = old[updatedFarm.id] || [];

            return {
              ...old,

              [updatedFarm.id]: [
                ...current.slice(-19),

                {
                  time: new Date().toLocaleTimeString(),

                  temperature: updatedFarm.temperature,

                  humidity: updatedFarm.humidity,

                  ph: updatedFarm.ph,
                },
              ],
            };
          });

          // ==========================
          // Event Log
          // ==========================

          if (!previousPump && updatedFarm.pump) {
            setEvents((old) => [
              {
                id: Date.now() + Math.random(),

                farm: updatedFarm.name,

                message:
                  "Humidity below 50%. Pump automatically turned ON.",

                time: new Date().toLocaleTimeString(),

                type: "success",
              },

              ...old.slice(0, 29),
            ]);
          }

          if (previousPump && !updatedFarm.pump) {
            setEvents((old) => [
              {
                id: Date.now() + Math.random(),

                farm: updatedFarm.name,

                message:
                  "30 minutes completed. Pump automatically turned OFF.",

                time: new Date().toLocaleTimeString(),

                type: "warning",
              },

              ...old.slice(0, 29),
            ]);
          }

          return updatedFarm;
        });

        return updated;
      });
    }, 1000);

    return () => clearInterval(timer);

  }, [weather]);

  // ==========================
  // Auto / Manual Mode
  // ==========================
  const toggleMode = (id) => {
    setFarms((prev) =>
      prev.map((farm) =>
        farm.id === id
          ? {
              ...farm,
              autoMode: !farm.autoMode,
            }
          : farm
      )
    );
  };

  // ==========================
  // Manual Pump
  // ==========================
  const togglePump = (id) => {
    setFarms((prev) =>
      prev.map((farm) => {
        if (farm.id !== id) return farm;

        if (farm.autoMode) return farm;

        const newPump = !farm.pump;

        setEvents((old) => [
          {
            id: Date.now() + Math.random(),

            farm: farm.name,

            message: newPump
              ? "User manually turned ON pump."
              : "User manually turned OFF pump.",

            time: new Date().toLocaleTimeString(),

            type: "info",
          },

          ...old.slice(0, 29),
        ]);

        return {
          ...farm,
          pump: newPump,
        };
      })
    );
  };

  return (
    <FarmContext.Provider
      value={{
        farms,
        setFarms,

        events,
        setEvents,

        selectedFarm,
        setSelectedFarm,

        toggleMode,
        togglePump,

        history,

        // Weather
        weather,
        setWeather,
        WEATHER,
      }}
    >
      {children}
    </FarmContext.Provider>
  );
}

export function useFarm() {
  return useContext(FarmContext);
}