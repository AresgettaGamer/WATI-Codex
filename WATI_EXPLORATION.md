# WATI Codex — Registro de exploración

## v1.8.1

- Funciona en los modos Conocimiento y Exploración, y Tu Registro de Aventura.
- Consulta el bioma actual cada 60 ticks únicamente para jugadores con exploración activa.
- Muestrea un conjunto fijo de bloques cercanos para reconocer ecosistemas artificiales.
- No dibuja terreno, no guarda chunks y no genera un minimapa.
- Guarda primera y última visita, coordenadas conocidas, dimensión y cantidad de entradas.
- Conserva hasta 96 transiciones recientes como trayecto personal.
- Las estructuras permanecen como catálogo hasta implementar puntos de interés manuales y compartidos.

## Estructuras

Codex intenta documentar estructuras generadas cuando la API las devuelve en la posición actual del jugador. Las estructuras no expuestas por Minecraft continúan dependiendo de un futuro Punto de interés manual.

## v1.9.0 — ubicaciones registradas

El Registro de Exploración añade una capa separada de ubicaciones:

- Los descubrimientos personales de biomas, ecosistemas y estructuras continúan guardándose por jugador.
- Las ubicaciones personales se almacenan en propiedades dinámicas del jugador.
- Las ubicaciones comunitarias se almacenan en propiedades dinámicas del mundo.
- Cada ubicación conserva coordenadas, dimensión, bioma real, variante, autor, confirmaciones y notas.
- Las estructuras utilizan radios de duplicado distintos según su tamaño esperado.
- Confirmar un registro comunitario añade la estructura o ecosistema al trayecto personal del explorador.
- Los puntos personalizados no necesitan existir en WATI Core y pueden representar casas, portales, minas, granjas, peligros o referencias.

La detección automática de estructuras sigue siendo experimental. El registro manual es la fuente fiable para estructuras que `getGeneratedStructures()` no exponga.


## Orientación y rituales — estado actual

- Las ubicaciones confirmadas personales y comunitarias se consultan y pueden convertirse en objetivos personales.
- El prototipo de ritual por 15 niveles conserva soporte para rumores verificables, pero la búsqueda automática de un bioma permanece desactivada mientras la API estable no exponga un método compatible.
- No se consume experiencia cuando la capacidad automática no existe.
- Estructuras y ecosistemas dependen del registro comunitario, el descubrimiento y futuras integraciones; no se inventan coordenadas.

## v1.10.2 — experimento de búsqueda pre-release

El ritual usa `findClosestBiome` cuando la rama pre-release de Script API lo expone y conserva el resultado como rumor hasta verificarlo.


## Compatibilidad del ritual

El Codex principal usa `@minecraft/server 2.8.0` estable. La búsqueda automática solo se activa si el runtime ya expone `findClosestBiome()` o `calculateClosestBiomeFromSeed()`. No se exige una dependencia pre-release porque una versión no disponible impediría que todo Codex iniciara. Biome Compass V3.0.4 solicita una versión pre-release de `@minecraft/server`; por lo tanto, su técnica requiere un mundo/runtime compatible con APIs pre-release y no puede integrarse como requisito obligatorio del paquete principal.


## Estado congelado — v1.11.1

La orientación automática por semilla permanece preparada pero desactivada en el runtime estable actual. No se considera un error. Las ubicaciones personales/comunitarias, objetivos, verificación de rumores preexistentes y trayectos continúan activos.
## Contenido de biomas y hábitats — v1.12.0

Las fichas pueden mostrar criaturas, bloques, estructuras y recursos notables relacionados con un bioma, además de los hábitats conocidos de entidades. En Aventura estos datos se revelan conforme el jugador documenta las entradas relacionadas. Los datos extraídos de addons conservan su nivel de confianza y no se presentan como una garantía absoluta de aparición.

