
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/common/Sidebar";
import Header from "../../components/common/Header";

import { API_URL } from "../../config";

export default function History() {
  const [results, setResults] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchResults = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(API_URL + "/lab-results", {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to retrieve result history.");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error("Unable to retrieve result history.");
      }

      setResults(data.lab_results || []);
    } catch (err) {
      console.error("History error:", err);

      setError(
        err.message || "Unable to connect to the result history."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const filteredResults = useMemo(() => {
    const query = search.trim().toLowerCase();

    return results.filter((result) => {
      const patient = result.patient || {};
      const testType = result.test_type || {};

      const patientName = [
        patient.first_name,
        patient.middle_name,
        patient.last_name,
      ]
        .filter(Boolean)
        .join(" ");

      const matchesSearch =
        !query ||
        patientName.toLowerCase().includes(query) ||
        String(patient.patient_id || "")
          .toLowerCase()
          .includes(query) ||
        String(testType.name || "")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        result.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [results, search, statusFilter]);

  const formatDate = (value) => {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  };

  const getStatusClass = (status) => {
    if (status === "APPROVED") {
      return "bg-green-100 text-green-700";
    }

    if (status === "REJECTED") {
      return "bg-red-100 text-red-700";
    }

    if (status === "CANCELLED") {
      return "bg-gray-100 text-gray-600";
    }

    return "bg-yellow-100 text-yellow-700";
  };

  const total = results.length;

  const pending = results.filter(
    (result) => result.status === "PENDING_REVIEW"
  ).length;

  const approved = results.filter(
    (result) => result.status === "APPROVED"
  ).length;

  const rejected = results.filter(
    (result) => result.status === "REJECTED"
  ).length;

  const cancelled = results.filter(
    (result) => result.status === "CANCELLED"
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <main className="lg:ml-64 min-h-screen">
        <Header title="History" user="MS" />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 pb-8">

          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
              Result History
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Review previously encoded laboratory results and their statuses.
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* SUMMARY */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">

            <SummaryCard
              label="Total"
              value={total}
            />

            <SummaryCard
              label="Pending"
              value={pending}
            />

            <SummaryCard
              label="Approved"
              value={approved}
            />

            <SummaryCard
              label="Rejected"
              value={rejected}
            />

            <SummaryCard
              label="Cancelled"
              value={cancelled}
            />

          </div>

          {/* FILTERS */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 mb-6">

            <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">

              <input
                type="text"
                placeholder="Search patient, ID, or test..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
                className="w-full lg:max-w-md px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />

              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                }}
                className="w-full lg:w-56 px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="ALL">All statuses</option>
                <option value="PENDING_REVIEW">
                  Pending Review
                </option>
                <option value="APPROVED">
                  Approved
                </option>
                <option value="REJECTED">
                  Rejected
                </option>
                <option value="CANCELLED">
                  Cancelled
                </option>
              </select>

            </div>

          </div>

          {/* TABLE */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

            {loading ? (

              <div className="min-h-[380px] flex flex-col items-center justify-center">

                <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mb-3" />

                <p className="text-sm text-gray-500">
                  Loading result history...
                </p>

              </div>

            ) : filteredResults.length === 0 ? (

              <div className="min-h-[380px] flex flex-col items-center justify-center px-6 text-center">

                <h3 className="text-base font-semibold text-gray-900">
                  {results.length === 0
                    ? "No result history"
                    : "No matching records"}
                </h3>

                <p className="mt-2 max-w-md text-sm text-gray-500">
                  {results.length === 0
                    ? "Previous laboratory results will appear here after they are saved."
                    : "Try changing the search or status filter."}
                </p>

              </div>

            ) : (

              <div className="overflow-x-auto">

                <table className="w-full text-left">

                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>

                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                        Patient
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                        Test
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                        Submitted
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                        Status
                      </th>

                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">

                    {filteredResults.map((result) => {

                      const patient = result.patient || {};
                      const testType = result.test_type || {};

                      const patientName = [
                        patient.first_name,
                        patient.middle_name,
                        patient.last_name,
                      ]
                        .filter(Boolean)
                        .join(" ");

                      return (
                        <tr
                          key={result.id}
                          className="hover:bg-gray-50"
                        >

                          <td className="px-6 py-4">

                            <p className="text-sm font-medium text-gray-900">
                              {patientName || "—"}
                            </p>

                            <p className="text-xs text-gray-500 mt-1">
                              {patient.patient_id || "—"}
                            </p>

                          </td>

                          <td className="px-6 py-4 text-sm text-gray-700">
                            {testType.name || "—"}
                          </td>

                          <td className="px-6 py-4 text-sm text-gray-600">
                            {formatDate(
                              result.submitted_at ||
                                result.created_at
                            )}
                          </td>

                          <td className="px-6 py-4">

                            <span
                              className={
                                "inline-flex px-2.5 py-1 rounded-full text-xs font-semibold " +
                                getStatusClass(result.status)
                              }
                            >
                              {result.status}
                            </span>

                          </td>

                        </tr>
                      );
                    })}

                  </tbody>

                </table>

              </div>

            )}

          </div>

        </div>
      </main>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs font-medium text-gray-500">
        {label}
      </p>

      <p className="mt-1 text-2xl font-semibold text-gray-900">
        {value}
      </p>
    </div>
  );
}
