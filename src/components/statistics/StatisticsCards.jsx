import { useFarm } from "../../context/FarmContext";
import {
  FaWater,
  FaTemperatureHigh,
  FaTint,
} from "react-icons/fa";

function StatisticsCards() {
  const { farms } = useFarm();

  const avgTemp =
    farms.reduce((sum, farm) => sum + farm.temperature, 0) /
    farms.length;

  const avgHumidity =
    farms.reduce((sum, farm) => sum + farm.humidity, 0) /
    farms.length;

  const runningPump =
    farms.filter((farm) => farm.pump).length;

  const Card = ({ icon, title, value, color }) => (
    <div className="bg-slate-800 rounded-2xl p-6 shadow-lg">

      <div className={`${color} text-3xl mb-4`}>
        {icon}
      </div>

      <p className="text-slate-400">
        {title}
      </p>

      <h2 className="text-3xl font-bold text-white mt-2">
        {value}
      </h2>

    </div>
  );

  return (
    <div className="grid md:grid-cols-3 gap-6">

      <Card
        icon={<FaTemperatureHigh />}
        title="Average Temperature"
        value={`${avgTemp.toFixed(1)} °C`}
        color="text-orange-400"
      />

      <Card
        icon={<FaTint />}
        title="Average Humidity"
        value={`${avgHumidity.toFixed(0)} %`}
        color="text-cyan-400"
      />

      <Card
        icon={<FaWater />}
        title="Running Pumps"
        value={`${runningPump}/${farms.length}`}
        color="text-green-400"
      />

    </div>
  );
}

export default StatisticsCards;