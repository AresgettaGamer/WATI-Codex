import { system } from "@minecraft/server";

const PROTOCOL_VERSION = 2;
const DEFAULT_TIMEOUT_TICKS = 100;

export function createCodexClient(consumerId = "wati_codex") {
  if (!/^[a-z0-9_.-]{1,64}$/i.test(consumerId)) throw new TypeError("Invalid WATI consumer id.");

  const pending = new Map();
  const entryCache = new Map();
  let sequence = 0;
  let capabilitiesCache;
  let coreVersion;

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
        if (message?.cv !== PROTOCOL_VERSION) return;
        if (coreVersion !== undefined && coreVersion !== message.p) {
          entryCache.clear();
          capabilitiesCache = undefined;
        }
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

  async function sources(options = {}) {
    return request("wati:sources", "wati:sources_result", {
      q: options.query || "",
      p: options.page ?? 0,
      z: options.pageSize ?? 12,
      x: options.installedOnly === true
    });
  }

  async function search(options = {}) {
    const payload = {
      q: options.query || "",
      p: options.page ?? 0,
      z: options.pageSize ?? 10,
      x: options.installedOnly === true
    };
    if (["item", "block", "entity"].includes(options.kind)) payload.k = options.kind;
    return request("wati:search", "wati:search_result", payload);
  }

  async function entry(kind, typeId, force = false) {
    const key = `${kind}\u0000${typeId}`;
    if (!force && entryCache.has(key)) return entryCache.get(key);
    const result = await request("wati:entry", "wati:entry_result", { k: kind, i: typeId });
    entryCache.set(key, result);
    return result;
  }

  async function recipes(typeId, page = 0, pageSize = 3) {
    return request("wati:recipes", "wati:recipes_result", { i: typeId, p: page, z: pageSize });
  }

  async function uses(typeId, page = 0, pageSize = 3) {
    return request("wati:uses", "wati:uses_result", { i: typeId, p: page, z: pageSize });
  }

  async function acquisition(typeId) {
    return request("wati:acquisition", "wati:acquisition_result", { i: typeId });
  }

  return Object.freeze({
    capabilities,
    sources,
    search,
    entry,
    recipes,
    uses,
    acquisition,
    clearCache() {
      entryCache.clear();
      capabilitiesCache = undefined;
    },
    isReady: () => coreVersion !== undefined
  });
}
