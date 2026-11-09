import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/common/Sidebar";
import Header from "../../components/common/Header";

import { API_URL } from "../../config";

const EMPTY_FORM = {
  first_name: "",
  middle_name: "",
  last_name: "",
  date_of_birth: "",
  sex: "",
  contact_number: "",
  address: "",
};

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [selectedPatient, setSelectedPatient] = useState(null);
  const [editingPatient, setEditingPatient] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [patientLabResults, setPatientLabResults] = useState([]);
  const [loadingLabResults, setLoadingLabResults] = useState(false);
  const [labResultsError, setLabResultsError] = useState("");

  // ==========================================
  // LOAD PATIENTS
  // ==========================================
  const fetchPatients = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(API_URL + "/patients", {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to retrieve patient records.");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error("Unable to retrieve patient records.");
      }

      setPatients(data.patients || []);
    } catch (err) {
      console.error("Fetch patients error:", err);

      setError(err.message || "Unable to connect to the patient database.");
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientLabResults = async (patientId) => {
    try {
      setLoadingLabResults(true);
      setLabResultsError("");
      setPatientLabResults([]);

      const response = await fetch(API_URL + "/lab-results", {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to retrieve laboratory results.");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error("Unable to retrieve laboratory results.");
      }

      const allResults = data.lab_results || [];

      const patientResults = allResults.filter(
        (result) => Number(result.patient_id) === Number(patientId)
      );

      setPatientLabResults(patientResults);
    } catch (err) {
      console.error("Fetch patient laboratory results error:", err);

      setLabResultsError(err.message || "Unable to load laboratory results.");
    } finally {
      setLoadingLabResults(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  // ==========================================
  // FORM HANDLING
  // ==========================================
  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // ==========================================
  // REGISTER
  // ==========================================
  const openRegisterModal = () => {
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
    setShowRegisterModal(true);
  };

  const closeRegisterModal = () => {
    if (submitting) {
      return;
    }

    setShowRegisterModal(false);
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
  };

  const handleRegister = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.first_name.trim()) {
      setError("First name is required.");
      return;
    }

    if (!form.last_name.trim()) {
      setError("Last name is required.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(API_URL + "/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          middle_name: form.middle_name.trim() || null,
          last_name: form.last_name.trim(),
          date_of_birth: form.date_of_birth || null,
          sex: form.sex || null,
          contact_number: form.contact_number.trim() || null,
          address: form.address.trim() || null,
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

        throw new Error(data.message || "Failed to register patient.");
      }

      setSuccess(data.patient.patient_id + " registered successfully.");

      setForm(EMPTY_FORM);

      await fetchPatients();

      setTimeout(() => {
        setShowRegisterModal(false);
        setSuccess("");
      }, 1000);
    } catch (err) {
      console.error("Register error:", err);

      setError(err.message || "Unable to register the patient.");
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // VIEW
  // ==========================================
  const handleViewPatient = async (patient) => {
    setSelectedPatient(patient);

    await fetchPatientLabResults(patient.id);
  };

  const closePatientDetails = () => {
    setSelectedPatient(null);
    setPatientLabResults([]);
    setLabResultsError("");
  };

  // ==========================================
  // EDIT
  // ==========================================
  const openEditModal = (patient) => {
    setEditingPatient(patient);

    setForm({
      first_name: patient.first_name || "",
      middle_name: patient.middle_name || "",
      last_name: patient.last_name || "",
      date_of_birth: patient.date_of_birth || "",
      sex: patient.sex || "",
      contact_number: patient.contact_number || "",
      address: patient.address || "",
    });

    setError("");
    setSuccess("");
    setSelectedPatient(null);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    if (submitting) {
      return;
    }

    setShowEditModal(false);
    setEditingPatient(null);
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
  };

  const handleUpdate = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!editingPatient) {
      return;
    }

    if (!form.first_name.trim()) {
      setError("First name is required.");
      return;
    }

    if (!form.last_name.trim()) {
      setError("Last name is required.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(API_URL + "/patients/" + editingPatient.id, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          middle_name: form.middle_name.trim() || null,
          last_name: form.last_name.trim(),
          date_of_birth: form.date_of_birth || null,
          sex: form.sex || null,
          contact_number: form.contact_number.trim() || null,
          address: form.address.trim() || null,
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

        throw new Error(data.message || "Failed to update patient.");
      }

      setSuccess(data.patient.patient_id + " updated successfully.");

      await fetchPatients();

      setTimeout(() => {
        setShowEditModal(false);
        setEditingPatient(null);
        setForm(EMPTY_FORM);
        setSuccess("");
      }, 1000);
    } catch (err) {
      console.error("Update error:", err);

      setError(err.message || "Unable to update the patient.");
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // DELETE
  // ==========================================
  const handleDelete = async (patient) => {
    const fullName = [
      patient.first_name,
      patient.middle_name,
      patient.last_name,
    ]
      .filter(Boolean)
      .join(" ");

    const confirmed = window.confirm(
      "Delete patient " +
        fullName +
        " (" +
        patient.patient_id +
        ")?\n\nThis action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      setSuccess("");

      const response = await fetch(API_URL + "/patients/" + patient.id, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete patient.");
      }

      setSuccess(patient.patient_id + " deleted successfully.");

      setSelectedPatient(null);

      await fetchPatients();
    } catch (err) {
      console.error("Delete error:", err);

      setError(err.message || "Unable to delete the patient.");
    } finally {
      setDeleting(false);
    }
  };

  // ==========================================
  // SEARCH
  // ==========================================
  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return patients;
    }

    return patients.filter((patient) => {
      const fullName = [
        patient.first_name,
        patient.middle_name,
        patient.last_name,
      ]
        .filter(Boolean)
        .join(" ");

      const patientId = String(patient.patient_id || "");

      return (
        fullName.toLowerCase().includes(query) ||
        patientId.toLowerCase().includes(query)
      );
    });
  }, [patients, search]);

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <main className="lg:ml-64 min-h-screen">
        <Header title="Patients" user="MS" />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 pb-8">
          {/* PAGE HEADING */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
              Patient Records
            </h1>

            <p className="mt-1 text-sm sm:text-base text-gray-500">
              Create, view, update, and manage registered patient information.
            </p>
          </div>

          {/* SEARCH + REGISTER */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 6.04 6.04a7.5 7.5 0 0 0 10.61 10.61Z"
                  />
                </svg>

                <input
                  type="text"
                  placeholder="Search patient..."
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400"
                />
              </div>

              <button
                type="button"
                onClick={openRegisterModal}
                className="w-full sm:w-auto px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition"
              >
                + Register Patient
              </button>
            </div>
          </div>

          {/* PAGE ERROR */}
          {error && !showRegisterModal && !showEditModal && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* PAGE SUCCESS */}
          {success && !showRegisterModal && !showEditModal && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
              {success}
            </div>
          )}

          {/* TABLE */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {loading ? (
              <div className="min-h-[380px] flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mb-3"></div>

                <p className="text-sm text-gray-500">
                  Loading patient records...
                </p>
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="min-h-[380px] sm:min-h-[450px] flex flex-col items-center justify-center px-6 text-center">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <svg
                    className="w-6 h-6 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                      d="M15 20a6 6 0 0 0-12 0m6-8a4 4 0 1 0-8 0 4 4 0 0 0 0 8Zm7-1v6m3-3h-6"
                    />
                  </svg>
                </div>

                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  {patients.length === 0
                    ? "No patient records"
                    : "No matching patients"}
                </h3>

                <p className="mt-2 max-w-md text-sm text-gray-500">
                  {patients.length === 0
                    ? "Patient records will appear here once they are registered."
                    : "No patient record matches your search."}
                </p>

                {patients.length === 0 && (
                  <button
                    type="button"
                    onClick={openRegisterModal}
                    className="mt-5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition"
                  >
                    Register First Patient
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                        Patient ID
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                        Patient Name
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                        Date of Birth
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                        Sex
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">
                    {filteredPatients.map((patient) => {
                      const fullName = [
                        patient.first_name,
                        patient.middle_name,
                        patient.last_name,
                      ]
                        .filter(Boolean)
                        .join(" ");

                      return (
                        <tr
                          key={patient.id}
                          className="hover:bg-gray-50 transition"
                        >
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {patient.patient_id}
                          </td>

                          <td className="px-6 py-4 text-sm text-gray-900">
                            {fullName}
                          </td>

                          <td className="px-6 py-4 text-sm text-gray-600">
                            {patient.date_of_birth || "—"}
                          </td>

                          <td className="px-6 py-4 text-sm text-gray-600">
                            {patient.sex || "—"}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  handleViewPatient(patient);
                                }}
                                className="text-sm font-medium text-gray-900 hover:underline"
                              >
                                View
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  openEditModal(patient);
                                }}
                                className="text-sm font-medium text-blue-700 hover:underline"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  handleDelete(patient);
                                }}
                                disabled={deleting}
                                className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
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

      {/* ===================================== */}
      {/* REGISTER MODAL */}
      {/* ===================================== */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeRegisterModal}
          />

          <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Register New Patient
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Enter the patient's basic information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeRegisterModal}
                disabled={submitting}
                className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-500 text-xl transition disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRegister} className="p-6 space-y-5">
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

              <PatientFormFields form={form} handleChange={handleChange} />

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeRegisterModal}
                  disabled={submitting}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50"
                >
                  {submitting ? "Registering..." : "Register Patient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================== */}
      {/* EDIT MODAL */}
      {/* ===================================== */}
      {showEditModal && editingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeEditModal}
          />

          <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Edit Patient
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Patient ID: {editingPatient.patient_id}
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={submitting}
                className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-500 text-xl transition disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-5">
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

              <PatientFormFields form={form} handleChange={handleChange} />

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={submitting}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================== */}
      {/* VIEW MODAL */}
      {/* ===================================== */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closePatientDetails}
          />

          <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Patient Details
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Registered patient information
                </p>
              </div>

              <button
                type="button"
                onClick={closePatientDetails}
                className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-500 text-xl transition"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Patient ID
                </p>

                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {selectedPatient.patient_id}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Personal Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <p className="text-xs text-gray-500">Full Name</p>

                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {[
                        selectedPatient.first_name,
                        selectedPatient.middle_name,
                        selectedPatient.last_name,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Date of Birth</p>

                    <p className="mt-1 text-sm text-gray-900">
                      {selectedPatient.date_of_birth || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Sex</p>

                    <p className="mt-1 text-sm text-gray-900">
                      {selectedPatient.sex || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Contact Number</p>

                    <p className="mt-1 text-sm text-gray-900">
                      {selectedPatient.contact_number || "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500">Address</p>

                <p className="mt-1 text-sm text-gray-900">
                  {selectedPatient.address || "—"}
                </p>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-900">
                  Laboratory Results
                </h3>

                <div className="mt-4">
                  {loadingLabResults ? (
                    <div className="border border-gray-200 rounded-xl py-10 px-5 text-center">
                      <div className="w-7 h-7 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />

                      <p className="text-sm text-gray-500">
                        Loading laboratory results...
                      </p>
                    </div>
                  ) : labResultsError ? (
                    <div className="border border-red-200 bg-red-50 rounded-xl py-6 px-5">
                      <p className="text-sm font-medium text-red-700">
                        Unable to load laboratory results
                      </p>

                      <p className="mt-1 text-xs text-red-600">
                        {labResultsError}
                      </p>
                    </div>
                  ) : patientLabResults.length === 0 ? (
                    <div className="border border-dashed border-gray-300 rounded-xl py-8 px-5 text-center">
                      <p className="text-sm font-medium text-gray-700">
                        No laboratory results yet
                      </p>

                      <p className="mt-1 text-xs text-gray-500 max-w-md mx-auto">
                        Laboratory results will appear here after they are
                        encoded for this patient.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {patientLabResults.map((result) => {
                        const testName =
                          result.test_type?.name || "Laboratory Test";

                        const parameters = result.parameters || [];

                        return (
                          <div
                            key={result.id}
                            className="border border-gray-200 rounded-xl overflow-hidden"
                          >
                            {/* Result Header */}
                            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {testName}
                                  </p>

                                  <p className="mt-1 text-xs text-gray-500">
                                    Submitted{" "}
                                    {formatLabDate(
                                      result.submitted_at || result.created_at
                                    )}
                                  </p>
                                </div>

                                <span
                                  className={
                                    "inline-flex self-start px-2.5 py-1 rounded-full text-xs font-semibold " +
                                    getLabStatusClass(result.status)
                                  }
                                >
                                  {result.status}
                                </span>
                              </div>
                            </div>

                            {/* Parameters */}
                            <div className="p-5">
                              {parameters.length === 0 ? (
                                <p className="text-sm text-gray-500">
                                  No laboratory parameters recorded.
                                </p>
                              ) : (
                                <div className="space-y-3">
                                  {parameters.map((parameter) => {
                                    const value =
                                      parameter.value_numeric !== null &&
                                      parameter.value_numeric !== undefined
                                        ? String(Number(parameter.value_numeric))
                                        : parameter.value_text || "—";

                                    return (
                                      <div
                                        key={parameter.id}
                                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 border-b border-gray-100 last:border-b-0"
                                      >
                                        <div>
                                          <p className="text-sm font-medium text-gray-800">
                                            {parameter.parameter_name}
                                          </p>

                                          {parameter.unit && (
                                            <p className="text-xs text-gray-500">
                                              {parameter.unit}
                                            </p>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-semibold text-gray-900">
                                            {value}
                                          </span>

                                          <span
                                            className={
                                              "inline-flex px-2 py-1 rounded-full text-[10px] font-semibold " +
                                              getLabFlagClass(parameter.flag)
                                            }
                                          >
                                            {parameter.flag || "UNASSESSED"}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  handleDelete(selectedPatient);
                }}
                disabled={deleting}
                className="px-5 py-2.5 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-50 transition disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Patient"}
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closePatientDetails}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    openEditModal(selectedPatient);
                  }}
                  className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition"
                >
                  Edit Patient
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================
   SHARED PATIENT FORM FIELDS
========================================== */

function formatLabDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function getLabStatusClass(status) {
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
}

function getLabFlagClass(flag) {
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
}

function PatientFormFields({ form, handleChange }) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            First Name *
          </label>

          <input
            type="text"
            name="first_name"
            value={form.first_name}
            onChange={handleChange}
            placeholder="Juan"
            required
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Middle Name
          </label>

          <input
            type="text"
            name="middle_name"
            value={form.middle_name}
            onChange={handleChange}
            placeholder="Santos"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Last Name *
          </label>

          <input
            type="text"
            name="last_name"
            value={form.last_name}
            onChange={handleChange}
            placeholder="Dela Cruz"
            required
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date of Birth
          </label>

          <input
            type="date"
            name="date_of_birth"
            value={form.date_of_birth}
            onChange={handleChange}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sex
          </label>

          <select
            name="sex"
            value={form.sex}
            onChange={handleChange}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            <option value="">Select sex</option>

            <option value="Male">Male</option>

            <option value="Female">Female</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Contact Number
        </label>

        <input
          type="text"
          name="contact_number"
          value={form.contact_number}
          onChange={handleChange}
          placeholder="09XXXXXXXXX"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Address
        </label>

        <textarea
          name="address"
          value={form.address}
          onChange={handleChange}
          placeholder="Patient address"
          rows="3"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
      </div>
    </>
  );
}
