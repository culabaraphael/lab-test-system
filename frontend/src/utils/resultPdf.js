// Dependency-free PDF writer for the patient result copy (A4).
//
// Layout (approved prototype, 2026-11-18):
//   Page 1: hospital header with logos, patient information, the result
//           table (grid, black and white; only the HIGH / LOW / NORMAL /
//           ABNORMAL status is coloured) and the signature lines.
//   AI health information: placed under the signatures on page 1 when it
//           fits; otherwise it moves to page 2, which starts with a small
//           header (hospital, patient name, Patient ID, test, release date).
//
// Text is Helvetica (built into every PDF reader), ASCII only, so accented
// letters and curly quotes are simplified for Bisaya and English alike.
// Print and Download PDF use the same file, so both look the same.

import { HOSPITAL_LOGO, PROVINCE_SEAL } from "./resultLogos";

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const BOTTOM = 48; // space kept for the page number line
const CONTENT_W = PAGE_W - MARGIN * 2;

// Helvetica glyph widths (1/1000 em) for ASCII 32..126.
const HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const clean = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/•/g, "-")
    .replace(/\r/g, "")
    .replace(/[^\x20-\x7E\n]/g, "?");

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const widthOf = (s, size, bold = false) => {
  let w = 0;
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    w += c >= 32 && c <= 126 ? HELV[c - 32] : 556;
  }
  return (w * size * (bold ? 1.06 : 1)) / 1000;
};

