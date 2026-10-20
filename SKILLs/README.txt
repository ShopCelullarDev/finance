================================================================================
KIT DE GENERACIÓN Y ESTANDARIZACIÓN DE SKILLS PARA GOOGLE ANTIGRAVITY / CURSOR
================================================================================

Este paquete contiene las directivas y plantillas necesarias para que el asistente 
de Inteligencia Artificial (Google Antigravity, Cursor, etc.) audite tu proyecto, 
comprenda su arquitectura, extraiga tus propios valores de diseño y genere 
automáticamente 3 Skills personalizadas adaptadas 100% a tu stack tecnológico.

Las 3 Skills generadas serán:
  1. project-credentials-environments (Gestión de credenciales, puertos y entornos)
  2. corporate-identity-ui            (Identidad visual, tokens UI y componentes)
  3. safe-deployment-data-guard       (Despliegue seguro y protección de datos)


--------------------------------------------------------------------------------
ARCHIVOS INCLUIDOS EN ESTA CARPETA
--------------------------------------------------------------------------------

- README.txt
    Este archivo de instrucciones rápidas.

- SETUP_SKILLS.md
    Archivo maestro de directivas. Contiene el protocolo de introspección y 
    las 3 fases de generación que Antigravity ejecutará de forma autónoma.

- PLANTILLA_SKILL_CREDENCIALES.md
    Plantilla de referencia que muestra la estructura de frontmatter y contenido
    esperada para la gestión de accesos y variables de entorno.

- PLANTILLA_SKILL_IDENTIDAD_UI.md
    Plantilla de referencia que muestra cómo documentar la paleta de colores, 
    tipografía, protección anti-backdrop en modales y tablas ergonómicas.

- PLANTILLA_SKILL_DESPLIEGUE_SEGURO.md
    Plantilla de referencia sobre el checklist pre-deploy, respaldo transaccional,
    migraciones idempotentes y plan de rollback para evitar pérdida de datos.


--------------------------------------------------------------------------------
INSTRUCCIONES DE USO CON ANTIGRAVITY (MÉTODO AUTOMÁTICO RECOMENDADO)
--------------------------------------------------------------------------------

1. COPIAR EL ARCHIVO MAESTRO:
   Copia el archivo "SETUP_SKILLS.md" a la raíz de tu proyecto.

2. ABRIR EL PROYECTO EN ANTIGRAVITY (o Cursor):
   Abre la carpeta de tu desarrollo en el IDE.

3. COPIAR Y PEGAR EL SIGUIENTE PROMPT EN EL CHAT DE ANTIGRAVITY:
   ---------------------------------------------------------------------------
   "Por favor lee el archivo SETUP_SKILLS.md ubicado en la raíz del proyecto. 
   Ejecuta las tres fases detalladas en el documento:
   1. Audita nuestro código para identificar nuestro stack, componentes, 
      paleta de colores/estilos, base de datos y comandos reales.
   2. Genera las 3 Skills personalizadas en la carpeta .agents/skills/ 
      (project-credentials-environments, corporate-identity-ui y 
      safe-deployment-data-guard) usando los valores reales de nuestro proyecto.
   3. Valida la sintaxis YAML de cada SKILL.md y preséntame un resumen 
      de lo detectado."
   ---------------------------------------------------------------------------

4. RESULTADO:
   Antigravity leerá tu package.json, Dockerfile, configs CSS/Tailwind, ORM, etc.,
   y creará la siguiente estructura dentro de tu repositorio:
   
   tu-proyecto/
   └── .agents/
       └── skills/
           ├── project-credentials-environments/
           │   └── SKILL.md
           ├── corporate-identity-ui/
           │   └── SKILL.md
           └── safe-deployment-data-guard/
               └── SKILL.md

   A partir de ese momento, cada vez que le pidas crear vistas, conectarte a 
   servicios o preparar despliegues, Antigravity activará automáticamente la skill 
   pertinente respetando tus propios estándares.


--------------------------------------------------------------------------------
MÉTODO MANUAL (OPCIONAL)
--------------------------------------------------------------------------------

Si prefieres redactar las skills tú mismo o adaptarlas manualmente, consulta 
las plantillas "PLANTILLA_SKILL_*.md" adjuntas y colócalas dentro de 
.agents/skills/<nombre-de-la-skill>/SKILL.md (o .cursor/skills/ en Cursor).
================================================================================
