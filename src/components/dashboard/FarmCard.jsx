import { motion } from "framer-motion";
import { useFarm } from "../../context/FarmContext";
import {
  FaMapMarkerAlt,
  FaTemperatureHigh,
  FaTint,
  FaWater,
  FaLeaf,
} from "react-icons/fa";

function FarmCard({ farm }) {
  const { setSelectedFarm } = useFarm();

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => setSelectedFarm(farm)}
      className="cursor-pointer rounded-2xl bg-slate-800 border border-slate-700 p-6 shadow-xl transition-all"
    >
      {/* Header */}

      <div className="flex justify-between items-start">

        <div>

          <h2 className="text-2xl font-bold text-white">
            {farm.name}
          </h2>

          <p className="text-green-400 mt-1">
            🌱 {farm.crop}
          </p>

          <p className="text-slate-400 mt-2">
            <FaMapMarkerAlt className="inline mr-2" />
            {farm.location}
          </p>

        </div>

        <div className="text-right">

          <span
            className={`inline-block w-3 h-3 rounded-full ${
              farm.online ? "bg-green-500" : "bg-red-500"
            }`}
          />

          <p className="text-xs text-slate-400 mt-2">
            {farm.online ? "ONLINE" : "OFFLINE"}
          </p>

        </div>

      </div>

      {/* AUTO */}

      <div className="mt-5">

        <span className="bg-blue-600 px-3 py-1 rounded-full text-xs text-white">
          AUTO MODE
        </span>

      </div>

      {/* Sensor Grid */}

      <div className="grid grid-cols-2 gap-4 mt-6">

        {/* Temperature */}

        <div className="bg-slate-900 rounded-xl p-4">

          <FaTemperatureHigh className="text-orange-400 mb-2" />

          <p className="text-slate-400 text-sm">

            Temperature

          </p>

          <h3 className="text-2xl text-white font-bold">

            {farm.temperature}°C

          </h3>

        </div>

        {/* Humidity */}

        <div className="bg-slate-900 rounded-xl p-4">

          <FaTint className="text-cyan-400 mb-2" />

          <p className="text-slate-400 text-sm">

            Soil Humidity

          </p>

          <h3 className="text-2xl text-white font-bold">

            {farm.humidity}%

          </h3>

        </div>

        {/* PH */}

        <div className="bg-slate-900 rounded-xl p-4">

          <FaLeaf className="text-green-400 mb-2" />

          <p className="text-slate-400 text-sm">

            Soil pH

          </p>

          <h3 className="text-2xl text-white font-bold">

            {farm.ph}

          </h3>

        </div>

        {/* Pump */}

        <div className="bg-slate-900 rounded-xl p-4">

          <FaWater className="text-blue-400 mb-2" />

          <p className="text-slate-400 text-sm">

            Pump

          </p>

          <h3
            className={`text-lg font-bold ${
              farm.pump
                ? "text-green-400"
                : "text-red-400"
            }`}
          >
            {farm.pump ? "🟢 RUNNING" : "🔴 STOPPED"}
          </h3>

          <p className="text-slate-500 text-sm mt-2">

            Remaining

          </p>

          <p className="text-yellow-400 font-bold">

            {farm.pump
              ? `${Math.floor(farm.pumpTime / 60)}:${String(
                  farm.pumpTime % 60
                ).padStart(2, "0")}`
              : "--"}

          </p>

        </div>

      </div>
    </motion.div>
  );
}

export default FarmCard;