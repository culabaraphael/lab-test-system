import React, { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { API_URL } from "../../config";
import CounterRegister from "./CounterRegister";

export default function CounterDashboard() {
  // Phone-size layout (narrow screens get the mobile style overrides).
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 760
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 760);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const st = isMobile ? mobileMerged : styles;

  // Which page the Counter/Nurse is on: result release or patient registration.
  const [view, setView] = useState("release");

  const [approvedResults, setApprovedResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // IDs already viewed by the Counter/Nurse
  const [seenIds, setSeenIds] = useState(() => {
    try {
      const saved = localStorage.getItem(
        "counter_seen_result_ids"
      );

      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Prevent existing approved results from being
  // incorrectly marked as NEW on first page load.
  const [firstLoad, setFirstLoad] = useState(true);

  // QR regeneration state (Counter/Nurse re-issuing an expired token)
  const [qrRegenerating, setQrRegenerating] = useState(false);
  const [qrError, setQrError] = useState("");

  // Re-render every second so the "expires in ..." countdown stays live.
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // =========================================================
  // PATIENT NAME
  // =========================================================

  const getPatientName = (result) => {
    if (result.patient?.name) {
      return result.patient.name;
    }

    if (result.patient?.full_name) {
      return result.patient.full_name;
    }

    if (result.patient_name) {
      return result.patient_name;
    }

    if (
      result.patient?.first_name ||
      result.patient?.last_name
    ) {
      return [
        result.patient?.first_name,
        result.patient?.middle_name,
        result.patient?.last_name,
      ]
        .filter(Boolean)
        .join(" ");
    }

    return "Unknown Patient";
  };

  // =========================================================
  // TEST NAME
  // =========================================================

  const getTestName = (result) => {
    if (result.test_type?.name) {
      return result.test_type.name;
    }

    if (result.test_type_name) {
      return result.test_type_name;
    }

    if (result.test_name) {
      return result.test_name;
    }

    return "Laboratory Test";
  };

  // =========================================================
  // PATIENT ID
  // =========================================================

  const getPatientId = (result) => {
    return (
      result.patient?.patient_id ||
      result.patient?.id ||
      result.patient_id ||
      "N/A"
    );
  };

  // =========================================================
  // LOAD APPROVED RESULTS
  // =========================================================

  const loadApprovedResults = async () => {
    try {
      const response = await fetch(
        `${API_URL}/lab-results`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load laboratory results."
        );
      }

      const data = await response.json();

      /*
       * IMPORTANT:
       * Your Laravel LabResultController returns:
       *
       * {
       *   success: true,
       *   lab_results: [...]
       * }
       *
       * We support that structure first.
       */

      const records = Array.isArray(data?.lab_results)
        ? data.lab_results
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
        ? data
        : [];

      // =====================================================
      // ONLY DOCTOR-APPROVED RESULTS
      // =====================================================

      const approved = records.filter(
        (result) =>
          String(result.status || "").toUpperCase() ===
          "APPROVED"
      );

      // =====================================================
      // NEWEST APPROVED FIRST
      // =====================================================

      approved.sort((a, b) => {
        const dateA = new Date(
          a.approved_at ||
            a.updated_at ||
            a.created_at ||
            0
        );

        const dateB = new Date(
          b.approved_at ||
            b.updated_at ||
            b.created_at ||
            0
        );

        return dateB - dateA;
      });

      // =====================================================
      // FIRST LOAD
      // =====================================================

      if (firstLoad) {
        const existingIds = approved
          .map((result) => result.id)
          .filter(Boolean);

        const mergedIds = Array.from(
          new Set([
            ...seenIds,
            ...existingIds,
          ])
        );

        setSeenIds(mergedIds);

        localStorage.setItem(
          "counter_seen_result_ids",
          JSON.stringify(mergedIds)
        );

        setFirstLoad(false);
      }

      setApprovedResults(approved);
      setError("");
    } catch (err) {
      console.error(
        "Counter Dashboard Error:",
        err
      );

      setError(
        "Unable to connect to the laboratory system."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // INITIAL LOAD + LIVE MONITORING
  // =========================================================

  useEffect(() => {
    loadApprovedResults();

    // Check for newly approved results every 5 seconds.
    const interval = setInterval(() => {
      loadApprovedResults();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // =========================================================
  // SEARCH
  // =========================================================

  const filteredResults = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return approvedResults;
    }

    return approvedResults.filter((result) => {
      const patientName =
        getPatientName(result).toLowerCase();

      const testName =
        getTestName(result).toLowerCase();

      const patientId =
        String(getPatientId(result)).toLowerCase();

      return (
        patientName.includes(query) ||
        testName.includes(query) ||
        patientId.includes(query)
      );
    });
  }, [approvedResults, search]);

  // =========================================================
  // OPEN RESULT
  // =========================================================

  const openResult = (result) => {
    setSelectedResult(result);

    if (!seenIds.includes(result.id)) {
      const updatedIds = [
        ...seenIds,
        result.id,
      ];

      setSeenIds(updatedIds);

      localStorage.setItem(
        "counter_seen_result_ids",
        JSON.stringify(updatedIds)
      );
    }
  };

  // =========================================================
  // QR TOKEN HELPERS
  // =========================================================

  const isTokenExpired = (result) => {
    if (!result?.access_token || !result?.access_token_expires_at) {
      return true;
    }

    return (
      new Date(result.access_token_expires_at).getTime() <= nowTick
    );
  };

  const getPatientResultUrl = (result) => {
    if (!result?.access_token) {
      return "";
    }

    // VITE_PUBLIC_APP_URL (frontend/.env.local) lets the QR point to a public
    // address, such as a Cloudflare tunnel, even when the Counter page itself
    // is opened on localhost.
    const base = (
      import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin
    ).replace(/\/+$/, "");

    return `${base}/patient/dashboard?token=${result.access_token}`;
  };

  const regenerateQr = async (result) => {
    setQrRegenerating(true);
    setQrError("");

    try {
      const response = await fetch(
        `${API_URL}/lab-results/${result.id}/qr-token`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message || "Unable to generate a new QR code."
        );
      }

      const updated = {
        ...result,
        access_token: data.access_token,
        access_token_expires_at: data.access_token_expires_at,
      };

      setSelectedResult(updated);

      setApprovedResults((prev) =>
        prev.map((item) =>
          item.id === result.id ? updated : item
        )
      );
    } catch (err) {
      setQrError(err.message || "Unable to generate a new QR code.");
    } finally {
      setQrRegenerating(false);
    }
  };

  // =========================================================
  // DATE FORMAT
  // =========================================================

  const formatDate = (value) => {
    if (!value) {
      return "Not available";
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
      return "Not available";
    }

    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div style={st.page}>

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside style={st.sidebar}>

        <div>

          <div style={st.logo}>
            LIS
          </div>

          <h2 style={st.systemTitle}>
            Laboratory
            <br />
            Information System
          </h2>

          <div style={st.roleBadge}>
            COUNTER / NURSE
          </div>

          <div style={st.menuLabel}>
            MAIN
          </div>

          <button
            type="button"
            style={view === "release" ? st.activeMenu : st.menuItem}
            onClick={() => setView("release")}
          >
            <span style={st.menuIcon}>▣</span>
            Dashboard
          </button>

          <button
            type="button"
            style={view === "register" ? st.activeMenu : st.menuItem}
            onClick={() => setView("register")}
          >
            <span style={st.menuIcon}>＋</span>
            Register Patient
          </button>

        </div>

        <button
          style={st.logout}
          onClick={() => {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("user");
            window.location.href = "/login";
          }}
        >
          ↪ Log out
        </button>

      </aside>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <main style={st.main}>

        {view === "register" ? (
          <CounterRegister isMobile={isMobile} />
        ) : (
        <>

        {/* =================================================
            HEADER
        ================================================= */}

        <div style={st.header}>

          <div>

            <h1 style={st.title}>
              Patient Result Release
            </h1>

            <p style={st.subtitle}>
              Doctor-approved laboratory results
              ready for patient release.
            </p>

          </div>

          <div style={st.liveBadge}>
            <span style={st.liveDot}></span>
            LIVE
          </div>

        </div>

        {/* =================================================
            LIVE MONITORING BAR
        ================================================= */}

        <div style={st.liveBar}>

          <div>

            <strong style={st.liveText}>
              ● Live monitoring
            </strong>

            <span style={st.liveDescription}>
              {" "}
              New doctor-approved results appear
              automatically.
            </span>

          </div>

          <div style={st.refreshText}>
            Checking every 5 seconds
          </div>

        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div style={st.error}>
            <strong>Connection error:</strong>{" "}
            {error}
          </div>
        )}

        {/* =================================================
            SUMMARY
        ================================================= */}

        <div style={st.summaryGrid}>

          <div style={st.summaryCard}>

            <div style={st.number}>
              {loading ? "—" : approvedResults.length}
            </div>

            <div style={st.cardTitle}>
              Approved Results
            </div>

            <div style={st.cardDescription}>
              All approved results available
            </div>

          </div>

          <div style={st.summaryCard}>

            <div style={st.number}>
              {loading ? "—" : filteredResults.length}
            </div>

            <div style={st.cardTitle}>
              Showing
            </div>

            <div style={st.cardDescription}>
              Results matching search
            </div>

          </div>

          <div style={st.summaryCard}>

            <div style={st.ready}>
              ● READY
            </div>

            <div style={st.cardTitle}>
              Counter Status
            </div>

            <div style={st.cardDescription}>
              Monitoring Doctor approvals
            </div>

          </div>

        </div>

        {/* =================================================
            PATIENT QUEUE
        ================================================= */}

        <section style={st.section}>

          <div style={st.sectionHeader}>

            <div>

              <h2 style={st.sectionTitle}>
                Patients Ready for Release
              </h2>

              <p style={st.sectionSubtitle}>
                Call the patient's name from the
                waiting area.
              </p>

            </div>

            <input
              type="text"
              placeholder="Search patient name or ID..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              style={st.search}
            />

          </div>

          {/* =================================================
              LOADING
          ================================================= */}

          {loading && (
            <div style={st.emptyState}>

              <div style={st.emptyIcon}>
                ...
              </div>

              <h3 style={st.emptyTitle}>
                Loading approved results
              </h3>

              <p style={st.emptyDescription}>
                Connecting to the laboratory system.
              </p>

            </div>
          )}

          {/* =================================================
              NO RESULTS
          ================================================= */}

          {!loading &&
            filteredResults.length === 0 && (

              <div style={st.emptyState}>

                <div style={st.emptyIcon}>
                  ✓
                </div>

                <h3 style={st.emptyTitle}>
                  {search
                    ? "No patient found"
                    : "No approved results"}
                </h3>

                <p style={st.emptyDescription}>
                  {search
                    ? "Try another patient name or patient ID."
                    : "When a Doctor approves a laboratory result, the patient will appear here automatically."}
                </p>

              </div>

            )}

          {/* =================================================
              APPROVED RESULT LIST
          ================================================= */}

          {!loading &&
            filteredResults.length > 0 && (

              <div style={st.resultList}>

                {filteredResults.map((result) => {

                  const isNew =
                    !seenIds.includes(result.id);

                  return (

                    <div
                      key={result.id}
                      style={{
                        ...st.patientCard,
                        ...(isNew
                          ? st.newPatientCard
                          : {}),
                      }}
                    >

                      {/* NEW BADGE */}

                      <div style={st.badgeColumn}>

                        {isNew && (
                          <div style={st.newBadge}>

                            <span
                              style={st.newDot}
                            ></span>

                            NEW

                          </div>
                        )}

                      </div>

                      {/* PATIENT INFORMATION */}

                      <div style={st.patientInfo}>

                        <div style={st.patientName}>
                          {getPatientName(result)}
                        </div>

                        <div style={st.patientId}>
                          Patient ID: {getPatientId(result)}
                        </div>

                        <div style={st.testName}>
                          {getTestName(result)}
                        </div>

                        <div style={st.approvedTime}>
                          Doctor approved:{" "}
                          {formatDate(
                            result.approved_at ||
                              result.updated_at ||
                              result.created_at
                          )}
                        </div>

                      </div>

                      {/* STATUS */}

                      <div style={st.approvedStatus}>
                        ✓ APPROVED
                      </div>

                      {/* VIEW */}

                      <button
                        style={st.viewButton}
                        onClick={() =>
                          openResult(result)
                        }
                      >
                        VIEW
                      </button>

                    </div>

                  );
                })}

              </div>

            )}

        </section>

        </>
        )}

      </main>

      {/* =====================================================
          RESULT MODAL
      ===================================================== */}

      {selectedResult && (

        <div
          style={st.overlay}
          onClick={() =>
            setSelectedResult(null)
          }
        >

          <div
            style={st.modal}
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* MODAL HEADER */}

            <div style={st.modalHeader}>

              <div>

                <div style={st.modalLabel}>
                  APPROVED LABORATORY RESULT
                </div>

                <h2 style={st.modalTitle}>
                  {getPatientName(selectedResult)}
                </h2>

              </div>

              <button
                style={st.modalClose}
                onClick={() =>
                  setSelectedResult(null)
                }
              >
                ×
              </button>

            </div>

            {/* PATIENT / TEST DETAILS */}

            <div style={st.detailGrid}>

              <div style={st.detailBox}>

                <div style={st.detailLabel}>
                  PATIENT ID
                </div>

                <div style={st.detailValue}>
                  {getPatientId(selectedResult)}
                </div>

              </div>

              <div style={st.detailBox}>

                <div style={st.detailLabel}>
                  LABORATORY TEST
                </div>

                <div style={st.detailValue}>
                  {getTestName(selectedResult)}
                </div>

              </div>

              <div style={st.detailBox}>

                <div style={st.detailLabel}>
                  STATUS
                </div>

                <div style={st.modalApproved}>
                  ✓ APPROVED BY DOCTOR
                </div>

              </div>

              <div style={st.detailBox}>

                <div style={st.detailLabel}>
                  APPROVED
                </div>

                <div style={st.detailValue}>
                  {formatDate(
                    selectedResult.approved_at ||
                      selectedResult.updated_at ||
                      selectedResult.created_at
                  )}
                </div>

              </div>

            </div>

            {/* =================================================
                PARAMETERS
            ================================================= */}

            <div style={st.parameterSection}>

              <div style={st.noParameters}>
                Result values and health information are visible only
                to the Doctor and the patient. Generate a QR code below
                to release this result to the patient.
              </div>

            </div>

            {/* =================================================
                QR RESULT RELEASE
            ================================================= */}

            <div style={st.qrSection}>

              <div style={st.qrBox}>
                {selectedResult.access_token &&
                !isTokenExpired(selectedResult) ? (
                  <QRCodeSVG
                    value={getPatientResultUrl(selectedResult)}
                    size={140}
                  />
                ) : (
                  <div style={st.qrText}>
                    <div style={st.qrEmpty}>
                      EXPIRED
                    </div>
                  </div>
                )}
              </div>

              <div>

                <h3 style={st.qrTitle}>
                  QR Result Release
                </h3>

                <p style={st.qrDescription}>
                  {selectedResult.access_token &&
                  !isTokenExpired(selectedResult)
                    ? "Show this QR code to the patient. It expires 15 minutes after generation."
                    : "This QR code has expired. Generate a new one before showing it to the patient."}
                </p>

                <button
                  type="button"
                  onClick={() => regenerateQr(selectedResult)}
                  disabled={qrRegenerating}
                  style={st.qrRegenerateButton}
                >
                  {qrRegenerating
                    ? "Generating..."
                    : selectedResult.access_token &&
                      !isTokenExpired(selectedResult)
                    ? "Regenerate QR"
                    : "Generate New QR"}
                </button>

                {selectedResult.access_token &&
                  !isTokenExpired(selectedResult) && (
                    <a
                      href={getPatientResultUrl(selectedResult)}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-block",
                        marginLeft: "12px",
                        marginTop: "8px",
                        fontSize: "13px",
                        color: "#2563eb",
                        textDecoration: "underline",
                      }}
                    >
                      Open patient link
                    </a>
                  )}

                {qrError && (
                  <p style={st.qrErrorText}>{qrError}</p>
                )}

              </div>

            </div>

            {/* CLOSE */}

            <button
              style={st.closeButton}
              onClick={() =>
                setSelectedResult(null)
              }
            >
              CLOSE
            </button>

          </div>

        </div>

      )}

    </div>
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles = {

  page: {
    minHeight: "100vh",
    display: "flex",
    background: "#f5f7fa",
    color: "#17202a",
    fontFamily: "Inter, Arial, sans-serif",
  },

  // Sticky, full-height sidebar: Log out stays visible at the bottom
  // without scrolling; only the main content scrolls.
  sidebar: {
    width: "240px",
    height: "100vh",
    position: "sticky",
    top: 0,
    alignSelf: "flex-start",
    overflowY: "auto",
    background: "#ffffff",
    borderRight: "1px solid #e5e7eb",
    padding: "28px 18px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    flexShrink: 0,
  },

  logo: {
    width: "44px",
    height: "44px",
    borderRadius: "10px",
    background: "#123c69",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
    fontSize: "14px",
  },

  systemTitle: {
    margin: "12px 0 0",
    fontSize: "15px",
    lineHeight: "1.4",
  },

  roleBadge: {
    display: "inline-block",
    marginTop: "12px",
    padding: "6px 9px",
    borderRadius: "6px",
    background: "#eef4fb",
    color: "#24578c",
    fontSize: "10px",
    fontWeight: "800",
  },

  menuLabel: {
    marginTop: "42px",
    marginBottom: "8px",
    color: "#98a2b3",
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1px",
  },

  activeMenu: {
    width: "100%",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
    marginBottom: "4px",
    padding: "12px",
    borderRadius: "8px",
    background: "#eef4fb",
    color: "#123c69",
    fontSize: "14px",
    fontWeight: "700",
    display: "flex",
    gap: "10px",
    alignItems: "center",
  },

  menuItem: {
    width: "100%",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
    marginBottom: "4px",
    padding: "12px",
    borderRadius: "8px",
    background: "transparent",
    color: "#344054",
    fontSize: "14px",
    fontWeight: "600",
    display: "flex",
    gap: "10px",
    alignItems: "center",
  },

  menuIcon: {
    fontSize: "13px",
  },

  logout: {
    border: "none",
    background: "transparent",
    color: "#b42318",
    fontWeight: "600",
    textAlign: "left",
    padding: "12px",
    cursor: "pointer",
    fontSize: "14px",
  },

  main: {
    flex: 1,
    padding: "34px 42px",
    boxSizing: "border-box",
    minWidth: 0,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
  },

  title: {
    margin: 0,
    fontSize: "25px",
    fontWeight: "800",
    color: "#172033",
  },

  subtitle: {
    margin: "7px 0 0",
    color: "#667085",
    fontSize: "13px",
  },

  liveBadge: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    padding: "7px 11px",
    borderRadius: "20px",
    background: "#ecfdf3",
    color: "#027a48",
    fontSize: "11px",
    fontWeight: "800",
  },

  liveDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "#12b76a",
  },

  liveBar: {
    marginTop: "25px",
    padding: "13px 16px",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
  },

  liveText: {
    color: "#027a48",
    fontSize: "12px",
  },

  liveDescription: {
    color: "#667085",
    fontSize: "12px",
  },

  refreshText: {
    color: "#98a2b3",
    fontSize: "11px",
    whiteSpace: "nowrap",
  },

  error: {
    marginTop: "15px",
    padding: "12px 14px",
    background: "#fff4f4",
    border: "1px solid #fecdca",
    borderRadius: "7px",
    color: "#b42318",
    fontSize: "12px",
  },

  summaryGrid: {
    marginTop: "20px",
    display: "grid",
    gridTemplateColumns:
      "repeat(3, minmax(0, 1fr))",
    gap: "16px",
  },

  summaryCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "9px",
    padding: "18px",
  },

  number: {
    fontSize: "25px",
    fontWeight: "800",
    color: "#123c69",
  },

  ready: {
    fontSize: "14px",
    fontWeight: "800",
    color: "#027a48",
    marginBottom: "8px",
  },

  cardTitle: {
    marginTop: "7px",
    fontSize: "13px",
    fontWeight: "700",
    color: "#172033",
  },

  cardDescription: {
    marginTop: "5px",
    fontSize: "11px",
    color: "#98a2b3",
  },

  section: {
    marginTop: "20px",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "9px",
    overflow: "hidden",
  },

  sectionHeader: {
    padding: "18px 20px",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "15px",
    fontWeight: "800",
    color: "#172033",
  },

  sectionSubtitle: {
    margin: "5px 0 0",
    color: "#98a2b3",
    fontSize: "11px",
  },

  search: {
    width: "270px",
    maxWidth: "100%",
    padding: "10px 12px",
    border: "1px solid #d0d5dd",
    borderRadius: "7px",
    outline: "none",
    fontSize: "12px",
    boxSizing: "border-box",
  },

  resultList: {
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  patientCard: {
    display: "grid",
    gridTemplateColumns:
      "70px minmax(0, 1fr) auto auto",
    alignItems: "center",
    gap: "18px",
    padding: "16px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    background: "#ffffff",
  },

  newPatientCard: {
    borderColor: "#b8d4ef",
    background: "#fbfdff",
  },

  badgeColumn: {
    minWidth: "70px",
  },

  newBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "5px 7px",
    borderRadius: "5px",
    background: "#eef4fb",
    color: "#24578c",
    fontSize: "9px",
    fontWeight: "800",
  },

  newDot: {
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    background: "#24578c",
  },

  patientInfo: {
    minWidth: 0,
  },

  patientName: {
    fontSize: "14px",
    fontWeight: "800",
    color: "#172033",
  },

  patientId: {
    marginTop: "3px",
    fontSize: "10px",
    color: "#667085",
  },

  testName: {
    marginTop: "5px",
    fontSize: "11px",
    color: "#24578c",
    fontWeight: "700",
  },

  approvedTime: {
    marginTop: "5px",
    fontSize: "10px",
    color: "#98a2b3",
  },

  approvedStatus: {
    padding: "6px 9px",
    borderRadius: "5px",
    background: "#ecfdf3",
    color: "#027a48",
    fontSize: "9px",
    fontWeight: "800",
    whiteSpace: "nowrap",
  },

  viewButton: {
    border: "1px solid #123c69",
    background: "#123c69",
    color: "#ffffff",
    padding: "9px 14px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "10px",
    fontWeight: "800",
  },

  emptyState: {
    padding: "60px 25px",
    textAlign: "center",
  },

  emptyIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    background: "#eef4fb",
    color: "#24578c",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 12px",
    fontWeight: "800",
  },

  emptyTitle: {
    margin: 0,
    fontSize: "14px",
    color: "#172033",
  },

  emptyDescription: {
    margin: "7px auto 0",
    maxWidth: "500px",
    fontSize: "11px",
    color: "#98a2b3",
    lineHeight: "1.5",
  },

  /* ========================================================
     MODAL
  ======================================================== */

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.48)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "25px",
    zIndex: 1000,
  },

  modal: {
    width: "850px",
    maxWidth: "100%",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: "10px",
    padding: "25px",
    boxSizing: "border-box",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    paddingBottom: "18px",
    borderBottom: "1px solid #e5e7eb",
  },

  modalLabel: {
    fontSize: "9px",
    fontWeight: "800",
    color: "#667085",
    letterSpacing: "0.7px",
  },

  modalTitle: {
    margin: "6px 0 0",
    fontSize: "20px",
    color: "#172033",
  },

  modalClose: {
    border: "none",
    background: "#f2f4f7",
    color: "#667085",
    width: "32px",
    height: "32px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "20px",
  },

  detailGrid: {
    marginTop: "18px",
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  },

  detailBox: {
    padding: "12px",
    background: "#f8fafc",
    border: "1px solid #eaecf0",
    borderRadius: "7px",
  },

  detailLabel: {
    fontSize: "9px",
    color: "#98a2b3",
    fontWeight: "800",
  },

  detailValue: {
    marginTop: "5px",
    fontSize: "12px",
    color: "#172033",
    fontWeight: "700",
  },

  modalApproved: {
    marginTop: "5px",
    color: "#027a48",
    fontSize: "10px",
    fontWeight: "800",
  },

  parameterSection: {
    marginTop: "22px",
  },

  parameterTitle: {
    margin: 0,
    fontSize: "13px",
    fontWeight: "800",
    color: "#172033",
  },

  tableWrapper: {
    marginTop: "10px",
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: "7px",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "11px",
  },

  th: {
    textAlign: "left",
    padding: "10px",
    background: "#f8fafc",
    color: "#667085",
    fontSize: "9px",
    fontWeight: "800",
    borderBottom: "1px solid #e5e7eb",
  },

  td: {
    padding: "10px",
    borderBottom: "1px solid #f0f2f5",
    color: "#344054",
  },

  flag: {
    display: "inline-block",
    padding: "4px 7px",
    borderRadius: "5px",
    fontSize: "8px",
    fontWeight: "800",
  },

  flagHigh: {
    background: "#fef3f2",
    color: "#b42318",
  },

  flagLow: {
    background: "#fffaeb",
    color: "#b54708",
  },

  flagNormal: {
    background: "#ecfdf3",
    color: "#027a48",
  },

  flagUnknown: {
    background: "#f2f4f7",
    color: "#667085",
  },

  noParameters: {
    marginTop: "10px",
    padding: "20px",
    background: "#f8fafc",
    borderRadius: "7px",
    textAlign: "center",
    color: "#98a2b3",
    fontSize: "11px",
  },

  /* ========================================================
     QR PLACEHOLDER
  ======================================================== */

  qrSection: {
    marginTop: "22px",
    padding: "16px",
    border: "1px dashed #d0d5dd",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    background: "#fcfcfd",
  },

  qrBox: {
    width: "75px",
    height: "75px",
    border: "1px solid #d0d5dd",
    borderRadius: "6px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#ffffff",
    flexShrink: 0,
  },

  qrText: {
    fontSize: "15px",
    fontWeight: "900",
    color: "#98a2b3",
  },

  qrEmpty: {
    marginTop: "3px",
    fontSize: "8px",
    color: "#b0b7c3",
    fontWeight: "800",
  },

  qrTitle: {
    margin: 0,
    fontSize: "12px",
    fontWeight: "800",
    color: "#344054",
  },

  qrDescription: {
    margin: "5px 0 0",
    fontSize: "10px",
    color: "#98a2b3",
  },

  qrRegenerateButton: {
    marginTop: "10px",
    padding: "8px 14px",
    border: "1px solid #123c69",
    borderRadius: "6px",
    background: "#ffffff",
    color: "#123c69",
    cursor: "pointer",
    fontSize: "10px",
    fontWeight: "700",
  },

  qrErrorText: {
    margin: "8px 0 0",
    fontSize: "10px",
    color: "#b42318",
  },

  closeButton: {
    width: "100%",
    marginTop: "20px",
    padding: "11px",
    border: "none",
    borderRadius: "6px",
    background: "#123c69",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: "10px",
    fontWeight: "800",
  },
};

