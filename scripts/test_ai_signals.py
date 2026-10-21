import asyncio
import json
from decimal import Decimal
import httpx
from sqlalchemy import func, select

from app.core.database import AsyncSessionLocal
from app.main import app
from app.models.asset import Asset
from app.models.news_event import NewsEvent
from app.models.predictive_signal import PredictiveSignal
from app.services.ai.sentiment_nlp import nlp_engine
from app.services.ai.signal_engine import signal_engine


async def main():
    print("=" * 70)
    print("VALIDACIÓN EN VIVO: MOTOR DE IA, NLP Y SEÑALES PREDICTIVAS")
    print("=" * 70)

    # -------------------------------------------------------------------------
    # 1. PRUEBA DEL MOTOR NLP DE SENTIMIENTO
    # -------------------------------------------------------------------------
    print("\n[PASO 1] Evaluando titulares financieros con FinancialNLPEngine...")

    test_headlines = [
        (
            "REUTERS",
            "Bitcoin surges past $85,000 as institutional inflows break all-time records",
            "https://reuters.com/markets/btc-ath"
        ),
        (
            "BLOOMBERG",
            "SEC announces massive lawsuit and crackdown on crypto exchanges triggering dump",
            "https://bloomberg.com/crypto-sec-crackdown"
        ),
        (
            "FINANCIAL_JUICE",
            "Federal Reserve signals aggressive rate cut to stimulate economic growth",
            "https://financialjuice.com/fed-cuts"
        ),
        (
            "OILPRICE",
            "Crude oil plunges after surprise OPEC output increase and demand slump",
            "https://oilprice.com/crude-slump"
        ),
    ]

    ingested_events = []
    for source, headline, url in test_headlines:
        event = await nlp_engine.ingest_news_event(source=source, title=headline, url=url)
        ingested_events.append(event)
        print(f"  [NLP] {event['source']}: '{event['title'][:50]}...'")
        print(f"        Score: {event['sentiment_score']:+.3f} | Etiqueta: {event['label']} | Activos: {event['affected_assets']}")

    # Validaciones NLP
    assert ingested_events[0]["sentiment_score"] > 0.3, "Titular de Bitcoin debería ser alcista"
    assert "BTC" in ingested_events[0]["affected_assets"], "Debe detectar BTC"
    assert ingested_events[1]["sentiment_score"] < -0.3, "Titular de SEC/crackdown debería ser bajista"
    assert "USO" in ingested_events[3]["affected_assets"], "Debe detectar petróleo/USO"
    print("[+] Motor NLP validado con precisión léxica y extracción de entidades.")

    # -------------------------------------------------------------------------
    # 2. PRUEBA DEL MOTOR DE SEÑALES PREDICTIVAS
    # -------------------------------------------------------------------------
    print("\n[PASO 2] Evaluando señales predictivas para BTC/USDT con SignalEngine...")
    async with AsyncSessionLocal() as session:
        stmt = select(Asset).where(Asset.symbol == "BTC/USDT")
        res = await session.execute(stmt)
        btc_asset = res.scalar_one_or_none()

    assert btc_asset is not None, "El activo BTC/USDT debe existir en base de datos"

    # Evaluar con sesgo macro alcista (ej: Polymarket indicando rate cut)
    signal = await signal_engine.evaluate_asset_signal(
        asset=btc_asset,
        timeframe="5m",
        macro_bias=0.45,
    )

    assert signal is not None, "Señal debe haberse generado exitosamente"
    print(f"[+] Señal Predictiva Generada:")
    print(f"    - ID: {signal['id']}")
    print(f"    - Activo: {signal['symbol']} ({signal['timeframe']})")
    print(f"    - Acción Sugerida: {signal['action']}")
    print(f"    - Confianza: {signal['confidence_score']}%")
    print(f"    - Precio Entrada: ${signal['entry_price']:,.2f}")
    if signal['stop_loss']:
        print(f"    - Stop Loss: ${signal['stop_loss']:,.2f}")
        print(f"    - Take Profit: ${signal['take_profit']:,.2f}")
    print(f"    - Desglose Factores (trigger_factors JSONB):")
    tf = signal['trigger_factors']
    print(f"        * Régimen de Mercado: {tf.get('market_regime', 'N/A')}")
    print(f"        * NLP Score: {tf['nlp_sentiment']['score']} (Peso: {tf['nlp_sentiment']['weight']})")
    print(f"        * Momentum: {tf['price_momentum']['score']} (Var: {tf['price_momentum']['change_pct']}%, Peso: {tf['price_momentum']['weight']})")
    if 'order_flow' in tf:
        print(f"        * Order Flow OFI: {tf['order_flow']['ofi_score']} (CVD: {tf['order_flow']['cvd_ratio']}, Flujo: {tf['order_flow']['flow_regime']}, Peso: {tf['order_flow']['weight']})")
    if 'multi_timeframe' in tf:
        print(f"        * Confluencia MTF: {tf['multi_timeframe']['status']} (Fast: {tf['multi_timeframe']['fast_trend']}, Med: {tf['multi_timeframe']['medium_trend']}, Macro: {tf['multi_timeframe']['macro_trend']}, Score: {tf['multi_timeframe']['confluence_score']})")
    print(f"        * Macro: {tf['macro_bias']['bias']} (Régimen: {tf['macro_bias']['market_regime']})")
    print(f"        * Rationale: {tf['rationale']}")
    assert 'order_flow' in tf, "Debe contener métricas de Order Flow Imbalance (OFI)"
    assert 'multi_timeframe' in tf, "Debe contener confluencia Multi-Timeframe"
    assert 'market_regime' in tf, "Debe clasificar el régimen de mercado"

    # -------------------------------------------------------------------------
    # 3. VERIFICACIÓN DE ENDPOINTS REST MEDIANTE ASGITransport
    # -------------------------------------------------------------------------
    print("\n[PASO 3] Probando endpoints REST de Señales y Noticias...")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # GET /api/v1/news/
        res_news = await client.get("/api/v1/news/?limit=5")
        assert res_news.status_code == 200
        news_list = res_news.json()
        print(f"[+] GET /api/v1/news/ OK: {len(news_list)} eventos recuperados.")

        # POST /api/v1/news/analyze
        res_analyze = await client.post(
            "/api/v1/news/analyze",
            json={"text": "Solana surges to record high as network adoption accelerates massively"}
        )
        assert res_analyze.status_code == 200
        analyze_data = res_analyze.json()
        print(f"[+] POST /api/v1/news/analyze OK: Score={analyze_data['sentiment_score']} ({analyze_data['label']}) | Activos={analyze_data['affected_assets']}")
        assert "SOL" in analyze_data["affected_assets"]

        # GET /api/v1/signals/
        res_signals = await client.get("/api/v1/signals/?limit=5")
        assert res_signals.status_code == 200
        signals_list = res_signals.json()
        print(f"[+] GET /api/v1/signals/ OK: {len(signals_list)} señales recuperadas.")
        assert len(signals_list) > 0
        latest_sig = signals_list[0]
        assert "trigger_factors" in latest_sig
        assert "composite_score" in latest_sig["trigger_factors"]

    # -------------------------------------------------------------------------
    # 4. VERIFICACIÓN EN TIMESCALEDB
    # -------------------------------------------------------------------------
    print("\n[PASO 4] Verificando tablas e hypertables en TimescaleDB...")
    async with AsyncSessionLocal() as session:
        news_count = (await session.execute(select(func.count(NewsEvent.id)))).scalar()
        signal_count = (await session.execute(select(func.count(PredictiveSignal.id)))).scalar()

        print(f"[+] Registros en hipertabla news_events: {news_count}")
        print(f"[+] Registros en hipertabla predictive_signals: {signal_count}")
        assert news_count >= 4
        assert signal_count >= 1

    print("\n" + "=" * 70)
    print(">>> [SUCCESS] VALIDACIÓN MOTOR DE IA Y SEÑALES AL 100% <<<")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
