import { useState } from "react";
import { NavLink } from "react-router-dom";

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const mainItems = [
    {
      label: "Dashboard",
      path: "/medtech/dashboard",
      icon: "▦",
    },
    {
      label: "Patients",
      path: "/medtech/patients",
      icon: "♙",
    },
    {
      label: "Encode Results",
      path: "/medtech/encode",
      icon: "▱",
    },
    {
      label: "View Results",
      path: "/medtech/results",
      icon: "▤",
    },
  ];

  const reportItems = [
    {
      label: "Analytics",
      path: "/medtech/analytics",
      icon: "⌁",
    },
    {
      label: "History",
      path: "/medtech/history",
      icon: "◷",
    },
  ];

  const handleNavigation = () => {
    setMobileOpen(false);
  };

  const navClass = ({ isActive }) =>
    `
    flex items-center gap-3
    px-3 py-2.5
    rounded-lg
    text-sm
    font-medium
    transition-all
    duration-200
    ${
      isActive
        ? "bg-white/10 text-white"
        : "text-gray-400 hover:text-white hover:bg-white/5"
    }
    `;

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#111827] z-50 flex items-center justify-between px-4">
        <div>
          <p className="text-white font-semibold text-sm">Lab System</p>
          <p className="text-gray-500 text-[10px]">
            Esperanza Municipal Hospital
          </p>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-10 h-10 rounded-lg border border-gray-700 text-gray-300 flex items-center justify-center"
        >
          {mobileOpen ? "×" : "☰"}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed
          top-0
          bottom-0
          left-0
          w-64
          bg-[#111827]
          text-white
          z-50
          flex
          flex-col
          transform
          transition-transform
          duration-300
          lg:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Brand */}
        <div className="px-6 py-5 border-b border-white/5">
          <p className="text-base font-semibold tracking-tight">Lab System</p>

          <p className="text-[10px] text-gray-500 mt-1">
            Esperanza Municipal Hospital
          </p>
        </div>

        {/* User */}
        <div className="px-5 py-5 border-b border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">
            Logged in as
          </p>

          <p className="text-xs font-medium text-gray-300 mt-1">
            Ma. Santos (MedTech)
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-6">
          {/* Main */}
          <p className="px-3 mb-2 text-[10px] uppercase tracking-widest font-semibold text-gray-600">
            Main
          </p>

          <div className="space-y-1">
            {mainItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={handleNavigation}
                className={navClass}
              >
                <span className="w-5 text-center text-sm">{item.icon}</span>

                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>

          {/* Reports */}
          <div className="mt-8">
            <p className="px-3 mb-2 text-[10px] uppercase tracking-widest font-semibold text-gray-600">
              Reports
            </p>

            <div className="space-y-1">
              {reportItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={handleNavigation}
                  className={navClass}
                >
                  <span className="w-5 text-center text-sm">{item.icon}</span>

                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/5">
          <button
            type="button"
            onClick={() => {
              window.location.href = "/login";
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <span className="w-5 text-center"></span>
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
