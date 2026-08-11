import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { createCodexClient } from "./wati_client.js";
import { entryName, raw, sourceName, text, titleCase, translate } from "./messages.js";
import { CODEX_MODES, resolveCodexMode } from "./profile.js";
import { getWorldDiscoveryRecord } from "./exploration.js";
import { createPlace, deletePlace, horizontalDistance, listPlaces } from "./places.js";

const client = createCodexClient("wati_codex_orientation");
const TARGET_KEY = "wati_codex:orientation_target_v1";
const RITUAL_LEVEL_COST = 15;
const RITUAL_SEARCH_BOUND = 32768;
const PAGE_SIZE = 10;
const ritualLocks = new Set();

const ICONS = Object.freeze({
  biome: "textures/ui/wati_codex/info",
  ritual: "textures/items/wati_codex",
  search: "textures/ui/wati_codex/search",
  target: "textures/ui/wati_codex/inventory",
  clear: "textures/ui/wati_codex/unknown",
  previous: "textures/ui/wati_codex/previous",
  next: "textures/ui/wati_codex/next",
  back: "textures/ui/wati_codex/back"
});

async function showForm(player, form) {
  try { return await form.show(player); }
  catch (error) {
    try { player.sendMessage(raw([translate("ui.wati_codex.form_error"), text(` ${error}`)])); } catch {}
    return { canceled: true };
  }
}


function automaticBiomeSearchMethod(player) {
  try {
    const dimension = player?.dimension;
    if (typeof dimension?.calculateClosestBiomeFromSeed === "function") return "seed";
    if (typeof dimension?.findClosestBiome === "function") return "nearest";
  } catch {}
  return undefined;
}

function automaticBiomeSearchAvailable(player) {
  return automaticBiomeSearchMethod(player) !== undefined;
}

function currentDimensionId(player) {
  try { return player.dimension.id; } catch { return "minecraft:overworld"; }
}

function currentLevel(player) {
  try { return Math.max(0, Number(player.level) || 0); } catch { return 0; }
}