function wrap(text, size, maxWidth, bold = false) {
  const out = [];

  for (const para of clean(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";

    if (words.length === 0) {
      out.push("");
      continue;
    }

    for (let word of words) {
      // Hard-break very long tokens such as URLs.
      while (widthOf(word, size, bold) > maxWidth) {
        let cut = word.length - 1;
        while (cut > 1 && widthOf(word.slice(0, cut), size, bold) > maxWidth) cut--;
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(word.slice(0, cut));
        word = word.slice(cut);
      }

      const test = line ? `${line} ${word}` : word;

      if (widthOf(test, size, bold) <= maxWidth) {
        line = test;
      } else {
        out.push(line);
        line = word;
      }
    }

    out.push(line);
  }

  return out;
}

const BLACK = [0, 0, 0];
const GRAY = [0.35, 0.35, 0.35];
const LINE = [0.6, 0.6, 0.6];
const HEAD_FILL = [0.95, 0.95, 0.96];

// Status pill colours (background, text), as in the patient portal.
const PILL = {
  HIGH: [[1, 0.89, 0.88], [0.71, 0.14, 0.09]],
  ABNORMAL: [[1, 0.89, 0.88], [0.71, 0.14, 0.09]],
  LOW: [[1, 0.95, 0.88], [0.71, 0.28, 0.03]],
  NORMAL: [[0.91, 0.97, 0.94], [0.01, 0.48, 0.28]],
};

const f = (n) => n.toFixed(1);

class PdfDoc {
  constructor() {
    this.pages = [[]];
    this.page = this.pages[0];
    this.y = MARGIN;
  }

  newPage() {
    this.page = [];
    this.pages.push(this.page);
    this.y = MARGIN;
  }

  // Text whose top edge is at y (PDF coordinates are bottom-up).
  put(str, x, y, size, { bold = false, italic = false, color = BLACK } = {}) {
    const font = bold ? "F2" : italic ? "F3" : "F1";
    const [r, g, b] = color;
    this.page.push(
      `BT /${font} ${size} Tf ${r} ${g} ${b} rg ${f(x)} ${f(PAGE_H - y - size * 0.8)} Td (${esc(clean(str))}) Tj ET`
    );
  }

  center(str, y, size, opts = {}) {
    const w = widthOf(clean(str), size, opts.bold);
    this.put(str, (PAGE_W - w) / 2, y, size, opts);
  }

  line(x1, y1, x2, y2, color = LINE, width = 0.6) {
    const [r, g, b] = color;
    this.page.push(`${width} w ${r} ${g} ${b} RG ${f(x1)} ${f(PAGE_H - y1)} m ${f(x2)} ${f(PAGE_H - y2)} l S`);
  }

  rect(x, y, w, h, { fill = null, stroke = null, width = 0.6 } = {}) {
    const parts = [];
    if (fill) parts.push(`${fill[0]} ${fill[1]} ${fill[2]} rg`);
    if (stroke) parts.push(`${width} w ${stroke[0]} ${stroke[1]} ${stroke[2]} RG`);
    parts.push(`${f(x)} ${f(PAGE_H - y - h)} ${f(w)} ${f(h)} re`);
    parts.push(fill && stroke ? "B" : fill ? "f" : "S");
    this.page.push(parts.join(" "));
  }

  image(name, x, y, w, h) {
    this.page.push(`q ${f(w)} 0 0 ${f(h)} ${f(x)} ${f(PAGE_H - y - h)} cm /${name} Do Q`);
  }

  // Wrapped paragraph from the current y; breaks to a new page if needed.
  para(str, x, width, size, opts = {}) {
    const lead = size * 1.4;
    for (const ln of wrap(str, size, width, opts.bold)) {
      if (this.y + lead > PAGE_H - BOTTOM) this.newPage();
      if (ln) this.put(ln, x, this.y, size, opts);
      this.y += lead;
    }
  }

  serialize(footer) {
    const total = this.pages.length;
    this.pages.forEach((ops, i) => {
      if (total > 1) {
        const label = `Page ${i + 1} of ${total}`;
        ops.push(
          `BT /F1 8 Tf 0.45 0.45 0.45 rg ${f(PAGE_W - MARGIN - widthOf(label, 8))} 26 Td (${label}) Tj ET`
        );
      }
      if (footer) {
        ops.push(`BT /F1 7.5 Tf 0.45 0.45 0.45 rg ${MARGIN} 26 Td (${esc(clean(footer))}) Tj ET`);
      }
    });

    const enc = new TextEncoder();
    const chunks = [];
    let length = 0;
    const offsets = [];
    const push = (part) => {
      const bytes = typeof part === "string" ? enc.encode(part) : part;
      chunks.push(bytes);
      length += bytes.length;
    };

    const images = [
      ["Im1", HOSPITAL_LOGO],
      ["Im2", PROVINCE_SEAL],
    ].map(([name, img]) => ({
      name,
      w: img.w,
      h: img.h,
      bytes: Uint8Array.from(atob(img.data), (c) => c.charCodeAt(0)),
    }));

    // Object ids: 1 catalog, 2 pages, 3-5 fonts, 6-7 images, then page + content pairs.
    const firstPage = 8;
    const kids = this.pages.map((_, i) => `${firstPage + i * 2} 0 R`).join(" ");
    const xobjects = images.map((im, i) => `/${im.name} ${6 + i} 0 R`).join(" ");
    const objects = [];

    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${total} >>`;
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>";
    images.forEach((im, i) => {
      objects[6 + i] = {
        head: `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`,
        bytes: im.bytes,
      };
    });
    this.pages.forEach((ops, i) => {
      const id = firstPage + i * 2;
      const content = ops.join("\n");
      objects[id] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> /XObject << ${xobjects} >> >> /Contents ${id + 1} 0 R >>`;
      objects[id + 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    });

    push("%PDF-1.4\n");
    for (let id = 1; id < objects.length; id++) {
      offsets[id] = length;
      const obj = objects[id];
      if (typeof obj === "string") {
        push(`${id} 0 obj\n${obj}\nendobj\n`);
      } else {
        push(`${id} 0 obj\n${obj.head}`);
        push(obj.bytes);
        push("\nendstream\nendobj\n");
      }
    }

    const xref = length;
    let tail = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id++) {
      tail += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    }
    tail += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    push(tail);

    const out = new Uint8Array(length);
    let pos = 0;
    for (const c of chunks) {
      out.set(c, pos);
      pos += c.length;
    }
    return out;
  }
}

// ----------------------------------------------------------------------------
// Page sections
// ----------------------------------------------------------------------------

function drawHeader(doc) {
  const top = doc.y;
  const logo = 58;
  doc.image("Im1", MARGIN, top, logo, (logo * HOSPITAL_LOGO.h) / HOSPITAL_LOGO.w);
  doc.image("Im2", PAGE_W - MARGIN - logo, top, logo, logo);

  doc.center("Republic of the Philippines", top + 2, 9, { italic: true });
  doc.center("PROVINCE OF AGUSAN DEL SUR", top + 14, 10, { bold: true });
  doc.center("Municipality of Esperanza", top + 27, 9, { italic: true });
  doc.center("ESPERANZA MEDICARE COMMUNITY HOSPITAL", top + 39, 12.5, { bold: true });
  doc.center('"PHIC Accredited Health Care Provider"', top + 54, 7.5, { italic: true });
  doc.center("DEPARTMENT OF LABORATORY", top + 70, 12, { bold: true });
  doc.y = top + 92;
}

