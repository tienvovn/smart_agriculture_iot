export const WEATHER = {
  SUNNY: "Sunny",
  CLOUDY: "Cloudy",
  RAIN: "Rain",
  NIGHT: "Night",
};

export function applyWeather(farm, weather) {
  let temperature = farm.temperature;
  let humidity = farm.humidity;

  switch (weather) {
    case WEATHER.SUNNY:
      temperature += 0.3;
      humidity -= 2;
      break;

    case WEATHER.CLOUDY:
      temperature += 0.1;
      humidity += 0;
      break;

    case WEATHER.RAIN:
      temperature -= 0.2;
      humidity += 4;
      break;

    case WEATHER.NIGHT:
      temperature -= 0.15;
      humidity += 1;
      break;

    default:
      break;
  }

  return {
    temperature: Number(temperature.toFixed(1)),
    humidity: Math.max(30, Math.min(90, humidity)),
  };
}