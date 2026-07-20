# WATI Codex — Changelog

Versions below v1.0.0 were internal/public test betas. Major versions are official public releases.

## v1.0.0 — Official release

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
