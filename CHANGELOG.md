# WATI Codex — Historial de cambios

## Release v2.0.0 — Codex de conocimiento, aventura y exploración

- Promueve WATI Codex a su segunda línea estable sobre WATI Core v3.0.0.
- Consolida los tres perfiles: Codex de Conocimiento, Conocimiento y Exploración, y Tu Registro de Aventura.
- Incluye descubrimiento persistente de objetos, bloques y entidades con etapas progresivas, además de biomas, ecosistemas y estructuras.
- Integra fichas de Knowledge Schema 1 con descripciones, usos, botín, condiciones, hábitats, contenido notable, relaciones y construcciones especiales.
- Incluye ubicaciones personales y comunitarias, registro manual de estructuras, trayectos y orientación hacia coordenadas conocidas.
- Conserva la búsqueda Vanilla es_MX, navegación consolidada y optimizaciones de exploración para servidor.
- La búsqueda automática de biomas continúa documentada como capacidad futura de la API estable y no se considera un error del Codex.
- Conserva UUID, perfiles, descubrimientos, ubicaciones y demás propiedades dinámicas existentes.

## Beta v1.12.0 — Fichas de conocimiento enriquecido

- Añade una pantalla contextual de información, usos y hallazgos para objetos, bloques, entidades, biomas, ecosistemas y estructuras.
- Muestra descripciones breves, roles, drops, cantidades, condiciones, hábitats, contenido notable del mundo, relaciones y patrones de construcción cuando Core los conoce.
- En Tu Registro de Aventura oculta información no documentada como `???` y revela progresivamente drops comunes, hallazgos raros, lugares y relaciones.
- Conserva la pantalla detallada de obtención para cofres, minería, cosecha, pesca, comercio, generación natural y otras fuentes conocidas.
- Permite abrir entradas relacionadas directamente desde la ficha enriquecida.
- Mantiene la navegación consolidada, la exploración optimizada de v1.11.1 y todos los datos persistentes anteriores.
- Usa únicamente `@minecraft/server 2.8.0` estable; el ritual automático continúa marcado como función futura.

# WATI Codex — Beta v1.11.1

## Exploración optimizada para servidor

- Distribuye el escaneo de jugadores entre varios pulsos para evitar que todos se procesen en el mismo tick.
- Conserva un intervalo efectivo mínimo de cuatro segundos por jugador.
- Omite el muestreo mientras el jugador permanece prácticamente inmóvil y realiza una actualización de respaldo cada minuto.
- Evita reescribir propiedades dinámicas cada pocos segundos cuando el jugador sigue dentro del mismo bioma, ecosistema o estructura.
- Consulta estructuras generadas una sola vez por celda de chunk recorrida, en lugar de hacerlo en cada escaneo.
- Impide que dos escaneos de exploración del mismo jugador se solapen.
- Indexa los ecosistemas por identificador para eliminar búsquedas lineales repetidas.
- Conserva UUID, perfiles, descubrimientos, trayectos, ubicaciones y propiedades dinámicas existentes.

# WATI Codex — Beta v1.11.0

## Consolidación temporal para servidor

- Reduce la portada a cuatro secciones principales: Buscar y explorar, Mi registro, Ubicaciones y orientación, y Fuentes y configuración.
- Coloca las descripciones en el cuerpo de las pantallas y evita saturar los botones principales.
- Añade búsqueda es_MX para objetos, bloques y entidades Vanilla mediante el índice entregado por Core v2.6.0.
- La búsqueda del modo Aventura también reconoce alias españoles sin borrar descubrimientos anteriores.
- Reúne ubicaciones, orientación y trayectos en una sola sección.
- Documenta dentro del propio Codex las limitaciones conocidas como funciones futuras, no como errores.
- Mantiene el runtime estable `@minecraft/server` 2.8.0 y no vuelve a exigir Script API Beta.
- Conserva perfiles, descubrimientos, trayectos, ubicaciones y objetivos mediante los mismos UUID y propiedades dinámicas.

## Recuperación del runtime estable

