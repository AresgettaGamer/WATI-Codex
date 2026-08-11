import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { createCodexClient } from "./wati_client.js";
import { entryName, raw, sourceName, text, titleCase, translate } from "./messages.js";
import { CODEX_MODES, resolveCodexMode } from "./profile.js";
import { recordManualWorldEntry } from "./exploration.js";
import { setOrientationTarget } from "./orientation.js";
import {
  confirmPlace,
  createPlace,
  deletePlace,
  duplicateRadiusFor,
  findNearbyPlaces,
  horizontalDistance,
  listPlaces,
  placeSummary
} from "./places.js";

const client = createCodexClient("wati_codex_places");
const PAGE_SIZE = 10;
const ICONS = Object.freeze({
  biome: "textures/ui/wati_codex/info",
  ecosystem: "textures/ui/wati_codex/addons",
  structure: "textures/ui/wati_codex/station",
  poi: "textures/ui/wati_codex/inventory",
  exploration: "textures/ui/wati_codex/inventory",
  search: "textures/ui/wati_codex/search",
  previous: "textures/ui/wati_codex/previous",
  next: "textures/ui/wati_codex/next",
  back: "textures/ui/wati_codex/back",
  confirm: "textures/ui/wati_codex/info",
  delete: "textures/ui/wati_codex/unknown"
});

const PLACE_CATEGORIES = Object.freeze(["home", "settlement", "portal", "mine", "farm", "resource", "danger", "landmark", "other"]);
const VARIANTS = Object.freeze({
  "minecraft:village": ["plains", "desert", "savanna", "taiga", "snowy", "other"],
  "minecraft:temple": ["desert_pyramid", "jungle_temple", "igloo", "witch_hut", "other"],
  "minecraft:ruins": ["warm_ocean", "cold_ocean", "other"],
  "minecraft:mineshaft": ["normal", "badlands", "other"],
  "minecraft:ruined_portal": ["overworld", "nether", "other"]
});

async function showForm(player, form) {
  try { return await form.show(player); }
  catch (error) {
    try { player.sendMessage(raw([translate("ui.wati_codex.form_error"), text(` ${error}`)])); } catch {}
    return { canceled: true };
  }
}

function dimensionId(player) {
  try { return player.dimension.id; } catch { return "minecraft:overworld"; }
}

function dimensionLabel(value) {
  const id = String(value || "unknown").split(":").at(-1);
  const known = new Set(["overworld", "nether", "the_end"]);
  return translate(`ui.wati_codex.dimension.${known.has(id) ? id : "unknown"}`);
}

function currentBiomeId(player) {
  try { return player.dimension.getBiome(player.location)?.id; } catch { return undefined; }
}

function variantOptions(typeId) {
  return VARIANTS[typeId] || ["none"];
}

function suggestedVariantIndex(typeId, biomeId, currentDimension) {
  const options = variantOptions(typeId);
  const biome = String(biomeId || "").split(":").at(-1);
  const suggestions = {
    "minecraft:village": /desert/.test(biome) ? "desert" : /savanna/.test(biome) ? "savanna" : /taiga/.test(biome) ? "taiga" : /(snow|ice|frozen)/.test(biome) ? "snowy" : "plains",
    "minecraft:temple": /desert/.test(biome) ? "desert_pyramid" : /jungle/.test(biome) ? "jungle_temple" : /(snow|ice|frozen)/.test(biome) ? "igloo" : /swamp/.test(biome) ? "witch_hut" : "other",
    "minecraft:ruins": /warm/.test(biome) ? "warm_ocean" : "cold_ocean",
    "minecraft:mineshaft": /(badlands|mesa)/.test(biome) ? "badlands" : "normal",
    "minecraft:ruined_portal": currentDimension === "minecraft:nether" ? "nether" : "overworld"
  }[typeId];
  const index = options.indexOf(suggestions);
  return index >= 0 ? index : 0;
}

function variantLabel(value) {
  return translate(`ui.wati_codex.place_variant.${value || "none"}`);
}

