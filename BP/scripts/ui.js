import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { createCodexClient } from "./wati_client.js";
import { entryName, raw, sourceListName, sourceName, text, titleCase, translate } from "./messages.js";

const CODEX_ITEM = "wati_codex:codex";
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
  back: "textures/ui/wati_codex/back"
});

function kindLabel(kind) {
  return translate(`ui.wati_codex.kind.${kind || "unknown"}`);
}

function boolLabel(value) {
  return translate(value === true ? "ui.wati_codex.yes" : value === false ? "ui.wati_codex.no" : "ui.wati_codex.unknown");
}

function splitIdentifier(typeId) {
  const index = String(typeId).indexOf(":");
  return index > 0 ? [typeId.slice(0, index), typeId.slice(index + 1)] : ["unknown", String(typeId)];
}

function iconForEntry(entry) {
  if (entry?.k === "block") return ICONS.block;
  if (entry?.k === "entity") return ICONS.entity;
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
    return await client.capabilities();
  } catch {
    await showCoreMissing(player);
    return undefined;
  }
}

export async function startCodex(player) {
  if (!player || activeSessions.has(player.id)) return;
  activeSessions.add(player.id);
  try {
    const capabilities = await ensureCore(player);
    if (!capabilities) return;
    await showHome(player, capabilities);
  } finally {
    activeSessions.delete(player.id);
  }
}

async function showHome(player, capabilities) {
  const counts = capabilities.contentCounts || {};
  const body = raw([
    translate("ui.wati_codex.home_intro"),
    "\n\n§8",
    translate("ui.wati_codex.home_stats", [
      String((counts.item || 0) + (counts.block || 0) + (counts.entity || 0)),
      String(capabilities.recipeCount || 0),
      String(capabilities.sourceCount || 0)
    ]),
    "\n§7WATI Core ", text(capabilities.pack || "?")
  ]);
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.title"))
    .body(body)
    .button(translate("ui.wati_codex.search"), ICONS.search)
    .button(translate("ui.wati_codex.browse_addons"), ICONS.addons)
    .button(translate("ui.wati_codex.browse_inventory"), ICONS.inventory)
    .button(translate("ui.wati_codex.about"), ICONS.info);
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  if (response.selection === 0) await showSearchForm(player, capabilities);
  else if (response.selection === 1) await showSources(player, capabilities, 0);
  else if (response.selection === 2) await showInventory(player, capabilities, 0);
  else if (response.selection === 3) await showAbout(player, capabilities);
}

