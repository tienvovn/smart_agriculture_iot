import { motion } from "framer-motion";
import {
    FaSeedling,
    FaTemperatureHigh,
    FaTint,
    FaCloud,
} from "react-icons/fa";

const stats = [
    {
        title: "Farms",
        value: 3,
        icon: <FaSeedling size={30} />,
        color: "from-green-500 to-green-700",
    },
    {
        title: "Sensors",
        value: 9,
        icon: <FaTemperatureHigh size={30} />,
        color: "from-orange-500 to-red-600",
    },
    {
        title: "Pumps",
        value: 3,
        icon: <FaTint size={30} />,
        color: "from-cyan-500 to-blue-600",
    },
    {
        title: "MQTT",
        value: "ONLINE",
        icon: <FaCloud size={30} />,
        color: "from-violet-500 to-indigo-600",
    },
];

function DashboardStats() {
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