"""
Urinalysis / UTI Classification -- Model Training & Comparison
Thesis: AI-Powered Laboratory Test Result Detection and Recommendation System

Dataset: "Urinalysis Test Results", collected from a local clinic in
         Northern Mindanao, Philippines (Apr 2020 - Jan 2023), for the
         capstone "Optimizing UTI Diagnosis with Machine Learning and
         Artificial Neural Network for Reducing Misdiagnoses" by
         Agdeppa et al. (2023).
         https://www.kaggle.com/datasets/avarice02/urinalysis-test-results
         License: Open Database License (ODbL) 1.0 -- cite the source
         above if this dataset is used in the thesis (the dataset page
         explicitly asks for this).

HOW TO RUN:
    pip install -r requirements.txt
    python train_urinalysis.py

WHAT THIS SCRIPT DOES:
    1. Load the CSV, drop the 1 row with a missing Color value (honest
       choice: dropping one row out of 1436 is safer than inventing a
       color that wasn't actually observed)
    2. ENCODE mixed-type clinical fields into numbers a model can use.
       This dataset is NOT all-numeric like the CBC one, so every
       encoding choice below is a disclosed modeling decision, not a
       property of the raw data:
         - WBC / RBC are reported as microscopy ranges per high-power
           field (e.g. "0-2", "5-7"), plus ">50", ">100", "LOADED" and
           "TNTC" ("too numerous to count"). Ranges are converted to
           their midpoint. ">N" is converted to N (a conservative
           lower-bound estimate -- the true value could be higher).
           LOADED/TNTC are converted to 120, a value higher than any
           observed numeric range or ">100", since both terms mean
           "too many to count" clinically.
         - Glucose and Protein use the standard urinalysis dipstick
           semi-quantitative scale (Negative < Trace < 1+ < 2+ < 3+ <
           4+) -- this ordering is a real, standard clinical convention,
           not invented here.
         - Epithelial Cells, Mucous Threads, Amorphous Urates, and
           Bacteria use descriptive quantity terms (None seen < Rare <
           Occasional < Few < Moderate < Plenty < Loaded). This
           ordering follows common microscopy quantity-reporting
           convention, but unlike the dipstick scale above, this exact
           ordering is our own methodological choice for this thesis,
           not a cited external standard -- state it as such if asked
           in the defense.
         - Gender, Color, and Transparency have no natural order, so
           they are one-hot encoded instead of ordinal-encoded.
    3. Encode the Diagnosis label (binary: NEGATIVE / POSITIVE)
    4. Stratified 80/20 train/test split
    5. Scale numeric features
    6. Train Logistic Regression, Random Forest, Gradient Boosting,
       all with class_weight='balanced' -- the label is severely
       imbalanced (94.4% Negative vs 5.6% Positive), more skewed than
       CBC's worst class, so macro-averaged metrics matter even more
       here than they did for CBC
    7. Report accuracy + macro precision/recall/F1 + confusion matrix
    8. Save the best model + encoders + scaler for serving
"""

import json
import warnings

import joblib
import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler

warnings.filterwarnings("ignore")

RANDOM_STATE = 42

# ---------------------------------------------------------------------------
# 1. Load and clean
# ---------------------------------------------------------------------------
df = pd.read_csv("urinalysis_tests.csv", index_col=0)
print(f"Loaded {df.shape[0]} rows, {df.shape[1]} columns")

n_before = len(df)
df = df.dropna(subset=["Color"]).reset_index(drop=True)
print(f"Dropped {n_before - len(df)} row(s) with missing Color -> {len(df)} rows remain")

n_dupes = df.duplicated().sum()
print(f"Duplicate rows present: {n_dupes} ({n_dupes/len(df)*100:.1f}%) -- kept as-is, "
      f"plausible given how few distinct values most columns have")

# ---------------------------------------------------------------------------
# 2. Encode fields
# ---------------------------------------------------------------------------
def parse_cell_range(val: str) -> float:
    """Convert a microscopy cell-count field to a single number."""
    val = str(val).strip().upper()
    if val in ("LOADED", "TNTC"):
        return 120.0  # "too numerous to count" -- treated as more severe than ">100"
    if val.startswith(">"):
        return float(val[1:])  # conservative lower-bound estimate
    if "-" in val:
        lo, hi = val.split("-")
        return (float(lo) + float(hi)) / 2
    return float(val)