async function showSearchForm(player, capabilities) {
  const previous = lastSearch.get(player.id) || { query: "", kindIndex: 0, installedOnly: true };
  const form = new ModalFormData()
    .title(translate("ui.wati_codex.search_title"))
    .textField(translate("ui.wati_codex.search_query"), translate("ui.wati_codex.search_placeholder"), { defaultValue: previous.query })
    .dropdown(translate("ui.wati_codex.search_kind"), [
      translate("ui.wati_codex.kind.content"),
      translate("ui.wati_codex.kind.item"),
      translate("ui.wati_codex.kind.block"),
      translate("ui.wati_codex.kind.entity"),
      translate("ui.wati_codex.kind.all")
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
  const kinds = ["content", "item", "block", "entity", undefined];
  const state = { query, kind: kinds[kindIndex], kindIndex, installedOnly, page: 0 };
  lastSearch.set(player.id, state);
  await showSearchResults(player, capabilities, state);
}

async function showSearchResults(player, capabilities, state) {
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
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.results_title"))
    .body(raw([
      translate("ui.wati_codex.results_for", [state.query || translate("ui.wati_codex.everything")]),
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
  form.button(translate("ui.wati_codex.home"), ICONS.back);
  actions.push(() => showHome(player, capabilities));
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

async function showSources(player, capabilities, page) {
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
    actions.push(() => showSearchResults(player, capabilities, {
      query: `@${source.id}`,
      kind: "content",
      kindIndex: 0,
      installedOnly: true,
      page: 0
    }));
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

async function showEntry(player, capabilities, kind, typeId, back) {
  let entry;
  try {
    entry = await client.entry(kind, typeId);
  } catch {
    await showCoreMissing(player);
    return;
  }
  const [namespace] = splitIdentifier(typeId);
  const body = raw([
    "§l", entryName(entry), "§r\n",
    "§8", sourceName(entry), "§r\n\n",
    "§7", translate("ui.wati_codex.identifier"), ": §f", text(typeId), "\n",
    "§7", translate("ui.wati_codex.namespace"), ": §f", text(namespace), "\n",
    "§7", translate("ui.wati_codex.type"), ": §f", kindLabel(kind), "\n",
    "§7", translate("ui.wati_codex.category"), ": §f", text(titleCase(entry.cat || entry.grp || "unknown")), "\n",
    "§7", translate("ui.wati_codex.installed"), ": §f", boolLabel(entry.installed), "\n",
    "§7", translate("ui.wati_codex.recipes"), ": §f", text(String(entry.recipeCount || 0)), "\n",
    "§7", translate("ui.wati_codex.uses"), ": §f", text(String(entry.useCount || 0)),
    entry.tagUsesExcluded ? raw(["\n§8", translate("ui.wati_codex.tag_uses_note")]) : undefined
  ]);
  const form = new ActionFormData().title(translate("ui.wati_codex.entry_title")).body(body);
  const actions = [];
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
  actions.push(() => showSearchResults(player, capabilities, { query: `@${entry.sid || namespace}`, kind: kind === "entity" ? "entity" : "content", kindIndex: kind === "entity" ? 3 : 0, installedOnly: true, page: 0 }));
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
  const tags = Array.isArray(recipe.tags) ? recipe.tags : [];
  const candidates = [
    "crafting_table", "furnace", "smoker", "blast_furnace", "campfire", "stonecutter", "smithing_table", "brewing_stand"
  ];
  let station = candidates.find(value => tags.includes(value));
  if (!station) {
    if (recipe.type === "furnace") station = "furnace";
    else if (recipe.type?.startsWith("smithing")) station = "smithing_table";
    else if (recipe.type === "brewing_mix") station = "brewing_stand";
    else station = tags[0];
  }
  if (!station) return translate("ui.wati_codex.station.unknown");
  if (candidates.includes(station)) return translate(`ui.wati_codex.station.${station}`);
  return text(titleCase(station));
}

function ingredientList(recipe) {
  if (recipe.type === "shaped") return Object.values(recipe.key || {});
  if (recipe.type === "shapeless") return recipe.ingredients || [];
  if (recipe.type === "furnace") return [recipe.input];
  if (recipe.type === "brewing_mix") return [recipe.input, recipe.reagent];
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
      "\n§8", stationMessage(recipe), " §7· ", text(recipe.sourceName || recipe.sourceId || "WATI")
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
  if (recipe.type === "shaped") {
    const layout = shapedLayout(recipe);
    if (layout.width > 3 || layout.height > 3) {
      warnings.push(translate("ui.wati_codex.validation_grid_too_large", [String(layout.width), String(layout.height)]));
    }
  }
  const missingIngredients = [];
  for (const ingredient of ingredients) {
    if (ingredient?.type !== "item" || !ingredient.id) continue;
    const entry = resolved.get(ingredient.id);
    if (entry?.installed === false) missingIngredients.push(entryName(entry));
  }
  if (missingIngredients.length) warnings.push(translate("ui.wati_codex.validation_missing_ingredients", [String(missingIngredients.length)]));
  const missingResults = [];
  for (const result of results) {
    if (!result?.id) continue;
    const entry = resolved.get(result.id);
    if (entry?.installed === false) missingResults.push(entryName(entry));
  }
  if (missingResults.length) warnings.push(translate("ui.wati_codex.validation_missing_result"));
  return warnings;
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
    "§7", translate("ui.wati_codex.source"), ": §f", text(recipe.sourceName || recipe.sourceId || "WATI"), "\n\n"
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
  const validationWarnings = recipeValidation(recipe, ingredients, results, resolved);
  parts.push("\n§l", translate("ui.wati_codex.validation_title"), "§r\n");
  if (!validationWarnings.length) {
    parts.push("§a✓ §f", translate("ui.wati_codex.validation_ok"), "\n");
  } else {
    for (const warning of validationWarnings) parts.push("§c⚠ §f", warning, "\n");
  }
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

async function showAbout(player, capabilities) {
  const counts = capabilities.contentCounts || {};
  const form = new ActionFormData()
    .title(translate("ui.wati_codex.about_title"))
    .body(raw([
      translate("ui.wati_codex.about_body"),
      "\n\n§7Codex: §f1.0.0",
      "\n§7WATI Core: §f", text(capabilities.pack || "?"),
      "\n§7", translate("ui.wati_codex.items"), ": §f", text(String(counts.item || 0)),
      "\n§7", translate("ui.wati_codex.blocks"), ": §f", text(String(counts.block || 0)),
      "\n§7", translate("ui.wati_codex.entities"), ": §f", text(String(counts.entity || 0)),
      "\n§7", translate("ui.wati_codex.recipes"), ": §f", text(String(capabilities.recipeCount || 0)),
      "\n§7", translate("ui.wati_codex.sources"), ": §f", text(String(capabilities.sourceCount || 0)),
      "\n§7", translate("ui.wati_codex.acquisition_entries"), ": §f", text(String(capabilities.acquisitionEntryCount || 0)),
      "\n§7", translate("ui.wati_codex.acquisition_methods"), ": §f", text(String(capabilities.acquisitionMethodCount || 0)),
      "\n\n§8", translate("ui.wati_codex.release_limits")
    ]))
    .button(translate("ui.wati_codex.home"), ICONS.back);
  const response = await showForm(player, form);
  if (!response.canceled) await showHome(player, capabilities);
}
