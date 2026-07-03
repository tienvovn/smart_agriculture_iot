import { useFarm } from "../../context/FarmContext";

function ManualControl() {
  const {
    selectedFarm,
    togglePump,
  } = useFarm();

  if (!selectedFarm) return null;

  return (
    <div className="bg-slate-800 rounded-xl p-5">

      <h2 className="text-white font-bold text-lg">
        Manual Pump Control
      </h2>

      {selectedFarm.autoMode ? (

        <button
          disabled
          className="mt-4 w-full bg-slate-700 py-3 rounded-xl text-slate-400 cursor-not-allowed"
        >
          Disabled (AUTO)
        </button>

      ) : (

        <button
          onClick={() => togglePump(selectedFarm.id)}
          className={`mt-4 w-full py-3 rounded-xl font-bold transition ${
            selectedFarm.pump
              ? "bg-red-600 hover:bg-red-500"
              : "bg-green-600 hover:bg-green-500"
          }`}
        >
          {selectedFarm.pump
            ? "TURN OFF"
            : "TURN ON"}
        </button>

      )}

    </div>
  );
}

export default ManualControl;