import { useEffect, useMemo, useState } from "react";
import DoctorSidebar from "../../components/doctor/DoctorSidebar";

import { API_URL } from "../../config";

export default function ApprovedResults() {
  const [approvedResults, setApprovedResults] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [selectedResult, setSelectedResult] = useState(null);

  // ==========================================
  // LOAD APPROVED RESULTS
  // ==========================================
  const fetchApprovedResults = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        API_URL + "/lab-results",
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to retrieve approved laboratory results."
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          "Unable to retrieve approved laboratory results."
        );
      }

      const results = data.lab_results || [];

      setApprovedResults(
        results.filter(
          (result) =>
            result.status === "APPROVED"
        )
      );
    } catch (err) {
      console.error(
        "Approved results error:",
        err
      );

      setError(
        err.message ||
          "Unable to connect to the laboratory results database."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovedResults();
  }, []);

  // ==========================================
  // SEARCH
  // ==========================================
  const filteredResults = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return approvedResults;
    }

    return approvedResults.filter((result) => {
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
        patientName
          .toLowerCase()
          .includes(query) ||
        String(patient.patient_id || "")
          .toLowerCase()
          .includes(query) ||
        String(testType.name || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [approvedResults, search]);

  // ==========================================
  // HELPERS
  // ==========================================
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

  const getPatientName = (patient) => {
    return [
      patient?.first_name,
      patient?.middle_name,
      patient?.last_name,
    ]
      .filter(Boolean)
      .join(" ");
  };

  const getFlagClass = (flag) => {
    if (
      flag === "HIGH" ||
      flag === "ABNORMAL"
    ) {
      return "bg-red-100 text-red-700";
    }

    if (flag === "LOW") {
      return "bg-orange-100 text-orange-700";
    }

    if (flag === "NORMAL") {
      return "bg-green-100 text-green-700";
    }

    return "bg-gray-100 text-gray-600";
  };

  return (
    <div className="min-h-screen bg-gray-50">

      <DoctorSidebar />

      <main className="lg:ml-64 min-h-screen">

        {/* Desktop Header */}
        <header className="hidden lg:flex fixed top-0 left-64 right-0 h-16 bg-white border-b border-gray-200 z-30 items-center justify-between px-8">

          <h1 className="text-sm font-semibold text-gray-900">
            Approved Results
          </h1>

          <div className="flex items-center gap-3">

            <span className="text-xs text-gray-500">
              {new Date().toLocaleDateString(
                "en-US",
                {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }
              )}
            </span>

            <div className="w-9 h-9 rounded-full bg-[#111827] text-white flex items-center justify-center text-xs font-semibold">
              DR
            </div>

          </div>

        </header>

        {/* Mobile Header */}
        <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-30 flex items-center justify-end px-4">

          <div className="w-9 h-9 rounded-full bg-[#111827] text-white flex items-center justify-center text-xs font-semibold">
            DR
          </div>

        </header>

        {/* Content */}
        <div className="pt-20 px-4 sm:px-6 lg:px-8 pb-8">

          {/* PAGE HEADING */}
          <section className="mb-8">

            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">
              Laboratory Records
            </p>

            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900">
              Approved Results
            </h2>

            <p className="text-sm text-gray-500 mt-2 max-w-2xl">
              View laboratory results that have been reviewed and approved by the doctor.
            </p>

          </section>

          {/* ERROR */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* SUMMARY */}
          <section className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 mb-6">

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

              <div>

                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Approved Results
                </p>

                <p className="text-3xl font-semibold text-gray-900 mt-2">
                  {loading
                    ? "—"
                    : approvedResults.length}
                </p>

              </div>

              <div className="w-full lg:max-w-md">

                <input
                  type="text"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                  }}
                  placeholder="Search patient, ID, or test..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                />

              </div>

            </div>

          </section>

          {/* RESULTS */}
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">

            {loading ? (

              <div className="min-h-[400px] flex flex-col items-center justify-center">

                <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mb-3" />

                <p className="text-sm text-gray-500">
                  Loading approved laboratory results...
                </p>

              </div>

            ) : filteredResults.length === 0 ? (

              <div className="min-h-[400px] flex flex-col items-center justify-center px-6 text-center">

                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">

                  <svg
                    className="w-6 h-6 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="1.6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4"
                    />

                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 3a9 9 0 100 18 9 9 0 000-18z"
                    />
                  </svg>

                </div>

                <h3 className="mt-5 text-base font-semibold text-gray-900">
                  {approvedResults.length === 0
                    ? "No approved results"
                    : "No matching results"}
                </h3>

                <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
                  {approvedResults.length === 0
                    ? "Approved laboratory results will appear here after Doctor review."
                    : "Try another patient name, ID, or laboratory test."}
                </p>

              </div>

            ) : (

              <div className="overflow-x-auto">

                <table className="w-full min-w-[850px]">

                  <thead className="bg-gray-50 border-b border-gray-200">

                    <tr>

                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">
                        Patient
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">
                        Test Type
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">
                        Date Approved
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">
                        Reviewed By
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">
                        Status
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">
                        Action
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-gray-200">

                    {filteredResults.map((result) => {

                      const patient =
                        result.patient || {};

                      const testType =
                        result.test_type || {};

                      const reviewer =
                        result.reviewer || {};

                      return (
                        <tr
                          key={result.id}
                          className="hover:bg-gray-50"
                        >

                          <td className="px-5 py-4">

                            <p className="text-sm font-medium text-gray-900">
                              {getPatientName(
                                patient
                              ) || "—"}
                            </p>

                            <p className="text-xs text-gray-500 mt-1">
                              {patient.patient_id ||
                                "—"}
                            </p>

                          </td>

                          <td className="px-5 py-4 text-sm text-gray-700">
                            {testType.name || "—"}
                          </td>

                          <td className="px-5 py-4 text-sm text-gray-600">
                            {formatDate(
                              result.approved_at ||
                                result.created_at
                            )}
                          </td>

                          <td className="px-5 py-4 text-sm text-gray-600">
                            {reviewer.username ||
                              reviewer.name ||
                              "Doctor"}
                          </td>

                          <td className="px-5 py-4">

                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                              APPROVED
                            </span>

                          </td>

                          <td className="px-5 py-4 text-right">

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedResult(
                                  result
                                );
                              }}
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

      {/* ===================================== */}
      {/* APPROVED RESULT DETAILS */}
      {/* ===================================== */}
      {selectedResult && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setSelectedResult(null);
            }}
          />

          <div className="relative bg-white w-full max-w-5xl rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">

            {/* HEADER */}
            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">

              <div>

                <h2 className="text-xl font-semibold text-gray-900">
                  Approved Laboratory Result
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {selectedResult.test_type?.name ||
                    "Laboratory Test"}
                </p>

              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedResult(null);
                }}
                className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-500 text-xl"
              >
                ×
              </button>

            </div>

            {/* BODY */}
            <div className="p-6 space-y-6">

              {/* PATIENT INFORMATION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                <div>

                  <p className="text-xs text-gray-500">
                    Patient
                  </p>

                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {getPatientName(
                      selectedResult.patient
                    ) || "—"}
                  </p>

                </div>

                <div>

                  <p className="text-xs text-gray-500">
                    Patient ID
                  </p>

                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {selectedResult.patient
                      ?.patient_id || "—"}
                  </p>

                </div>

                <div>

                  <p className="text-xs text-gray-500">
                    Laboratory Test
                  </p>

                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {selectedResult.test_type
                      ?.name || "—"}
                  </p>

                </div>

                <div>

                  <p className="text-xs text-gray-500">
                    Approved
                  </p>

                  <p className="mt-1 text-sm text-gray-900">
                    {formatDate(
                      selectedResult.approved_at
                    )}
                  </p>

                </div>

              </div>

              {/* PARAMETERS */}
              <div>

                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Laboratory Parameters
                </h3>

                <div className="border border-gray-200 rounded-xl overflow-hidden">

                  {(selectedResult.parameters ||
                    []).length > 0 ? (

                    <table className="w-full text-left">

                      <thead className="bg-gray-50 border-b border-gray-200">

                        <tr>

                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                            Parameter
                          </th>

                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                            Result
                          </th>

                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                            Unit
                          </th>

                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                            Reference
                          </th>

                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                            Flag
                          </th>

                        </tr>

                      </thead>

                      <tbody className="divide-y divide-gray-200">

                        {selectedResult.parameters.map(
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
                                ? Number(parameter.reference_low) +
                                  " - " +
                                  Number(parameter.reference_high)
                                : parameter.reference_text ||
                                  "—";

                            return (
                              <tr
                                key={parameter.id}
                              >

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

                                <td className="px-4 py-4">

                                  <span
                                    className={
                                      "inline-flex px-2.5 py-1 rounded-full text-xs font-semibold " +
                                      getFlagClass(
                                        parameter.flag
                                      )
                                    }
                                  >
                                    {parameter.flag ||
                                      "UNASSESSED"}
                                  </span>

                                </td>

                              </tr>
                            );
                          }
                        )}

                      </tbody>

                    </table>

                  ) : (

                    <div className="py-10 text-center">

                      <p className="text-sm text-gray-500">
                        No laboratory parameters recorded.
                      </p>

                    </div>

                  )}

                </div>

              </div>

              {/* STATUS */}
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">

                <p className="text-xs font-medium text-green-700">
                  Result status
                </p>

                <p className="mt-1 text-sm font-semibold text-green-800">
                  APPROVED
                </p>

                <p className="mt-1 text-xs text-green-700">
                  This result has been reviewed and approved by the Doctor.
                </p>

              </div>

              {/* FUTURE AI NOTE */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">

                <p className="text-xs font-medium text-gray-600">
                  Next workflow stage
                </p>

                <p className="mt-1 text-sm text-gray-700">
                  Patient release and AI recommendation processing will be handled in the later workflow stages.
                </p>

              </div>

            </div>

            {/* FOOTER */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">

              <button
                type="button"
                onClick={() => {
                  setSelectedResult(null);
                }}
                className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800"
              >
                Close
              </button>

            </div>

          </div>

        </div>
      )}

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

function getPatientName(patient) {
  return [
    patient?.first_name,
    patient?.middle_name,
    patient?.last_name,
  ]
    .filter(Boolean)
    .join(" ");
}

function getFlagClass(flag) {
  if (
    flag === "HIGH" ||
    flag === "ABNORMAL"
  ) {
    return "bg-red-100 text-red-700";
  }

  if (flag === "LOW") {
    return "bg-orange-100 text-orange-700";
  }

  if (flag === "NORMAL") {
    return "bg-green-100 text-green-700";
  }

  return "bg-gray-100 text-gray-600";
}