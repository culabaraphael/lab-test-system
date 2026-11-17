#!/usr/bin/env node
/**
 * End-to-end flow test through the real API, one result per test type:
 *
 *   1. MedTech registers dummy patients (Male, Female with allergy "peanuts").
 *   2. MedTech encodes a result (one abnormal value when the test type has a
 *      reference range) and the flags are checked.
 *   3. Doctor sees it in the pending list, opens it (same values and flags),
 *      gets the AI text when a KB entry covers the finding, edits it, approves.
 *   4. Counter/Nurse sees the approved result WITHOUT values and makes a new QR.
 *   5. Patient opens the QR link: values, flags and the Doctor-edited text.
 *
 * Extra flows: reject -> MedTech edit -> approve, cancel, hide AI text,
 * allergy auto-hide of lifestyle tips, Bisaya translation, role checks.
 *
 * Usage (PowerShell, project root, start-all.ps1 running):
 *   $env:MEDTECH_USER="medtech01"; $env:MEDTECH_PASS="..."
 *   $env:DOCTOR_USER="doctor01";   $env:DOCTOR_PASS="..."
 *   $env:COUNTER_USER="counter01"; $env:COUNTER_PASS="..."   # optional
 *   node scripts/test-full-flow.mjs            # with AI (several minutes)
 *   node scripts/test-full-flow.mjs --ai=none  # no AI calls
 *   node scripts/test-full-flow.mjs --only=CBC,FBS
 *
 * Approved results cannot be cancelled through the API, so the test data
 * stays in the database. Run "php artisan lab:reset-data" afterwards for a
 * clean start. Report: scripts/flow-report-<timestamp>.md
 */
import fs from "node:fs";

const API = (process.env.API_URL || "http://127.0.0.1:8000/api").replace(/\/$/, "");
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v ?? true];
}));
const AI = (args.ai || "all") !== "none";
const ONLY = args.only ? String(args.only).split(",").map((s) => s.trim().toUpperCase()) : null;

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const round = (n) => Math.round(n * 100) / 100;
const norm = (s) => String(s || "").trim().toLowerCase();

async function call(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* not JSON */ }
  return { status: res.status, ok: res.ok, json };
}

async function login(userVar, passVar, role) {
  const username = process.env[userVar];
  const password = process.env[passVar];
  if (!username || !password) return null;
  const r = await call("POST", "/login", null, { username, password, role });
  if (!r.ok || !r.json?.token) throw new Error(`${role} login failed (HTTP ${r.status}): ${r.json?.message || ""}`);
  return r.json.token;
}

const rows = [];
function rec(area, step, ok, detail = "") {
  const status = ok === null ? "INFO" : ok ? "PASS" : "FAIL";
  rows.push({ area, step, status, detail });
  console.log(`[${status === "PASS" ? "PASS" : status === "INFO" ? "info" : "FAIL"}] ${area.padEnd(12)} ${step.padEnd(52)} ${detail}`);
  return ok;
}

let KB = [];
try { KB = JSON.parse(fs.readFileSync("rag/knowledge_base.json", "utf8")); } catch { /* optional */ }
function covered(code, param, flag) {
  const opposite = flag === "LOW" ? "HIGH" : flag === "HIGH" ? "LOW" : null;
  return KB.some((e) => e.test_type === code && e.parameters.some((x) => norm(x) === norm(param)) && e.flag !== opposite);
}