df["WBC_numeric"] = df["WBC"].apply(parse_cell_range)
df["RBC_numeric"] = df["RBC"].apply(parse_cell_range)

GLUCOSE_ORDER = {"NEGATIVE": 0, "TRACE": 1, "1+": 2, "2+": 3, "3+": 4, "4+": 5}
PROTEIN_ORDER = {"NEGATIVE": 0, "TRACE": 1, "1+": 2, "2+": 3, "3+": 4}
QUANTITY_ORDER = {
    "NONE SEEN": 0, "RARE": 1, "OCCASIONAL": 2, "FEW": 3,
    "MODERATE": 4, "PLENTY": 5, "LOADED": 6,
}

df["Glucose_ord"] = df["Glucose"].str.upper().map(GLUCOSE_ORDER)
df["Protein_ord"] = df["Protein"].str.upper().map(PROTEIN_ORDER)
df["EpithelialCells_ord"] = df["Epithelial Cells"].str.upper().map(QUANTITY_ORDER)
df["MucousThreads_ord"] = df["Mucous Threads"].str.upper().map(QUANTITY_ORDER)
df["AmorphousUrates_ord"] = df["Amorphous Urates"].str.upper().map(QUANTITY_ORDER)
df["Bacteria_ord"] = df["Bacteria"].str.upper().map(QUANTITY_ORDER)

ordinal_cols = [
    "Age", "pH", "Specific Gravity", "WBC_numeric", "RBC_numeric",
    "Glucose_ord", "Protein_ord", "EpithelialCells_ord",
    "MucousThreads_ord", "AmorphousUrates_ord", "Bacteria_ord",
]

nominal_cols = ["Gender", "Color", "Transparency"]
onehot = pd.get_dummies(df[nominal_cols], prefix=nominal_cols)

X = pd.concat([df[ordinal_cols].reset_index(drop=True), onehot.reset_index(drop=True)], axis=1)
FEATURE_COLUMNS = list(X.columns)

label_encoder = LabelEncoder()
y = label_encoder.fit_transform(df["Diagnosis"])
class_names = label_encoder.classes_
print(f"\nClasses: {list(class_names)}")
print("Class distribution:")
print(df["Diagnosis"].value_counts())
print(f"\nFinal feature count: {len(FEATURE_COLUMNS)} (after one-hot encoding)")

# ---------------------------------------------------------------------------
# 3. Train/test split -- stratified because of the severe imbalance
# ---------------------------------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
)
print(f"\nTrain: {X_train.shape[0]} rows | Test: {X_test.shape[0]} rows")

# ---------------------------------------------------------------------------
# 4. Scale (fit on train only)
# ---------------------------------------------------------------------------
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# ---------------------------------------------------------------------------
# 5. Train the three models
# ---------------------------------------------------------------------------
models = {
    "Logistic Regression": LogisticRegression(
        max_iter=2000, class_weight="balanced", random_state=RANDOM_STATE
    ),
    "Random Forest": RandomForestClassifier(
        n_estimators=300, class_weight="balanced", random_state=RANDOM_STATE
    ),
    "Gradient Boosting": GradientBoostingClassifier(
        n_estimators=200, random_state=RANDOM_STATE
    ),
}

results = {}
predictions = {}

for name, model in models.items():
    model.fit(X_train_scaled, y_train)
    y_pred = model.predict(X_test_scaled)
    predictions[name] = y_pred
    results[name] = {
        "accuracy": accuracy_score(y_test, y_pred),
        "precision_macro": precision_score(y_test, y_pred, average="macro", zero_division=0),
        "recall_macro": recall_score(y_test, y_pred, average="macro", zero_division=0),
        "f1_macro": f1_score(y_test, y_pred, average="macro", zero_division=0),
    }

# ---------------------------------------------------------------------------
# 5b. Same three models, but trained on a SMOTE-oversampled training set.
#     SMOTE is applied ONLY to the training split, never to the test set --
#     testing on synthetic data would make the evaluation meaningless.
# ---------------------------------------------------------------------------
smote = SMOTE(random_state=RANDOM_STATE)
X_train_smote, y_train_smote = smote.fit_resample(X_train_scaled, y_train)
print(
    f"\nSMOTE: training set went from {len(y_train)} rows "
    f"({(y_train == 1).sum()} Positive) to {len(y_train_smote)} rows "
    f"({(y_train_smote == 1).sum()} Positive, synthetically balanced)"
)

