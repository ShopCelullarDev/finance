---
name: context-compaction-governance
description: >-
  Usar SIEMPRE que se requiera consultar contexto, leer archivos o documentar avances.
  Establece la jerarquía de memoria en 3 capas (L1 Hot, L2 Warm, L3 Cold) para evitar
  la saturación de la ventana de contexto de los modelos, prevenir alucinaciones por
  sobrecarga de tokens y permitir que modelos ligeros operen con la misma efectividad
  que modelos avanzados.
---

# Gobernanza y Compactación de Contexto (Context Compaction Governance)

Esta directiva establece las reglas para la gestión eficiente de la memoria y la ventana de contexto de los agentes de IA, evitando la degradación por ruido o saturación de tokens.

---

## 1. La Jerarquía de Memoria en 3 Capas (Tiers)

Para que cualquier agente (independientemente de su ventana de contexto o potencia) trabaje con máxima precisión:

```
┌─────────────────────────────────────────────────────────────┐
│ NIVEL 1: Memoria Caliente (Hot Memory) -> semilla.md        │
│ Tamaño: < 50 líneas (~300 tokens)                           │
│ Frecuencia: Lectura obligatoria al iniciar cualquier sesión │
│ Propósito: Saber EXACTAMENTE qué hacer de inmediato         │
└─────────────────────────────────────────────────────────────┘
                               ▲
┌─────────────────────────────────────────────────────────────┐
│ NIVEL 2: Memoria Operativa (Warm Memory) -> pendiente/bitacora│
│ Tamaño: Compacto                                            │
│ Frecuencia: Consulta al finalizar tareas o actualizar backlog│
│ Propósito: Marcar tareas [x] y registrar quién hizo qué     │
└─────────────────────────────────────────────────────────────┘
                               ▲
┌─────────────────────────────────────────────────────────────┐
│ NIVEL 3: Memoria Fría / Referencia -> contexto/memory/agentes│
│ Tamaño: Detallado / Arquitectónico                          │
│ Frecuencia: Solo bajo demanda (diseño de APIs o esquemas)   │
│ Propósito: Consultar contratos SQL, puertos y roles         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Reglas de Lectura Quirúrgica de Código

1. **PROHIBIDO leer archivos completos sin necesidad:**
   - Si se necesita inspeccionar un método o función, usar `grep_search` para ubicar la línea y leer únicamente el rango relevante (`StartLine` y `EndLine`).
2. **Cero re-lectura de especificaciones ya asimiladas:**
   - La arquitectura ya está sintetizada en `contexto.md` y `memory.md`. No es necesario volver a pedir al usuario que repita las directivas.
3. **No contaminar el contexto con volcados de logs masivos:**
   - Si un comando genera cientos de líneas, filtrar con `grep`, `tail -n 20` o limitar la salida a la traza del error específico.

---

## 3. Principio de Transparencia entre Modelos (Model-Agnostic Design)

El proyecto debe poder ser intervenido indistintamente por modelos de alta capacidad (Gemini Pro, Claude Sonnet, GPT-4) o modelos rápidos y ligeros (Gemini Flash, Haiku, modelos locales).

Para lograr esto:
1. **Instrucciones Autocontenidas en `semilla.md`:**
   - El agente avanzado que deja la tarea redacta la instrucción en `semilla.md` de forma imperativa, modular y sin ambigüedades.
   - Ejemplo Correcto:
     > `"Abrir app/api/v1/ticks.py e implementar el endpoint GET /ticks/{symbol} usando el modelo MarketTick. Probar con: curl -f http://localhost:8000/api/v1/ticks/BTC-USDT"`.
   - Ejemplo Incorrecto:
     > `"Continuar con la API"`.
2. **Modularidad Estricta:**
   - Cada archivo o módulo debe tener una única responsabilidad (SRP) y no exceder ~300 líneas de código. Esto permite que modelos con menor capacidad de razonamiento puedan editar sin truncar ni romper lógica adyacente.

---

## 4. Estándar de Registro en Bitácora

Toda entrada en [bitacora.md](file:///home/gustavo/Documentos/Proyectos_IA/MARKET/bitacora.md) debe seguir este formato compacto:

```markdown
### [YYYY-MM-DD HH:MM] - [MODELO_AGENTE] - [ROL]
- **Fase / Tarea:** Fase X.X - Nombre de la Tarea
- **Acción:** [Descripción de la acción atómica ejecutada]
- **Archivos Afectados:** [Lista de archivos creados o editados]
- **Estado:** [COMPLETADO / BLOQUEADO]
- **Verificación:** [Resultado del comando de validación ejecutado]
```
