"""
CBC ML Microservice -- FastAPI

This is the bridge between your Laravel backend (PHP) and the trained
scikit-learn model (Python). Laravel can't call a Python object directly,
so this exposes the model over a simple HTTP endpoint that Laravel calls
with an HTTP request instead.

HOW TO RUN:
    uvicorn api:app --host 127.0.0.1 --port 8001 --reload

Then it's reachable at http://127.0.0.1:8001

ENDPOINTS:
    GET  /health         -- quick check that the service is up and the
                             model loaded correctly
    POST /predict/cbc    -- takes 6 CBC values, returns the predicted
                             diagnosis + confidence for every class

WHY PORT 8001:
    Your Laravel backend usually runs on 8000 (php artisan serve).
    This runs on a different port (8001) so both can run at the same time
    without clashing.
"""

from typing import Dict

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(
    title="Lab Test System - CBC ML Service",
    description="Serves the trained CBC anemia-type classification model.",
)

FEATURE_COLUMNS = ["WBC", "RBC", "HGB", "MCV", "MCH", "PLT"]

# Loaded once at startup, not per-request, so predictions stay fast.
try:
    model = joblib.load("cbc_best_model.joblib")
    scaler = joblib.load("cbc_scaler.joblib")
    label_encoder = joblib.load("cbc_label_encoder.joblib")
    MODEL_LOADED = True
    MODEL_LOAD_ERROR = None
except FileNotFoundError as e:
    model = scaler = label_encoder = None
    MODEL_LOADED = False
    MODEL_LOAD_ERROR = str(e)


class CBCInput(BaseModel):
    """
    Matches the 6 CBC parameters the model was trained on.
    Field names mirror the units your Encode Results form already shows.
    """
    WBC: float = Field(..., description="White Blood Cell Count, x10^9/L")
    RBC: float = Field(..., description="Red Blood Cell Count, x10^12/L")
    HGB: float = Field(..., description="Hemoglobin, g/dL")
    MCV: float = Field(..., description="Mean Corpuscular Volume, fL")
    MCH: float = Field(..., description="Mean Corpuscular Hemoglobin, pg")
    PLT: float = Field(..., description="Platelet Count, x10^9/L")


class CBCPrediction(BaseModel):
    predicted_diagnosis: str
    confidence: float
    class_probabilities: Dict[str, float]
    model_used: str = "Random Forest"


@app.get("/health")
def health():
    return {
        "status": "ok" if MODEL_LOADED else "model_not_loaded",
        "model_loaded": MODEL_LOADED,
        "error": MODEL_LOAD_ERROR,
    }


@app.post("/predict/cbc", response_model=CBCPrediction)
def predict_cbc(payload: CBCInput):
    if not MODEL_LOADED:
        raise HTTPException(
            status_code=503,
            detail=(
                "Model files not found. Run train_cbc.py in this folder "
                "first to generate cbc_best_model.joblib, cbc_scaler.joblib, "
                "and cbc_label_encoder.joblib."
            ),
        )

    row = pd.DataFrame([payload.model_dump()], columns=FEATURE_COLUMNS)
    scaled = scaler.transform(row)

    pred_encoded = model.predict(scaled)[0]
    pred_label = label_encoder.inverse_transform([pred_encoded])[0]

    proba = model.predict_proba(scaled)[0]
    class_probabilities = {
        label: round(float(p), 4)
        for label, p in zip(label_encoder.classes_, proba)
    }
    confidence = round(float(max(proba)), 4)

    return CBCPrediction(
        predicted_diagnosis=pred_label,
        confidence=confidence,
        class_probabilities=class_probabilities,
    )
