"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Search, Bell, Settings, Plus, User, LogOut, ShieldAlert, Zap } from "lucide-react";
import clsx from "clsx";

export function Header() {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: "critical",
      title: "Critical vulnerability found",
      desc: "Vulnerable Support Bot failed 34 tests.",
      time: "10 minutes ago"
    },
    {
      id: 2,
      type: "info",
      title: "Campaign Completed",
      desc: "Weekly Security Scan finished successfully.",
      time: "2 hours ago"
    }
  ]);

  const notifRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = () => {
    setNotifications([]);
  };

  const handleNavigate = (path: string) => {
    setShowSettings(false);
    router.push(path);
  };

  return (
    <header className="h-16 flex items-center justify-between px-8 border-b border-zinc-800 bg-black shrink-0">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl w-80 focus-within:border-violet-500/50 focus-within:ring-2 focus-within:ring-violet-500/20 transition-all">
        <Search size={16} className="text-zinc-500 shrink-0" />
        <input
          type="text"
          placeholder="Search campaigns, targets..."
          className="bg-transparent border-none text-white text-sm w-full outline-none placeholder:text-zinc-500"
        />
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button 
            className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors relative"
            title="Notifications"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={18} />
            {notifications.length > 0 && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
            )}
          </button>
          
          {showNotifications && (
            <div className="absolute top-[calc(100%+8px)] right-0 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 origin-top-right animate-in">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-white">Notifications</h3>
                {notifications.length > 0 && (
                  <button 
                    onClick={handleMarkAllRead}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto p-2">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-zinc-500 text-sm">
                    No new notifications
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div key={notif.id} className="flex gap-3 items-start p-3 hover:bg-zinc-800/50 rounded-lg transition-colors cursor-pointer">
                      <div className={clsx(
                        "p-2 rounded-lg shrink-0",
                        notif.type === 'critical' ? "bg-red-500/10 text-red-500" : "bg-violet-500/10 text-violet-400"
                      )}>
                        {notif.type === 'critical' ? <ShieldAlert size={16} /> : <Zap size={16} />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{notif.title}</p>
                        <p className="text-xs text-zinc-400 mt-1">{notif.desc}</p>
                        <p className="text-[10px] text-zinc-500 mt-1.5">{notif.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <div ref={settingsRef} className="relative">
          <button 
            className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            title="Settings"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings size={18} />
          </button>

          {showSettings && (
            <div className="absolute top-[calc(100%+8px)] right-0 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 origin-top-right animate-in p-2 flex flex-col gap-1">
              <button 
                onClick={() => handleNavigate("/dashboard")}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors text-left"
              >
                <User size={15} /> Account Profile
              </button>
              <button 
                onClick={() => handleNavigate("/dashboard")}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors text-left"
              >
                <Settings size={15} /> Workspace Settings
              </button>
              <div className="h-px bg-zinc-800 my-1" />
              <button 
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("user");
                  router.push("/login");
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors text-left"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>

        <button
          className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 transition-all hover:shadow-[0_0_20px_rgba(124,58,237,0.3)]"
          onClick={() => router.push("/dashboard")}
        >
          <Plus size={16} />
          New Campaign
        </button>
      </div>
    </header>
  );
}
