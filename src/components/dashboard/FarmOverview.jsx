import { useFarm } from "../../context/FarmContext";
import FarmCard from "./FarmCard";

function FarmOverview() {
  const { farms } = useFarm();

  return (
    <section className="mt-8">

      <div className="flex justify-between items-center mb-5">

        <div>

          <h2 className="text-3xl text-white font-bold">

            Farm Overview

          </h2>

          <p className="text-slate-400">

            Monitor all smart farms

          </p>

        </div>

      </div>

      <div className="grid grid-cols-3 gap-6">

        {farms.map((farm) => (

          <FarmCard
            key={farm.id}
            farm={farm}
          />

        ))}

      </div>

    </section>
  );
}

export default FarmOverview;