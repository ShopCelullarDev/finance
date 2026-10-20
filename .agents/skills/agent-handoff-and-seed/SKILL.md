---
name: agent-handoff-and-seed
description: >-
  Usar SIEMPRE al iniciar cualquier sesión de trabajo, al finalizar una tarea atómica,
  al hacer traspaso entre diferentes agentes o modelos (de mayor a menor capacidad o viceversa),
  o para blindar el avance ante desconexiones o fallos eléctricos. Administra la
  semilla viva de estado (semilla.md) para retomar el trabajo de inmediato y sin leer
  el repositorio completo.
---

# Protocolo de Semilla Viva y Traspaso de Agentes (Agent Handoff & Seed)

Este protocolo garantiza que cualquier agente de IA pueda retomar el desarrollo en el punto exacto donde se quedó el agente anterior, con **cero pérdida de contexto**, sin importar interrupciones abruptas (como cortes de energía eléctrica) ni la capacidad o modelo del agente entrante.

---

## 1. El Concepto de "Semilla de Estado Vivo" (`semilla.md`)

En lugar de obligar al agente entrante a consumir tokens innecesarios leyendo decenas de archivos o repasando todo el historial de la conversación, el sistema mantiene un archivo de sincronización ultraligero en la raíz del proyecto:
👉 **[semilla.md](file:///home/gustavo/Documentos/Proyectos_IA/MARKET/semilla.md)** (< 50 líneas).

La semilla almacena el **Save Point** del proyecto en tiempo real.

---

## 2. Protocolo de Inicio (Onboarding Rápido del Agente Entrante)

Cuando un agente entra a trabajar (tras un reinicio, cambio de modelo o inicio de turno):

1. **Paso 1: Leer ÚNICAMENTE la semilla viva:**
   - Inspeccionar el archivo [semilla.md](file:///home/gustavo/Documentos/Proyectos_IA/MARKET/semilla.md).
   - Extraer:
     - Fase y Tarea actual.
     - Última acción atómica confirmada.
     - **Instrucción de reanudación inmediata (`INSTRUCCION_REANUDACION`)**.
2. **Paso 2: Validar el estado del entorno (Comando de Verificación):**
   - Ejecutar el comando rápido indicado en el campo `COMANDO_VERIFICACION` (ej: `docker compose ps` o `git status`).
3. **Paso 3: Proceder a la ejecución sin releer todo el árbol de archivos:**
   - El agente ejecuta directamente la tarea indicada en la semilla sin rodeos ni alucinaciones.

---

## 3. Protocolo de Checkpoint Atómico (Durante y al Final del Turno)

Cada vez que un agente complete una acción atómica (crear un archivo, ejecutar una migración, implementar un endpoint):

1. **Actualizar [semilla.md](file:///home/gustavo/Documentos/Proyectos_IA/MARKET/semilla.md):**
   - Escribir quién realizó la acción (Modelo + Rol de agente).
   - Indicar exactamente qué archivos fueron alterados.
   - Dejar redactada en 1 o 2 líneas la instrucción exacta para el siguiente agente.
2. **Actualizar [pendiente.md](file:///home/gustavo/Documentos/Proyectos_IA/MARKET/pendiente.md):**
   - Marcar con `[x]` las subtareas concluidas o `[/]` la tarea en progreso.
3. **Registrar la entrada en [bitacora.md](file:///home/gustavo/Documentos/Proyectos_IA/MARKET/bitacora.md):**
   - Registrar con marca de tiempo, modelo del agente, fase y acción ejecutada.

---

## 4. Estructura Obligatoria de `semilla.md`

El archivo `semilla.md` debe respetar estrictamente este formato:

```markdown
# SEMILLA VIVA DE ESTADO (CHECKPOINT SEED)

- FECHA_HORA: 2026-10-20T10:30:00-04:00
- AGENTE_MODELO: [Ej: Gemini 3.8 Flash High / Claude 3.5 Sonnet / etc.]
- ROL_ACTIVO: [Ej: dba-timescaledb-agent / backend-fastapi-agent]
- FASE_ACTUAL: [Ej: Fase 1 - Recopilación y Arquitectura]
- ID_TAREA_ACTUAL: [Ej: 1.1]
- ESTADO_TAREA: [EN_PROGRESO / COMPLETADO / INTERRUMPIDO]

## ULTIMA ACCION COMPLETADA
[Descripción precisa de lo que acaba de quedar funcionando y verificado]

## ARCHIVOS MODIFICADOS RECIENTEMENTE
- ruta/al/archivo_1.py
- ruta/al/archivo_2.sql

## COMANDO DE VERIFICACION RAPIDA
[Comando en una línea para que el nuevo agente verifique que el entorno está sano]

## INSTRUCCION DE REANUDACION PARA EL PROXIMO AGENTE
[Instrucción imperativa y directa: exactamente qué archivo abrir o qué comando correr para continuar]
```

---

## 5. Resiliencia ante Cortes de Energía o Reinicios Imprevistos
- Dado que `semilla.md` se actualiza **inmediatamente después de cada acción atómica exitosa**, si la máquina se apaga de golpe, el próximo agente simplemente leerá `semilla.md` y sabrá exactamente dónde se interrumpió el proceso y qué comando correr para reanudar.
- No se asume nada: el comando de verificación rápida valida el estado de los contenedores o del código antes de escribir una sola línea nueva.
