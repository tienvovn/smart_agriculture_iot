import { useState } from "react";
import { useFarm } from "../../context/FarmContext";

function MQTTSimulator() {
  const { farms, setFarms, setEvents } = useFarm();

  const [farmId, setFarmId] = useState(1);
  const [topic, setTopic] = useState("/farm/pump");
  const [payload, setPayload] = useState('{"pump":true}');

  const publish = () => {
    try {
      const data = JSON.parse(payload);

      setFarms((prev) =>
        prev.map((farm) => {
          if (farm.id !== Number(farmId)) return farm;

          return {
            ...farm,
            pump: data.pump,
          };
        })
      );

      const farm = farms.find((f) => f.id === Number(farmId));

      setEvents((old) => [
        {
          id: Date.now(),
          farm: farm?.name || "Unknown",
          message: `MQTT Publish → ${topic}`,
          time: new Date().toLocaleTimeString(),
          type: "info",
        },
        ...old.slice(0, 29),
      ]);
    } catch {
      alert("Payload JSON không hợp lệ");
    }
  };

  return (
    <div className="bg-slate-800 rounded-2xl p-6 mt-8">

      <h2 className="text-2xl text-white font-bold mb-6">
        MQTT Simulator
      </h2>

      <div className="space-y-5">

        <div>

          <p className="text-slate-300 mb-2">
            Farm
          </p>

          <select
            value={farmId}
            onChange={(e) => setFarmId(e.target.value)}
            className="w-full bg-slate-700 rounded-xl p-3 text-white"
          >
            {farms.map((farm) => (
              <option
                key={farm.id}
                value={farm.id}
              >
                {farm.name}
              </option>
            ))}
          </select>

        </div>

        <div>

          <p className="text-slate-300 mb-2">
            Topic
          </p>

          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full bg-slate-700 rounded-xl p-3 text-white"
          />

        </div>

        <div>

          <p className="text-slate-300 mb-2">
            Payload
          </p>

          <textarea
            rows={5}
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            className="w-full bg-slate-700 rounded-xl p-3 text-white"
          />

        </div>

        <button
          onClick={publish}
          className="w-full bg-green-600 hover:bg-green-500 rounded-xl py-3 text-white font-bold"
        >
          Publish MQTT
        </button>

      </div>

    </div>
  );
}

export default MQTTSimulator;