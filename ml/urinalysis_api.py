"""
Urinalysis ML Microservice -- FastAPI

Same pattern as the CBC service (ml/api.py): bridges the Laravel backend
(PHP) to the trained scikit-learn model (Python) over HTTP, since Laravel
can't call a Python object directly.

Runs on a DIFFERENT port from the CBC service (8001) so both can run at
the same time:

    uvicorn urinalysis_api:app --host 127.0.0.1 --port 8002

ENDPOINTS:
    GET  /health                -- confirms the service is up and the
                                    model loaded
    POST /predict/urinalysis    -- takes raw urinalysis field values,
                                    returns predicted UTI diagnosis
                                    (NEGATIVE / POSITIVE) + confidence

IMPORTANT LIMITATION (disclose this in the thesis):
    The training data was severely imbalanced (94.4% Negative vs 5.6%
    Positive). Even after SMOTE oversampling on the training set, the
    best model only reaches ~44% recall on POSITIVE cases (see
    urinalysis_results_summary.json). This means the model will miss a
    meaningful share of true UTI cases -- it is a supplementary signal
    for the Doctor, not a diagnostic replacement.
"""

from typing import Dict

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(
    title="Lab Test System - Urinalysis ML Service",
    description="Serves the trained Urinalysis/UTI classification model.",
)

# Same ordinal encodings used at training time (train_urinalysis.py) --
# kept here in sync so a request is encoded exactly like the training
# rows were.
GLUCOSE_ORDER = {"NEGATIVE": 0, "TRACE": 1, "1+": 2, "2+": 3, "3+": 4, "4+": 5}
PROTEIN_ORDER = {"NEGATIVE": 0, "TRACE": 1, "1+": 2, "2+": 3, "3+": 4}
QUANTITY_ORDER = {
    "NONE SEEN": 0, "RARE": 1, "OCCASIONAL": 2, "FEW": 3,
    "MODERATE": 4, "PLENTY": 5, "LOADED": 6,
}


def parse_cell_range(val: str) -> float:
    """Convert a WBC/RBC microscopy field (e.g. '0-2', '>50', 'LOADED',
    'TNTC') to a single number, identically to train_urinalysis.py."""
    val = str(val).strip().upper()
    if val in ("LOADED", "TNTC"):
        return 120.0
    if val.startswith(">"):
        return float(val[1:])
    if "-" in val:
        lo, hi = val.split("-")
        return (float(lo) + float(hi)) / 2
    return float(val)


# Loaded once at startup, not per-request.
try:
    model = joblib.load("urinalysis_best_model.joblib")
    scaler = joblib.load("urinalysis_scaler.joblib")
    label_encoder = joblib.load("urinalysis_label_encoder.joblib")
    feature_columns = joblib.load("urinalysis_feature_columns.joblib")
    MODEL_LOADED = True
    MODEL_LOAD_ERROR = None
except FileNotFoundError as e:
    model = scaler = label_encoder = feature_columns = None
    MODEL_LOADED = False
    MODEL_LOAD_ERROR = str(e)


class UrinalysisInput(BaseModel):
    Age: float = Field(..., description="Patient age in years (e.g. 0.08 for an 8-month-old, matching the dataset's convention)")
    Gender: str = Field(..., description="MALE or FEMALE")
    Color: str = Field(..., description="e.g. YELLOW, LIGHT YELLOW, DARK YELLOW, STRAW, AMBER, BROWN, RED")
    Transparency: str = Field(..., description="CLEAR, SLIGHTLY HAZY, HAZY, CLOUDY, or TURBID")
    Glucose: str = Field(..., description="NEGATIVE, TRACE, 1+, 2+, 3+, or 4+")
    Protein: str = Field(..., description="NEGATIVE, TRACE, 1+, 2+, or 3+")
    pH: float
    specific_gravity: float = Field(..., alias="Specific Gravity")
    WBC: str = Field(..., description="e.g. '0-2', '5-7', '>50', 'LOADED'")
    RBC: str = Field(..., description="e.g. '0-2', '5-7', '>50', 'LOADED'")
    epithelial_cells: str = Field(..., alias="Epithelial Cells", description="NONE SEEN, RARE, OCCASIONAL, FEW, MODERATE, or PLENTY")
    mucous_threads: str = Field(..., alias="Mucous Threads", description="NONE SEEN, RARE, OCCASIONAL, FEW, MODERATE, or PLENTY")
    amorphous_urates: str = Field(..., alias="Amorphous Urates", description="NONE SEEN, RARE, OCCASIONAL, FEW, MODERATE, or PLENTY")
    Bacteria: str = Field(..., description="RARE, OCCASIONAL, FEW, MODERATE, PLENTY, or LOADED")

    class Config:
        populate_by_name = True


