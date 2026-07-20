import { CommandPermissionLevel, CustomCommandStatus, system } from "@minecraft/server";
import { startCodex } from "./ui.js";

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
});

system.run(() => {
  console.info("[WATI Codex] v1.0.0 activa: recetas, usos, procedencia y obtención mediante WATI Core.");
});
