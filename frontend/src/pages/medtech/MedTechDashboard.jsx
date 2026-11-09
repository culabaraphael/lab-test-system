import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/common/Sidebar";
import Header from "../../components/common/Header";

import { API_URL } from "../../config";

export default function MedTechDashboard() {
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [results, setResults] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ==========================================
  // LOAD DASHBOARD DATA
  // ==========================================
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const [patientsResponse, resultsResponse] =
          await Promise.all([
            fetch(API_URL + "/patients", {
              method: "GET",
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
              },
            }),

            fetch(API_URL + "/lab-results", {
              method: "GET",
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
              },
            }),
          ]);

        if (!patientsResponse.ok) {
          throw new Error(
            "Failed to retrieve patient information."
          );
        }

        if (!resultsResponse.ok) {
          throw new Error(
            "Failed to retrieve laboratory results."
          );
        }

        const patientsData =
          await patientsResponse.json();

        const resultsData =
          await resultsResponse.json();

        if (!patientsData.success) {
          throw new Error(
            "Unable to retrieve patient information."
          );
        }

        if (!resultsData.success) {
          throw new Error(
            "Unable to retrieve laboratory results."
          );
        }

        setPatients(
          patientsData.patients || []
        );

        setResults(
          resultsData.lab_results || []
        );
      } catch (err) {
        console.error(
          "Dashboard error:",
          err
        );

        setError(
          err.message ||
            "Unable to connect to the laboratory database."
        );
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  // ==========================================
  // DATE HELPER
  // ==========================================
  const isToday = (dateValue) => {
    if (!dateValue) {
      return false;
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    const today = new Date();

    return (
      date.getFullYear() ===
        today.getFullYear() &&
      date.getMonth() ===
        today.getMonth() &&
      date.getDate() ===
        today.getDate()
    );
  };

  // ==========================================
  // TODAY'S RESULTS
  // ==========================================
  const todayResults = useMemo(() => {
    return results.filter((result) =>
      isToday(
        result.submitted_at ||
          result.created_at
      )
    );
  }, [results]);

  // ==========================================
  // DASHBOARD STATS
  // ==========================================
  const dashboardStats = useMemo(() => {
    const resultsEncodedToday =
      todayResults.length;

    const pendingToday =
      todayResults.filter(
        (result) =>
          result.status ===
          "PENDING_REVIEW"
      ).length;

    const approvedToday =
      todayResults.filter(
        (result) =>
          result.status === "APPROVED"
      ).length;

    const rejectedToday =
      todayResults.filter(
        (result) =>
          result.status === "REJECTED"
      ).length;

    const cancelledToday =
      todayResults.filter(
        (result) =>
          result.status === "CANCELLED"
      ).length;

    return {
      totalPatients: patients.length,
      resultsEncodedToday,
      pendingToday,
      approvedToday,
      rejectedToday,
      cancelledToday,
    };
  }, [patients, todayResults]);

  // ==========================================
  // RECENT TODAY'S RESULTS
  // ==========================================
  const recentResults = useMemo(() => {
    return [...todayResults]
      .sort((a, b) => {
        const dateA = new Date(
          a.submitted_at ||
            a.created_at ||
            0
        ).getTime();

        const dateB = new Date(
          b.submitted_at ||
            b.created_at ||
            0
        ).getTime();

        return dateB - dateA;
      })
      .slice(0, 8)
      .map((result) => {
        const patient =
          result.patient || {};

        const patientName = [
          patient.first_name,
          patient.middle_name,
          patient.last_name,
        ]
          .filter(Boolean)
          .join(" ");

        return {
          id: result.id,

          patientId:
            patient.patient_id || "—",

          patientName:
            patientName || "—",

          testType:
            result.test_type?.name ||
            "—",

          dateEncoded: formatDate(
            result.submitted_at ||
              result.created_at
          ),

          status:
            result.status || "UNKNOWN",
        };
      });
  }, [todayResults]);

  return (
    <div className="min-h-screen bg-[#f6f8fa]">

      {/* SIDEBAR */}
      <Sidebar />

      {/* MAIN CONTENT */}
      <div className="lg:ml-[250px] min-h-screen">

        {/* HEADER */}
        <Header />

        <main className="px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-5 sm:pb-7">

          {/* ================================== */}
          {/* PAGE INTRODUCTION */}
          {/* ================================== */}
          <section className="mb-6">

            <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-gray-400">
              Daily Laboratory Operations
            </p>

            <h2 className="text-xl sm:text-2xl font-semibold text-[#172033] mt-1">
              Dashboard
            </h2>

            <p className="text-[11px] sm:text-xs text-gray-500 mt-1">
              Today's laboratory activity and operational workload.
            </p>

          </section>

          {/* ================================== */}
          {/* ERROR */}
          {/* ================================== */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* ================================== */}
          {/* STATISTICS */}
          {/* ================================== */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">

            {/* TOTAL PATIENTS */}
            <StatCard
              title="Total Patients"
              value={
                loading
                  ? "—"
                  : dashboardStats.totalPatients
              }
              description={
                loading
                  ? "Loading..."
                  : "All registered patient records"
              }
              icon="patients"
            />

            {/* TODAY'S RESULTS */}
            <StatCard
              title="Results Today"
              value={
                loading
                  ? "—"
                  : dashboardStats.resultsEncodedToday
              }
              description={
                loading
                  ? "Loading..."
                  : "Laboratory results submitted today"
              }
              icon="lab"
            />

            {/* PENDING TODAY */}
            <StatCard
              title="Pending Today"
              value={
                loading
                  ? "—"
                  : dashboardStats.pendingToday
              }
              description={
                loading
                  ? "Loading..."
                  : "Awaiting Doctor review today"
              }
              icon="pending"
            />

            {/* APPROVED TODAY */}
            <StatCard
              title="Approved Today"
              value={
                loading
                  ? "—"
                  : dashboardStats.approvedToday
              }
              description={
                loading
                  ? "Loading..."
                  : "Approved laboratory results today"
              }
              icon="approved"
            />

            {/* REJECTED TODAY */}
            <StatCard
              title="Rejected Today"
              value={
                loading
                  ? "—"
                  : dashboardStats.rejectedToday
              }
              description={
                loading
                  ? "Loading..."
                  : "Returned for correction today"
              }
              icon="rejected"
            />

            {/* CANCELLED TODAY */}
            <StatCard
              title="Cancelled Today"
              value={
                loading
                  ? "—"
                  : dashboardStats.cancelledToday
              }
              description={
                loading
                  ? "Loading..."
                  : "Cancelled laboratory results today"
              }
              icon="cancelled"
            />

          </section>

          {/* ================================== */}
          {/* MAIN DASHBOARD GRID */}
          {/* ================================== */}
          <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-5">

            {/* ================================== */}
            {/* TODAY'S RESULTS */}
            {/* ================================== */}
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">

              <div className="px-4 sm:px-5 py-4 border-b border-gray-200 flex items-center justify-between">

                <div>

                  <h3 className="text-[13px] font-semibold text-[#172033]">
                    Today's Encoded Results
                  </h3>

                  <p className="text-[10px] text-gray-400 mt-1">
                    Laboratory records submitted during the current day
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigate(
                      "/medtech/results"
                    );
                  }}
                  className="
                    px-3
                    py-1.5
                    border
                    border-gray-300
                    rounded-md
                    text-[10px]
                    font-medium
                    text-gray-600
                    hover:bg-gray-50
                    transition
                  "
                >
                  View all
                </button>

              </div>

              <div className="overflow-x-auto">

                <table className="w-full min-w-[650px]">

                  <thead>

                    <tr className="bg-[#fafbfc] border-b border-gray-200">

                      <th className="px-4 py-3 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wide">
                        Patient ID
                      </th>

                      <th className="px-4 py-3 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wide">
                        Patient Name
                      </th>

                      <th className="px-4 py-3 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wide">
                        Test Type
                      </th>

                      <th className="px-4 py-3 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wide">
                        Date Encoded
                      </th>

                      <th className="px-4 py-3 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wide">
                        Status
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {loading ? (

                      <tr>

                        <td
                          colSpan="5"
                          className="px-6 py-16 text-center"
                        >

                          <div className="flex flex-col items-center">

                            <div className="w-7 h-7 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mb-3" />

                            <p className="text-[10px] text-gray-500">
                              Loading today's results...
                            </p>

                          </div>

                        </td>

                      </tr>

                    ) : recentResults.length === 0 ? (

                      <tr>

                        <td
                          colSpan="5"
                          className="px-6 py-16 sm:py-20 text-center"
                        >

                          <div className="flex flex-col items-center">

                            <div className="w-12 h-12 rounded-full bg-[#edf1f5] flex items-center justify-center mb-4">

                              <svg
                                className="w-6 h-6 text-[#667788]"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                              >

                                <rect
                                  x="3"
                                  y="5"
                                  width="18"
                                  height="14"
                                  rx="2"
                                  strokeWidth="1.6"
                                />

                                <path
                                  d="M7 9h10M7 13h6"
                                  strokeWidth="1.6"
                                />

                              </svg>

                            </div>

                            <h4 className="text-[12px] font-semibold text-gray-700">
                              No results recorded today.
                            </h4>

                            <p className="text-[10px] text-gray-400 mt-1 max-w-xs">
                              Laboratory results submitted today will appear here.
                            </p>

                          </div>

                        </td>

                      </tr>

                    ) : (

                      recentResults.map(
                        (result) => (

                          <tr
                            key={result.id}
                            className="border-b border-gray-100 hover:bg-gray-50"
                          >

                            <td className="px-4 py-3 text-xs text-gray-800">
                              {result.patientId}
                            </td>

                            <td className="px-4 py-3 text-xs text-gray-800">
                              {result.patientName}
                            </td>

                            <td className="px-4 py-3 text-xs text-gray-800">
                              {result.testType}
                            </td>

                            <td className="px-4 py-3 text-xs text-gray-600">
                              {result.dateEncoded}
                            </td>

                            <td className="px-4 py-3">

                              <StatusBadge
                                status={
                                  result.status
                                }
                              />

                            </td>

                          </tr>

                        )
                      )

                    )}

                  </tbody>

                </table>

              </div>

            </div>

            {/* ================================== */}
            {/* RIGHT COLUMN */}
            {/* ================================== */}
            <div className="space-y-5">

              {/* TODAY WORKFLOW */}
              <div className="bg-white border border-gray-200 rounded-md">

                <div className="px-4 py-4 border-b border-gray-200">

                  <h3 className="text-[12px] font-semibold text-[#172033]">
                    Today's Workflow
                  </h3>

                  <p className="text-[10px] text-gray-400 mt-1">
                    Current status of today's laboratory results
                  </p>

                </div>

                <div className="p-4 space-y-3">

                  <WorkflowRow
                    label="Results Submitted"
                    value={
                      loading
                        ? "—"
                        : dashboardStats.resultsEncodedToday
                    }
                  />

                  <WorkflowRow
                    label="Pending Review"
                    value={
                      loading
                        ? "—"
                        : dashboardStats.pendingToday
                    }
                  />

                  <WorkflowRow
                    label="Approved"
                    value={
                      loading
                        ? "—"
                        : dashboardStats.approvedToday
                    }
                  />

                  <WorkflowRow
                    label="Rejected"
                    value={
                      loading
                        ? "—"
                        : dashboardStats.rejectedToday
                    }
                  />

                  <WorkflowRow
                    label="Cancelled"
                    value={
                      loading
                        ? "—"
                        : dashboardStats.cancelledToday
                    }
                  />

                </div>

              </div>

              {/* SYSTEM ANNOUNCEMENTS */}
              <div className="bg-white border border-gray-200 rounded-md">

                <div className="px-4 py-4 border-b border-gray-200 flex items-center gap-2">

                  <svg
                    className="w-4 h-4 text-[#52667a]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >

                    <path
                      d="M4 11v2a2 2 0 0 0 2 2h2l3 4V5L8 9H6a2 2 0 0 0-2 2Z"
                      strokeWidth="1.6"
                    />

                    <path
                      d="M15 9.5a4 4 0 0 1 0 5M17.5 7a7.5 7.5 0 0 1 0 10"
                      strokeWidth="1.6"
                    />

                  </svg>

                  <h3 className="text-[12px] font-semibold text-[#172033]">
                    System Announcements
                  </h3>

                </div>

                <div className="p-4">

                  <div className="bg-[#f8fafc] border border-gray-200 rounded-md py-7 px-4 text-center">

                    <p className="text-[11px] font-semibold text-gray-600">
                      No announcements
                    </p>

                    <p className="text-[10px] text-gray-400 mt-1">
                      There are no system announcements at this time.
                    </p>

                  </div>

                </div>

              </div>

            </div>

          </section>

          {/* FOOTER */}
          <footer className="text-center py-6 text-[9px] text-gray-400">
            © 2025 Laboratory Information System. All rights reserved.
          </footer>

        </main>

      </div>

    </div>
  );
}

