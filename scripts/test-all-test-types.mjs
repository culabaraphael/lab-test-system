#!/usr/bin/env node
/**
 * Tests every test type of the lab system through the real API.
 *
 *  - Creates two dummy patients (fake names, one Male, one Female).
 *  - For every test type: one all-normal result, then one result per
 *    parameter and direction (HIGH / LOW for numeric, ABNORMAL for text),
 *    and checks the flag the system gives.
 *  - Also submits one result with every parameter abnormal at the same time.
 *  - CBC and UA: checks the ML prediction comes back (services 8001/8002).
 *  - With a Doctor login: asks for the AI health information and checks it is
 *    grounded: only KB entries about the flagged parameter may be used, and
 *    findings with no KB entry must give no AI text. The report lists every
 *    AI text so a person can read it (the script cannot judge accuracy).
 *  - Cancels every result it created and tries to delete the dummy patients.
 *
 * Usage (PowerShell, from the project root, backend + start-all running):
 *   $env:MEDTECH_USER="..."; $env:MEDTECH_PASS="..."
 *   $env:COUNTER_USER="..."; $env:COUNTER_PASS="..."    # registers + sends the dummy patients
 *   $env:DOCTOR_USER="..."; $env:DOCTOR_PASS="..."      # optional (AI checks)
 *   node scripts/test-all-test-types.mjs
 *
 * Options:  --ai=none|one|all   (default all: every abnormal case, about 12s
 *           per AI call so it takes several minutes; "one" checks only the
 *           first case per test type; "none" skips AI)
 *           --only=CBC,FBS      (limit to these test type codes)
 *           --keep              (do not cancel/delete test data)
 *
 * Passwords are read from environment variables only. Never hard-code them.
 */
import fs from "node:fs";

const API = (process.env.API_URL || "http://127.0.0.1:8000/api").replace(/\/$/, "");
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const AI_MODE = args.ai || "all";
const ONLY = args.only ? String(args.only).split(",").map((s) => s.trim().toUpperCase()) : null;
const KEEP = !!args.keep;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (n) => Math.round(n * 100) / 100;

async function call(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, ok: res.ok, json };
}

async function login(userVar, passVar, role) {
  const username = process.env[userVar];
  const password = process.env[passVar];
  if (!username || !password) return null;
  const r = await call("POST", "/login", null, { username, password, role });
  if (!r.ok || !r.json?.token) {
    throw new Error(`${role} login failed (HTTP ${r.status}): ${r.json?.message || "no message"}`);
  }
  return r.json.token;
}

const rows = [];
const created = []; // { id, label }
function record(code, scenario, expected, actual, status, note = "") {
  rows.push({ code, scenario, expected, actual, status, note });
  const icon = status === "PASS" ? "PASS" : status === "INFO" ? "info" : "FAIL";
  console.log(`[${icon}] ${code.padEnd(12)} ${scenario.padEnd(46)} expected=${expected} actual=${actual}${note ? "  " + note : ""}`);
}

let KB = [];
try {
  KB = JSON.parse(fs.readFileSync("rag/knowledge_base.json", "utf8"));
} catch {
  console.log("Note: rag/knowledge_base.json not found (run from the project root). Grounding checks are skipped.\n");
}
const norm = (s) => String(s || "").trim().toLowerCase();

// Entries the retrieval is allowed to return for one flagged parameter:
// same test type, lists that parameter, and not the opposite direction.
function coveringEntries(code, paramName, flag) {
  const opposite = flag === "LOW" ? "HIGH" : flag === "HIGH" ? "LOW" : null;
  return KB.filter(
    (e) => e.test_type === code && e.parameters.some((x) => norm(x) === norm(paramName)) && e.flag !== opposite
  );
}

const aiTexts = [];

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

function abnormalText(normal) {
  const n = String(normal || "").toLowerCase();
  if (n.includes("non-reactive")) return "Reactive";
  if (n.includes("negative")) return "Positive";
  if (n.includes("none seen")) return "Present";
  if (n === "clear") return "Cloudy";
  return "Abnormal";
}

