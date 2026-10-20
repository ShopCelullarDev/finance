---
name: safe-deployment-data-guard
description: >-
  Usar SIEMPRE que se prepare, ejecute o automatice un despliegue (deploy), 
  migración de esquema de base de datos, actualización de contenedores o script 
  de mantenimiento en Staging o Producción. Establece candados de seguridad 
  estrictos para evitar pérdida de datos o sobrescritura de producción.
---

# Despliegue Seguro y Protección de Datos

Esta directiva gobierna de forma obligatoria cualquier operación de despliegue a producción o ejecución de scripts con impacto en datos.

---

## 1. Política de Aislamiento de Datos (Regla Cero Pérdida)

1. **Producción es la Fuente de la Verdad:** Contiene los datos maestros de usuarios, transacciones y negocio.
2. **Los Entornos de Pruebas (Staging / Dev) son Descartables:** Sirven para validar código nuevo y migraciones.
3. **PROHIBICIÓN ESTRICTA DE RESTAURACIÓN INVERSA:**
   - ❌ **JAMÁS** volcar un respaldo (`dump`) proveniente de Staging/Desarrollo sobre la base de datos de Producción.
   - ❌ **JAMÁS** ejecutar `DROP DATABASE`, `TRUNCATE` o `DROP TABLE` sin un plan de migración en dos fases aprobado.

---

## 2. Protocolo de Despliegue a Producción (Checklist Obligatorio)

### Paso 1: Activar Modo Mantenimiento
- Redirigir el tráfico del proxy o activar el flag de mantenimiento antes de alterar la base de datos o el backend para evitar estados de carrera o transacciones huérfanas.

### Paso 2: Respaldo Transaccional Pre-Vuelo
- Ejecutar un snapshot/dump completo con marca temporal antes de cualquier cambio:
  *(Adaptar el comando al motor de base de datos detectado: PostgreSQL, MySQL, etc.)*
  ```bash
  FECHA=$(date +%Y%m%d_%H%M%S)
  # Ejemplo PostgreSQL:
  # pg_dump -U [usuario] -d [db_prod] -F c -b -v -f "/backups/db_backup_pre_deploy_${FECHA}.dump"
  # Ejemplo MySQL:
  # mysqldump -u [usuario] -p [db_prod] > "/backups/db_backup_pre_deploy_${FECHA}.sql"
  ```
- Verificar que el archivo generado tenga tamaño mayor a 0 bytes.

### Paso 3: Migraciones Idempotentes y Reversibles
- Las migraciones deben ejecutarse dentro de transacciones siempre que el motor lo soporte.
- Todo script DDL debe ser idempotente: usar `IF NOT EXISTS` al crear columnas/índices y evitar eliminar columnas en uso por la versión previa del código.

### Paso 4: Pruebas de Humo (Smoke Testing)
Tras desplegar, verificar inmediatamente:
- [ ] Endpoint de salud (`/health` o `/api/ping`) responde HTTP 200.
- [ ] Login de usuarios y emisión de tokens funcionan correctamente.
- [ ] La interfaz principal carga sin errores de assets 404 o scripts rotos.

### Paso 5: Desactivación de Mantenimiento
- Reabrir el acceso a los usuarios solo tras certificar el estado verde en las pruebas de humo.

---

## 3. Plan de Rollback Inmediato

Si ocurre un error bloqueante en producción:
1. Revertir el código/imagen Docker al commit previo estable.
2. Si la migración falló a medias o corrompió datos: restaurar inmediatamente el snapshot tomado en el Paso 2.
3. Registrar el incidente con los logs de la falla antes de reintentar.
