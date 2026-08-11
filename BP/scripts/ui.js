import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { createCodexClient } from "./wati_client.js";
import { entryName, raw, sourceListName, sourceName, text, titleCase, translate } from "./messages.js";
import { CODEX_MODES, POLICY_MODES, hasSavedProfile, readProfile, readServerPolicy, resolveCodexMode, writeProfile, writeServerPolicy } from "./profile.js";
import {
  getDiscoveredEntries,
  getDiscoveryRecord,
  getDiscoverySummary,
  isBlockDiscovered,
  isEntityDiscovered,
  isItemDiscovered,
  syncInventoryDiscoveries
} from "./discovery.js";
import { getExplorationRoute, getExplorationSummary, getWorldDiscoveries, getWorldDiscoveryRecord, isWorldEntryDiscovered } from "./exploration.js";
import { showPlaceRegistry, showRegisterLinkedEntry } from "./places_ui.js";
import { orientToBiomeEntry, showOrientationMenu } from "./orientation.js";
import { vanillaSpanishAliases } from "./vanilla_es_mx_search.js";

const CODEX_ITEM = "wati_codex:codex";
const CODEX_VERSION = "2.0.0";
const PAGE_SIZE = 10;
const SOURCE_PAGE_SIZE = 10;
const RECIPE_PAGE_SIZE = 3;
const RECIPE_FETCH_SIZE = 5;
const MAX_ANALYZED_RECIPES = 50;
const client = createCodexClient("wati_codex");
const activeSessions = new Set();
const lastSearch = new Map();
const acquisitionCache = new Map();

const ICONS = Object.freeze({
  search: "textures/ui/wati_codex/search",
  addons: "textures/ui/wati_codex/addons",
  inventory: "textures/ui/wati_codex/inventory",
  info: "textures/ui/wati_codex/info",
  item: "textures/ui/wati_codex/item",
  block: "textures/ui/wati_codex/block",
  entity: "textures/ui/wati_codex/entity",
  biome: "textures/ui/wati_codex/info",
  ecosystem: "textures/ui/wati_codex/addons",
  structure: "textures/ui/wati_codex/station",
  tool: "textures/ui/wati_codex/tool",
  weapon: "textures/ui/wati_codex/weapon",
  armor: "textures/ui/wati_codex/armor",
  food: "textures/ui/wati_codex/food",
  station: "textures/ui/wati_codex/station",
  unknown: "textures/ui/wati_codex/unknown",
  recipe: "textures/ui/wati_codex/recipe",
  uses: "textures/ui/wati_codex/uses",
  previous: "textures/ui/wati_codex/previous",
  next: "textures/ui/wati_codex/next",
  back: "textures/ui/wati_codex/back",
  profile: "textures/items/wati_codex",
  knowledge: "textures/ui/wati_codex/info",
  exploration: "textures/ui/wati_codex/inventory",
  adventure: "textures/ui/wati_codex/inventory"
});

function kindLabel(kind) {
  return translate(`ui.wati_codex.kind.${kind || "unknown"}`);
}

function installationLabel(value) {
  return translate(value === true ? "ui.wati_codex.yes" : value === false ? "ui.wati_codex.no" : "ui.wati_codex.unverifiable");
}

function detectionLabel(value) {
  const method = String(value || "unknown").toLowerCase();
  const known = new Set(["core", "content", "namespace", "probe", "manual", "runtime", "unknown"]);
  return translate(`ui.wati_codex.detection_method.${known.has(method) ? method : "unknown"}`);
}

function splitIdentifier(typeId) {
  const index = String(typeId).indexOf(":");
  return index > 0 ? [typeId.slice(0, index), typeId.slice(index + 1)] : ["unknown", String(typeId)];
}

const UNSAFE_VANILLA_BLOCK_ICON_IDS = new Set([
  "water", "flowing_water", "lava", "flowing_lava", "fire", "soul_fire",
  "portal", "nether_portal", "end_portal", "end_gateway", "moving_block",
  "piston_arm_collision", "sticky_piston_arm_collision", "invisible_bedrock",
  "structure_void", "barrier", "light_block", "allow", "deny", "border_block"
]);

const KNOWN_WORLD_BIOME_TRANSLATIONS = new Set(["badlands","bamboo_jungle","bamboo_jungle_hills","basalt_deltas","beach","birch_forest","birch_forest_hills","birch_forest_hills_mutated","birch_forest_mutated","cherry_grove","cold_beach","cold_ocean","cold_taiga","cold_taiga_hills","cold_taiga_mutated","crimson_forest","dark_forest","deep_cold_ocean","deep_dark","deep_frozen_ocean","deep_lukewarm_ocean","deep_ocean","deep_warm_ocean","desert","desert_hills","desert_mutated","dripstone_caves","end_barrens","end_highlands","end_midlands","eroded_badlands","extreme_hills","extreme_hills_edge","extreme_hills_mutated","extreme_hills_plus_trees","extreme_hills_plus_trees_mutated","flower_forest","forest","forest_hills","frozen_ocean","frozen_peaks","frozen_river","grove","hell","ice_mountains","ice_plains","ice_plains_spikes","ice_spikes","jagged_peaks","jungle","jungle_edge","jungle_edge_mutated","jungle_hills","jungle_mutated","legacy_frozen_ocean","lukewarm_ocean","lush_caves","mangrove_swamp","meadow","mega_taiga","mega_taiga_hills","mesa","mesa_bryce","mesa_plateau","mesa_plateau_mutated","mesa_plateau_stone","mesa_plateau_stone_mutated","mushroom_fields","mushroom_island","mushroom_island_shore","nether_wastes","ocean","old_growth_birch_forest","old_growth_pine_taiga","old_growth_spruce_taiga","pale_garden","plains","redwood_taiga_hills_mutated","redwood_taiga_mutated","river","roofed_forest","roofed_forest_mutated","savanna","savanna_mutated","savanna_plateau","savanna_plateau_mutated","small_end_islands","snowy_beach","snowy_plains","snowy_slopes","snowy_taiga","soul_sand_valley","soulsand_valley","sparse_jungle","stone_beach","stony_peaks","stony_shore","sulfur_caves","sunflower_plains","swamp","swampland","swampland_mutated","taiga","taiga_hills","taiga_mutated","the_end","warm_ocean","warped_forest","windswept_forest","windswept_gravelly_hills","windswept_hills","windswept_savanna","wooded_badlands"]);
const WORLD_BIOME_ALIASES = Object.freeze({
  "minecraft:overworld": "overworld",
  "minecraft:nether": "nether",
  "minecraft:the_end": "the_end"
});

function worldBiomeName(value) {
  const rawValue = String(value || "").trim();
  const id = (WORLD_BIOME_ALIASES[rawValue] || rawValue.split(":").at(-1) || "unknown").toLowerCase();
  if (id === "overworld") return translate("ui.wati_codex.dimension.overworld");
  if (id === "nether") return translate("ui.wati_codex.dimension.nether");
  if (id === "the_end") return translate("ui.wati_codex.dimension.the_end");
  if (KNOWN_WORLD_BIOME_TRANSLATIONS.has(id)) return translate(`wati.world.biome.minecraft.${id}`);
  return text(titleCase(id));
}

function safeTexturePath(entry) {
  if (typeof entry?.itp !== "string" || !entry.itp.startsWith("textures/")) return undefined;
  if (entry?.k === "block") {
    const [namespace, identifier] = splitIdentifier(entry.i || "");
    if (namespace === "minecraft" && UNSAFE_VANILLA_BLOCK_ICON_IDS.has(identifier)) return undefined;
  }
  return entry.itp.replace(/\.png$/i, "");
}

function iconForEntry(entry) {
  const texture = safeTexturePath(entry);
  if (texture) return texture;
  if (entry?.k === "block") return ICONS.block;
  if (entry?.k === "entity") return ICONS.entity;
  if (entry?.k === "biome") return ICONS.biome;
  if (entry?.k === "ecosystem") return ICONS.ecosystem;
  if (entry?.k === "structure") return ICONS.structure;
  const haystack = `${entry?.cat || ""} ${entry?.grp || ""} ${entry?.i || ""}`.toLowerCase();
  if (/(food|meal|drink|stew|soup|bread|cake|apple|berry|meat|fish)/.test(haystack)) return ICONS.food;
  if (/(helmet|chestplate|leggings|boots|armor|armour)/.test(haystack)) return ICONS.armor;
  if (/(sword|dagger|gun|rifle|pistol|bow|crossbow|weapon|mace|spear)/.test(haystack)) return ICONS.weapon;
  if (/(pickaxe|shovel|hoe|axe|hammer|wrench|tool|drill)/.test(haystack)) return ICONS.tool;
  if (/(station|machine|table|furnace|oven|keg|pot|press|cutter)/.test(haystack)) return ICONS.station;
  return entry?.k === "item" ? ICONS.item : ICONS.unknown;
}

function entryButton(entry, suffix = undefined) {
  const pieces = [entryName(entry), "\n§8", sourceName(entry)];
  if (suffix) pieces.push(" §7· ", suffix);
  return raw(pieces);
}

async function showForm(player, form) {
  try {
    return await form.show(player);
  } catch (error) {
    try {
      player.sendMessage(raw([translate("ui.wati_codex.form_error"), text(` ${error}`)]));
    } catch {
      // Player may have disconnected.
    }
    return { canceled: true };
  }
}

async function showCoreMissing(player) {
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.title"))
    .body(translate("ui.wati_codex.core_missing"))
    .button(translate("ui.wati_codex.close"), ICONS.back);
  await showForm(player, form);
}

async function ensureCore(player) {
  try {
    const [capabilities, schema] = await Promise.all([client.capabilities(), client.schema()]);
    if (capabilities.schemaVersion !== 3 || schema?.schema?.version !== 3 || schema?.diagnostics?.ok === false) {
      await showCoreMissing(player);
      return undefined;
    }
    return capabilities;
  } catch {
    await showCoreMissing(player);
    return undefined;
  }
}

function modeLabel(mode) {
  const normalized = Object.values(CODEX_MODES).includes(mode) ? mode : CODEX_MODES.KNOWLEDGE;
  return translate(`ui.wati_codex.mode.${normalized}`);
}

function modeIcon(mode) {
  if (mode === CODEX_MODES.EXPLORATION) return ICONS.exploration;
  if (mode === CODEX_MODES.ADVENTURE) return ICONS.adventure;
  return ICONS.knowledge;
}

function isAdventureMode(player) {
  return resolveCodexMode(player).effectiveMode === CODEX_MODES.ADVENTURE;
}

function adventureNoticeKey(mode) {
  return mode === CODEX_MODES.EXPLORATION
    ? "ui.wati_codex.mode_exploration_active_notice"
    : "ui.wati_codex.mode_adventure_notice";
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9:_@-]+/g, " ")
    .trim();
}

function modeButton(mode, selected = false) {
  return raw([
    selected ? "§a✓ §f" : "",
    modeLabel(mode)
  ]);
}

function appendModeDescriptions(parts, includePlayerChoice = false) {
  if (includePlayerChoice) {
    parts.push(
      "\n\n§l", translate("ui.wati_codex.policy.player_choice"), "§r\n§8",
      translate("ui.wati_codex.policy.player_choice.short")
    );
  }
  for (const mode of Object.values(CODEX_MODES)) {
    parts.push(
      "\n\n§l", modeLabel(mode), "§r\n§8",
      translate(`ui.wati_codex.mode.${mode}.short`)
    );
  }
}

async function showWelcome(player, capabilities) {
  const state = resolveCodexMode(player);
  if (state.forced) {
    const form = new ActionFormData()
      .title(translate("ui.wati_codex.welcome_title"))
      .body(raw([
        translate("ui.wati_codex.welcome_intro"),
        "\n\n§l", translate("ui.wati_codex.server_policy"), "§r\n§f",
        modeLabel(state.effectiveMode),
        "\n§8", translate(`ui.wati_codex.mode.${state.effectiveMode}.description`),
        "\n\n§7", translate("ui.wati_codex.welcome_forced")
      ]))
      .button(translate("ui.wati_codex.continue"), modeIcon(state.effectiveMode));
    const response = await showForm(player, form);
    if (response.canceled) return false;
    writeProfile(player, { welcomeCompleted: true });
    if (state.effectiveMode === CODEX_MODES.ADVENTURE) {
      await syncInventoryDiscoveries(player, { method: "welcome_sync", notify: false });
    }
    return true;
  }

  const welcomeBody = [translate("ui.wati_codex.welcome_intro")];
  appendModeDescriptions(welcomeBody);
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.welcome_title"))
    .body(raw(welcomeBody));
  for (const mode of Object.values(CODEX_MODES)) form.button(modeButton(mode), modeIcon(mode));
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return false;
  const mode = Object.values(CODEX_MODES)[response.selection] || CODEX_MODES.KNOWLEDGE;
  writeProfile(player, { mode, welcomeCompleted: true });
  if (mode === CODEX_MODES.ADVENTURE) {
    await syncInventoryDiscoveries(player, { method: "welcome_sync", notify: false });
  }
  await showModeSelected(player, capabilities, mode, () => showHome(player, capabilities));
  return false;
}

async function showModeSelected(player, capabilities, mode, next) {
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.mode_selected_title"))
    .body(raw([
      "§l", modeLabel(mode), "§r\n\n",
      translate(`ui.wati_codex.mode.${mode}.description`),
      mode === CODEX_MODES.KNOWLEDGE ? undefined : raw(["\n\n§8", translate(adventureNoticeKey(mode))])
    ]))
    .button(translate("ui.wati_codex.continue"), modeIcon(mode));
  const response = await showForm(player, form);
  if (!response.canceled) await next();
}

