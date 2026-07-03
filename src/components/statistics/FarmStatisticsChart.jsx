import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

import { useFarm } from "../../context/FarmContext";

function FarmStatisticsChart() {
  const { farms } = useFarm();

  const data = farms.map((farm) => ({
    name: farm.name,
    Temperature: farm.temperature,
    Humidity: farm.humidity,
    pH: farm.ph,
  }));

  return (
    <div className="bg-slate-800 rounded-2xl p-6 mt-8">

      <h2 className="text-2xl text-white font-bold mb-6">
        Farm Statistics
      </h2>

      <ResponsiveContainer
        width="100%"
        height={400}
      >
        <BarChart data={data}>

          <XAxis dataKey="name" />

          <YAxis />

          <Tooltip />

          <Legend />

          <Bar
            dataKey="Temperature"
            fill="#f97316"
            radius={[8, 8, 0, 0]}
          />

          <Bar
            dataKey="Humidity"
            fill="#06b6d4"
            radius={[8, 8, 0, 0]}
          />

          <Bar
            dataKey="pH"
            fill="#22c55e"
            radius={[8, 8, 0, 0]}
          />

        </BarChart>

      </ResponsiveContainer>

    </div>
  );
}

export default FarmStatisticsChart;