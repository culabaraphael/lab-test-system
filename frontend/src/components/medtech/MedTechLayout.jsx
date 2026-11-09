import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

export default function MedTechLayout({ children, title, subtitle }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const mainNavigation = [
    {
      name: "Dashboard",
      path: "/medtech/dashboard",
      icon: "▦",
    },
    {
      name: "Patients",
      path: "/medtech/patients",
      icon: "♙",
    },
    {
      name: "Encode Results",
      path: "/medtech/encode",
      icon: "▤",
    },
    {
      name: "View Results",
      path: "/medtech/results",
      icon: "◉",
    },
  ];

  const reportNavigation = [
    {
      name: "Analytics",
      path: "/medtech/analytics",
      icon: "▥",
    },
    {
      name: "History",
      path: "/medtech/history",
      icon: "◷",
    },
  ];

  const handleLogout = () => {
    navigate("/login");
  };

  const NavigationItem = ({ item }) => (
    <NavLink
      to={item.path}
      onClick={() => setMobileMenuOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
          isActive
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-400 hover:text-white hover:bg-white/10"
        }`
      }
    >
      <span className="w-5 text-center text-base">{item.icon}</span>
      <span>{item.name}</span>
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-[#f5f6f4] text-gray-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 bg-[#171816] text-white flex-col">
        {/* Brand */}
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-gray-900 font-bold">
              L
            </div>

            <div>
              <h1 className="font-semibold text-sm">Lab System</h1>
              <p className="text-[11px] text-gray-500">
                Esperanza Municipal Hospital
              </p>
            </div>
          </div>
        </div>

        {/* User */}
        <div className="px-5 py-5 border-b border-white/10">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">
            Logged in as
          </p>

          <div className="bg-white/5 rounded-lg px-3 py-3">
            <p className="text-sm font-medium">Ma. Santos</p>
            <p className="text-xs text-gray-500 mt-1">
              Medical Technologist
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <p className="px-3 mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
            Main
          </p>

          <div className="space-y-1">
            {mainNavigation.map((item) => (
              <NavigationItem key={item.path} item={item} />
            ))}
          </div>

          <p className="px-3 mb-3 mt-8 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
            Reports
          </p>

          <div className="space-y-1">
            {reportNavigation.map((item) => (
              <NavigationItem key={item.path} item={item} />
            ))}
          </div>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition"
          >
            <span>↪</span>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#171816] text-white transform transition-transform duration-300 lg:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white text-gray-900 flex items-center justify-center font-bold">
              L
            </div>

            <div>
              <h1 className="font-semibold text-sm">Lab System</h1>
              <p className="text-[11px] text-gray-500">
                Esperanza Municipal Hospital
              </p>
            </div>
          </div>

          <button
            onClick={() => setMobileMenuOpen(false)}
            className="text-gray-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-5 border-b border-white/10">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">
            Logged in as
          </p>

          <div className="bg-white/5 rounded-lg px-3 py-3">
            <p className="text-sm font-medium">Ma. Santos</p>
            <p className="text-xs text-gray-500 mt-1">
              Medical Technologist
            </p>
          </div>
        </div>

        <nav className="px-4 py-6 overflow-y-auto">
          <p className="px-3 mb-3 text-[10px] uppercase tracking-widest text-gray-600">
            Main
          </p>

          <div className="space-y-1">
            {mainNavigation.map((item) => (
              <NavigationItem key={item.path} item={item} />
            ))}
          </div>

          <p className="px-3 mb-3 mt-8 text-[10px] uppercase tracking-widest text-gray-600">
            Reports
          </p>

          <div className="space-y-1">
            {reportNavigation.map((item) => (
              <NavigationItem key={item.path} item={item} />
            ))}
          </div>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10 bg-[#171816]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10"
          >
            <span>↪</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="lg:ml-64 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              ☰
            </button>

            <div>
              <h1 className="text-sm sm:text-base font-semibold text-gray-900">
                {title}
              </h1>

              {subtitle && (
                <p className="hidden sm:block text-xs text-gray-500 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-gray-500">
              Medical Technologist
            </span>

            <div className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-semibold">
              MS
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}