// ==========================================
// DATE FORMAT
// ==========================================
function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

// ==========================================
// STATUS BADGE
// ==========================================
function StatusBadge({ status }) {
  let className =
    "bg-yellow-100 text-yellow-700";

  if (status === "APPROVED") {
    className =
      "bg-green-100 text-green-700";
  }

  if (status === "REJECTED") {
    className =
      "bg-red-100 text-red-700";
  }

  if (status === "CANCELLED") {
    className =
      "bg-gray-100 text-gray-600";
  }

  return (
    <span
      className={
        "inline-flex px-2 py-1 rounded-full text-[9px] font-semibold " +
        className
      }
    >
      {status}
    </span>
  );
}

// ==========================================
// STAT CARD
// ==========================================
function StatCard({
  title,
  value,
  description,
  icon,
}) {
  return (
    <div
      className="
        bg-white
        border border-gray-200
        rounded-md
        p-4 sm:p-5
        flex items-center
        gap-4
      "
    >

      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-[#e9f2fc] flex items-center justify-center shrink-0">

        {icon === "patients" && (
          <svg
            className="w-6 h-6 text-blue-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >

            <circle
              cx="9"
              cy="8"
              r="3"
              strokeWidth="1.7"
            />

            <path
              d="M3 20c.6-3.5 2.5-5 6-5s5.4 1.5 6 5"
              strokeWidth="1.7"
            />

            <path
              d="M16 11a3 3 0 1 0 0-6M17 15c2.5.5 3.7 2 4 5"
              strokeWidth="1.7"
            />

          </svg>
        )}

        {icon === "lab" && (
          <svg
            className="w-6 h-6 text-blue-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >

            <path
              d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"
              strokeWidth="1.7"
            />

            <path
              d="M8 15h8"
              strokeWidth="1.7"
            />

          </svg>
        )}

        {icon === "pending" && (
          <svg
            className="w-6 h-6 text-blue-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >

            <rect
              x="4"
              y="3"
              width="13"
              height="18"
              rx="2"
              strokeWidth="1.7"
            />

            <path
              d="M8 7h5M8 11h5"
              strokeWidth="1.7"
            />

            <circle
              cx="18"
              cy="17"
              r="4"
              fill="white"
              strokeWidth="1.7"
            />

            <path
              d="M18 15v2l1.2 1"
              strokeWidth="1.5"
            />

          </svg>
        )}

        {icon === "approved" && (
          <svg
            className="w-6 h-6 text-blue-600"
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
              d="m8.5 12 2.3 2.3 4.8-5"
              strokeWidth="1.8"
            />

          </svg>
        )}

        {icon === "rejected" && (
          <svg
            className="w-6 h-6 text-blue-600"
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
              d="m9 9 6 6M15 9l-6 6"
              strokeWidth="1.7"
              strokeLinecap="round"
            />

          </svg>
        )}

        {icon === "cancelled" && (
          <svg
            className="w-6 h-6 text-blue-600"
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
              d="M9 9l6 6M15 9l-6 6"
              strokeWidth="1.7"
              strokeLinecap="round"
            />

          </svg>
        )}

      </div>

      <div className="min-w-0">

        <p className="text-[10px] sm:text-[11px] text-gray-500">
          {title}
        </p>

        <p className="text-xl sm:text-2xl font-semibold text-[#172033] mt-0.5">
          {value}
        </p>

        <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5">
          {description}
        </p>

      </div>

    </div>
  );
}

// ==========================================
// WORKFLOW ROW
// ==========================================
function WorkflowRow({
  label,
  value,
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-b-0">

      <span className="text-[11px] text-gray-600">
        {label}
      </span>

      <span className="text-sm font-semibold text-[#172033]">
        {value}
      </span>

    </div>
  );
}