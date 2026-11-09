
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/common/Sidebar";
import Header from "../../components/common/Header";

import { API_URL } from "../../config";

export default function ViewResults() {
  const [results, setResults] = useState([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedResult, setSelectedResult] = useState(null);

  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState({});

  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchResults = async () => {
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
      console.error(err);
      setError(
        err.message ||
          "Unable to connect to the results database."
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

    if (!query) {
      return results;
    }

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

      return (
        patientName.toLowerCase().includes(query) ||
        String(
          patient.patient_id || ""
        )
          .toLowerCase()
          .includes(query) ||
        String(
          testType.name || ""
        )
          .toLowerCase()
          .includes(query) ||
        String(
          result.status || ""
        )
          .toLowerCase()
          .includes(query)
      );
    });
  }, [results, search]);

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

  const getFlagClass = (flag) => {
    if (flag === "HIGH" || flag === "ABNORMAL") {
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

  const openResult = (result) => {
    setSelectedResult(result);
    setEditing(false);
    setError("");
    setSuccess("");

    const initialValues = {};

    (result.parameters || []).forEach((parameter) => {
      initialValues[parameter.id] =
        parameter.value_numeric !== null &&
        parameter.value_numeric !== undefined
          ? String(parameter.value_numeric)
          : parameter.value_text || "";
    });

    setEditValues(initialValues);
  };

  const closeResult = () => {
    if (saving || cancelling) {
      return;
    }

    setSelectedResult(null);
    setEditing(false);
    setEditValues({});
  };

  const handleEditValue = (parameterId, value) => {
    setEditValues((previous) => ({
      ...previous,
      [parameterId]: value,
    }));
  };

  const handleSaveEdit = async () => {
    if (!selectedResult) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const parameters = (
        selectedResult.parameters || []
      ).map((parameter) => {
        const value =
          editValues[parameter.id] ?? "";

        const isNumeric =
          parameter.reference_range_id &&
          parameter.value_numeric !== null;

        return {
          reference_range_id:
            parameter.reference_range_id || null,

          parameter_name:
            parameter.parameter_name,

          value_numeric:
            isNumeric && value !== ""
              ? Number(value)
              : null,

          value_text:
            isNumeric
              ? null
              : value,

          unit:
            parameter.unit || null,
        };
      });

      const response = await fetch(
        API_URL +
          "/lab-results/" +
          selectedResult.id,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          body: JSON.stringify({
            parameters,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to update the laboratory result."
        );
      }

      setSuccess(
        "Result updated and resubmitted for Doctor review."
      );

      setSelectedResult(data.lab_result);
      setEditing(false);

      await fetchResults();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to update the laboratory result."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedResult) {
      return;
    }

    const reason = window.prompt(
      "Optional: enter a reason for cancelling this result."
    );

    if (reason === null) {
      return;
    }

    try {
      setCancelling(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        API_URL +
          "/lab-results/" +
          selectedResult.id +
          "/cancel",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          body: JSON.stringify({
            cancellation_reason:
              reason.trim() || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to cancel the laboratory result."
        );
      }

      setSuccess(
        "Laboratory result cancelled successfully."
      );

      setSelectedResult(data.lab_result);
      setEditing(false);

      await fetchResults();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to cancel the laboratory result."
      );
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">

      <Sidebar />

      <main className="lg:ml-64 min-h-screen">

        <Header
          title="View Results"
          user="MS"
        />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 pb-8">

          <div className="mb-6">

            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
              Laboratory Results
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              View and manage encoded laboratory results.
            </p>

          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {success && !selectedResult && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
              {success}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 mb-6">

            <input
              type="text"
              placeholder="Search patient, ID, test, or status..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              className="w-full sm:max-w-md px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />

          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

            {loading ? (

              <div className="min-h-[380px] flex flex-col items-center justify-center">

                <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mb-3" />

                <p className="text-sm text-gray-500">
                  Loading laboratory results...
                </p>

              </div>

            ) : filteredResults.length === 0 ? (

              <div className="min-h-[420px] flex flex-col items-center justify-center px-6 text-center">

                <h3 className="text-base font-semibold text-gray-900">
                  {results.length === 0
                    ? "No laboratory results"
                    : "No matching results"}
                </h3>

                <p className="mt-2 max-w-md text-sm text-gray-500">
                  {results.length === 0
                    ? "Laboratory results will appear here after they are encoded and saved."
                    : "No result matches your search."}
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
                        Date
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                        Status
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                        Actions
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
                            {formatDate(result.created_at)}
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

                          <td className="px-6 py-4">

                            <button
                              type="button"
                              onClick={() => {
                                openResult(result);
                              }}
                              className="text-sm font-medium text-gray-900 hover:underline"
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

          </div>

        </div>

      </main>

      {selectedResult && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeResult}
          />

          <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">

              <div>

                <h2 className="text-xl font-semibold text-gray-900">
                  Laboratory Result Details
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {selectedResult.patient?.patient_id || "—"}{" "}
                  •{" "}
                  {selectedResult.test_type?.name || "—"}
                </p>

              </div>

              <button
                type="button"
                onClick={closeResult}
                disabled={saving || cancelling}
                className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-500 text-xl"
              >
                ×
              </button>

            </div>

            <div className="p-6 space-y-6">

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
                  {success}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                <div>
                  <p className="text-xs text-gray-500">
                    Patient
                  </p>

                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {[
                      selectedResult.patient?.first_name,
                      selectedResult.patient?.middle_name,
                      selectedResult.patient?.last_name,
                    ]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    Test
                  </p>

                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {selectedResult.test_type?.name || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    Status
                  </p>

                  <span
                    className={
                      "inline-flex mt-1 px-2.5 py-1 rounded-full text-xs font-semibold " +
                      getStatusClass(
                        selectedResult.status
                      )
                    }
                  >
                    {selectedResult.status}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    Submitted
                  </p>

                  <p className="mt-1 text-sm text-gray-900">
                    {formatDate(
                      selectedResult.submitted_at ||
                        selectedResult.created_at
                    )}
                  </p>
                </div>

              </div>

              <div>

                <div className="flex items-center justify-between mb-4">

                  <h3 className="text-sm font-semibold text-gray-900">
                    Laboratory Parameters
                  </h3>

                  {editing && (
                    <span className="text-xs text-gray-500">
                      Editing mode
                    </span>
                  )}

                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden">

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
                          Reference
                        </th>

                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                          Flag
                        </th>

                      </tr>

                    </thead>

                    <tbody className="divide-y divide-gray-200">

                      {(selectedResult.parameters || []).map(
                        (parameter) => {

                          const reference =
                            parameter.reference_low !== null &&
                            parameter.reference_high !== null
                              ? Number(parameter.reference_low) +
                                " - " +
                                Number(parameter.reference_high) +
                                (parameter.unit
                                  ? " " +
                                    parameter.unit
                                  : "")
                              : parameter.reference_text ||
                                "—";

                          const value =
                            editValues[parameter.id] ?? "";

                          return (
                            <tr key={parameter.id}>

                              <td className="px-4 py-4 text-sm font-medium text-gray-900">
                                {parameter.parameter_name}
                              </td>

                              <td className="px-4 py-4">

                                {editing ? (

                                  <input
                                    type={
                                      parameter.value_numeric !==
                                      null
                                        ? "number"
                                        : "text"
                                    }
                                    step="any"
                                    value={value}
                                    onChange={(event) => {
                                      handleEditValue(
                                        parameter.id,
                                        event.target.value
                                      );
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                                  />

                                ) : (

                                  <span className="text-sm text-gray-900">
                                    {parameter.value_numeric !== null &&
                                    parameter.value_numeric !==
                                      undefined
                                      ? String(Number(parameter.value_numeric))
                                      : parameter.value_text ||
                                        "—"}

                                    {parameter.unit && (
                                      <span className="ml-1 text-xs text-gray-500">
                                        {parameter.unit}
                                      </span>
                                    )}
                                  </span>

                                )}

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
                                  {parameter.flag}
                                </span>

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

            <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row gap-3 sm:justify-between">

              <div>

                {selectedResult.status ===
                  "PENDING_REVIEW" && !editing && (

                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="px-5 py-2.5 border border-red-200 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
                  >
                    {cancelling
                      ? "Cancelling..."
                      : "Cancel Submission"}
                  </button>

                )}

              </div>

              <div className="flex flex-col sm:flex-row gap-3">

                {!editing &&
                  (selectedResult.status ===
                    "PENDING_REVIEW" ||
                    selectedResult.status ===
                      "REJECTED") && (

                  <button
                    type="button"
                    onClick={() => {
                      setEditing(true);
                      setError("");
                      setSuccess("");
                    }}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                  >
                    {selectedResult.status ===
                    "REJECTED"
                      ? "Edit & Resubmit"
                      : "Edit Result"}
                  </button>

                )}

                {editing && (
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
                  >
                    {saving
                      ? "Saving..."
                      : "Save & Resubmit"}
                  </button>
                )}

                {editing && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setError("");
                      setSuccess("");
                    }}
                    disabled={saving}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel Edit
                  </button>
                )}

                {!editing && (
                  <button
                    type="button"
                    onClick={closeResult}
                    className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800"
                  >
                    Close
                  </button>
                )}

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
