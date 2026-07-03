import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";

import StatisticsCards from "../components/statistics/StatisticsCards";
import FarmStatisticsChart from "../components/statistics/FarmStatisticsChart";

function Statistics() {

  const navigate = useNavigate();

  return (

    <div className="p-8">

      <div className="flex justify-between items-center mb-8">

        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3 bg-green-600 hover:bg-green-500 text-white px-5 py-3 rounded-xl font-bold"
        >
          <FaArrowLeft />

          Dashboard

        </button>

        <h1 className="text-4xl font-bold text-slate-900">

          Statistics Dashboard

        </h1>

      </div>

      <StatisticsCards />

      <FarmStatisticsChart />

    </div>

  );
}

export default Statistics;