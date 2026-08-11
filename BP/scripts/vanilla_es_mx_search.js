// Search-only aliases for Minecraft Vanilla identifiers.
// These aliases do not replace Minecraft's client localization; they let WATI Core
// match common es_MX words while the client still renders the official translated name.

const EXACT = Object.freeze({
  "minecraft:air": ["aire"],
  "minecraft:apple": ["manzana"],
  "minecraft:enchanted_golden_apple": ["manzana de oro encantada", "manzana encantada"],
  "minecraft:golden_apple": ["manzana de oro", "manzana dorada"],
  "minecraft:rotten_flesh": ["carne podrida"],
  "minecraft:flint_and_steel": ["pedernal y acero", "mechero"],
  "minecraft:totem_of_undying": ["totem de la inmortalidad", "totem de inmortalidad"],
  "minecraft:experience_bottle": ["frasco con experiencia", "botella de experiencia"],
  "minecraft:dragon_breath": ["aliento de dragon"],
  "minecraft:heart_of_the_sea": ["corazon del mar"],
  "minecraft:nautilus_shell": ["concha de nautilo"],
  "minecraft:firework_rocket": ["cohete de fuegos artificiales"],
  "minecraft:firework_star": ["estrella de fuegos artificiales"],
  "minecraft:name_tag": ["etiqueta de nombre"],
  "minecraft:lead": ["correa", "rienda"],
  "minecraft:recovery_compass": ["brujula de recuperacion"],
  "minecraft:lodestone_compass": ["brujula magnetizada", "brujula de magnetita"],
  "minecraft:carrot_on_a_stick": ["cana con zanahoria"],
  "minecraft:warped_fungus_on_a_stick": ["cana con hongo distorsionado"],
  "minecraft:goat_horn": ["cuerno de cabra"],
  "minecraft:echo_shard": ["fragmento de eco"],
  "minecraft:disc_fragment_5": ["fragmento de disco 5"],
  "minecraft:ominous_bottle": ["botella ominosa"],
  "minecraft:trial_key": ["llave de prueba"],
  "minecraft:ominous_trial_key": ["llave de prueba ominosa"],
  "minecraft:wind_charge": ["carga de viento"],
  "minecraft:heavy_core": ["nucleo pesado"],
  "minecraft:resin_clump": ["grumo de resina"],
  "minecraft:nether_star": ["estrella del nether"],
  "minecraft:end_crystal": ["cristal del end"],
  "minecraft:eye_of_ender": ["ojo de ender"],
  "minecraft:ender_eye": ["ojo de ender"],
  "minecraft:ender_pearl": ["perla de ender"],
  "minecraft:glistering_melon_slice": ["rebanada de sandia reluciente"],
  "minecraft:fermented_spider_eye": ["ojo de arana fermentado"],
  "minecraft:rabbit_foot": ["pata de conejo"],
  "minecraft:rabbit_hide": ["piel de conejo"],
  "minecraft:scute": ["escama de tortuga"],
  "minecraft:armadillo_scute": ["escama de armadillo"],
  "minecraft:turtle_helmet": ["caparazon de tortuga", "casco de tortuga"],
  "minecraft:phantom_membrane": ["membrana de fantasma"],
  "minecraft:prismarine_shard": ["fragmento de prismarina"],
  "minecraft:prismarine_crystals": ["cristales de prismarina"],
  "minecraft:blaze_rod": ["vara de blaze"],
  "minecraft:blaze_powder": ["polvo de blaze"],
  "minecraft:ghast_tear": ["lagrima de ghast"],
  "minecraft:magma_cream": ["crema de magma"],
  "minecraft:nether_wart": ["verruga del nether"],
  "minecraft:music_disc_5": ["disco de musica 5"],
  "minecraft:music_disc_13": ["disco de musica 13"],
  "minecraft:music_disc_cat": ["disco de musica cat"],
  "minecraft:music_disc_pigstep": ["disco de musica pigstep"],
  "minecraft:music_disc_relic": ["disco de musica relic"],
  "minecraft:music_disc_creator": ["disco de musica creator"],
  "minecraft:music_disc_creator_music_box": ["disco de musica creator music box"],
  "minecraft:music_disc_precipice": ["disco de musica precipice"],
  "minecraft:music_disc_tears": ["disco de musica tears"],
  "minecraft:spyglass": ["catalejo"],
  "minecraft:armor_stand": ["soporte para armadura"],
  "minecraft:item_frame": ["marco para objetos"],
  "minecraft:glow_item_frame": ["marco luminoso para objetos"],
  "minecraft:bundle": ["bolsa"],
  "minecraft:gunpowder": ["polvora"],
  "minecraft:crafting_table": ["mesa de trabajo"],
  "minecraft:enchanting_table": ["mesa de encantamientos"],
  "minecraft:smithing_table": ["mesa de herreria"],
  "minecraft:fletching_table": ["mesa de flechas", "mesa de emplumado"],
  "minecraft:cartography_table": ["mesa de cartografia"],
  "minecraft:stonecutter": ["cortapiedras"],
  "minecraft:grindstone": ["afiladora"],
  "minecraft:brewing_stand": ["soporte para pociones"],
  "minecraft:blast_furnace": ["alto horno"],
  "minecraft:smoker": ["ahumador"],
  "minecraft:respawn_anchor": ["ancla de reaparicion"],
  "minecraft:lodestone": ["magnetita"],
  "minecraft:soul_sand": ["arena de almas"],
  "minecraft:soul_soil": ["tierra de almas"],
  "minecraft:ancient_debris": ["escombros ancestrales"],
  "minecraft:crying_obsidian": ["obsidiana llorosa"],
  "minecraft:end_portal_frame": ["marco del portal del end"],
  "minecraft:trial_spawner": ["generador de prueba"],
  "minecraft:vault": ["boveda"],
  "minecraft:ominous_vault": ["boveda ominosa"],
  "minecraft:copper_chest": ["cofre de cobre"],
  "minecraft:chiseled_copper": ["cobre cincelado"],
  "minecraft:copper_grate": ["rejilla de cobre"],
  "minecraft:copper_bulb": ["bombilla de cobre"],
  "minecraft:crafter": ["fabricador"],
  "minecraft:reinforced_deepslate": ["pizarra profunda reforzada"],
  "minecraft:sculk_catalyst": ["catalizador de sculk"],
  "minecraft:sculk_shrieker": ["chillador de sculk"],
  "minecraft:sculk_sensor": ["sensor de sculk"],
  "minecraft:calibrated_sculk_sensor": ["sensor de sculk calibrado"],
  "minecraft:lightning_rod": ["pararrayos"],
  "minecraft:decorated_pot": ["vasija decorada"],
  "minecraft:suspicious_sand": ["arena sospechosa"],
  "minecraft:suspicious_gravel": ["grava sospechosa"],
  "minecraft:sniffer_egg": ["huevo de sniffer"],
  "minecraft:dragon_egg": ["huevo de dragon"],
  "minecraft:frog_spawn": ["huevos de rana"],
  "minecraft:turtle_egg": ["huevo de tortuga"],
  "minecraft:iron_golem": ["golem de hierro"],
  "minecraft:snow_golem": ["golem de nieve"],
  "minecraft:copper_golem": ["golem de cobre"],
  "minecraft:wither_skeleton": ["esqueleto del wither"],
  "minecraft:ender_dragon": ["dragona de ender", "dragon del end"],
  "minecraft:wandering_trader": ["comerciante errante"],
  "minecraft:trader_llama": ["llama de comerciante"],
  "minecraft:zombie_villager": ["aldeano zombi"],
  "minecraft:zombie_villager_v2": ["aldeano zombi"],
  "minecraft:villager_v2": ["aldeano"],
  "minecraft:mushroom_cow": ["champinaca", "vaca de hongos"],
  "minecraft:mooshroom": ["champinaca", "vaca de hongos"],
  "minecraft:elder_guardian": ["guardian anciano"],
  "minecraft:cave_spider": ["arana de cueva"],
  "minecraft:spider_jockey": ["jinete de arana"],
  "minecraft:skeleton_horse": ["caballo esqueletico"],
  "minecraft:zombie_horse": ["caballo zombi"],
  "minecraft:polar_bear": ["oso polar"],
  "minecraft:glow_squid": ["calamar brillante"],
  "minecraft:tropical_fish": ["pez tropical"],
  "minecraft:pufferfish": ["pez globo"],
  "minecraft:ender_mite": ["endermita"],
  "minecraft:piglin_brute": ["piglin bruto"],
  "minecraft:zombified_piglin": ["piglin zombificado"],
  "minecraft:zombie_pigman": ["piglin zombificado", "hombre cerdo zombi"],
  "minecraft:evocation_illager": ["evocador"],
  "minecraft:vindication_illager": ["vindicador"],
  "minecraft:illager_beast": ["devastador"],
  "minecraft:ravager": ["devastador"],
  "minecraft:the_end": ["el end"],
  "minecraft:nether_wastes": ["desiertos del nether"],
  "minecraft:soul_sand_valley": ["valle de arena de almas"],
  "minecraft:warped_forest": ["bosque distorsionado"],
  "minecraft:crimson_forest": ["bosque carmesi"],
  "minecraft:basalt_deltas": ["deltas de basalto"],
  "minecraft:deep_dark": ["oscuridad profunda"],
  "minecraft:lush_caves": ["cuevas frondosas"],
  "minecraft:dripstone_caves": ["cuevas de espeleotemas"],
  "minecraft:pale_garden": ["jardin palido"],
  "minecraft:cherry_grove": ["arboleda de cerezos"]
});

