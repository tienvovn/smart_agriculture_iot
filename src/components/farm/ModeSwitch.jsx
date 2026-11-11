import { useState } from "react";
import { useFarm } from "../../context/FarmContext";

function ModeSwitch() {
  const { selectedFarm, toggleMode } = useFarm();
  const [busy, setBusy] = useState(false);

  if (!selectedFarm) return null;

  const isHardware = selectedFarm.source === "hardware";
  const disabled = busy || !isHardware || !selectedFarm.online;

  const onClick = async () => {
    setBusy(true);
    try {
      await toggleMode(selectedFarm);
    } catch {
      // error is shown from context
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl p-5">
      <h2 className="text-white text-xl font-bold mb-2">Control Mode</h2>

      <p className="mb-4 text-sm text-slate-400">
        {isHardware
          ? selectedFarm.autoMode
            ? "ESP32 waters automatically when soil is dry."
            : "You control the pump. Switching to MANUAL turns the relay OFF."
          : "Simulated farm — mode control needs a real ESP32."}
      </p>

      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full py-3 rounded-xl text-white font-bold transition disabled:opacity-60 disabled:cursor-not-allowed ${
          selectedFarm.autoMode ? "bg-green-600 hover:bg-green-500" : "bg-orange-500 hover:bg-orange-400"
        }`}
      >
        {busy ? "Sending…" : selectedFarm.autoMode ? "AUTO MODE" : "MANUAL MODE"}
      </button>
    </div>
  );
}

export default ModeSwitch;
