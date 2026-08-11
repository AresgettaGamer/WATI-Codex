import { system } from "@minecraft/server";

const PROTOCOL_VERSION = 3;
const DEFAULT_TIMEOUT_TICKS = 100;

export function createCodexClient(consumerId = "wati_codex") {
  if (!/^[a-z0-9_.-]{1,64}$/i.test(consumerId)) throw new TypeError("Invalid WATI consumer id.");

  const pending = new Map();
  const entryCache = new Map();
  const sourceCache = new Map();
  const knowledgeCache = new Map();
  let sequence = 0;
  let capabilitiesCache;
  let schemaCache;
  let coreVersion;

  function clearCaches() {
    entryCache.clear();
    sourceCache.clear();
    knowledgeCache.clear();
    capabilitiesCache = undefined;
    schemaCache = undefined;
  }

  function request(eventId, resultId, payload = {}, timeoutTicks = DEFAULT_TIMEOUT_TICKS) {
    const requestId = `c${(++sequence).toString(36)}`;
    return new Promise((resolve, reject) => {
      const timeout = system.runTimeout(() => {
        pending.delete(requestId);
        reject(new Error("WATI_TIMEOUT"));
      }, timeoutTicks);
      pending.set(requestId, { resultId, resolve, reject, timeout });
      try {
        system.sendScriptEvent(eventId, JSON.stringify({
          v: PROTOCOL_VERSION,
          c: consumerId,
          r: requestId,
          ...payload
        }));
      } catch (error) {
        system.clearRun(timeout);
        pending.delete(requestId);
        reject(error);
      }
    });
  }

  system.afterEvents.scriptEventReceive.subscribe(event => {
    if (event.id === "wati:ready") {
      try {
        const message = JSON.parse(event.message);
        const supported = Array.isArray(message?.cvs)
          ? message.cvs.includes(PROTOCOL_VERSION)
          : message?.cvc === PROTOCOL_VERSION || message?.cv === PROTOCOL_VERSION;
        if (!supported) return;
        if (coreVersion !== undefined && coreVersion !== message.p) clearCaches();
        coreVersion = message.p;
      } catch {
        // Ignore invalid announcements.
      }
      return;
    }
    if (!event.id.endsWith("_result")) return;
    try {
      const message = JSON.parse(event.message);
      if (message?.v !== PROTOCOL_VERSION || message.c !== consumerId || typeof message.r !== "string") return;
      const waiter = pending.get(message.r);
      if (!waiter || waiter.resultId !== event.id) return;
      system.clearRun(waiter.timeout);
      pending.delete(message.r);
      waiter.resolve(message);
    } catch {
      // Ignore invalid messages from other packs.
    }
  }, { namespaces: ["wati"] });

  async function capabilities(force = false) {
    if (!force && capabilitiesCache) return capabilitiesCache;
    capabilitiesCache = await request("wati:capabilities", "wati:capabilities_result");
    coreVersion = capabilitiesCache.pack;
    return capabilitiesCache;
  }

  async function schema(force = false) {
    if (!force && schemaCache) return schemaCache;
    schemaCache = await request("wati:schema", "wati:schema_result");
    coreVersion = schemaCache.pack;
    return schemaCache;
  }

  async function sources(options = {}) {
    return request("wati:sources", "wati:sources_result", {
      q: options.query || "",
      p: options.page ?? 0,
      z: options.pageSize ?? 12,
      x: options.installedOnly === true
    });
  }

  async function source(sourceId, force = false) {
    if (typeof sourceId !== "string" || !sourceId) throw new TypeError("Invalid WATI source id.");
    if (!force && sourceCache.has(sourceId)) return sourceCache.get(sourceId);
    const result = await sources({ query: sourceId, page: 0, pageSize: 25, installedOnly: false });
    const exact = (result.items || []).find(row => row.id === sourceId);
    if (!exact) throw new Error("WATI_SOURCE_NOT_FOUND");
    sourceCache.set(sourceId, exact);
    return exact;
  }

  async function search(options = {}) {
    const payload = {
      q: options.query || "",
      p: options.page ?? 0,
      z: options.pageSize ?? 10,
      x: options.installedOnly === true
    };
    if (["content", "item", "block", "entity", "biome", "ecosystem", "structure"].includes(options.kind)) payload.k = options.kind;
    return request("wati:search", "wati:search_result", payload);
  }

  async function entry(kind, typeId, force = false) {
    const key = `${kind}\u0000${typeId}`;
    if (!force && entryCache.has(key)) return entryCache.get(key);
    const result = await request("wati:entry", "wati:entry_result", { k: kind, i: typeId });
    entryCache.set(key, result);
    return result;
  }

  async function recipes(typeId, page = 0, pageSize = 3, installedOnly = true) {
    return request("wati:recipes", "wati:recipes_result", { i: typeId, p: page, z: pageSize, x: installedOnly === true });
  }

  async function uses(typeId, page = 0, pageSize = 3, installedOnly = true) {
    return request("wati:uses", "wati:uses_result", { i: typeId, p: page, z: pageSize, x: installedOnly === true });
  }

  async function acquisition(typeId) {
    return request("wati:acquisition", "wati:acquisition_result", { i: typeId });
  }

  async function knowledge(kind, typeId, force = false) {
    const key = `${kind}\u0000${typeId}`;
    if (!force && knowledgeCache.has(key)) return knowledgeCache.get(key);
    const result = await request("wati:knowledge", "wati:knowledge_result", { k: kind, i: typeId });
    knowledgeCache.set(key, result);
    return result;
  }

  async function diagnostics(section = "summary", page = 0, pageSize = 10) {
    return request("wati:diagnostics", "wati:diagnostics_result", {
      s: section,
      p: page,
      z: pageSize
    }, 160);
  }

  return Object.freeze({
    protocolVersion: PROTOCOL_VERSION,
    capabilities,
    schema,
    sources,
    source,
    search,
    entry,
    recipes,
    uses,
    acquisition,
    knowledge,
    diagnostics,
    clearCache: clearCaches,
    isReady: () => coreVersion !== undefined
  });
}
