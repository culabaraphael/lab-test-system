import { useState } from "react";
import { NavLink } from "react-router-dom";

export default function DoctorSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navClass = ({ isActive }) =>
    `
    flex items-center gap-3
    px-3 py-2.5
    rounded-lg
    text-sm
    font-medium
    transition-all
    ${
      isActive
        ? "bg-white/10 text-white"
        : "text-gray-400 hover:text-white hover:bg-white/5"
    }
    `;

  const closeMobile = () => {
    setMobileOpen(false);
  };

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#111827] z-50 flex items-center justify-between px-4">
        <div>
          <p className="text-white font-semibold text-sm">
            Lab System
          </p>
          <p className="text-gray-500 text-[10px]">
            Esperanza Municipal Hospital
          </p>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-10 h-10 rounded-lg border border-gray-700 text-gray-300"
        >
          {mobileOpen ? "×" : "☰"}
        </button>
      </div>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={closeMobile}
        />
      )}

      <aside
        className={`
          fixed top-0 bottom-0 left-0
          w-64 bg-[#111827] text-white z-50
          flex flex-col
          transition-transform duration-300
          lg:translate-x-0
          ${
            mobileOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          }
        `}
      >
        <div className="px-6 py-5 border-b border-white/5">
          <p className="text-base font-semibold">
            Lab System
          </p>
          <p className="text-[10px] text-gray-500 mt-1">
            Esperanza Municipal Hospital
          </p>
        </div>

        <div className="px-5 py-5 border-b border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">
            Logged in as
          </p>

          <p className="text-xs font-medium text-gray-300 mt-1">
            Doctor
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-6">

          <NavSection title="Main">
            <NavItem
              to="/doctor/dashboard"
              label="Dashboard"
              onClick={closeMobile}
              icon="dashboard"
              navClass={navClass}
            />
          </NavSection>

          <NavSection title="Review">
            <NavItem
              to="/doctor/pending"
              label="Pending Review"
              onClick={closeMobile}
              icon="pending"
              navClass={navClass}
            />
          </NavSection>

          <NavSection title="Reports">
            <NavItem
              to="/doctor/history"
              label="History"
              onClick={closeMobile}
              icon="history"
              navClass={navClass}
            />

            <NavItem
              to="/doctor/analytics"
              label="Analytics"
              onClick={closeMobile}
              icon="analytics"
              navClass={navClass}
            />
          </NavSection>

        </nav>

        <div className="p-4 border-t border-white/5">
          <button
            type="button"
            onClick={() => {
              window.location.href = "/login";
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5"
          >
            <span className="w-5 flex justify-center">
              ⇥
            </span>
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}

function NavSection({ title, children }) {
  return (
    <div className="mb-8">
      <p className="px-3 mb-2 text-[10px] uppercase tracking-widest font-semibold text-gray-600">
        {title}
      </p>

      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon,
  onClick,
  navClass,
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={navClass}
    >
      <span className="w-5 flex justify-center">
        <Icon type={icon} />
      </span>

      <span>{label}</span>
    </NavLink>
  );
}

function Icon({ type }) {
  if (type === "dashboard") {
    return (
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <rect
          x="3"
          y="3"
          width="7"
          height="7"
          rx="1"
          strokeWidth="1.7"
        />
        <rect
          x="14"
          y="3"
          width="7"
          height="7"
          rx="1"
          strokeWidth="1.7"
        />
        <rect
          x="3"
          y="14"
          width="7"
          height="7"
          rx="1"
          strokeWidth="1.7"
        />
        <rect
          x="14"
          y="14"
          width="7"
          height="7"
          rx="1"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  if (type === "pending") {
    return (
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <circle
          cx="12"
          cy="12"
          r="8"
          strokeWidth="1.7"
        />
        <path
          d="M12 8v5l3 2"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (type === "history") {
    return (
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path
          d="M3 12a9 9 0 1 0 3-6.7"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M3 5v5h5"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 7v5l3 2"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <path
        d="M4 19V5"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M4 19h16"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M7 15l3-4 3 2 4-6"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}