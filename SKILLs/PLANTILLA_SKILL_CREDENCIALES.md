---
name: project-credentials-environments
description: >-
  Usar SIEMPRE que el agente necesite conectarse a bases de datos, APIs externas, 
  servidores SSH, o cuando requiera conocer variables de entorno, puertos y 
  configuración de credenciales entre entornos (Local, Staging/Lab y Producción). 
  Evita adivinanzas de conexiones y previene la exposición de secretos en git.
---

# Gestión de Credenciales, Conexiones y Entornos

Este documento define las directivas de acceso, topología de servicios y manejo seguro de credenciales del proyecto. El agente debe consultar esta guía antes de solicitar credenciales o intentar conectarse a cualquier servicio.

---

## 1. Regla de Oro: Cero Secretos en Git
- **NUNCA** escribir contraseñas, tokens de API, JWT secrets o claves privadas directamente en el código fuente ni en commits.
- Todos los secretos deben leerse estrictamente desde variables de entorno (`.env` local o gestor de secretos del servidor).
- Todo archivo sensible debe estar listado en `.gitignore`:
  - `.env`, `.env.local`, `.env.*.local`
  - `*.pem`, `*.key`, `id_rsa*`
  - Archivos de credenciales de nube (`credentials.json`, `service-account.json`)

---

## 2. Matriz de Entornos y Conexiones

| Entorno | Host / URL Base | Base de Datos | Puerto App | Propósito |
| :--- | :--- | :--- | :--- | :--- |
| **Local** | `localhost` | `[Completar con conexión local]` | `[Ej: :3000 o :8000]` | Desarrollo diario |
| **Staging / Test** | `[URL de pruebas]` | `[Host DB Pruebas]` | `[Puerto pruebas]` | UAT, pruebas integradas |
| **Producción** | `[URL producción]` | `[Host DB Producción]` | `[Puerto producción / 443]` | Usuarios reales |

---

## 3. Convención de Variables de Entorno

El proyecto debe mantener un archivo plantilla `.env.example` en el repositorio.
Para configurar un entorno local, el desarrollador copia:
```bash
cp .env.example .env.local
```

### Nombres canónicos de variables
- **Base de Datos:** `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- **Seguridad / Auth:** `JWT_SECRET_KEY`, `SESSION_SECRET`
- **Servicios Externos:** `SMTP_HOST`, `API_KEY_SERVICE`

---

## 4. Perfiles SSH y Accesos Remotos
- Para tareas de despliegue o diagnóstico remoto, usar **alias SSH** configurados en `~/.ssh/config` en lugar de IPs hardcodeadas con credenciales planas:
  ```ssh-config
  Host srv-staging
      HostName staging.midominio.com
      User deploy
      IdentityFile ~/.ssh/id_ed25519_deploy
  ```
- Ejecutar comandos remotos mediante: `ssh srv-staging "comando"`.
