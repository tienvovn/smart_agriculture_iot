import { useFarm } from "../../context/FarmContext";

function ModeSwitch() {
  const {
    selectedFarm,
    setFarms,
  } = useFarm();

  if (!selectedFarm) return null;

  const toggleMode = () => {
    setFarms((prev) =>
      prev.map((farm) =>
        farm.id === selectedFarm.id
          ? {
              ...farm,
              autoMode: !farm.autoMode,
            }
          : farm
      )
    );
  };

  return (
    <div className="bg-slate-800 rounded-xl p-5">

      <h2 className="text-white text-xl font-bold mb-5">
        Control Mode
      </h2>

      <button
        onClick={toggleMode}
        className={`w-full py-3 rounded-xl text-white font-bold transition ${
          selectedFarm.autoMode
            ? "bg-green-600 hover:bg-green-500"
            : "bg-orange-500 hover:bg-orange-400"
        }`}
      >
        {selectedFarm.autoMode
          ? "AUTO MODE"
          : "MANUAL MODE"}
      </button>

    </div>
  );
}

export default ModeSwitch;