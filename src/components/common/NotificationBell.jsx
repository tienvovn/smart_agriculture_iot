import { useState } from "react";
import { FaBell } from "react-icons/fa";
import { useFarm } from "../../context/FarmContext";

function NotificationBell() {
  const { events } = useFarm();

  const [open, setOpen] = useState(false);

  return (
    <div className="relative">

      <button
        onClick={() => setOpen(!open)}
        className="relative text-white text-2xl"
      >
        <FaBell />

        {events.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-600 text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {events.length}
          </span>
        )}
      </button>

      {open && (

        <div className="absolute right-0 mt-4 w-96 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 max-h-96 overflow-y-auto z-50">

          <div className="p-4 border-b border-slate-700 text-white font-bold">
            Notifications
          </div>

          {events.length === 0 ? (

            <div className="p-5 text-slate-400">
              No notification
            </div>

          ) : (

            events.map((event) => (

              <div
                key={event.id}
                className="border-b border-slate-700 p-4"
              >
                <p className="text-green-400 font-bold">
                  {event.farm}
                </p>

                <p className="text-white">
                  {event.message}
                </p>

                <small className="text-slate-400">
                  {event.time}
                </small>

              </div>

            ))

          )}

        </div>

      )}

    </div>
  );
}

export default NotificationBell;