// Same normal word written differently, as a MedTech might type it
// ("Non-Reactive" -> "nonreactive", "None Seen" -> "none-seen",
// "Negative" -> "NEGATIVE"). Must still be flagged NORMAL.
function otherSpelling(normal) {
  const n = String(normal || "");
  if (n.includes("-")) return n.replace(/-/g, "").toLowerCase();
  if (n.includes(" ")) return n.replace(/ /g, "-").toLowerCase();
  return n.toUpperCase();
}

// Realistic sample values for free-text fields that have no normal_text rule.
// The Urinalysis ML service needs these in its own formats (e.g. WBC "0-2"),
// so "Normal" as a placeholder would crash it.
const FREE_TEXT_SAMPLES = {
  UA: {
    Color: "Yellow",
    "White Blood Cells": "0-2",
    "Red Blood Cells": "0-2",
    "Epithelial Cells": "Rare",
    "Mucous Threads": "Rare",
    "Amorphous Urates": "None seen",
    Bacteria: "None seen",
  },
};
let currentCode = "";

// Builds the value for one parameter: kind = normal | high | low | abnormal
function valueFor(p, kind) {
  const low = num(p.low_value);
  const high = num(p.high_value);

  if (p.data_type === "numeric") {
    if (kind === "high") return { value_numeric: round((high ?? low) * 1.3 + 1) };
    if (kind === "low") return { value_numeric: round(low > 0 ? low * 0.5 : low - 1) };
    if (low !== null && high !== null) return { value_numeric: round((low + high) / 2) };
    if (high !== null) return { value_numeric: round(high * 0.5) };
    if (low !== null) return { value_numeric: round(low * 1.5 + 1) };
    return { value_numeric: 1 };
  }

  if (kind === "abnormal") return { value_text: abnormalText(p.normal_text) };
  if (kind === "spelling") return { value_text: otherSpelling(p.normal_text) };
  return { value_text: p.normal_text ?? FREE_TEXT_SAMPLES[currentCode]?.[p.parameter_name] ?? "Normal" };
}

function expectedFlag(p, kind) {
  const low = num(p.low_value);
  const high = num(p.high_value);
  const hasRule = p.data_type === "numeric" ? low !== null || high !== null : p.normal_text != null;
  if (!hasRule) return "UNASSESSED";
  if (kind === "high") return "HIGH";
  if (kind === "low") return "LOW";
  if (kind === "abnormal") return "ABNORMAL";
  return "NORMAL";
}

function buildParameters(params, targetId, kind) {
  return params.map((p) => ({
    reference_range_id: p.id,
    parameter_name: p.parameter_name,
    ...valueFor(p, p.id === targetId ? kind : "normal"),
  }));
}

async function submit(medtech, patient, testType, parameters) {
  const r = await call("POST", "/lab-results", medtech, {
    patient_id: patient.id,
    test_type_id: testType.id,
    parameters,
  });
  if (r.ok && r.json?.lab_result?.id) {
    created.push({ id: r.json.lab_result.id, label: `${testType.code} #${r.json.lab_result.id}` });
  }
  return r;
}

let aiUsedFor = new Set();