class UrinalysisPrediction(BaseModel):
    predicted_diagnosis: str
    confidence: float
    class_probabilities: Dict[str, float]
    model_used: str = "Random Forest (SMOTE)"


@app.get("/health")
def health():
    return {
        "status": "ok" if MODEL_LOADED else "model_not_loaded",
        "model_loaded": MODEL_LOADED,
        "error": MODEL_LOAD_ERROR,
    }


@app.post("/predict/urinalysis", response_model=UrinalysisPrediction)
def predict_urinalysis(payload: UrinalysisInput):
    if not MODEL_LOADED:
        raise HTTPException(
            status_code=503,
            detail=(
                "Model files not found. Run train_urinalysis.py in this "
                "folder first to generate urinalysis_best_model.joblib, "
                "urinalysis_scaler.joblib, urinalysis_label_encoder.joblib, "
                "and urinalysis_feature_columns.joblib."
            ),
        )

    row = {
        "Age": payload.Age,
        "pH": payload.pH,
        "Specific Gravity": payload.specific_gravity,
        "WBC_numeric": parse_cell_range(payload.WBC),
        "RBC_numeric": parse_cell_range(payload.RBC),
        "Glucose_ord": GLUCOSE_ORDER.get(payload.Glucose.strip().upper(), 0),
        "Protein_ord": PROTEIN_ORDER.get(payload.Protein.strip().upper(), 0),
        "EpithelialCells_ord": QUANTITY_ORDER.get(payload.epithelial_cells.strip().upper(), 0),
        "MucousThreads_ord": QUANTITY_ORDER.get(payload.mucous_threads.strip().upper(), 0),
        "AmorphousUrates_ord": QUANTITY_ORDER.get(payload.amorphous_urates.strip().upper(), 0),
        "Bacteria_ord": QUANTITY_ORDER.get(payload.Bacteria.strip().upper(), 0),
    }

    # One-hot columns: set the matching dummy to 1, everything else stays 0.
    # NOTE (disclosed limitation): a Gender/Color/Transparency value that
    # never appeared in training has no matching dummy column, so it
    # silently falls back to "all zeros" for that group rather than
    # erroring. This mirrors how one-hot encoding was done at training
    # time and should be named as a known edge case, same as the CBC
    # reference-range sex fallback.
    gender_key = f"Gender_{payload.Gender.strip().upper()}"
    color_key = f"Color_{payload.Color.strip().upper()}"
    transparency_key = f"Transparency_{payload.Transparency.strip().upper()}"

    for col in feature_columns:
        if col.startswith("Gender_"):
            row[col] = 1 if col == gender_key else 0
        elif col.startswith("Color_"):
            row[col] = 1 if col == color_key else 0
        elif col.startswith("Transparency_"):
            row[col] = 1 if col == transparency_key else 0

    row_df = pd.DataFrame([row], columns=feature_columns).fillna(0)
    scaled = scaler.transform(row_df)

    pred_encoded = model.predict(scaled)[0]
    pred_label = label_encoder.inverse_transform([pred_encoded])[0]

    proba = model.predict_proba(scaled)[0]
    class_probabilities = {
        label: round(float(p), 4)
        for label, p in zip(label_encoder.classes_, proba)
    }
    confidence = round(float(max(proba)), 4)

    return UrinalysisPrediction(
        predicted_diagnosis=pred_label,
        confidence=confidence,
        class_probabilities=class_probabilities,
    )