function categoryLabel(value) {
  return translate(`ui.wati_codex.place_category.${PLACE_CATEGORIES.includes(value) ? value : "other"}`);
}

function visibilityLabel(value) {
  return translate(`ui.wati_codex.place_visibility.${value === "shared" ? "shared" : "personal"}`);
}

function placeIcon(kind) {
  return ICONS[kind] || ICONS.poi;
}

async function resolvePlaceEntry(place) {
  if (!place.typeId || !["biome", "ecosystem", "structure"].includes(place.kind)) return undefined;
  try { return await client.entry(place.kind, place.typeId); }
  catch { return { k: place.kind, i: place.typeId, d: titleCase(place.typeId.split(":").at(-1)) }; }
}

function placeName(place, entry) {
  if (place.name) return text(place.name);
  if (entry) return entryName(entry);
  return text(titleCase(place.typeId || place.category || "Punto de interés"));
}

function registrationInput(player, entry, settings) {
  return {
    kind: entry.k,
    typeId: entry.i,
    name: settings.name,
    category: entry.k,
    dimensionId: dimensionId(player),
    location: player.location,
    variant: settings.variant,
    description: settings.description,
    visibility: settings.visibility,
    biomeId: currentBiomeId(player),
    radius: duplicateRadiusFor(entry)
  };
}

async function finishRegistration(player, entry, input, back, force = false) {
  const duplicates = force ? [] : findNearbyPlaces(player, input);
  if (duplicates.length) {
    await showDuplicateWarning(player, entry, input, duplicates[0], back);
    return;
  }
  try {
    const place = createPlace(player, { ...input, forced: force });
    await recordManualWorldEntry(player, entry.k, entry.i, input.location, input.dimensionId, "manual_registration");
    await showRegistrationSuccess(player, place, entry, back);
  } catch (error) {
    const key = String(error).includes("SHARED") ? "ui.wati_codex.place_shared_limit" : String(error).includes("PERSONAL") ? "ui.wati_codex.place_personal_limit" : "ui.wati_codex.place_save_error";
    const form = new ActionFormData().title(translate("ui.wati_codex.place_register_title")).body(translate(key)).button(translate("ui.wati_codex.back"), ICONS.back);
    const response = await showForm(player, form);
    if (!response.canceled) await back();
  }
}

async function showDuplicateWarning(player, entry, input, duplicate, back) {
  const existingEntry = await resolvePlaceEntry(duplicate);
  const form = new ActionFormData().title(translate("ui.wati_codex.place_duplicate_title")).body(raw([
    translate("ui.wati_codex.place_duplicate_intro"),
    "\n\n§l", placeName(duplicate, existingEntry), "§r",
    "\n§7", translate("ui.wati_codex.place_registered_by"), ": §f", text(duplicate.ownerName),
    "\n§7", translate("ui.wati_codex.coordinates"), ": §f", text(`X ${duplicate.location.x}, Y ${duplicate.location.y}, Z ${duplicate.location.z}`),
    "\n§7", translate("ui.wati_codex.place_distance"), ": §f", text(String(Math.round(duplicate.distance))),
    "\n§7", translate("ui.wati_codex.place_duplicate_radius"), ": §f", text(String(Math.round(Math.max(input.radius, duplicate.radius))))
  ]));
  form.button(translate("ui.wati_codex.place_confirm_same"), ICONS.confirm);
  form.button(translate("ui.wati_codex.place_register_anyway"), ICONS.poi);
  form.button(translate("ui.wati_codex.cancel"), ICONS.back);
  const response = await showForm(player, form);
  if (response.canceled || response.selection === 2 || response.selection === undefined) { await back(); return; }
  if (response.selection === 0) {
    const updated = confirmPlace(player, duplicate.id, duplicate.visibility);
    await recordManualWorldEntry(player, entry.k, entry.i, input.location, input.dimensionId, "community_confirmation");
    await showRegistrationSuccess(player, updated || duplicate, existingEntry || entry, back, true);
    return;
  }
  await finishRegistration(player, entry, input, back, true);
}

