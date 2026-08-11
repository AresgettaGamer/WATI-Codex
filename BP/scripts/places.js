import { world } from "@minecraft/server";

const PERSONAL_PREFIX = "wati_codex:personal_places_v1_";
const SHARED_PREFIX = "wati_codex:shared_places_v1_";
const PERSONAL_BUCKETS = 8;
const SHARED_BUCKETS = 16;
const PERSONAL_LIMIT = 128;
const SHARED_LIMIT = 512;
const MAX_BUCKET_BYTES = 30000;
const personalCache = new Map();
const sharedCache = new Map();

function parseJson(value, fallback) {
  if (typeof value !== "string" || !value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function hash(value, modulo) {
  let result = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index++) {
    result ^= text.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0) % modulo;
}

function personalStore(player) {
  let store = personalCache.get(player.id);
  if (!store) {
    store = new Map();
    personalCache.set(player.id, store);
  }
  return store;
}

function readPersonalBucket(player, index) {
  const cache = personalStore(player);
  if (cache.has(index)) return cache.get(index);
  let value = {};
  try { value = parseJson(player.getDynamicProperty(`${PERSONAL_PREFIX}${index}`), {}); } catch {}
  if (Array.isArray(value)) value = {};
  cache.set(index, value);
  return value;
}

function writePersonalBucket(player, index, value) {
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_BUCKET_BYTES) throw new Error("WATI_PERSONAL_PLACE_BUCKET_FULL");
  personalStore(player).set(index, value);
  player.setDynamicProperty(`${PERSONAL_PREFIX}${index}`, serialized);
}

function readSharedBucket(index) {
  if (sharedCache.has(index)) return sharedCache.get(index);
  let value = {};
  try { value = parseJson(world.getDynamicProperty(`${SHARED_PREFIX}${index}`), {}); } catch {}
  if (Array.isArray(value)) value = {};
  sharedCache.set(index, value);
  return value;
}

function writeSharedBucket(index, value) {
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_BUCKET_BYTES) throw new Error("WATI_SHARED_PLACE_BUCKET_FULL");
  sharedCache.set(index, value);
  world.setDynamicProperty(`${SHARED_PREFIX}${index}`, serialized);
}

function compactRecord(input) {
  return [
    input.kind,
    input.typeId || "",
    input.name || "",
    input.category || input.kind || "other",
    input.dimensionId || "minecraft:overworld",
    Math.round(Number(input.location?.x) || 0),
    Math.round(Number(input.location?.y) || 0),
    Math.round(Number(input.location?.z) || 0),
    input.ownerName || "Unknown",
    Number(input.createdAt) || world.getAbsoluteTime(),
    Number(input.updatedAt) || world.getAbsoluteTime(),
    input.variant || "",
    input.description || "",
    input.visibility === "shared" ? "shared" : "personal",
    input.biomeId || "",
    Array.isArray(input.confirmations) ? input.confirmations.slice(0, 24) : [],
    input.status === "rumored" ? Math.max(0, Number(input.visits) || 0) : Math.max(1, Number(input.visits) || 1),
    Math.max(16, Number(input.radius) || 96),
    input.forced === true,
    input.status === "rumored" ? "rumored" : "confirmed",
    Math.max(0, Number(input.accuracy) || 0),
    typeof input.origin === "string" ? input.origin : "manual"
  ];
}

function normalizeRecord(id, row) {
  const value = Array.isArray(row) ? row : [];
  return {
    id,
    kind: typeof value[0] === "string" ? value[0] : "poi",
    typeId: typeof value[1] === "string" && value[1] ? value[1] : undefined,
    name: typeof value[2] === "string" ? value[2] : "",
    category: typeof value[3] === "string" ? value[3] : "other",
    dimensionId: typeof value[4] === "string" ? value[4] : "minecraft:overworld",
    location: { x: Number(value[5]) || 0, y: Number(value[6]) || 0, z: Number(value[7]) || 0 },
    ownerName: typeof value[8] === "string" ? value[8] : "Unknown",
    createdAt: Number(value[9]) || 0,
    updatedAt: Number(value[10]) || 0,
    variant: typeof value[11] === "string" ? value[11] : "",
    description: typeof value[12] === "string" ? value[12] : "",
    visibility: value[13] === "shared" ? "shared" : "personal",
    biomeId: typeof value[14] === "string" && value[14] ? value[14] : undefined,
    confirmations: Array.isArray(value[15]) ? value[15].filter(name => typeof name === "string").slice(0, 24) : [],
    visits: value[19] === "rumored" ? Math.max(0, Number(value[16]) || 0) : Math.max(1, Number(value[16]) || 1),
    radius: Math.max(16, Number(value[17]) || 96),
    forced: value[18] === true,
    status: value[19] === "rumored" ? "rumored" : "confirmed",
    accuracy: Math.max(0, Number(value[20]) || 0),
    origin: typeof value[21] === "string" ? value[21] : "manual"
  };
}