- Revierte la dependencia obligatoria `@minecraft/server 2.8.0-beta` a `2.8.0` estable.
- Corrige el fallo total `run failed, no runtime or context available`.
- Conserva perfiles, descubrimientos, trayectos, ubicaciones, rumores y objetivos existentes.
- Mantiene la detección dinámica de `findClosestBiome()` y `calculateClosestBiomeFromSeed()` sin exigirlas en el manifest.
- Si la instalación no expone ninguno de esos métodos, Codex sigue funcionando y usa ubicaciones personales/comunitarias.
- Documenta que Biome Compass también depende de una Script API Beta y no demuestra compatibilidad con mundos estables sin ese runtime.

# WATI Codex — Beta v1.10.2

## Ritual compatible con Biome Compass

- Añade `Dimension.findClosestBiome()` como método Beta de compatibilidad.
- Mantiene `calculateClosestBiomeFromSeed()` como método preferente cuando exista.
- Nunca consume experiencia si la búsqueda falla o no está disponible.
- Los resultados siguen guardándose como rumores verificables.
- Limpia comentarios inválidos de los archivos `.lang`.
- Requiere `@minecraft/server 2.8.0-beta` para exponer `findClosestBiome`.

# WATI Codex — Beta v1.10.1

## Beta v1.10.1 — Compatibilidad del ritual

- Explica correctamente que `calculateClosestBiomeFromSeed()` no existe en `@minecraft/server 2.8.0`.
- Mantiene orientación gratuita hacia ubicaciones personales y comunitarias.
- El ritual automático se habilita por detección cuando una API estable compatible esté disponible.
- Elimina comentarios no válidos de los archivos `.lang`.


## Ritual de orientación

- Añade una sección de Orientación en los modos Exploración y Aventura.
- Busca primero biomas ya documentados por el jugador o la comunidad sin consumir experiencia.
- Si no existe una ubicación conocida, permite realizar un ritual de 15 niveles usando la búsqueda de biomas por semilla.
- No consume experiencia cuando la API no está disponible, la búsqueda falla o no encuentra resultados.
- Restringe el ritual a la dimensión correcta del bioma.

## Rumores y objetivos

- Los resultados del ritual se guardan como ubicaciones personales rumoreadas, no como descubrimientos confirmados.
- Añade un objetivo activo con dimensión, coordenadas, distancia y dirección aproximada.
- Permite verificar un rumor al llegar y confirmar que el bioma real coincide.
- Las ubicaciones confirmadas y los registros comunitarios siempre tienen prioridad sobre el ritual.
- Mantiene un único objetivo activo por jugador y permite cancelarlo desde el Codex.

## Estabilidad del paquete

- Elimina la dependencia circular del RP hacia el BP; el BP sigue enlazando y activando su RP compañero.
- Conserva UUID y propiedades dinámicas anteriores para actualizar sin borrar perfiles, descubrimientos o ubicaciones.

# WATI Codex — Beta v1.9.0

## Ubicaciones y puntos de interés

- Añade un registro persistente de ubicaciones personales y comunitarias.
- Permite publicar el bioma actual, registrar ecosistemas y estructuras, y crear puntos personalizados.
- Captura automáticamente coordenadas, dimensión y bioma real al guardar.
- Añade visibilidad Solo yo o Todo el servidor.
- Permite consultar, confirmar y eliminar ubicaciones creadas por el jugador.

## Registro manual y duplicados

- Añade un botón Registrar esta ubicación a las fichas de biomas, ecosistemas y estructuras en Exploración y Aventura.
- Compara registros cercanos usando radios adaptados al tamaño esperado de cada estructura.
- Permite confirmar que se trata del mismo lugar o forzar un registro separado.
- Las confirmaciones comunitarias documentan el lugar en el trayecto personal del explorador.
- Las aldeas, templos, ruinas oceánicas, minas y portales en ruinas admiten variantes.

## Protección del modo Aventura

- En Aventura se exige escribir qué estructura o ecosistema se cree haber encontrado antes de mostrar resultados.
- Si el jugador no reconoce una estructura de add-on, puede registrarla como punto personalizado sin revelar el catálogo completo.

# WATI Codex — Beta v1.8.1

## Búsqueda y localización del mundo

- Integra biomas, ecosistemas y estructuras en los buscadores de Conocimiento y Aventura.
- Amplía la localización de biomas Vanilla modernos y heredados de Bedrock.
- Muestra nombres legibles para las 107 estructuras auditadas de add-ons.
- Usa resúmenes localizados entregados por Core en lugar de descripciones técnicas en inglés.
- Corrige los iconos morados de biomas y exploración utilizando recursos genéricos existentes.
- Localiza los nombres de biomas dentro de condiciones de generación y trayectos.

