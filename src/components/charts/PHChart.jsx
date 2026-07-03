import {
    LineChart,
    Line,
    ResponsiveContainer,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from "recharts";

import { useFarm } from "../../context/FarmContext";

function PHChart(){

    const { farms } = useFarm();

    const data = farms.map((farm)=>({

        name:farm.name,

        value:farm.ph,

    }));

    return(

        <div className="bg-slate-800 rounded-2xl p-6">

            <h2 className="text-2xl font-bold text-white mb-4">

                🧪 Soil pH

            </h2>

            <div className="h-72">

                <ResponsiveContainer>

                    <LineChart data={data}>

                        <CartesianGrid stroke="#334155"/>

                        <XAxis dataKey="name"/>

                        <YAxis/>

                        <Tooltip/>

                        <Line

                            dataKey="value"

                            stroke="#22c55e"

                            strokeWidth={4}

                        />

                    </LineChart>

                </ResponsiveContainer>

            </div>

        </div>

    );

}

export default PHChart;