function drawInfo(doc, d) {
  const rows = [
    [["Name:", d.patientName, 230], ["Age:", d.age, 70], ["Sex:", d.sex, 0]],
    [["Birthday:", d.birthday, 230], ["Date & Time Encoded:", d.encodedAt, 0]],
    [["Patient ID:", d.patientId, 230], ["Date & Time Released:", d.releasedAt, 0]],
  ];
  const size = 9;

  for (const row of rows) {
    let x = MARGIN;
    row.forEach(([label, value, width], i) => {
      const w = width || PAGE_W - MARGIN - x;
      const lw = widthOf(label, size) + 5;
      doc.put(label, x, doc.y, size);
      doc.put(value || "-", x + lw, doc.y, size, { bold: true });
      doc.line(x + lw - 2, doc.y + 12, x + w - (i < row.length - 1 ? 12 : 0), doc.y + 12);
      x += w;
    });
    doc.y += 17;
  }
  doc.y += 6;
}

const COLS = [
  { key: "name", label: "Parameter", w: 0.38 },
  { key: "value", label: "Result", w: 0.12 },
  { key: "unit", label: "Unit", w: 0.13 },
  { key: "reference", label: "Reference", w: 0.19 },
  { key: "flag", label: "Status", w: 0.18 },
];

function drawResultCard(doc, d) {
  const cardX = MARGIN;
  const cardW = CONTENT_W;
  const pad = 10;
  const top = doc.y;

  doc.put("Laboratory Result", MARGIN, top, 12, { bold: true });
  const cardTop = top + 20;
  doc.y = cardTop + pad;

  doc.put(d.testName, cardX + pad, doc.y, 12, { bold: true });
  doc.put(`Date: ${d.date}`, cardX + pad, doc.y + 15, 8.5, { color: GRAY });

  const badge = "APPROVED";
  const bw = widthOf(badge, 7.5, true) + 18;
  doc.rect(cardX + cardW - pad - bw, doc.y, bw, 15, { stroke: BLACK, width: 0.8 });
  doc.put(badge, cardX + cardW - pad - bw + 9, doc.y + 4, 7.5, { bold: true });
  doc.y += 30;

  const tx = cardX + pad;
  const tw = cardW - pad * 2;
  const xs = [];
  let acc = tx;
  for (const c of COLS) {
    xs.push(acc);
    acc += c.w * tw;
  }
  xs.push(tx + tw);

  const size = 9;
  const lead = size * 1.3;

  // Header row
  const headH = 18;
  doc.rect(tx, doc.y, tw, headH, { fill: HEAD_FILL, stroke: LINE });
  COLS.forEach((c, i) => doc.put(c.label, xs[i] + 5, doc.y + 5, size, { bold: true }));
  xs.slice(1, -1).forEach((x) => doc.line(x, doc.y, x, doc.y + headH));
  doc.y += headH;

  for (const r of d.rows) {
    const cells = COLS.map((c, i) =>
      c.key === "flag" ? [] : wrap(r[c.key] || "-", size, xs[i + 1] - xs[i] - 10, c.key === "value")
    );
    const h = Math.max(16, ...cells.map((l) => l.length * lead + 6));
    const y0 = doc.y;

    cells.forEach((lines, i) => {
      lines.forEach((ln, k) =>
        doc.put(ln, xs[i] + 5, y0 + 4 + k * lead, size, { bold: COLS[i].key === "value" })
      );
    });

    const flag = String(r.flag || "").toUpperCase();
    const pill = PILL[flag];
    if (pill) {
      const pw = widthOf(flag, 7, true) + 12;
      doc.rect(xs[4] + 5, y0 + (h - 11) / 2, pw, 11, { fill: pill[0] });
      doc.put(flag, xs[4] + 11, y0 + (h - 11) / 2 + 2.5, 7, { bold: true, color: pill[1] });
    } else {
      doc.put("-", xs[4] + 5, y0 + 4, size, { color: GRAY });
    }

    doc.rect(tx, y0, tw, h, { stroke: LINE });
    xs.slice(1, -1).forEach((x) => doc.line(x, y0, x, y0 + h));
    doc.y += h;
  }

  doc.y += pad;
  doc.rect(cardX, cardTop, cardW, doc.y - cardTop, { stroke: LINE, width: 0.8 });
  doc.y += 8;
}