const TEXT_SAMPLES = {
  "ABO Blood Group": "O", "Rh Factor": "Positive", Color: "Yellow", Consistency: "Formed",
  "White Blood Cells": "0-2", "Red Blood Cells": "0-2", "Epithelial Cells": "Rare",
  "Mucous Threads": "Rare", "Amorphous Urates": "None seen", Bacteria: "None seen",
};
function abnormalText(normal) {
  const n = norm(normal);
  if (n.includes("non-reactive")) return "Reactive";
  if (n.includes("negative")) return "Positive";
  if (n.includes("none seen")) return "Present";
  if (n === "clear") return "Cloudy";
  return "Abnormal";
}
function value(p, kind) {
  const low = num(p.low_value), high = num(p.high_value);
  if (p.data_type === "numeric") {
    if (kind === "high") return { value_numeric: round((high ?? low) * 1.3 + 1) };
    if (kind === "low") return { value_numeric: round(low > 0 ? low * 0.5 : low - 1) };
    if (low !== null && high !== null) return { value_numeric: round((low + high) / 2) };
    if (high !== null) return { value_numeric: round(high * 0.5) };
    if (low !== null) return { value_numeric: round(low * 1.5 + 1) };
    return { value_numeric: 50 };
  }
  if (kind === "abnormal") return { value_text: abnormalText(p.normal_text) };
  return { value_text: p.normal_text ?? TEXT_SAMPLES[p.parameter_name] ?? "Normal" };
}
function expected(p, kind) {
  const hasRule = p.data_type === "numeric" ? num(p.low_value) !== null || num(p.high_value) !== null : p.normal_text != null;
  if (!hasRule) return "UNASSESSED";
  return { high: "HIGH", low: "LOW", abnormal: "ABNORMAL" }[kind] || "NORMAL";
}
// Pick the abnormal case to test: prefer one the KB covers (so AI text is expected).
function pickCase(code, params) {
  const cands = [];
  for (const p of params) {
    if (p.data_type === "numeric") {
      if (num(p.high_value) !== null) cands.push({ p, kind: "high", flag: "HIGH" });
      if (num(p.low_value) !== null && num(p.low_value) > 0) cands.push({ p, kind: "low", flag: "LOW" });
    } else if (p.normal_text != null) cands.push({ p, kind: "abnormal", flag: "ABNORMAL" });
  }
  return cands.find((c) => covered(code, c.p.parameter_name, c.flag)) || cands[0] || null;
}
function body(patient, testType, params, target) {
  return {
    patient_id: patient.id,
    test_type_id: testType.id,
    parameters: params.map((p) => ({
      reference_range_id: p.id, parameter_name: p.parameter_name,
      ...value(p, target && p.id === target.p.id ? target.kind : "normal"),
    })),
  };
}
const sameValue = (a, b) => (a.value_numeric != null ? Number(a.value_numeric) === Number(b.value_numeric) : norm(a.value_text) === norm(b.value_text));

