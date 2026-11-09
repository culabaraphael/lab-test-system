"""
CBC Anemia-Type Classification -- Model Training & Comparison
Thesis: AI-Powered Laboratory Test Result Detection and Recommendation System

Dataset: Anemia Types Classification (Ehab Aboelnaga, Kaggle, Apache 2.0)
         https://www.kaggle.com/datasets/ehababoelnaga/anemia-types-classification

HOW TO RUN THIS:
    pip install -r requirements.txt
    python train_cbc.py

WHAT THIS SCRIPT DOES, STEP BY STEP:
    1. Load the CSV and confirm nothing is broken (nulls, dtypes)
    2. DATA QUALITY CHECK -- scan every feature column for a value that
       repeats suspiciously often across rows. A single value repeating in
       more than ~10% of rows is the signature of mean-imputation: the
       original data was missing, and whoever built the dataset filled the
       gap with the column average instead of a real measurement. Columns
       that fail this check get dropped before training, because a model
       "learning" from a constant isn't learning anything real.
    3. Encode the text label (Diagnosis) into numbers the models can use
    4. Split into train/test sets, STRATIFIED so rare classes (as few as
       11 rows) still appear in both sets
    5. Scale features (Logistic Regression needs this; tree models don't)
    6. Train 3 models: Logistic Regression, Random Forest, Gradient Boosting
    7. Evaluate all 3 with accuracy, macro precision/recall/F1, and a
       confusion matrix -- macro averaging matters here because the classes
       are imbalanced (336 "Healthy" rows vs 11 "Leukemia with
       thrombocytopenia" rows), so plain accuracy alone would be misleading
    8. Save the best model + label encoder + scaler to disk for later reuse
"""

import json
import warnings

import joblib
import pandas as pd
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

RANDOM_STATE = 42  # fixed seed so results are reproducible for your defense
IMPUTATION_THRESHOLD = 0.10  # a value repeating in >10% of rows is suspicious

# ---------------------------------------------------------------------------
# 1. Load and sanity-check the data
# ---------------------------------------------------------------------------
df = pd.read_csv("diagnosed_cbc_data_v4.csv")
print(f"Loaded {df.shape[0]} rows, {df.shape[1]} columns")
print(f"Missing values: {df.isnull().sum().sum()}")

ALL_FEATURE_COLUMNS = [
    "WBC", "LYMp", "NEUTp", "LYMn", "NEUTn",
    "RBC", "HGB", "HCT", "MCV", "MCH", "MCHC",
    "PLT", "PDW", "PCT",
]
LABEL_COLUMN = "Diagnosis"

# ---------------------------------------------------------------------------
# 2. Data quality check -- detect mean-imputed / fabricated columns
# ---------------------------------------------------------------------------
print("\n" + "=" * 70)
print("DATA QUALITY CHECK -- scanning for imputation artifacts")
print("=" * 70)

clean_columns = []
dropped_columns = []

for col in ALL_FEATURE_COLUMNS:
    vc = df[col].value_counts()
    top_value, top_count = vc.index[0], vc.iloc[0]
    top_pct = top_count / len(df)
    status = "OK"
    if top_pct > IMPUTATION_THRESHOLD:
        status = "DROPPED (likely imputed / not a real measurement)"
        dropped_columns.append(col)
    else:
        clean_columns.append(col)
    print(
        f"  {col:6s}: most common value {top_value!s:>15s} "
        f"appears {top_count:4d}/{len(df)} times ({top_pct*100:5.1f}%)  -> {status}"
    )

print(f"\nKeeping {len(clean_columns)} reliable features: {clean_columns}")
if dropped_columns:
    print(f"Dropping {len(dropped_columns)} unreliable features: {dropped_columns}")
    print(
        "NOTE: this means Hematocrit (HCT) may be among the dropped columns "
        "even though it's one of your project's 5 core CBC fields -- this "
        "dataset's HCT values are mostly a repeated placeholder, not real "
        "measurements. State this as a known limitation in your thesis."
    )

FEATURE_COLUMNS = clean_columns
X = df[FEATURE_COLUMNS].copy()
y_raw = df[LABEL_COLUMN].copy()

# ---------------------------------------------------------------------------
# 3. Encode the label
# ---------------------------------------------------------------------------
label_encoder = LabelEncoder()
y = label_encoder.fit_transform(y_raw)
class_names = label_encoder.classes_
print(f"\nClasses ({len(class_names)}): {list(class_names)}")
print("\nClass distribution (note the imbalance -- flag this as a limitation too):")
print(y_raw.value_counts())

# ---------------------------------------------------------------------------
# 4. Train/test split -- stratified so every class is represented
#    proportionally in both sets, even the 11-row class
# ---------------------------------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
)
print(f"\nTrain: {X_train.shape[0]} rows | Test: {X_test.shape[0]} rows")

# ---------------------------------------------------------------------------
# 5. Scale features (fit ONLY on train, then apply to test -- avoids leakage)
# ---------------------------------------------------------------------------
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# ---------------------------------------------------------------------------
# 6. Train the three models
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
# 7. Report results
# ---------------------------------------------------------------------------
print("\n" + "=" * 70)
print("MODEL COMPARISON (macro-averaged, treats every class equally)")
print("=" * 70)
results_df = pd.DataFrame(results).T.round(4)
print(results_df)

best_model_name = results_df["f1_macro"].idxmax()
print(f"\nBest model by macro F1: {best_model_name}")

print("\n" + "=" * 70)
print(f"DETAILED CLASSIFICATION REPORT -- {best_model_name}")
print("=" * 70)
print(
    classification_report(
        y_test, predictions[best_model_name], target_names=class_names, zero_division=0
    )
)

print("=" * 70)
print(f"CONFUSION MATRIX -- {best_model_name}")
print("(rows = actual class, columns = predicted class)")
print("=" * 70)
cm = confusion_matrix(y_test, predictions[best_model_name])
cm_df = pd.DataFrame(cm, index=class_names, columns=class_names)
print(cm_df.to_string())

# ---------------------------------------------------------------------------
# 8. Save everything needed to reuse the best model later
# ---------------------------------------------------------------------------
best_model = models[best_model_name]
joblib.dump(best_model, "cbc_best_model.joblib")
joblib.dump(scaler, "cbc_scaler.joblib")
joblib.dump(label_encoder, "cbc_label_encoder.joblib")

with open("cbc_results_summary.json", "w") as f:
    json.dump(
        {
            "dataset": "Anemia Types Classification (Ehab Aboelnaga, Kaggle, Apache 2.0)",
            "dataset_url": "https://www.kaggle.com/datasets/ehababoelnaga/anemia-types-classification",
            "n_rows": int(df.shape[0]),
            "features_used": FEATURE_COLUMNS,
            "features_dropped_as_unreliable": dropped_columns,
            "classes": list(class_names),
            "class_counts": y_raw.value_counts().to_dict(),
            "train_size": int(X_train.shape[0]),
            "test_size": int(X_test.shape[0]),
            "random_state": RANDOM_STATE,
            "results": {k: {m: round(v, 4) for m, v in d.items()} for k, d in results.items()},
            "best_model": best_model_name,
        },
        f,
        indent=2,
    )

print(
    "\nSaved: cbc_best_model.joblib, cbc_scaler.joblib, "
    "cbc_label_encoder.joblib, cbc_results_summary.json"
)