function drawSignatures(doc, d) {
  const w = (CONTENT_W - 30) / 2;
  const blocks = [
    ["Examined by:", d.examinedBy ? `${d.examinedBy}` : " ", "Medical Technologist"],
    ["Reviewed and approved by:", d.approvedBy ? `${d.approvedBy}` : " ", "Attending Physician"],
  ];
  const top = doc.y + 6;

  blocks.forEach(([label, name, role], i) => {
    const x = MARGIN + i * (w + 30);
    doc.put(label, x, top, 8.5, { italic: true });
    doc.line(x, top + 34, x + w, top + 34, BLACK, 0.7);
    const nw = widthOf(clean(name), 9, true);
    doc.put(name, x + (w - nw) / 2, top + 38, 9, { bold: true });
    const rw = widthOf(role, 8.5);
    doc.put(role, x + (w - rw) / 2, top + 50, 8.5);
  });

  doc.y = top + 66;
}

function drawMiniHeader(doc, d) {
  doc.put("ESPERANZA MEDICARE COMMUNITY HOSPITAL", MARGIN, doc.y, 10, { bold: true });
  doc.put("Department of Laboratory", MARGIN, doc.y + 13, 8.5);
  doc.y += 28;
  doc.line(MARGIN, doc.y, PAGE_W - MARGIN, doc.y, BLACK, 1.2);
  doc.y += 8;

  const half = CONTENT_W / 2;
  const rows = [
    [["Name:", d.patientName], ["Patient ID:", d.patientId]],
    [["Test:", d.testName], ["Date Released:", d.releasedAt]],
  ];
  for (const row of rows) {
    row.forEach(([label, value], i) => {
      const x = MARGIN + i * half;
      const lw = widthOf(label, 9) + 5;
      doc.put(label, x, doc.y, 9);
      doc.put(value || "-", x + lw, doc.y, 9, { bold: true });
      doc.line(x + lw - 2, doc.y + 12, x + half - 12, doc.y + 12);
    });
    doc.y += 17;
  }
  doc.y += 8;
}

// The AI box is laid out by one function in two modes: measure (draw=false,
// returns the height) and draw. That keeps the fit check exact.
function aiBox(doc, ai, draw) {
  const pad = 12;
  const x = MARGIN + pad;
  const w = CONTENT_W - pad * 2;
  const start = doc.y;
  let y = start + pad;

  const text = (str, size, opts = {}, width = w, x0 = x) => {
    const lead = size * 1.42;
    for (const ln of wrap(str, size, width, opts.bold)) {
      if (draw && ln) doc.put(ln, x0, y, size, opts);
      y += lead;
    }
  };

  if (!ai || !ai.body) {
    text("Health Information", 11, { bold: true });
    y += 2;
    text(
      "No AI health information is included with this result. If you have questions about your result, please consult your doctor.",
      9
    );
  } else {
    text(ai.title, 12, { bold: true });
    y += 3;
    const rv = "Reviewed by the Doctor before release";
    if (draw) {
      doc.rect(x, y, widthOf(rv, 7.5, true) + 14, 13, { stroke: GRAY, width: 0.6 });
      doc.put(rv, x + 7, y + 3, 7.5, { bold: true });
    }
    y += 19;
    text(ai.body, 10);
    if (ai.note) {
      y += 2;
      text(ai.note, 8, { color: GRAY });
    }

    if (ai.tips) {
      const { labels, data, sources, englishOnly } = ai.tips;
      const keys = ["food", "routine", "avoid"].filter((k) => (data?.[k] || []).length > 0);

      if (englishOnly) {
        y += 2;
        text(englishOnly, 8, { color: GRAY });
      }

      if (keys.length > 0) {
        y += 5;
        text(String(labels.title || "Lifestyle tips").toUpperCase(), 8, { bold: true });
        y += 1;

        // Sections side by side, like the prototype.
        const gap = 14;
        const colW = (w - gap * (keys.length - 1)) / keys.length;
        const colTop = y;
        let colBottom = y;

        keys.forEach((k, i) => {
          const cx = x + i * (colW + gap);
          let cy = colTop;
          if (draw) doc.put(String(labels[k]).toUpperCase(), cx, cy, 7.5, { bold: true });
          cy += 12;
          for (const item of data[k]) {
            const lines = wrap(item, 8.5, colW - 10);
            lines.forEach((ln, j) => {
              if (draw) {
                if (j === 0) doc.rect(cx + 1, cy + 3, 2.5, 2.5, { fill: BLACK });
                doc.put(ln, cx + 9, cy, 8.5);
              }
              cy += 8.5 * 1.35;
            });
            cy += 1.5;
          }
          colBottom = Math.max(colBottom, cy);
        });
        y = colBottom + 2;
      }

      for (const note of data?.notes || []) {
        text(note, 8, { color: GRAY });
      }

      if ((sources || []).length > 0) {
        y += 2;
        text(`${labels.source}: ${sources.map((s) => `${s.title} (${s.url})`).join("; ")}`, 7.5, { color: GRAY });
      }
      if (keys.length > 0 && labels.footer) {
        y += 1;
        text(labels.footer, 7.5, { color: GRAY });
      }
    }

    y += 4;
    if (draw) doc.line(x, y, x + w, y, LINE);
    y += 5;
    text(ai.disclaimer, 8);
  }

  y += pad - 4;
  const height = y - start;
  if (draw) {
    doc.rect(MARGIN, start, CONTENT_W, height, { stroke: LINE, width: 0.8 });
    doc.y = y;
  }
  return height;
}