// flagged = [{ name, flag }] for every abnormal parameter in the submitted result.
async function checkAi(doctor, code, resultId, scenario, flagged, bucket = code) {
  if (!doctor || AI_MODE === "none") return;

  // Which KB entries may legitimately be retrieved for this result.
  const covered = KB.length
    ? [...new Set(flagged.flatMap((f) => coveringEntries(code, f.name, f.flag).map((e) => e.id)))]
    : null;
  const expectNone = covered !== null && covered.length === 0;

  // Findings with no KB entry make no AI call (cheap), so they are always checked.
  if (!expectNone) {
    if (AI_MODE === "one" && aiUsedFor.has(bucket)) return;
    aiUsedFor.add(bucket);
    await sleep(12000); // stay under the AI provider's per-minute token limit
  }

  const r = await call("POST", `/lab-results/${resultId}/recommendation/preview`, doctor);
  const rec = r.json?.ai_recommendation;

  if (!r.ok) {
    record(code, `AI info: ${scenario}`, "response", `HTTP ${r.status}`, "FAIL", r.json?.message || "");
    return;
  }

  if (!rec) {
    if (expectNone) {
      record(code, `AI info: ${scenario}`, "none (no KB entry)", "none", "PASS", "correct: nothing in the KB covers this, so no AI text is made up");
    } else {
      record(code, `AI info: ${scenario}`, "text", "none", "FAIL", "KB covers this but no text came back: AI provider, internet, or embedding service (8003) failed");
    }
    return;
  }

  const keys = rec.retrieved_entry_keys || [];
  const tips = rec.lifestyle ? "tips" : "no tips";

  if (covered === null) {
    record(code, `AI info: ${scenario}`, "text", `text (${tips})`, rec.recommendation_text ? "PASS" : "FAIL", `KB: ${keys.join(",")}`);
  } else if (expectNone) {
    record(code, `AI info: ${scenario}`, "none (no KB entry)", `text from ${keys.join(",")}`, "FAIL", "unrelated KB entries were used");
  } else {
    const stray = keys.filter((k) => !covered.includes(k));
    const ok = rec.recommendation_text && stray.length === 0;
    record(
      code,
      `AI info: ${scenario}`,
      "only entries about the flagged parameter",
      stray.length ? `unrelated: ${stray.join(",")}` : `text (${tips})`,
      ok ? "PASS" : "FAIL",
      `KB: ${keys.join(",")} | model: ${rec.model_used}`
    );
  }

  // The text must not talk about abnormal results that no KB entry covers.
  if (covered !== null && !expectNone && rec.recommendation_text) {
    const text = rec.recommendation_text.toLowerCase();
    const leaks = flagged
      .filter((f) => coveringEntries(code, f.name, f.flag).length === 0)
      .filter((f) => {
        const full = norm(f.name);
        const first = full.split(/[ /]/)[0];
        return text.includes(full) || (first.length >= 6 && text.includes(first));
      })
      .map((f) => f.name);
    if (flagged.some((f) => coveringEntries(code, f.name, f.flag).length === 0)) {
      record(
        code,
        `AI text stays on covered results: ${scenario}`,
        "no mention of uncovered results",
        leaks.length ? `mentions ${leaks.join(", ")}` : "clean",
        leaks.length ? "FAIL" : "PASS"
      );
    }
  }

  aiTexts.push({ code, scenario, keys: keys.join(", "), text: rec.recommendation_text || "", tips: rec.lifestyle ? JSON.stringify(rec.lifestyle.food || []) : "" });
}