## Estructuras descubiertas

- Añade estructuras como cuarto tipo del Registro de Exploración.
- Consulta experimentalmente las estructuras generadas que contienen la posición actual del jugador.
- Registra coordenadas, visitas y pasos de trayecto cuando la API devuelve una estructura válida.
- Conserva el registro manual como respaldo para estructuras que Minecraft no exponga.
- Actualiza la dependencia a WATI Core Beta v2.5.1.

## Registro de exploración

- Documenta automáticamente biomas reales al entrar en ellos en los modos Exploración y Aventura.
- Reconoce 13 ecosistemas artificiales de Better On Bedrock y Beyond The Underground mediante muestreo ligero de bloques característicos.
- Guarda primera y última visita, cantidad de entradas, dimensión y coordenadas conocidas.
- Conserva hasta 96 transiciones recientes entre biomas y ecosistemas como una guía de trayecto, sin dibujar un minimapa.
- Añade listas de biomas visitados, ecosistemas documentados y trayecto reciente.
- El modo Aventura solo muestra biomas y ecosistemas realmente descubiertos; Exploración conserva el catálogo completo.

## Catálogo del mundo

- Añade navegación por biomas, ecosistemas y estructuras en el modo Conocimiento.
- Muestra dimensión, condiciones de generación, método de reconocimiento y estado del registro.
- Las 107 estructuras auditadas pueden consultarse, pero se marcan como ubicación manual hasta implementar Puntos de interés.
- Integra Abandoned & Ruin Structures como fuente WATI sin copiar sus texturas de gran tamaño.
- Actualiza la dependencia a WATI Core Beta v2.5.0.

# WATI Codex — Beta v1.6.0

## Descubrimiento progresivo de bloques

- El Registro de Aventura documenta bloques al obtenerlos como objeto, interactuar con ellos, colocarlos o romperlos.
- Añade tres etapas persistentes: Observado, Manipulado y Estudiado.
- Las entradas de bloques se guardan en 16 depósitos separados, sin alterar los objetos documentados en v1.4.0 y v1.5.0.
- El registro, la búsqueda y las fuentes descubiertas combinan ahora objetos y bloques.
- El buscador de Aventura permite filtrar por todo, objetos o bloques.
- Las entidades continúan cerradas hasta su propia etapa de desarrollo.

## Iconos seguros

- Se mantienen las texturas Vanilla y de add-ons cuando existe una ruta reutilizable.
- Líquidos, portales y bloques técnicos invisibles usan el icono genérico para evitar vistas especialmente rotas.
- No se copia ninguna textura de Minecraft dentro de WATI Codex.

# WATI Codex — Beta v1.5.0

## Catálogo Vanilla e iconos reutilizados

- Lee las entradas Vanilla generadas por WATI Core Beta v2.4.0.
- Muestra objetos, bloques y entidades de Minecraft en búsquedas, fichas, addons y el Registro de Aventura.
- Utiliza claves de localización de Minecraft para mostrar los nombres en el idioma activo.
- Reutiliza rutas de texturas Vanilla y de add-ons sin copiar archivos dentro del RP de Codex.
- Añade iconos a ingredientes y resultados navegables de las recetas cuando Core conoce una ruta válida.
- Conserva iconos genéricos cuando un tipo no dispone de textura resoluble.
- Reconoce el método de detección `runtime` y explica que el catálogo Minecraft se genera durante la ejecución.
- Mantiene intactos los perfiles, políticas y descubrimientos guardados en Beta v1.4.0.

# WATI Codex — Beta v1.4.0

## Descubrimiento de objetos

- El modo **Tu Registro de Aventura** ya oculta el catálogo general y solo muestra objetos documentados.
- Los objetos se registran al aumentar o aparecer en el inventario del jugador.
- El inventario existente se sincroniza al abrir el Codex, entrar al mundo, cambiar al modo Aventura o solicitar una sincronización manual.
- El progreso se guarda por jugador mediante 16 propiedades dinámicas distribuidas, evitando una única cadena de datos demasiado grande.
- Las entradas guardan etapa, momento, fuente, método y texto de búsqueda compacto.
- Los avisos nuevos usan la barra de acción y se pueden desactivar desde el perfil.

## Interfaz de Aventura

