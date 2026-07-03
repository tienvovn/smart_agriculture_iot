import {
  FaChartLine,
  FaCog,
  FaHistory,
  FaFlask,
  FaChartPie,
} from "react-icons/fa";

import { NavLink } from "react-router-dom";

function Sidebar() {
  const menu = [
    {
      name: "Dashboard",
      icon: <FaChartLine />,
      path: "/",
    },
    {
      name: "Statistics",
      icon: <FaChartPie />,
      path: "/statistics",
    },
    {
      name: "History",
      icon: <FaHistory />,
      path: "/history",
    },
    {
      name: "Simulation",
      icon: <FaFlask />,
      path: "/simulation",
    },
    {
      name: "Settings",
      icon: <FaCog />,
      path: "/settings",
    },
  ];

  return (
    <aside className="w-72 min-h-screen bg-slate-900 border-r border-slate-800 text-white">

      {/* Logo */}
      <div className="p-6 border-b border-slate-800">

        <h1 className="text-3xl font-bold text-green-400">
          🌾 Smart Farm
        </h1>

        <p className="text-slate-400 mt-2 text-sm">
          IoT Agriculture System
        </p>

      </div>

      {/* Menu */}
      <nav className="px-4 py-6 space-y-2">

        {menu.map((item) => (

          <NavLink
            key={item.name}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              `flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${
                isActive
                  ? "bg-green-600 text-white shadow-lg"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`
            }
          >
            <span className="text-xl">
              {item.icon}
            </span>

            <span className="font-medium">
              {item.name}
            </span>

          </NavLink>

        ))}

      </nav>

      {/* Footer */}
      <div className="absolute bottom-6 left-6 text-xs text-slate-500">

        <p>Smart Agriculture IoT</p>

        <p>Version 1.0</p>

      </div>

    </aside>
  );
}

export default Sidebar;