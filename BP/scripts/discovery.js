import { system, world } from "@minecraft/server";
import { createCodexClient } from "./wati_client.js";
import { CODEX_MODES, readProfile, resolveCodexMode } from "./profile.js";
import { entryName, raw, translate } from "./messages.js";

const CODEX_ITEM = "wati_codex:codex";
const BUCKET_COUNT = 16;
const ITEM_BUCKET_PREFIX = "wati_codex:discovery_items_v1_";
const BLOCK_BUCKET_PREFIX = "wati_codex:discovery_blocks_v1_";
const ENTITY_BUCKET_PREFIX = "wati_codex:discovery_entities_v1_";
const META_KEY = "wati_codex:discovery_meta_v1";
const DISCOVERY_VERSION = 3;
const DISCOVERY_KINDS = Object.freeze(["item", "block", "entity"]);
const discoveryClient = createCodexClient("wati_codex_discovery");
const playerCaches = new Map();
const pendingDiscoveries = new Map();
const notificationTokens = new Map();
const ACTION_BAR_REFRESHES = 4;
const ACTION_BAR_REFRESH_TICKS = 10;
const IGNORED_ENTITY_TYPES = new Set([
  "minecraft:player", "minecraft:item", "minecraft:xp_orb", "minecraft:falling_block",
  "minecraft:area_effect_cloud", "minecraft:lightning_bolt", "minecraft:fishing_hook",
  "minecraft:arrow", "minecraft:snowball", "minecraft:egg", "minecraft:ender_pearl",
  "minecraft:thrown_trident", "minecraft:fireball", "minecraft:small_fireball",
  "minecraft:dragon_fireball", "minecraft:wither_skull", "minecraft:shulker_bullet",
  "minecraft:fireworks_rocket", "minecraft:eye_of_ender_signal", "minecraft:wind_charge",
  "minecraft:breeze_wind_charge", "minecraft:evocation_fang"
]);
let initialized = false;

