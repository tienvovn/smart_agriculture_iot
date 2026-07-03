import { useEffect, useState } from "react";
import {
  FaBell,
  FaCloud,
  FaUserCircle,
  FaClock,
} from "react-icons/fa";

function Navbar() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString()
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-24 bg-slate-900 border-b border-slate-800 px-8 flex justify-between items-center shadow-lg">

      {/* Left */}
      <div>

        <h1 className="text-3xl font-bold text-white">
          🌾 Smart Agriculture IoT
        </h1>

        <p className="text-slate-400 mt-1">
          Agriculture Monitoring Dashboard
        </p>

      </div>

      {/* Right */}
      <div className="flex items-center gap-6">

        {/* MQTT */}
        <div className="bg-green-600 px-5 py-2 rounded-full flex items-center gap-3 shadow">

          <FaCloud />

          <span className="font-bold">
            MQTT Online
          </span>

        </div>

        {/* Time */}
        <div className="flex items-center gap-2 text-white">

          <FaClock className="text-cyan-400" />

          <span className="font-semibold">
            {time}
          </span>

        </div>

        {/* Notification */}
        <button className="relative">

          <FaBell className="text-2xl text-yellow-400 hover:scale-110 transition" />

          <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-xs flex items-center justify-center">
            3
          </span>

        </button>

        {/* Avatar */}
        <div className="flex items-center gap-2">

          <FaUserCircle className="text-4xl text-green-400" />

          <div>

            <p className="text-white font-bold">
              Admin
            </p>

            <p className="text-xs text-slate-400">
              IoT Engineer
            </p>

          </div>

        </div>

      </div>

    </header>
  );
}

export default Navbar;