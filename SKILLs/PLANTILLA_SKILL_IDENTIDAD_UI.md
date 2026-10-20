---
name: corporate-identity-ui
description: >-
  Usar SIEMPRE que se generen, modifiquen o auditen componentes visuales, páginas web, 
  estilos CSS/Tailwind, plantillas de correo, reportes o dashboards. 
  Garantiza apego estricto a la identidad visual, tokens de diseño y 
  consistencia en la experiencia de usuario de este proyecto.
---

# Estándar de Identidad Visual y Diseño UI

Esta guía establece el sistema de diseño obligatorio para todas las adiciones visuales del proyecto. Ningún componente debe implementarse con colores genéricos o estilos desalineados del resto de la aplicación.

---

## 1. Tokens de Color y Estilos
*(Los valores a continuación deben actualizarse con los detectados en la auditoría del proyecto)*

- **Color Primario (Marca):** `[Valor detectado en el proyecto]`
- **Color Secundario / Acento:** `[Valor interactivo para botones y enlaces]`
- **Superficies y Fondos:** `[Fondo general]` y `[Fondo de tarjetas/tablas]`
- **Texto:** `[Texto principal de alto contraste]` y `[Texto secundario/metadatos]`
- **Estados:** Éxito, Advertencia, Error e Información.

---

## 2. Tipografía y Jerarquía
- **Familia Tipográfica:** Definida en la configuración del proyecto (ej: Inter, Roboto, sans-serif).
- **Escala de Encabezados:**
  - `h1`: Título principal (uno por vista).
  - `h2`: Título de sección o tarjeta.
  - `h3` / `Subtítulo`: Encabezado secundario.
  - Texto base y leyendas auxiliares.

---

## 3. Reglas de Componentes Estándar

### Modales y Ventanas Emergentes
- **Protección Anti-Backdrop:** Los modales con formularios o datos en edición **NO deben cerrarse** al hacer clic accidentalmente en el fondo exterior (backdrop / overlay). El cierre debe requerir acción explícita mediante botón «Cancelar» o el icono `✕`.
- Todo modal debe contar con encabezado claro, cuerpo scrolleable y barra de acciones inferior.

### Tablas y Listados
- Cabeceras visibles y diferenciadas.
- **Filas interactivas:** Espaciado ergonómico para interacción cómoda y efecto `hover` sutil.
- **Estados vacíos (Empty States):** Toda tabla sin datos debe mostrar un contenedor con icono descriptivo, mensaje claro y un botón de acción primaria (CTA) para agregar registros.

### Assets Oficiales y Logos
- **Prohibido el uso de placeholders genéricos** (como `via.placeholder.com` o iconos desalineados).
- Los logos e isotipos corporativos oficiales deben cargarse exclusivamente desde la carpeta canónica de assets del proyecto.
