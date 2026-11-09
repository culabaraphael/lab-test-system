import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/common/Sidebar";
import Header from "../../components/common/Header";

import { API_URL } from "../../config";

const DAILY_PATIENT_CAPACITY = 1000;
const DAILY_TEST_CAPACITY = 1000;

export default function Analytics() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/lab-results`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to retrieve laboratory analytics data."
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          "Unable to retrieve laboratory analytics data."
        );
      }

      setResults(data.lab_results || []);
    } catch (err) {
      console.error("Analytics error:", err);

      setError(
        err.message ||
          "Unable to connect to the laboratory results database."
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // CHECK IF DATE IS TODAY
  // ==========================================
  const isToday = (value) => {
    if (!value) {
      return false;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    const today = new Date();

    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  // ==========================================
  // TODAY'S RESULTS ONLY
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
  // TODAY'S STATUS COUNTS
  // ==========================================
  const statusCounts = useMemo(() => {
    return {
      total: todayResults.length,

      pending: todayResults.filter(
        (result) =>
          result.status === "PENDING_REVIEW"
      ).length,

      approved: todayResults.filter(
        (result) =>
          result.status === "APPROVED"
      ).length,

      rejected: todayResults.filter(
        (result) =>
          result.status === "REJECTED"
      ).length,

      cancelled: todayResults.filter(
        (result) =>
          result.status === "CANCELLED"
      ).length,
    };
  }, [todayResults]);

  // ==========================================
  // UNIQUE PATIENTS WITH RESULTS TODAY
  // ==========================================
  const patientsToday = useMemo(() => {
    const uniquePatients = new Set();

    todayResults.forEach((result) => {
      const patientId =
        result.patient?.id ||
        result.patient?.patient_id ||
        result.patient_id;

      if (patientId) {
        uniquePatients.add(String(patientId));
      }
    });

    return uniquePatients.size;
  }, [todayResults]);

  const patientPercentage =
    (patientsToday / DAILY_PATIENT_CAPACITY) * 100;

  const patientBarWidth = Math.min(
    patientPercentage,
    100
  );

  // ==========================================
  // EACH TEST TYPE HAS ITS OWN 1,000 BASELINE
  // ==========================================
  const testActivity = useMemo(() => {
    const counts = {};

    todayResults.forEach((result) => {
      const testName =
        result.test_type?.name ||
        "Unknown Test";

      counts[testName] =
        (counts[testName] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => {
        const percentage =
          (count / DAILY_TEST_CAPACITY) * 100;

        return {
          name,
          count,
          percentage,
          barWidth: Math.min(
            percentage,
            100
          ),
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [todayResults]);

  // ==========================================
  // TODAY'S PARAMETER FLAGS
  // ==========================================
  const flagCounts = useMemo(() => {
    const counts = {
      HIGH: 0,
      LOW: 0,
      NORMAL: 0,
      ABNORMAL: 0,
      UNASSESSED: 0,
    };

    todayResults.forEach((result) => {
      (result.parameters || []).forEach(
        (parameter) => {
          const flag =
            parameter.flag;

          if (
            Object.prototype.hasOwnProperty.call(
              counts,
              flag
            )
          ) {
            counts[flag] += 1;
          }
        }
      );
    });

    return counts;
  }, [todayResults]);

  return (
    <div className="min-h-screen bg-gray-50">

      <Sidebar />

      <main className="lg:ml-64 min-h-screen">

        <Header
          title="Analytics"
          user="MS"
        />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 pb-8">

          {/* ===================================== */}
          {/* PAGE HEADER */}
          {/* ===================================== */}
          <section className="mb-6">

            <p className="text-xs uppercase tracking-wider text-gray-500">
              Daily Laboratory Monitoring
            </p>

            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mt-2">
              Laboratory Analytics
            </h1>

            <p className="mt-1 text-sm text-gray-500 max-w-2xl">
              Monitor today's laboratory workload,
              patient activity, test distribution,
              and parameter classifications.
            </p>

          </section>

          {/* ===================================== */}
          {/* ERROR */}
          {/* ===================================== */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* ===================================== */}
          {/* LOADING */}
          {/* ===================================== */}
          {loading ? (

            <div className="bg-white border border-gray-200 rounded-xl min-h-[420px] flex flex-col items-center justify-center">

              <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mb-3" />

              <p className="text-sm text-gray-500">
                Loading today's analytics...
              </p>

            </div>

          ) : (

            <>

              {/* ===================================== */}
              {/* TODAY'S STATUS */}
              {/* ===================================== */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">

                <AnalyticsCard
                  label="Today's Results"
                  value={statusCounts.total}
                  description="Submitted today"
                />

                <AnalyticsCard
                  label="Pending"
                  value={statusCounts.pending}
                  description="Awaiting review"
                />

                <AnalyticsCard
                  label="Approved"
                  value={statusCounts.approved}
                  description="Approved today"
                />

                <AnalyticsCard
                  label="Rejected"
                  value={statusCounts.rejected}
                  description="Rejected today"
                />

                <AnalyticsCard
                  label="Cancelled"
                  value={statusCounts.cancelled}
                  description="Cancelled today"
                />

              </div>

              {/* ===================================== */}
              {/* PATIENT + TEST ACTIVITY */}
              {/* ===================================== */}
              <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">

                {/* ===================================== */}
                {/* PATIENT ACTIVITY */}
                {/* ===================================== */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6">

                  <div className="mb-5">

                    <h2 className="text-base font-semibold text-gray-900">
                      Patients with Results Today
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Unique patients represented in today's laboratory submissions.
                    </p>

                  </div>

                  <div className="flex items-end justify-between mb-3">

                    <div>

                      <p className="text-3xl font-semibold text-gray-900">
                        {patientsToday}
                      </p>

                      <p className="text-xs text-gray-500 mt-1">
                        unique patients today
                      </p>

                    </div>

                    <div className="text-right">

                      <p className="text-xs text-gray-500">
                        Daily baseline
                      </p>

                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {DAILY_PATIENT_CAPACITY.toLocaleString()}
                      </p>

                    </div>

                  </div>

                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">

                    <div
                      className="h-full bg-gray-900 rounded-full transition-all duration-500"
                      style={{
                        width:
                          `${patientBarWidth}%`,
                      }}
                    />

                  </div>

                  <div className="flex items-center justify-between mt-2">

                    <p className="text-[11px] text-gray-500">
                      {patientPercentage.toFixed(1)}% of baseline
                    </p>

                    {patientsToday >
                    DAILY_PATIENT_CAPACITY ? (
                      <p className="text-[11px] font-medium text-red-600">
                        +{patientsToday -
                          DAILY_PATIENT_CAPACITY}{" "}
                        above baseline
                      </p>
                    ) : (
                      <p className="text-[11px] text-gray-400">
                        Resets by date
                      </p>
                    )}

                  </div>

                </div>

                {/* ===================================== */}
                {/* TEST ACTIVITY */}
                {/* ===================================== */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6">

                  <div className="mb-5">

                    <h2 className="text-base font-semibold text-gray-900">
                      Today's Laboratory Test Activity
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Each laboratory test type has its own 1,000-result daily baseline.
                    </p>

                  </div>

                  {testActivity.length === 0 ? (

                    <div className="py-8 text-center">

                      <p className="text-sm font-semibold text-gray-800">
                        No laboratory tests recorded today.
                      </p>

                      <p className="text-xs text-gray-500 mt-1">
                        Today's test activity will appear here after new results are submitted.
                      </p>

                    </div>

                  ) : (

                    <div className="space-y-5">

                      {testActivity.map((item) => (
                        <div key={item.name}>

                          <div className="flex items-center justify-between mb-2">

                            <span className="text-sm text-gray-700">
                              {item.name}
                            </span>

                            <span className="text-sm font-semibold text-gray-900">
                              {item.count}
                            </span>

                          </div>

                          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">

                            <div
                              className="h-full bg-gray-900 rounded-full transition-all duration-500"
                              style={{
                                width:
                                  `${item.barWidth}%`,
                              }}
                            />

                          </div>

                          <div className="flex items-center justify-between mt-1">

                            <p className="text-[11px] text-gray-400">
                              {item.count}{" "}
                              {item.count === 1
                                ? "test"
                                : "tests"}{" "}
                              today
                            </p>

                            <p className="text-[11px] text-gray-500">
                              {item.percentage.toFixed(1)}%
                            </p>

                          </div>

                        </div>
                      ))}

                    </div>

                  )}

                </div>

              </section>

              {/* ===================================== */}
              {/* PARAMETER CLASSIFICATION */}
              {/* ===================================== */}
              <section className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 mb-6">

                <div className="mb-5">

                  <h2 className="text-base font-semibold text-gray-900">
                    Today's Parameter Classification
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Stored parameter flags from today's laboratory results.
                  </p>

                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">

                  <FlagCard
                    label="HIGH"
                    value={flagCounts.HIGH}
                    className="bg-red-50 border-red-100 text-red-700"
                  />

                  <FlagCard
                    label="LOW"
                    value={flagCounts.LOW}
                    className="bg-orange-50 border-orange-100 text-orange-700"
                  />

                  <FlagCard
                    label="NORMAL"
                    value={flagCounts.NORMAL}
                    className="bg-green-50 border-green-100 text-green-700"
                  />

                  <FlagCard
                    label="ABNORMAL"
                    value={flagCounts.ABNORMAL}
                    className="bg-red-50 border-red-100 text-red-700"
                  />

                  <FlagCard
                    label="UNASSESSED"
                    value={flagCounts.UNASSESSED}
                    className="bg-gray-50 border-gray-200 text-gray-600"
                  />

                </div>

              </section>

              {/* ===================================== */}
              {/* ANALYTICS DATA SOURCE */}
              {/* ===================================== */}
              <section className="bg-white border border-gray-200 rounded-xl p-6 sm:p-7">

                <p className="text-xs uppercase tracking-wider text-gray-500">
                  Analytics Methodology
                </p>

                <h2 className="text-lg font-semibold text-gray-900 mt-2">
                  Daily Reporting and Data Source
                </h2>

                <div className="mt-4 space-y-3 text-sm leading-6 text-gray-600">

                  <p>
                    The analytics displayed on this page are calculated
                    from laboratory result records stored in the system
                    database and filtered to the current calendar day.
                  </p>

                  <p>
                    The patient-volume indicator uses a fixed 1,000-patient
                    baseline. Values above 1,000 are displayed as greater
                    than 100 percent to indicate that the baseline has
                    been exceeded.
                  </p>

                  <p>
                    Each laboratory test type uses its own independent
                    1,000-result daily baseline. For example, Fasting Blood
                    Sugar and Complete Blood Count each have separate daily
                    counts and progress values.
                  </p>

                  <p>
                    Historical laboratory records are not deleted when
                    the date changes. They remain permanently available
                    through the History module.
                  </p>

                </div>

              </section>

            </>

          )}

        </div>

      </main>

    </div>
  );
}

function AnalyticsCard({
  label,
  value,
  description,
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">

      <p className="text-xs font-medium text-gray-500">
        {label}
      </p>

      <p className="mt-1 text-2xl font-semibold text-gray-900">
        {value}
      </p>

      <p className="mt-1 text-[11px] text-gray-400">
        {description}
      </p>

    </div>
  );
}

function FlagCard({
  label,
  value,
  className,
}) {
  return (
    <div
      className={
        "border rounded-xl p-4 " +
        className
      }
    >

      <p className="text-xs font-semibold">
        {label}
      </p>

      <p className="text-2xl font-semibold text-gray-900 mt-2">
        {value}
      </p>

    </div>
  );
}