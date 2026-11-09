"""
CBC Anemia-Type Prediction -- Manual Testing / Demo Tool

Loads the model trained by train_cbc.py and lets you type in CBC values
to see what diagnosis it predicts. Useful for sanity-checking the model
and for demoing it live during your thesis defense.

HOW TO RUN:
    python predict_cbc.py

Requires cbc_best_model.joblib, cbc_scaler.joblib, and cbc_label_encoder.joblib
to already exist in this folder (created by running train_cbc.py first).
"""

import joblib
import pandas as pd

FEATURE_COLUMNS = ["WBC", "RBC", "HGB", "MCV", "MCH", "PLT"]

FEATURE_INFO = {
    "WBC": "White Blood Cell Count (x10^9/L) -- typical range roughly 4-11",
    "RBC": "Red Blood Cell Count (x10^12/L) -- typical range roughly 4-6",
    "HGB": "Hemoglobin (g/dL) -- typical range roughly 12-17",
    "MCV": "Mean Corpuscular Volume (fL) -- typical range roughly 80-100",
    "MCH": "Mean Corpuscular Hemoglobin (pg) -- typical range roughly 27-33",
    "PLT": "Platelet Count (x10^9/L) -- typical range roughly 150-450",
}

# A couple of ready-made sample cases so you don't have to think up numbers
# on the spot during a demo. These are illustrative values, not sourced
# from a specific verified clinical reference -- use them for demo/sanity
# checking only, not as claimed reference ranges in your thesis.
SAMPLE_CASES = {
    "1": (
        "Roughly normal / healthy-looking values",
        {"WBC": 7.5, "RBC": 5.0, "HGB": 14.5, "MCV": 90.0, "MCH": 30.0, "PLT": 250.0},
    ),
    "2": (
        "Low HGB + low MCV pattern (iron deficiency anemia shape)",
        {"WBC": 6.0, "RBC": 4.2, "HGB": 9.5, "MCV": 70.0, "MCH": 22.0, "PLT": 300.0},
    ),
    "3": (
        "Very high WBC pattern (leukemia shape)",
        {"WBC": 40.0, "RBC": 3.5, "HGB": 9.0, "MCV": 85.0, "MCH": 28.0, "PLT": 100.0},
    ),
    "4": (
        "Low platelet count pattern (thrombocytopenia shape)",
        {"WBC": 7.0, "RBC": 4.8, "HGB": 13.5, "MCV": 88.0, "MCH": 29.0, "PLT": 40.0},
    ),
}


def load_artifacts():
    model = joblib.load("cbc_best_model.joblib")
    scaler = joblib.load("cbc_scaler.joblib")
    label_encoder = joblib.load("cbc_label_encoder.joblib")
    return model, scaler, label_encoder


def predict(model, scaler, label_encoder, values: dict):
    row = pd.DataFrame([values], columns=FEATURE_COLUMNS)
    scaled = scaler.transform(row)
    pred_encoded = model.predict(scaled)[0]
    pred_label = label_encoder.inverse_transform([pred_encoded])[0]

    # Also show class probabilities so you can see how confident the model is
    proba = model.predict_proba(scaled)[0]
    proba_pairs = sorted(
        zip(label_encoder.classes_, proba), key=lambda x: x[1], reverse=True
    )
    return pred_label, proba_pairs


def print_prediction(values, pred_label, proba_pairs):
    print("\nInput values:")
    for col in FEATURE_COLUMNS:
        print(f"  {col:5s} = {values[col]}")
    print(f"\n>>> Predicted diagnosis: {pred_label}")
    print("\nModel confidence (top 3):")
    for label, p in proba_pairs[:3]:
        print(f"  {label:35s} {p*100:5.1f}%")


def manual_entry():
    values = {}
    print("\nEnter CBC values (just the number, no units):")
    for col in FEATURE_COLUMNS:
        while True:
            try:
                raw = input(f"  {col} [{FEATURE_INFO[col]}]: ").strip()
                values[col] = float(raw)
                break
            except ValueError:
                print("    Please enter a valid number.")
    return values


def main():
    print("=" * 70)
    print("CBC Anemia-Type Prediction -- Manual Test Tool")
    print("=" * 70)

    try:
        model, scaler, label_encoder = load_artifacts()
    except FileNotFoundError as e:
        print(f"\nCouldn't find a required file: {e}")
        print("Run 'python train_cbc.py' first to generate the model files.")
        return

    while True:
        print("\nOptions:")
        print("  1-4  = run a ready-made sample case")
        print("  m    = manually enter your own values")
        print("  q    = quit")
        choice = input("\nChoice: ").strip().lower()

        if choice == "q":
            break
        elif choice == "m":
            values = manual_entry()
        elif choice in SAMPLE_CASES:
            desc, values = SAMPLE_CASES[choice]
            print(f"\nRunning sample case {choice}: {desc}")
        else:
            print("Not a valid option, try again.")
            continue

        pred_label, proba_pairs = predict(model, scaler, label_encoder, values)
        print_prediction(values, pred_label, proba_pairs)


if __name__ == "__main__":
    main()
