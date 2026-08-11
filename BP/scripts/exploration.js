import { system, world } from "@minecraft/server";
import { createCodexClient } from "./wati_client.js";
import { CODEX_MODES, readProfile, resolveCodexMode } from "./profile.js";
import { entryName, raw, translate } from "./messages.js";

const BUCKET_COUNT = 8;
const BIOME_PREFIX = "wati_codex:exploration_biomes_v1_";
const ECOSYSTEM_PREFIX = "wati_codex:exploration_ecosystems_v1_";
const STRUCTURE_PREFIX = "wati_codex:exploration_structures_v1_";
const META_KEY = "wati_codex:exploration_meta_v1";
const ROUTE_KEY = "wati_codex:exploration_route_v1";
const ROUTE_LIMIT = 96;
const SCAN_PULSE_TICKS = 20;
const PLAYER_SCAN_COOLDOWN_TICKS = 80;
const STATIONARY_REFRESH_TICKS = 1200;
const MIN_SCAN_DISTANCE_SQUARED = 16;
const SCAN_GROUPS = 4;
const STRUCTURE_CELL_SIZE = 16;
const SAMPLE_OFFSETS = Object.freeze([
  [0, 0, 0], [0, -1, 0], [0, 1, 0], [0, -4, 0], [0, 4, 0], [0, -8, 0], [0, 8, 0],
  [4, 0, 0], [-4, 0, 0], [0, 0, 4], [0, 0, -4],
  [8, 0, 0], [-8, 0, 0], [0, 0, 8], [0, 0, -8],
  [4, -4, 4], [-4, -4, 4], [4, -4, -4], [-4, -4, -4],
  [8, -8, 8], [-8, -8, 8], [8, -8, -8], [-8, -8, -8],
  [4, 4, 4], [-4, 4, 4], [4, 4, -4], [-4, 4, -4]
]);
const client = createCodexClient("wati_codex_exploration");
const caches = new Map();
const currentRegion = new Map();
const lastQueuedScan = new Map();
const lastExplorationSample = new Map();
const lastStructureCell = new Map();
const scansInFlight = new Set();
let ecosystemDefinitions;
let ecosystemSignatureIndex;
let ecosystemDefinitionById;
let loadingDefinitions;
let initialized = false;
let scanCursor = 0;
const noticeSequences = new Map();

