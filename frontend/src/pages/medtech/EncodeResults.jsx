import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../../components/common/Sidebar";
import Header from "../../components/common/Header";

import { API_URL } from "../../config";
import {
  formatMlDiagnosis,
  isLowConfidence,
  LOW_CONFIDENCE_NOTE,
} from "../../utils/mlDisplay";

const EMPTY_PARAMETER_VALUES = {};

// One-sided ranges (e.g. Total Cholesterol, SGPT, HbA1c) are shown as
// "<=" or ">=", matching computeFlag() in the backend, which treats a
// value equal to a bound as NORMAL.
function formatReferenceRange(parameter) {
  const low = parameter.low_value;
  const high = parameter.high_value;
  let text = null;

  if (low !== null && high !== null) {
    text = Number(low) + " - " + Number(high);
  } else if (high !== null) {
    text = "<= " + Number(high);
  } else if (low !== null) {
    text = ">= " + Number(low);
  }

  if (text === null) {
    return "No reference range";
  }

  return parameter.unit ? text + " " + parameter.unit : text;
}

export default function EncodeResults() {
  const [patients, setPatients] = useState([]);
  const [testTypes, setTestTypes] = useState([]);

  const [patientId, setPatientId] = useState("");

  // Several tests can be encoded at once: the checked test type IDs (in the
  // order they were checked), their parameters, and the values typed in,
  // keyed "testTypeId:referenceRangeId".
  const [selectedTestIds, setSelectedTestIds] = useState([]);
  const [parametersByTest, setParametersByTest] = useState({});

  const [parameterValues, setParameterValues] = useState(
    EMPTY_PARAMETER_VALUES
  );

  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingTests, setLoadingTests] = useState(true);
  const [loadingParameters, setLoadingParameters] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mlPredictions, setMlPredictions] = useState([]);

  // ==========================================
  // SEARCHABLE PATIENT DROPDOWN
  // ==========================================
  const [patientSearch, setPatientSearch] = useState("");
  const [patientDropdownOpen, setPatientDropdownOpen] =
    useState(false);

  const patientDropdownRef = useRef(null);

  // ==========================================
  // LOAD PATIENTS
  // ==========================================
  useEffect(() => {
    const loadPatients = async () => {
      try {
        setLoadingPatients(true);
        setError("");

        const response = await fetch(
          API_URL + "/patients",
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
            "Failed to load patient records."
          );
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(
            "Unable to retrieve patient records."
          );
        }

        setPatients(data.patients || []);
      } catch (err) {
        console.error(
          "Patients loading error:",
          err
        );

        setError(
          err.message ||
            "Unable to connect to the patient database."
        );
      } finally {
        setLoadingPatients(false);
      }
    };

    loadPatients();
  }, []);

  // ==========================================
  // LOAD TEST TYPES
  // ==========================================
  useEffect(() => {
    const loadTestTypes = async () => {
      try {
        setLoadingTests(true);

        const response = await fetch(
          API_URL + "/test-types",
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load laboratory test types."
          );
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(
            "Unable to retrieve laboratory tests."
          );
        }

        setTestTypes(data.test_types || []);
      } catch (err) {
        console.error(
          "Test type loading error:",
          err
        );

        setError(
          err.message ||
            "Unable to load laboratory test types."
        );
      } finally {
        setLoadingTests(false);
      }
    };

    loadTestTypes();
  }, []);

  // ==========================================
  // CLOSE PATIENT DROPDOWN OUTSIDE
  // ==========================================
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        patientDropdownRef.current &&
        !patientDropdownRef.current.contains(
          event.target
        )
      ) {
        setPatientDropdownOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  // ==========================================
  // PATIENT SORTING
  // NEWEST REGISTERED FIRST
  // ==========================================
  const sortedPatients = useMemo(() => {
    return [...patients].sort((a, b) => {
      const dateA = new Date(
        a.created_at || 0
      ).getTime();

      const dateB = new Date(
        b.created_at || 0
      ).getTime();

      if (
        !Number.isNaN(dateA) &&
        !Number.isNaN(dateB)
      ) {
        return dateB - dateA;
      }

      return (
        Number(b.id || 0) -
        Number(a.id || 0)
      );
    });
  }, [patients]);

  // ==========================================
  // FILTER PATIENTS
  // ==========================================
  const filteredPatients = useMemo(() => {
    const query =
      patientSearch.trim().toLowerCase();

    if (!query) {
      return sortedPatients;
    }

    return sortedPatients.filter(
      (patient) => {
        const fullName = [
          patient.first_name,
          patient.middle_name,
          patient.last_name,
        ]
          .filter(Boolean)
          .join(" ");

        const patientNumber = String(
          patient.patient_id || ""
        );

        return (
          fullName
            .toLowerCase()
            .includes(query) ||
          patientNumber
            .toLowerCase()
            .includes(query)
        );
      }
    );
  }, [
    sortedPatients,
    patientSearch,
  ]);

  // ==========================================
  // SELECTED PATIENT
  // ==========================================
  const selectedPatient = patients.find(
    (patient) =>
      String(patient.id) ===
      String(patientId)
  );

  const getPatientName = (patient) => {
    if (!patient) {
      return "";
    }

    return [
      patient.first_name,
      patient.middle_name,
      patient.last_name,
    ]
      .filter(Boolean)
      .join(" ");
  };

  const handlePatientSelect = (patient) => {
    setPatientId(String(patient.id));

    setPatientSearch("");

    setPatientDropdownOpen(false);

    setError("");
    setSuccess("");
  };

  // ==========================================
  // LOAD PARAMETERS OF EVERY CHECKED TEST
  // (reloaded when the patient's sex changes, because some ranges differ)
  // ==========================================
  const loadedForSex = useRef(null);

  useEffect(() => {
    const sex = selectedPatient?.sex || "";

    if (loadedForSex.current !== sex) {
      loadedForSex.current = sex;
      setParametersByTest({});
      if (selectedTestIds.length === 0) return;
    }

    const missing = selectedTestIds.filter(
      (id) => parametersByTest[id] === undefined
    );

    if (missing.length === 0) return;

    let cancelled = false;

    const loadParameters = async () => {
      try {
        setLoadingParameters(true);
        setError("");

        const sexQuery = sex ? "?sex=" + encodeURIComponent(sex) : "";

        const loaded = await Promise.all(
          missing.map(async (id) => {
            const response = await fetch(
              API_URL + "/test-types/" + id + "/parameters" + sexQuery,
              { method: "GET", headers: { Accept: "application/json" } }
            );

            if (!response.ok) {
              throw new Error("Failed to load the parameters for a selected test.");
            }

            const data = await response.json();

            if (!data.success) {
              throw new Error("Unable to retrieve test parameters.");
            }

            return [id, data.parameters || []];
          })
        );

        if (!cancelled) {
          setParametersByTest((previous) => ({
            ...previous,
            ...Object.fromEntries(loaded),
          }));
        }
      } catch (err) {
        console.error("Parameter loading error:", err);
        if (!cancelled) {
          setError(err.message || "Unable to load laboratory parameters.");
        }
      } finally {
        if (!cancelled) setLoadingParameters(false);
      }
    };

    loadParameters();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTestIds, selectedPatient?.sex, parametersByTest]);

  const toggleTest = (id) => {
    const key = String(id);
    setError("");
    setSuccess("");
    setSelectedTestIds((previous) =>
      previous.includes(key)
        ? previous.filter((x) => x !== key)
        : [...previous, key]
    );
  };

  // ==========================================
  // PARAMETER VALUE CHANGE
  // ==========================================
  const handleParameterChange = (
    testId,
    referenceRangeId,
    value
  ) => {
    setParameterValues(
      (previous) => ({
        ...previous,
        [testId + ":" + referenceRangeId]: value,
      })
    );
  };

  // ==========================================
  // CLEAR FORM
  // ==========================================
  const handleClear = () => {
    setPatientId("");
    setPatientSearch("");
    setPatientDropdownOpen(false);

    setSelectedTestIds([]);

    setParameterValues(
      EMPTY_PARAMETER_VALUES
    );

    setError("");
    setSuccess("");
  };

  // ==========================================
  // SUBMIT LAB RESULT
  // ==========================================
  const testName = (id) =>
    testTypes.find((t) => String(t.id) === String(id))?.name || "Laboratory test";

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setMlPredictions([]);

    if (!patientId) {
      setError("Please select a patient.");
      return;
    }

    if (selectedTestIds.length === 0) {
      setError("Please check at least one laboratory test.");
      return;
    }

    for (const id of selectedTestIds) {
      const params = parametersByTest[id] || [];

      if (params.length === 0) {
        setError(testName(id) + " does not have any configured parameters yet.");
        return;
      }

      const missing = params.find(
        (p) => String(parameterValues[id + ":" + p.id] ?? "").trim() === ""
      );

      if (missing) {
        setError(
          "Please enter a result for " +
            missing.parameter_name +
            " (" +
            testName(id) +
            ")."
        );
        return;
      }
    }

    try {
      setSubmitting(true);

      const tests = selectedTestIds.map((id) => ({
        test_type_id: Number(id),
        parameters: (parametersByTest[id] || []).map((parameter) => {
          const value = parameterValues[id + ":" + parameter.id];
          const numeric = parameter.data_type === "numeric";

          return {
            reference_range_id: parameter.id,
            parameter_name: parameter.parameter_name,
            value_numeric: numeric ? Number(value) : null,
            value_text: numeric ? null : String(value),
            unit: parameter.unit || null,
          };
        }),
      }));

      const response = await fetch(API_URL + "/lab-results/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          patient_id: Number(patientId),
          tests,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          const firstError = Object.values(data.errors)[0];

          if (Array.isArray(firstError)) {
            throw new Error(firstError[0]);
          }
        }

        throw new Error(data.message || "Failed to save the laboratory results.");
      }

      const saved = data.lab_results || [];

      setSuccess(
        saved.length > 1
          ? saved.length + " laboratory results successfully submitted for Doctor review."
          : "Laboratory result successfully submitted for Doctor review."
      );

      setMlPredictions(
        saved
          .filter((r) => r.ml_predicted_diagnosis)
          .map((r) => ({
            test: r.test_type?.name || testName(r.test_type_id),
            diagnosis: r.ml_predicted_diagnosis,
            confidence: r.ml_prediction_confidence,
          }))
      );

      setPatientId("");
      setPatientSearch("");
      setPatientDropdownOpen(false);
      setSelectedTestIds([]);
      setParameterValues(EMPTY_PARAMETER_VALUES);
    } catch (err) {
      console.error("Submit laboratory result error:", err);

      setError(err.message || "Unable to save the laboratory results.");
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // SELECTED TEST
  // ==========================================
  const allParametersLoaded = selectedTestIds.every(
    (id) => parametersByTest[id] !== undefined
  );

  return (
    <div className="min-h-screen bg-gray-50">

      <Sidebar />

      <main className="lg:ml-64 min-h-screen">

        <Header
          title="Encode Results"
          user="MS"
        />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 pb-8">

          {/* PAGE HEADING */}
          <div className="mb-6">

            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
              Encode Laboratory Result
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Enter the results of one or more laboratory tests for a registered patient, then submit them to the Doctor in one go.
            </p>

          </div>

          {/* ERROR */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* SUCCESS */}
          {success && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
              {success}
            </div>
          )}

          {/* ML PREDICTION (shown when the relevant ML microservice responded) */}
          {mlPredictions.map((ml) => (
            <div key={ml.test} className="mb-6 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-3 text-sm">
              <span className="font-semibold">ML model suggestion ({ml.test}):</span>{" "}
              {formatMlDiagnosis(ml.diagnosis)}
              {typeof ml.confidence === "number" && (
                <span className="text-blue-600">
                  {" "}
                  ({Math.round(ml.confidence * 100)}% confidence)
                </span>
              )}
              <div className="text-xs text-blue-500 mt-1">
                This is a supplementary suggestion for the reviewing Doctor,
                not a final diagnosis.
              </div>
              {isLowConfidence(ml.confidence) && (
                <div className="text-xs text-amber-700 mt-1 font-medium">
                  {LOW_CONFIDENCE_NOTE}
                </div>
              )}
            </div>
          ))}

          <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-7 max-w-4xl">

            {/* INFORMATION */}
            <div className="mb-6 pb-5 border-b border-gray-200">

              <h2 className="text-base font-semibold text-gray-900">
                Laboratory Information
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Select the patient and laboratory test from the actual system records.
              </p>

            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-6"
            >

              {/* ================================== */}
              {/* PATIENT SEARCH */}
              {/* ================================== */}
              <div
                ref={patientDropdownRef}
                className="relative"
              >

                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient
                </label>

                <button
                  type="button"
                  disabled={loadingPatients}
                  onClick={() => {
                    if (!loadingPatients) {
                      setPatientDropdownOpen(
                        (previous) =>
                          !previous
                      );

                      setError("");
                      setSuccess("");
                    }
                  }}
                  className="
                    w-full
                    px-4
                    py-2.5
                    border
                    border-gray-300
                    rounded-lg
                    text-sm
                    bg-white
                    text-left
                    focus:outline-none
                    focus:ring-2
                    focus:ring-gray-300
                    disabled:bg-gray-100
                    disabled:cursor-not-allowed
                    flex
                    items-center
                    justify-between
                    gap-3
                  "
                >

                  <span
                    className={
                      selectedPatient
                        ? "text-gray-900"
                        : "text-gray-400"
                    }
                  >
                    {loadingPatients
                      ? "Loading patients..."
                      : selectedPatient
                      ? selectedPatient.patient_id +
                        " — " +
                        getPatientName(
                          selectedPatient
                        )
                      : patients.length ===
                        0
                      ? "No registered patients"
                      : "Select patient"}
                  </span>

                  <svg
                    className={
                      "w-4 h-4 text-gray-400 transition-transform " +
                      (patientDropdownOpen
                        ? "rotate-180"
                        : "")
                    }
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      d="m6 9 6 6 6-6"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                </button>

                {patientDropdownOpen && (
                  <div className="absolute z-40 left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">

                    {/* SEARCH FIELD */}
                    <div className="p-3 border-b border-gray-200">

                      <div className="relative">

                        <svg
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                        >
                          <path
                            d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 6.04 6.04a7.5 7.5 0 0 0 10.61 10.61Z"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>

                        <input
                          autoFocus
                          type="text"
                          value={patientSearch}
                          onChange={(event) => {
                            setPatientSearch(
                              event.target.value
                            );
                          }}
                          onKeyDown={(event) => {
                            if (
                              event.key ===
                              "Escape"
                            ) {
                              setPatientDropdownOpen(
                                false
                              );
                            }
                          }}
                          placeholder="Search by patient name or ID..."
                          className="
                            w-full
                            pl-10
                            pr-4
                            py-2.5
                            border
                            border-gray-300
                            rounded-lg
                            text-sm
                            focus:outline-none
                            focus:ring-2
                            focus:ring-gray-300
                          "
                        />

                      </div>

                    </div>

                    {/* PATIENT LIST */}
                    <div className="max-h-72 overflow-y-auto">

                      {filteredPatients.length ===
                      0 ? (

                        <div className="px-5 py-8 text-center">

                          <p className="text-sm font-medium text-gray-700">
                            No patients found
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            Try searching by patient name or Patient ID.
                          </p>

                        </div>

                      ) : (

                        filteredPatients.map(
                          (patient) => {

                            const fullName =
                              getPatientName(
                                patient
                              );

                            const isSelected =
                              String(
                                patient.id
                              ) ===
                              String(
                                patientId
                              );

                            return (
                              <button
                                type="button"
                                key={
                                  patient.id
                                }
                                onClick={() => {
                                  handlePatientSelect(
                                    patient
                                  );
                                }}
                                className={
                                  "w-full px-4 py-3 text-left border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition flex items-center justify-between gap-3 " +
                                  (isSelected
                                    ? "bg-gray-50"
                                    : "")
                                }
                              >

                                <div className="min-w-0">

                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {
                                      patient.patient_id
                                    }
                                  </p>

                                  <p className="text-xs text-gray-500 truncate mt-0.5">
                                    {
                                      fullName
                                    }
                                  </p>

                                </div>

                                {isSelected && (
                                  <svg
                                    className="w-5 h-5 text-gray-900 shrink-0"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                  >
                                    <path
                                      d="m5 12 4 4L19 6"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                )}

                              </button>
                            );
                          }
                        )

                      )}

                    </div>

                    {/* FOOTER */}
                    {filteredPatients.length >
                      0 && (
                      <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">

                        <p className="text-[11px] text-gray-500">
                          Showing{" "}
                          {
                            filteredPatients.length
                          }{" "}
                          of{" "}
                          {patients.length}{" "}
                          patients
                          <span className="ml-1">
                            • newest registrations first
                          </span>
                        </p>

                      </div>
                    )}

                  </div>
                )}

                {selectedPatient && (
                  <p className="mt-2 text-xs text-gray-500">
                    Selected:{" "}
                    {getPatientName(
                      selectedPatient
                    )}
                  </p>
                )}

              </div>

              {/* ================================== */}
              {/* TESTS (check one or more) */}
              {/* ================================== */}
              <div>

                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Laboratory Tests
                  </label>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-900 text-white">
                    {selectedTestIds.length}{" "}
                    {selectedTestIds.length === 1 ? "test" : "tests"} selected
                  </span>
                </div>

                <p className="text-xs text-gray-500 mb-3">
                  Check every test the patient had. A form for each checked test appears below.
                </p>

                {loadingTests ? (
                  <p className="text-sm text-gray-500">Loading laboratory tests...</p>
                ) : testTypes.length === 0 ? (
                  <p className="text-sm text-gray-500">No laboratory tests found</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {testTypes.map((test) => {
                      const checked = selectedTestIds.includes(String(test.id));

                      return (
                        <label
                          key={test.id}
                          className={
                            "flex items-center gap-3 min-h-11 px-3 py-2.5 rounded-lg border text-sm cursor-pointer select-none transition " +
                            (checked
                              ? "border-gray-900 bg-gray-100 font-semibold text-gray-900"
                              : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50")
                          }
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTest(test.id)}
                            className="w-4 h-4 accent-gray-900"
                          />
                          <span>{test.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

              </div>

              {/* ================================== */}
              {/* LABORATORY PARAMETERS (one panel per checked test) */}
              {/* ================================== */}
              {selectedTestIds.length === 0 ? (

                <div className="border border-dashed border-gray-300 rounded-xl py-12 px-6 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xl">
                    +
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-gray-900">
                    Check at least one laboratory test
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
                    The parameters of each checked test are loaded from the configured laboratory reference data.
                  </p>
                </div>

              ) : (

                selectedTestIds.map((testId) => {
                  const params = parametersByTest[testId];

                  return (
                    <div key={testId} className="border border-gray-200 rounded-xl overflow-hidden">

                      <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-sm font-semibold text-gray-900">
                            {testName(testId)}
                          </h2>
                          <p className="mt-1 text-xs text-gray-500">
                            Parameters are loaded from the configured laboratory reference data.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleTest(testId)}
                          className="shrink-0 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100"
                        >
                          Remove
                        </button>
                      </div>

                      {params === undefined ? (

                        <div className="py-10 px-6 text-center">
                          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
                          <p className="text-sm text-gray-500">Loading laboratory parameters...</p>
                        </div>

                      ) : params.length === 0 ? (

                        <div className="py-10 px-6 text-center">
                          <h3 className="text-sm font-semibold text-gray-900">No parameters configured</h3>
                          <p className="mt-1 text-sm text-gray-500 max-w-lg mx-auto">
                            This laboratory test exists in the system, but its parameters and reference configuration have not been added yet.
                          </p>
                        </div>

                      ) : (

                        <div className="divide-y divide-gray-200">
                          {params.map((parameter) => {
                            const value = parameterValues[testId + ":" + parameter.id] ?? "";

                            return (
                              <div key={parameter.id} className="p-5">
                                <div className="flex flex-col sm:flex-row sm:items-end gap-4">

                                  <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-800 mb-2">
                                      {parameter.parameter_name}
                                    </label>

                                    {parameter.unit && (
                                      <p className="text-xs text-gray-500 mb-2">
                                        Unit: {parameter.unit}
                                      </p>
                                    )}

                                    <input
                                      type={parameter.data_type === "numeric" ? "number" : "text"}
                                      step={parameter.data_type === "numeric" ? "any" : undefined}
                                      value={value}
                                      onChange={(event) => {
                                        handleParameterChange(testId, parameter.id, event.target.value);
                                      }}
                                      placeholder="Enter result"
                                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                                    />
                                  </div>

                                  {/* REFERENCE */}
                                  <div className="sm:w-56 bg-gray-50 rounded-lg px-4 py-3">
                                    <p className="text-xs font-medium text-gray-500">Reference</p>
                                    <p className="mt-1 text-sm text-gray-700">
                                      {parameter.data_type === "numeric"
                                        ? formatReferenceRange(parameter)
                                        : parameter.normal_text || "No reference range"}
                                    </p>
                                  </div>

                                </div>
                              </div>
                            );
                          })}
                        </div>

                      )}
                    </div>
                  );
                })

              )}

              {/* ================================== */}
              {/* WORKFLOW STATUS */}
              {/* ================================== */}
              {selectedTestIds.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                  <p className="text-xs font-medium text-gray-500">Submission status</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {selectedTestIds.length > 1
                      ? selectedTestIds.length + " results will be submitted as PENDING_REVIEW"
                      : "Will be submitted as PENDING_REVIEW"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Each test is saved as its own result, so the Doctor can approve or reject each one. Tests submitted together appear under one QR code for the patient.
                  </p>
                </div>
              )}

              {/* ================================== */}
              {/* BUTTONS */}
              {/* ================================== */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">

                <button
                  type="button"
                  onClick={
                    handleClear
                  }
                  disabled={
                    submitting
                  }
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Clear
                </button>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    loadingPatients ||
                    loadingTests ||
                    loadingParameters ||
                    !patientId ||
                    selectedTestIds.length === 0 ||
                    !allParametersLoaded
                  }
                  className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? "Saving Results..."
                    : selectedTestIds.length > 1
                    ? "Submit " + selectedTestIds.length + " Tests for Doctor Review"
                    : "Submit for Doctor Review"}
                </button>

              </div>

            </form>

          </div>

        </div>

      </main>

    </div>
  );
}