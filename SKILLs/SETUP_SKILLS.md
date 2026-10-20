# GUÍA DE AUTODESCUBRIMIENTO Y GENERACIÓN DE SKILLS PARA ANTIGRAVITY

> **Instrucción para el Agente de IA:**  
> Lee este documento completamente. Tu objetivo es **auditar este repositorio**, comprender su arquitectura, extraer sus estándares actuales y generar **3 Skills personalizadas** en la carpeta `.agents/skills/` (o `.cursor/skills/`).  
> **NO inventes tecnologías ni uses plantillas externas prefabricadas**: basa cada skill en el código, configuraciones, componentes y estilos existentes en este proyecto.

---

## FASE 1: Auditoría e Introspección del Repositorio

Antes de generar cualquier skill, realiza una inspección del proyecto ejecutando las siguientes tareas de investigación:

### 1.1. Detección de Stack y Conexiones
1. **Inspeccionar dependencias:** Revisa `package.json`, `requirements.txt`, `pyproject.toml`, `go.mod`, `pom.xml` o equivalentes para identificar:
   - Framework de backend y frontend.
   - Base de datos y ORM/driver de conexión (Prisma, TypeORM, SQLAlchemy, Drizzle, Mongoose, etc.).
   - Librerías de autenticación y manejo de sesiones.
2. **Estructura de Entornos:**
   - Busca archivos `.env.example`, `.env.dist`, `docker-compose*.yml` o configuraciones de configuración.
   - Identifica los nombres de variables canónicas para Base de Datos, Puertos, Claves de API y Servicios Externos.
   - Identifica cómo el proyecto diferencia entornos: `local`/`development`, `staging`/`test` y `production`.

### 1.2. Extracción de Identidad Visual y Estándares UI
1. **Sistema de Estilos:** Identifica la herramienta en uso (Tailwind CSS, CSS Modules, Styled Components, SASS, CSS nativo con variables `:root`, etc.).
2. **Tokens Existentes:** Extrae del código fuente existente:
   - **Paleta de colores real:** Colores primarios, secundarios, fondos, bordes, estados (éxito, error, advertencia) y modo oscuro si aplica.
   - **Tipografía:** Familias tipográficas (`font-family`), escalas de encabezados (`h1`-`h6`) y textos base.
   - **Ubicación de Assets:** Dónde se almacenan los logos, isotipos e iconos oficiales del proyecto (ej: `src/assets/`, `public/images/`, `static/brand/`).
3. **Patrones de Componentes:** Observa cómo se implementan actualmente:
   - Encabezados, barras de navegación o layouts principales.
   - Modales/diálogos (comportamiento al hacer clic fuera o backdrop).
   - Tablas y listas (hover, clicabilidad, estados vacíos/empty states).

### 1.3. Auditoría de Despliegue y Protección de Datos
1. **Infraestructura y Ejecución:** Identifica cómo se corre la app (Docker, Serverless, VPS, Kubernetes, scripts en `package.json` o `Makefile`).
2. **Motor de Datos:** Confirma el motor de base de datos exacto (PostgreSQL, MySQL, SQLite, MongoDB, etc.).
3. **Mecanismo de Migraciones:** Revisa si usan herramientas dedicadas (Flyway, Alembic, Prisma Migrate, TypeORM migrations, scripts SQL versionados).
4. **Puntos Críticos de Pérdida de Datos:** Identifica dónde residen los datos persistentes (volúmenes Docker, bases de datos gestionadas, buckets S3) para blindarlos.

---

## FASE 2: Generación de las 3 Skills

Crea la estructura de carpetas en `.agents/skills/` (o `.cursor/skills/` según corresponda) y escribe los archivos `SKILL.md` con su respectivo frontmatter YAML.

```text
.agents/skills/
├── project-credentials-environments/
│   └── SKILL.md
├── corporate-identity-ui/
│   └── SKILL.md
└── safe-deployment-data-guard/
    └── SKILL.md
```

---

### Skill 1: Gestión de Credenciales y Entornos
- **Ruta:** `.agents/skills/project-credentials-environments/SKILL.md`
- **Frontmatter YAML obligatorio:**
  ```yaml
  ---
  name: project-credentials-environments
  description: >-
    Usar SIEMPRE que se requiera conectar a bases de datos, APIs, servicios externos,
    configurar variables de entorno o gestionar accesos entre Local, Staging y Producción.
    Evita adivinanzas de conexiones y bloquea la inclusión de credenciales en control de versiones.
  ---
  ```