function parseJson(value, fallback) {
  if (typeof value !== "string" || !value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function hashIdentifier(typeId) {
  let hash = 2166136261;
  for (let index = 0; index < typeId.length; index++) {
    hash ^= typeId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % BUCKET_COUNT;
}

function defaultMeta() {
  return {
    version: DISCOVERY_VERSION,
    itemCount: 0,
    blockCount: 0,
    entityCount: 0,
    lastItemId: undefined,
    lastBlockId: undefined,
    lastEntityId: undefined,
    lastKind: undefined,
    lastEntryId: undefined,
    lastUpdated: 0,
    inventorySynced: false
  };
}

function cacheFor(player) {
  let cache = playerCaches.get(player.id);
  if (!cache) {
    cache = { buckets: { item: new Map(), block: new Map(), entity: new Map() }, meta: undefined };
    playerCaches.set(player.id, cache);
  }
  return cache;
}

function readMeta(player) {
  const cache = cacheFor(player);
  if (cache.meta) return cache.meta;
  let parsed;
  try {
    parsed = parseJson(player.getDynamicProperty(META_KEY), defaultMeta());
  } catch {
    parsed = defaultMeta();
  }
  cache.meta = {
    version: DISCOVERY_VERSION,
    itemCount: Number.isInteger(parsed.itemCount) && parsed.itemCount >= 0 ? parsed.itemCount : 0,
    blockCount: Number.isInteger(parsed.blockCount) && parsed.blockCount >= 0 ? parsed.blockCount : 0,
    entityCount: Number.isInteger(parsed.entityCount) && parsed.entityCount >= 0 ? parsed.entityCount : 0,
    lastItemId: typeof parsed.lastItemId === "string" ? parsed.lastItemId : undefined,
    lastBlockId: typeof parsed.lastBlockId === "string" ? parsed.lastBlockId : undefined,
    lastEntityId: typeof parsed.lastEntityId === "string" ? parsed.lastEntityId : undefined,
    lastKind: DISCOVERY_KINDS.includes(parsed.lastKind) ? parsed.lastKind : (parsed.lastItemId ? "item" : parsed.lastBlockId ? "block" : undefined),
    lastEntryId: typeof parsed.lastEntryId === "string" ? parsed.lastEntryId : (parsed.lastEntityId || parsed.lastBlockId || parsed.lastItemId),
    lastUpdated: Number.isFinite(parsed.lastUpdated) ? parsed.lastUpdated : 0,
    inventorySynced: parsed.inventorySynced === true
  };
  return cache.meta;
}

function writeMeta(player, patch = {}) {
  const cache = cacheFor(player);
  const next = {
    ...readMeta(player),
    ...patch,
    version: DISCOVERY_VERSION
  };
  cache.meta = next;
  player.setDynamicProperty(META_KEY, JSON.stringify(next));
  return next;
}

function bucketPrefix(kind) {
  if (kind === "block") return BLOCK_BUCKET_PREFIX;
  if (kind === "entity") return ENTITY_BUCKET_PREFIX;
  return ITEM_BUCKET_PREFIX;
}

function readBucket(player, kind, bucketIndex) {
  const cache = cacheFor(player);
  const kindCache = cache.buckets[kind];
  if (kindCache.has(bucketIndex)) return kindCache.get(bucketIndex);
  let parsed;
  try {
    parsed = parseJson(player.getDynamicProperty(`${bucketPrefix(kind)}${bucketIndex}`), {});
  } catch {
    parsed = {};
  }
  const bucket = parsed && !Array.isArray(parsed) ? parsed : {};
  kindCache.set(bucketIndex, bucket);
  return bucket;
}

function writeBucket(player, kind, bucketIndex, bucket) {
  cacheFor(player).buckets[kind].set(bucketIndex, bucket);
  player.setDynamicProperty(`${bucketPrefix(kind)}${bucketIndex}`, JSON.stringify(bucket));
}

function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, " ")
    .trim();
}

function normalizeRecord(kind, typeId, value) {
  const row = Array.isArray(value) ? value : [];
  return {
    kind,
    typeId,
    stage: Number.isInteger(row[0]) ? row[0] : 1,
    discoveredAt: Number.isFinite(row[1]) ? row[1] : 0,
    sourceId: typeof row[2] === "string" && row[2] ? row[2] : typeId.split(":")[0],
    method: typeof row[3] === "string"
      ? row[3]
      : kind === "block"
        ? "block_interaction"
        : kind === "entity"
          ? "entity_interaction"
          : "inventory",
    searchText: typeof row[4] === "string" ? row[4] : normalizeSearch(`${typeId} ${row[2] || ""}`),
    updatedAt: Number.isFinite(row[5]) ? row[5] : (Number.isFinite(row[1]) ? row[1] : 0)
  };
}

export function isEntryDiscovered(player, kind, typeId) {
  if (!player || !DISCOVERY_KINDS.includes(kind) || typeof typeId !== "string") return false;
  const bucket = readBucket(player, kind, hashIdentifier(typeId));
  return Object.prototype.hasOwnProperty.call(bucket, typeId);
}

export function isItemDiscovered(player, typeId) {
  return isEntryDiscovered(player, "item", typeId);
}

export function isBlockDiscovered(player, typeId) {
  return isEntryDiscovered(player, "block", typeId);
}

export function isEntityDiscovered(player, typeId) {
  return isEntryDiscovered(player, "entity", typeId);
}

export function getDiscoveryRecord(player, kind, typeId) {
  if (!isEntryDiscovered(player, kind, typeId)) return undefined;
  const bucket = readBucket(player, kind, hashIdentifier(typeId));
  return normalizeRecord(kind, typeId, bucket[typeId]);
}

function getDiscoveredByKind(player, kind) {
  const rows = [];
  for (let bucketIndex = 0; bucketIndex < BUCKET_COUNT; bucketIndex++) {
    const bucket = readBucket(player, kind, bucketIndex);
    for (const [typeId, value] of Object.entries(bucket)) rows.push(normalizeRecord(kind, typeId, value));
  }
  rows.sort((left, right) => right.updatedAt - left.updatedAt || right.discoveredAt - left.discoveredAt || left.typeId.localeCompare(right.typeId));
  return rows;
}

export function getDiscoveredItems(player) {
  return getDiscoveredByKind(player, "item");
}

export function getDiscoveredBlocks(player) {
  return getDiscoveredByKind(player, "block");
}

export function getDiscoveredEntities(player) {
  return getDiscoveredByKind(player, "entity");
}

export function getDiscoveredEntries(player) {
  return [...getDiscoveredItems(player), ...getDiscoveredBlocks(player), ...getDiscoveredEntities(player)]
    .sort((left, right) => right.updatedAt - left.updatedAt || right.discoveredAt - left.discoveredAt || left.typeId.localeCompare(right.typeId));
}

export function getDiscoverySummary(player) {
  const meta = readMeta(player);
  return {
    version: meta.version,
    itemCount: meta.itemCount,
    blockCount: meta.blockCount,
    entityCount: meta.entityCount,
    totalCount: meta.itemCount + meta.blockCount + meta.entityCount,
    lastItemId: meta.lastItemId,
    lastBlockId: meta.lastBlockId,
    lastEntityId: meta.lastEntityId,
    lastKind: meta.lastKind,
    lastEntryId: meta.lastEntryId,
    lastUpdated: meta.lastUpdated,
    inventorySynced: meta.inventorySynced,
    storageBytes: (() => {
      try {
        return player.getDynamicPropertyTotalByteCount();
      } catch {
        return undefined;
      }
    })()
  };
}

function shouldNotify(player) {
  return resolveCodexMode(player).effectiveMode === CODEX_MODES.ADVENTURE && readProfile(player).discoveryNotifications !== false;
}

function notifyDiscovery(player, entry, upgraded = false) {
  const message = raw([
    "§e✦ §f",
    translate(upgraded ? "ui.wati_codex.discovery_updated" : "ui.wati_codex.discovery_new"),
    ": §a",
    entryName(entry)
  ]);
  const token = (notificationTokens.get(player.id) || 0) + 1;
  notificationTokens.set(player.id, token);
  const display = () => {
    if (notificationTokens.get(player.id) !== token || !shouldNotify(player)) return;
    try {
      player.onScreenDisplay.setActionBar(message);
    } catch {
      try {
        player.sendMessage(message);
      } catch {
        // Player may have disconnected.
      }
    }
  };
  for (let refresh = 0; refresh < ACTION_BAR_REFRESHES; refresh++) {
    system.runTimeout(() => {
      display();
      if (refresh === ACTION_BAR_REFRESHES - 1 && notificationTokens.get(player.id) === token) {
        notificationTokens.delete(player.id);
      }
    }, refresh * ACTION_BAR_REFRESH_TICKS);
  }
}

function validCatalogEntry(entry) {
  return Boolean(entry && (entry.f === true || entry.vr === true || entry.installed === true));
}

async function discoverEntry(player, kind, typeId, options = {}) {
  if (!player || !DISCOVERY_KINDS.includes(kind) || typeof typeId !== "string" || !typeId.includes(":")) return false;
  if (kind === "item" && typeId === CODEX_ITEM) return false;
  const requestedStage = Math.max(1, Math.min(3, Number.isInteger(options.stage) ? options.stage : 1));
  const pendingKey = `${player.id}\u0000${kind}\u0000${typeId}`;
  const previous = pendingDiscoveries.get(pendingKey) || Promise.resolve();
  let releaseTurn;
  const turn = new Promise(resolve => { releaseTurn = resolve; });
  const queued = previous.then(() => turn);
  pendingDiscoveries.set(pendingKey, queued);
  await previous.catch(() => {});
  try {
    const bucketIndex = hashIdentifier(typeId);
    const bucket = readBucket(player, kind, bucketIndex);
    const existing = Object.prototype.hasOwnProperty.call(bucket, typeId)
      ? normalizeRecord(kind, typeId, bucket[typeId])
      : undefined;
    if (existing && requestedStage <= existing.stage) return false;

    let entry;
    try {
      entry = await discoveryClient.entry(kind, typeId);
    } catch {
      return false;
    }
    if (!validCatalogEntry(entry) || entry.installed === false) return false;

    const now = world.getAbsoluteTime();
    const sourceId = entry?.sid || typeId.split(":")[0] || "unknown";
    const searchText = existing?.searchText || normalizeSearch([
      typeId, sourceId, entry?.d, entry?.x, entry?.a, entry?.cat, entry?.grp, ...(entry?.al || [])
    ].filter(Boolean).join(" "));
    const isNew = !existing;
    bucket[typeId] = [
      Math.max(existing?.stage || 0, requestedStage),
      existing?.discoveredAt || now,
      sourceId,
      options.method || existing?.method || (kind === "block" ? "block_interaction" : kind === "entity" ? "entity_interaction" : "inventory"),
      searchText,
      now
    ];
    writeBucket(player, kind, bucketIndex, bucket);

    const meta = readMeta(player);
    const patch = {
      lastKind: kind,
      lastEntryId: typeId,
      lastUpdated: now
    };
    if (kind === "item") {
      patch.itemCount = meta.itemCount + (isNew ? 1 : 0);
      patch.lastItemId = typeId;
    } else if (kind === "block") {
      patch.blockCount = meta.blockCount + (isNew ? 1 : 0);
      patch.lastBlockId = typeId;
    } else {
      patch.entityCount = meta.entityCount + (isNew ? 1 : 0);
      patch.lastEntityId = typeId;
    }
    writeMeta(player, patch);
    if (options.notify !== false && shouldNotify(player)) notifyDiscovery(player, entry, !isNew);
    return true;
  } finally {
    releaseTurn();
    if (pendingDiscoveries.get(pendingKey) === queued) pendingDiscoveries.delete(pendingKey);
  }
}

export async function discoverBlock(player, typeId, options = {}) {
  return discoverEntry(player, "block", typeId, options);
}

export async function discoverEntity(player, typeId, options = {}) {
  if (shouldIgnoreEntityType(typeId)) return false;
  return discoverEntry(player, "entity", typeId, options);
}

export async function discoverItem(player, typeId, options = {}) {
  const changed = await discoverEntry(player, "item", typeId, { ...options, stage: 1 });
  if (changed) {
    system.run(() => {
      discoverBlock(player, typeId, {
        stage: 1,
        method: "block_obtained",
        notify: false
      }).catch(() => {});
    });
  }
  return changed;
}

function inventoryTypeIds(player) {
  const ids = new Set();
  try {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return [];
    for (let slot = 0; slot < inventory.size; slot++) {
      const stack = inventory.getItem(slot);
      if (stack?.typeId && stack.typeId !== CODEX_ITEM) ids.add(stack.typeId);
    }
  } catch {
    return [];
  }
  return [...ids];
}

export async function syncInventoryDiscoveries(player, options = {}) {
  const typeIds = inventoryTypeIds(player).filter(typeId => !isItemDiscovered(player, typeId));
  let added = 0;
  for (let offset = 0; offset < typeIds.length; offset += 4) {
    const batch = typeIds.slice(offset, offset + 4);
    const results = await Promise.all(batch.map(typeId => discoverItem(player, typeId, {
      method: options.method || "inventory_sync",
      notify: options.notify === true
    })));
    added += results.filter(Boolean).length;
  }
  const itemTotal = getDiscoveredItems(player).length;
  const blockTotal = getDiscoveredBlocks(player).length;
  const entityTotal = getDiscoveredEntities(player).length;
  writeMeta(player, {
    itemCount: itemTotal,
    blockCount: blockTotal,
    entityCount: entityTotal,
    inventorySynced: true,
    lastUpdated: world.getAbsoluteTime()
  });
  return { added, total: itemTotal, blockTotal, entityTotal };
}

export function clearDiscoveryCache(playerId) {
  playerCaches.delete(playerId);
}

function isAdventurePlayer(player) {
  try {
    return player?.typeId === "minecraft:player" && resolveCodexMode(player).effectiveMode === CODEX_MODES.ADVENTURE;
  } catch {
    return false;
  }
}

function shouldIgnoreEntityType(typeId) {
  if (typeof typeId !== "string" || !typeId.includes(":")) return true;
  return IGNORED_ENTITY_TYPES.has(typeId);
}

function safeEntityTypeId(entity) {
  try {
    const typeId = entity?.typeId;
    return shouldIgnoreEntityType(typeId) ? undefined : typeId;
  } catch {
    return undefined;
  }
}

export function initializeDiscoveryTracking() {
  if (initialized) return;
  initialized = true;

  world.afterEvents.playerInventoryItemChange.subscribe(event => {
    const player = event.player;
    const after = event.itemStack;
    const before = event.beforeItemStack;
    if (!player || !after?.typeId || !isAdventurePlayer(player)) return;
    if (before?.typeId === after.typeId && Number(after.amount || 0) <= Number(before.amount || 0)) return;
    system.run(() => discoverItem(player, after.typeId, { method: "inventory", notify: true }));
  });

  world.afterEvents.playerInteractWithBlock.subscribe(event => {
    if (!event?.isFirstEvent || !isAdventurePlayer(event.player)) return;
    let typeId;
    try {
      typeId = event.block?.typeId;
    } catch {
      return;
    }
    if (!typeId) return;
    system.run(() => discoverBlock(event.player, typeId, { stage: 1, method: "block_interaction", notify: true }));
  });

  world.afterEvents.playerPlaceBlock.subscribe(event => {
    if (!isAdventurePlayer(event.player)) return;
    let typeId;
    try {
      typeId = event.block?.typeId;
    } catch {
      return;
    }
    if (!typeId) return;
    system.run(() => discoverBlock(event.player, typeId, { stage: 2, method: "block_placed", notify: true }));
  });

  world.afterEvents.playerBreakBlock.subscribe(event => {
    if (!isAdventurePlayer(event.player)) return;
    const typeId = event.brokenBlockPermutation?.type?.id;
    if (!typeId) return;
    system.run(() => discoverBlock(event.player, typeId, { stage: 3, method: "block_broken", notify: true }));
  });


  world.afterEvents.playerInteractWithEntity.subscribe(event => {
    if (!isAdventurePlayer(event.player)) return;
    const typeId = safeEntityTypeId(event.target);
    if (!typeId) return;
    system.run(() => discoverEntity(event.player, typeId, { stage: 1, method: "entity_interaction", notify: true }));
  });

  world.afterEvents.entityHurt.subscribe(event => {
    const hurtEntity = event.hurtEntity;
    const damagingEntity = event.damageSource?.damagingEntity;
    if (isAdventurePlayer(hurtEntity)) {
      const attackerTypeId = safeEntityTypeId(damagingEntity);
      if (attackerTypeId) {
        system.run(() => discoverEntity(hurtEntity, attackerTypeId, { stage: 1, method: "entity_attacked_player", notify: true }));
      }
    }
    if (isAdventurePlayer(damagingEntity)) {
      const targetTypeId = safeEntityTypeId(hurtEntity);
      if (targetTypeId) {
        system.run(() => discoverEntity(damagingEntity, targetTypeId, { stage: 2, method: "entity_fought", notify: true }));
      }
    }
  });

  world.afterEvents.entityDie.subscribe(event => {
    const player = event.damageSource?.damagingEntity;
    if (!isAdventurePlayer(player)) return;
    const typeId = safeEntityTypeId(event.deadEntity);
    if (!typeId) return;
    system.run(() => discoverEntity(player, typeId, { stage: 3, method: "entity_defeated", notify: true }));
  });

  world.afterEvents.playerSpawn.subscribe(event => {
    if (!event.initialSpawn || !isAdventurePlayer(event.player)) return;
    system.runTimeout(() => syncInventoryDiscoveries(event.player, { method: "join_sync", notify: false }), 20);
  });

  world.afterEvents.playerLeave.subscribe(event => {
    clearDiscoveryCache(event.playerId);
    notificationTokens.delete(event.playerId);
  });
}