async function showRegistrationSuccess(player, place, entry, back, confirmed = false) {
  const form = new ActionFormData().title(translate("ui.wati_codex.place_register_title")).body(raw([
    "§a✓ §f", translate(confirmed ? "ui.wati_codex.place_confirmed" : "ui.wati_codex.place_saved"),
    "\n\n§l", placeName(place, entry), "§r",
    "\n§7", translate("ui.wati_codex.place_visibility_label"), ": §f", visibilityLabel(place.visibility),
    "\n§7", translate("ui.wati_codex.coordinates"), ": §f", text(`X ${place.location.x}, Y ${place.location.y}, Z ${place.location.z}`)
  ])).button(translate("ui.wati_codex.back"), ICONS.back);
  const response = await showForm(player, form);
  if (!response.canceled) await back();
}

export async function showRegisterLinkedEntry(player, entry, back) {
  const variants = variantOptions(entry.i);
  const biomeId = currentBiomeId(player);
  let form = new ModalFormData()
    .title(translate("ui.wati_codex.place_register_title"))
    .textField(translate("ui.wati_codex.place_custom_name"), translate("ui.wati_codex.place_custom_name_placeholder"), { defaultValue: "" });
  if (variants.length > 1 || variants[0] !== "none") {
    form = form.dropdown(translate("ui.wati_codex.place_variant_label"), variants.map(variantLabel), { defaultValueIndex: suggestedVariantIndex(entry.i, biomeId, dimensionId(player)) });
  }
  form = form
    .dropdown(translate("ui.wati_codex.place_visibility_label"), [visibilityLabel("personal"), visibilityLabel("shared")], { defaultValueIndex: 1 })
    .textField(translate("ui.wati_codex.place_notes"), translate("ui.wati_codex.place_notes_placeholder"), { defaultValue: "" })
    .submitButton(translate("ui.wati_codex.place_save"));
  const response = await showForm(player, form);
  if (response.canceled || !Array.isArray(response.formValues)) { await back(); return; }
  let index = 0;
  const name = String(response.formValues[index++] || "").trim().slice(0, 48);
  let variant = "none";
  if (variants.length > 1 || variants[0] !== "none") variant = variants[Number(response.formValues[index++] || 0)] || variants[0];
  const visibility = Number(response.formValues[index++] || 0) === 1 ? "shared" : "personal";
  const description = String(response.formValues[index++] || "").trim().slice(0, 240);
  const input = registrationInput(player, entry, { name, variant, visibility, description });
  await finishRegistration(player, entry, input, back);
}

