import { useState } from "react";
import { useFarm } from "../../context/FarmContext";
import { WEATHER } from "../../services/weatherServices";

function DemoControl() {
  const {
    setWeather,
    setEvents,
  } = useFarm();

  const [running, setRunning] = useState(false);

  const startDemo = () => {
    if (running) return;

    setRunning(true);

    // Bắt đầu mưa
    setWeather(WEATHER.RAIN);

    setEvents((old) => [
      {
        id: Date.now(),
        farm: "SYSTEM",
        message: "Demo started. Weather changed to RAIN.",
        time: new Date().toLocaleTimeString(),
        type: "info",
      },
      ...old,
    ]);

    // Sau 8 giây chuyển nắng
    setTimeout(() => {
      setWeather(WEATHER.SUNNY);

      setEvents((old) => [
        {
          id: Date.now(),
          farm: "SYSTEM",
          message: "Weather changed to SUNNY.",
          time: new Date().toLocaleTimeString(),
          type: "info",
        },
        ...old,
      ]);

      setRunning(false);
    }, 8000);
  };

  return (
    <div className="bg-slate-800 rounded-2xl p-6 mt-6">

      <h2 className="text-white text-2xl font-bold mb-5">
        Demo Mode
      </h2>

      <button
        onClick={startDemo}
        disabled={running}
        className={`w-full py-4 rounded-xl text-white font-bold transition
        ${
          running
            ? "bg-slate-600"
            : "bg-green-600 hover:bg-green-500"
        }`}
      >
        {running ? "Running Demo..." : "▶ Start Demo"}
      </button>

    </div>
  );
}

export default DemoControl;