function parseJson(value, fallback) {
  if (typeof value !== "string" || !value) return fallback;
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" ? parsed : fallback; }
  catch { return fallback; }
}
function hashIdentifier(typeId) {
  let hash = 2166136261;
  for (let index = 0; index < typeId.length; index++) { hash ^= typeId.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) % BUCKET_COUNT;
}
function cacheFor(player) {
  let cache = caches.get(player.id);
  if (!cache) { cache = { biome: new Map(), ecosystem: new Map(), structure: new Map(), meta: undefined, route: undefined }; caches.set(player.id, cache); }
  return cache;
}
function prefix(kind) { return kind === "ecosystem" ? ECOSYSTEM_PREFIX : kind === "structure" ? STRUCTURE_PREFIX : BIOME_PREFIX; }
function readBucket(player, kind, index) {
  const cache = cacheFor(player)[kind];
  if (cache.has(index)) return cache.get(index);
  let value = {};
  try { value = parseJson(player.getDynamicProperty(`${prefix(kind)}${index}`), {}); } catch {}
  if (Array.isArray(value)) value = {};
  cache.set(index, value);
  return value;
}
function writeBucket(player, kind, index, value) {
  cacheFor(player)[kind].set(index, value);
  player.setDynamicProperty(`${prefix(kind)}${index}`, JSON.stringify(value));
}
function readMeta(player) {
  const cache = cacheFor(player);
  if (cache.meta) return cache.meta;
  let value = {};
  try { value = parseJson(player.getDynamicProperty(META_KEY), {}); } catch {}
  cache.meta = {
    version: 1,
    biomeCount: Number.isInteger(value.biomeCount) ? value.biomeCount : 0,
    ecosystemCount: Number.isInteger(value.ecosystemCount) ? value.ecosystemCount : 0,
    structureCount: Number.isInteger(value.structureCount) ? value.structureCount : 0,
    lastKind: value.lastKind,
    lastId: value.lastId,
    lastUpdated: Number.isFinite(value.lastUpdated) ? value.lastUpdated : 0
  };
  return cache.meta;
}
function writeMeta(player, patch) {
  const next = { ...readMeta(player), ...patch, version: 1 };
  cacheFor(player).meta = next;
  player.setDynamicProperty(META_KEY, JSON.stringify(next));
  return next;
}
function readRoute(player) {
  const cache = cacheFor(player);
  if (cache.route) return cache.route;
  let value = [];
  try { value = parseJson(player.getDynamicProperty(ROUTE_KEY), []); } catch {}
  cache.route = Array.isArray(value) ? value.slice(-ROUTE_LIMIT) : [];
  return cache.route;
}
function appendRoute(player, kind, typeId, location, dimensionId, time) {
  const route = readRoute(player);
  const previous = route.at(-1);
  if (previous?.[0] === kind && previous?.[1] === typeId && previous?.[2] === dimensionId) return;
  route.push([kind, typeId, dimensionId, Math.round(location.x), Math.round(location.y), Math.round(location.z), time]);
  while (route.length > ROUTE_LIMIT) route.shift();
  player.setDynamicProperty(ROUTE_KEY, JSON.stringify(route));
}
function normalizeRecord(kind, typeId, value) {
  const row = Array.isArray(value) ? value : [];
  return {
    kind, typeId,
    firstSeen: Number.isFinite(row[0]) ? row[0] : 0,
    lastSeen: Number.isFinite(row[1]) ? row[1] : 0,
    visits: Number.isInteger(row[2]) ? row[2] : 1,
    dimensionId: typeof row[3] === "string" ? row[3] : "minecraft:overworld",
    location: { x: Number(row[4]) || 0, y: Number(row[5]) || 0, z: Number(row[6]) || 0 },
    sourceId: typeof row[7] === "string" ? row[7] : typeId.split(":")[0],
    method: typeof row[8] === "string" ? row[8] : kind === "biome" ? "biome_visit" : kind === "structure" ? "generated_structure" : "ecosystem_signature"
  };
}
export function isWorldEntryDiscovered(player, kind, typeId) {
  if (!player || !["biome", "ecosystem", "structure"].includes(kind)) return false;
  const bucket = readBucket(player, kind, hashIdentifier(typeId));
  return Object.prototype.hasOwnProperty.call(bucket, typeId);
}
export function getWorldDiscoveryRecord(player, kind, typeId) {
  if (!isWorldEntryDiscovered(player, kind, typeId)) return undefined;
  return normalizeRecord(kind, typeId, readBucket(player, kind, hashIdentifier(typeId))[typeId]);
}
export function getWorldDiscoveries(player, kind) {
  const rows = [];
  for (let i = 0; i < BUCKET_COUNT; i++) for (const [id, value] of Object.entries(readBucket(player, kind, i))) rows.push(normalizeRecord(kind, id, value));
  return rows.sort((a,b) => b.lastSeen-a.lastSeen || a.typeId.localeCompare(b.typeId));
}
export function getExplorationRoute(player) { return [...readRoute(player)].reverse(); }
export function getExplorationSummary(player) {
  const meta = readMeta(player);
  return { ...meta, totalCount: meta.biomeCount + meta.ecosystemCount + meta.structureCount, routeCount: readRoute(player).length };
}
function activePlayer(player) {
  try { const mode = resolveCodexMode(player).effectiveMode; return mode === CODEX_MODES.EXPLORATION || mode === CODEX_MODES.ADVENTURE; }
  catch { return false; }
}
function shouldNotify(player) { return activePlayer(player) && readProfile(player).discoveryNotifications !== false; }
async function notify(player, kind, typeId) {
  if (!shouldNotify(player)) return;
  let entry;
  try { entry = await client.entry(kind, typeId); } catch { entry = { d: typeId.split(":").at(-1) }; }
  const seq = (noticeSequences.get(player.id) || 0) + 1;
  noticeSequences.set(player.id, seq);
  const noticeKey = kind === "biome" ? "ui.wati_codex.exploration_new_biome" : kind === "structure" ? "ui.wati_codex.exploration_new_structure" : "ui.wati_codex.exploration_new_ecosystem";
  const message = raw(["§b✦ §f", translate(noticeKey), ": §a", entryName(entry)]);
  for (const delay of [0, 10, 20, 30]) system.runTimeout(() => {
    if (noticeSequences.get(player.id) !== seq || !shouldNotify(player)) return;
    try { player.onScreenDisplay.setActionBar(message); } catch {}
  }, delay);
}
async function recordWorldEntry(player, kind, typeId, method, location, dimensionId) {
  if (!typeId || !typeId.includes(":")) return false;
  const index = hashIdentifier(typeId);
  const bucket = readBucket(player, kind, index);
  const old = Object.prototype.hasOwnProperty.call(bucket, typeId) ? normalizeRecord(kind, typeId, bucket[typeId]) : undefined;
  const now = world.getAbsoluteTime();
  const regionKey = `${kind}\u0000${typeId}\u0000${dimensionId}`;
  const playerCurrent = currentRegion.get(player.id) ?? new Set();
  const entered = !playerCurrent.has(regionKey);
  playerCurrent.add(regionKey);
  currentRegion.set(player.id, playerCurrent);
  if (old && !entered && now - old.lastSeen < STATIONARY_REFRESH_TICKS) return false;
  bucket[typeId] = [old?.firstSeen || now, now, (old?.visits || 0) + (entered ? 1 : 0), dimensionId,
    Math.round(location.x), Math.round(location.y), Math.round(location.z), typeId.split(":")[0], method];
  writeBucket(player, kind, index, bucket);
  if (!old) {
    const meta = readMeta(player);
    writeMeta(player, { [`${kind}Count`]: (meta[`${kind}Count`] || 0) + 1, lastKind: kind, lastId: typeId, lastUpdated: now });
    appendRoute(player, kind, typeId, location, dimensionId, now);
    notify(player, kind, typeId).catch(()=>{});
    return true;
  }
  return false;
}
export async function recordManualWorldEntry(player, kind, typeId, location = player.location, dimensionId = player.dimension?.id || "minecraft:overworld", method = "manual_registration") {
  if (!["biome", "ecosystem", "structure"].includes(kind)) return false;
  return recordWorldEntry(player, kind, typeId, method, location, dimensionId);
}

