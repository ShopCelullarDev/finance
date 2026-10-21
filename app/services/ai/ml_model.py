import os
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.preprocessing import StandardScaler

from app.services.ai.feature_store import QuantitativeFeatureStore


class SignalClassifierML:
    """
    Clasificador Supervisado de Señales Cuantitativas basado en LightGBM.
    Implementa:
    1. Featurization estricta sin data leakage (StandardScaler ajustado solo sobre Train).
    2. Split cronológico secuencial (Walk-Forward).
    3. Comparación contra baselines (Naive Majority Class y Logistic Regression).
    4. Evaluación rigurosa (F1-Score macro, Balanced Accuracy, Confusion Matrix).
    5. Cálculo de Feature Importances (Gain) y persistencia del modelo.
    """

    MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
    MODEL_PATH = os.path.join(MODEL_DIR, "lightgbm_signal_model.joblib")
    SCALER_PATH = os.path.join(MODEL_DIR, "feature_scaler.joblib")

    # Mapeo de clases
    CLASS_NAMES = {0: "SELL", 1: "BUY", 2: "NEUTRAL"}

    def __init__(self):
        self.feature_columns = QuantitativeFeatureStore.FEATURE_COLUMNS
        self.scaler: Optional[StandardScaler] = None
        self.model: Optional[LGBMClassifier] = None
        self.is_trained: bool = False
        self.training_metadata: Dict[str, Any] = {}

    def prepare_train_val_test_split(
        self,
        df: pd.DataFrame,
        train_ratio: float = 0.70,
        val_ratio: float = 0.15,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Realiza una partición estrictamente cronológica (Walk-Forward)
        para garantizar que los datos pasados nunca conozcan el futuro.
        """
        n = len(df)
        train_end = int(n * train_ratio)
        val_end = int(n * (train_ratio + val_ratio))

        train_df = df.iloc[:train_end]
        val_df = df.iloc[train_end:val_end]
        test_df = df.iloc[val_end:]

        X_train_raw = train_df[self.feature_columns].values
        y_train = train_df["target_label"].values

        X_val_raw = val_df[self.feature_columns].values
        y_val = val_df["target_label"].values

        X_test_raw = test_df[self.feature_columns].values
        y_test = test_df["target_label"].values

        # Strict Featurization: Ajustar scaler ÚNICAMENTE con los datos de entrenamiento
        self.scaler = StandardScaler()
        X_train = self.scaler.fit_transform(X_train_raw)
        X_val = self.scaler.transform(X_val_raw)
        X_test = self.scaler.transform(X_test_raw)

        return X_train, y_train, X_val, y_val, X_test, y_test

    def train_and_evaluate(
        self,
        df_labeled: pd.DataFrame,
    ) -> Dict[str, Any]:
        """Entrena los baselines y el modelo LightGBM con evaluación exhaustiva."""
        if len(df_labeled) < 100:
            raise ValueError("El dataset etiquetado debe tener al menos 100 muestras para entrenar.")

        X_train, y_train, X_val, y_val, X_test, y_test = self.prepare_train_val_test_split(df_labeled)

        # ---------------------------------------------------------------------
        # 1. BASELINE 1: Naive Majority Class Predictor
        # ---------------------------------------------------------------------
        majority_class = int(pd.Series(y_train).mode()[0])
        y_test_naive = np.full_like(y_test, fill_value=majority_class)
        naive_acc = accuracy_score(y_test, y_test_naive)
        naive_f1 = f1_score(y_test, y_test_naive, average="macro", zero_division=0)

        # ---------------------------------------------------------------------
        # 2. BASELINE 2: Logistic Regression
        # ---------------------------------------------------------------------
        log_reg = LogisticRegression(max_iter=500, class_weight="balanced", random_state=42)
        log_reg.fit(X_train, y_train)
        y_test_log = log_reg.predict(X_test)
        log_acc = accuracy_score(y_test, y_test_log)
        log_f1 = f1_score(y_test, y_test_log, average="macro", zero_division=0)

        # ---------------------------------------------------------------------
        # 3. MODELO PRINCIPAL: LightGBM Multi-Class Classifier
        # ---------------------------------------------------------------------
        self.model = LGBMClassifier(
            objective="multiclass",
            num_class=3,
            n_estimators=100,
            learning_rate=0.03,
            max_depth=3,
            num_leaves=7,
            min_child_samples=40,
            subsample=0.80,
            colsample_bytree=0.80,
            reg_alpha=0.3,
            reg_lambda=1.5,
            random_state=42,
            verbosity=-1,
        )

        self.model.fit(
            X_train,
            y_train,
            eval_set=[(X_val, y_val)],
            eval_metric="multi_logloss",
        )
        self.is_trained = True

        # Predicciones sobre Test set
        y_pred = self.model.predict(X_test)
        y_prob = self.model.predict_proba(X_test)

        test_acc = accuracy_score(y_test, y_pred)
        test_bal_acc = balanced_accuracy_score(y_test, y_pred)
        test_f1_macro = f1_score(y_test, y_pred, average="macro", zero_division=0)
        test_f1_weighted = f1_score(y_test, y_pred, average="weighted", zero_division=0)
        conf_matrix = confusion_matrix(y_test, y_pred).tolist()

        # Importancia de características (Feature Importance por Ganancia)
        importances = self.model.booster_.feature_importance(importance_type="gain")
        tot_imp = sum(importances) or 1.0
        feature_importance_dict = {
            col: round(float(imp / tot_imp) * 100.0, 2)
            for col, imp in zip(self.feature_columns, importances)
        }
        # Ordenar de mayor a menor importancia
        sorted_importance = dict(
            sorted(feature_importance_dict.items(), key=lambda x: x[1], reverse=True)
        )

        results = {
            "samples": {
                "total": len(df_labeled),
                "train": len(X_train),
                "val": len(X_val),
                "test": len(X_test),
            },
            "baselines": {
                "naive_majority": {
                    "class": self.CLASS_NAMES.get(majority_class, str(majority_class)),
                    "accuracy": round(float(naive_acc) * 100.0, 2),
                    "macro_f1": round(float(naive_f1), 3),
                },
                "logistic_regression": {
                    "accuracy": round(float(log_acc) * 100.0, 2),
                    "macro_f1": round(float(log_f1), 3),
                },
            },
            "lightgbm_metrics": {
                "accuracy": round(float(test_acc) * 100.0, 2),
                "balanced_accuracy": round(float(test_bal_acc) * 100.0, 2),
                "macro_f1": round(float(test_f1_macro), 3),
                "weighted_f1": round(float(test_f1_weighted), 3),
                "confusion_matrix": conf_matrix,
                "class_labels": ["SELL (0)", "BUY (1)", "NEUTRAL (2)"],
            },
            "feature_importances_gain_pct": sorted_importance,
        }

        self.training_metadata = results
        self.save_model_artifacts()
        return results

    def save_model_artifacts(self) -> None:
        """Persiste los artefactos del modelo y el scaler en disco."""
        os.makedirs(self.MODEL_DIR, exist_ok=True)
        if self.model and self.scaler:
            joblib.dump(self.model, self.MODEL_PATH)
            joblib.dump(self.scaler, self.SCALER_PATH)

    def load_model_artifacts(self) -> bool:
        """Carga los artefactos del modelo si existen en disco."""
        if os.path.exists(self.MODEL_PATH) and os.path.exists(self.SCALER_PATH):
            self.model = joblib.load(self.MODEL_PATH)
            self.scaler = joblib.load(self.SCALER_PATH)
            self.is_trained = True
            return True
        return False

    def predict_signal(self, feature_vector: Dict[str, float]) -> Dict[str, Any]:
        """
        Inferencia en tiempo real: clasifica el vector de características actual y
        retorna probabilidades calibradas para BUY, SELL y NEUTRAL.
        """
        if not self.is_trained:
            if not self.load_model_artifacts():
                raise RuntimeError("El modelo LightGBM aún no ha sido entrenado ni persistido.")

        vec = [feature_vector.get(col, 0.0) for col in self.feature_columns]
        X = np.array([vec])
        X_scaled = self.scaler.transform(X)

        probs = self.model.predict_proba(X_scaled)[0]
        p_sell = float(probs[0])
        p_buy = float(probs[1])
        p_neutral = float(probs[2])

        pred_class = int(np.argmax(probs))
        action = self.CLASS_NAMES.get(pred_class, "NEUTRAL")

        # Confianza calibrada a partir del margen de probabilidad
        confidence = float(np.max(probs) * 100.0)

        return {
            "ml_action": action,
            "confidence_score": round(confidence, 2),
            "probabilities": {
                "p_buy": round(p_buy, 4),
                "p_sell": round(p_sell, 4),
                "p_neutral": round(p_neutral, 4),
            },
            "top_features": sorted(
                feature_vector.items(),
                key=lambda x: abs(x[1]),
                reverse=True
            )[:5],
        }


# Instancia singleton del clasificador de ML
ml_classifier = SignalClassifierML()
