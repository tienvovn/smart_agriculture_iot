import { useFarm } from "../../context/FarmContext";

function WeatherPanel() {
  const {
    weather,
    setWeather,
    WEATHER,
  } = useFarm();

  const buttonStyle =
    "px-5 py-3 rounded-xl font-bold transition-all";

  return (
    <div className="bg-slate-800 rounded-2xl p-6">

      <h2 className="text-white text-2xl font-bold mb-5">
        Weather Simulation
      </h2>

      <div className="grid grid-cols-2 gap-4">

        <button
          className={`${buttonStyle}
          ${
            weather === WEATHER.SUNNY
              ? "bg-yellow-500"
              : "bg-slate-700"
          }`}
          onClick={() => setWeather(WEATHER.SUNNY)}
        >
          ☀ Sunny
        </button>

        <button
          className={`${buttonStyle}
          ${
            weather === WEATHER.CLOUDY
              ? "bg-gray-500"
              : "bg-slate-700"
          }`}
          onClick={() => setWeather(WEATHER.CLOUDY)}
        >
          ☁ Cloudy
        </button>

        <button
          className={`${buttonStyle}
          ${
            weather === WEATHER.RAIN
              ? "bg-blue-500"
              : "bg-slate-700"
          }`}
          onClick={() => setWeather(WEATHER.RAIN)}
        >
          🌧 Rain
        </button>

        <button
          className={`${buttonStyle}
          ${
            weather === WEATHER.NIGHT
              ? "bg-indigo-600"
              : "bg-slate-700"
          }`}
          onClick={() => setWeather(WEATHER.NIGHT)}
        >
          🌙 Night
        </button>

      </div>

      <div className="mt-6 text-center">

        <span className="text-green-400 text-xl font-bold">
          Current Weather :
        </span>

        <span className="text-white text-xl ml-2">
          {weather}
        </span>

      </div>

    </div>
  );
}

export default WeatherPanel;