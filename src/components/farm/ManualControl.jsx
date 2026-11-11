import { useState } from "react";
import { useFarm } from "../../context/FarmContext";

const STATUS_LABEL = {
  published: "Waiting for ESP32 ACK…",
  acknowledged: "Relay confirmed by ESP32",
  effect_confirmed: "Water reached the soil",
  ack_timeout: "ESP32 did not respond",
  failed: "Not verified",
};

function ManualControl() {
  const { selectedFarm, togglePump, error } = useFarm();
  const [busy, setBusy] = useState(false);

  if (!selectedFarm) return null;

  const isHardware = selectedFarm.source === "hardware";
  const disabledReason = !isHardware
    ? "Simulated farm"
    : !selectedFarm.online
      ? "ESP32 offline"
      : selectedFarm.autoMode
        ? "Disabled (AUTO) — switch to MANUAL"
        : null;

  const onClick = async () => {
    setBusy(true);
    try {
      await togglePump(selectedFarm);
    } catch {
      // error is shown from context
    } finally {
      setBusy(false);
    }
  };

  const status = selectedFarm.pumpState?.commandStatus;

  return (
    <div className="bg-slate-800 rounded-xl p-5">
      <h2 className="text-white font-bold text-lg">Manual Pump Control</h2>

      <p className="mt-1 text-sm text-slate-400">
        Relay:{" "}
        <span className={selectedFarm.pump ? "text-green-400 font-bold" : "text-slate-300 font-bold"}>
          {selectedFarm.pump ? "ON" : "OFF"}
        </span>
        {isHardware && status && STATUS_LABEL[status] && <> · {STATUS_LABEL[status]}</>}
      </p>

      {disabledReason ? (
        <button
          disabled
          className="mt-4 w-full bg-slate-700 py-3 rounded-xl text-slate-400 cursor-not-allowed"
        >
          {disabledReason}
        </button>
      ) : (
        <button
          onClick={onClick}
          disabled={busy}
          className={`mt-4 w-full py-3 rounded-xl font-bold text-white transition disabled:opacity-60 ${
            selectedFarm.pump ? "bg-red-600 hover:bg-red-500" : "bg-green-600 hover:bg-green-500"
          }`}
        >
          {busy ? "Sending…" : selectedFarm.pump ? "TURN OFF" : "TURN ON"}
        </button>
      )}

      {error && isHardware && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}

export default ManualControl;
