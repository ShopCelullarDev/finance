---
name: safe-deployment-data-guard
description: >-
  Usar SIEMPRE que se prepare o ejecute un despliegue, actualización de contenedores Docker,
  migración de esquema DDL en TimescaleDB/PostgreSQL, configuración de políticas de retención
  o compresión en hypertables, o scripts de mantenimiento en Staging o Producción.
  Establece salvaguardas estrictas contra pérdida o corrupción de series temporales.
---

# Despliegue Seguro y Protección de Series Temporales (TimescaleDB Guard)

Esta directiva gobierna de forma obligatoria cualquier intervención en bases de datos, migraciones de esquema o despliegue de contenedores del proyecto. Las series de tiempo de ticks de mercado son irrecuperables si se pierden.

---

## 1. Política de Aislamiento y Salvaguarda de Datos

1. **Producción es la Fuente Maestra de la Verdad:** Contiene el histórico real de ticks, noticias indexadas y señales cuantitativas.
2. **Prohibición de Restauración Inversa:**
   - ❌ **JAMÁS** ejecutar volcados (`dumps`) de desarrollo o staging sobre la base de datos de producción.
   - ❌ **PROHIBIDO** el uso de `DROP TABLE`, `TRUNCATE` o `CASCADE` sobre hypertables (`market_ticks`, `news_events`, `predictive_signals`) sin una ventana de mantenimiento programada y un backup verificado.
3. **Integridad de Hypertables:**
   - No alterar tipos de datos de columnas particionadas (`time`, `published_at`, `generated_at`) en caliente.
   - Toda migración DDL debe usar `IF NOT EXISTS` o `ADD COLUMN ... DEFAULT ...`.

---

## 2. Checklist Pre-Despliegue y Migraciones

### Paso 1: Respaldo Transaccional Obligatorio (Snapshot)
Antes de ejecutar migraciones o actualizar imágenes Docker, generar un dump con marca temporal:
```bash
FECHA=$(date +%Y%m%d_%H%M%S)
# Dump de esquema y datos de TimescaleDB:
docker exec -t market_timescaledb pg_dump -U market_admin -d market_predictive_db -F c -b -v -f "/var/lib/postgresql/data/backup_pre_deploy_${FECHA}.dump"
```
*Validación:* Confirmar que el archivo de respaldo exista en disco y tenga tamaño > 0 bytes.

### Paso 2: Migraciones Idempotentes y Transaccionales
- Las migraciones deben correr en bloques `BEGIN; ... COMMIT;` (salvo operaciones específicas de TimescaleDB que requieran ejecutarse fuera de transacciones, las cuales deben ejecutarse de forma aislada).
- Si se añaden políticas de compresión (`add_compression_policy`), verificar primero si ya están activas con `SELECT * FROM timescaledb_information.jobs;`.

### Paso 3: Smoke Tests Inmediatos Post-Despliegue
Verificar los siguientes indicadores antes de dar por completado el despliegue:
- [ ] Contenedores en estado `healthy` (`docker compose ps`).
- [ ] Endpoint de salud responde HTTP 200: `curl -f http://localhost:8000/health`.
- [ ] El socket de Binance/Kraken reconecta y sigue insertando ticks en `market_ticks`.
- [ ] La terminal web `/terminal` carga los gráficos sin errores de CORS o WebSocket 500.

---

## 3. Protocolo de Rollback Inmediato

Si ocurre una falla crítica o bloqueo de la base de datos:
1. Detener los workers de ingesta para no generar escrituras inconsistentes (`docker compose stop ingestion_workers`).
2. Revertir el contenedor backend a la versión de imagen previa (`docker compose up -d --build backend`).
3. Si el esquema quedó corrupto, restaurar el snapshot tomado en el Paso 1:
   ```bash
   pg_restore -U market_admin -d market_predictive_db --clean --if-exists "/var/lib/postgresql/data/backup_pre_deploy_${FECHA}.dump"
   ```
4. Documentar el incidente en [bitacora.md](file:///home/gustavo/Documentos/Proyectos_IA/MARKET/bitacora.md).