const TOKEN = Object.freeze({
  acacia: ["acacia"], activator: ["activador"], allay: ["allay"], amethyst: ["amatista"], ancient: ["ancestral", "antiguo"],
  andesite: ["andesita"], angler: ["pescador"], anvil: ["yunque"], apple: ["manzana"], armadillo: ["armadillo"], armor: ["armadura"],
  armour: ["armadura"], arrow: ["flecha"], axolotl: ["ajolote"], axe: ["hacha"], azalea: ["azalea"], bamboo: ["bambu"], banner: ["estandarte"],
  barrel: ["barril"], basalt: ["basalto"], bat: ["murcielago"], beacon: ["faro"], bed: ["cama"], bedrock: ["piedra base", "bedrock"], bee: ["abeja"], beef: ["res", "ternera"],
  beehive: ["colmena"], beetroot: ["betabel", "remolacha"], bell: ["campana"], big: ["grande"], birch: ["abedul"], black: ["negro"],
  blackstone: ["piedra negra"], blade: ["hoja"], blast: ["alto"], blaze: ["blaze"], blue: ["azul"], boat: ["bote"], bogged: ["empantanado"],
  bone: ["hueso"], book: ["libro"], bookshelf: ["estanteria"], boots: ["botas"], bottle: ["botella", "frasco"], bow: ["arco"], bowl: ["tazon"],
  brain: ["cerebro"], bread: ["pan"], brick: ["ladrillo"], bricks: ["ladrillos"], brown: ["marron", "cafe"], brush: ["pincel"],
  bucket: ["cubeta", "balde"], bulb: ["bombilla"], button: ["boton"], cactus: ["cactus"], cake: ["pastel", "torta"], calcite: ["calcita"],
  calibrated: ["calibrado"], camel: ["camello"], campfire: ["fogata", "hoguera"], candle: ["vela"], carpet: ["alfombra"], carrot: ["zanahoria"],
  cartography: ["cartografia"], carved: ["tallada"], cat: ["gato"], cave: ["cueva"], chain: ["cadena"], chainmail: ["cota de malla"],
  charcoal: ["carbon vegetal"], cherry: ["cerezo"], chest: ["cofre"], chestplate: ["peto"], chicken: ["pollo"], chiseled: ["cincelado"],
  chorus: ["coral", "chorus"], clay: ["arcilla"], clock: ["reloj"], coal: ["carbon"], cobbled: ["adoquinado"], cobblestone: ["adoquin"],
  cocoa: ["cacao"], cod: ["bacalao"], command: ["comandos"], comparator: ["comparador"], compass: ["brujula"], concrete: ["concreto", "hormigon"],
  conduit: ["canalizador"], cooked: ["cocinado", "cocido"], copper: ["cobre"], coral: ["coral"], cow: ["vaca"], cracked: ["agrietado"],
  crafter: ["fabricador"], crafting: ["trabajo", "fabricacion"], creeper: ["creeper"], crimson: ["carmesi"], crossbow: ["ballesta"], crying: ["llorosa"],
  crystal: ["cristal"], crystals: ["cristales"], cut: ["cortado"], cyan: ["cian"], dark: ["oscuro"], daylight: ["luz solar"], dead: ["muerto"],
  deep: ["profundo"], deepslate: ["pizarra profunda"], detector: ["detector"], diamond: ["diamante"], diorite: ["diorita"], dirt: ["tierra"],
  disc: ["disco"], dispenser: ["dispensador"], dolphin: ["delfin"], donkey: ["burro"], door: ["puerta"], dragon: ["dragon"],
  dried: ["seca", "seco"], dripstone: ["espeleotema"], drowned: ["ahogado"], dye: ["tinte"], egg: ["huevo"], elytra: ["elitros"],
  emerald: ["esmeralda"], enchanted: ["encantado"], enchanting: ["encantamientos"], end: ["end"], ender: ["ender"], enderman: ["enderman"],
  endermite: ["endermita"], exposed: ["expuesto"], eye: ["ojo"], fence: ["valla", "cerca"], fermented: ["fermentado"], fern: ["helecho"],
  fire: ["fuego"], firefly: ["luciernaga"], fishing: ["pesca"], flesh: ["carne"], flint: ["pedernal"], flower: ["flor"], flowing: ["fluyendo"],
  fox: ["zorro"], frame: ["marco"], frog: ["rana"], froglight: ["luz de rana"], frozen: ["congelado"], furnace: ["horno"],
  fungus: ["hongo"], gate: ["puerta", "porton"], ghast: ["ghast"], gilded: ["dorada"], glass: ["vidrio", "cristal"], glazed: ["vidriada"],
  glow: ["brillante", "luminoso"], glowstone: ["piedra luminosa"], goat: ["cabra"], gold: ["oro"], golden: ["oro", "dorado"], golem: ["golem"],
  granite: ["granito"], grass: ["pasto", "hierba"], gravel: ["grava"], gray: ["gris"], green: ["verde"], grindstone: ["afiladora"],
  guardian: ["guardian"], hanging: ["colgante"], harness: ["arnes"], hay: ["heno"], heart: ["corazon"], heavy: ["pesado"], helmet: ["casco"],
  hoe: ["azada"], honey: ["miel"], honeycomb: ["panal"], hopper: ["tolva"], horn: ["cuerno"], horse: ["caballo"],
  husk: ["zombi momificado", "husk"], ice: ["hielo"], infested: ["infestado"], ingot: ["lingote"], iron: ["hierro"], item: ["objeto"],
  jack: ["calabaza"], jigsaw: ["rompecabezas"], jungle: ["jungla"], kelp: ["alga"], key: ["llave"], ladder: ["escalera de mano"],
  lantern: ["linterna"], lapis: ["lapislazuli"], large: ["grande"], lava: ["lava"], lead: ["correa"], leather: ["cuero"],
  leaves: ["hojas"], lectern: ["atril"], leggings: ["pantalones"], lever: ["palanca"], light: ["luz", "claro"], lightning: ["rayo"],
  lilac: ["lila"], lily: ["nenufar"], lime: ["verde lima"], llama: ["llama"], lodestone: ["magnetita"], log: ["tronco"], loom: ["telar"],
  mace: ["maza"], magma: ["magma"], mangrove: ["mangle"], map: ["mapa"], melon: ["sandia"], milk: ["leche"], minecart: ["vagon"],
  moss: ["musgo"], mossy: ["musgoso"], mud: ["barro", "lodo"], mule: ["mula"], mushroom: ["hongo", "champiñon"], music: ["musica"],
  mycelium: ["micelio"], nautilus: ["nautilo"], nether: ["nether"], netherite: ["netherita"], netherrack: ["netherrack"], note: ["musical"],
  nugget: ["pepita"], oak: ["roble"], observer: ["observador"], obsidian: ["obsidiana"], ochre: ["ocre"], ominous: ["ominoso"], orange: ["naranja"],
  oxidized: ["oxidado"], packed: ["compactado"], pale: ["palido"], panda: ["panda"], parrot: ["loro"], pearl: ["perla"],
  painting: ["cuadro", "pintura"], paper: ["papel"], phantom: ["fantasma"], pickaxe: ["pico"], pig: ["cerdo"], piglin: ["piglin"], pillager: ["saqueador"], pink: ["rosa"], piston: ["piston"],
  planks: ["tablones"], plate: ["placa"], podzol: ["podzol"], polished: ["pulido"], porkchop: ["chuleta de cerdo"], portal: ["portal"],
  potato: ["papa", "patata"], potion: ["pocion"], powder: ["polvo"], pressure: ["presion"], prismarine: ["prismarina"], pumpkin: ["calabaza"],
  purple: ["morado", "purpura"], quartz: ["cuarzo"], rabbit: ["conejo"], rail: ["riel"], raw: ["crudo", "en bruto"], red: ["rojo"],
  redstone: ["redstone", "piedra roja"], reinforced: ["reforzado"], repeater: ["repetidor"], resin: ["resina"], rod: ["vara"], roots: ["raices"],
  rose: ["rosa"], rotten: ["podrida"], sand: ["arena"], sandstone: ["arenisca"], sapling: ["retoño"], scaffolding: ["andamio"],
  sculk: ["sculk"], sea: ["mar"], seagrass: ["pasto marino"], seeds: ["semillas"], sensor: ["sensor"], sherd: ["fragmento de ceramica"], shears: ["tijeras"], shield: ["escudo"], shovel: ["pala"],
  shulker: ["shulker"], sign: ["letrero"], silver: ["gris claro", "plata"], skeleton: ["esqueleto"], skull: ["craneo", "cabeza"],
  slab: ["losa"], slime: ["slime", "baba"], small: ["pequeno"], smithing: ["herreria"], smoker: ["ahumador"], smooth: ["liso"],
  sniffer: ["sniffer"], snow: ["nieve"], soul: ["almas"], spawn: ["generador", "aparicion"], spider: ["arana"], sponge: ["esponja"],
  spruce: ["abeto"], stained: ["tintado"], stairs: ["escaleras"], star: ["estrella"], stem: ["tallo"], stone: ["piedra"],
  stonecutter: ["cortapiedras"], stripped: ["sin corteza", "pelado"], suspicious: ["sospechoso"], sweet: ["dulce"], sword: ["espada"],
  stick: ["palo"], string: ["hilo"], sugar: ["azucar"], table: ["mesa"], tadpole: ["renacuajo"], tall: ["alto"], target: ["objetivo", "diana"], terracotta: ["terracota"], tipped: ["con efecto"],
  torch: ["antorcha"], trapdoor: ["trampilla"], trapped: ["trampa"], trident: ["tridente"], tripwire: ["cable trampa"], tropical: ["tropical"],
  turtle: ["tortuga"], tuff: ["toba"], tulip: ["tulipan"], twisted: ["retorcido"], undying: ["inmortalidad"], vault: ["boveda"],
  vine: ["enredadera"], wall: ["muro"], warped: ["distorsionado"], wart: ["verruga"], water: ["agua"], waxed: ["encerado"],
  weathered: ["degradado"], wheat: ["trigo"], white: ["blanco"], wind: ["viento"], wither: ["wither"], wolf: ["lobo"],
  wood: ["madera"], wooden: ["madera"], wool: ["lana"], yellow: ["amarillo"], zombie: ["zombi"]
});

function words(value) {
  return String(value || "")
    .replace(/^minecraft:/, "")
    .replace(/^(item|tile|entity)\./, "")
    .replace(/\.name$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function clean(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function vanillaSpanishAliases(kind, typeId, localizationKey = "") {
  if (!String(typeId || "").startsWith("minecraft:")) return [];
  const result = [];
  for (const alias of EXACT[typeId] || []) result.push(alias);

  const sourceWords = [...words(typeId), ...words(localizationKey)];
  const translated = [];
  for (const word of sourceWords) {
    const aliases = TOKEN[word];
    if (Array.isArray(aliases)) translated.push(...aliases);
  }
  if (translated.length) {
    result.push(translated.join(" "));
    result.push([...new Set(translated)].join(" "));
  }

  if (kind === "entity" && sourceWords.includes("spawn") && sourceWords.includes("egg")) result.push("huevo generador");
  if (sourceWords.includes("spawn") && sourceWords.includes("egg")) result.push("huevo de aparicion");

  const unique = [];
  const seen = new Set();
  for (const value of result) {
    const normalized = clean(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(value);
  }
  return unique.slice(0, 6);
}
