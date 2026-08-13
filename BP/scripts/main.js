import { CommandPermissionLevel, CustomCommandStatus, system } from "@minecraft/server";
import { openAdminSettings, startCodex } from "./ui.js";
import { initializeDiscoveryTracking } from "./discovery.js";
import { initializeExplorationTracking } from "./exploration.js";

system.beforeEvents.startup.subscribe(event => {
  event.itemComponentRegistry.registerCustomComponent("wati_codex:open", {
    onUse(useEvent) {
      const player = useEvent.source;
      system.run(() => startCodex(player));
    }
  });

  event.customCommandRegistry.registerCommand({
    name: "wati:codex",
    description: "Open WATI Codex.",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false
  }, origin => {
    const source = origin.sourceEntity;
    if (!source || source.typeId !== "minecraft:player") {
      return { status: CustomCommandStatus.Failure, message: "WATI Codex can only be opened by a player." };
    }
    system.run(() => startCodex(source));
    return { status: CustomCommandStatus.Success };
  });

  event.customCommandRegistry.registerCommand({
    name: "wati:codex_admin",
    description: "Configure the WATI Codex server policy.",
    permissionLevel: CommandPermissionLevel.GameDirectors,
    cheatsRequired: false
  }, origin => {
    const source = origin.sourceEntity;
    if (!source || source.typeId !== "minecraft:player") {
      return { status: CustomCommandStatus.Failure, message: "WATI Codex administration must be opened by an operator player." };
    }
    system.run(() => openAdminSettings(source));
    return { status: CustomCommandStatus.Success };
  });
});

initializeDiscoveryTracking();
initializeExplorationTracking();

system.run(() => {
  console.info("[WATI Codex] v2.1.0 activa: conocimiento enriquecido, botín progresivo, hábitats y exploración optimizada.");
});
