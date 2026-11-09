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

export default function EncodeResults() {
  const [patients, setPatients] = useState([]);
  const [testTypes, setTestTypes] = useState([]);
  const [parameters, setParameters] = useState([]);

  const [patientId, setPatientId] = useState("");
  const [testTypeId, setTestTypeId] = useState("");

  const [parameterValues, setParameterValues] = useState(
    EMPTY_PARAMETER_VALUES
  );

  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingTests, setLoadingTests] = useState(true);
  const [loadingParameters, setLoadingParameters] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mlPrediction, setMlPrediction] = useState(null);

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
  // LOAD PARAMETERS WHEN TEST CHANGES
  // ==========================================
  useEffect(() => {
    if (!testTypeId) {
      setParameters([]);
      setParameterValues(
        EMPTY_PARAMETER_VALUES
      );
      return;
    }

    const loadParameters = async () => {
      try {
        setLoadingParameters(true);
        setParameters([]);

        setParameterValues(
          EMPTY_PARAMETER_VALUES
        );

        setError("");

        const sexQuery = selectedPatient?.sex
          ? "?sex=" + encodeURIComponent(selectedPatient.sex)
          : "";

        const response = await fetch(
          API_URL +
            "/test-types/" +
            testTypeId +
            "/parameters" +
            sexQuery,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load the parameters for this test."
          );
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(
            "Unable to retrieve test parameters."
          );
        }

        setParameters(
          data.parameters || []
        );
      } catch (err) {
        console.error(
          "Parameter loading error:",
          err
        );

        setError(
          err.message ||
            "Unable to load laboratory parameters."
        );
      } finally {
        setLoadingParameters(false);
      }
    };

    loadParameters();
  }, [testTypeId, selectedPatient?.sex]);

  // ==========================================
  // PARAMETER VALUE CHANGE
  // ==========================================
  const handleParameterChange = (
    referenceRangeId,
    value
  ) => {
    setParameterValues(
      (previous) => ({
        ...previous,
        [referenceRangeId]: value,
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

    setTestTypeId("");
    setParameters([]);

    setParameterValues(
      EMPTY_PARAMETER_VALUES
    );

    setError("");
    setSuccess("");
  };

  // ==========================================
  // SUBMIT LAB RESULT
  // ==========================================
  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setMlPrediction(null);

    if (!patientId) {
      setError(
        "Please select a patient."
      );
      return;
    }

    if (!testTypeId) {
      setError(
        "Please select a laboratory test."
      );
      return;
    }

    if (parameters.length === 0) {
      setError(
        "This laboratory test does not have any configured parameters yet."
      );
      return;
    }

    const missingParameter =
      parameters.find((parameter) => {
        const value =
          parameterValues[
            parameter.id
          ] !== undefined
            ? parameterValues[
                parameter.id
              ]
            : "";

        return (
          String(value).trim() === ""
        );
      });

    if (missingParameter) {
      setError(
        "Please enter a result for " +
          missingParameter.parameter_name +
          "."
      );
      return;
    }

    try {
      setSubmitting(true);

      const formattedParameters =
        parameters.map(
          (parameter) => {
            const value =
              parameterValues[
                parameter.id
              ];

            if (
              parameter.data_type ===
              "numeric"
            ) {
              return {
                reference_range_id:
                  parameter.id,

                parameter_name:
                  parameter.parameter_name,

                value_numeric:
                  Number(value),

                value_text: null,

                unit:
                  parameter.unit ||
                  null,
              };
            }

            return {
              reference_range_id:
                parameter.id,

              parameter_name:
                parameter.parameter_name,

              value_numeric:
                null,

              value_text:
                String(value),

              unit:
                parameter.unit ||
                null,
            };
          }
        );

      const response = await fetch(
        API_URL + "/lab-results",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",

            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },

          body: JSON.stringify({
            patient_id:
              Number(patientId),

            test_type_id:
              Number(testTypeId),

            parameters:
              formattedParameters,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        if (data.errors) {
          const firstError =
            Object.values(
              data.errors
            )[0];

          if (
            Array.isArray(
              firstError
            )
          ) {
            throw new Error(
              firstError[0]
            );
          }
        }

        throw new Error(
          data.message ||
            "Failed to save the laboratory result."
        );
      }

      setSuccess(
        "Laboratory result successfully submitted for Doctor review."
      );

      if (data.lab_result && data.lab_result.ml_predicted_diagnosis) {
        setMlPrediction({
          diagnosis: data.lab_result.ml_predicted_diagnosis,
          confidence: data.lab_result.ml_prediction_confidence,
        });
      }

      setPatientId("");

      setPatientSearch("");

      setPatientDropdownOpen(
        false
      );

      setTestTypeId("");

      setParameters([]);

      setParameterValues(
        EMPTY_PARAMETER_VALUES
      );
    } catch (err) {
      console.error(
        "Submit laboratory result error:",
        err
      );

      setError(
        err.message ||
          "Unable to save the laboratory result."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // SELECTED TEST
  // ==========================================
  const selectedTest = testTypes.find(
    (test) =>
      String(test.id) ===
      String(testTypeId)
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
              Enter laboratory test results for a registered patient.
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
          {mlPrediction && (
            <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-3 text-sm">
              <span className="font-semibold">ML model suggestion:</span>{" "}
              {formatMlDiagnosis(mlPrediction.diagnosis)}
              {typeof mlPrediction.confidence === "number" && (
                <span className="text-blue-600">
                  {" "}
                  ({Math.round(mlPrediction.confidence * 100)}% confidence)
                </span>
              )}
              <div className="text-xs text-blue-500 mt-1">
                This is a supplementary suggestion for the reviewing Doctor,
                not a final diagnosis.
              </div>
              {isLowConfidence(mlPrediction.confidence) && (
                <div className="text-xs text-amber-700 mt-1 font-medium">
                  {LOW_CONFIDENCE_NOTE}
                </div>
              )}
            </div>
          )}

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
              {/* TEST TYPE */}
              {/* ================================== */}
              <div>

                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Type
                </label>

                <select
                  value={testTypeId}
                  onChange={(event) => {
                    setTestTypeId(
                      event.target.value
                    );

                    setError("");
                    setSuccess("");
                  }}
                  disabled={loadingTests}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-100"
                >

                  <option value="">
                    {loadingTests
                      ? "Loading laboratory tests..."
                      : testTypes.length ===
                        0
                      ? "No laboratory tests found"
                      : "Select laboratory test"}
                  </option>

                  {testTypes.map((test) => (
                    <option
                      key={test.id}
                      value={test.id}
                    >
                      {test.name}
                    </option>
                  ))}

                </select>

                {selectedTest && (
                  <p className="mt-2 text-xs text-gray-500">
                    Test code:{" "}
                    {selectedTest.code}
                  </p>
                )}

              </div>

              {/* ================================== */}
              {/* LABORATORY PARAMETERS */}
              {/* ================================== */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">

                <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">

                  <h2 className="text-sm font-semibold text-gray-900">
                    Laboratory Parameters
                  </h2>

                  <p className="mt-1 text-xs text-gray-500">
                    Parameters are loaded from the configured laboratory reference data.
                  </p>

                </div>

                {!testTypeId ? (

                  <div className="py-12 px-6 text-center">

                    <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xl">
                      +
                    </div>

                    <h3 className="mt-4 text-sm font-semibold text-gray-900">
                      Select a laboratory test
                    </h3>

                    <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
                      Select a test above to load its configured parameters.
                    </p>

                  </div>

                ) : loadingParameters ? (

                  <div className="py-12 px-6 text-center">

                    <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />

                    <p className="text-sm text-gray-500">
                      Loading laboratory parameters...
                    </p>

                  </div>

                ) : parameters.length ===
                  0 ? (

                  <div className="py-12 px-6 text-center">

                    <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                      !
                    </div>

                    <h3 className="mt-4 text-sm font-semibold text-gray-900">
                      No parameters configured
                    </h3>

                    <p className="mt-1 text-sm text-gray-500 max-w-lg mx-auto">
                      This laboratory test exists in the system, but its parameters and reference configuration have not been added yet.
                    </p>

                  </div>

                ) : (

                  <div className="divide-y divide-gray-200">

                    {parameters.map(
                      (parameter) => {

                        const value =
                          parameterValues[
                            parameter.id
                          ] ?? "";

                        return (
                          <div
                            key={
                              parameter.id
                            }
                            className="p-5"
                          >

                            <div className="flex flex-col sm:flex-row sm:items-end gap-4">

                              <div className="flex-1">

                                <label className="block text-sm font-medium text-gray-800 mb-2">
                                  {
                                    parameter.parameter_name
                                  }
                                </label>

                                {parameter.unit && (
                                  <p className="text-xs text-gray-500 mb-2">
                                    Unit:{" "}
                                    {
                                      parameter.unit
                                    }
                                  </p>
                                )}

                                {parameter.data_type ===
                                "numeric" ? (

                                  <input
                                    type="number"
                                    step="any"
                                    value={
                                      value
                                    }
                                    onChange={(
                                      event
                                    ) => {
                                      handleParameterChange(
                                        parameter.id,
                                        event
                                          .target
                                          .value
                                      );
                                    }}
                                    placeholder="Enter result"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                                  />

                                ) : (

                                  <input
                                    type="text"
                                    value={
                                      value
                                    }
                                    onChange={(
                                      event
                                    ) => {
                                      handleParameterChange(
                                        parameter.id,
                                        event
                                          .target
                                          .value
                                      );
                                    }}
                                    placeholder="Enter result"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                                  />

                                )}

                              </div>

                              {/* REFERENCE */}
                              <div className="sm:w-56 bg-gray-50 rounded-lg px-4 py-3">

                                <p className="text-xs font-medium text-gray-500">
                                  Reference
                                </p>

                                {parameter.data_type ===
                                "numeric" ? (

                                  <p className="mt-1 text-sm text-gray-700">

                                    {parameter.low_value !==
                                      null &&
                                    parameter.high_value !==
                                      null
                                      ? Number(parameter.low_value) +
                                        " - " +
                                        Number(parameter.high_value) +
                                        (parameter.unit
                                          ? " " +
                                            parameter.unit
                                          : "")
                                      : "Not configured"}

                                  </p>

                                ) : (

                                  <p className="mt-1 text-sm text-gray-700">
                                    {
                                      parameter.normal_text ||
                                      "Not configured"
                                    }
                                  </p>

                                )}

                              </div>

                            </div>

                          </div>
                        );
                      }
                    )}

                  </div>

                )}

              </div>

              {/* ================================== */}
              {/* WORKFLOW STATUS */}
              {/* ================================== */}
              {testTypeId &&
                parameters.length >
                  0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">

                    <p className="text-xs font-medium text-gray-500">
                      Submission status
                    </p>

                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      Will be submitted as PENDING_REVIEW
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      The result will be stored and prepared for Doctor review.
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
                    !testTypeId ||
                    parameters.length ===
                      0
                  }
                  className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? "Saving Result..."
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