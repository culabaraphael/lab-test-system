import { useEffect, useMemo, useState } from "react";
import DoctorSidebar from "../../components/doctor/DoctorSidebar";

import { API_URL } from "../../config";

export default function DoctorHistory() {
  const [results, setResults] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] =
    useState(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
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
          "Failed to retrieve laboratory history."
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          "Unable to retrieve laboratory history."
        );
      }

      setResults(data.lab_results || []);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load laboratory history."
      );
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return results.filter((result) => {
      const patient =
        result.patient || {};

      const name = [
        patient.first_name,
        patient.middle_name,
        patient.last_name,
      ]
        .filter(Boolean)
        .join(" ");

      const test =
        result.test_type?.name || "";

      const matchesSearch =
        !query ||
        name.toLowerCase().includes(query) ||
        String(
          patient.patient_id || ""
        )
          .toLowerCase()
          .includes(query) ||
        test.toLowerCase().includes(query);

      const matchesStatus =
        status === "ALL" ||
        result.status === status;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [results, search, status]);

  return (
    <div className="min-h-screen bg-gray-50">
      <DoctorSidebar />

      <main className="lg:ml-64 min-h-screen">

        <header className="hidden lg:flex fixed top-0 left-64 right-0 h-16 bg-white border-b border-gray-200 z-30 items-center justify-between px-8">
          <h1 className="text-sm font-semibold text-gray-900">
            History
          </h1>

          <div className="w-9 h-9 rounded-full bg-[#111827] text-white flex items-center justify-center text-xs font-semibold">
            DR
          </div>
        </header>

        <div className="pt-20 px-4 sm:px-6 lg:px-8 pb-8">

          <section className="mb-7">
            <p className="text-xs uppercase tracking-wider text-gray-500">
              Laboratory Records
            </p>

            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mt-2">
              Laboratory History
            </h2>

            <p className="text-sm text-gray-500 mt-2">
              Permanent historical record of laboratory results and their review status.
            </p>
          </section>

          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <section className="bg-white border border-gray-200 rounded-xl p-5 mb-5">

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search patient, ID, or test..."
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />

              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value)
                }
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="ALL">
                  All statuses
                </option>
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

          </section>

          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">

            {loading ? (
              <div className="min-h-[400px] flex items-center justify-center">
                <div className="text-sm text-gray-500">
                  Loading history...
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="min-h-[400px] flex items-center justify-center text-center px-6">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    No historical results found
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    Try changing the search or status filter.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">

                <table className="w-full min-w-[850px]">

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

                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">
                        Action
                      </th>

                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">

                    {filtered.map((result) => {

                      const patient =
                        result.patient || {};

                      const name = [
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
                              {name || "—"}
                            </p>

                            <p className="text-xs text-gray-500 mt-1">
                              {patient.patient_id ||
                                "—"}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-sm text-gray-700">
                            {result.test_type?.name ||
                              "—"}
                          </td>

                          <td className="px-5 py-4 text-sm text-gray-600">
                            {formatDate(
                              result.submitted_at ||
                                result.created_at
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge
                              status={
                                result.status
                              }
                            />
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setSelected(result)
                              }
                              className="text-sm font-semibold text-gray-900 hover:underline"
                            >
                              View
                            </button>
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

      {selected && (
        <HistoryModal
          result={selected}
          onClose={() =>
            setSelected(null)
          }
        />
      )}
    </div>
  );
}

function HistoryModal({
  result,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      <div className="relative bg-white w-full max-w-5xl rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">

        <div className="px-6 py-5 border-b border-gray-200 flex justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Laboratory Result
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Historical record
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-500 text-xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            <Info
              label="Patient"
              value={getPatientName(
                result.patient
              )}
            />

            <Info
              label="Patient ID"
              value={
                result.patient?.patient_id
              }
            />

            <Info
              label="Laboratory Test"
              value={
                result.test_type?.name
              }
            />

            <Info
              label="Status"
              value={result.status}
            />

            <Info
              label="Submitted"
              value={formatDate(
                result.submitted_at ||
                  result.created_at
              )}
            />

            <Info
              label="Approved"
              value={formatDate(
                result.approved_at
              )}
            />

          </div>

          {result.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">

              <p className="text-xs font-semibold text-red-800">
                Rejection Reason
              </p>

              <p className="text-sm text-red-700 mt-1">
                {result.rejection_reason}
              </p>

            </div>
          )}

          <div className="border border-gray-200 rounded-xl overflow-hidden">

            <table className="w-full">

              <thead className="bg-gray-50 border-b border-gray-200">

                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                    Parameter
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                    Result
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                    Unit
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                    Reference
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                    Flag
                  </th>
                </tr>

              </thead>

              <tbody className="divide-y divide-gray-100">

                {(result.parameters || []).map(
                  (parameter) => {

                    const value =
                      parameter.value_numeric !==
                        null &&
                      parameter.value_numeric !==
                        undefined
                        ? String(Number(parameter.value_numeric))
                        : parameter.value_text ||
                          "—";

                    const reference =
                      parameter.reference_low !==
                        null &&
                      parameter.reference_high !==
                        null
                        ? `${Number(parameter.reference_low)} - ${Number(parameter.reference_high)}`
                        : parameter.reference_text ||
                          "—";

                    return (
                      <tr key={parameter.id}>

                        <td className="px-4 py-4 text-sm font-medium text-gray-900">
                          {parameter.parameter_name}
                        </td>

                        <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                          {value}
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-600">
                          {parameter.unit ||
                            "—"}
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-600">
                          {reference}
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-600">
                          {parameter.flag ||
                            "UNASSESSED"}
                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>

        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-gray-900">
        {value || "—"}
      </p>
    </div>
  );
}

function getPatientName(patient) {
  return [
    patient?.first_name,
    patient?.middle_name,
    patient?.last_name,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function StatusBadge({ status }) {
  let className =
    "bg-gray-100 text-gray-600";

  if (status === "PENDING_REVIEW") {
    className =
      "bg-yellow-100 text-yellow-700";
  }

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
        "inline-flex px-2.5 py-1 rounded-full text-xs font-semibold " +
        className
      }
    >
      {status}
    </span>
  );
}