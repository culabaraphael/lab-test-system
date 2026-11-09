import { useEffect, useMemo, useState } from "react";
import DoctorSidebar from "../../components/doctor/DoctorSidebar";
import Header from "../../components/common/Header";

import { API_URL } from "../../config";

const DAILY_PATIENT_CAPACITY = 1000;
const DAILY_TEST_CAPACITY = 1000;

export default function DoctorDashboard() {
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
          "Failed to retrieve laboratory results."
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          "Unable to retrieve laboratory results."
        );
      }

      setResults(data.lab_results || []);
    } catch (err) {
      console.error("Doctor dashboard error:", err);

      setError(
        err.message ||
          "Unable to connect to the laboratory database."
      );
    } finally {
      setLoading(false);
    }
  };

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

  const todayResults = useMemo(() => {
    return results.filter((result) =>
      isToday(
        result.submitted_at ||
          result.created_at
      )
    );
  }, [results]);

  const stats = useMemo(() => {
    return {
      total: todayResults.length,

      // All results still waiting for review, not only today's.
      pending: results.filter(
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
  }, [todayResults, results]);

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
  // CURRENT REVIEW QUEUE
  // ==========================================
  const reviewQueue = useMemo(() => {
    return [...results]
      .filter(
        (result) =>
          result.status === "PENDING_REVIEW"
      )
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
      .slice(0, 5);
  }, [results]);

  return (
    <div className="min-h-screen bg-gray-50">

      <DoctorSidebar />

      <main className="lg:ml-64 min-h-screen">

        <Header
          title="Doctor Dashboard"
          user="DR"
        />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 pb-8">

          {/* PAGE INTRO */}
          <section className="mb-7">

            <p className="text-xs uppercase tracking-wider text-gray-500">
              Medical Review
            </p>

            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mt-2">
              Doctor Dashboard
            </h1>

            <p className="text-sm text-gray-500 mt-2 max-w-2xl">
              Today's laboratory review activity,
              patient activity, and current review queue.
            </p>

          </section>

          {/* ERROR */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* TOP METRICS */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">

            <MetricCard
              title="Today's Results"
              value={loading ? "—" : stats.total}
              description="Submitted today"
            />

            <MetricCard
              title="Pending Review"
              value={loading ? "—" : stats.pending}
              description="All results awaiting review"
            />

            <MetricCard
              title="Approved Today"
              value={loading ? "—" : stats.approved}
              description="Approved today"
            />

            <MetricCard
              title="Rejected Today"
              value={loading ? "—" : stats.rejected}
              description="Returned for correction"
            />

            <MetricCard
              title="Cancelled Today"
              value={loading ? "—" : stats.cancelled}
              description="Cancelled today"
            />

          </section>

          {/* PATIENT + TEST ACTIVITY */}
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-6">

            {/* PATIENT ACTIVITY */}
            <div className="bg-white border border-gray-200 rounded-xl">

              <div className="px-5 py-4 border-b border-gray-200">

                <h2 className="text-sm font-semibold text-gray-900">
                  Patients with Results Today
                </h2>

                <p className="text-xs text-gray-500 mt-1">
                  Unique patients represented in today's laboratory submissions.
                </p>

              </div>

              <div className="p-5">

                <div className="flex items-end justify-between mb-3">

                  <div>

                    <p className="text-3xl font-semibold text-gray-900">
                      {loading ? "—" : patientsToday}
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      patients today
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

                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">

                  <div
                    className="h-full bg-gray-900 rounded-full transition-all duration-500"
                    style={{
                      width: `${patientBarWidth}%`,
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
                      +{patientsToday - DAILY_PATIENT_CAPACITY} above baseline
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-400">
                      Resets by date
                    </p>
                  )}

                </div>

              </div>

            </div>

            {/* TEST ACTIVITY */}
            <div className="bg-white border border-gray-200 rounded-xl">

              <div className="px-5 py-4 border-b border-gray-200">

                <h2 className="text-sm font-semibold text-gray-900">
                  Today's Laboratory Test Activity
                </h2>

                <p className="text-xs text-gray-500 mt-1">
                  Each test type uses its own 1,000-result daily baseline.
                </p>

              </div>

              <div className="p-5">

                {testActivity.length === 0 ? (

                  <p className="text-sm text-gray-500 text-center py-8">
                    No laboratory tests recorded today.
                  </p>

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
                              width: `${item.barWidth}%`,
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

            </div>

          </section>

          {/* CLINICAL REVIEW QUEUE */}
          <section className="bg-white border border-gray-200 rounded-xl">

            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">

              <div>

                <h2 className="text-sm font-semibold text-gray-900">
                  Clinical Review Queue
                </h2>

                <p className="text-xs text-gray-500 mt-1">
                  Laboratory results currently waiting for Doctor review.
                </p>

              </div>

              <a
                href="/doctor/pending"
                className="text-xs font-semibold text-gray-700 hover:text-gray-900"
              >
                View all
              </a>

            </div>

            {reviewQueue.length === 0 ? (

              <div className="py-16 text-center px-6">

                <p className="text-sm font-semibold text-gray-800">
                  Review queue is clear
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  There are no pending laboratory results.
                </p>

              </div>

            ) : (

              <div className="overflow-x-auto">

                <table className="w-full min-w-[700px]">

                  <thead className="bg-gray-50 border-b border-gray-200">

                    <tr>

                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Patient
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Test
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Submitted
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Status
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-gray-100">

                    {reviewQueue.map((result) => {

                      const patient =
                        result.patient || {};

                      const patientName = [
                        patient.first_name,
                        patient.middle_name,
                        patient.last_name,
                      ]
                        .filter(Boolean)
                        .join(" ");

                      return (
                        <tr key={result.id}>

                          <td className="px-5 py-4">

                            <p className="text-sm font-medium text-gray-900">
                              {patientName || "—"}
                            </p>

                            <p className="text-xs text-gray-500 mt-1">
                              {patient.patient_id || "—"}
                            </p>

                          </td>

                          <td className="px-5 py-4 text-sm text-gray-700">
                            {result.test_type?.name || "—"}
                          </td>

                          <td className="px-5 py-4 text-sm text-gray-600">
                            {formatDate(
                              result.submitted_at ||
                                result.created_at
                            )}
                          </td>

                          <td className="px-5 py-4">

                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                              PENDING_REVIEW
                            </span>

                          </td>

                        </tr>
                      );
                    })}

                  </tbody>

                </table>

              </div>

            )}

          </section>

        </div>
      </main>

    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">

      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {title}
      </p>

      <p className="text-3xl font-semibold text-gray-900 mt-3">
        {value}
      </p>

      <p className="text-xs text-gray-500 mt-2">
        {description}
      </p>

    </div>
  );
}

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