function countPersonal(player) {
  let total = 0;
  for (let index = 0; index < PERSONAL_BUCKETS; index++) total += Object.keys(readPersonalBucket(player, index)).length;
  return total;
}

function countShared() {
  let total = 0;
  for (let index = 0; index < SHARED_BUCKETS; index++) total += Object.keys(readSharedBucket(index)).length;
  return total;
}

function makeId(player, input) {
  const time = world.getAbsoluteTime();
  const signature = `${player.name}|${input.kind}|${input.typeId || input.name}|${input.dimensionId}|${Math.round(input.location.x)}|${Math.round(input.location.z)}|${time}`;
  return `p${time.toString(36)}${hash(signature, 0xFFFFFF).toString(36)}`;
}

function readAllPersonal(player) {
  const rows = [];
  for (let index = 0; index < PERSONAL_BUCKETS; index++) {
    for (const [id, value] of Object.entries(readPersonalBucket(player, index))) rows.push(normalizeRecord(id, value));
  }
  return rows;
}

function readAllShared() {
  const rows = [];
  for (let index = 0; index < SHARED_BUCKETS; index++) {
    for (const [id, value] of Object.entries(readSharedBucket(index))) rows.push(normalizeRecord(id, value));
  }
  return rows;
}

export function horizontalDistance(left, right) {
  const dx = Number(left?.x || 0) - Number(right?.x || 0);
  const dz = Number(left?.z || 0) - Number(right?.z || 0);
  return Math.sqrt(dx * dx + dz * dz);
}

export function duplicateRadiusFor(entry) {
  const typeId = String(entry?.i || entry?.typeId || "");
  const exact = {
    "minecraft:buried_treasure": 48,
    "minecraft:shipwreck": 80,
    "minecraft:ruined_portal": 96,
    "minecraft:trail_ruins": 112,
    "minecraft:temple": 128,
    "minecraft:ruins": 144,
    "minecraft:pillager_outpost": 160,
    "minecraft:village": 220,
    "minecraft:monument": 220,
    "minecraft:mineshaft": 240,
    "minecraft:trial_chambers": 260,
    "minecraft:ancient_city": 300,
    "minecraft:bastion_remnant": 300,
    "minecraft:end_city": 320,
    "minecraft:mansion": 360,
    "minecraft:fortress": 384,
    "minecraft:stronghold": 512
  }[typeId];
  if (exact) return exact;
  if (entry?.k === "biome") return 384;
  if (entry?.k === "ecosystem") return 192;
  const depth = Number(entry?.depth) || 0;
  const step = String(entry?.step || "");
  if (depth >= 6) return 256;
  if (depth >= 3) return 192;
  if (step.includes("underground")) return 160;
  return 112;
}

