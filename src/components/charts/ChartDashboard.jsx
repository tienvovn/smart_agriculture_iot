import TemperatureChart from "./TemperatureChart";
import HumidityChart from "./HumidityChart";
import PHChart from "./PHChart";

function ChartDashboard() {
    return (
        <div className="mt-8 space-y-8">

            <TemperatureChart />

            <HumidityChart />

            <PHChart />

        </div>
    );
}

export default ChartDashboard;