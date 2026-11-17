import React, { useEffect, useState } from "react";

import { API_URL } from "../../config";

// Counter/Nurse: register a walk-in patient, then send the patient to the
// MedTech. A patient who is registered but not sent yet is not visible to
// the MedTech; such patients are listed at the bottom so they can be sent
// later (for example when the popup was closed by mistake).

const EMPTY_FORM = {
  first_name: "",
  middle_name: "",
  last_name: "",
  sex: "",
  date_of_birth: "",
  contact_number: "",
  address: "",
  allergies: "",
};

const authHeaders = () => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
});

const fullName = (p) =>
  [p?.first_name, p?.middle_name, p?.last_name].filter(Boolean).join(" ");

// Turns a Laravel error response into one readable line.
const readError = async (response, fallback) => {
  try {
    const data = await response.json();
    if (data?.errors) {
      return Object.values(data.errors).flat().join(" ");
    }
    return data?.message || fallback;
  } catch {
    return fallback;
  }
};

export default function CounterRegister({ isMobile = false }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Patient just registered; shown in the "Send to MedTech" popup.
  const [registered, setRegistered] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [popupError, setPopupError] = useState("");

  const [notSent, setNotSent] = useState([]);

  const loadNotSent = async () => {
    try {
      const response = await fetch(`${API_URL}/patients`, {
        headers: authHeaders(),
      });
      if (!response.ok) return;
      const data = await response.json();
      setNotSent((data.patients || []).filter((p) => !p.sent_to_medtech_at));
    } catch {
      // The list is a convenience; registration still works without it.
    }
  };

  useEffect(() => {
    loadNotSent();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("First name and last name are required.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`${API_URL}/patients`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ...form,
          sex: form.sex || null,
          date_of_birth: form.date_of_birth || null,
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response, "Unable to register the patient."));
      }

      const data = await response.json();
      setRegistered(data.patient);
      setPopupError("");
      setForm(EMPTY_FORM);
      loadNotSent();
    } catch (err) {
      setError(err.message || "Unable to register the patient.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendToMedtech = async (patient) => {
    setPopupError("");
    setError("");
    try {
      setSendingId(patient.id);
      const response = await fetch(
        `${API_URL}/patients/${patient.id}/send-to-medtech`,
        { method: "POST", headers: authHeaders() }
      );

      if (!response.ok) {
        throw new Error(await readError(response, "Unable to send the patient to the MedTech."));
      }

      setSuccess(`${fullName(patient)} (${patient.patient_id}) was sent to the MedTech.`);
      setRegistered(null);
      loadNotSent();
    } catch (err) {
      if (registered) {
        setPopupError(err.message);
      } else {
        setError(err.message);
      }
    } finally {
      setSendingId(null);
    }
  };

  const s = isMobile ? mobileMerged : styles;

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Register Patient</h1>
        <p style={s.subtitle}>
          Register the walk-in patient, then send the patient to the MedTech.
        </p>
      </div>

      {error && <div style={s.errorBox}>{error}</div>}
      {success && <div style={s.successBox}>{success}</div>}

      <form style={s.card} onSubmit={handleRegister}>
        <div style={s.grid3}>
          <Field label="First name *" s={s}>
            <input style={s.input} name="first_name" value={form.first_name} onChange={handleChange} placeholder="Juan" />
          </Field>
          <Field label="Middle name" s={s}>
            <input style={s.input} name="middle_name" value={form.middle_name} onChange={handleChange} placeholder="Santos" />
          </Field>
          <Field label="Last name *" s={s}>
            <input style={s.input} name="last_name" value={form.last_name} onChange={handleChange} placeholder="Dela Cruz" />
          </Field>
        </div>

        <div style={s.grid2}>
          <Field label="Sex" s={s}>
            <select style={s.input} name="sex" value={form.sex} onChange={handleChange}>
              <option value="">Select sex</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </Field>
          <Field label="Date of birth" s={s}>
            <input style={s.input} type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} />
          </Field>
          <Field label="Contact number" s={s}>
            <input style={s.input} name="contact_number" value={form.contact_number} onChange={handleChange} placeholder="09XXXXXXXXX" />
          </Field>
          <Field label="Address" s={s}>
            <input style={s.input} name="address" value={form.address} onChange={handleChange} placeholder="Patient address" />
          </Field>
        </div>

        <Field label="Known allergies" s={s}>
          <input style={s.input} name="allergies" value={form.allergies} onChange={handleChange} placeholder="e.g. peanuts, shellfish (leave blank if none)" />
        </Field>

        <div style={s.formActions}>
          <button type="button" style={s.secondaryButton} onClick={() => { setForm(EMPTY_FORM); setError(""); }}>
            Clear
          </button>
          <button type="submit" style={s.primaryButton} disabled={submitting}>
            {submitting ? "Registering..." : "Register Patient"}
          </button>
        </div>
      </form>

      {notSent.length > 0 && (
        <div style={{ ...s.card, marginTop: "20px" }}>
          <h2 style={s.sectionTitle}>Registered, not yet sent to MedTech</h2>
          <div style={s.list}>
            {notSent.map((p) => (
              <div key={p.id} style={s.listRow}>
                <div style={{ minWidth: 0 }}>
                  <div style={s.listName}>{fullName(p)}</div>
                  <div style={s.listMeta}>{p.patient_id}{p.sex ? ` · ${p.sex}` : ""}</div>
                </div>
                <button
                  type="button"
                  style={s.primaryButton}
                  disabled={sendingId === p.id}
                  onClick={() => sendToMedtech(p)}
                >
                  {sendingId === p.id ? "Sending..." : "Send to MedTech"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {registered && (
        <div style={s.overlay}>
          <div style={s.modal} role="dialog" aria-label="Patient registered">
            <div style={s.checkCircle}>✓</div>
            <h2 style={s.modalTitle}>Patient registered</h2>
            <p style={s.subtitle}>Send this patient to the MedTech so the lab test can start.</p>

            <div style={s.summary}>
              <div style={s.listName}>{fullName(registered)}</div>
              <div style={s.listMeta}>
                Patient ID: {registered.patient_id}
                {registered.sex ? ` · ${registered.sex}` : ""}
                {registered.date_of_birth ? ` · ${registered.date_of_birth}` : ""}
              </div>
              <div style={s.listMeta}>Allergies: {registered.allergies || "none"}</div>
            </div>

            {popupError && <div style={s.errorBox}>{popupError}</div>}

            <div style={s.formActions}>
              <button type="button" style={s.secondaryButton} onClick={() => setRegistered(null)}>
                Close
              </button>
              <button
                type="button"
                style={s.primaryButton}
                disabled={sendingId === registered.id}
                onClick={() => sendToMedtech(registered)}
              >
                {sendingId === registered.id ? "Sending..." : "Send to MedTech"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, s }) {
  return (
    <label style={s.label}>
      {label}
      {children}
    </label>
  );
}

const styles = {
  header: { marginBottom: "20px" },
  title: { margin: 0, fontSize: "28px", fontWeight: 800, color: "#172033" },
  subtitle: { margin: "8px 0 0", fontSize: "13px", color: "#667085" },
  card: {
    maxWidth: "760px",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "24px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  grid3: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" },
  grid2: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" },
  label: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 600, color: "#344054" },
  input: {
    padding: "11px 12px",
    border: "1px solid #d0d5dd",
    borderRadius: "8px",
    fontSize: "14px",
    fontFamily: "inherit",
    color: "#17202a",
    background: "#ffffff",
    minWidth: 0,
  },
  formActions: { display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" },
  primaryButton: {
    padding: "12px 18px",
    border: "none",
    background: "#123c69",
    color: "#ffffff",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "12px 18px",
    border: "1px solid #d0d5dd",
    background: "#ffffff",
    color: "#344054",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  errorBox: {
    maxWidth: "760px",
    boxSizing: "border-box",
    marginBottom: "16px",
    padding: "12px 14px",
    borderRadius: "8px",
    background: "#fff4f4",
    color: "#b42318",
    fontSize: "13px",
  },
  successBox: {
    maxWidth: "760px",
    boxSizing: "border-box",
    marginBottom: "16px",
    padding: "12px 14px",
    borderRadius: "8px",
    background: "#ecfdf3",
    color: "#027a48",
    fontSize: "13px",
    fontWeight: 600,
  },
  sectionTitle: { margin: 0, fontSize: "16px", fontWeight: 800 },
  list: { display: "flex", flexDirection: "column", gap: "10px" },
  listRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px 14px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
  },
  listName: { fontWeight: 800, fontSize: "15px", color: "#172033" },
  listMeta: { fontSize: "12px", color: "#667085", marginTop: "4px" },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(16, 24, 40, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    zIndex: 50,
  },
  modal: {
    width: "100%",
    maxWidth: "460px",
    background: "#ffffff",
    borderRadius: "14px",
    padding: "28px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  checkCircle: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "#ecfdf3",
    color: "#027a48",
    fontSize: "22px",
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: { margin: 0, fontSize: "20px", fontWeight: 800 },
  summary: { background: "#f5f7fa", borderRadius: "10px", padding: "14px 16px" },
};

const mobileStyles = {
  title: { fontSize: "20px" },
  card: { padding: "16px" },
  grid3: { gridTemplateColumns: "1fr" },
  grid2: { gridTemplateColumns: "1fr" },
  listRow: { flexDirection: "column", alignItems: "stretch" },
  modal: { padding: "20px" },
};

const mobileMerged = Object.fromEntries(
  Object.keys(styles).map((k) => [k, { ...styles[k], ...(mobileStyles[k] || {}) }])
);
