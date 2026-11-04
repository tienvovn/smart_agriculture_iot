import { FaChartLine, FaExclamationTriangle, FaFlask, FaDatabase } from 'react-icons/fa';
import { NavLink } from 'react-router-dom';

const menu = [
  { name: 'Assurance Overview', icon: <FaChartLine />, path: '/' },
  { name: 'Telemetry Explorer', icon: <FaDatabase />, path: '/statistics' },
  { name: 'Incident Center', icon: <FaExclamationTriangle />, path: '/incidents' },
  { name: 'Failure Demo Lab', icon: <FaFlask />, path: '/simulation' }
];

export default function Sidebar() {
  return (
    <aside className="relative min-h-screen w-72 border-r border-slate-800 bg-slate-900 text-white">
      <div className="border-b border-slate-800 p-6">
        <h1 className="text-3xl font-black text-emerald-400">FarmGuard</h1>
        <p className="mt-2 text-sm text-slate-400">Irrigation Assurance</p>
      </div>
      <nav className="space-y-2 px-4 py-6">
        {menu.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `flex items-center gap-4 rounded-xl p-4 transition-all duration-300 ${isActive ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-medium">{item.name}</span>
          </NavLink>
        ))}
      </nav>
      <div className="absolute bottom-6 left-6 text-xs text-slate-500">
        <p>Outcome verification platform</p>
        <p>Hackathon MVP 0.2</p>
      </div>
    </aside>
  );
}