async function main() {
  console.log(`API: ${API} | AI: ${AI ? "on" : "off"}\n`);
  const medtech = await login("MEDTECH_USER", "MEDTECH_PASS", "Medical Technologist");
  const doctor = await login("DOCTOR_USER", "DOCTOR_PASS", "Doctor");
  if (!medtech || !doctor) { console.error("Set MEDTECH_USER/PASS and DOCTOR_USER/PASS."); process.exit(2); }
  let counter = null;
  try { counter = await login("COUNTER_USER", "COUNTER_PASS", "COUNTER"); } catch (e) { rec("Counter", "login", false, e.message); }
  if (!counter) rec("Counter", "login", null, "no COUNTER_USER/COUNTER_PASS: Counter steps skipped");

  // 1. Register
  const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "");
  const patients = {};
  for (const [sex, allergies] of [["Male", null], ["Female", "peanuts"]]) {
    const r = await call("POST", "/patients", medtech, { first_name: `FLOW${sex}`, last_name: `Test${stamp}`, date_of_birth: "1990-01-01", sex, allergies });
    rec("Register", `MedTech registers ${sex} patient${allergies ? " (allergy: peanuts)" : ""}`, r.status === 201, `HTTP ${r.status}`);
    if (!r.ok) { console.error(JSON.stringify(r.json)); process.exit(1); }
    patients[sex] = r.json.patient;
    rec("Register", `${sex}: patient ID and allergy saved`, /^P-\d{6}$/.test(r.json.patient.patient_id) && (r.json.patient.allergies ?? null) === allergies, `${r.json.patient.patient_id}, allergies=${r.json.patient.allergies ?? "none"}`);
  }

  const tt = await call("GET", "/test-types");
  const types = (tt.json?.test_types || []).filter((t) => !ONLY || ONLY.includes(t.code));
  const aiTexts = [];

  for (const testType of types) {
    const code = testType.code;
    const sex = code === "CBC" || code === "CREAT" || code === "BUA" ? "Female" : "Male";
    const patient = patients[sex];
    const params = (await call("GET", `/test-types/${testType.id}/parameters?sex=${sex}`)).json?.parameters || [];
    if (!rec(code, `load parameters (${sex})`, params.length > 0, `${params.length} parameters`)) continue;

    // 2. Encode
    const target = pickCase(code, params);
    const sent = body(patient, testType, params, target);
    const s = await call("POST", "/lab-results", medtech, sent);
    if (!rec(code, `MedTech submits ${target ? target.p.parameter_name + " " + target.flag : "all values"}`, s.status === 201 && s.json?.lab_result?.status === "PENDING_REVIEW", `HTTP ${s.status} ${s.json?.lab_result?.status || JSON.stringify(s.json?.errors || s.json?.message || "")}`)) continue;
    const lr = s.json.lab_result;
    const bad = params.filter((p) => {
      const g = (lr.parameters || []).find((x) => x.reference_range_id === p.id);
      return !g || g.flag !== expected(p, target && p.id === target.p.id ? target.kind : "normal");
    });
    rec(code, "flags correct for every parameter", bad.length === 0, bad.length ? "wrong: " + bad.map((p) => p.parameter_name).join(", ") : "");

    // 3. Doctor
    const list = await call("GET", "/lab-results", doctor);
    const inList = (list.json?.lab_results || []).find((x) => x.id === lr.id);
    rec(code, "Doctor sees it in the list as PENDING_REVIEW", inList?.status === "PENDING_REVIEW", inList ? inList.status : "not in list");
    const one = await call("GET", `/lab-results/${lr.id}`, doctor);
    const dp = one.json?.lab_result?.parameters || [];
    const mismatch = sent.parameters.filter((p) => {
      const g = dp.find((x) => x.reference_range_id === p.reference_range_id);
      return !g || !sameValue(p, g);
    });
    rec(code, "Doctor sees the same values the MedTech sent", one.ok && mismatch.length === 0, mismatch.length ? "different: " + mismatch.map((p) => p.parameter_name).join(", ") : "");

    let editedText = null;
    if (AI && target) {
      const pv = await call("POST", `/lab-results/${lr.id}/recommendation/preview`, doctor);
      const text = pv.json?.ai_recommendation?.recommendation_text || "";
      const want = covered(code, target.p.parameter_name, target.flag);
      rec(code, want ? "AI text generated (KB entry exists)" : "no AI text (no KB entry)", want ? text.length > 0 : !text, want ? (text ? `${text.length} chars, model ${pv.json.ai_recommendation.model_used}` : `none (HTTP ${pv.status}; internet or provider?)`) : (text ? "unexpected text" : ""));
      if (text) {
        aiTexts.push({ code, finding: `${target.p.parameter_name} ${target.flag}`, text });
        const ed = await call("PUT", `/lab-results/${lr.id}/recommendation`, doctor, { recommendation_text: text + " (Edited by Doctor during flow test.)" });
        editedText = ed.json?.ai_recommendation?.recommendation_text || null;
        rec(code, "Doctor edits the AI text", ed.ok && editedText?.endsWith("(Edited by Doctor during flow test.)") && ed.json.ai_recommendation.edited_by_doctor === true, `HTTP ${ed.status}`);
      }
    }

    const ap = await call("POST", `/lab-results/${lr.id}/approve`, doctor);
    const token = ap.json?.lab_result?.access_token;
    if (!rec(code, "Doctor approves -> APPROVED with QR token", ap.ok && ap.json?.lab_result?.status === "APPROVED" && !!token, `HTTP ${ap.status}`)) continue;

    // 4. Counter
    let patientToken = token;
    if (counter) {
      const cl = await call("GET", "/lab-results", counter);
      const c = (cl.json?.lab_results || []).find((x) => x.id === lr.id);
      rec(code, "Counter sees the approved result", !!c, c ? "" : "not in Counter list");
      rec(code, "Counter cannot see result values", c && !("parameters" in c) && !("ai_recommendation" in c), c ? Object.keys(c).join(",") : "");
      const q = await call("POST", `/lab-results/${lr.id}/qr-token`, counter);
      const newToken = q.json?.access_token;
      rec(code, "Counter generates a new QR code", q.ok && !!newToken && newToken !== token, `HTTP ${q.status}`);
      if (newToken) {
        const old = await call("GET", `/lab-results/access/${encodeURIComponent(token)}`);
        rec(code, "old QR code no longer opens the result", !old.ok, `HTTP ${old.status}`);
        patientToken = newToken;
      }
    }

    // 5. Patient
    const pt = await call("GET", `/lab-results/access/${encodeURIComponent(patientToken)}`);
    const pl = pt.json?.lab_result;
    rec(code, "Patient opens the QR link", pt.ok && pl?.status === "APPROVED", `HTTP ${pt.status}`);
    if (pl) {
      const wrong = (lr.parameters || []).filter((p) => {
        const g = (pl.parameters || []).find((x) => x.reference_range_id === p.reference_range_id);
        return !g || g.flag !== p.flag || !sameValue(p, g);
      });
      rec(code, "Patient sees the same values and flags", wrong.length === 0, wrong.length ? "different: " + wrong.map((p) => p.parameter_name).join(", ") : "");
      if (editedText) rec(code, "Patient sees the Doctor-edited AI text", pl.ai_recommendation?.recommendation_text === editedText, "");
    }
  }

  // Extra flows (use FBS and LIPID when present)
  const byCode = Object.fromEntries((tt.json?.test_types || []).map((t) => [t.code, t]));
  async function encode(code, sex, kindFor) {
    const t = byCode[code];
    const params = (await call("GET", `/test-types/${t.id}/parameters?sex=${sex}`)).json?.parameters || [];
    const target = kindFor(params);
    const r = await call("POST", "/lab-results", medtech, body(patients[sex], t, params, target));
    return { r, params, t };
  }

  if (byCode.FBS && (!ONLY || ONLY.includes("FBS"))) {
    // Reject -> edit -> approve
    const { r, params, t } = await encode("FBS", "Male", (ps) => ({ p: ps[0], kind: "high" }));
    const id = r.json?.lab_result?.id;
    const rj = await call("POST", `/lab-results/${id}/reject`, doctor, { rejection_reason: "Please re-check the value (flow test)." });
    rec("Reject flow", "Doctor rejects with a reason", rj.ok && rj.json?.lab_result?.status === "REJECTED", `HTTP ${rj.status}`);
    const up = await call("PUT", `/lab-results/${id}`, medtech, { parameters: body(patients.Male, t, params, null).parameters });
    const st = up.json?.lab_result?.status;
    rec("Reject flow", "MedTech edits the rejected result", up.ok, `HTTP ${up.status}, status now ${st}`);
    rec("Reject flow", "edited result goes back to PENDING_REVIEW", st === "PENDING_REVIEW", `status ${st}`);
    rec("Reject flow", "flag recomputed after edit (NORMAL)", (up.json?.lab_result?.parameters || [])[0]?.flag === "NORMAL", (up.json?.lab_result?.parameters || [])[0]?.flag || "");
    const ap2 = await call("POST", `/lab-results/${id}/approve`, doctor);
    rec("Reject flow", "Doctor approves the corrected result", ap2.ok, `HTTP ${ap2.status} ${ap2.json?.message || ""}`);

    // Cancel
    const c1 = await encode("FBS", "Male", (ps) => ({ p: ps[0], kind: "high" }));
    const cid = c1.r.json?.lab_result?.id;
    const cc = await call("POST", `/lab-results/${cid}/cancel`, medtech, { cancellation_reason: "Flow test cancel." });
    rec("Cancel flow", "MedTech cancels a pending result", cc.ok, `HTTP ${cc.status}`);
    const ca = await call("POST", `/lab-results/${cid}/approve`, doctor);
    rec("Cancel flow", "Doctor cannot approve a cancelled result", !ca.ok, `HTTP ${ca.status}`);

    // Role checks
    const c2 = await encode("FBS", "Male", (ps) => ({ p: ps[0], kind: "high" }));
    const rid = c2.r.json?.lab_result?.id;
    const mt = await call("POST", `/lab-results/${rid}/approve`, medtech);
    rec("Roles", "MedTech cannot approve", mt.status === 403, `HTTP ${mt.status}`);
    const pend = await call("GET", `/lab-results/${rid}`, doctor);
    const pendingToken = pend.json?.lab_result?.access_token;
    rec("Roles", "pending result has no patient QR token", !pendingToken, pendingToken ? "token exists" : "");
    if (counter) {
      const cv = await call("GET", `/lab-results/${rid}`, counter);
      rec("Roles", "Counter cannot open result values", !(cv.json?.lab_result && "parameters" in cv.json.lab_result), `HTTP ${cv.status}`);
      const cq = await call("POST", `/lab-results/${rid}/qr-token`, counter);
      rec("Roles", "Counter cannot make a QR for a pending result", !cq.ok, `HTTP ${cq.status}`);
    }
    await call("POST", `/lab-results/${rid}/cancel`, medtech, { cancellation_reason: "Flow test cleanup." });

    if (AI) {
      // Hide AI text
      const h = await encode("FBS", "Male", (ps) => ({ p: ps[0], kind: "high" }));
      const hid = h.r.json?.lab_result?.id;
      const pv = await call("POST", `/lab-results/${hid}/recommendation/preview`, doctor);
      if (pv.json?.ai_recommendation) {
        const hh = await call("PUT", `/lab-results/${hid}/recommendation`, doctor, { is_hidden: true });
        rec("Hide AI", "Doctor hides the AI text", hh.ok && hh.json?.ai_recommendation?.is_hidden === true, `HTTP ${hh.status}`);
        const ap3 = await call("POST", `/lab-results/${hid}/approve`, doctor);
        const pv3 = await call("GET", `/lab-results/access/${encodeURIComponent(ap3.json?.lab_result?.access_token)}`);
        rec("Hide AI", "Patient does not see the hidden AI text", pv3.ok && !pv3.json?.lab_result?.ai_recommendation, "");
      } else rec("Hide AI", "AI text for FBS HIGH", false, "no AI text (internet/provider?)");
    }
  }

  if (AI && byCode.LIPID && (!ONLY || ONLY.includes("LIPID"))) {
    // Allergy auto-hide + Bisaya
    const { r } = await encode("LIPID", "Female", (ps) => ({ p: ps.find((p) => p.parameter_name === "Total Cholesterol"), kind: "high" }));
    const id = r.json?.lab_result?.id;
    const pv = await call("POST", `/lab-results/${id}/recommendation/preview`, doctor);
    const ar = pv.json?.ai_recommendation;
    if (!ar) {
      rec("Allergy", "AI text for Total Cholesterol HIGH", false, "no AI text (internet/provider?)");
    } else {
      const hidden = ar.allergy_hidden_lines || [];
      rec("Allergy", "tip mentioning nuts is marked hidden (allergy: peanuts)", hidden.some((l) => /\bnuts?\b/i.test(l)), `${hidden.length} hidden line(s)`);
      const ap = await call("POST", `/lab-results/${id}/approve`, doctor);
      const tok = ap.json?.lab_result?.access_token;
      const p = await call("GET", `/lab-results/access/${encodeURIComponent(tok)}`);
      const life = p.json?.lab_result?.ai_recommendation?.lifestyle;
      const lines = life ? ["food", "routine", "avoid", "notes"].flatMap((k) => life[k] || []) : [];
      rec("Allergy", "Patient does not see the nuts tip", !lines.some((l) => /\bnuts?\b/i.test(l)), `${lines.length} tip line(s) shown`);
      const tr = await call("POST", `/lab-results/access/${encodeURIComponent(tok)}/recommendation/translate`);
      const ceb = tr.json?.recommendation_text_ceb || "";
      rec("Bisaya", "Patient gets a Bisaya translation", tr.ok && ceb.length > 0, `HTTP ${tr.status}, ${ceb.length} chars`);
      const lc = tr.json?.lifestyle_ceb;
      if (life) {
        const same = lc && ["food", "routine", "avoid", "notes"].every((k) => (lc[k] || []).length === (life[k] || []).length);
        rec("Bisaya", "Bisaya tips: same number of lines as the visible English tips", !!same, lc ? "" : "no Bisaya tips");
        const cebLines = lc ? ["food", "routine", "avoid", "notes"].flatMap((k) => lc[k] || []) : [];
        rec("Bisaya", "no Bisaya tip line is empty", cebLines.every((l) => String(l).trim().length > 0), "");
      }
      if (ceb) aiTexts.push({ code: "LIPID (Bisaya)", finding: "Total Cholesterol HIGH", text: ceb });
    }
  }

  const pass = rows.filter((r) => r.status === "PASS").length;
  const fail = rows.filter((r) => r.status === "FAIL");
  console.log(`\nSUMMARY: ${pass} passed, ${fail.length} failed`);
  if (fail.length) { console.log("\nFAILED:"); fail.forEach((f) => console.log(` - ${f.area}: ${f.step} (${f.detail})`)); }

  const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const md = [`# Full flow test ${ts}`, "", `API ${API}, AI ${AI ? "on" : "off"}`, "", `**${pass} passed, ${fail.length} failed**`, "",
    "| Area | Step | Result | Detail |", "|---|---|---|---|",
    ...rows.map((r) => `| ${r.area} | ${r.step} | ${r.status} | ${String(r.detail).replace(/\|/g, "/")} |`), "",
    "## AI texts (for a person to read; the script cannot judge medical accuracy)", "",
    ...aiTexts.map((a) => `### ${a.code}: ${a.finding}\n\n${a.text}\n`), "",
    "Test data stays in the database. Run php artisan lab:reset-data for a clean start."].join("\n");
  const file = `scripts/flow-report-${ts}.md`;
  fs.writeFileSync(file, md);
  console.log(`\nReport saved to ${file}\nTest data stays in the database: run "php artisan lab:reset-data" for a clean start.`);
}

main().catch((e) => { console.error("\nTest stopped:", e.message); process.exit(1); });