export function listPlaces(player, options = {}) {
  const includePersonal = options.visibility !== "shared";
  const includeShared = options.visibility !== "personal";
  let rows = [];
  if (includePersonal) rows.push(...readAllPersonal(player));
  if (includeShared) rows.push(...readAllShared());
  if (options.kind) rows = rows.filter(row => row.kind === options.kind);
  if (options.typeId) rows = rows.filter(row => row.typeId === options.typeId);
  if (options.ownerOnly === true) rows = rows.filter(row => row.ownerName === player.name);
  const query = String(options.query || "").trim().toLowerCase();
  if (query) rows = rows.filter(row => `${row.name} ${row.typeId || ""} ${row.category} ${row.variant} ${row.ownerName} ${row.description}`.toLowerCase().includes(query));
  const seen = new Set();
  return rows.filter(row => {
    const key = `${row.visibility}:${row.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}

export function getPlace(player, id, visibility) {
  if (visibility === "personal") {
    const value = readPersonalBucket(player, hash(id, PERSONAL_BUCKETS))[id];
    return value ? normalizeRecord(id, value) : undefined;
  }
  const value = readSharedBucket(hash(id, SHARED_BUCKETS))[id];
  return value ? normalizeRecord(id, value) : undefined;
}

export function findNearbyPlaces(player, input) {
  const radius = Math.max(16, Number(input.radius) || 96);
  return listPlaces(player, {}).filter(place => {
    if (place.dimensionId !== input.dimensionId) return false;
    if (input.typeId && place.typeId !== input.typeId) return false;
    if (!input.typeId && input.category && place.category !== input.category) return false;
    if (input.variant && input.variant !== "none" && place.variant && place.variant !== "none" && input.variant !== place.variant) return false;
    return horizontalDistance(place.location, input.location) <= Math.max(radius, place.radius || radius);
  }).map(place => ({ ...place, distance: horizontalDistance(place.location, input.location) }))
    .sort((a, b) => a.distance - b.distance);
}

export function createPlace(player, input) {
  const visibility = input.visibility === "shared" ? "shared" : "personal";
  if (visibility === "personal" && countPersonal(player) >= PERSONAL_LIMIT) throw new Error("WATI_PERSONAL_PLACE_LIMIT");
  if (visibility === "shared" && countShared() >= SHARED_LIMIT) throw new Error("WATI_SHARED_PLACE_LIMIT");
  const id = makeId(player, input);
  const now = world.getAbsoluteTime();
  const record = {
    ...input,
    ownerName: player.name,
    visibility,
    createdAt: now,
    updatedAt: now,
    confirmations: input.status === "rumored" ? [] : [player.name],
    visits: input.status === "rumored" ? 0 : 1,
    status: input.status === "rumored" ? "rumored" : "confirmed"
  };
  const compact = compactRecord(record);
  if (visibility === "shared") {
    const index = hash(id, SHARED_BUCKETS);
    const bucket = readSharedBucket(index);
    bucket[id] = compact;
    writeSharedBucket(index, bucket);
  } else {
    const index = hash(id, PERSONAL_BUCKETS);
    const bucket = readPersonalBucket(player, index);
    bucket[id] = compact;
    writePersonalBucket(player, index, bucket);
  }
  return normalizeRecord(id, compact);
}

export function confirmPlace(player, id, visibility, options = {}) {
  const personal = visibility === "personal";
  const index = hash(id, personal ? PERSONAL_BUCKETS : SHARED_BUCKETS);
  const bucket = personal ? readPersonalBucket(player, index) : readSharedBucket(index);
  const current = bucket[id];
  if (!current) return undefined;
  const record = normalizeRecord(id, current);
  if (!record.confirmations.includes(player.name)) record.confirmations.push(player.name);
  record.visits = record.status === "rumored" ? 1 : record.visits + 1;
  record.status = options.status === "rumored" ? "rumored" : "confirmed";
  if (options.location && typeof options.location === "object") {
    record.location = {
      x: Math.round(Number(options.location.x) || 0),
      y: Math.round(Number(options.location.y) || 0),
      z: Math.round(Number(options.location.z) || 0)
    };
  }
  if (typeof options.biomeId === "string" && options.biomeId) record.biomeId = options.biomeId;
  if (typeof options.origin === "string" && options.origin) record.origin = options.origin;
  record.accuracy = record.status === "confirmed" ? 0 : record.accuracy;
  record.updatedAt = world.getAbsoluteTime();
  bucket[id] = compactRecord(record);
  if (personal) writePersonalBucket(player, index, bucket); else writeSharedBucket(index, bucket);
  return normalizeRecord(id, bucket[id]);
}

export function deletePlace(player, id, visibility) {
  const personal = visibility === "personal";
  const index = hash(id, personal ? PERSONAL_BUCKETS : SHARED_BUCKETS);
  const bucket = personal ? readPersonalBucket(player, index) : readSharedBucket(index);
  const current = bucket[id];
  if (!current) return false;
  const record = normalizeRecord(id, current);
  if (record.ownerName !== player.name) return false;
  delete bucket[id];
  if (personal) writePersonalBucket(player, index, bucket); else writeSharedBucket(index, bucket);
  return true;
}

export function placeSummary(player) {
  const personal = readAllPersonal(player);
  const shared = readAllShared();
  return {
    personal: personal.length,
    shared: shared.length,
    structures: [...personal, ...shared].filter(row => row.kind === "structure").length,
    ecosystems: [...personal, ...shared].filter(row => row.kind === "ecosystem").length,
    biomes: [...personal, ...shared].filter(row => row.kind === "biome").length,
    custom: [...personal, ...shared].filter(row => row.kind === "poi").length,
    rumors: [...personal, ...shared].filter(row => row.status === "rumored").length
  };
}

export function clearPlaceCacheForPlayer(playerId) {
  personalCache.delete(playerId);
}

world.afterEvents.playerLeave.subscribe(event => {
  personalCache.delete(event.playerId);
});
