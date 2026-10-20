---
name: corporate-identity-ui
description: >-
  Usar SIEMPRE que se generen, modifiquen o auditen componentes visuales, páginas web,
  estilos CSS/Tailwind, gráficos interactivos de TradingView, terminales de trading o
  dashboards de telemetría. Garantiza apego estricto a la estética oscura institucional
  (Dark Theme Fintech), tokens de color de mercado y diseño ergonómico de alta densidad.
---

# Estándar de Identidad Visual y Diseño UI (Terminal Financiera & Admin)

Esta directiva gobierna toda la interfaz de usuario del **Motor Predictivo de Tendencias Web (Cripto & Macro)**. El diseño debe transmitir confiabilidad, precisión matemática y estética de grado institucional (estilo Bloomberg Terminal / TradingView Pro).

---

## 1. Tokens de Color del Sistema (Dark Theme Institucional)

Toda la aplicación utiliza un tema oscuro de alta legibilidad y contraste calibrado para sesiones prolongadas de trading:

| Token Semántico | Código HEX | Utilidad Tailwind / CSS | Propósito |
| :--- | :--- | :--- | :--- |
| **Fondo Principal (Canvas)** | `#0b0e14` | `bg-[#0b0e14]` | Fondo de la aplicación y terminal |
| **Superficie / Cards** | `#131923` | `bg-[#131923]` | Contenedores, tarjetas, paneles de gráficos |
| **Superficie Elevada** | `#1c2433` | `bg-[#1c2433]` | Modales, popovers, tooltips |
| **Bordes Estructurales** | `#242f42` | `border-[#242f42]` | Separadores de cuadrículas y tablas |
| **Acento Primario (Marca)** | `#3b82f6` | `bg-blue-500` / `text-blue-500` | Acciones principales, botones activos |
| **Alcista / Compra (Bullish)** | `#10b981` | `text-emerald-500` / `bg-emerald-500` | Velas verdes, señales BUY, variación positiva |
| **Bajista / Venta (Bearish)** | `#ef4444` | `text-rose-500` / `bg-rose-500` | Velas rojas, señales SELL, variación negativa |
| **Advertencia / Neutral** | `#f59e0b` | `text-amber-500` | Señales HOLD, alertas de latencia en fuentes |
| **Texto Primario** | `#f8fafc` | `text-slate-50` | Precios, títulos, métricas principales |
| **Texto Secundario (Muted)** | `#94a3b8` | `text-slate-400` | Etiquetas, timestamps, metadata |

---

## 2. Tipografía y Números Financieros
- **Fuente Principal:** `Inter` o `system-ui` para interfaz, menús y formularios.
- **Fuente Numérica y Tickers:** `Roboto Mono` o `JetBrains Mono` con alineación tabular obligatoria:
  ```css
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  ```
  *Regla:* Los precios, volúmenes y porcentajes nunca deben vibrar o saltar horizontalmente al cambiar de valor en tiempo real.

---

## 3. Directrices de Componentes Clave

### A. Modales con Protección Anti-Backdrop
- **Regla Estricta:** Todo modal con formularios (ej: creación de alertas, configuración de API keys o filtros de señales) **NO DEBE CERRARSE** al hacer clic accidentalmente en el fondo exterior (backdrop / overlay).
- El cierre solo se permite mediante el botón explícito de «Cerrar / Cancelar» o el icono `✕` superior.

### B. Tablas de Mercado y Listados de Señales
- **Alta densidad de información:** Padding vertical compacto (`py-1.5` o `py-2`), bordes sutiles entre filas.
- **Efecto Hover:** Resaltado sutil (`hover:bg-[#1a2230]`) para guiar la vista del trader.
- **Empty States Obligatorios:** Si no hay datos (ej: sin señales activas para un timeframe), mostrar un contenedor con icono descriptivo, mensaje claro y botón de refresco o ajuste de filtros.

### C. Integración de TradingView Lightweight Charts
- Inicializar con fondo transparente (`background: { type: 'solid', color: 'transparent' }`) y colores alineados a los tokens (`upColor: '#10b981'`, `downColor: '#ef4444'`).
- Suscribir las actualizaciones de tick mediante WebSockets a la serie activa usando `series.update()` en lugar de recrear el gráfico o resetear el dataset completo.

### D. Cero Placeholders Genéricos
- No utilizar imágenes rotas ni enlaces a `via.placeholder.com`.
- Usar iconos vectoriales limpios de `lucide-react` para indicadores y estados de red.