- Registro paginado de objetos descubiertos.
- Búsqueda limitada al conocimiento documentado.
- Lista de Minecraft y add-ons descubiertos, sin revelar fuentes todavía desconocidas.
- Ficha básica de aventura con pistas de recetas y usos, pero sin revelar ingredientes.
- Las páginas de bloques y entidades permanecen cerradas hasta sus próximas etapas.

## Compatibilidad

- El modo Conocimiento permanece completo.
- El modo Conocimiento y Exploración permanece completo mientras se desarrolla el registro de expediciones.
- Compatible con WATI Core Beta v2.3.0 y protocolo 3.

# WATI Codex — Beta v1.1.0

## Detección de add-ons instalados y diagnósticos de dependencias

- Oculta de la interfaz los add-ons que no están instalados cuando Codex trabaja con contenido instalado.
- Sustituye estados ambiguos como `Instalado: Unknown` por estados verificables: instalado, no instalado o no verificable cuando la API realmente no permite determinarlo.
- Usa los datos de presencia entregados por WATI Core para objetos, bloques, entidades y recetas en lugar de inferir la instalación únicamente por namespace.
- La portada muestra conteos correspondientes al contenido realmente instalado, mientras la sección Acerca de conserva también los totales completos del catálogo.
- Oculta recetas pertenecientes a add-ons ausentes para evitar resultados engañosos.
- Mantiene visibles las recetas de add-ons instalados aunque les falten ingredientes o resultados externos y añade un diagnóstico de dependencias faltantes.
- Agrupa los faltantes por add-on e indica el nombre localizado del contenido, su identifier y la fuente que debería proporcionarlo.
- Añade validaciones para símbolos de recetas con forma sin ingrediente definido, ingredientes incompatibles, recetas sin resultado resoluble, resultados ausentes y patrones mayores de 3×3.
- Los ingredientes definidos mediante tags se marcan como no verificables exactamente en lugar de presentarse como errores confirmados.
- Actualiza la dependencia a WATI Core Beta v2.1.1.
- Conserva UUID y compatibilidad con los datos existentes.


## v1.0.0 — Release

- Promotes the tested Beta v0.3.1 code to the first official WATI Codex release.
- Provides a craftable WATI Encyclopedia and `/wati:codex` backup command.
- Searches by localized name, identifier, namespace, source alias, and partial `@add-on` filters.
- Browses installed sources and unique inventory items.
- Displays source project, identifier, namespace, content type, category, installation state, recipes, exact uses, and acquisition methods.
- Shows shaped recipes as readable symbol grids and supports shapeless, furnace, brewing, and smithing recipes.
- Distinguishes normal crafting from reversible storage/unpacking conversions.
- Separates entities from craftable items and blocks and links related content that shares an identifier.
- Normalizes legacy vanilla variants so recipes such as colored carpet ingredients display the correct modern item.
- Uses acquisition metadata supplied by WATI Core v2.0.0.
- Uses original generic fallback icons and does not replace vanilla inventory or crafting interfaces.
- Includes Mexican Spanish and US English localization.

## Beta v0.3.1 — Final release candidate

- Added the final WATI Codex logo to both packs.
- Updated the dependency to the final Core release-candidate branch.
- Removed the last invalid localization warning from the tested bundle through the corresponding Core update.

## Beta v0.3.0

- Changed the default search to items and blocks while keeping entities as a separate filter.
- Prevented entity entries from showing recipes belonging to an item or block with the same identifier.
- Added navigation to related item or block entries.
- Normalized legacy vanilla variants based on numeric `data` values.
- Updated the Delight-family content and recipes.
- Moved acquisition data to WATI Core instead of duplicating it in Codex.

## Beta v0.2.0

- Added experimental acquisition pages with confirmed and probable methods.
- Added shaped-recipe symbol grids and legends.
- Added recipe validation for oversized patterns and missing exact references.
- Distinguished initial acquisition from reversible storage or unpacking recipes.

## Beta v0.1.1

- Added honest acquisition guidance for items without an initial crafting source.
- Detected reversible storage/unpacking cycles such as crops and their crates.
- Added acquisition notes to conversion recipes.

## Beta v0.1.0

- First playable Codex build.
- Added the craftable encyclopedia, command access, standard Bedrock forms, search, `@add-on` filters, source browser, inventory browser, entries, recipes, and exact uses.
- Added original generic category icons and initial Mexican Spanish / US English localization.