async function main() {
  console.log(`API: ${API}  |  AI checks: ${AI_MODE}\n`);

  const medtech = await login("MEDTECH_USER", "MEDTECH_PASS", "Medical Technologist");
  if (!medtech) {
    console.error("Set MEDTECH_USER and MEDTECH_PASS (Medical Technologist) first.");
    process.exit(2);
  }
  const doctor = await login("DOCTOR_USER", "DOCTOR_PASS", "Doctor");
  if (!doctor) console.log("No DOCTOR_USER/DOCTOR_PASS: AI checks skipped.\n");

  // Patients are registered by the Counter/Nurse and sent to the MedTech.
  const counter = await login("COUNTER_USER", "COUNTER_PASS", "COUNTER");
  if (!counter) throw new Error("COUNTER_USER/COUNTER_PASS are required: only the Counter/Nurse can register patients.");

  const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "");
  const patients = {};
  for (const sex of ["Male", "Female"]) {
    const r = await call("POST", "/patients", counter, {
      first_name: `TEST${sex}`,
      last_name: `Dummy${stamp}`,
      date_of_birth: "1990-01-01",
      sex,
    });
    if (!r.ok) throw new Error(`Could not create ${sex} dummy patient (HTTP ${r.status}): ${JSON.stringify(r.json)}`);
    patients[sex] = r.json.patient;
    const sent = await call("POST", `/patients/${r.json.patient.id}/send-to-medtech`, counter);
    if (!sent.ok) throw new Error(`Could not send ${sex} dummy patient to the MedTech (HTTP ${sent.status})`);
  }

  const tt = await call("GET", "/test-types");
  const testTypes = (tt.json?.test_types || []).filter((t) => !ONLY || ONLY.includes(t.code));
  console.log(`Test types found: ${testTypes.map((t) => t.code).join(", ")}\n`);

  for (const testType of testTypes) {
    const code = testType.code;
    currentCode = code;

    // Parameters as the Encode form would load them, per sex.
    const bySex = {};
    for (const sex of ["Male", "Female"]) {
      const r = await call("GET", `/test-types/${testType.id}/parameters?sex=${sex}`);
      bySex[sex] = r.json?.parameters || [];
    }

    if (bySex.Male.length === 0) {
      record(code, "load parameters", ">=1 parameter", "0", "FAIL", "no reference ranges configured");
      continue;
    }

    const sexes = ["Male"];
    const differs = JSON.stringify(bySex.Male.map((p) => [p.id, p.low_value, p.high_value])) !==
      JSON.stringify(bySex.Female.map((p) => [p.id, p.low_value, p.high_value]));
    if (differs) sexes.push("Female");

    for (const sex of sexes) {
      const params = bySex[sex];
      const patient = patients[sex];
      const tag = sexes.length > 1 ? ` (${sex})` : "";

      // 1) all normal
      {
        const r = await submit(medtech, patient, testType, buildParameters(params, null, "normal"));
        if (!r.ok) {
          record(code, `all normal${tag}`, "201", `HTTP ${r.status}`, "FAIL", JSON.stringify(r.json?.errors || r.json?.message || ""));
        } else {
          const got = r.json.lab_result.parameters || [];
          const bad = params.filter((p) => {
            const g = got.find((x) => x.reference_range_id === p.id);
            return !g || g.flag !== expectedFlag(p, "normal");
          });
          if (code === "CBC" || code === "UA") {
            const ml = r.json.lab_result.ml_predicted_diagnosis;
            record(
              code,
              `ML prediction, all normal${tag}`,
              "a diagnosis",
              ml ?? "none",
              ml ? "PASS" : "FAIL",
              ml ? `confidence=${r.json.lab_result.ml_prediction_confidence}` : `ML service (${code === "CBC" ? 8001 : 8002}) not running, or not in the response`
            );
          }
          record(
            code,
            `all normal${tag}`,
            "flags " + [...new Set(params.map((p) => expectedFlag(p, "normal")))].join("/"),
            bad.length ? "mismatch: " + bad.map((p) => p.parameter_name).join(", ") : "match",
            bad.length ? "FAIL" : "PASS"
          );
        }
      }

      // 2) each parameter, each direction
      for (const p of params) {
        const kinds = [];
        if (p.data_type === "numeric") {
          const low = num(p.low_value);
          const high = num(p.high_value);
          if (high !== null) kinds.push("high");
          if (low !== null) kinds.push("low");
        } else if (p.normal_text != null) {
          kinds.push("abnormal");
          kinds.push("spelling");
        } else {
          kinds.push("normal"); // free-text field without a rule: must stay UNASSESSED
        }

        for (const kind of kinds) {
          const want = expectedFlag(p, kind);
          const scenario = `${p.parameter_name} ${kind === "normal" ? "free text" : kind === "spelling" ? "normal, other spelling" : kind}${tag}`;
          const r = await submit(medtech, patient, testType, buildParameters(params, p.id, kind));

          if (!r.ok) {
            record(code, scenario, want, `HTTP ${r.status}`, "FAIL", JSON.stringify(r.json?.errors || r.json?.message || ""));
            continue;
          }

          const g = (r.json.lab_result.parameters || []).find((x) => x.reference_range_id === p.id);
          const flagOk = g && g.flag === want;
          const mlNote = r.json.lab_result.ml_predicted_diagnosis
            ? `ML: ${r.json.lab_result.ml_predicted_diagnosis} (${r.json.lab_result.ml_prediction_confidence})`
            : "";
          record(code, scenario, want, g ? g.flag : "missing", flagOk ? "PASS" : "FAIL", mlNote);

          if (flagOk && ["HIGH", "LOW", "ABNORMAL"].includes(want)) {
            await checkAi(doctor, code, r.json.lab_result.id, scenario, [{ name: p.parameter_name, flag: want }]);
          }
        }
      }

      // 3) every parameter abnormal at the same time
      {
        const kindOf = (p) =>
          p.data_type === "numeric"
            ? num(p.high_value) !== null ? "high" : num(p.low_value) !== null ? "low" : "normal"
            : p.normal_text != null ? "abnormal" : "normal";
        const body = params.map((p) => ({
          reference_range_id: p.id,
          parameter_name: p.parameter_name,
          ...valueFor(p, kindOf(p)),
        }));
        const scenario = `all abnormal at once${tag}`;
        const r = await submit(medtech, patient, testType, body);
        if (!r.ok) {
          record(code, scenario, "201", `HTTP ${r.status}`, "FAIL", JSON.stringify(r.json?.errors || r.json?.message || ""));
        } else {
          const got = r.json.lab_result.parameters || [];
          const bad = params.filter((p) => {
            const g = got.find((x) => x.reference_range_id === p.id);
            return !g || g.flag !== expectedFlag(p, kindOf(p));
          });
          record(code, scenario, "each flag correct", bad.length ? "mismatch: " + bad.map((p) => p.parameter_name).join(", ") : "match", bad.length ? "FAIL" : "PASS");

          const flagged = params
            .map((p) => ({ name: p.parameter_name, flag: expectedFlag(p, kindOf(p)) }))
            .filter((f) => ["HIGH", "LOW", "ABNORMAL"].includes(f.flag));
          if (!bad.length && flagged.length > 1) {
            await checkAi(doctor, code, r.json.lab_result.id, scenario, flagged, `${code}:multi`);
          }
        }
      }
    }
  }

  // Cleanup
  if (!KEEP) {
    let cancelled = 0;
    for (const c of created) {
      const r = await call("POST", `/lab-results/${c.id}/cancel`, medtech, { cancellation_reason: "Automated test data" });
      if (r.ok) cancelled++;
    }
    console.log(`\nCancelled ${cancelled} of ${created.length} test results.`);

    for (const sex of Object.keys(patients)) {
      const r = await call("DELETE", `/patients/${patients[sex].id}`, medtech);
      console.log(`Dummy ${sex} patient ${patients[sex].patient_id}: ${r.ok ? "deleted" : `kept (HTTP ${r.status}), delete it in the Patients page if you want`}`);
    }
  } else {
    console.log(`\n--keep: ${created.length} results and 2 dummy patients left in the database.`);
  }

  // Summary
  const pass = rows.filter((r) => r.status === "PASS").length;
  const fail = rows.filter((r) => r.status === "FAIL").length;
  const info = rows.filter((r) => r.status === "INFO").length;
  console.log(`\nSUMMARY: ${pass} passed, ${fail} failed, ${info} info`);
  if (fail) {
    console.log("\nFAILED:");
    rows.filter((r) => r.status === "FAIL").forEach((r) => console.log(` - ${r.code}: ${r.scenario} (expected ${r.expected}, got ${r.actual}) ${r.note}`));
  }

  const file = `scripts/test-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.md`;
  const md = [
    `# Test report ${new Date().toLocaleString()}`,
    ``,
    `${pass} passed, ${fail} failed, ${info} info`,
    ``,
    `| Test type | Scenario | Expected | Actual | Result | Note |`,
    `|---|---|---|---|---|---|`,
    ...rows.map((r) => `| ${r.code} | ${r.scenario} | ${r.expected} | ${r.actual} | ${r.status} | ${String(r.note).replace(/\|/g, "/")} |`),
    ``,
    `## AI texts to read (the test cannot judge medical accuracy, a person must)`,
    ``,
    ...aiTexts.flatMap((t) => [`### ${t.code}: ${t.scenario}`, `KB entries: ${t.keys}`, ``, t.text, ``, t.tips ? `Food tips: ${t.tips}` : `Food tips: none`, ``]),
  ].join("\n");
  try {
    fs.writeFileSync(file, md);
    console.log(`\nReport saved to ${file}`);
  } catch {
    /* report file is optional */
  }

  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("\nTest run stopped:", e.message);
  process.exit(2);
});