- **Contenido que el agente debe redactar a partir de la auditoría:**
  1. **Política Estricta de Cero Secretos:** Reglas de exclusión en `.gitignore` para archivos `.env` y claves privadas.
  2. **Matriz de Entornos del Proyecto:** Tabla con los entornos reales del proyecto, puertos predeterminados y cómo se configuran las URLs base.
  3. **Catálogo de Variables de Entorno:** Lista documentada de todas las variables requeridas por el proyecto (basada en el `.env.example` detectado) con ejemplos de uso seguro.
  4. **Instrucciones para Nuevos Desarrolladores:** Pasos exactos para levantar las conexiones locales sin romper configuraciones existentes.

---

### Skill 2: Identidad Corporativa y Diseño Visual
- **Ruta:** `.agents/skills/corporate-identity-ui/SKILL.md`
- **Frontmatter YAML obligatorio:**
  ```yaml
  ---
  name: corporate-identity-ui
  description: >-
    Usar SIEMPRE que se cree, modifique o audite código de interfaz de usuario, páginas,
    componentes visuales, estilos, correos electrónicos o reportes. Garantiza el apego
    estricto a los tokens de diseño, paletas y componentes nativos de este proyecto.
  ---
  ```
- **Contenido que el agente debe redactar a partir de la auditoría:**
  1. **Tokens de Color y Variables Extraídas:** Documentar los colores exactos detectados en el proyecto (códigos HEX/HSL o clases utilitarias), organizados por marca, superficies, texto y estados.
  2. **Tipografía y Jerarquía:** Reglas de fuentes y tamaños de texto vigentes en el proyecto.
  3. **Directrices de Componentes Clave:**
     - **Modales Seguros:** Regla obligatoria para que los modales con formularios no se cierren accidentalmente al hacer clic en el backdrop/overlay exterior.
     - **Tablas y Listados:** Espaciado ergonómico, efectos hover y la obligación de incluir *Empty States* (estado vacío amigable con mensaje y botón de acción cuando no hay registros).
     - **Uso Estricto de Assets Oficiales:** Prohibir placeholders temporales o logos distorsionados; referenciar la ruta exacta donde residen los logos e iconos del proyecto.

---

### Skill 3: Despliegue Seguro y Protección de Datos
- **Ruta:** `.agents/skills/safe-deployment-data-guard/SKILL.md`
- **Frontmatter YAML obligatorio:**
  ```yaml
  ---
  name: safe-deployment-data-guard
  description: >-
    Usar SIEMPRE que se prepare o ejecute un despliegue, actualización de versión,
    migración de base de datos o script de mantenimiento en Staging o Producción.
    Establece salvaguardas estrictas contra pérdida o corrupción de datos.
  ---
  ```
- **Contenido que el agente debe redactar a partir de la auditoría:**
  1. **Política de Aislamiento de Datos:**
     - Regla explícita: **PRODUCCIÓN ES LA FUENTE MAESTRA DE DATOS**.
     - Prohibición categórica de restaurar volcados de prueba/staging sobre producción.
     - Prohibición de comandos destructivos sin migración transaccional controlada.
  2. **Checklist Pre-Despliegue Adaptado al Stack:**
     - Cómo poner la app en mantenimiento o frenar tráfico conflictivo antes de intervenir.
     - Comando exacto para generar un backup/snapshot de la base de datos detectada (ej: `pg_dump`, `mysqldump`, snapshot de volumen) con marca temporal (`YYYYMMDD_HHMMSS`).
     - Procedimiento para correr las migraciones de esquema de forma transaccional e idempotente (`IF NOT EXISTS`, reversibilidad).
  3. **Verificación Post-Despliegue (Smoke Tests):**
     - Pruebas inmediatas de endpoints de salud, autenticación y carga de vistas principales.
  4. **Protocolo de Rollback:**
     - Pasos exactos para revertir código y restaurar el respaldo de base de datos en caso de incidente grave.

---

## FASE 3: Validación Final

Una vez generadas las skills, el agente debe:
1. Validar que la sintaxis YAML de los frontmatters sea correcta y sin errores de indentación.
2. Verificar que ninguna de las skills haga referencia a rutas o servicios inexistentes.
3. Presentar un resumen breve al desarrollador indicando qué tokens, puertos y comandos detectó e integró en cada skill.