/* ============================================================
   PHONE-SIZE OVERRIDES (screens narrower than 760px)
============================================================ */

const mobileStyles = {
  page: { flexDirection: "column" },
  sidebar: {
    width: "100%",
    height: "auto",
    position: "static",
    alignSelf: "stretch",
    overflowY: "visible",
    flexWrap: "wrap",
    gap: "8px",
    padding: "12px 16px",
    flexDirection: "row",
    alignItems: "center",
    borderRight: "none",
    borderBottom: "1px solid #e5e7eb",
  },
  logo: { width: "36px", height: "36px", fontSize: "12px" },
  roleBadge: { marginTop: "6px" },
  systemTitle: { display: "none" },
  menuLabel: { display: "none" },
  activeMenu: { display: "inline-flex", width: "auto", padding: "8px 10px", fontSize: "12px", marginTop: "8px", marginRight: "6px" },
  menuItem: { display: "inline-flex", width: "auto", padding: "8px 10px", fontSize: "12px", marginTop: "8px", marginRight: "6px" },
  main: { padding: "16px" },
  header: { gap: "10px" },
  title: { fontSize: "20px" },
  liveBar: { flexDirection: "column", alignItems: "flex-start", gap: "4px" },
  summaryGrid: { gridTemplateColumns: "1fr", gap: "10px" },
  sectionHeader: { flexDirection: "column", alignItems: "stretch", gap: "10px", padding: "14px" },
  search: { width: "100%", fontSize: "14px" },
  resultList: { padding: "10px" },
  patientCard: { gridTemplateColumns: "minmax(0, 1fr) auto", gap: "8px 10px", padding: "12px" },
  badgeColumn: { gridColumn: "1 / -1", minWidth: 0 },
  patientInfo: { gridColumn: "1 / -1" },
  approvedStatus: { justifySelf: "start" },
  viewButton: { justifySelf: "end", padding: "10px 16px", fontSize: "12px" },
  overlay: { padding: "10px", alignItems: "flex-start" },
  modal: { padding: "16px", maxHeight: "95vh" },
  modalHeader: { gap: "10px" },
  detailGrid: { gridTemplateColumns: "1fr" },
  qrSection: { flexDirection: "column", alignItems: "flex-start" },
};

const mobileMerged = Object.fromEntries(
  Object.keys(styles).map((k) => [k, { ...styles[k], ...(mobileStyles[k] || {}) }])
);
