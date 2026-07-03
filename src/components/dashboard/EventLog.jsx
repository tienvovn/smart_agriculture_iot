import { useFarm } from "../../context/FarmContext";

function EventLog() {

    const { events } = useFarm();

    return (

        <div className="bg-slate-800 rounded-2xl p-6 mt-8">

            <h2 className="text-2xl font-bold text-white mb-6">

                📜 Event Log

            </h2>

            <div className="space-y-3">

                {events.length===0 && (

                    <p className="text-slate-400">

                        No events

                    </p>

                )}

                {events.map((event)=>(

                    <div

                        key={event.id}

                        className="bg-slate-900 rounded-xl p-4 flex justify-between items-center"

                    >

                        <div>

                            <p className="text-green-400 font-semibold">

                                {event.farm}

                            </p>

                            <p className="text-slate-300">

                                {event.message}

                            </p>

                        </div>

                        <span className="text-slate-500">

                            {event.time}

                        </span>

                    </div>

                ))}

            </div>

        </div>

    );

}

export default EventLog;