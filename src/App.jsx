import { Routes, Route } from "react-router-dom";
import Statistics from "./pages/Statistics";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Simulation from "./pages/Simulation";
import Settings from "./pages/Settings";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/history" element={<History />} />
      <Route path="/simulation" element={<Simulation />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/statistics" element={<Statistics />} />
    </Routes>
  );
}

export default App;