function parseJson(value) {
  if (typeof value !== "string" || !value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function readOrientationTarget(player) {
  try {
    const value = parseJson(player.getDynamicProperty(TARGET_KEY));
    if (!value || typeof value.typeId !== "string" || !value.typeId) return undefined;
    return {
      kind: value.kind === "biome" ? "biome" : "biome",
      typeId: value.typeId,
      dimensionId: typeof value.dimensionId === "string" ? value.dimensionId : "minecraft:overworld",
      location: {
        x: Number(value.location?.x) || 0,
        y: Number(value.location?.y) || 0,
        z: Number(value.location?.z) || 0
      },
      status: value.status === "rumored" ? "rumored" : "confirmed",
      placeId: typeof value.placeId === "string" ? value.placeId : undefined,
      visibility: value.visibility === "shared" ? "shared" : value.visibility === "personal" ? "personal" : undefined,
      updatedAt: Number(value.updatedAt) || 0
    };
  } catch {
    return undefined;
  }
}

export function setOrientationTarget(player, target) {
  const value = {
    kind: "biome",
    typeId: target.typeId,
    dimensionId: target.dimensionId,
    location: {
      x: Math.round(Number(target.location?.x) || 0),
      y: Math.round(Number(target.location?.y) || 0),
      z: Math.round(Number(target.location?.z) || 0)
    },
    status: target.status === "rumored" ? "rumored" : "confirmed",
    placeId: target.placeId,
    visibility: target.visibility,
    updatedAt: world.getAbsoluteTime()
  };
  player.setDynamicProperty(TARGET_KEY, JSON.stringify(value));
  return value;
}

export function clearOrientationTarget(player) {
  try { player.setDynamicProperty(TARGET_KEY, undefined); } catch {
    try { player.setDynamicProperty(TARGET_KEY, ""); } catch {}
  }
}

function directionName(from, to) {
  const dx = Number(to?.x || 0) - Number(from?.x || 0);
  const dz = Number(to?.z || 0) - Number(from?.z || 0);
  if (Math.abs(dx) < 1 && Math.abs(dz) < 1) return "—";
  const angle = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
  const directions = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
  return directions[Math.round(angle / 45) % 8];
}

function dimensionLabel(value) {
  const id = String(value || "unknown").split(":").at(-1);
  const known = new Set(["overworld", "nether", "the_end"]);
  return translate(`ui.wati_codex.dimension.${known.has(id) ? id : "unknown"}`);
}

function targetDistance(player, target) {
  return currentDimensionId(player) === target.dimensionId
    ? Math.round(horizontalDistance(player.location, target.location))
    : undefined;
}

async function targetEntry(target) {
  try { return await client.entry("biome", target.typeId); }
  catch { return { k: "biome", i: target.typeId, d: titleCase(target.typeId.split(":").at(-1)) }; }
}

export async function showActiveOrientation(player, back) {
  const target = readOrientationTarget(player);
  if (!target) {
    const form = new ActionFormData()
      .title(translate("ui.wati_codex.orientation_title"))
      .body(translate("ui.wati_codex.orientation_no_target"))
      .button(translate("ui.wati_codex.back"), ICONS.back);
    const response = await showForm(player, form);
    if (!response.canceled) await back();
    return;
  }
  const entry = await targetEntry(target);
  const distance = targetDistance(player, target);
  const direction = distance === undefined ? undefined : directionName(player.location, target.location);
  const form = new ActionFormData().title(translate("ui.wati_codex.orientation_target_title")).body(raw([
    "§l", entryName(entry), "§r",
    "\n§8", sourceName(entry), "§r",
    "\n\n§7", translate("ui.wati_codex.orientation_status"), ": §f", translate(`ui.wati_codex.place_status.${target.status}`),
    "\n§7", translate("ui.wati_codex.dimension"), ": §f", dimensionLabel(target.dimensionId),
    "\n§7", translate(target.status === "rumored" ? "ui.wati_codex.orientation_coordinates_approx" : "ui.wati_codex.coordinates"), ": §f",
    text(`X ${target.location.x}, Y ${target.location.y}, Z ${target.location.z}`),
    distance !== undefined ? raw([
      "\n§7", translate("ui.wati_codex.place_distance"), ": §f", text(String(distance)),
      "\n§7", translate("ui.wati_codex.orientation_direction"), ": §f", translate(`ui.wati_codex.direction.${direction}`)
    ]) : raw(["\n§6", translate("ui.wati_codex.orientation_other_dimension")]),
    target.status === "rumored" ? raw(["\n\n§6", translate("ui.wati_codex.orientation_rumor_warning")]) : undefined
  ]));
  const actions = [];
  form.button(translate("ui.wati_codex.orientation_clear"), ICONS.clear); actions.push(async () => { clearOrientationTarget(player); await back(); });
  form.button(translate("ui.wati_codex.back"), ICONS.back); actions.push(back);
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

function knownBiomeLocations(player, typeId) {
  const currentDimension = currentDimensionId(player);
  const rows = listPlaces(player, { kind: "biome", typeId }).map(place => ({
    ...place,
    status: place.status === "rumored" ? "rumored" : "confirmed",
    distance: place.dimensionId === currentDimension ? horizontalDistance(place.location, player.location) : Number.POSITIVE_INFINITY,
    source: place.visibility === "shared" ? "shared" : "personal"
  }));
  const record = getWorldDiscoveryRecord(player, "biome", typeId);
  if (record) {
    rows.push({
      id: undefined,
      kind: "biome",
      typeId,
      dimensionId: record.dimensionId,
      location: record.location,
      status: "confirmed",
      visibility: "personal",
      source: "exploration",
      distance: record.dimensionId === currentDimension ? horizontalDistance(record.location, player.location) : Number.POSITIVE_INFINITY
    });
  }
  rows.sort((a, b) => {
    const dimensionDifference = Number(a.dimensionId !== currentDimension) - Number(b.dimensionId !== currentDimension);
    if (dimensionDifference) return dimensionDifference;
    const statusDifference = Number(a.status === "rumored") - Number(b.status === "rumored");
    if (statusDifference) return statusDifference;
    return a.distance - b.distance;
  });
  return rows;
}

function expectedDimension(entry) {
  return typeof entry?.dim === "string" && entry.dim ? entry.dim : undefined;
}

async function showKnownLocation(player, entry, place, back) {
  const target = setOrientationTarget(player, {
    typeId: entry.i,
    dimensionId: place.dimensionId,
    location: place.location,
    status: place.status,
    placeId: place.id,
    visibility: place.visibility
  });
  const form = new ActionFormData().title(translate("ui.wati_codex.orientation_title")).body(raw([
    place.status === "rumored" ? "§6" : "§a✓ §f",
    translate(place.status === "rumored" ? "ui.wati_codex.orientation_existing_rumor" : "ui.wati_codex.orientation_known_free"),
    "\n\n§l", entryName(entry), "§r",
    "\n§7", translate("ui.wati_codex.dimension"), ": §f", dimensionLabel(target.dimensionId),
    "\n§7", translate(place.status === "rumored" ? "ui.wati_codex.orientation_coordinates_approx" : "ui.wati_codex.coordinates"), ": §f",
    text(`X ${target.location.x}, Y ${target.location.y}, Z ${target.location.z}`),
    "\n\n§8", translate("ui.wati_codex.orientation_target_saved")
  ])).button(translate("ui.wati_codex.orientation_view_target"), ICONS.target)
    .button(translate("ui.wati_codex.back"), ICONS.back);
  const response = await showForm(player, form);
  if (response.canceled) return;
  if (response.selection === 0) await showActiveOrientation(player, back);
  else if (response.selection === 1) await back();
}

async function calculateBiomeLocation(player, typeId) {
  const dimension = player.dimension;
  if (!dimension) return { error: "unavailable" };

  // Prefer the newer seed-based API when it exists.
  if (typeof dimension.calculateClosestBiomeFromSeed === "function") {
    try {
      const location = dimension.calculateClosestBiomeFromSeed(player.location, typeId, {
        boundingSize: { x: RITUAL_SEARCH_BOUND, y: 512, z: RITUAL_SEARCH_BOUND }
      });
      if (location) return { location, method: "seed" };
    } catch (firstError) {
      try {
        const location = dimension.calculateClosestBiomeFromSeed(player.location, typeId);
        if (location) return { location, method: "seed" };
      } catch (secondError) {
        // Continue with the compatibility API when available.
        if (typeof dimension.findClosestBiome !== "function") {
          return { error: "failed", detail: String(secondError || firstError) };
        }
      }
    }
  }

  // Compatibility method used by Biome Compass on a pre-release Script API.
  if (typeof dimension.findClosestBiome === "function") {
    try {
      const location = dimension.findClosestBiome(player.location, typeId);
      return location ? { location, method: "nearest" } : { error: "not_found" };
    } catch (error) {
      return { error: "failed", detail: String(error) };
    }
  }

  return { error: "unavailable" };
}

function roundedRumorLocation(location) {
  return {
    x: Math.round((Number(location?.x) || 0) / 16) * 16,
    y: Math.round(Number(location?.y) || 0),
    z: Math.round((Number(location?.z) || 0) / 16) * 16
  };
}

async function showRitualFailure(player, key, back, detail = undefined) {
  const form = new ActionFormData().title(translate("ui.wati_codex.ritual_title")).body(raw([
    translate(key),
    detail ? raw(["\n\n§8", text(detail.slice(0, 180))]) : undefined
  ])).button(translate("ui.wati_codex.back"), ICONS.back);
  const response = await showForm(player, form);
  if (!response.canceled) await back();
}

async function performRitual(player, entry, back) {
  if (ritualLocks.has(player.id)) return;
  ritualLocks.add(player.id);
  try {
    if (currentLevel(player) < RITUAL_LEVEL_COST) {
      await showRitualFailure(player, "ui.wati_codex.ritual_not_enough_levels", back);
      return;
    }
    const result = await calculateBiomeLocation(player, entry.i);
    if (!result.location) {
      const key = result.error === "unavailable"
        ? "ui.wati_codex.ritual_api_unavailable"
        : result.error === "not_found"
          ? "ui.wati_codex.ritual_not_found"
          : "ui.wati_codex.ritual_failed";
      await showRitualFailure(player, key, back, result.detail);
      return;
    }
    if (currentLevel(player) < RITUAL_LEVEL_COST) {
      await showRitualFailure(player, "ui.wati_codex.ritual_not_enough_levels", back);
      return;
    }
    const location = roundedRumorLocation(result.location);
    let place;
    try {
      place = createPlace(player, {
        kind: "biome",
        typeId: entry.i,
        category: "biome",
        dimensionId: currentDimensionId(player),
        location,
        visibility: "personal",
        biomeId: entry.i,
        radius: 256,
        accuracy: 256,
        status: "rumored",
        origin: result.method === "nearest" ? "ritual_nearest_biome" : "ritual_seed"
      });
    } catch (error) {
      await showRitualFailure(player, String(error).includes("LIMIT") ? "ui.wati_codex.place_personal_limit" : "ui.wati_codex.place_save_error", back);
      return;
    }
    try {
      player.addLevels(-RITUAL_LEVEL_COST);
    } catch (error) {
      deletePlace(player, place.id, place.visibility);
      await showRitualFailure(player, "ui.wati_codex.ritual_charge_failed", back, String(error));
      return;
    }
    setOrientationTarget(player, {
      typeId: entry.i,
      dimensionId: place.dimensionId,
      location: place.location,
      status: "rumored",
      placeId: place.id,
      visibility: place.visibility
    });
    try { player.playSound("random.levelup", { pitch: 0.65, volume: 0.8 }); } catch {}
    const form = new ActionFormData().title(translate("ui.wati_codex.ritual_title")).body(raw([
      "§d✦ §f", translate("ui.wati_codex.ritual_success"),
      "\n\n§l", entryName(entry), "§r",
      "\n§7", translate("ui.wati_codex.dimension"), ": §f", dimensionLabel(place.dimensionId),
      "\n§7", translate("ui.wati_codex.orientation_coordinates_approx"), ": §f", text(`X ${place.location.x}, Y ${place.location.y}, Z ${place.location.z}`),
      "\n§7", translate("ui.wati_codex.ritual_levels_spent"), ": §f", text(String(RITUAL_LEVEL_COST)),
      "\n\n§6", translate("ui.wati_codex.orientation_rumor_warning")
    ])).button(translate("ui.wati_codex.orientation_view_target"), ICONS.target)
      .button(translate("ui.wati_codex.back"), ICONS.back);
    const response = await showForm(player, form);
    if (response.canceled) return;
    if (response.selection === 0) await showActiveOrientation(player, back);
    else if (response.selection === 1) await back();
  } finally {
    ritualLocks.delete(player.id);
  }
}

async function showRitualConfirmation(player, entry, back) {
  const expected = expectedDimension(entry);
  const current = currentDimensionId(player);
  if (expected && expected !== current) {
    const form = new ActionFormData().title(translate("ui.wati_codex.ritual_title")).body(raw([
      translate("ui.wati_codex.ritual_wrong_dimension"),
      "\n\n§7", translate("ui.wati_codex.dimension"), ": §f", dimensionLabel(expected)
    ])).button(translate("ui.wati_codex.back"), ICONS.back);
    const response = await showForm(player, form);
    if (!response.canceled) await back();
    return;
  }
  const form = new ActionFormData().title(translate("ui.wati_codex.ritual_title")).body(raw([
    translate("ui.wati_codex.ritual_intro"),
    "\n\n§l", entryName(entry), "§r",
    "\n§7", translate("ui.wati_codex.ritual_cost"), ": §f", text(String(RITUAL_LEVEL_COST)),
    "\n§7", translate("ui.wati_codex.ritual_current_level"), ": §f", text(String(currentLevel(player))),
    "\n\n§6", translate(automaticBiomeSearchMethod(player) === "nearest" ? "ui.wati_codex.ritual_nearest_warning" : "ui.wati_codex.ritual_seed_warning")
  ])).button(translate("ui.wati_codex.ritual_perform"), ICONS.ritual)
    .button(translate("ui.wati_codex.cancel"), ICONS.back);
  const response = await showForm(player, form);
  if (response.canceled || response.selection !== 0) { await back(); return; }
  await performRitual(player, entry, back);
}

export async function orientToBiomeEntry(player, entry, back) {
  const known = knownBiomeLocations(player, entry.i);
  if (known.length) {
    await showKnownLocation(player, entry, known[0], back);
    return;
  }
  if (!automaticBiomeSearchAvailable(player)) {
    await showRitualFailure(player, "ui.wati_codex.ritual_api_unavailable", back);
    return;
  }
  await showRitualConfirmation(player, entry, back);
}

async function showBiomeResults(player, query, page, back) {
  let result;
  try { result = await client.search({ query, kind: "biome", installedOnly: true, page, pageSize: PAGE_SIZE }); }
  catch {
    await showRitualFailure(player, "ui.wati_codex.ritual_catalog_failed", back);
    return;
  }
  const form = new ActionFormData().title(translate("ui.wati_codex.orientation_choose_biome")).body(raw([
    query ? translate("ui.wati_codex.results_for", [String(query)]) : translate("ui.wati_codex.orientation_choose_biome_intro"),
    "\n§8", translate("ui.wati_codex.result_count", [String(result.total || 0)]),
    "\n§7", translate("ui.wati_codex.page", [String((result.p || 0) + 1)])
  ]));
  const actions = [];
  for (const entry of result.items || []) {
    form.button(raw([entryName(entry), "\n§8", sourceName(entry)]), ICONS.biome);
    actions.push(() => orientToBiomeEntry(player, entry, () => showBiomeResults(player, query, page, back)));
  }
  if ((result.p || 0) > 0) {
    form.button(translate("ui.wati_codex.previous"), ICONS.previous);
    actions.push(() => showBiomeResults(player, query, page - 1, back));
  }
  if (result.more) {
    form.button(translate("ui.wati_codex.next"), ICONS.next);
    actions.push(() => showBiomeResults(player, query, page + 1, back));
  }
  form.button(translate("ui.wati_codex.new_search"), ICONS.search);
  actions.push(() => showBiomeSearch(player, back));
  form.button(translate("ui.wati_codex.back"), ICONS.back);
  actions.push(back);
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

async function showBiomeSearch(player, back) {
  const adventure = resolveCodexMode(player).effectiveMode === CODEX_MODES.ADVENTURE;
  const form = new ModalFormData().title(translate("ui.wati_codex.orientation_choose_biome"))
    .textField(translate("ui.wati_codex.search_query"), translate(adventure ? "ui.wati_codex.orientation_adventure_placeholder" : "ui.wati_codex.search_placeholder"), { defaultValue: "" })
    .submitButton(translate("ui.wati_codex.search_button"));
  const response = await showForm(player, form);
  if (response.canceled || !Array.isArray(response.formValues)) { await back(); return; }
  const query = String(response.formValues[0] || "").trim();
  if (adventure && !query) {
    const warning = new ActionFormData().title(translate("ui.wati_codex.orientation_choose_biome"))
      .body(translate("ui.wati_codex.orientation_adventure_query_required"))
      .button(translate("ui.wati_codex.back"), ICONS.back);
    const result = await showForm(player, warning);
    if (!result.canceled) await showBiomeSearch(player, back);
    return;
  }
  await showBiomeResults(player, query, 0, back);
}

export async function showOrientationMenu(player, back) {
  const target = readOrientationTarget(player);
  const automaticSearch = automaticBiomeSearchAvailable(player);
  const form = new ActionFormData().title(translate("ui.wati_codex.orientation_title")).body(raw([
    translate("ui.wati_codex.orientation_intro"),
    "\n\n", automaticSearch ? "§a✓ §f" : "§6",
    translate(automaticSearch ? "ui.wati_codex.ritual_capability_available" : "ui.wati_codex.ritual_capability_unavailable"),
    automaticSearch ? raw([
      "\n§7", translate("ui.wati_codex.ritual_cost"), ": §f", text(String(RITUAL_LEVEL_COST))
    ]) : raw([
      "\n§8", translate("ui.wati_codex.ritual_preview_note")
    ]),
    "\n§8", translate("ui.wati_codex.orientation_known_locations_free")
  ]));
  const actions = [];
  if (target) {
    form.button(translate("ui.wati_codex.orientation_view_target"), ICONS.target);
    actions.push(() => showActiveOrientation(player, () => showOrientationMenu(player, back)));
  }
  form.button(translate("ui.wati_codex.orientation_find_biome"), ICONS.biome);
  actions.push(() => showBiomeSearch(player, () => showOrientationMenu(player, back)));
  form.button(translate("ui.wati_codex.back"), ICONS.back);
  actions.push(back);
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}
