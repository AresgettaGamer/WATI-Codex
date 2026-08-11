# WATI Codex v2.0.0

**Knowledge • Adventure • Exploration**

WATI Codex is the player-facing encyclopedia and journal for WATI Core. It can operate as a complete knowledge catalog, a knowledge + exploration companion, or a progressive personal adventure record.

## Requirements

- WATI Core BP and RP **v3.0.0** active in the same world.
- Stable `@minecraft/server` 2.8.0 and `@minecraft/server-ui` 2.1.0.

## Profiles

1. **Codex de Conocimiento** — complete available catalog information.
2. **Conocimiento y Exploración** — full knowledge plus exploration and locations.
3. **Tu Registro de Aventura** — progressive discoveries and partially hidden knowledge.

Profiles persist per player. Server policy can be managed through WATI's admin command without requiring cheats.

## Main features

- Search localized names, identifiers, namespaces and add-on aliases.
- Browse items, blocks, entities, biomes, ecosystems and structures.
- View recipes, exact uses and acquisition methods.
- Knowledge Schema 1 pages with descriptions, roles, drops, quantities, conditions, habitats, notable biome content, relations and construction patterns when known.
- Progressive item, block and entity discovery in Adventure mode.
- Block stages such as observed/manipulated/studied and entity stages such as found/engaged/studied.
- Biome and ecosystem visit records, recent routes and optimized exploration scanning.
- Personal/community locations, manual structure registration and duplicate checks.
- Orientation toward known coordinates without occupying WAWLA's action-bar display.
- Mexican Spanish and US English.
- Standard Bedrock forms for Classic and Pocket UI compatibility.

## Platform limitation

Automatic biome searching is intentionally disabled in the stable package because the needed search method is not exposed by the stable Script API used by WATI. Registered locations and manual/community orientation remain active. This is a future capability, not a Codex error.

## Official links

- [WATI Core](https://github.com/AresgettaGamer/WATI-Core)
- [WATI Core on CurseForge](https://www.curseforge.com/minecraft-bedrock/addons/wati-core)
- [WATI Catalog Builder](https://aresgettagamer.github.io/WATI-Catalog-Builder/)
- [Community Discord](https://discord.gg/U8WUnGCA97)
