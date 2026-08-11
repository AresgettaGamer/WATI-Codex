import { world } from "@minecraft/server";

export const CODEX_MODES = Object.freeze({
  KNOWLEDGE: "knowledge",
  EXPLORATION: "exploration",
  ADVENTURE: "adventure"
});

export const POLICY_MODES = Object.freeze({
  PLAYER_CHOICE: "player_choice",
  ...CODEX_MODES
});

const PROFILE_KEY = "wati_codex:profile_v1";
const POLICY_KEY = "wati_codex:server_policy_v1";
const PROFILE_VERSION = 2;
const POLICY_VERSION = 1;
const VALID_MODES = new Set(Object.values(CODEX_MODES));
const VALID_POLICIES = new Set(Object.values(POLICY_MODES));

function parseJson(value) {
  if (typeof value !== "string" || !value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function normalizeProfile(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    version: PROFILE_VERSION,
    mode: VALID_MODES.has(source.mode) ? source.mode : CODEX_MODES.KNOWLEDGE,
    welcomeCompleted: source.welcomeCompleted === true,
    discoveryNotifications: source.discoveryNotifications !== false,
    updatedAt: Number.isFinite(source.updatedAt) ? source.updatedAt : 0
  };
}

function normalizePolicy(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    version: POLICY_VERSION,
    mode: VALID_POLICIES.has(source.mode) ? source.mode : POLICY_MODES.PLAYER_CHOICE,
    updatedAt: Number.isFinite(source.updatedAt) ? source.updatedAt : 0
  };
}

export function readProfile(player) {
  try {
    return normalizeProfile(parseJson(player.getDynamicProperty(PROFILE_KEY)));
  } catch {
    return normalizeProfile(undefined);
  }
}

export function hasSavedProfile(player) {
  try {
    return typeof player.getDynamicProperty(PROFILE_KEY) === "string";
  } catch {
    return false;
  }
}

export function writeProfile(player, patch = {}) {
  const next = normalizeProfile({
    ...readProfile(player),
    ...patch,
    updatedAt: world.getAbsoluteTime()
  });
  player.setDynamicProperty(PROFILE_KEY, JSON.stringify(next));
  return next;
}

export function readServerPolicy() {
  try {
    return normalizePolicy(parseJson(world.getDynamicProperty(POLICY_KEY)));
  } catch {
    return normalizePolicy(undefined);
  }
}

export function writeServerPolicy(mode) {
  const next = normalizePolicy({
    mode: VALID_POLICIES.has(mode) ? mode : POLICY_MODES.PLAYER_CHOICE,
    updatedAt: world.getAbsoluteTime()
  });
  world.setDynamicProperty(POLICY_KEY, JSON.stringify(next));
  return next;
}

export function resolveCodexMode(player) {
  const profile = readProfile(player);
  const policy = readServerPolicy();
  const forced = policy.mode !== POLICY_MODES.PLAYER_CHOICE;
  return {
    profile,
    policy,
    forced,
    effectiveMode: forced ? policy.mode : profile.mode
  };
}

export function modeIsValid(mode) {
  return VALID_MODES.has(mode);
}
