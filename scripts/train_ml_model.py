import asyncio
import json
import time

from app.services.ai.feature_store import QuantitativeFeatureStore
from app.services.ai.ml_model import ml_classifier


async def run_training():
    print("=" * 75)
    print("FASE C: PIPELINE DE MACHINE LEARNING SUPERVISADO (LIGHTGBM + TRIPLE BARRIER)")
    print("=" * 75)

    start_time = time.time()
    feature_store = QuantitativeFeatureStore(asset_symbol="BTC/USDT")

    # 1. Extracción de datos históricos desde TimescaleDB
    print("\n[PASO 1] Extrayendo ticks históricos y noticias desde TimescaleDB...")
    df_raw, news_events = await feature_store.fetch_historical_dataset(max_ticks=25000)
    print(f"[+] Ticks cargados: {len(df_raw)} filas | Noticias: {len(news_events)} eventos.")
    print(f"    Rango temporal: {df_raw['time'].iloc[0]}  --->  {df_raw['time'].iloc[-1]}")
    print(f"    Precio inicial: ${df_raw['price'].iloc[0]:,.2f} | Precio final: ${df_raw['price'].iloc[-1]:,.2f}")

    # 2. Ingeniería de Características (Feature Store)
    print("\n[PASO 2] Computando matriz multivariable de características (sin data leakage)...")
    df_features = feature_store.extract_features(df_raw, news_events)
    print(f"[+] Matriz de features calculada: {len(df_features)} observaciones x {len(feature_store.FEATURE_COLUMNS)} variables.")
    print(f"    Variables: {', '.join(feature_store.FEATURE_COLUMNS)}")

    # 3. Etiquetado Triple Barrier (Marcos López de Prado)
    print("\n[PASO 3] Aplicando Triple Barrier Method (Take Profit, Stop Loss, Time Limit)...")
    df_labeled = feature_store.apply_triple_barrier_labeling(
        df_features=df_features,
        full_df=df_raw,
        k_tp=1.2,
        k_sl=1.0,
        max_holding_ticks=100,
    )

    label_counts = df_labeled["target_label"].value_counts().to_dict()
    barrier_counts = df_labeled["barrier_touched"].value_counts().to_dict()
    print(f"[+] Distribución de Clases:")
    print(f"    - BUY  (1) [Hit TP]: {label_counts.get(1, 0)} ({label_counts.get(1, 0) / len(df_labeled) * 100:.1f}%)")
    print(f"    - SELL (0) [Hit SL]: {label_counts.get(0, 0)} ({label_counts.get(0, 0) / len(df_labeled) * 100:.1f}%)")
    print(f"    - NEUTRAL (2) [Time]: {label_counts.get(2, 0)} ({label_counts.get(2, 0) / len(df_labeled) * 100:.1f}%)")
    print(f"[+] Barreras tocadas: {barrier_counts}")

    # 4. Entrenamiento y Validación Cronológica (Walk-Forward)
    print("\n[PASO 4] Entrenando Baselines y Modelo LightGBM con Walk-Forward Validation...")
    results = ml_classifier.train_and_evaluate(df_labeled)

    samples = results["samples"]
    print(f"[+] Partición cronológica completada:")
    print(f"    - Train: {samples['train']} muestras (70%)")
    print(f"    - Validation: {samples['val']} muestras (15%)")
    print(f"    - Test: {samples['test']} muestras (15%)")

    # 5. Comparativa de Métricas
    print("\n[PASO 5] Comparativa Rigurosa de Rendimiento (Test Set):")
    print("-" * 75)
    print(f"{'Modelo':<25} | {'Accuracy':<10} | {'Macro F1':<10} | {'Balanced Acc':<12}")
    print("-" * 75)
    
    b_naive = results["baselines"]["naive_majority"]
    print(f"{'1. Naive Majority Class':<25} | {b_naive['accuracy']:>9.2f}% | {b_naive['macro_f1']:>10.3f} | {'N/A':<12}")

    b_log = results["baselines"]["logistic_regression"]
    print(f"{'2. Logistic Regression':<25} | {b_log['accuracy']:>9.2f}% | {b_log['macro_f1']:>10.3f} | {'N/A':<12}")

    lgb = results["lightgbm_metrics"]
    print(f"{'3. LightGBM Classifier':<25} | {lgb['accuracy']:>9.2f}% | {lgb['macro_f1']:>10.3f} | {lgb['balanced_accuracy']:>11.2f}%")
    print("-" * 75)

    print("\n[+] Matriz de Confusión (Test Set):")
    labels = lgb["class_labels"]
    cm = lgb["confusion_matrix"]
    print(f"    Predicho ->    {labels[0]:<12} {labels[1]:<12} {labels[2]:<12}")
    for i, row in enumerate(cm):
        print(f"    Real {labels[i]:<10}: {row[0]:<12} {row[1]:<12} {row[2]:<12}")

    # 6. Importancia Cuantitativa de Factores (Feature Importance Gain %)
    print("\n[PASO 6] Ranking Cuantitativo de Importancia de Características (Tree Gain):")
    for feat, imp in list(results["feature_importances_gain_pct"].items())[:8]:
        bar = "█" * int(imp / 2)
        print(f"    - {feat:<22}: {imp:>5.2f}% {bar}")

    # 7. Prueba de Inferencia en Tiempo Real
    print("\n[PASO 7] Probando inferencia en tiempo real sobre la última observación...")
    latest_features = df_labeled[feature_store.FEATURE_COLUMNS].iloc[-1].to_dict()
    prediction = ml_classifier.predict_signal(latest_features)
    print(f"[+] Predicción ML:")
    print(f"    - Acción Sugerida: {prediction['ml_action']}")
    print(f"    - Confianza: {prediction['confidence_score']:.2f}%")
    print(f"    - Probabilidades: P(BUY)={prediction['probabilities']['p_buy']:.3f} | P(SELL)={prediction['probabilities']['p_sell']:.3f} | P(NEUTRAL)={prediction['probabilities']['p_neutral']:.3f}")

    elapsed = time.time() - start_time
    print(f"\n[+] Artefactos guardados en: {ml_classifier.MODEL_PATH}")
    print(f"[+] Pipeline de Fase C ejecutado con éxito en {elapsed:.2f} segundos.")
    print("=" * 75)


if __name__ == "__main__":
    asyncio.run(run_training())
