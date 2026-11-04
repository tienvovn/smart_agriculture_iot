import { motion } from "framer-motion";
import {
    FaSeedling,
    FaTemperatureHigh,
    FaTint,
    FaCloud,
} from "react-icons/fa";
import { useFarm } from "../../context/FarmContext";

function DashboardStats() {
    const { farms, connected, incidents } = useFarm();
    const stats = [
        { title: "Farms", value: farms.length, icon: <FaSeedling size={30} />, color: "from-green-500 to-green-700" },
        { title: "Sensors", value: farms.length * 3, icon: <FaTemperatureHigh size={30} />, color: "from-orange-500 to-red-600" },
        { title: "Incidents", value: incidents.filter((item) => item.status !== "resolved").length, icon: <FaTint size={30} />, color: "from-cyan-500 to-blue-600" },
        { title: "Backend", value: connected ? "ONLINE" : "OFFLINE", icon: <FaCloud size={30} />, color: "from-violet-500 to-indigo-600" },
    ];
    return (
        <div className="grid grid-cols-4 gap-6">

            {stats.map((item, index) => (

                <motion.div
                    key={index}
                    whileHover={{ scale: 1.05 }}
                    className={`bg-gradient-to-r ${item.color}
                    rounded-2xl
                    p-6
                    shadow-xl`}
                >

                    <div className="flex justify-between">

                        <div>

                            <p className="text-white/80">

                                {item.title}

                            </p>

                            <h2 className="text-white text-4xl font-bold mt-2">

                                {item.value}

                            </h2>

                        </div>

                        <div className="text-white">

                            {item.icon}

                        </div>

                    </div>

                </motion.div>

            ))}

        </div>
    );
}

export default DashboardStats;
