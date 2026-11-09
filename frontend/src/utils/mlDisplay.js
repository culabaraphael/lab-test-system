// Display helpers for the ML model suggestion shown to MedTech and Doctor.

// Below this confidence the UI adds a caution line. 0.60 is a display choice
// made for the thesis prototype, not a validated clinical threshold.
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

// The urinalysis model is a binary UTI classifier (NEGATIVE / POSITIVE,
// see ml/train_urinalysis.py). The raw label alone is unclear, so spell it out.
export const formatMlDiagnosis = (diagnosis) => {
  if (!diagnosis) return diagnosis;

  const value = String(diagnosis).trim().toUpperCase();

  if (value === "POSITIVE") return "UTI screening: POSITIVE";
  if (value === "NEGATIVE") return "UTI screening: NEGATIVE";

  return diagnosis;
};

export const isLowConfidence = (confidence) =>
  typeof confidence === "number" && confidence < LOW_CONFIDENCE_THRESHOLD;

export const LOW_CONFIDENCE_NOTE =
  "Low confidence: treat this suggestion with extra caution.";