async function showCatalogRegistrationResults(player, kind, query, page, back) {
  let result;
  try { result = await client.search({ query, kind, installedOnly: true, page, pageSize: PAGE_SIZE }); }
  catch { await back(); return; }
  const form = new ActionFormData().title(translate(`ui.wati_codex.place_choose_${kind}`)).body(raw([
    query ? translate("ui.wati_codex.results_for", [String(query)]) : translate(`ui.wati_codex.place_choose_${kind}_intro`),
    "\n§8", translate("ui.wati_codex.result_count", [String(result.total || 0)]),
    "\n§7", translate("ui.wati_codex.page", [String((result.p || 0) + 1)])
  ]));
  const actions = [];
  for (const entry of result.items || []) {
    form.button(raw([entryName(entry), "\n§8", sourceName(entry)]), placeIcon(kind));
    actions.push(() => showRegisterLinkedEntry(player, entry, () => showCatalogRegistrationResults(player, kind, query, page, back)));
  }
  if ((result.p || 0) > 0) { form.button(translate("ui.wati_codex.previous"), ICONS.previous); actions.push(() => showCatalogRegistrationResults(player, kind, query, page - 1, back)); }
  if (result.more) { form.button(translate("ui.wati_codex.next"), ICONS.next); actions.push(() => showCatalogRegistrationResults(player, kind, query, page + 1, back)); }
  form.button(translate("ui.wati_codex.new_search"), ICONS.search); actions.push(() => showCatalogRegistrationSearch(player, kind, back));
  form.button(translate("ui.wati_codex.back"), ICONS.back); actions.push(back);
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

async function showCatalogRegistrationSearch(player, kind, back) {
  const adventure = resolveCodexMode(player).effectiveMode === CODEX_MODES.ADVENTURE;
  const form = new ModalFormData().title(translate(`ui.wati_codex.place_choose_${kind}`))
    .textField(translate("ui.wati_codex.search_query"), translate(adventure ? "ui.wati_codex.place_adventure_search_placeholder" : "ui.wati_codex.search_placeholder"), { defaultValue: "" })
    .submitButton(translate("ui.wati_codex.search_button"));
  const response = await showForm(player, form);
  if (response.canceled || !Array.isArray(response.formValues)) { await back(); return; }
  const query = String(response.formValues[0] || "").trim();
  if (adventure && !query) {
    const warning = new ActionFormData().title(translate(`ui.wati_codex.place_choose_${kind}`)).body(translate("ui.wati_codex.place_adventure_query_required")).button(translate("ui.wati_codex.back"), ICONS.back);
    const result = await showForm(player, warning);
    if (!result.canceled) await showCatalogRegistrationSearch(player, kind, back);
    return;
  }
  await showCatalogRegistrationResults(player, kind, query, 0, back);
}

async function showRegisterCurrentBiome(player, back) {
  const typeId = currentBiomeId(player);
  if (!typeId) {
    const form = new ActionFormData().title(translate("ui.wati_codex.place_register_biome")).body(translate("ui.wati_codex.place_biome_unavailable")).button(translate("ui.wati_codex.back"), ICONS.back);
    const response = await showForm(player, form);
    if (!response.canceled) await back();
    return;
  }
  let entry;
  try { entry = await client.entry("biome", typeId); }
  catch { entry = { k: "biome", i: typeId, d: titleCase(typeId.split(":").at(-1)) }; }
  await showRegisterLinkedEntry(player, entry, back);
}

async function showCustomPlaceForm(player, back) {
  const form = new ModalFormData().title(translate("ui.wati_codex.place_custom_title"))
    .textField(translate("ui.wati_codex.place_name"), translate("ui.wati_codex.place_name_placeholder"), { defaultValue: "" })
    .dropdown(translate("ui.wati_codex.place_category_label"), PLACE_CATEGORIES.map(categoryLabel), { defaultValueIndex: 0 })
    .dropdown(translate("ui.wati_codex.place_visibility_label"), [visibilityLabel("personal"), visibilityLabel("shared")], { defaultValueIndex: 0 })
    .textField(translate("ui.wati_codex.place_notes"), translate("ui.wati_codex.place_notes_placeholder"), { defaultValue: "" })
    .submitButton(translate("ui.wati_codex.place_save"));
  const response = await showForm(player, form);
  if (response.canceled || !Array.isArray(response.formValues)) { await back(); return; }
  const name = String(response.formValues[0] || "").trim().slice(0, 48);
  if (!name) {
    const warning = new ActionFormData().title(translate("ui.wati_codex.place_custom_title")).body(translate("ui.wati_codex.place_name_required")).button(translate("ui.wati_codex.back"), ICONS.back);
    const result = await showForm(player, warning);
    if (!result.canceled) await showCustomPlaceForm(player, back);
    return;
  }
  const category = PLACE_CATEGORIES[Number(response.formValues[1] || 0)] || "other";
  const visibility = Number(response.formValues[2] || 0) === 1 ? "shared" : "personal";
  const description = String(response.formValues[3] || "").trim().slice(0, 240);
  const input = {
    kind: "poi",
    name,
    category,
    dimensionId: dimensionId(player),
    location: player.location,
    description,
    visibility,
    biomeId: currentBiomeId(player),
    radius: category === "home" || category === "farm" ? 48 : category === "settlement" ? 128 : 64
  };
  const duplicates = findNearbyPlaces(player, input);
  if (duplicates.length) {
    const pseudoEntry = { k: "poi", i: `wati_codex:${category}`, d: name };
    await showDuplicateWarning(player, pseudoEntry, input, duplicates[0], back);
    return;
  }
  try {
    const place = createPlace(player, input);
    await showRegistrationSuccess(player, place, undefined, back);
  } catch {
    const warning = new ActionFormData().title(translate("ui.wati_codex.place_custom_title")).body(translate("ui.wati_codex.place_save_error")).button(translate("ui.wati_codex.back"), ICONS.back);
    const result = await showForm(player, warning);
    if (!result.canceled) await back();
  }
}

export async function showRegisterPlaceMenu(player, capabilities, back) {
  const form = new ActionFormData().title(translate("ui.wati_codex.place_register_title")).body(translate("ui.wati_codex.place_register_intro"));
  const actions = [];
  form.button(translate("ui.wati_codex.place_register_biome"), ICONS.biome); actions.push(() => showRegisterCurrentBiome(player, () => showRegisterPlaceMenu(player, capabilities, back)));
  form.button(translate("ui.wati_codex.place_register_ecosystem"), ICONS.ecosystem); actions.push(() => showCatalogRegistrationSearch(player, "ecosystem", () => showRegisterPlaceMenu(player, capabilities, back)));
  form.button(translate("ui.wati_codex.place_register_structure"), ICONS.structure); actions.push(() => showCatalogRegistrationSearch(player, "structure", () => showRegisterPlaceMenu(player, capabilities, back)));
  form.button(translate("ui.wati_codex.place_register_custom"), ICONS.poi); actions.push(() => showCustomPlaceForm(player, () => showRegisterPlaceMenu(player, capabilities, back)));
  form.button(translate("ui.wati_codex.back"), ICONS.back); actions.push(back);
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

async function showPlaceDetail(player, capabilities, place, entry, back, openEntry) {
  const distance = place.dimensionId === dimensionId(player) ? Math.round(horizontalDistance(place.location, player.location)) : undefined;
  let biomeEntry;
  if (place.biomeId) {
    try { biomeEntry = await client.entry("biome", place.biomeId); } catch {}
  }
  const parts = [
    "§l", placeName(place, entry), "§r",
    entry ? raw(["\n§8", sourceName(entry), "§r"]) : undefined,
    "\n\n§7", translate("ui.wati_codex.place_category_label"), ": §f", place.kind === "poi" ? categoryLabel(place.category) : translate(`ui.wati_codex.kind.${place.kind}`),
    "\n§7", translate("ui.wati_codex.place_visibility_label"), ": §f", visibilityLabel(place.visibility),
    "\n§7", translate("ui.wati_codex.place_registered_by"), ": §f", text(place.ownerName),
    "\n§7", translate("ui.wati_codex.orientation_status"), ": §f", translate(`ui.wati_codex.place_status.${place.status === "rumored" ? "rumored" : "confirmed"}`),
    "\n§7", translate("ui.wati_codex.dimension"), ": §f", dimensionLabel(place.dimensionId),
    "\n§7", translate(place.status === "rumored" ? "ui.wati_codex.orientation_coordinates_approx" : "ui.wati_codex.coordinates"), ": §f", text(`X ${place.location.x}, Y ${place.location.y}, Z ${place.location.z}`),
    distance !== undefined ? raw(["\n§7", translate("ui.wati_codex.place_distance"), ": §f", text(String(distance))]) : undefined,
    place.biomeId ? raw(["\n§7", translate("ui.wati_codex.kind.biome"), ": §f", biomeEntry ? entryName(biomeEntry) : text(titleCase(place.biomeId.split(":").at(-1)))]) : undefined,
    place.variant && place.variant !== "none" ? raw(["\n§7", translate("ui.wati_codex.place_variant_label"), ": §f", variantLabel(place.variant)]) : undefined,
    "\n§7", translate("ui.wati_codex.place_confirmations"), ": §f", text(String(place.confirmations.length)),
    "\n§7", translate("ui.wati_codex.exploration_visits", [String(place.visits)]),
    place.status === "rumored" ? raw(["\n\n§6", translate("ui.wati_codex.orientation_rumor_warning")]) : undefined,
    place.description ? raw(["\n\n§l", translate("ui.wati_codex.place_notes"), "§r\n§f", text(place.description)]) : undefined
  ];
  const form = new ActionFormData().title(translate("ui.wati_codex.place_detail_title")).body(raw(parts));
  const actions = [];
  if (entry && openEntry) { form.button(translate("ui.wati_codex.place_open_codex_entry"), placeIcon(place.kind)); actions.push(() => openEntry(place.kind, place.typeId, () => showPlaceDetail(player, capabilities, place, entry, back, openEntry))); }
  if (place.status === "rumored" && distance !== undefined && distance <= Math.max(64, place.accuracy || place.radius)) {
    form.button(translate("ui.wati_codex.place_verify_rumor"), ICONS.confirm);
    actions.push(async () => {
      const actualBiome = currentBiomeId(player);
      if (place.kind === "biome" && actualBiome === place.typeId) {
        const updated = confirmPlace(player, place.id, place.visibility, {
          status: "confirmed",
          location: player.location,
          biomeId: actualBiome,
          origin: "ritual_verified"
        }) || place;
        await recordManualWorldEntry(player, "biome", place.typeId, player.location, dimensionId(player), "ritual_verification");
        setOrientationTarget(player, {
          typeId: place.typeId,
          dimensionId: dimensionId(player),
          location: player.location,
          status: "confirmed",
          placeId: place.id,
          visibility: place.visibility
        });
        await showPlaceDetail(player, capabilities, updated, entry, back, openEntry);
        return;
      }
      const actualEntry = actualBiome ? await client.entry("biome", actualBiome).catch(() => undefined) : undefined;
      const warning = new ActionFormData().title(translate("ui.wati_codex.place_verify_rumor"))
        .body(raw([
          translate("ui.wati_codex.place_rumor_not_verified"),
          actualBiome ? raw(["\n\n§7", translate("ui.wati_codex.kind.biome"), ": §f", actualEntry ? entryName(actualEntry) : text(titleCase(actualBiome.split(":").at(-1)))]) : undefined
        ]))
        .button(translate("ui.wati_codex.back"), ICONS.back);
      const result = await showForm(player, warning);
      if (!result.canceled) await showPlaceDetail(player, capabilities, place, entry, back, openEntry);
    });
  } else if (place.status !== "rumored" && distance !== undefined && distance <= Math.max(24, place.radius)) {
    form.button(translate("ui.wati_codex.place_confirm_arrival"), ICONS.confirm);
    actions.push(async () => {
      const updated = confirmPlace(player, place.id, place.visibility) || place;
      if (entry && ["biome", "ecosystem", "structure"].includes(place.kind)) await recordManualWorldEntry(player, place.kind, place.typeId, player.location, dimensionId(player), "community_confirmation");
      await showPlaceDetail(player, capabilities, updated, entry, back, openEntry);
    });
  }
  if (place.ownerName === player.name) {
    form.button(translate("ui.wati_codex.place_delete"), ICONS.delete);
    actions.push(() => showDeletePlaceConfirmation(player, capabilities, place, entry, back, openEntry));
  }
  form.button(translate("ui.wati_codex.back"), ICONS.back); actions.push(back);
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

async function showDeletePlaceConfirmation(player, capabilities, place, entry, back, openEntry) {
  const form = new ActionFormData().title(translate("ui.wati_codex.place_delete_title")).body(translate("ui.wati_codex.place_delete_confirm")).button(translate("ui.wati_codex.place_delete"), ICONS.delete).button(translate("ui.wati_codex.cancel"), ICONS.back);
  const response = await showForm(player, form);
  if (response.canceled || response.selection !== 0) { await showPlaceDetail(player, capabilities, place, entry, back, openEntry); return; }
  deletePlace(player, place.id, place.visibility);
  await back();
}

async function showPlaceList(player, capabilities, visibility, page, back, openEntry) {
  const rows = listPlaces(player, { visibility });
  const start = page * PAGE_SIZE;
  const visible = rows.slice(start, start + PAGE_SIZE);
  const enriched = await Promise.all(visible.map(async place => ({ place, entry: await resolvePlaceEntry(place) })));
  const form = new ActionFormData().title(translate(`ui.wati_codex.place_list_${visibility || "all"}`)).body(raw([
    translate("ui.wati_codex.place_list_intro"),
    "\n§8", translate("ui.wati_codex.result_count", [String(rows.length)]),
    "\n§7", translate("ui.wati_codex.page", [String(page + 1)])
  ]));
  const actions = [];
  for (const { place, entry } of enriched) {
    form.button(raw([placeName(place, entry), "\n§8", text(place.ownerName), " §7· ", dimensionLabel(place.dimensionId)]), placeIcon(place.kind));
    actions.push(() => showPlaceDetail(player, capabilities, place, entry, () => showPlaceList(player, capabilities, visibility, page, back, openEntry), openEntry));
  }
  if (page > 0) { form.button(translate("ui.wati_codex.previous"), ICONS.previous); actions.push(() => showPlaceList(player, capabilities, visibility, page - 1, back, openEntry)); }
  if (start + visible.length < rows.length) { form.button(translate("ui.wati_codex.next"), ICONS.next); actions.push(() => showPlaceList(player, capabilities, visibility, page + 1, back, openEntry)); }
  form.button(translate("ui.wati_codex.back"), ICONS.back); actions.push(back);
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}

export async function showPlaceRegistry(player, capabilities, options) {
  const summary = placeSummary(player);
  const back = options.back;
  const openEntry = options.openEntry;
  const form = new ActionFormData().title(translate("ui.wati_codex.place_registry_title")).body(raw([
    translate("ui.wati_codex.place_registry_intro"),
    "\n\n§7", translate("ui.wati_codex.place_personal_count"), ": §f", text(String(summary.personal)),
    "\n§7", translate("ui.wati_codex.place_shared_count"), ": §f", text(String(summary.shared)),
    "\n§7", translate("ui.wati_codex.structures"), ": §f", text(String(summary.structures)),
    "\n§7", translate("ui.wati_codex.ecosystems"), ": §f", text(String(summary.ecosystems)),
    "\n§7", translate("ui.wati_codex.place_custom_count"), ": §f", text(String(summary.custom)),
    "\n§7", translate("ui.wati_codex.place_rumor_count"), ": §f", text(String(summary.rumors || 0))
  ]));
  const actions = [];
  form.button(translate("ui.wati_codex.place_register_title"), ICONS.confirm); actions.push(() => showRegisterPlaceMenu(player, capabilities, () => showPlaceRegistry(player, capabilities, options)));
  form.button(translate("ui.wati_codex.place_list_personal"), ICONS.poi); actions.push(() => showPlaceList(player, capabilities, "personal", 0, () => showPlaceRegistry(player, capabilities, options), openEntry));
  form.button(translate("ui.wati_codex.place_list_shared"), ICONS.structure); actions.push(() => showPlaceList(player, capabilities, "shared", 0, () => showPlaceRegistry(player, capabilities, options), openEntry));
  form.button(translate("ui.wati_codex.place_list_all"), ICONS.exploration || ICONS.poi); actions.push(() => showPlaceList(player, capabilities, undefined, 0, () => showPlaceRegistry(player, capabilities, options), openEntry));
  form.button(translate("ui.wati_codex.back"), ICONS.back); actions.push(back);
  const response = await showForm(player, form);
  if (response.canceled || response.selection === undefined) return;
  const action = actions[response.selection];
  if (action) await action();
}