models_smote = {
    "Logistic Regression (SMOTE)": LogisticRegression(
        max_iter=2000, random_state=RANDOM_STATE
    ),
    "Random Forest (SMOTE)": RandomForestClassifier(
        n_estimators=300, random_state=RANDOM_STATE
    ),
    "Gradient Boosting (SMOTE)": GradientBoostingClassifier(
        n_estimators=200, random_state=RANDOM_STATE
    ),
}

results_smote = {}
predictions_smote = {}

for name, model in models_smote.items():
    model.fit(X_train_smote, y_train_smote)
    y_pred = model.predict(X_test_scaled)  # evaluated on the REAL, untouched test set
    predictions_smote[name] = y_pred
    results_smote[name] = {
        "accuracy": accuracy_score(y_test, y_pred),
        "precision_macro": precision_score(y_test, y_pred, average="macro", zero_division=0),
        "recall_macro": recall_score(y_test, y_pred, average="macro", zero_division=0),
        "f1_macro": f1_score(y_test, y_pred, average="macro", zero_division=0),
    }

# ---------------------------------------------------------------------------
# 6. Report -- baseline vs SMOTE, side by side, on the same real test set
# ---------------------------------------------------------------------------
all_models = {**models, **models_smote}
all_results = {**results, **results_smote}
all_predictions = {**predictions, **predictions_smote}

print("\n" + "=" * 70)
print("MODEL COMPARISON -- baseline (class_weight=balanced) vs SMOTE")
print("(macro-averaged -- Positive is only 5.6% of rows, so plain accuracy")
print("alone would be misleading; all rows evaluated on the same real,")
print("untouched test set)")
print("=" * 70)
results_df = pd.DataFrame(all_results).T.round(4)
print(results_df)

best_model_name = results_df["f1_macro"].idxmax()
print(f"\nBest model by macro F1: {best_model_name}")

print("\n" + "=" * 70)
print(f"DETAILED CLASSIFICATION REPORT -- {best_model_name}")
print("=" * 70)
print(
    classification_report(
        y_test, all_predictions[best_model_name], target_names=class_names, zero_division=0
    )
)

print("=" * 70)
print(f"CONFUSION MATRIX -- {best_model_name}")
print("(rows = actual class, columns = predicted class)")
print("=" * 70)
cm = confusion_matrix(y_test, all_predictions[best_model_name])
cm_df = pd.DataFrame(cm, index=class_names, columns=class_names)
print(cm_df.to_string())

# ---------------------------------------------------------------------------
# 7. Save
# ---------------------------------------------------------------------------
best_model = all_models[best_model_name]
used_smote = best_model_name in models_smote
joblib.dump(best_model, "urinalysis_best_model.joblib")
joblib.dump(scaler, "urinalysis_scaler.joblib")
joblib.dump(label_encoder, "urinalysis_label_encoder.joblib")
joblib.dump(FEATURE_COLUMNS, "urinalysis_feature_columns.joblib")

with open("urinalysis_results_summary.json", "w") as f:
    json.dump(
        {
            "dataset": "Urinalysis Test Results (Northern Mindanao clinic, "
                       "via Agdeppa et al. 2023 capstone, Kaggle, ODbL 1.0)",
            "dataset_url": "https://www.kaggle.com/datasets/avarice02/urinalysis-test-results",
            "n_rows": int(len(df)),
            "feature_columns": FEATURE_COLUMNS,
            "classes": list(class_names),
            "class_counts": df["Diagnosis"].value_counts().to_dict(),
            "train_size": int(X_train.shape[0]),
            "test_size": int(X_test.shape[0]),
            "random_state": RANDOM_STATE,
            "results_baseline_class_weight_balanced": {
                k: {m: round(v, 4) for m, v in d.items()} for k, d in results.items()
            },
            "results_smote": {
                k: {m: round(v, 4) for m, v in d.items()} for k, d in results_smote.items()
            },
            "best_model": best_model_name,
            "best_model_used_smote": used_smote,
        },
        f,
        indent=2,
    )

print(
    "\nSaved: urinalysis_best_model.joblib, urinalysis_scaler.joblib, "
    "urinalysis_label_encoder.joblib, urinalysis_feature_columns.joblib, "
    "urinalysis_results_summary.json"
)
print(f"(best model used SMOTE: {used_smote})")
