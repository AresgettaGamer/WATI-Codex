# Modos de WATI Codex

## Codex de Conocimiento

- Muestra el catálogo completo que WATI Core conoce.
- No registra ubicaciones ni progreso de exploración.
- La portada se limita a **Buscar y explorar** y **Fuentes y configuración**.

## Conocimiento y Exploración

- Mantiene visible el catálogo completo.
- Registra biomas visitados, ecosistemas reconocidos, estructuras documentadas, trayectos y ubicaciones.
- Permite ubicaciones personales y comunitarias, objetivos y orientación hacia registros conocidos.

## Tu Registro de Aventura

- Solo revela objetos, bloques, entidades y lugares documentados por el jugador.
- Conserva etapas progresivas de conocimiento y sincronización de inventario.
- Las búsquedas también usan alias es_MX sin modificar ni reiniciar descubrimientos anteriores.

## Navegación consolidada — v1.11.1

La portada utiliza centros contextuales:

- **Buscar y explorar:** búsqueda, categorías e inventario.
- **Mi registro:** progreso personal y catálogo de lugares descubiertos; solo aparece en Exploración y Aventura.
- **Ubicaciones y orientación:** registros personales/comunitarios, objetivo activo y trayecto; solo aparece en Exploración y Aventura.
- **Fuentes y configuración:** addons instalados, perfil, información y limitaciones conocidas.

El Registro de exploración ya no repite ubicaciones, orientación ni trayectos. Las opciones administrativas siguen fuera de la navegación normal mediante `/wati:codex_admin`.

## Persistencia

La política del servidor y el perfil personal permanecen separados. Forzar un modo nunca elimina la elección personal, los descubrimientos, los trayectos ni las ubicaciones guardadas.
## Conocimiento enriquecido — v1.12.0

- Conocimiento muestra todos los hechos estructurados disponibles.
- Conocimiento y Exploración muestra información completa y permite relacionarla con ubicaciones registradas.
- Tu Registro de Aventura revela progresivamente drops, hábitats, contenido de biomas, relaciones y construcciones; los datos aún no documentados aparecen como `???`.
- La ausencia de un perfil específico no bloquea la entrada: Core genera un resumen y roles básicos desde el identifier, tipo y categoría.

