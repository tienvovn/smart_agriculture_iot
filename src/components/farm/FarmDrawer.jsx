import { motion, AnimatePresence } from "framer-motion";
import { useFarm } from "../../context/FarmContext";
import FarmRealtimeChart from "./FarmRealtimeChart";
import ModeSwitch from "./ModeSwitch";
import ManualControl from "./ManualControl";
import {
  FaTimes,
  FaTemperatureHigh,
  FaTint,
  FaLeaf,
  FaWater,
} from "react-icons/fa";

function FarmDrawer() {
  const {
    selectedFarm,
    setSelectedFarm,
    history,
  } = useFarm();

  return (
    <AnimatePresence>
      {selectedFarm && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 bg-black/60 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedFarm(null)}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: 500 }}
            animate={{ x: 0 }}
            exit={{ x: 500 }}
            transition={{ duration: 0.35 }}
            className="fixed right-0 top-0 h-screen w-full bg-slate-900 border-l border-slate-700 z-50 p-6 overflow-y-auto"
          >
            {/* Header */}
            <div className="flex justify-between items-center">

              <h1 className="text-3xl font-bold text-white">
                {selectedFarm.name}
              </h1>

              <button
                onClick={() => setSelectedFarm(null)}
                className="text-white text-2xl hover:text-red-400"
              >
                <FaTimes />
              </button>

            </div>

            <p className="text-green-400 mt-2">
              🌱 {selectedFarm.crop}
            </p>

            <p className="text-slate-400 mb-8">
              📍 {selectedFarm.location}
            </p>

            {/* Sensor Cards */}
            <div className="space-y-4">

              <SensorCard
                icon={<FaTemperatureHigh />}
                title="Temperature"
                value={`${selectedFarm.temperature} °C`}
                color="text-orange-400"
              />

              <SensorCard
                icon={<FaTint />}
                title="Soil moisture"
                value={`${selectedFarm.humidity ?? '--'}%`}
                color="text-cyan-400"
              />

              {selectedFarm.airHumidity != null && (
                <SensorCard
                  icon={<FaTint />}
                  title="Air humidity (DHT22)"
                  value={`${selectedFarm.airHumidity}%`}
                  color="text-sky-300"
                />
              )}

              <SensorCard
                icon={<FaLeaf />}
                title="Soil pH"
                value={selectedFarm.ph}
                color="text-green-400"
              />

              <SensorCard
                icon={<FaWater />}
                title="Pump"
                value={
                  selectedFarm.pump
                    ? "RUNNING"
                    : "STOPPED"
                }
                color={
                  selectedFarm.pump
                    ? "text-green-400"
                    : "text-red-400"
                }
              />
            <div className="mt-8 space-y-5">

            <ModeSwitch />

            <ManualControl />
            </div>

            {/* Charts */}

            <FarmRealtimeChart
              title="🌡 Temperature History"
              color="#ff7300"
              data={history[selectedFarm.id] || []}
              dataKey="temperature"
            />

            <FarmRealtimeChart
              title="💧 Soil Moisture History"
              color="#00d4ff"
              data={history[selectedFarm.id] || []}
              dataKey="humidity"
            />

            {selectedFarm.airHumidity != null && (
              <FarmRealtimeChart
                title="☁️ Air Humidity History"
                color="#7dd3fc"
                data={history[selectedFarm.id] || []}
                dataKey="airHumidity"
              />
            )}

            <FarmRealtimeChart
              title="🌱 Soil pH History"
              color="#00ff88"
              data={history[selectedFarm.id] || []}
              dataKey="ph"
            />
            </div>

        <div className="mt-8 space-y-5">

         <ModeSwitch />

        <ManualControl />

        </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SensorCard({
  icon,
  title,
  value,
  color,
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-5">

      <div className={`${color} text-2xl mb-3`}>
        {icon}
      </div>

      <p className="text-slate-400">
        {title}
      </p>

      <h2 className="text-2xl text-white font-bold">
        {value}
      </h2>

    </div>
  );
}

export default FarmDrawer;