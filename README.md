# WATI Codex v1.0.0

**Recipes • Uses • Origins**

WATI Codex is the player-facing encyclopedia for WATI Core. It helps players identify installed add-on content, learn how it is crafted, discover what it is used for, and review known acquisition methods without replacing Minecraft's inventory or crafting interfaces.

## Requirements

- WATI Core BP and RP **v2.0.0** active in the same world.
- Minecraft Bedrock compatible with `@minecraft/server` 2.8.0 and `@minecraft/server-ui` 2.1.0.

## Installation

Import and activate:

1. WATI Core BP and RP v2.0.0
2. WATI Codex BP and RP v1.0.0

Keep WATI Core above WATI Codex in the active pack list when practical.

## Opening the Codex

Craft and use the **WATI Encyclopedia**:

```text
P C P
P B P
P P P

P = Paper
C = Compass
B = Book
```

Backup command:

```text
/wati:codex
```

The command does not require cheats.

## Main features

- Search by localized name, identifier, namespace, or partial `@add-on` alias.
- Filter items, blocks, entities, installed content, or all registered content.
- Browse installed add-ons and unique items in the player's inventory.
- View identifiers, namespaces, source projects, categories, installation state, and related content.
- View shaped, shapeless, furnace, brewing, and smithing recipes.
- See exact ingredient uses and distinguish conversion/unpacking recipes from initial acquisition.
- Review known farming, mining, natural generation, entity-drop, trade, chest-loot, fishing, and other acquisition metadata supplied by WATI Core.
- Use Mexican Spanish or US English localization.
- Remain compatible with Classic and Pocket UI by using standard Bedrock forms.

## Known limits

- Fully scripted drops, interactions, machines, quests, and stations may require manual WATI provider metadata.
- Tag-based ingredient uses are shown inside recipes but are not expanded into every matching item in the exact-use count.
- Unsupported or newly updated add-ons can have missing or outdated metadata until WATI Core or an official provider is updated.
- Generic category icons are used when no compatible original icon is available; WATI Codex does not copy third-party textures.

See `CHANGELOG.md` and `NOTICE.md` for release history and third-party scope.
