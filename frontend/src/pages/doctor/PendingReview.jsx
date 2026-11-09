import { useEffect, useMemo, useState } from "react";
import DoctorSidebar from "../../components/doctor/DoctorSidebar";

import { API_URL } from "../../config";
import {
  formatMlDiagnosis,
  isLowConfidence,
  LOW_CONFIDENCE_NOTE,
} from "../../utils/mlDisplay";

export default function PendingReview() {
  const [results, setResults] = useState([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selected, setSelected] =
    useState(null);

  const [showRejectForm, setShowRejectForm] =
    useState(false);

  const [rejectionReason, setRejectionReason] =
    useState("");

  const fetchResults = async () => {
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

      setResults(
        (data.lab_results || []).filter(
          (result) =>
            result.status ===
            "PENDING_REVIEW"
        )
      );
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to connect to the laboratory database."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const filteredResults = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    if (!query) {
      return results;
    }

    return results.filter((result) => {

      const patient =
        result.patient || {};

      const test =
        result.test_type || {};

      const name = [
        patient.first_name,
        patient.middle_name,
        patient.last_name,
      ]
        .filter(Boolean)
        .join(" ");

      return (
        name.toLowerCase().includes(query) ||
        String(
          patient.patient_id || ""
        )
          .toLowerCase()
          .includes(query) ||
        String(test.name || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [results, search]);

  const approve = async () => {
    if (!selected) return;

    try {
      setConfirmApprove(false);
      setProcessing(true);
      setError("");

      const response = await fetch(
        `${API_URL}/lab-results/${selected.id}/approve`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to approve the result."
        );
      }

      setSuccess(
        "Laboratory result approved successfully."
      );

      setSelected(null);

      await fetchResults();
    } catch (err) {
      setError(
        err.message ||
          "Unable to approve the result."
      );
    } finally {
      setProcessing(false);
    }
  };

  const reject = async () => {
    if (!selected) return;

    if (!rejectionReason.trim()) {
      setError(
        "A rejection reason is required."
      );
      return;
    }

    try {
      setProcessing(true);
      setError("");

      const response = await fetch(
        `${API_URL}/lab-results/${selected.id}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          body: JSON.stringify({
            rejection_reason:
              rejectionReason.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to reject the result."
        );
      }

      setSuccess(
        "Laboratory result rejected and returned for correction."
      );

      setSelected(null);
      setShowRejectForm(false);
      setRejectionReason("");

      await fetchResults();
    } catch (err) {
      setError(
        err.message ||
          "Unable to reject the result."
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DoctorSidebar />

      <main className="lg:ml-64 min-h-screen">
        <header className="hidden lg:flex fixed top-0 left-64 right-0 h-16 bg-white border-b border-gray-200 z-30 items-center justify-between px-8">

          <h1 className="text-sm font-semibold text-gray-900">
            Pending Review
          </h1>

          <div className="w-9 h-9 rounded-full bg-[#111827] text-white flex items-center justify-center text-xs font-semibold">
            DR
          </div>

        </header>

        <div className="pt-20 px-4 sm:px-6 lg:px-8 pb-8">

          <section className="mb-7">
            <p className="text-xs uppercase tracking-wider text-gray-500">
              Laboratory Review
            </p>

            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mt-2">
              Pending Review
            </h2>

            <p className="text-sm text-gray-500 mt-2">
              Review laboratory results submitted by the Medical Technologist before approval.
            </p>
          </section>

          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-5 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
              {success}
            </div>
          )}

          <section className="bg-white border border-gray-200 rounded-xl p-5 mb-5">

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Results Awaiting Review
                </p>

                <p className="text-3xl font-semibold text-gray-900 mt-2">
                  {loading ? "—" : results.length}
                </p>
              </div>

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search patient, ID, or test..."
                className="w-full lg:max-w-md px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />

            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">

            {loading ? (
              <div className="min-h-[350px] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-500">
                    Loading pending results...
                  </p>
                </div>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="min-h-[350px] flex items-center justify-center text-center px-6">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {results.length === 0
                      ? "No pending results"
                      : "No matching results"}
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    {results.length === 0
                      ? "New laboratory results submitted by the Medical Technologist will appear here."
                      : "Try another search term."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px]">

                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Patient
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Test Type
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Date Submitted
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

                    {filteredResults.map(
                      (result) => {

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
                              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                                PENDING_REVIEW
                              </span>
                            </td>

                            <td className="px-5 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelected(result);
                                  setShowRejectForm(false);
                                  setRejectionReason("");
                                }}
                                className="text-sm font-semibold text-gray-900 hover:underline"
                              >
                                Review
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )}

                  </tbody>
                </table>
              </div>
            )}

          </section>
        </div>
      </main>

      {selected && (
        <ReviewModal
          result={selected}
          processing={processing}
          showRejectForm={
            showRejectForm
          }
          rejectionReason={
            rejectionReason
          }
          setShowRejectForm={
            setShowRejectForm
          }
          setRejectionReason={
            setRejectionReason
          }
          onClose={() => {
            if (!processing) {
              setConfirmApprove(false);
              setSelected(null);
            }
          }}
          onApprove={() => setConfirmApprove(true)}
          onReject={reject}
        />
      )}

      {selected && confirmApprove && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm approval"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-base font-semibold text-gray-900">
              Approve this laboratory result?
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              The result will be released to the patient together with the
              AI health information shown (unless you chose to hide it).
            </p>
            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setConfirmApprove(false)}
                disabled={processing}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={approve}
                disabled={processing}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
              >
                {processing ? "Processing..." : "Yes, approve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewModal({
  result,
  processing,
  showRejectForm,
  rejectionReason,
  setShowRejectForm,
  setRejectionReason,
  onClose,
  onApprove,
  onReject,
}) {
  const [aiDirty, setAiDirty] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      <div className="relative bg-white w-full max-w-5xl rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">

        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">

          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Review Laboratory Result
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              {result.test_type?.name ||
                "Laboratory Test"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={processing}
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
                result.patient?.patient_id ||
                "—"
              }
            />

            <Info
              label="Laboratory Test"
              value={
                result.test_type?.name ||
                "—"
              }
            />

            <Info
              label="Date Submitted"
              value={formatDate(
                result.submitted_at ||
                  result.created_at
              )}
            />

          </div>

          {result.ml_predicted_diagnosis && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-1">
                ML Model Suggestion
              </h3>
              <p className="text-base font-semibold text-blue-800">
                {formatMlDiagnosis(result.ml_predicted_diagnosis)}
                {typeof result.ml_prediction_confidence === "number" && (
                  <span className="font-normal text-blue-600 text-sm ml-2">
                    ({Math.round(result.ml_prediction_confidence * 100)}% confidence)
                  </span>
                )}
              </p>
              <p className="text-xs text-blue-500 mt-1">
                Generated automatically from the submitted lab values.
                This is a supplementary suggestion, not a confirmed
                diagnosis, use clinical judgment before approving.
              </p>
              {isLowConfidence(result.ml_prediction_confidence) && (
                <p className="text-xs text-amber-700 mt-1 font-medium">
                  {LOW_CONFIDENCE_NOTE}
                </p>
              )}
            </div>
          )}

          <div>

            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Laboratory Parameters
            </h3>

            <div className="border border-gray-200 rounded-xl overflow-hidden">

              {(result.parameters || [])
                .length === 0 ? (
                <div className="p-10 text-center text-sm text-gray-500">
                  No laboratory parameters recorded.
                </div>
              ) : (
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

                    {result.parameters.map(
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
                          <tr
                            key={
                              parameter.id
                            }
                          >

                            <td className="px-4 py-4 text-sm font-medium text-gray-900">
                              {
                                parameter.parameter_name
                              }
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
                              {(() => {
                                const flag =
                                  parameter.flag ||
                                  "UNASSESSED";
                                const flagStyles =
                                  {
                                    HIGH: "bg-red-100 text-red-700",
                                    ABNORMAL:
                                      "bg-red-100 text-red-700",
                                    LOW: "bg-orange-100 text-orange-700",
                                    NORMAL:
                                      "bg-green-100 text-green-700",
                                    UNASSESSED:
                                      "bg-gray-100 text-gray-600",
                                  };
                                return (
                                  <span
                                    className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                                      flagStyles[
                                        flag
                                      ] ||
                                      "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {flag}
                                  </span>
                                );
                              })()}
                            </td>

                          </tr>
                        );
                      }
                    )}

                  </tbody>
                </table>
              )}

            </div>
          </div>

          <AiRecommendationReview
            result={result}
            onDirtyChange={setAiDirty}
          />

          {showRejectForm && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">

              <label className="block text-sm font-semibold text-red-800 mb-2">
                Reason for rejection
              </label>

              <textarea
                rows={4}
                value={rejectionReason}
                onChange={(e) =>
                  setRejectionReason(
                    e.target.value
                  )
                }
                placeholder="Explain what needs to be corrected..."
                className="w-full px-4 py-3 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              />

            </div>
          )}

        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row justify-end gap-3">

          {!showRejectForm ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowRejectForm(true);
                }}
                disabled={processing}
                className="px-5 py-2.5 border border-red-200 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50"
              >
                Reject
              </button>

              <button
                type="button"
                onClick={onApprove}
                disabled={processing || aiDirty}
                title={
                  aiDirty
                    ? "Save or discard your edit to the AI text first."
                    : undefined
                }
                className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing
                  ? "Processing..."
                  : "Approve Result"}
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={processing}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowRejectForm(false);
                }}
                disabled={processing}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700"
              >
                Back
              </button>

              <button
                type="button"
                onClick={onReject}
                disabled={
                  processing ||
                  !rejectionReason.trim()
                }
                className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {processing
                  ? "Rejecting..."
                  : "Confirm Rejection"}
              </button>
            </>
          )}

        </div>

      </div>
    </div>
  );
}

const ABNORMAL_FLAGS = ["LOW", "HIGH", "ABNORMAL"];

/**
 * Doctor review of the AI-generated health information. The text is
 * generated (or fetched if it already exists) when the modal opens, so
 * the Doctor sees exactly what the patient will see after approval.
 * The Doctor can edit the text or hide it from the patient.
 */
function AiRecommendationReview({ result, onDirtyChange }) {
  const [rec, setRec] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const hasAbnormal = (result.parameters || []).some((p) =>
    ABNORMAL_FLAGS.includes(p.flag)
  );

  const authHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
  };

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/lab-results/${result.id}/recommendation/preview`,
        { method: "POST", headers: authHeaders }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load the AI recommendation."
        );
      }

      setRec(data.ai_recommendation || null);
      setText(data.ai_recommendation?.recommendation_text || "");
    } catch (err) {
      setError(err.message || "Unable to load the AI recommendation.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasAbnormal) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.id]);

  const dirty = !!rec && text.trim() !== (rec.recommendation_text || "").trim();

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const save = async (payload) => {
    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        `${API_URL}/lab-results/${result.id}/recommendation`,
        {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to save the change."
        );
      }

      setRec(data.ai_recommendation);
      setText(data.ai_recommendation.recommendation_text);
    } catch (err) {
      setError(err.message || "Unable to save the change.");
    } finally {
      setSaving(false);
    }
  };

  if (!hasAbnormal) {
    return null;
  }

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-blue-900">
        AI Health Information
      </h3>
      <p className="text-xs text-blue-600 mt-1 mb-3">
        This is what the patient will see after approval. Review it,
        edit it, or hide it from the patient.
      </p>

      {loading && (
        <p className="text-sm text-blue-700">Generating...</p>
      )}

      {!loading && error && (
        <p className="text-sm text-red-600 mb-2">{error}</p>
      )}

      {!loading && !rec && !error && (
        <p className="text-sm text-gray-600">
          No AI recommendation is available for this result (no matching
          reference material, or the service is unavailable). The result
          can still be approved without one.
        </p>
      )}

      {!loading && !rec && (
        <button
          type="button"
          onClick={load}
          className="mt-2 px-3 py-1.5 text-xs font-semibold border border-blue-300 text-blue-800 rounded-lg hover:bg-blue-100"
        >
          Retry
        </button>
      )}

      {!loading && rec && (
        <>
          <textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={saving || rec.is_hidden}
            className="w-full px-4 py-3 border border-blue-200 rounded-lg text-sm bg-white disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />

          <div className="flex flex-wrap items-center gap-3 mt-3">
            <button
              type="button"
              onClick={() => save({ recommendation_text: text })}
              disabled={!dirty || saving}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-700 text-white rounded-lg disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save edit"}
            </button>

            {dirty && (
              <button
                type="button"
                onClick={() => setText(rec.recommendation_text)}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-semibold border border-gray-300 text-gray-700 rounded-lg"
              >
                Discard edit
              </button>
            )}

            <label className="flex items-center gap-2 text-xs text-gray-700 ml-auto">
              <input
                type="checkbox"
                checked={!!rec.is_hidden}
                disabled={saving || dirty}
                onChange={(e) => save({ is_hidden: e.target.checked })}
              />
              Hide from patient
            </label>
          </div>

          {dirty && (
            <p className="text-xs text-amber-700 mt-2">
              Save or discard your edit before approving.
            </p>
          )}

          {rec.edited_by_doctor && !dirty && (
            <p className="text-xs text-blue-600 mt-2">
              Edited by the Doctor.
            </p>
          )}
        </>
      )}
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
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}