export async function startCodex(player) {
  if (!player || activeSessions.has(player.id)) return;
  activeSessions.add(player.id);
  try {
    const capabilities = await ensureCore(player);
    if (!capabilities) return;
    const state = resolveCodexMode(player);
    if (!hasSavedProfile(player) || !state.profile.welcomeCompleted) {
      const completed = await showWelcome(player, capabilities);
      if (!completed) return;
    }
    if (resolveCodexMode(player).effectiveMode === CODEX_MODES.ADVENTURE) {
      await syncInventoryDiscoveries(player, { method: "open_sync", notify: false });
    }
    await showHome(player, capabilities);
  } finally {
    activeSessions.delete(player.id);
  }
}

async function showCatalogHub(player, capabilities) {
  const adventure = isAdventureMode(player);
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.hub_catalog"))
    .body(translate(adventure ? "ui.wati_codex.hub_catalog_desc_adventure" : "ui.wati_codex.hub_catalog_desc"));
  const actions = [];
  form.button(translate("ui.wati_codex.search"), ICONS.search);
  actions.push(() => showSearchForm(player, capabilities));
  form.button(translate(adventure ? "ui.wati_codex.discovery_browse" : "ui.wati_codex.browse_content"), ICONS.item);
  actions.push(() => showBrowseCategories(player, capabilities));
  form.button(translate("ui.wati_codex.browse_inventory"), ICONS.inventory);
  actions.push(() => showInventory(player, capabilities, 0));
  form.button(translate("ui.wati_codex.home"), ICONS.back);
  actions.push(() => showHome(player, capabilities));
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

async function showPersonalHub(player, capabilities) {
  const mode = resolveCodexMode(player).effectiveMode;
  const adventure = mode === CODEX_MODES.ADVENTURE;
  const explorationActive = mode === CODEX_MODES.EXPLORATION || adventure;
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.hub_register"))
    .body(translate(adventure
      ? "ui.wati_codex.hub_register_desc_adventure"
      : explorationActive
        ? "ui.wati_codex.hub_register_desc_exploration"
        : "ui.wati_codex.hub_register_desc_knowledge"));
  const actions = [];
  if (adventure) {
    form.button(translate("ui.wati_codex.discovery_browse"), ICONS.inventory);
    actions.push(() => showBrowseCategories(player, capabilities));
  }
  if (explorationActive) {
    form.button(translate("ui.wati_codex.exploration_registry"), ICONS.exploration);
    actions.push(() => showExplorationRegistry(player, capabilities));
  }
  form.button(translate("ui.wati_codex.browse_inventory"), ICONS.inventory);
  actions.push(() => showInventory(player, capabilities, 0));
  form.button(translate("ui.wati_codex.home"), ICONS.back);
  actions.push(() => showHome(player, capabilities));
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

async function showNavigationHub(player, capabilities) {
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.hub_navigation"))
    .body(translate("ui.wati_codex.hub_navigation_desc"));
  const actions = [];
  form.button(translate("ui.wati_codex.place_registry_title"), ICONS.exploration);
  actions.push(() => showPlaceRegistry(player, capabilities, {
    back: () => showNavigationHub(player, capabilities),
    openEntry: (kind, typeId, entryBack) => showEntry(player, capabilities, kind, typeId, entryBack)
  }));
  form.button(translate("ui.wati_codex.orientation_title"), ICONS.profile);
  actions.push(() => showOrientationMenu(player, () => showNavigationHub(player, capabilities)));
  form.button(translate("ui.wati_codex.exploration_route_title"), ICONS.exploration);
  actions.push(() => showRecentRoute(player, capabilities, () => showNavigationHub(player, capabilities)));
  form.button(translate("ui.wati_codex.home"), ICONS.back);
  actions.push(() => showHome(player, capabilities));
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

async function showSystemHub(player, capabilities) {
  const adventure = isAdventureMode(player);
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.hub_system"))
    .body(translate("ui.wati_codex.hub_system_desc"));
  const actions = [];
  form.button(translate(adventure ? "ui.wati_codex.discovery_sources" : "ui.wati_codex.browse_addons"), ICONS.addons);
  actions.push(() => showSources(player, capabilities, 0));
  form.button(translate("ui.wati_codex.profile_settings"), ICONS.profile);
  actions.push(() => showProfileSettings(player, capabilities));
  form.button(translate("ui.wati_codex.about"), ICONS.info);
  actions.push(() => showAbout(player, capabilities));
  form.button(translate("ui.wati_codex.home"), ICONS.back);
  actions.push(() => showHome(player, capabilities));
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

async function showHome(player, capabilities) {
  const modeState = resolveCodexMode(player);
  const mode = modeState.effectiveMode;
  const adventure = mode === CODEX_MODES.ADVENTURE;
  const explorationActive = mode === CODEX_MODES.EXPLORATION || adventure;
  const counts = capabilities.installedContentCounts || capabilities.contentCounts || {};
  const installedSources = capabilities.installedSourceCount ?? capabilities.sourceCount ?? 0;
  const installedRecipes = capabilities.installedRecipeCount ?? capabilities.recipeCount ?? 0;
  const hiddenSources = Math.max(0, (capabilities.sourceCount || 0) - installedSources);
  const discovery = adventure ? getDiscoverySummary(player) : undefined;
  const exploration = explorationActive ? getExplorationSummary(player) : undefined;
  const body = adventure
    ? raw([
      translate("ui.wati_codex.home_intro.adventure"),
      "\n\n§l", translate("ui.wati_codex.active_mode"), ": §r§f", modeLabel(mode),
      modeState.forced ? raw(["\n§8", translate("ui.wati_codex.mode_forced_note")]) : undefined,
      "\n§8", translate("ui.wati_codex.mode_adventure_notice"),
      "\n\n§l", translate("ui.wati_codex.discovery_progress"), "§r",
      "\n§7", translate("ui.wati_codex.discovery_items_known"), ": §f", text(String(discovery.itemCount || 0)),
      "\n§7", translate("ui.wati_codex.discovery_blocks_known"), ": §f", text(String(discovery.blockCount || 0)),
      "\n§7", translate("ui.wati_codex.discovery_entities_known"), ": §f", text(String(discovery.entityCount || 0)),
      "\n§7", translate("ui.wati_codex.exploration_biomes_known"), ": §f", text(String(exploration.biomeCount || 0)),
      "\n§7", translate("ui.wati_codex.exploration_ecosystems_known"), ": §f", text(String(exploration.ecosystemCount || 0)),
      "\n§7", translate("ui.wati_codex.exploration_structures_known"), ": §f", text(String(exploration.structureCount || 0)),
      discovery.lastEntryId ? raw(["\n§7", translate("ui.wati_codex.discovery_last"), ": §f", text(titleCase(splitIdentifier(discovery.lastEntryId)[1]))]) : undefined,
      "\n§7WATI Core ", text(capabilities.pack || "?")
    ])
    : raw([
      translate(`ui.wati_codex.home_intro.${mode}`),
      "\n\n§l", translate("ui.wati_codex.active_mode"), ": §r§f", modeLabel(mode),
      modeState.forced ? raw(["\n§8", translate("ui.wati_codex.mode_forced_note")]) : undefined,
      mode === CODEX_MODES.EXPLORATION ? raw(["\n§8", translate("ui.wati_codex.mode_exploration_active_notice")]) : undefined,
      explorationActive ? raw([
        "\n\n§l", translate("ui.wati_codex.exploration_progress"), "§r",
        "\n§7", translate("ui.wati_codex.exploration_biomes_known"), ": §f", text(String(exploration.biomeCount || 0)),
        "\n§7", translate("ui.wati_codex.exploration_ecosystems_known"), ": §f", text(String(exploration.ecosystemCount || 0)),
        "\n§7", translate("ui.wati_codex.exploration_structures_known"), ": §f", text(String(exploration.structureCount || 0))
      ]) : undefined,
      "\n\n§8", translate("ui.wati_codex.home_stats", [
        String((counts.item || 0) + (counts.block || 0) + (counts.entity || 0) + (counts.biome || 0) + (counts.ecosystem || 0) + (counts.structure || 0)),
        String(installedRecipes), String(installedSources)
      ]),
      hiddenSources > 0 ? raw(["\n§7", translate("ui.wati_codex.hidden_sources", [String(hiddenSources)])]) : undefined,
      "\n§7WATI Core ", text(capabilities.pack || "?")
    ]);
  const form = new ActionFormData().title(translate("ui.wati_codex.title")).body(raw([
    body,
    "\n\n§l", translate("ui.wati_codex.home_sections"), "§r",
    "\n§b• §f", translate("ui.wati_codex.hub_catalog"), " §8— ", translate("ui.wati_codex.hub_catalog_short"),
    explorationActive ? raw(["\n§b• §f", translate("ui.wati_codex.hub_register"), " §8— ", translate("ui.wati_codex.hub_register_short")]) : undefined,
    explorationActive ? raw(["\n§b• §f", translate("ui.wati_codex.hub_navigation"), " §8— ", translate("ui.wati_codex.hub_navigation_short")]) : undefined,
    "\n§b• §f", translate("ui.wati_codex.hub_system"), " §8— ", translate("ui.wati_codex.hub_system_short")
  ]));
  const actions = [];
  form.button(translate("ui.wati_codex.hub_catalog"), ICONS.search);
  actions.push(() => showCatalogHub(player, capabilities));
  if (explorationActive) {
    form.button(translate("ui.wati_codex.hub_register"), ICONS.inventory);
    actions.push(() => showPersonalHub(player, capabilities));
    form.button(translate("ui.wati_codex.hub_navigation"), ICONS.exploration);
    actions.push(() => showNavigationHub(player, capabilities));
  }
  form.button(translate("ui.wati_codex.hub_system"), ICONS.addons);
  actions.push(() => showSystemHub(player, capabilities));
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection]; if (action) await action();
}


function filteredDiscoveryRecords(player, query = "", sourceId = undefined, kind = undefined) {
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  return getDiscoveredEntries(player).filter(record => {
    if (sourceId && record.sourceId !== sourceId) return false;
    if ((kind === "item" || kind === "block" || kind === "entity") && record.kind !== kind) return false;
    if (!tokens.length) return true;
    const vanillaAliases = record.sourceId === "minecraft"
      ? vanillaSpanishAliases(record.kind, record.typeId).join(" ")
      : "";
    const haystack = normalizeSearchText(`${record.searchText || ""} ${record.typeId} ${record.sourceId} ${record.kind} ${vanillaAliases}`);
    return tokens.every(token => haystack.includes(token));
  });
}

async function enrichDiscoveryRows(rows) {
  return Promise.all(rows.map(async record => {
    try {
      const entry = await client.entry(record.kind, record.typeId);
      return { record, entry };
    } catch {
      return {
        record,
        entry: {
          k: record.kind,
          i: record.typeId,
          d: titleCase(splitIdentifier(record.typeId)[1]),
          a: titleCase(record.sourceId)
        }
      };
    }
  }));
}

async function showAdventureDiscoveries(player, capabilities, state = {}) {
  if (["biome", "ecosystem", "structure"].includes(state.kind)) {
    await showWorldDiscoveries(player, capabilities, state.kind, state.page || 0, state.back || (() => showHome(player, capabilities)), state.query || "");
    return;
  }
  const query = String(state.query || "").trim();
  const sourceId = state.sourceId || (query.startsWith("@") ? query.slice(1).trim() : undefined);
  const visibleQuery = query.startsWith("@") ? "" : query;
  const page = Math.max(0, Number(state.page) || 0);
  const records = filteredDiscoveryRecords(player, visibleQuery, sourceId, state.kind);
  const start = page * PAGE_SIZE;
  const rows = await enrichDiscoveryRows(records.slice(start, start + PAGE_SIZE));
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.discovery_title"))
    .body(raw([
      sourceId ? raw([translate("ui.wati_codex.discovery_source_filter"), ": §f", text(titleCase(sourceId))])
        : visibleQuery ? translate("ui.wati_codex.results_for", [visibleQuery])
          : translate("ui.wati_codex.discovery_intro"),
      "\n§8", translate("ui.wati_codex.discovery_result_count", [String(records.length)]),
      "\n§7", translate("ui.wati_codex.page", [String(page + 1)])
    ]));
  const actions = [];
  for (const row of rows) {
    form.button(entryButton(row.entry, translate("ui.wati_codex.discovery_known")), iconForEntry(row.entry));
    actions.push(() => showEntry(player, capabilities, row.record.kind, row.record.typeId, () => showAdventureDiscoveries(player, capabilities, state)));
  }
  if (!rows.length) {
    form.body(raw([
      sourceId ? raw([translate("ui.wati_codex.discovery_source_filter"), ": §f", text(titleCase(sourceId))])
        : visibleQuery ? translate("ui.wati_codex.results_for", [visibleQuery])
          : translate("ui.wati_codex.discovery_intro"),
      "\n\n§8", translate("ui.wati_codex.discovery_empty")
    ]));
  }
  if (page > 0) {
    form.button(translate("ui.wati_codex.previous"), ICONS.previous);
    actions.push(() => showAdventureDiscoveries(player, capabilities, { ...state, page: page - 1 }));
  }
  if (start + rows.length < records.length) {
    form.button(translate("ui.wati_codex.next"), ICONS.next);
    actions.push(() => showAdventureDiscoveries(player, capabilities, { ...state, page: page + 1 }));
  }
  form.button(translate("ui.wati_codex.new_search"), ICONS.search);
  actions.push(() => showAdventureSearchForm(player, capabilities));
  form.button(translate(state.back ? "ui.wati_codex.back" : "ui.wati_codex.home"), ICONS.back);
  actions.push(state.back || (() => showHome(player, capabilities)));
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

async function showAdventureSearchForm(player, capabilities) {
  const previous = lastSearch.get(player.id) || { query: "" };
  const form = new ModalFormData()
    .title(translate("ui.wati_codex.discovery_search_title"))
    .textField(translate("ui.wati_codex.search_query"), translate("ui.wati_codex.discovery_search_placeholder"), { defaultValue: previous.query || "" })
    .dropdown(translate("ui.wati_codex.search_kind"), [
      translate("ui.wati_codex.kind.all"),
      translate("ui.wati_codex.kind.item"),
      translate("ui.wati_codex.kind.block"),
      translate("ui.wati_codex.kind.entity"),
      translate("ui.wati_codex.kind.biome"),
      translate("ui.wati_codex.kind.ecosystem"),
      translate("ui.wati_codex.kind.structure")
    ], { defaultValueIndex: previous.kindIndex || 0 })
    .submitButton(translate("ui.wati_codex.search_button"));
  const response = await showForm(player, form);
  if (response.canceled || !Array.isArray(response.formValues)) {
    await showHome(player, capabilities);
    return;
  }
  const query = String(response.formValues[0] || "").trim();
  const kindIndex = Number(response.formValues[1] || 0);
  const kinds = [undefined, "item", "block", "entity", "biome", "ecosystem", "structure"];
  lastSearch.set(player.id, { query, kindIndex, adventure: true });
  await showAdventureDiscoveries(player, capabilities, { query, kind: kinds[kindIndex], page: 0 });
}

async function showAdventureSources(player, capabilities, page = 0) {
  const records = getDiscoveredEntries(player);
  const groups = new Map();
  for (const record of records) {
    const group = groups.get(record.sourceId) || [];
    group.push(record);
    groups.set(record.sourceId, group);
  }
  const sourceRows = [...groups.entries()]
    .map(([sourceId, items]) => ({ sourceId, items, latest: Math.max(...items.map(item => item.discoveredAt || 0)) }))
    .sort((left, right) => right.latest - left.latest || left.sourceId.localeCompare(right.sourceId));
  const start = page * SOURCE_PAGE_SIZE;
  const pageRows = sourceRows.slice(start, start + SOURCE_PAGE_SIZE);
  const enriched = await Promise.all(pageRows.map(async row => {
    const [sample] = await enrichDiscoveryRows(row.items.slice(0, 1));
    return { ...row, sample: sample?.entry };
  }));
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.discovery_sources_title"))
    .body(raw([
      translate("ui.wati_codex.discovery_sources_intro"),
      "\n§8", translate("ui.wati_codex.result_count", [String(sourceRows.length)]),
      "\n§7", translate("ui.wati_codex.page", [String(page + 1)])
    ]));
  const actions = [];
  for (const row of enriched) {
    form.button(raw([
      row.sample ? sourceName(row.sample) : text(titleCase(row.sourceId)),
      "\n§8", translate("ui.wati_codex.discovery_source_count", [String(row.items.length)])
    ]), ICONS.addons);
    actions.push(() => showAdventureDiscoveries(player, capabilities, {
      sourceId: row.sourceId,
      page: 0,
      back: () => showAdventureSources(player, capabilities, page)
    }));
  }
  if (page > 0) {
    form.button(translate("ui.wati_codex.previous"), ICONS.previous);
    actions.push(() => showAdventureSources(player, capabilities, page - 1));
  }
  if (start + pageRows.length < sourceRows.length) {
    form.button(translate("ui.wati_codex.next"), ICONS.next);
    actions.push(() => showAdventureSources(player, capabilities, page + 1));
  }
  form.button(translate("ui.wati_codex.home"), ICONS.back);
  actions.push(() => showHome(player, capabilities));
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

async function enrichWorldRows(rows) {
  return Promise.all(rows.map(async record => {
    try { return { record, entry: await client.entry(record.kind, record.typeId) }; }
    catch { return { record, entry: { k: record.kind, i: record.typeId, d: titleCase(splitIdentifier(record.typeId)[1]), a: titleCase(record.sourceId) } }; }
  }));
}

async function showWorldDiscoveries(player, capabilities, kind, page = 0, back = () => showExplorationRegistry(player, capabilities), query = "") {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const enrichedRows = await enrichWorldRows(getWorldDiscoveries(player, kind));
  const rows = normalizedQuery
    ? enrichedRows.filter(({ entry, record }) => {
        const haystack = [
          entry?.i, entry?.x, entry?.d, entry?.a, ...(Array.isArray(entry?.al) ? entry.al : []), record?.typeId, record?.sourceId
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : enrichedRows;
  const start = page * PAGE_SIZE;
  const visible = rows.slice(start, start + PAGE_SIZE);
  const form = new ActionFormData().title(translate(`ui.wati_codex.exploration_${kind}_title`)).body(raw([
    normalizedQuery
      ? translate("ui.wati_codex.results_for", [String(query)])
      : translate(`ui.wati_codex.exploration_${kind}_intro`),
    "\n§8", translate("ui.wati_codex.discovery_result_count", [String(rows.length)]),
    "\n§7", translate("ui.wati_codex.page", [String(page + 1)])
  ]));
  const actions=[];
  for (const {record,entry} of visible) {
    form.button(entryButton(entry, translate("ui.wati_codex.exploration_visits", [String(record.visits || 1)])), iconForEntry(entry));
    actions.push(() => showEntry(player, capabilities, kind, record.typeId, () => showWorldDiscoveries(player, capabilities, kind, page, back, query)));
  }
  if (page>0) { form.button(translate("ui.wati_codex.previous"),ICONS.previous); actions.push(()=>showWorldDiscoveries(player,capabilities,kind,page-1,back,query)); }
  if (start+visible.length<rows.length) { form.button(translate("ui.wati_codex.next"),ICONS.next); actions.push(()=>showWorldDiscoveries(player,capabilities,kind,page+1,back,query)); }
  if (normalizedQuery) { form.button(translate("ui.wati_codex.new_search"), ICONS.search); actions.push(()=>showAdventureSearchForm(player, capabilities)); }
  form.button(translate("ui.wati_codex.back"),ICONS.back); actions.push(back);
  const response=await showForm(player,form); if(response.canceled||response.selection===undefined)return; const action=actions[response.selection]; if(action)await action();
}

async function showRecentRoute(player, capabilities, back) {
  const route=getExplorationRoute(player).slice(0,20);
  const enriched = await Promise.all(route.map(async row => {
    try { return { row, entry: await client.entry(row[0], row[1]) }; }
    catch { return { row, entry: { i: row[1], d: titleCase(splitIdentifier(row[1])[1]) } }; }
  }));
  const parts=[translate("ui.wati_codex.exploration_route_intro")];
  if (!enriched.length) parts.push("\n\n§8",translate("ui.wati_codex.exploration_route_empty"));
  for (const {row,entry} of enriched) parts.push("\n\n§b• §f",kindLabel(row[0]),": §a",entryName(entry),"\n§8",dimensionLabel(row[2]),text(` · X ${row[3]}, Y ${row[4]}, Z ${row[5]}`));
  const form=new ActionFormData().title(translate("ui.wati_codex.exploration_route_title")).body(raw(parts)).button(translate("ui.wati_codex.back"),ICONS.back);
  const response=await showForm(player,form); if(!response.canceled)await back();
}

async function showExplorationRegistry(player, capabilities) {
  const summary = getExplorationSummary(player);
  const form = new ActionFormData().title(translate("ui.wati_codex.exploration_registry")).body(raw([
    translate("ui.wati_codex.exploration_registry_intro_compact"),
    "\n\n§7", translate("ui.wati_codex.exploration_biomes_known"), ": §f", text(String(summary.biomeCount || 0)),
    "\n§7", translate("ui.wati_codex.exploration_ecosystems_known"), ": §f", text(String(summary.ecosystemCount || 0)),
    "\n§7", translate("ui.wati_codex.exploration_structures_known"), ": §f", text(String(summary.structureCount || 0))
  ]));
  const actions = [];
  form.button(translate("ui.wati_codex.kind.biome"), ICONS.biome);
  actions.push(() => showWorldDiscoveries(player, capabilities, "biome", 0, () => showExplorationRegistry(player, capabilities)));
  form.button(translate("ui.wati_codex.kind.ecosystem"), ICONS.ecosystem);
  actions.push(() => showWorldDiscoveries(player, capabilities, "ecosystem", 0, () => showExplorationRegistry(player, capabilities)));
  form.button(translate("ui.wati_codex.kind.structure"), ICONS.structure);
  actions.push(() => showWorldDiscoveries(player, capabilities, "structure", 0, () => showExplorationRegistry(player, capabilities)));
  form.button(translate("ui.wati_codex.back"), ICONS.back);
  actions.push(() => showPersonalHub(player, capabilities));
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

async function showBrowseCategories(player, capabilities) {
  if (isAdventureMode(player)) {
    const form = new ActionFormData().title(translate("ui.wati_codex.discovery_title")).body(translate("ui.wati_codex.discovery_intro"));
    const options=[[undefined,"all",ICONS.inventory],["item","item",ICONS.item],["block","block",ICONS.block],["entity","entity",ICONS.entity],["biome","biome",ICONS.biome],["ecosystem","ecosystem",ICONS.ecosystem],["structure","structure",ICONS.structure]];
    for (const [,label,icon] of options) form.button(translate(`ui.wati_codex.kind.${label}`),icon);
    form.button(translate("ui.wati_codex.back"),ICONS.back);
    const response=await showForm(player,form);
    if(response.canceled||response.selection===undefined||response.selection===options.length){await showHome(player,capabilities);return;}
    const kind=options[response.selection][0];
    if(kind==="biome"||kind==="ecosystem"||kind==="structure") await showWorldDiscoveries(player,capabilities,kind,0,()=>showBrowseCategories(player,capabilities));
    else await showAdventureDiscoveries(player,capabilities,{kind,page:0,back:()=>showBrowseCategories(player,capabilities)});
    return;
  }
  const options=[[undefined,"all",ICONS.inventory],["content","content",ICONS.item],["item","item",ICONS.item],["block","block",ICONS.block],["entity","entity",ICONS.entity],["biome","biome",ICONS.biome],["ecosystem","ecosystem",ICONS.ecosystem],["structure","structure",ICONS.structure]];
  const form=new ActionFormData().title(translate("ui.wati_codex.browse_content_title")).body(translate("ui.wati_codex.browse_content_intro"));
  for(const [,label,icon] of options)form.button(translate(`ui.wati_codex.kind.${label}`),icon);
  form.button(translate("ui.wati_codex.home"),ICONS.back);
  const response=await showForm(player,form); if(response.canceled||response.selection===undefined)return;
  if(response.selection<options.length) await showSearchResults(player,capabilities,{query:"",kind:options[response.selection][0],installedOnly:true,page:0,back:()=>showBrowseCategories(player,capabilities)});
  else await showHome(player,capabilities);
}

async function showSourceDetails(player, capabilities, source, back) {
  const installed=source.installedContentCounts||{}; const catalog=source.contentCounts||{}; const detection=source.detection||{};
  const worldTotal=(catalog.biome||0)+(catalog.ecosystem||0)+(catalog.structure||0);
  const body=raw([sourceListName(source),source.version?raw(["\n§8",translate("ui.wati_codex.source_version"),": §7",text(source.version)]):undefined,
    "\n\n§l",translate("ui.wati_codex.installed_content"),"§r",
    "\n§7",translate("ui.wati_codex.items"),": §f",text(String(installed.item||0)),"\n§7",translate("ui.wati_codex.blocks"),": §f",text(String(installed.block||0)),"\n§7",translate("ui.wati_codex.entities"),": §f",text(String(installed.entity||0)),
    "\n§7",translate("ui.wati_codex.biomes"),": §f",text(String(installed.biome||0)),"\n§7",translate("ui.wati_codex.ecosystems"),": §f",text(String(installed.ecosystem||0)),"\n§7",translate("ui.wati_codex.structures"),": §f",text(String(installed.structure||0)),
    "\n§7",translate("ui.wati_codex.recipes"),": §f",text(String(source.installedRecipeCount||0)),
    "\n\n§l",translate("ui.wati_codex.catalog_totals"),"§r",
    "\n§7",translate("ui.wati_codex.items"),": §f",text(String(catalog.item||0)),"\n§7",translate("ui.wati_codex.blocks"),": §f",text(String(catalog.block||0)),"\n§7",translate("ui.wati_codex.entities"),": §f",text(String(catalog.entity||0)),
    worldTotal?raw(["\n§7",translate("ui.wati_codex.world_entries"),": §f",text(String(worldTotal))]):undefined,
    "\n§7",translate("ui.wati_codex.recipes"),": §f",text(String(source.recipeCount||0)),
    "\n\n§8",translate("ui.wati_codex.source_detection"),": §7",detectionLabel(detection.mode||detection.method||source.detectionConfig?.mode||"unknown"),source.runtimeGenerated?raw(["\n§8",translate("ui.wati_codex.runtime_catalog_note")]):undefined]);
  const options=[[undefined,"source_all_content",ICONS.inventory],["content","content",ICONS.item],["item","item",ICONS.item],["block","block",ICONS.block],["entity","entity",ICONS.entity],["biome","biome",ICONS.biome],["ecosystem","ecosystem",ICONS.ecosystem],["structure","structure",ICONS.structure]];
  const form=new ActionFormData().title(translate("ui.wati_codex.source_title")).body(body); const actions=[];
  for(const [kind,label,icon] of options){form.button(translate(label==="source_all_content"?"ui.wati_codex.source_all_content":`ui.wati_codex.kind.${label}`),icon);actions.push(()=>showSearchResults(player,capabilities,{query:`@${source.id}`,kind,installedOnly:true,page:0,back:()=>showSourceDetails(player,capabilities,source,back)}));}
  form.button(translate("ui.wati_codex.back"),ICONS.back);actions.push(back);
  const response=await showForm(player,form);if(response.canceled||response.selection===undefined)return;const action=actions[response.selection];if(action)await action();
}

async function showSearchForm(player, capabilities) {
  if (isAdventureMode(player)) {
    await showAdventureSearchForm(player, capabilities);
    return;
  }
  const previous = lastSearch.get(player.id) || { query: "", kindIndex: 0, installedOnly: true };
  const form = new ModalFormData()
    .title(translate("ui.wati_codex.search_title"))
    .textField(translate("ui.wati_codex.search_query"), translate("ui.wati_codex.search_placeholder"), { defaultValue: previous.query })
    .dropdown(translate("ui.wati_codex.search_kind"), [
      translate("ui.wati_codex.kind.all"),
      translate("ui.wati_codex.kind.content"),
      translate("ui.wati_codex.kind.item"),
      translate("ui.wati_codex.kind.block"),
      translate("ui.wati_codex.kind.entity"),
      translate("ui.wati_codex.kind.biome"),
      translate("ui.wati_codex.kind.ecosystem"),
      translate("ui.wati_codex.kind.structure")
    ], { defaultValueIndex: previous.kindIndex })
    .toggle(translate("ui.wati_codex.installed_only"), { defaultValue: previous.installedOnly })
    .submitButton(translate("ui.wati_codex.search_button"));
  const response = await showForm(player, form);
  if (response.canceled || !Array.isArray(response.formValues)) {
    await showHome(player, capabilities);
    return;
  }
  const query = String(response.formValues[0] || "").trim();
  const kindIndex = Number(response.formValues[1] || 0);
  const installedOnly = response.formValues[2] === true;
  const kinds = [undefined, "content", "item", "block", "entity", "biome", "ecosystem", "structure"];
  const state = { query, kind: kinds[kindIndex], kindIndex, installedOnly, page: 0 };
  lastSearch.set(player.id, state);
  await showSearchResults(player, capabilities, state);
}

async function showSearchResults(player, capabilities, state) {
  if (isAdventureMode(player)) {
    await showAdventureDiscoveries(player, capabilities, state);
    return;
  }
  let result;
  try {
    result = await client.search({
      query: state.query,
      kind: state.kind,
      installedOnly: state.installedOnly,
      page: state.page,
      pageSize: PAGE_SIZE
    });
  } catch {
    await showCoreMissing(player);
    return;
  }
  const resultHeading = state.query
    ? translate("ui.wati_codex.results_for", [String(state.query)])
    : translate("ui.wati_codex.results_all");
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.results_title"))
    .body(raw([
      resultHeading,
      "\n§8", translate("ui.wati_codex.result_count", [String(result.total || 0)]),
      "\n§7", translate("ui.wati_codex.page", [String((result.p || 0) + 1)])
    ]));
  const actions = [];
  for (const entry of result.items || []) {
    form.button(entryButton(entry), iconForEntry(entry));
    actions.push(() => showEntry(player, capabilities, entry.k, entry.i, () => showSearchResults(player, capabilities, state)));
  }
  if ((result.p || 0) > 0) {
    form.button(translate("ui.wati_codex.previous"), ICONS.previous);
    actions.push(() => showSearchResults(player, capabilities, { ...state, page: state.page - 1 }));
  }
  if (result.more) {
    form.button(translate("ui.wati_codex.next"), ICONS.next);
    actions.push(() => showSearchResults(player, capabilities, { ...state, page: state.page + 1 }));
  }
  form.button(translate("ui.wati_codex.new_search"), ICONS.search);
  actions.push(() => showSearchForm(player, capabilities));
  form.button(translate(state.back ? "ui.wati_codex.back" : "ui.wati_codex.home"), ICONS.back);
  actions.push(state.back || (() => showHome(player, capabilities)));
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

async function showSources(player, capabilities, page) {
  if (isAdventureMode(player)) {
    await showAdventureSources(player, capabilities, page);
    return;
  }
  let result;
  try {
    result = await client.sources({ page, pageSize: SOURCE_PAGE_SIZE, installedOnly: true });
  } catch {
    await showCoreMissing(player);
    return;
  }
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.addons_title"))
    .body(raw([
      translate("ui.wati_codex.addons_intro"),
      "\n§8", translate("ui.wati_codex.result_count", [String(result.total || 0)]),
      "\n§7", translate("ui.wati_codex.page", [String((result.p || 0) + 1)])
    ]));
  const actions = [];
  for (const source of result.items || []) {
    const counts = source.contentCounts || {};
    form.button(raw([
      sourceListName(source),
      "\n§8", translate("ui.wati_codex.source_counts", [
        String(counts.item || 0), String(counts.block || 0), String(counts.entity || 0), String(source.recipeCount || 0)
      ])
    ]), ICONS.addons);
    actions.push(() => showSourceDetails(player, capabilities, source, () => showSources(player, capabilities, page)));
  }
  if (page > 0) {
    form.button(translate("ui.wati_codex.previous"), ICONS.previous);
    actions.push(() => showSources(player, capabilities, page - 1));
  }
  if (result.more) {
    form.button(translate("ui.wati_codex.next"), ICONS.next);
    actions.push(() => showSources(player, capabilities, page + 1));
  }
  form.button(translate("ui.wati_codex.home"), ICONS.back);
  actions.push(() => showHome(player, capabilities));
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

function inventoryRows(player) {
  try {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return [];
    const counts = new Map();
    for (let slot = 0; slot < inventory.size; slot++) {
      const stack = inventory.getItem(slot);
      if (!stack || stack.typeId === CODEX_ITEM) continue;
      counts.set(stack.typeId, (counts.get(stack.typeId) || 0) + stack.amount);
    }
    return [...counts.entries()].map(([typeId, amount]) => ({ typeId, amount }));
  } catch {
    return [];
  }
}

async function showInventory(player, capabilities, page) {
  if (isAdventureMode(player)) await syncInventoryDiscoveries(player, { method: "inventory_view", notify: false });
  const rows = inventoryRows(player);
  const enriched = await Promise.all(rows.map(async row => {
    try {
      return { ...row, entry: await client.entry("item", row.typeId) };
    } catch {
      return { ...row, entry: { k: "item", i: row.typeId, d: titleCase(splitIdentifier(row.typeId)[1]), a: titleCase(splitIdentifier(row.typeId)[0]) } };
    }
  }));
  enriched.sort((a, b) => String(a.entry.x || a.entry.d || a.typeId).localeCompare(String(b.entry.x || b.entry.d || b.typeId)));
  const start = page * PAGE_SIZE;
  const pageRows = enriched.slice(start, start + PAGE_SIZE);
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.inventory_title"))
    .body(raw([
      translate("ui.wati_codex.inventory_intro"),
      "\n§8", translate("ui.wati_codex.inventory_count", [String(enriched.length)]),
      "\n§7", translate("ui.wati_codex.page", [String(page + 1)])
    ]));
  const actions = [];
  for (const row of pageRows) {
    form.button(entryButton(row.entry, translate("ui.wati_codex.amount", [String(row.amount)])), iconForEntry(row.entry));
    actions.push(() => showEntry(player, capabilities, "item", row.typeId, () => showInventory(player, capabilities, page)));
  }
  if (page > 0) {
    form.button(translate("ui.wati_codex.previous"), ICONS.previous);
    actions.push(() => showInventory(player, capabilities, page - 1));
  }
  if (start + pageRows.length < enriched.length) {
    form.button(translate("ui.wati_codex.next"), ICONS.next);
    actions.push(() => showInventory(player, capabilities, page + 1));
  }
  form.button(translate("ui.wati_codex.home"), ICONS.back);
  actions.push(() => showHome(player, capabilities));
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}


function supportsKnowledge(capabilities) {
  return Number(capabilities?.capabilities?.knowledge || 0) >= 1;
}

function knowledgeSummary(profile) {
  if (typeof profile?.summaryKey === "string") return translate(profile.summaryKey);
  const code = typeof profile?.summaryCode === "string" ? profile.summaryCode : "unknown";
  return translate(`ui.wati_codex.knowledge_summary.${code}`);
}

function knowledgeRole(value) {
  const known = new Set([
    "item", "placeable_block", "entity", "biome", "ecosystem", "structure", "weapon", "tool", "armor", "food",
    "cultivation", "storage", "crafting_station", "redstone", "material", "building", "transport", "spawn_item",
    "boss", "container", "oxidizable", "utility_mob", "sorting", "constructible", "decorative", "hostile", "summoned",
    "rare_drop", "construction_part", "wearable", "defender", "utility_block", "area_effect", "progression", "underwater",
    "nether", "respawn", "enchanting", "automation", "smelting", "farming", "villager_job", "personal_storage",
    "special_mechanic"
  ]);
  const key = known.has(value) ? value : "other";
  return translate(`ui.wati_codex.knowledge_role.${key}`);
}

function knowledgeRarity(value) {
  const known = new Set(["guaranteed", "common", "uncommon", "rare", "conditional", "random", "boss", "inferred", "unknown"]);
  return translate(`ui.wati_codex.knowledge_rarity.${known.has(value) ? value : "unknown"}`);
}

function knowledgeRelation(value) {
  const known = new Set([
    "related", "variant", "specialized_storage", "automation", "takes_items_from", "sorts_items_into", "oxidizes_into",
    "golem_family", "construction_part", "crafting_material", "unique_drop", "progression", "dropped_by", "summons",
    "summoning", "power_source", "fuel", "charges_with", "base", "origin", "result", "same_identifier", "signature",
    "notable", "mineable", "naturally_generated", "obtainable", "spawns", "structure", "constructed", "summoned",
    "dark_overworld", "underground_region", "village_or_constructed", "desert_village", "igloo", "witch_hut"
  ]);
  return translate(`ui.wati_codex.knowledge_relation.${known.has(value) ? value : "related"}`);
}

function knowledgeCondition(value) {
  if (!value) return undefined;
  const known = new Set([
    "carried_equipment", "holding_item", "equipment", "killed_by_skeleton", "killed_by_player", "slowness_arrow",
    "size_and_looting", "small_slime", "drinking", "first_defeat"
  ]);
  if (known.has(value)) return translate(`ui.wati_codex.knowledge_condition.${value}`);
  if (String(value).startsWith("query.")) return translate("ui.wati_codex.knowledge_condition.block_state");
  return translate("ui.wati_codex.knowledge_condition.special");
}

function knowledgeQuantity(value) {
  if (!value || typeof value !== "object") return undefined;
  const minimum = Number(value.min);
  const maximum = Number(value.max);
  if (!Number.isFinite(minimum) && !Number.isFinite(maximum)) return undefined;
  const min = Number.isFinite(minimum) ? minimum : maximum;
  const max = Number.isFinite(maximum) ? maximum : minimum;
  if (min === max) return translate("ui.wati_codex.knowledge_quantity_exact", [String(min)]);
  return translate("ui.wati_codex.knowledge_quantity_range", [String(min), String(max)]);
}

function conceptName(typeId) {
  const concepts = new Map([
    ["minecraft:equipment", "equipment"],
    ["minecraft:experience", "experience"],
    ["minecraft:music_disc", "music_disc"],
    ["minecraft:potion", "potion"],
    ["minecraft:player_construction", "player_construction"],
    ["minecraft:player_summoning", "player_summoning"],
    ["minecraft:slime_chunk", "slime_chunk"],
    ["minecraft:nether_fortress", "nether_fortress"],
    ["minecraft:ocean_monument", "ocean_monument"],
    ["minecraft:trial_chambers", "trial_chambers"],
    ["minecraft:village", "village"],
    ["minecraft:overworld", "overworld"]
  ]);
  const key = concepts.get(typeId);
  return key ? translate(`ui.wati_codex.knowledge_concept.${key}`) : undefined;
}

function knowledgeReferenceDiscovered(player, kind, typeId) {
  if (kind === "item") return isItemDiscovered(player, typeId);
  if (kind === "block") return isBlockDiscovered(player, typeId);
  if (kind === "entity") return isEntityDiscovered(player, typeId);
  if (["biome", "ecosystem", "structure"].includes(kind)) return isWorldEntryDiscovered(player, kind, typeId);
  return false;
}

async function resolveKnowledgeEntry(kind, typeId) {
  if (conceptName(typeId)) return undefined;
  if (!["item", "block", "entity", "biome", "ecosystem", "structure"].includes(kind)) return undefined;
  try { return await client.entry(kind, typeId); }
  catch { return undefined; }
}

function knowledgeReferenceName(reference, resolved, hidden = false) {
  if (hidden) return translate("ui.wati_codex.knowledge_unknown_entry");
  const concept = conceptName(reference?.id);
  if (concept) return concept;
  return resolved ? entryName(resolved) : text(titleCase(String(reference?.id || "unknown").split(":").at(-1)));
}

function adventureCanRevealDrop(player, ownerEntry, drop) {
  if (!isAdventureMode(player)) return true;
  if (knowledgeReferenceDiscovered(player, drop.kind || "item", drop.id)) return true;
  const record = getDiscoveryRecord(player, ownerEntry.k, ownerEntry.i);
  if (record?.stage >= 3 && ["guaranteed", "common"].includes(drop.rarity)) return true;
  return false;
}

function adventureCanRevealWorldContent(player, reference) {
  if (!isAdventureMode(player)) return true;
  return knowledgeReferenceDiscovered(player, reference.kind, reference.id);
}

function knowledgeHabitatName(value) {
  const concept = conceptName(value);
  if (concept) return concept;
  const id = String(value || "");
  if (id.includes(":")) return worldBiomeName(id);
  return text(titleCase(id));
}

async function showKnowledgePage(player, capabilities, entry, back) {
  let profile;
  try { profile = await client.knowledge(entry.k, entry.i); }
  catch {
    const form = new ActionFormData().title(translate("ui.wati_codex.knowledge_title"))
      .body(translate("ui.wati_codex.knowledge_unavailable"))
      .button(translate("ui.wati_codex.back"), ICONS.back);
    const response = await showForm(player, form);
    if (!response.canceled) await back();
    return;
  }

  const refs = new Map();
  const addRef = (kind, id) => {
    if (!["item", "block", "entity", "biome", "ecosystem", "structure"].includes(kind) || !id || conceptName(id)) return;
    refs.set(`${kind}\u0000${id}`, { kind, id });
  };
  for (const row of profile.drops || []) addRef(row.kind || "item", row.id);
  for (const row of profile.contents || []) addRef(row.kind, row.id);
  for (const row of profile.relations || []) addRef(row.kind, row.id);
  for (const row of profile.construction?.parts || []) addRef(row.kind, row.id);
  if (profile.construction?.result) addRef(profile.construction.result.kind, profile.construction.result.id);

  const resolved = new Map();
  const limitedRefs = [...refs.entries()].slice(0, 36);
  await Promise.all(limitedRefs.map(async ([key, ref]) => resolved.set(key, await resolveKnowledgeEntry(ref.kind, ref.id))));

  const parts = [
    "§l", entryName(entry), "§r\n§8", sourceName(entry), "§r\n\n",
    "§l", translate("ui.wati_codex.knowledge_description"), "§r\n§f", knowledgeSummary(profile)
  ];

  if (Array.isArray(profile.roles) && profile.roles.length) {
    parts.push("\n\n§l", translate("ui.wati_codex.knowledge_uses"), "§r\n§7");
    profile.roles.slice(0, 10).forEach((role, index) => parts.push(index ? " · " : "", knowledgeRole(role)));
  }

  let hiddenDrops = 0;
  if (Array.isArray(profile.drops) && profile.drops.length) {
    parts.push("\n\n§l", translate(entry.k === "entity" ? "ui.wati_codex.knowledge_drops" : "ui.wati_codex.knowledge_block_outputs"), "§r\n");
    for (const row of profile.drops.slice(0, 12)) {
      const reveal = adventureCanRevealDrop(player, entry, row);
      if (!reveal) hiddenDrops++;
      const key = `${row.kind || "item"}\u0000${row.id}`;
      parts.push(reveal ? "§a• §f" : "§8• §7", knowledgeReferenceName(row, resolved.get(key), !reveal), " §8— ", knowledgeRarity(row.rarity));
      const quantity = reveal ? knowledgeQuantity(row.quantity) : undefined;
      const condition = reveal ? knowledgeCondition(row.condition) : undefined;
      if (quantity) parts.push(" §7· ", quantity);
      if (condition) parts.push("\n   §8", condition);
      parts.push("\n");
    }
    if (profile.drops.length > 12) parts.push("§8", translate("ui.wati_codex.knowledge_more_entries", [String(profile.drops.length - 12)]), "\n");
  }

  if (Array.isArray(profile.habitats) && profile.habitats.length) {
    parts.push("\n§l", translate("ui.wati_codex.knowledge_habitats"), "§r\n");
    let hidden = 0;
    for (const row of profile.habitats.slice(0, 8)) {
      const biomeKind = String(row.biome || "").includes("fortress") || String(row.biome || "").includes("monument") || String(row.biome || "").includes("chambers") || String(row.biome || "") === "minecraft:village" ? "structure" : "biome";
      const reveal = !isAdventureMode(player) || conceptName(row.biome) || knowledgeReferenceDiscovered(player, biomeKind, row.biome);
      if (!reveal) hidden++;
      parts.push(reveal ? "§b• §f" : "§8• §7", reveal ? knowledgeHabitatName(row.biome) : translate("ui.wati_codex.knowledge_unknown_place"), " §8— ", knowledgeRelation(row.relation), "\n");
    }
    if (hidden) parts.push("§8", translate("ui.wati_codex.knowledge_hidden_habitats", [String(hidden)]), "\n");
  }

  if (Array.isArray(profile.contents) && profile.contents.length) {
    parts.push("\n§l", translate("ui.wati_codex.knowledge_world_contents"), "§r\n");
    let hidden = 0;
    for (const row of profile.contents.slice(0, 12)) {
      const reveal = adventureCanRevealWorldContent(player, row);
      if (!reveal) hidden++;
      const key = `${row.kind}\u0000${row.id}`;
      parts.push(reveal ? "§d• §f" : "§8• §7", knowledgeReferenceName(row, resolved.get(key), !reveal), " §8— ", knowledgeRelation(row.relation), "\n");
    }
    if (profile.contents.length > 12) parts.push("§8", translate("ui.wati_codex.knowledge_more_entries", [String(profile.contents.length - 12)]), "\n");
    if (hidden) parts.push("§8", translate("ui.wati_codex.knowledge_hidden_contents", [String(hidden)]), "\n");
  }

  if (Array.isArray(profile.relations) && profile.relations.length) {
    parts.push("\n§l", translate("ui.wati_codex.knowledge_relations"), "§r\n");
    for (const row of profile.relations.slice(0, 10)) {
      const reveal = !isAdventureMode(player) || knowledgeReferenceDiscovered(player, row.kind, row.id);
      const key = `${row.kind}\u0000${row.id}`;
      parts.push(reveal ? "§6• §f" : "§8• §7", knowledgeReferenceName(row, resolved.get(key), !reveal), " §8— ", knowledgeRelation(row.relation), "\n");
    }
  }

  if (profile.construction) {
    parts.push("\n§l", translate("ui.wati_codex.knowledge_construction"), "§r\n");
    if (typeof profile.construction.summaryKey === "string") parts.push("§f", translate(profile.construction.summaryKey), "\n");
    const groupsShown = new Set();
    for (const row of (profile.construction.parts || []).slice(0, 8)) {
      if (row.group && groupsShown.has(row.group)) continue;
      if (row.group) groupsShown.add(row.group);
      const reveal = !isAdventureMode(player) || knowledgeReferenceDiscovered(player, row.kind, row.id);
      const key = `${row.kind}\u0000${row.id}`;
      parts.push(reveal ? "§7• §f" : "§8• §7", text(`${row.count || 1} × `), knowledgeReferenceName(row, resolved.get(key), !reveal));
      if (row.group) parts.push(" §8", translate("ui.wati_codex.knowledge_alternative"));
      parts.push("\n");
    }
  }

  if (profile.acquisitionCount > 0) parts.push("\n§8", translate("ui.wati_codex.knowledge_acquisition_count", [String(profile.acquisitionCount)]));
  if (profile.generated) parts.push("\n§8", translate("ui.wati_codex.knowledge_generated_note"));
  if (isAdventureMode(player) && hiddenDrops) parts.push("\n§8", translate("ui.wati_codex.knowledge_progressive_note"));

  const form = new ActionFormData().title(translate("ui.wati_codex.knowledge_title")).body(raw(parts));
  const actions = [];
  const openable = limitedRefs.filter(([, ref]) => !isAdventureMode(player) || knowledgeReferenceDiscovered(player, ref.kind, ref.id)).slice(0, 8);
  for (const [key, ref] of openable) {
    const refEntry = resolved.get(key);
    if (!refEntry) continue;
    form.button(raw([translate("ui.wati_codex.knowledge_open_related"), "\n§8", entryName(refEntry)]), iconForEntry(refEntry));
    actions.push(() => showEntry(player, capabilities, ref.kind, ref.id, () => showKnowledgePage(player, capabilities, entry, back)));
  }
  if (entry.k !== "entity" && (entry.recipeCount || entry.useCount || profile.acquisitionCount)) {
    form.button(translate("ui.wati_codex.view_acquisition"), ICONS.info);
    actions.push(() => showAcquisition(player, capabilities, entry, () => showKnowledgePage(player, capabilities, entry, back)));
  }
  form.button(translate("ui.wati_codex.back"), ICONS.back);
  actions.push(back);
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}


async function showAdventureLockedEntry(player, capabilities, kind, typeId, back) {
  const descriptionKey = kind === "item"
    ? "ui.wati_codex.discovery_locked_item"
    : kind === "block"
      ? "ui.wati_codex.discovery_locked_block"
      : "ui.wati_codex.discovery_locked_entity";
  const hintKey = kind === "block"
    ? "ui.wati_codex.discovery_locked_block_hint"
    : kind === "entity"
      ? "ui.wati_codex.discovery_locked_entity_hint"
      : "ui.wati_codex.discovery_locked_hint";
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.discovery_locked_title"))
    .body(raw([
      "§l???§r\n\n",
      translate(descriptionKey),
      "\n\n§8", translate(hintKey)
    ]))
    .button(translate("ui.wati_codex.back"), ICONS.back);
  const response = await showForm(player, form);
  if (!response.canceled) await back();
}

async function showAdventureEntry(player, capabilities, entry, back) {
  const record = getDiscoveryRecord(player, entry.k, entry.i);
  let knowledge;
  if (supportsKnowledge(capabilities)) {
    try { knowledge = await client.knowledge(entry.k, entry.i); } catch { knowledge = undefined; }
  }
  const hasRecipes = (entry.recipeCount || 0) > 0;
  const hasUses = (entry.useCount || 0) > 0;
  const isBlock = entry.k === "block";
  const isEntity = entry.k === "entity";
  const stageKey = isBlock
    ? record?.stage >= 3
      ? "ui.wati_codex.discovery_block_stage_broken"
      : record?.stage >= 2
        ? "ui.wati_codex.discovery_block_stage_placed"
        : "ui.wati_codex.discovery_block_stage_observed"
    : isEntity
      ? record?.stage >= 3
        ? "ui.wati_codex.discovery_entity_stage_defeated"
        : record?.stage >= 2
          ? "ui.wati_codex.discovery_entity_stage_fought"
          : "ui.wati_codex.discovery_entity_stage_observed"
      : undefined;
  const notes = isBlock
    ? record?.stage >= 3
      ? translate("ui.wati_codex.discovery_block_notes_broken")
      : record?.stage >= 2
        ? translate("ui.wati_codex.discovery_block_notes_placed")
        : translate("ui.wati_codex.discovery_block_notes_observed")
    : isEntity
      ? record?.stage >= 3
        ? translate("ui.wati_codex.discovery_entity_notes_defeated")
        : record?.stage >= 2
          ? translate("ui.wati_codex.discovery_entity_notes_fought")
          : translate("ui.wati_codex.discovery_entity_notes_observed")
      : hasRecipes
        ? translate("ui.wati_codex.discovery_recipe_hint")
        : translate("ui.wati_codex.discovery_no_recipe_hint");
  const body = raw([
    "§l", entryName(entry), "§r\n",
    "§8", sourceName(entry), "§r\n\n",
    "§a✓ ", translate("ui.wati_codex.discovery_documented"),
    knowledge ? raw(["\n\n§f", knowledgeSummary(knowledge)]) : undefined,
    "\n§7", translate("ui.wati_codex.category"), ": §f", text(titleCase(entry.cat || entry.grp || "unknown")),
    "\n§7", translate("ui.wati_codex.discovery_method"), ": §f", translate(`ui.wati_codex.discovery_method.${record?.method || (isBlock ? "block_interaction" : isEntity ? "entity_interaction" : "inventory")}`),
    stageKey ? raw(["\n§7", translate("ui.wati_codex.discovery_stage"), ": §f", translate(stageKey)]) : undefined,
    "\n\n§l", translate("ui.wati_codex.discovery_notes"), "§r\n",
    notes,
    !isBlock && !isEntity && hasUses ? raw(["\n§7", translate("ui.wati_codex.discovery_use_hint")]) : undefined,
    "\n\n§8", translate(isBlock
      ? "ui.wati_codex.discovery_block_study_later"
      : isEntity
        ? "ui.wati_codex.discovery_entity_study_later"
        : "ui.wati_codex.discovery_study_later")
  ]);
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.entry_title"))
    .body(body);
  const actions = [];
  if (knowledge) {
    form.button(translate("ui.wati_codex.knowledge_view_details"), ICONS.info);
    actions.push(() => showKnowledgePage(player, capabilities, entry, () => showAdventureEntry(player, capabilities, entry, back)));
  }
  form.button(translate("ui.wati_codex.back"), ICONS.back);
  actions.push(back);
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

function dimensionLabel(value) {
  const id=String(value||"unknown").split(":").at(-1);
  const known=new Set(["overworld","nether","the_end"]);
  return translate(`ui.wati_codex.dimension.${known.has(id)?id:"unknown"}`);
}
function worldDetectionLabel(value) {
  const known=new Set(["runtime_biome","signature_blocks","generated_structure","manual_only"]); const key=known.has(value)?value:"unknown";
  return translate(`ui.wati_codex.world_detection.${key}`);
}
async function showWorldEntry(player, capabilities, entry, back) {
  const record=getWorldDiscoveryRecord(player,entry.k,entry.i);
  const adventure=isAdventureMode(player);
  const parts=["§l",entryName(entry),"§r\n§8",sourceName(entry),"§r\n\n"];
  if(!adventure)parts.push("§7",translate("ui.wati_codex.identifier"),": §f",text(entry.i),"\n");
  parts.push("§7",translate("ui.wati_codex.type"),": §f",kindLabel(entry.k),"\n§7",translate("ui.wati_codex.dimension"),": §f",dimensionLabel(entry.dim),
    "\n§7",translate("ui.wati_codex.world_detection_label"),": §f",worldDetectionLabel(entry.det));
  if(entry.sn)parts.push("\n\n§f",translate(entry.sn));
  else if(entry.summary)parts.push("\n\n§f",text(entry.summary));
  if(Array.isArray(entry.base)&&entry.base.length){
    parts.push("\n\n§l",translate("ui.wati_codex.base_biomes"),"§r\n§7");
    entry.base.forEach((value,index)=>parts.push(index?", ":"",worldBiomeName(value)));
  }
  if(record)parts.push("\n\n§l",translate("ui.wati_codex.exploration_record"),"§r\n§7",translate("ui.wati_codex.exploration_visits",[String(record.visits||1)]),"\n§7",translate("ui.wati_codex.coordinates"),": §f",text(`X ${record.location.x}, Y ${record.location.y}, Z ${record.location.z}`));
  if(entry.k==="structure"&&entry.det==="manual_only")parts.push("\n\n§6",translate("ui.wati_codex.structure_manual_note"));
  const form=new ActionFormData().title(translate("ui.wati_codex.entry_title")).body(raw(parts));
  const actions=[];
  if(supportsKnowledge(capabilities)){
    form.button(translate("ui.wati_codex.knowledge_view_details"),ICONS.info);
    actions.push(()=>showKnowledgePage(player,capabilities,entry,()=>showWorldEntry(player,capabilities,entry,back)));
  }
  const activeMode=resolveCodexMode(player).effectiveMode;
  if(activeMode===CODEX_MODES.EXPLORATION||activeMode===CODEX_MODES.ADVENTURE){
    if(entry.k==="biome"){
      form.button(translate("ui.wati_codex.orientation_to_biome"),ICONS.profile);
      actions.push(()=>orientToBiomeEntry(player,entry,()=>showWorldEntry(player,capabilities,entry,back)));
    }
    form.button(translate("ui.wati_codex.place_register_here"),ICONS.exploration);
    actions.push(()=>showRegisterLinkedEntry(player,entry,()=>showWorldEntry(player,capabilities,entry,back)));
  }
  form.button(translate("ui.wati_codex.back"),ICONS.back);actions.push(back);
  const response=await showForm(player,form);if(response.canceled||response.selection===undefined)return;const action=actions[response.selection];if(action)await action();
}

async function showEntry(player, capabilities, kind, typeId, back) {
  const worldKind = kind === "biome" || kind === "ecosystem" || kind === "structure";
  if (isAdventureMode(player)) {
    const known = kind === "item"
      ? isItemDiscovered(player, typeId)
      : kind === "block"
        ? isBlockDiscovered(player, typeId)
        : kind === "entity"
          ? isEntityDiscovered(player, typeId)
          : (kind === "biome" || kind === "ecosystem" || kind === "structure")
            ? isWorldEntryDiscovered(player, kind, typeId)
            : false;
    if (!known) {
      await showAdventureLockedEntry(player, capabilities, kind, typeId, back);
      return;
    }
  }
  let entry;
  try {
    entry = await client.entry(kind, typeId);
  } catch {
    await showCoreMissing(player);
    return;
  }
  if (worldKind) { await showWorldEntry(player, capabilities, entry, back); return; }
  if (isAdventureMode(player)) {
    await showAdventureEntry(player, capabilities, entry, back);
    return;
  }
  let knowledge;
  if (supportsKnowledge(capabilities)) {
    try { knowledge = await client.knowledge(kind, typeId); } catch { knowledge = undefined; }
  }
  const [namespace] = splitIdentifier(typeId);
  const body = raw([
    "§l", entryName(entry), "§r\n",
    "§8", sourceName(entry), "§r\n\n",
    knowledge ? raw(["§f", knowledgeSummary(knowledge), "\n\n"]) : undefined,
    "§7", translate("ui.wati_codex.identifier"), ": §f", text(typeId), "\n",
    "§7", translate("ui.wati_codex.namespace"), ": §f", text(namespace), "\n",
    "§7", translate("ui.wati_codex.type"), ": §f", kindLabel(kind), "\n",
    "§7", translate("ui.wati_codex.category"), ": §f", text(titleCase(entry.cat || entry.grp || "unknown")), "\n",
    "§7", translate("ui.wati_codex.installed"), ": §f", installationLabel(entry.installed), "\n",
    "§7", translate("ui.wati_codex.recipes"), ": §f", text(String(entry.recipeCount || 0)), "\n",
    "§7", translate("ui.wati_codex.uses"), ": §f", text(String(entry.useCount || 0)),
    entry.installed === false ? raw(["\n\n§6", translate("ui.wati_codex.catalog_only_note")]) : undefined,
    entry.installed === undefined ? raw(["\n\n§6", translate("ui.wati_codex.installation_unverifiable_note")]) : undefined,
    entry.tagUsesExcluded ? raw(["\n§8", translate("ui.wati_codex.tag_uses_note")]) : undefined
  ]);
  const form = new ActionFormData().title(translate("ui.wati_codex.entry_title")).body(body);
  const actions = [];
  if (knowledge) {
    form.button(translate("ui.wati_codex.knowledge_view_details"), ICONS.info);
    actions.push(() => showKnowledgePage(player, capabilities, entry, () => showEntry(player, capabilities, kind, typeId, back)));
  }
  if ((entry.recipeCount || 0) > 0) {
    form.button(translate("ui.wati_codex.view_recipes"), ICONS.recipe);
    actions.push(() => showRecipeList(player, capabilities, entry, "recipes", 0, () => showEntry(player, capabilities, kind, typeId, back)));
  }
  if ((entry.useCount || 0) > 0) {
    form.button(translate("ui.wati_codex.view_uses"), ICONS.uses);
    actions.push(() => showRecipeList(player, capabilities, entry, "uses", 0, () => showEntry(player, capabilities, kind, typeId, back)));
  }
  if (kind !== "entity") {
    form.button(translate("ui.wati_codex.view_acquisition"), ICONS.info);
    actions.push(() => showAcquisition(player, capabilities, entry, () => showEntry(player, capabilities, kind, typeId, back)));
  }
  for (const relatedKind of entry.relatedKinds || []) {
    form.button(translate(`ui.wati_codex.view_related_${relatedKind}`), relatedKind === "block" ? ICONS.block : ICONS.item);
    actions.push(() => showEntry(player, capabilities, relatedKind, typeId, () => showEntry(player, capabilities, kind, typeId, back)));
  }
  form.button(translate("ui.wati_codex.browse_same_addon"), ICONS.addons);
  actions.push(async () => {
    try {
      const source = await client.source(entry.sid || namespace);
      await showSourceDetails(player, capabilities, source, () => showEntry(player, capabilities, kind, typeId, back));
    } catch {
      await showSearchResults(player, capabilities, {
        query: `@${entry.sid || namespace}`,
        kind: undefined,
        installedOnly: true,
        page: 0,
        back: () => showEntry(player, capabilities, kind, typeId, back)
      });
    }
  });
  form.button(translate("ui.wati_codex.back"), ICONS.back);
  actions.push(back);
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

function recipeReferenceKey(recipe) {
  return `${recipe?.sourceId || ""}\u0000${recipe?.id || ""}`;
}

function exactIngredientIds(recipe) {
  return [...new Set(ingredientList(recipe)
    .filter(value => value?.type === "item" && typeof value.id === "string")
    .map(value => value.id))];
}

async function collectRecipePages(fetchPage) {
  const items = [];
  let page = 0;
  let more = true;
  while (more && items.length < MAX_ANALYZED_RECIPES) {
    const result = await fetchPage(page, RECIPE_FETCH_SIZE);
    items.push(...(result.items || []));
    more = result.more === true;
    page++;
  }
  return { items: items.slice(0, MAX_ANALYZED_RECIPES), truncated: more };
}

async function analyzeAcquisition(entry) {
  const cacheKey = entry.i;
  if (acquisitionCache.has(cacheKey)) return acquisitionCache.get(cacheKey);
  const pending = (async () => {
    const recipesPage = await collectRecipePages((page, size) => client.recipes(entry.i, page, size));
    if (!recipesPage.items.length) {
      return {
        recipes: [],
        uses: [],
        conversionByRecipe: new Map(),
        conversionCount: 0,
        nonConversionCount: 0,
        truncated: recipesPage.truncated
      };
    }
    const usesPage = await collectRecipePages((page, size) => client.uses(entry.i, page, size));
    const conversionByRecipe = new Map();
    for (const recipe of recipesPage.items) {
      const ingredientIds = new Set(exactIngredientIds(recipe));
      if (!ingredientIds.size) continue;
      const reverseTargets = new Set();
      for (const useRecipe of usesPage.items) {
        for (const result of recipeResultList(useRecipe)) {
          if (typeof result?.id === "string" && ingredientIds.has(result.id)) reverseTargets.add(result.id);
        }
      }
      if (reverseTargets.size) conversionByRecipe.set(recipeReferenceKey(recipe), [...reverseTargets]);
    }
    return {
      recipes: recipesPage.items,
      uses: usesPage.items,
      conversionByRecipe,
      conversionCount: conversionByRecipe.size,
      nonConversionCount: Math.max(0, recipesPage.items.length - conversionByRecipe.size),
      truncated: recipesPage.truncated || usesPage.truncated
    };
  })();
  acquisitionCache.set(cacheKey, pending);
  try {
    return await pending;
  } catch (error) {
    acquisitionCache.delete(cacheKey);
    throw error;
  }
}

function countDescription(extra) {
  const range = extra?.count;
  if (!Array.isArray(range) || range.length < 2) return undefined;
  const minimum = Number(range[0]);
  const maximum = Number(range[1]);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return undefined;
  if (minimum === maximum) return translate("ui.wati_codex.acquisition_count_exact", [String(minimum)]);
  if (minimum === 0) return translate("ui.wati_codex.acquisition_count_up_to", [String(maximum)]);
  return translate("ui.wati_codex.acquisition_count_range", [String(minimum), String(maximum)]);
}

function biomeComponent(value) {
  const keys = {
    overworld: "overworld",
    overworld_generation: "overworld",
    nether: "nether",
    the_end: "end",
    warm: "warm",
    cold: "cold"
  };
  return keys[value] ? translate(`ui.wati_codex.biome.${keys[value]}`) : text(titleCase(value));
}

async function resolveTypedEntry(kind, typeId) {
  if (!typeId || kind === "label") return undefined;
  try {
    const entry = await client.entry(kind, typeId);
    return { ...entry, k: kind, i: typeId };
  } catch {
    return { k: kind, i: typeId, d: titleCase(splitIdentifier(typeId)[1]), a: titleCase(splitIdentifier(typeId)[0]) };
  }
}

function appendAcquisitionSource(parts, row, resolved) {
  const [, kind, source] = row;
  if (kind === "label") {
    parts.push(text(titleCase(source)));
    return;
  }
  const sourceEntry = resolved.get(`${kind}:${source}`);
  parts.push(sourceEntry ? entryName(sourceEntry) : text(source));
}

function appendTradeCost(parts, extra, resolved) {
  const costs = Array.isArray(extra?.cost) ? extra.cost : [];
  if (!costs.length) return;
  parts.push("\n   §8", translate("ui.wati_codex.acquisition_cost"), ": §7");
  costs.forEach((cost, index) => {
    if (index > 0) parts.push(" + ");
    const [id, quantity] = cost;
    const entry = resolved.get(`item:${id}`);
    if (typeof quantity === "object" && quantity) {
      const minimum = quantity.min ?? quantity.max ?? 1;
      const maximum = quantity.max ?? quantity.min ?? minimum;
      parts.push(text(`${minimum}${minimum === maximum ? "" : `–${maximum}`} × `));
    } else {
      parts.push(text(`${quantity || 1} × `));
    }
    parts.push(entry ? entryName(entry) : text(id));
  });
}

async function showAcquisition(player, capabilities, entry, back) {
  let analysis;
  try {
    analysis = await analyzeAcquisition(entry);
  } catch {
    await showCoreMissing(player);
    return;
  }
  let acquisitionResult;
  try {
    acquisitionResult = await client.acquisition(entry.i);
  } catch {
    acquisitionResult = { items: [] };
  }
  const methods = Array.isArray(acquisitionResult.items) ? acquisitionResult.items : [];
  const references = new Map();
  for (const row of methods) {
    const [, kind, source, , extra] = row;
    if (kind !== "label" && source) references.set(`${kind}:${source}`, [kind, source]);
    if (extra?.seed) references.set(`item:${extra.seed}`, ["item", extra.seed]);
    for (const cost of extra?.cost || []) {
      if (typeof cost?.[0] === "string") references.set(`item:${cost[0]}`, ["item", cost[0]]);
    }
  }
  const resolved = new Map();
  for (const [key, [kind, id]] of references) resolved.set(key, await resolveTypedEntry(kind, id));

  const parts = [
    "§l", entryName(entry), "§r\n",
    "§8", sourceName(entry), "§r\n\n"
  ];

  if (methods.length) {
    parts.push("§l", translate("ui.wati_codex.acquisition_known_methods"), "§r\n");
    for (const row of methods.slice(0, 12)) {
      const [method, , , confidence, extra] = row;
      parts.push(confidence >= 2 ? "§a● §f" : "§e◆ §f");
      parts.push(translate(`ui.wati_codex.acquisition_method.${method}`), ": ");
      if (method === "cultivation") {
        appendAcquisitionSource(parts, row, resolved);
        if (extra?.seed) {
          const seedEntry = resolved.get(`item:${extra.seed}`);
          parts.push("\n   §8", translate("ui.wati_codex.acquisition_seed"), ": §7", seedEntry ? entryName(seedEntry) : text(extra.seed));
        }
      } else if (method === "trade") {
        appendAcquisitionSource(parts, row, resolved);
        appendTradeCost(parts, extra, resolved);
      } else {
        appendAcquisitionSource(parts, row, resolved);
      }
      const count = countDescription(extra);
      if (count) parts.push("\n   §8", count);
      const biomes = [...new Set(extra?.biomes || [])];
      if (biomes.length) {
        parts.push("\n   §8", translate("ui.wati_codex.acquisition_biomes"), ": §7");
        biomes.forEach((biome, index) => parts.push(index ? ", " : "", biomeComponent(biome)));
      }
      parts.push("\n");
    }
    if (methods.length > 12) parts.push("§8", translate("ui.wati_codex.acquisition_more_methods", [String(methods.length - 12)]), "\n");
    parts.push("\n§8", translate("ui.wati_codex.acquisition_confidence_legend"), "\n\n");
  } else {
    parts.push("§8", translate("ui.wati_codex.acquisition_no_direct_data"), "\n\n");
  }

  parts.push("§l", translate("ui.wati_codex.acquisition_crafting_summary"), "§r\n");
  if (!analysis.recipes.length) {
    parts.push(translate("ui.wati_codex.acquisition_none"));
  } else if (analysis.nonConversionCount === 0) {
    parts.push(translate("ui.wati_codex.acquisition_only_conversions", [String(analysis.conversionCount)]));
  } else if (analysis.conversionCount > 0) {
    parts.push(translate("ui.wati_codex.acquisition_mixed", [String(analysis.nonConversionCount), String(analysis.conversionCount)]));
  } else {
    parts.push(translate("ui.wati_codex.acquisition_craftable", [String(analysis.recipes.length)]));
  }

  const targetIds = [...new Set([...analysis.conversionByRecipe.values()].flat())].slice(0, 8);
  if (targetIds.length) {
    const resolvedPairs = await Promise.all(targetIds.map(async id => [id, await resolveRecipeId(id)]));
    parts.push("\n\n§l", translate("ui.wati_codex.acquisition_conversions"), "§r\n");
    for (const [, targetEntry] of resolvedPairs) {
      parts.push("§7• §f", entryName(targetEntry), " §8↔ §f", entryName(entry), "\n");
    }
  }
  if (!methods.length) parts.push("\n§8", translate("ui.wati_codex.acquisition_other_methods"));
  if (analysis.truncated) parts.push("\n§8", translate("ui.wati_codex.acquisition_limited"));

  const form = new ActionFormData().title(translate("ui.wati_codex.acquisition_title")).body(raw(parts));
  const actions = [];
  const openable = [...references.entries()].filter(([, [kind]]) => kind !== "label").slice(0, 8);
  for (const [key, [kind, id]] of openable) {
    const sourceEntry = resolved.get(key);
    if (!sourceEntry) continue;
    form.button(raw([translate("ui.wati_codex.acquisition_open_source"), "\n§8", entryName(sourceEntry)]), iconForEntry(sourceEntry));
    actions.push(() => showEntry(player, capabilities, kind, id, () => showAcquisition(player, capabilities, entry, back)));
  }
  form.button(translate("ui.wati_codex.back"), ICONS.back);
  actions.push(back);
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

function recipeTypeMessage(type) {
  return translate(`ui.wati_codex.recipe_type.${type || "unknown"}`);
}

function stationMessage(recipe) {
  const station = recipe?.station;
  if (station && (station.resolved === true || station.s || station.n || station.d || station.x)) {
    return entryName(station);
  }
  const tags = Array.isArray(recipe?.tags) ? recipe.tags : [];
  const candidates = [
    "crafting_table", "furnace", "smoker", "blast_furnace", "campfire", "stonecutter", "smithing_table", "brewing_stand"
  ];
  let fallback = candidates.find(value => tags.includes(value));
  if (!fallback) {
    if (recipe?.type === "furnace") fallback = "furnace";
    else if (recipe?.type?.startsWith("smithing")) fallback = "smithing_table";
    else if (recipe?.type === "brewing_mix" || recipe?.type === "brewing_container") fallback = "brewing_stand";
    else fallback = tags[0];
  }
  if (!fallback) return translate("ui.wati_codex.station.unknown");
  if (candidates.includes(fallback)) return translate(`ui.wati_codex.station.${fallback}`);
  return text(titleCase(fallback));
}

function ingredientList(recipe) {
  if (recipe.type === "shaped") return Object.values(recipe.key || {});
  if (recipe.type === "shapeless") return recipe.ingredients || [];
  if (recipe.type === "furnace") return [recipe.input];
  if (recipe.type === "brewing_mix" || recipe.type === "brewing_container") return [recipe.input, recipe.reagent];
  if (recipe.type === "smithing_transform" || recipe.type === "smithing_trim") return [recipe.template, recipe.base, recipe.addition];
  return [];
}

function recipeResultList(recipe) {
  return Array.isArray(recipe.results) ? recipe.results : [];
}

async function resolveRecipeId(typeId) {
  try {
    const item = await client.entry("item", typeId);
    if (item.f || item.s || item.n) return item;
    const block = await client.entry("block", typeId);
    return block.f || block.s || block.n ? block : item;
  } catch {
    return { k: "item", i: typeId, d: titleCase(splitIdentifier(typeId)[1]), a: titleCase(splitIdentifier(typeId)[0]) };
  }
}

async function showRecipeList(player, capabilities, entry, mode, page, back) {
  let result;
  try {
    result = mode === "recipes"
      ? await client.recipes(entry.i, page, RECIPE_PAGE_SIZE)
      : await client.uses(entry.i, page, RECIPE_PAGE_SIZE);
  } catch {
    await showCoreMissing(player);
    return;
  }
  const form = new ActionFormData()
    .title(translate(mode === "recipes" ? "ui.wati_codex.recipes_title" : "ui.wati_codex.uses_title"))
    .body(raw([
      entryName(entry), "\n§8", sourceName(entry),
      "\n\n§7", translate("ui.wati_codex.result_count", [String(result.total || 0)]),
      "\n§7", translate("ui.wati_codex.page", [String((result.p || 0) + 1)]),
      result.tagUsesExcluded ? raw(["\n§8", translate("ui.wati_codex.tag_uses_note")]) : undefined
    ]));
  const actions = [];
  for (const recipe of result.items || []) {
    form.button(raw([
      recipeTypeMessage(recipe.type),
      "\n§8", stationMessage(recipe), " §7· ", sourceName(recipe)
    ]), ICONS.recipe);
    actions.push(() => showRecipeDetail(player, capabilities, recipe, entry, () => showRecipeList(player, capabilities, entry, mode, page, back)));
  }
  if (page > 0) {
    form.button(translate("ui.wati_codex.previous"), ICONS.previous);
    actions.push(() => showRecipeList(player, capabilities, entry, mode, page - 1, back));
  }
  if (result.more) {
    form.button(translate("ui.wati_codex.next"), ICONS.next);
    actions.push(() => showRecipeList(player, capabilities, entry, mode, page + 1, back));
  }
  form.button(translate("ui.wati_codex.back"), ICONS.back);
  actions.push(back);
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

const GRID_SYMBOLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";

function shapedLayout(recipe) {
  const sourcePattern = Array.isArray(recipe?.pattern) ? recipe.pattern.map(row => String(row)) : [];
  const sourceKey = recipe?.key && typeof recipe.key === "object" ? recipe.key : {};
  const symbolMap = new Map();
  for (const row of sourcePattern) {
    for (const symbol of row) {
      if (symbol === " " || symbolMap.has(symbol)) continue;
      symbolMap.set(symbol, GRID_SYMBOLS[symbolMap.size] || String(symbolMap.size + 1));
    }
  }
  for (const symbol of Object.keys(sourceKey)) {
    if (symbol !== " " && !symbolMap.has(symbol)) symbolMap.set(symbol, GRID_SYMBOLS[symbolMap.size] || String(symbolMap.size + 1));
  }
  const width = sourcePattern.reduce((max, row) => Math.max(max, row.length), 0);
  const height = sourcePattern.length;
  const displayWidth = width <= 3 ? 3 : width;
  const displayHeight = height <= 3 ? 3 : height;
  const rows = [];
  for (let y = 0; y < displayHeight; y++) {
    const sourceRow = sourcePattern[y] || "";
    const cells = [];
    for (let x = 0; x < displayWidth; x++) {
      const sourceSymbol = sourceRow[x] || " ";
      cells.push(sourceSymbol === " " ? "[·]" : `[${symbolMap.get(sourceSymbol) || "?"}]`);
    }
    rows.push(cells.join(""));
  }
  const legend = [...symbolMap.entries()].map(([sourceSymbol, displaySymbol]) => ({
    displaySymbol,
    ingredient: sourceKey[sourceSymbol]
  }));
  return { width, height, rows, legend };
}

function recipeValidation(recipe, ingredients, results, resolved) {
  const warnings = [];
  const missingIngredients = [];
  const missingResults = [];
  const unverifiedTags = [];
  const malformedIngredients = [];
  if (recipe.type === "shaped") {
    const layout = shapedLayout(recipe);
    if (layout.width > 3 || layout.height > 3) {
      warnings.push(translate("ui.wati_codex.validation_grid_too_large", [String(layout.width), String(layout.height)]));
    }
    const usedSymbols = new Set((recipe.pattern || []).join("").replace(/ /g, ""));
    const definedSymbols = new Set(Object.keys(recipe.key || {}).filter(symbol => symbol !== " "));
    const undefinedSymbols = [...usedSymbols].filter(symbol => !definedSymbols.has(symbol));
    if (undefinedSymbols.length) warnings.push(translate("ui.wati_codex.validation_undefined_symbols", [undefinedSymbols.join(", ")]));
  }
  for (const ingredient of ingredients) {
    if (ingredient?.type === "tag" && ingredient.tag) {
      unverifiedTags.push(ingredient.tag);
      continue;
    }
    if (ingredient?.type !== "item" || !ingredient.id) {
      malformedIngredients.push(ingredient);
      continue;
    }
    const entry = resolved.get(ingredient.id);
    if (entry?.installed === false) missingIngredients.push(entry);
  }
  for (const result of results) {
    if (!result?.id) continue;
    const entry = resolved.get(result.id);
    if (entry?.installed === false) missingResults.push(entry);
  }
  if (missingIngredients.length) warnings.push(translate("ui.wati_codex.validation_missing_ingredients", [String(missingIngredients.length)]));
  if (missingResults.length) warnings.push(translate("ui.wati_codex.validation_missing_result"));
  if (malformedIngredients.length) warnings.push(translate("ui.wati_codex.validation_malformed_ingredients", [String(malformedIngredients.length)]));
  if (!results.length && !recipe.dynamicResult) warnings.push(translate("ui.wati_codex.validation_no_result"));
  return { warnings, missingIngredients, missingResults, unverifiedTags };
}

function appendMissingDependencies(parts, validation) {
  const missing = [...validation.missingIngredients, ...validation.missingResults];
  if (!missing.length) return;
  const grouped = new Map();
  for (const entry of missing) {
    const key = entry.sid || entry.a || splitIdentifier(entry.i || "unknown:unknown")[0];
    const group = grouped.get(key) || { source: entry, entries: new Map() };
    group.entries.set(`${entry.k || "item"}:${entry.i}`, entry);
    grouped.set(key, group);
  }
  parts.push("\n§6§l", translate("ui.wati_codex.missing_dependencies"), "§r\n");
  for (const group of grouped.values()) {
    parts.push("§e• §f", sourceName(group.source), "\n");
    for (const entry of [...group.entries.values()].slice(0, 12)) {
      parts.push("   §c- §f", entryName(entry), "\n   §8", text(entry.i), "\n");
    }
  }
  parts.push("§8", translate("ui.wati_codex.missing_dependencies_note"), "\n");
}

async function showRecipeDetail(player, capabilities, recipe, contextEntry, back) {
  const ingredients = ingredientList(recipe).filter(Boolean);
  const results = recipeResultList(recipe).filter(Boolean);
  const ids = [...new Set([
    ...ingredients.filter(value => value.type === "item" && typeof value.id === "string").map(value => value.id),
    ...results.filter(value => typeof value.id === "string").map(value => value.id)
  ])];
  const resolvedPairs = await Promise.all(ids.map(async id => [id, await resolveRecipeId(id)]));
  const resolved = new Map(resolvedPairs);
  const parts = [
    "§7", translate("ui.wati_codex.recipe_id"), ": §f", text(recipe.id), "\n",
    "§7", translate("ui.wati_codex.recipe_type"), ": §f", recipeTypeMessage(recipe.type), "\n",
    "§7", translate("ui.wati_codex.station"), ": §f", stationMessage(recipe), "\n",
    "§7", translate("ui.wati_codex.source"), ": §f", sourceName(recipe), "\n\n"
  ];
  if (recipe.type === "shaped") {
    const layout = shapedLayout(recipe);
    parts.push("§l", translate("ui.wati_codex.crafting_grid"), "§r §8", text(`(${layout.width}×${layout.height})`), "\n§f");
    for (const row of layout.rows) parts.push(text(row), "\n");
    parts.push("\n§l", translate("ui.wati_codex.symbol_legend"), "§r\n");
    for (const row of layout.legend) {
      parts.push("§b", text(`[${row.displaySymbol}]`), "§f — ");
      appendIngredient(parts, row.ingredient, resolved);
      parts.push("\n");
    }
  } else {
    parts.push("§l", translate("ui.wati_codex.ingredients"), "§r\n");
    ingredients.forEach((ingredient, index) => {
      parts.push(text(`${index + 1}. `));
      appendIngredient(parts, ingredient, resolved);
      parts.push("\n");
    });
  }
  parts.push("\n§l", translate("ui.wati_codex.results"), "§r\n");
  if (results.length) {
    results.forEach((result, index) => {
      const resultEntry = resolved.get(result.id);
      parts.push(text(`${index + 1}. ${result.count || 1} × `), resultEntry ? entryName(resultEntry) : text(result.id));
      if (resultEntry?.installed === false) parts.push(" §c", translate("ui.wati_codex.not_installed"));
      parts.push("\n");
    });
  } else if (recipe.dynamicResult) {
    parts.push(translate("ui.wati_codex.dynamic_result"), "\n");
  } else {
    parts.push(translate("ui.wati_codex.unknown"), "\n");
  }
  const validation = recipeValidation(recipe, ingredients, results, resolved);
  parts.push("\n§l", translate("ui.wati_codex.validation_title"), "§r\n");
  if (!validation.warnings.length) {
    parts.push("§a✓ §f", translate("ui.wati_codex.validation_ok"), "\n");
  } else {
    for (const warning of validation.warnings) parts.push("§c⚠ §f", warning, "\n");
  }
  if (validation.unverifiedTags.length) {
    parts.push("§e◆ §f", translate("ui.wati_codex.validation_tags_unverified", [String(validation.unverifiedTags.length)]), "\n");
    for (const tag of validation.unverifiedTags.slice(0, 8)) parts.push("   §8#", text(tag), "\n");
  }
  appendMissingDependencies(parts, validation);
  try {
    const analysis = await analyzeAcquisition(contextEntry);
    const conversionTargets = analysis.conversionByRecipe.get(recipeReferenceKey(recipe)) || [];
    if (conversionTargets.length) {
      parts.push("\n§6§l", translate("ui.wati_codex.acquisition_recipe_note_title"), "§r\n");
      parts.push(translate("ui.wati_codex.acquisition_recipe_note"), "\n");
      for (const targetId of conversionTargets.slice(0, 4)) {
        const targetEntry = resolved.get(targetId) || await resolveRecipeId(targetId);
        parts.push("§7• §f", entryName(targetEntry), " §8→ §f", entryName(contextEntry), "\n");
      }
    }
  } catch {
    // Acquisition analysis is informative and must not block recipe viewing.
  }
  if (Array.isArray(recipe.tags) && recipe.tags.length) {
    parts.push("\n§8", translate("ui.wati_codex.tags"), ": ", text(recipe.tags.join(", ")));
  }
  const form = new ActionFormData().title(translate("ui.wati_codex.recipe_detail_title")).body(raw(parts));
  const actions = [];
  const uniqueIngredientIds = [...new Set(ingredients.filter(value => value.type === "item" && value.id).map(value => value.id))].slice(0, 10);
  for (const id of uniqueIngredientIds) {
    const ingredientEntry = resolved.get(id) || { k: "item", i: id, d: titleCase(splitIdentifier(id)[1]) };
    form.button(raw([translate("ui.wati_codex.open_ingredient"), "\n§8", entryName(ingredientEntry)]), iconForEntry(ingredientEntry));
    actions.push(() => showEntry(player, capabilities, ingredientEntry.k || "item", id, () => showRecipeDetail(player, capabilities, recipe, contextEntry, back)));
  }
  const uniqueResultIds = [...new Set(results.filter(value => value.id).map(value => value.id))].slice(0, 4);
  for (const id of uniqueResultIds) {
    const resultEntry = resolved.get(id) || { k: "item", i: id, d: titleCase(splitIdentifier(id)[1]) };
    form.button(raw([translate("ui.wati_codex.open_result"), "\n§8", entryName(resultEntry)]), iconForEntry(resultEntry));
    actions.push(() => showEntry(player, capabilities, resultEntry.k || "item", id, () => showRecipeDetail(player, capabilities, recipe, contextEntry, back)));
  }
  form.button(translate("ui.wati_codex.back"), ICONS.back);
  actions.push(back);
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

function appendIngredient(parts, ingredient, resolved) {
  if (!ingredient) {
    parts.push(translate("ui.wati_codex.unknown"));
    return;
  }
  const count = ingredient.count || 1;
  if (ingredient.type === "item") {
    const entry = resolved.get(ingredient.id);
    parts.push(text(`${count} × `), entry ? entryName(entry) : text(ingredient.id));
    if (entry?.installed === false) parts.push(" §c", translate("ui.wati_codex.not_installed"));
    if (ingredient.data !== undefined) parts.push(text(` [data: ${ingredient.data}]`));
  } else if (ingredient.type === "tag") {
    parts.push(text(`${count} × #${ingredient.tag}`));
  } else {
    parts.push(translate("ui.wati_codex.unknown"));
  }
}

async function showDiagnostics(player, capabilities, back) {
  let result;
  try {
    result = await client.diagnostics("summary");
  } catch {
    await showCoreMissing(player);
    return;
  }
  const counts = result.catalog?.counts || {};
  const schema = result.schema || {};
  const body = raw([
    result.ok ? "§a✓ " : "§c⚠ ",
    translate(result.ok ? "ui.wati_codex.diagnostics_ok" : "ui.wati_codex.diagnostics_issues"),
    "\n\n§7Schema: §f", text(String(schema.active?.catalog ?? capabilities.catalogSchema ?? "?")),
    "\n§7", translate("ui.wati_codex.diagnostics_sources"), ": §f", text(String(counts.sources || 0)),
    "\n§7", translate("ui.wati_codex.diagnostics_stations"), ": §f", text(String(counts.stations || 0)),
    "\n§7", translate("ui.wati_codex.diagnostics_recipes"), ": §f", text(String(counts.recipes || 0)),
    "\n§7", translate("ui.wati_codex.diagnostics_integrity"), ": §f", text(String(counts.integrity || 0)),
    "\n\n§8", translate("ui.wati_codex.diagnostics_note")
  ]);
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.diagnostics_title"))
    .body(body)
    .button(translate("ui.wati_codex.back"), ICONS.back);
  const response = await showForm(player, form);
  if (!response.canceled) await back();
}


async function showProfileSettings(player, capabilities) {
  const state = resolveCodexMode(player);
  const profile = readProfile(player);
  const discovery = getDiscoverySummary(player);
  const exploration = getExplorationSummary(player);
  const parts = [
    "§l", translate("ui.wati_codex.active_mode"), ": §r§f", modeLabel(state.effectiveMode),
    "\n§7", translate("ui.wati_codex.personal_mode"), ": §f", modeLabel(state.profile.mode),
    "\n§7", translate("ui.wati_codex.server_policy"), ": §f",
    state.forced ? modeLabel(state.policy.mode) : translate("ui.wati_codex.policy.player_choice"),
    "\n§7", translate("ui.wati_codex.discovery_notifications"), ": §f",
    translate(profile.discoveryNotifications !== false ? "ui.wati_codex.enabled" : "ui.wati_codex.disabled"),
    "\n§7", translate("ui.wati_codex.discovery_items_known"), ": §f", text(String(discovery.itemCount || 0)),
    "\n§7", translate("ui.wati_codex.discovery_blocks_known"), ": §f", text(String(discovery.blockCount || 0)),
    "\n§7", translate("ui.wati_codex.discovery_entities_known"), ": §f", text(String(discovery.entityCount || 0))
  ];
  if (state.forced) parts.push("\n\n§8", translate("ui.wati_codex.settings_forced"));
  else {
    parts.push("\n\n§7", translate("ui.wati_codex.settings_intro"));
    appendModeDescriptions(parts);
  }
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.profile_settings"))
    .body(raw(parts));
  const actions = [];
  if (!state.forced) {
    for (const mode of Object.values(CODEX_MODES)) {
      form.button(modeButton(mode, state.profile.mode === mode), modeIcon(mode));
      actions.push(async () => {
        writeProfile(player, { mode, welcomeCompleted: true });
        if (mode === CODEX_MODES.ADVENTURE) {
          await syncInventoryDiscoveries(player, { method: "mode_switch", notify: false });
        }
        await showModeSelected(player, capabilities, mode, () => showHome(player, capabilities));
      });
    }
  }
  form.button(raw([
    translate("ui.wati_codex.discovery_notifications"),
    "\n§8", translate(profile.discoveryNotifications !== false ? "ui.wati_codex.enabled" : "ui.wati_codex.disabled")
  ]), ICONS.info);
  actions.push(async () => {
    writeProfile(player, { discoveryNotifications: profile.discoveryNotifications === false });
    await showProfileSettings(player, capabilities);
  });
  form.button(translate("ui.wati_codex.discovery_sync_inventory"), ICONS.inventory);
  actions.push(async () => {
    const result = await syncInventoryDiscoveries(player, { method: "manual_sync", notify: false });
    const confirmation = new ActionFormData()
      .title(translate("ui.wati_codex.discovery_sync_title"))
      .body(translate("ui.wati_codex.discovery_sync_result", [String(result.added), String(result.total), String(result.blockTotal || 0)]))
      .button(translate("ui.wati_codex.continue"), ICONS.inventory);
    await showForm(player, confirmation);
    await showProfileSettings(player, capabilities);
  });
  form.button(translate("ui.wati_codex.home"), ICONS.back);
  actions.push(() => showHome(player, capabilities));
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

export async function openAdminSettings(player) {
  if (!player) return;
  const policy = readServerPolicy();
  const adminBody = [
    translate("ui.wati_codex.admin_intro"),
    "\n\n§l", translate("ui.wati_codex.server_policy"), ": §r§f",
    policy.mode === POLICY_MODES.PLAYER_CHOICE ? translate("ui.wati_codex.policy.player_choice") : modeLabel(policy.mode),
    "\n\n§8", translate("ui.wati_codex.admin_no_delete")
  ];
  appendModeDescriptions(adminBody, true);
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.admin_title"))
    .body(raw(adminBody))
    .button(raw([
      policy.mode === POLICY_MODES.PLAYER_CHOICE ? "§a✓ §f" : "",
      translate("ui.wati_codex.policy.player_choice")
    ]), ICONS.profile)
    .button(modeButton(CODEX_MODES.KNOWLEDGE, policy.mode === CODEX_MODES.KNOWLEDGE), ICONS.knowledge)
    .button(modeButton(CODEX_MODES.EXPLORATION, policy.mode === CODEX_MODES.EXPLORATION), ICONS.exploration)
    .button(modeButton(CODEX_MODES.ADVENTURE, policy.mode === CODEX_MODES.ADVENTURE), ICONS.adventure)
    .button(translate("ui.wati_codex.close"), ICONS.back);
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined || response.selection === 4) return;
  const policies = [
    POLICY_MODES.PLAYER_CHOICE,
    CODEX_MODES.KNOWLEDGE,
    CODEX_MODES.EXPLORATION,
    CODEX_MODES.ADVENTURE
  ];
  const selected = policies[response.selection] || POLICY_MODES.PLAYER_CHOICE;
  writeServerPolicy(selected);
  const confirmation = new ActionFormData()
    .title(translate("ui.wati_codex.admin_saved_title"))
    .body(raw([
      translate("ui.wati_codex.admin_saved"),
      "\n\n§f",
      selected === POLICY_MODES.PLAYER_CHOICE ? translate("ui.wati_codex.policy.player_choice") : modeLabel(selected),
      "\n\n§8", translate("ui.wati_codex.admin_applies_next_open")
    ]))
    .button(translate("ui.wati_codex.close"), ICONS.back);
  await showForm(player, confirmation);
}

async function showAbout(player, capabilities) {
  const counts = capabilities.installedContentCounts || capabilities.contentCounts || {};
  const catalogCounts = capabilities.contentCounts || counts;
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.about_title"))
    .body(raw([
      translate("ui.wati_codex.about_body"),
      "\n\n§7Codex: §fv", text(CODEX_VERSION),
      "\n§7WATI Core: §f", text(capabilities.pack || "?"),
      "\n\n§l", translate("ui.wati_codex.installed_content"), "§r",
      "\n§7", translate("ui.wati_codex.items"), ": §f", text(String(counts.item || 0)),
      "\n§7", translate("ui.wati_codex.blocks"), ": §f", text(String(counts.block || 0)),
      "\n§7", translate("ui.wati_codex.entities"), ": §f", text(String(counts.entity || 0)),
      "\n§7", translate("ui.wati_codex.recipes"), ": §f", text(String(capabilities.installedRecipeCount ?? capabilities.recipeCount ?? 0)),
      "\n§7", translate("ui.wati_codex.sources"), ": §f", text(String(capabilities.installedSourceCount ?? capabilities.sourceCount ?? 0)),
      "\n\n§l", translate("ui.wati_codex.catalog_totals"), "§r",
      "\n§7", translate("ui.wati_codex.items"), ": §f", text(String(catalogCounts.item || 0)),
      "\n§7", translate("ui.wati_codex.blocks"), ": §f", text(String(catalogCounts.block || 0)),
      "\n§7", translate("ui.wati_codex.entities"), ": §f", text(String(catalogCounts.entity || 0)),
      "\n§7", translate("ui.wati_codex.recipes"), ": §f", text(String(capabilities.recipeCount || 0)),
      "\n§7", translate("ui.wati_codex.sources"), ": §f", text(String(capabilities.sourceCount || 0)),
      "\n§7", translate("ui.wati_codex.acquisition_entries"), ": §f", text(String(capabilities.acquisitionEntryCount || 0)),
      "\n§7", translate("ui.wati_codex.acquisition_methods"), ": §f", text(String(capabilities.acquisitionMethodCount || 0)),
      "\n\n§l", translate("ui.wati_codex.active_mode"), ": §r§f", modeLabel(resolveCodexMode(player).effectiveMode),
      "\n\n§l", translate("ui.wati_codex.known_limits_title"), "§r",
      "\n§8", translate("ui.wati_codex.release_limits"),
      "\n§8", translate("ui.wati_codex.known_limits_orientation"),
      "\n§8", translate("ui.wati_codex.known_limits_structures"),
      "\n§8", translate("ui.wati_codex.known_limits_icons")
    ]))
    .button(translate("ui.wati_codex.diagnostics"), ICONS.info)
    .button(translate("ui.wati_codex.home"), ICONS.back);
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  if (response.selection === 0) await showDiagnostics(player, capabilities, () => showAbout(player, capabilities));
  else await showHome(player, capabilities);
}
