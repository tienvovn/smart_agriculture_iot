import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";

import DemoControl from "../components/simulation/DemoControl";

function Simulation() {
  const navigate = useNavigate();

  return (
    <div className="p-8">

      {/* Header */}
      <div className="flex justify-between items-center mb-8">

        {/* Back Button */}
        <button
          onClick={() => navigate("/")}
          className="
            flex
            items-center
            gap-3
            bg-green-600
            hover:bg-green-500
            text-white
            px-5
            py-3
            rounded-xl
            font-bold
            shadow-lg
            transition-all
          "
        >
          <FaArrowLeft />
          Dashboard
        </button>

        {/* Title */}
        <h1 className="text-4xl font-bold text-slate-900">
          Simulation Center
        </h1>

      </div>

      <DemoControl />

    </div>
  );
}

export default Simulation;