async function ensureEcosystemDefinitions() {
  if (ecosystemDefinitions) return ecosystemDefinitions;
  if (loadingDefinitions) return loadingDefinitions;
  loadingDefinitions = (async () => {
    const rows=[];
    for (let page=0; page<4; page++) {
      const result=await client.search({kind:"ecosystem",installedOnly:true,page,pageSize:20});
      rows.push(...(result.items||[]));
      if (!result.more) break;
    }
    ecosystemDefinitions=rows.filter(row=>Array.isArray(row.signatures)&&row.signatures.length);
    const index=new Map();
    const byId=new Map();
    for (const row of ecosystemDefinitions) {
      byId.set(row.i,row);
      for (const blockId of row.signatures) {
        const list=index.get(blockId)||[]; list.push(row); index.set(blockId,list);
      }
    }
    ecosystemSignatureIndex=index;
    ecosystemDefinitionById=byId;
    return ecosystemDefinitions;
  })().catch(()=>{ ecosystemDefinitions=[]; ecosystemSignatureIndex=new Map(); ecosystemDefinitionById=new Map(); return ecosystemDefinitions; }).finally(()=>{loadingDefinitions=undefined;});
  return loadingDefinitions;
}
function dimensionId(player) { try { return player.dimension.id; } catch { return "minecraft:overworld"; } }
function sampleBlocks(player) {
  const found=new Map();
  if (!ecosystemSignatureIndex?.size) return found;
  const base=player.location;
  for (const [dx,dy,dz] of SAMPLE_OFFSETS) {
    try {
      const block=player.dimension.getBlock({x:Math.floor(base.x+dx),y:Math.floor(base.y+dy),z:Math.floor(base.z+dz)});
      const candidates=ecosystemSignatureIndex.get(block?.typeId);
      if (!candidates) continue;
      for (const entry of candidates) found.set(entry.i,(found.get(entry.i)||0)+1);
    } catch {}
  }
  return found;
}
function shouldSamplePlayer(player, location, dimension, now) {
  const previous=lastExplorationSample.get(player.id);
  if (!previous || previous.dimension!==dimension || now-previous.time>=STATIONARY_REFRESH_TICKS) {
    lastExplorationSample.set(player.id,{dimension,x:location.x,z:location.z,time:now});
    return true;
  }
  const dx=location.x-previous.x;
  const dz=location.z-previous.z;
  if (dx*dx+dz*dz<MIN_SCAN_DISTANCE_SQUARED) return false;
  lastExplorationSample.set(player.id,{dimension,x:location.x,z:location.z,time:now});
  return true;
}
function shouldScanStructures(player, location, dimension) {
  const cell=`${dimension}\u0000${Math.floor(location.x/STRUCTURE_CELL_SIZE)}\u0000${Math.floor(location.z/STRUCTURE_CELL_SIZE)}`;
  if (lastStructureCell.get(player.id)===cell) return false;
  lastStructureCell.set(player.id,cell);
  return true;
}
async function scanPlayer(player) {
  if (!activePlayer(player)) {
    currentRegion.delete(player.id);
    lastExplorationSample.delete(player.id);
    lastStructureCell.delete(player.id);
    return;
  }
  const loc=player.location;
  const dim=dimensionId(player);
  if (!shouldSamplePlayer(player,loc,dim,world.getAbsoluteTime())) return;
  const activeKeys=new Set();
  const scanStructures=shouldScanStructures(player,loc,dim);
  if (!scanStructures) {
    for (const key of currentRegion.get(player.id) ?? []) if (key.startsWith("structure\u0000")) activeKeys.add(key);
  }
  try {
    const biome=player.dimension.getBiome(loc);
    if (biome?.id) { activeKeys.add(`biome\u0000${biome.id}\u0000${dim}`); await recordWorldEntry(player,"biome",biome.id,"biome_visit",loc,dim); }
  } catch {}
  await ensureEcosystemDefinitions();
  for (const [id,hits] of sampleBlocks(player)) {
    const entry=ecosystemDefinitionById.get(id);
    if (!entry || (entry.dim && entry.dim!==dim)) continue;
    const required=(entry.confidence||1)>=3?1:2;
    if (hits<required) continue;
    activeKeys.add(`ecosystem\u0000${id}\u0000${dim}`);
    await recordWorldEntry(player,"ecosystem",id,"ecosystem_signature",loc,dim);
  }
  try {
    if (scanStructures && typeof player.dimension.getGeneratedStructures === "function") {
      for (const value of player.dimension.getGeneratedStructures(loc) ?? []) {
        let id = String(value || "").trim();
        if (!id) continue;
        if (!id.includes(":")) id = `minecraft:${id}`;
        activeKeys.add(`structure\u0000${id}\u0000${dim}`);
        await recordWorldEntry(player,"structure",id,"generated_structure",loc,dim);
      }
    }
  } catch {
    // The API is pre-release and may be unavailable or reject unloaded positions.
  }
  currentRegion.set(player.id,activeKeys);
}
function queuePlayerScan(player) {
  const now=world.getAbsoluteTime();
  if (now-(lastQueuedScan.get(player.id) ?? -PLAYER_SCAN_COOLDOWN_TICKS)<PLAYER_SCAN_COOLDOWN_TICKS || scansInFlight.has(player.id)) return;
  lastQueuedScan.set(player.id,now);
  scansInFlight.add(player.id);
  scanPlayer(player).catch(()=>{}).finally(()=>scansInFlight.delete(player.id));
}
export function initializeExplorationTracking() {
  if (initialized) return; initialized=true;
  system.runInterval(() => {
    const players=world.getAllPlayers();
    if (!players.length) { scanCursor=0; return; }
    const count=Math.max(1,Math.ceil(players.length/SCAN_GROUPS));
    for (let offset=0; offset<count; offset++) queuePlayerScan(players[(scanCursor+offset)%players.length]);
    scanCursor=(scanCursor+count)%players.length;
  }, SCAN_PULSE_TICKS);
  world.afterEvents.playerLeave.subscribe(event => {
    caches.delete(event.playerId);
    currentRegion.delete(event.playerId);
    lastQueuedScan.delete(event.playerId);
    lastExplorationSample.delete(event.playerId);
    lastStructureCell.delete(event.playerId);
    scansInFlight.delete(event.playerId);
    noticeSequences.delete(event.playerId);
  });
}
