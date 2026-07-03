import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip
} from "recharts";

function FarmRealtimeChart({
    title,
    color,
    data,
    dataKey
}) {
    return (

        <div className="bg-slate-800 rounded-xl p-4 mt-6">

            <h2 className="text-white text-lg font-bold mb-4">
                {title}
            </h2>

            <ResponsiveContainer
                width="100%"
                height={220}
            >

                <LineChart data={data}>

                    <XAxis dataKey="time"/>

                    <YAxis/>

                    <Tooltip/>

                    <Line
                        type="monotone"
                        dataKey={dataKey}
                        stroke={color}
                        strokeWidth={3}
                        dot={false}
                    />

                </LineChart>

            </ResponsiveContainer>

        </div>

    );
}

export default FarmRealtimeChart;