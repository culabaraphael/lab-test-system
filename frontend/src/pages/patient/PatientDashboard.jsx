import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { API_URL } from "../../config";

// Drop trailing zeros from numeric strings ("10.0000" -> "10"); leave text alone.
const fmtNum = (v) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v))
    ? v
    : String(Number(v));

export default function PatientDashboard() {
  // The QR code opens /patient/dashboard?token=...
  // Patients do not log in; the short-lived token identifies
  // the single released result (see LabResultController::showByToken).
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [patient, setPatient] = useState(null);
  const [results, setResults] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setPatient(null);
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }

    fetchResultByToken();
  }, [token]);

  const fetchResultByToken = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/lab-results/access/${encodeURIComponent(token)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message ||
            "Unable to retrieve your laboratory result."
        );
      }

      const labResult = data.lab_result;

      setPatient(labResult?.patient || null);
      setResults(labResult ? [labResult] : []);
    } catch (err) {
      console.error("Patient Dashboard error:", err);

      setPatient(null);
      setResults([]);

      setError(
        err instanceof TypeError
          ? "Cannot reach the server. Please try again or ask the Counter/Nurse for help."
          : err.message ||
              "Unable to retrieve your laboratory result."
      );
    } finally {
      setLoading(false);
    }
  };

  const getPatientName = () => {
    if (!patient) return "";

    return `${patient.first_name || ""} ${
      patient.middle_name
        ? `${patient.middle_name} `
        : ""
    }${patient.last_name || ""}`.trim();
  };

  const getTestName = (result) => {
    return (
      result.test_type?.name ||
      result.testType?.name ||
      result.test_type?.test_name ||
      result.testType?.test_name ||
      "Laboratory Test"
    );
  };

  const getDate = (result) => {
    const date =
      result.approved_at ||
      result.submitted_at ||
      result.created_at;

    if (!date) return "Date unavailable";

    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">

          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Lab Result System
            </h1>

            <p className="text-sm text-gray-500">
              Patient Portal
            </p>
          </div>

      

        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-10">

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Laboratory Result
          </h2>

          <p className="text-gray-600 mt-1">
            View your released laboratory test result.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">

            <div className="mx-auto w-10 h-10 border-4 border-gray-200 border-t-gray-700 rounded-full animate-spin mb-4" />

            <p className="text-gray-500">
              Loading laboratory result...
            </p>

          </section>
        )}

        {/* Error */}
        {!loading && error && (
          <section className="bg-white rounded-xl border border-red-200 shadow-sm p-8">

            <div className="bg-red-50 rounded-lg p-5 text-center">

              <h3 className="font-semibold text-red-800">
                Result Not Available
              </h3>

              <p className="text-sm text-red-600 mt-1">
                {error}
              </p>

            </div>

          </section>
        )}

        {/* Empty */}
        {!loading && !error && !token && (
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-10">

            <div className="border border-dashed border-gray-300 rounded-xl py-14 text-center">

              <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-5">

                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h6l5 5v11a2 2 0 01-2 2z"
                  />
                </svg>

              </div>

              <h3 className="text-lg font-semibold text-gray-900">
                No Laboratory Result
              </h3>

              <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                Scan the QR code provided by the laboratory
                to access your released laboratory result.
              </p>

            </div>

          </section>
        )}

        {/* Patient + Results */}
        {!loading && !error && patient && (
          <div className="space-y-6">

            {/* Patient Information */}
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">

              <h3 className="text-lg font-semibold text-gray-900 mb-5">
                Patient Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                <div>
                  <p className="text-xs text-gray-500 uppercase">
                    Patient Name
                  </p>

                  <p className="font-medium text-gray-900 mt-1">
                    {getPatientName()}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500 uppercase">
                    Patient ID
                  </p>

                  <p className="font-medium text-gray-900 mt-1">
                    {patient.patient_id}
                  </p>
                </div>

              </div>

            </section>

            {/* Laboratory Results */}
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">

              <div className="mb-5">

                <h3 className="text-lg font-semibold text-gray-900">
                  Laboratory Result
                </h3>

                <p className="text-sm text-gray-500 mt-1">
                  Your laboratory test result.
                </p>

              </div>

              {results.length === 0 ? (

                <div className="border border-dashed border-gray-300 rounded-xl py-12 text-center">

                  <h4 className="font-semibold text-gray-900">
                    No Laboratory Result
                  </h4>

                  <p className="text-sm text-gray-500 mt-1">
                    No laboratory result has been recorded
                    for this patient.
                  </p>

                </div>

              ) : (

                <div className="space-y-5">

                  {results.map((result) => (

                    <div
                      key={result.id}
                      className="border border-gray-200 rounded-xl p-5"
                    >

                      {/* Test Header */}
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">

                        <div>

                          <h4 className="text-lg font-semibold text-gray-900">
                            {getTestName(result)}
                          </h4>

                          <p className="text-sm text-gray-500 mt-1">
                            Date: {getDate(result)}
                          </p>

                        </div>

                        <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold w-fit">
                          {String(result.status || "UNKNOWN").replaceAll(
                            "_",
                            " "
                          )}
                        </span>

                      </div>

                      {/* Parameters */}
                      {Array.isArray(result.parameters) &&
                      result.parameters.length > 0 ? (

                        <div className="overflow-x-auto">

                          <table className="w-full text-sm">

                            <thead>

                              <tr className="border-b border-gray-200 text-left">

                                <th className="py-3 pr-4 font-semibold text-gray-700">
                                  Parameter
                                </th>

                                <th className="py-3 pr-4 font-semibold text-gray-700">
                                  Result
                                </th>

                                <th className="py-3 pr-4 font-semibold text-gray-700">
                                  Unit
                                </th>

                                <th className="py-3 pr-4 font-semibold text-gray-700">
                                  Reference
                                </th>

                                <th className="py-3 font-semibold text-gray-700">
                                  Status
                                </th>

                              </tr>

                            </thead>

                            <tbody>

                              {result.parameters.map(
                                (parameter) => (

                                  <tr
                                    key={parameter.id}
                                    className="border-b border-gray-100"
                                  >

                                    <td className="py-4 pr-4 text-gray-900">
                                      {parameter.parameter_name ||
                                        "Parameter"}
                                    </td>

                                    <td className="py-4 pr-4 font-medium text-gray-900">
                                      {fmtNum(parameter.value_numeric) ??
                                        parameter.value_text ??
                                        "—"}
                                    </td>

                                    <td className="py-4 pr-4 text-gray-600">
                                      {parameter.unit || "—"}
                                    </td>

                                    <td className="py-4 pr-4 text-gray-600">

                                      {parameter.reference_text ||
                                      parameter.reference_low !==
                                        null ||
                                      parameter.reference_high !==
                                        null
                                        ? parameter.reference_text ||
                                          `${fmtNum(parameter.reference_low) ?? ""}${
                                            parameter.reference_low !==
                                              null &&
                                            parameter.reference_high !==
                                              null
                                              ? " – "
                                              : ""
                                          }${
                                            fmtNum(parameter.reference_high) ??
                                            ""
                                          }`
                                        : "—"}

                                    </td>

                                    <td className="py-4">
                                      {(() => {
                                        const flag = String(
                                          parameter.flag || "UNASSESSED"
                                        ).toUpperCase();

                                        const styles = {
                                          NORMAL: "bg-green-100 text-green-700",
                                          HIGH: "bg-red-100 text-red-700",
                                          ABNORMAL: "bg-red-100 text-red-700",
                                          LOW: "bg-orange-100 text-orange-700",
                                        };

                                        if (!styles[flag]) {
                                          return (
                                            <span className="text-gray-400">
                                              —
                                            </span>
                                          );
                                        }

                                        return (
                                          <span
                                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${styles[flag]}`}
                                          >
                                            {flag}
                                          </span>
                                        );
                                      })()}
                                    </td>

                                  </tr>

                                )
                              )}

                            </tbody>

                          </table>

                        </div>

                      ) : (

                        <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">

                          <p className="text-sm text-gray-500">
                            No parameter results are available.
                          </p>

                        </div>

                      )}

                      {/* All-normal notice (Figure 3-9: no LLM call when nothing is abnormal) */}
                      {Array.isArray(result.parameters) &&
                        result.parameters.length > 0 &&
                        result.parameters.every(
                          (p) =>
                            String(p.flag || "").toUpperCase() === "NORMAL"
                        ) && (
                          <div className="mt-5 border border-green-200 bg-green-50 rounded-xl p-5">
                            <p className="text-sm text-green-800 font-medium">
                              All of your results are within the normal range.
                            </p>
                            <p className="text-xs text-green-700 mt-1">
                              If you have questions about your result, please
                              consult your doctor.
                            </p>
                          </div>
                        )}

                      {/* AI Health Recommendation */}
                      {result.ai_recommendation?.recommendation_text && (

                        <div className="mt-5 border border-blue-200 bg-blue-50 rounded-xl p-5">

                          <div className="flex items-center gap-2 mb-3">

                            <svg
                              className="w-5 h-5 text-blue-700 flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                              />
                            </svg>

                            <h4 className="text-sm font-semibold text-blue-900">
                              Health Information (AI-Generated)
                            </h4>

                          </div>

                          <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                            {result.ai_recommendation.recommendation_text}
                          </p>

                          <div className="mt-4 pt-4 border-t border-blue-200">

                            <p className="text-xs text-blue-800 font-medium">
                              This information was generated by AI to help you
                              understand your result. It is not a medical
                              diagnosis or treatment plan. Please consult your
                              doctor or visit your local health office for
                              proper medical advice.
                            </p>

                          </div>

                        </div>

                      )}

                    </div>

                  ))}

                </div>

              )}

            </section>

          </div>
        )}

      </main>
    </div>
  );
}