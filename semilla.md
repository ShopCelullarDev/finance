# SEMILLA VIVA DE ESTADO (CHECKPOINT SEED)

- FECHA_HORA: 2026-10-28T07:20:00-04:00
- AGENTE_MODELO: Grok 4.7
- ROL_ACTIVO: devops-security-agent
- FASE_ACTUAL: Despliegue en CWP finance
- ID_TAREA_ACTUAL: DEPLOY-CWP
- ESTADO_TAREA: EN_PROGRESO

## ULTIMA ACCION COMPLETADA
El 503 era la terminal caída. Node no podía crear hilos porque el vigilador se quedaba colgado y acumulaba procesos. Se soltaron esos procesos, Next volvió en el puerto 3000 y el login público responde 200. keep-alive.php ahora arranca el servicio y sale, sin esperar al proceso.

## ARCHIVOS MODIFICADOS RECIENTEMENTE
- app/api/v1/endpoints/live_stream.py
- app/api/v1/endpoints/market_data.py
- app/api/v1/endpoints/auth.py
- app/api/v1/router.py
- app/services/ingestion/binance_ws.py
- frontend/next.config.ts
- frontend/src/services/origin.ts
- frontend/src/services/websocket.ts
- frontend/src/app/page.tsx
- frontend/src/components/trading/TradingViewChart.tsx
- frontend/src/components/trading/OrderbookWidget.tsx
- deploy/cwp/keep-alive.php

## COMANDO DE VERIFICACION RAPIDA
curl -sk --resolve finance.cex-ve.xyz:443:149.56.94.139 -o /dev/null -w "%{http_code}\n" https://finance.cex-ve.xyz/login

## INSTRUCCION DE REANUDACION PARA EL PROXIMO AGENTE
No borrar pgdata ni reescribir ~/market/.env. No hacer source de ese .env. No commitear secretos ni la clave del panel. Apache entrega todo a Next en 127.0.0.1:3000; Next reenvía /api al puerto 8000. El único cron recurrente es keep-alive.php. No abrir el plan de latencia ni las fases 8.2 y 8.3 hasta que lo pidan. El escenario recomendado para tiempo real quedó en el canvas escenario-tiempo-real: un solo servidor con systemd, no la jaula CWP ni una laptop. No migrar hasta que lo pidan. Siguen pendientes el certificado de finance.cex-ve.xyz y los límites nproc/nofile del SSH.