// AI box taller than a whole page (very rare): plain flowing text, no frame.
function aiFlow(doc, ai) {
  doc.para(ai.title, MARGIN, CONTENT_W, 12, { bold: true });
  doc.para("Reviewed by the Doctor before release", MARGIN, CONTENT_W, 8, { bold: true });
  doc.para(ai.body, MARGIN, CONTENT_W, 10);
  if (ai.note) doc.para(ai.note, MARGIN, CONTENT_W, 8, { color: GRAY });
  if (ai.tips) {
    const { labels, data, sources } = ai.tips;
    for (const k of ["food", "routine", "avoid"]) {
      if ((data?.[k] || []).length === 0) continue;
      doc.y += 3;
      doc.para(String(labels[k]).toUpperCase(), MARGIN, CONTENT_W, 8, { bold: true });
      for (const item of data[k]) doc.para(`- ${item}`, MARGIN + 8, CONTENT_W - 8, 9);
    }
    for (const n of data?.notes || []) doc.para(n, MARGIN, CONTENT_W, 8, { color: GRAY });
    if ((sources || []).length > 0) {
      doc.para(`${labels.source}: ${sources.map((s) => `${s.title} (${s.url})`).join("; ")}`, MARGIN, CONTENT_W, 7.5, { color: GRAY });
    }
    if (labels.footer) doc.para(labels.footer, MARGIN, CONTENT_W, 7.5, { color: GRAY });
  }
  doc.y += 4;
  doc.para(ai.disclaimer, MARGIN, CONTENT_W, 8);
}

/**
 * Builds the PDF bytes of a patient result copy.
 * data: { patientName, patientId, birthday, age, sex, encodedAt, releasedAt,
 *         examinedBy, approvedBy, testName, date, rows: [{name, value, unit,
 *         reference, flag}], ai: { title, body, note, disclaimer, tips } | null }
 */
export function buildResultPdf(d) {
  const doc = new PdfDoc();

  drawHeader(doc);
  drawInfo(doc, d);
  drawResultCard(doc, d);
  drawSignatures(doc, d);

  doc.y += 6;
  const needed = aiBox(doc, d.ai, false);
  const pageRoom = PAGE_H - BOTTOM - MARGIN;

  if (doc.y + needed <= PAGE_H - BOTTOM) {
    // Fits under the result on page 1.
    aiBox(doc, d.ai, true);
  } else {
    doc.newPage();
    drawMiniHeader(doc, d);
    if (needed <= pageRoom - (doc.y - MARGIN)) {
      aiBox(doc, d.ai, true);
    } else {
      aiFlow(doc, d.ai);
    }
  }

  return doc.serialize(`Printed copy of a result released by the laboratory. ${new Date().toLocaleString()}`);
}

const fileName = (d) => {
  const safeId = String(d.patientId || "result").replace(/[^A-Za-z0-9_-]/g, "");
  return `Lab-Result-${safeId}-${new Date().toISOString().slice(0, 10)}.pdf`;
};

export function downloadResultPdf(data) {
  const blob = new Blob([buildResultPdf(data)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName(data);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Print: opens the same PDF in a hidden frame and shows the print dialog.
// Phones and browsers that cannot print a PDF frame get the PDF in a new tab,
// where the reader's own print button is used.
export function printResultPdf(data) {
  const blob = new Blob([buildResultPdf(data)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }

  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      window.open(url, "_blank");
    }
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60000);
  };
  document.body.appendChild(frame);
}
