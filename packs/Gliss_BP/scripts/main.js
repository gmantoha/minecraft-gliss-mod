/**
 * GLISS – der reibungsfreie Block
 * ------------------------------------------------------------
 * Nach dem Roman „Gliss. Tödliche Weite“ von Andreas Eschbach
 * (Arena Verlag, 2021). Gliss ist ein Boden, „auf dem nichts haftet“:
 * Reibungskoeffizient μ = 0.
 *
 * Physik, die dieses Skript im Spiel umsetzt:
 *  1. Trägheit (1. Newtonsches Gesetz): Wer Gliss betritt, behält die
 *     Geschwindigkeit, die er beim Betreten hatte – dauerhaft.
 *  2. Keine Steuerung: Ohne Reibung gibt es nichts, wogegen man sich
 *     abstoßen könnte. Laufen/Lenken/Bremsen sind wirkungslos.
 *  3. Impulserhaltung: Wer etwas wegwirft oder abschießt, erhält einen
 *     Rückstoß in die Gegenrichtung (so bewegt man sich im Roman auf Gliss).
 *  4. Stöße: Schläge übertragen Impuls. An einer Wand geht der Anteil quer zur
 *     Wand verloren (unelastischer Stoß), längs rutscht man weiter. Fester Boden
 *     (mit Reibung) und Spinnennetze stoppen einen.
 *
 * Technik: Minecraft Bedrock, @minecraft/server 2.0.0 (stabile API,
 * keine Experimente nötig). Der Block selbst hat "minecraft:friction": 0.0
 * (glatter als Eis). Dieses Skript hält zusätzlich die Geschwindigkeit
 * der Spieler exakt konstant, schaltet ihre Bewegungseingaben ab und
 * simuliert Rückstoß und Abprallen.
 */
import { world, system, InputPermissionCategory, GameMode, ItemStack, EquipmentSlot } from "@minecraft/server";

// ---------------------------------------------------------------- Einstellungen
export const CONFIG = {
  BLOCK_ID: "gliss:gliss_block",
  MAX_SPEED: 1.2,           // Blöcke pro Tick (1.0 = 20 m/s). Schutz vor Absurdem.
  STUCK_SPEED: 0.015,       // darunter gilt man als „festgefahren“ (≈ 0.3 m/s)
  RESTITUTION: 0.0,         // Abprallen an Wänden: 0 = frontal stehen bleiben (nur der Anteil quer zur Wand
                            // geht verloren, längs rutscht man weiter), 0.75 = Flipper-Effekt
  BLOCKED_TICKS: 2,         // so viele Ticks ohne Vorankommen ⇒ Wand ⇒ abprallen
  BLOCKED_RATIO: 0.25,      // „kein Vorankommen“ = weniger als 25 % der erwarteten Strecke
  // Rückstoß (Blöcke/Tick) je geworfenem/geschossenem Objekt. Werte sind
  // Spieldesign, keine echte Massenrechnung – ein Spieler wiegt ~70 kg,
  // ein Schneeball 0,1 kg; realistisch würde man sich kaum bewegen.
  RECOIL: {
    "minecraft:item": 0.06,
    "minecraft:snowball": 0.12,
    "minecraft:egg": 0.12,
    "minecraft:ender_pearl": 0.12,
    "minecraft:arrow": 0.16,
    "minecraft:thrown_trident": 0.22,
    "minecraft:splash_potion": 0.10,
    "minecraft:lingering_potion": 0.10,
    "minecraft:xp_bottle": 0.10,
    "minecraft:fishing_hook": 0.05,
    "minecraft:wind_charge_projectile": 0.15,
  },
  RECOIL_MAX_DISTANCE: 4.0,  // Rückfall ohne Besitzer-Info: Objekt muss so nah am Kopf des Werfers erscheinen
  KICK_VERTICAL: 0.2,        // kleiner Hüpfer beim Abstoßen aus dem Stand (sonst kann der Client
                            // einen rein waagerechten Schubs auf einen stehenden Spieler verschlucken)
  BLOCKED_WINDOW: 4,         // Wand-Erkennung über so viele Ticks (verträgt Messlücken im Netzwerk)
  HIT_IMPULSE: 0.4,          // Impuls durch einen Nahkampfschlag (Blöcke/Tick)
  ENTITIES_SLIDE: true,      // Gegenstände, Tiere und Monster rutschen ebenfalls (endlos)
  ENTITY_SCAN_RADIUS: 48,    // Entities in diesem Umkreis um Spieler werden betrachtet
  WEB_ID: "minecraft:web",   // Spinnennetz: hält alles komplett an und gibt Spielern die Kontrolle zurück
  // Meldungen ---------------------------------------------------------------
  HUD: true,                 // Tempoanzeige über der Hotbar, solange man rutscht
  HUD_EVERY_TICKS: 4,
  CHAT_HINTS: false,         // Chat-Hinweise beim Betreten, Verlassen, Rückstoß (aus = ruhig)
  STUCK_HINT: true,          // Chat-Hinweis, wenn man festhängt
  STUCK_HINT_AFTER_TICKS: 60, // 3 s festgefahren ⇒ Hinweis im Chat
  STUCK_HINT_REPEAT_TICKS: 1200, // höchstens alle 60 s
  ENTER_HINT_REPEAT_TICKS: 600, // Eintritts-Hinweis (falls CHAT_HINTS an) höchstens alle 30 s
  LOADED_MESSAGE: true,      // einmalige Meldung „Add-On aktiv“ beim Start
  QUIET_TAG: "gliss_quiet",  // Spieler mit diesem Tag bekommen weder Chat noch HUD (/tag @s add gliss_quiet)
  DEBUG_TAG: "gliss_debug",
  // Gliss-Laser (Rechtsklick halten, auf Gliss zielen) ---------------------
  LASER_ID: "gliss:laser",
  LASER_RANGE: 12,           // Reichweite des Strahls in Blöcken
  LASER_CUT_TICKS: 40,       // so lange muss der Strahl auf demselben Block liegen (40 = 2 s)
  LASER_WEAR_PER_BLOCK: 1,   // Haltbarkeitsverbrauch je zerlegtem Block
  LASER_DOT_SPACING: 0.4,    // Abstand der Strahl-Punkte
  LASER_PARTICLE: "gliss:laser_dot",  // Spieler mit diesem Tag sehen Rohwerte statt der Tempoanzeige (/tag @s add gliss_debug)
  JUMP_ALLOWED_IN_CREATIVE: false, // true: im Kreativmodus darf man springen/wegfliegen (Doppel-Sprung)
  // Selbstkalibrierung der Knockback-Wirkung (siehe tickSlide):
  MODEL_PRIOR_C: 0.5,        // Startannahme: v' = 0.5·v + F (wie Vanilla-Knockback)
  MODEL_MIN_SAMPLES: 10,     // so viele Messungen, bevor das Modell als „sicher“ gilt
  MODEL_LEARN_RATE_FAST: 0.5,
  MODEL_LEARN_RATE: 0.1,
  PER_TICK_MODEL_C: 0.3,     // darunter „setzt“ Knockback die Geschwindigkeit ⇒ jeden Tick korrigieren
  SPARSE_EVERY_TICKS: 4,     // sonst nur alle 4 Ticks (wartet Netzwerkverzögerung von bis zu 2 Ticks ab)
  DEBUG: false,
};

// ---------------------------------------------------------------- Zustand
/** @type {Map<string, SlideState>} */
const sliders = new Map();
/** letzte Position je Entity: id -> {x,y,z,tick} */
const lastPos = new Map();
/**
 * Selbstkalibrierung für Spieler: Wie wirkt applyKnockback auf die Geschwindigkeit?
 * Modell: v_danach = c · v_davor + F. c ≈ 0 heißt „setzt die Geschwindigkeit“,
 * c ≈ 1 heißt „addiert“. Wird aus Messungen gelernt und in der Welt gespeichert.
 */
let modelC = CONFIG.MODEL_PRIOR_C;
let modelSamples = 0;
/** letzter Eintritts-Hinweis je Spieler (Chat nicht zuspammen) */
const lastEnterMsg = new Map();
let tick = 0;
let announced = false;

/**
 * @typedef {object} SlideState
 * @property {import("@minecraft/server").Entity} entity
 * @property {boolean} isPlayer
 * @property {number} vx  Sollgeschwindigkeit x (Blöcke/Tick)
 * @property {number} vz  Sollgeschwindigkeit z (Blöcke/Tick)
 * @property {number[]} recentDX  letzte gemessene Verschiebungen x (Wand-Erkennung)
 * @property {number[]} recentDZ  letzte gemessene Verschiebungen z
 * @property {number} grace  Ticks, in denen weder gelernt noch auf Wände geprüft wird
 * @property {{x:number,z:number}|null} lastF
 * @property {{x:number,z:number}|null} lastD
 * @property {number} stuckTicks
 * @property {number} lastStuckHint
 * @property {number} lastSeen
 * @property {boolean} airborne
 * @property {number} enteredTick
 * @property {number} lastApplyTick  Tick der letzten Geschwindigkeits-Korrektur
 * @property {boolean} forceApply    nächste Korrektur sofort (Eintritt, Abprall, Impuls)
 * @property {boolean} kick          nächste Korrektur mit kleinem Hüpfer (Abstoßen aus dem Stand)
 * @property {number} measuredSpeed  zuletzt gemessene tatsächliche Geschwindigkeit (Blöcke/Tick)
 * @property {number} displaySpeed   geglättete gemessene Geschwindigkeit für die Anzeige
 * @property {number} groundY        Höhe der Gliss-Oberfläche, auf der die Entity zuletzt stand
 * @property {{x:number,z:number}|null} anchor  Mobs/Gegenstände: zuletzt gesetzte Position – jeder Tick
 *                                   setzt „Anker + Rutschbewegung“, KI-Schritte dazwischen werden verworfen
 * @property {boolean} canFly        Mob kann fliegen/schweben – darf vom Gliss abheben
 */

// ---------------------------------------------------------------- Hilfsfunktionen
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function isValid(entity) {
  try {
    const v = entity.isValid;
    return typeof v === "function" ? v.call(entity) : !!v;
  } catch {
    return false;
  }
}

function capSpeed(st) {
  const s = Math.hypot(st.vx, st.vz);
  if (s > CONFIG.MAX_SPEED) {
    const k = CONFIG.MAX_SPEED / s;
    st.vx *= k;
    st.vz *= k;
  }
}

/** Halbe Breite der Hitbox – so weit ragt eine Entity über ihren Mittelpunkt hinaus. */
function halfWidth(entity, isPlayer) {
  if (isPlayer) return 0.3;
  return entity.typeId === "minecraft:item" ? 0.125 : 0.45;
}

/**
 * Steht die Entity auf einem Gliss-Block? Geprüft werden Mittelpunkt und die vier
 * Ecken der Hitbox: Minecraft lässt eine Figur so lange auf einem Block stehen, wie
 * irgendein Teil ihrer Hitbox darüber ist. Würde nur die Mitte zählen, bliebe man mit
 * der Mitte über dem Abgrund an der Kante hängen, statt hinunterzufallen.
 */
function groundBelow(entity, loc, h) {
  const g = { centerGliss: false, centerSolid: false, anyGliss: false, anySolid: false };
  try {
    const dim = entity.dimension;
    const y = Math.floor(loc.y - 0.2);
    const points = [[loc.x, loc.z]];
    if (h) points.push([loc.x - h, loc.z - h], [loc.x + h, loc.z - h], [loc.x - h, loc.z + h], [loc.x + h, loc.z + h]);
    points.forEach(([x, z], i) => {
      const b = dim.getBlock({ x: Math.floor(x), y, z: Math.floor(z) });
      if (!b) return;
      const gliss = b.typeId === CONFIG.BLOCK_ID;
      const solid = !gliss && (b.isSolid || (!b.isAir && !b.isLiquid));
      if (i === 0) {
        g.centerGliss = gliss;
        g.centerSolid = solid;
      }
      if (gliss) g.anyGliss = true;
      if (solid) g.anySolid = true;
    });
  } catch {}
  return g;
}

/** Steckt die Entity (Füße oder Kopf) in einem Spinnennetz? */
function isInWeb(entity, loc) {
  try {
    const dim = entity.dimension;
    const x = Math.floor(loc.x), y = Math.floor(loc.y), z = Math.floor(loc.z);
    const feet = dim.getBlock({ x, y, z });
    if (feet && feet.typeId === CONFIG.WEB_ID) return true;
    const head = dim.getBlock({ x, y: y + 1, z });
    return !!head && head.typeId === CONFIG.WEB_ID;
  } catch {
    return false;
  }
}

function playerCanSlide(player) {
  try {
    if (player.isFlying || player.isGliding || player.isInWater || player.isClimbing) return false;
    if (player.getGameMode() === GameMode.Spectator) return false;
    if (player.hasComponent("minecraft:riding")) return false;
  } catch {
    return false;
  }
  return true;
}

function setInputs(player, enabled) {
  try {
    const ip = player.inputPermissions;
    ip.setPermissionCategory(InputPermissionCategory.LateralMovement, enabled);
    let jump = enabled;
    if (!enabled && CONFIG.JUMP_ALLOWED_IN_CREATIVE && player.getGameMode() === GameMode.Creative) jump = true;
    ip.setPermissionCategory(InputPermissionCategory.Jump, jump);
  } catch (e) {
    if (CONFIG.DEBUG) console.warn("[Gliss] inputPermissions: " + e);
  }
}

function translate(key, args) {
  const msg = { translate: key };
  if (args) msg.with = args;
  return { rawtext: [msg] };
}

function sound(entity, id, pitch = 1, volume = 1) {
  try {
    if (typeof entity.playSound === "function") entity.playSound(id, { pitch, volume });
    else entity.dimension.playSound(id, entity.location, { pitch, volume });
  } catch {}
}

function isQuiet(player) {
  try {
    return player.hasTag(CONFIG.QUIET_TAG);
  } catch {
    return false;
  }
}

function actionBar(player, key, args) {
  if (isQuiet(player)) return;
  try {
    player.onScreenDisplay.setActionBar(translate(key, args));
  } catch {}
}

function chat(player, key, args) {
  if (isQuiet(player)) return;
  try {
    player.sendMessage(translate(key, args));
  } catch {}
}

/** Optionale Chat-Hinweise (Betreten, Verlassen, Rückstoß) – standardmäßig aus. */
function hint(player, key, args) {
  if (CONFIG.CHAT_HINTS) chat(player, key, args);
}

/** Anzeige: die tatsächlich gemessene Geschwindigkeit, nicht der Sollwert des Skripts. */
function fmtSpeed(st) {
  const ms = st.displaySpeed * 20;
  return (ms < 0.05 ? 0 : ms).toFixed(1).replace(".", ",");
}

/** Geschwindigkeit wirklich anwenden – für Spieler nur per Knockback möglich. */
function applyVelocity(entity, isPlayer, fx, fz, fy = 0) {
  if (Math.abs(fx) < 1e-4 && Math.abs(fz) < 1e-4) return;
  if (isPlayer) {
    entity.applyKnockback({ x: fx, z: fz }, fy);
  } else {
    entity.clearVelocity();
    entity.applyImpulse({ x: fx, y: 0, z: fz });
  }
}

// ---------------------------------------------------------------- Rutsch-Logik
const FLYING_NAV = ["minecraft:navigation.fly", "minecraft:navigation.hover", "minecraft:navigation.float"];

function startSliding(entity, isPlayer, d) {
  /** @type {SlideState} */
  const st = {
    entity,
    isPlayer,
    vx: d.x,
    vz: d.z,
    recentDX: [],
    recentDZ: [],
    grace: 1,
    lastF: null,
    lastD: null,
    stuckTicks: 0,
    lastStuckHint: -100000,
    lastSeen: tick,
    airborne: false,
    enteredTick: tick,
    lastApplyTick: -1000,
    forceApply: true,
    kick: false,
    measuredSpeed: Math.hypot(d.x, d.z),
    displaySpeed: Math.hypot(d.x, d.z),
    groundY: entity.location.y,
    anchor: isPlayer ? null : { x: entity.location.x, z: entity.location.z },
    canFly: !isPlayer && FLYING_NAV.some((c) => {
      try {
        return entity.hasComponent(c);
      } catch {
        return false;
      }
    }),
  };
  capSpeed(st);
  sliders.set(entity.id, st);
  if (isPlayer) {
    setInputs(entity, false);
    if (tick - (lastEnterMsg.get(entity.id) ?? -100000) >= CONFIG.ENTER_HINT_REPEAT_TICKS) {
      lastEnterMsg.set(entity.id, tick);
      hint(entity, "gliss.msg.enter");
    }
    sound(entity, "note.pling", 0.55, 0.5);
    if (CONFIG.DEBUG) console.warn(`[Gliss] ${entity.name} rutscht: v=(${st.vx.toFixed(3)}, ${st.vz.toFixed(3)})`);
  }
  return st;
}

function stopSliding(st, reason) {
  sliders.delete(st.entity.id);
  if (st.isPlayer) {
    setInputs(st.entity, true);
    if (reason === "ground") {
      hint(st.entity, "gliss.msg.exit");
      sound(st.entity, "note.pling", 1.2, 0.4);
    } else if (reason === "web") {
      hint(st.entity, "gliss.msg.web");
      sound(st.entity, "note.pling", 0.8, 0.4);
    }
    try {
      st.entity.onScreenDisplay.setActionBar("");
    } catch {}
  }
}

/** Zusätzlicher Impuls (Rückstoß, Schlag) – Impulserhaltung. */
function addImpulse(st, ix, iz) {
  st.vx += ix;
  st.vz += iz;
  capSpeed(st);
  st.recentDX.length = 0;
  st.recentDZ.length = 0;
  st.grace = Math.max(st.grace, 4);
  st.forceApply = true;
  if (st.isPlayer && st.measuredSpeed < CONFIG.STUCK_SPEED * 2) st.kick = true; // Abstoßen aus dem Stand
  st.stuckTicks = 0;
  st.lastEvent = `Impuls ${(Math.hypot(ix, iz) * 20).toFixed(1)} m/s @${tick}`;
}

/** Steht in Richtung (dx, dz) ein fester Block auf Fuß- oder Kopfhöhe? */
function solidAhead(entity, loc, dx, dz) {
  try {
    const dim = entity.dimension;
    const x = Math.floor(loc.x + dx), z = Math.floor(loc.z + dz), y = Math.floor(loc.y + 0.1);
    for (const yy of [y, y + 1]) {
      const b = dim.getBlock({ x, y: yy, z });
      if (b && b.isSolid) return true;
    }
    return false;
  } catch {
    return true;
  }
}

/** Ein Tick auf dem Gliss-Boden: Wand erkennen, Modell lernen, Geschwindigkeit halten. */
function tickSlide(st, d, loc) {
  const speed = Math.hypot(st.vx, st.vz);
  st.measuredSpeed = Math.hypot(d.x, d.z);

  // 1) Modell lernen (nur Spieler; Mobs setzen wir exakt): v_danach = c·v_davor + F
  //    c ≈ 0: Knockback SETZT die Geschwindigkeit  → jeden Tick F = V senden.
  //    c ≈ 0.5: Vanilla-Knockback (halbiert + addiert), c ≈ 1: reines Addieren
  //    → nur alle 4 Ticks korrigieren, damit die (um 1–2 Ticks verzögerte) Messung
  //    die letzte Korrektur schon enthält und der Regelkreis nicht schwingt.
  const perTick = !st.isPlayer || (modelSamples >= CONFIG.MODEL_MIN_SAMPLES && modelC < CONFIG.PER_TICK_MODEL_C);
  const measureDelay = perTick ? 1 : CONFIG.SPARSE_EVERY_TICKS - 1;
  if (st.isPlayer && st.grace === 0 && st.lastF && st.lastD && tick - st.lastApplyTick === measureDelay) {
    const vb2 = st.lastD.x * st.lastD.x + st.lastD.z * st.lastD.z;
    if (vb2 > 0.0025) {
      const sample = ((d.x - st.lastF.x) * st.lastD.x + (d.z - st.lastF.z) * st.lastD.z) / vb2;
      if (Number.isFinite(sample)) {
        const rate = modelSamples < CONFIG.MODEL_MIN_SAMPLES ? CONFIG.MODEL_LEARN_RATE_FAST : CONFIG.MODEL_LEARN_RATE;
        modelC += rate * (clamp(sample, -0.5, 1.5) - modelC);
        modelSamples++;
      }
    }
  }

  // 2) Wand? Erwartete Strecke vs. tatsächliche Strecke je Achse, über ein Fenster von
  //    mehreren Ticks (einzelne Messlücken im Netzwerk zählen so nicht als Wand).
  if (st.grace > 0) {
    st.grace--;
    st.recentDX.length = 0;
    st.recentDZ.length = 0;
  } else if (speed > CONFIG.STUCK_SPEED) {
    st.recentDX.push(d.x);
    st.recentDZ.push(d.z);
    if (st.recentDX.length > CONFIG.BLOCKED_WINDOW) st.recentDX.shift();
    if (st.recentDZ.length > CONFIG.BLOCKED_WINDOW) st.recentDZ.shift();
    const sum = (arr) => arr.reduce((a, b) => a + Math.abs(b), 0);
    const full = st.recentDX.length >= CONFIG.BLOCKED_WINDOW;
    const ax = Math.abs(st.vx), az = Math.abs(st.vz);
    let bounced = false;
    // Nur ein wirklich vorhandener fester Block zählt als Wand.
    if (full && ax > 0.03 && sum(st.recentDX) < CONFIG.BLOCKED_RATIO * ax * CONFIG.BLOCKED_WINDOW) {
      st.recentDX.length = 0;
      if (solidAhead(st.entity, loc, Math.sign(st.vx) * 0.5, 0)) {
        st.vx = -st.vx * CONFIG.RESTITUTION;
        bounced = true;
      }
    }
    if (full && az > 0.03 && sum(st.recentDZ) < CONFIG.BLOCKED_RATIO * az * CONFIG.BLOCKED_WINDOW) {
      st.recentDZ.length = 0;
      if (solidAhead(st.entity, loc, 0, Math.sign(st.vz) * 0.5)) {
        st.vz = -st.vz * CONFIG.RESTITUTION;
        bounced = true;
      }
    }
    if (bounced) {
      st.grace = 4;
      st.forceApply = true;
      sound(st.entity, "random.bowhit", 0.7, 0.8);
      st.lastEvent = `Wand @${tick}`;
    }
  }

  // 3) Geschwindigkeit halten (Sollwert V, Modell v' = c·v + F  ⇒  F = V − c·v)
  const due = perTick || st.forceApply || tick - st.lastApplyTick >= CONFIG.SPARSE_EVERY_TICKS;
  if (due) {
    const c = st.isPlayer ? modelC : 0;
    const fx = st.vx - c * d.x;
    const fz = st.vz - c * d.z;
    const fy = st.kick ? CONFIG.KICK_VERTICAL : 0;
    applyVelocity(st.entity, st.isPlayer, fx, fz, fy);
    st.lastApplied = { x: fx, z: fz, y: fy, tick };
    st.kick = false;
    st.lastF = { x: fx, z: fz };
    st.lastD = { x: d.x, z: d.z };
    st.lastApplyTick = tick;
    st.forceApply = false;
  }

  // 4) Festgefahren?
  if (Math.hypot(st.vx, st.vz) <= CONFIG.STUCK_SPEED) {
    st.stuckTicks++;
    if (
      st.isPlayer &&
      CONFIG.STUCK_HINT &&
      st.stuckTicks >= CONFIG.STUCK_HINT_AFTER_TICKS &&
      tick - st.lastStuckHint >= CONFIG.STUCK_HINT_REPEAT_TICKS
    ) {
      st.lastStuckHint = tick;
      chat(st.entity, "gliss.msg.stuck");
    }
  } else {
    st.stuckTicks = 0;
  }
}

/** Versucht, eine Entity um (dx, dz) zu versetzen; false, wenn ein Block im Weg ist. */
function tryMove(entity, loc, dx, dz) {
  try {
    // keepVelocity: false – die Eigenbewegung (KI-Laufen, Restschwung) wird jeden Tick verworfen,
    // nur die gespeicherte Rutschgeschwindigkeit zählt. Fällt die Entity über eine Kante, greift
    // die Schwerkraft wieder, weil dann nicht mehr versetzt wird.
    return entity.tryTeleport({ x: loc.x + dx, y: loc.y, z: loc.z + dz }, { checkForBlocks: true, keepVelocity: false });
  } catch {
    return false;
  }
}

/**
 * Ein Tick auf dem Gliss-Boden für Gegenstände und Mobs. Minecraft dämpft deren
 * Geschwindigkeit jeden Tick (Luftwiderstand ×0.91 bzw. ×0.98) – deshalb wird die
 * Position direkt fortgeschrieben. Ein blockierter Anteil wird gestoppt (oder mit
 * RESTITUTION zurückgeworfen), der freie Anteil rutscht weiter.
 */
function tickSlideEntity(st, loc) {
  const e = st.entity;
  if (!st.anchor) st.anchor = { x: loc.x, z: loc.z };
  // Ausgangspunkt ist der Anker, nicht die aktuelle Position: Was die KI seit dem letzten
  // Tick gelaufen ist, zählt nicht – auf Gliss gibt es nichts, wovon man sich abstoßen könnte.
  const base = { x: st.anchor.x, y: loc.y, z: st.anchor.z };
  if (Math.hypot(st.vx, st.vz) <= CONFIG.STUCK_SPEED) {
    // Stillstand: nur festnageln, wenn die Entity sich wegbewegt hat
    if (Math.abs(loc.x - base.x) > 1e-3 || Math.abs(loc.z - base.z) > 1e-3) tryMove(e, base, 0, 0);
    return;
  }
  if (tryMove(e, base, st.vx, st.vz)) {
    st.anchor = { x: base.x + st.vx, z: base.z + st.vz };
    return;
  }
  let nx = base.x, nz = base.z;
  if (Math.abs(st.vx) > 1e-4) {
    if (tryMove(e, base, st.vx, 0)) nx = base.x + st.vx;
    else st.vx = -st.vx * CONFIG.RESTITUTION;
  }
  const base2 = { x: nx, y: loc.y, z: base.z };
  if (Math.abs(st.vz) > 1e-4) {
    if (tryMove(e, base2, 0, st.vz)) nz = base.z + st.vz;
    else st.vz = -st.vz * CONFIG.RESTITUTION;
  }
  if (nx === base.x && nz === base.z) tryMove(e, base, 0, 0); // ganz blockiert: festnageln
  st.anchor = { x: nx, z: nz };
}

function hasTag(player, tag) {
  try {
    return player.hasTag(tag);
  } catch {
    return false;
  }
}

function updateHud(st) {
  if (!st.isPlayer || tick % CONFIG.HUD_EVERY_TICKS !== 0) return;
  if (hasTag(st.entity, CONFIG.DEBUG_TAG)) {
    const f = (v) => (v >= 0 ? "+" : "") + v.toFixed(3);
    const a = st.lastApplied;
    const regime = modelSamples >= CONFIG.MODEL_MIN_SAMPLES && modelC < CONFIG.PER_TICK_MODEL_C ? "jeder Tick" : "alle 4";
    const text =
      `§eV=(${f(st.vx)},${f(st.vz)}) §bgemessen=${st.measuredSpeed.toFixed(3)} §7Boden=${!st.airborne}\n` +
      `§aletzter Schubs=${a ? `(${f(a.x)},${f(a.z)}) y=${a.y.toFixed(2)} vor ${tick - a.tick}t` : "-"} §7c=${modelC.toFixed(2)} (${modelSamples}) ${regime}\n` +
      `§d${st.lastEvent ?? "-"}`;
    try {
      st.entity.onScreenDisplay.setActionBar(text);
    } catch {}
    return;
  }
  if (!CONFIG.HUD) return;
  if (st.airborne) actionBar(st.entity, "gliss.hud.air", [fmtSpeed(st)]);
  else if (Math.hypot(st.vx, st.vz) <= CONFIG.STUCK_SPEED) actionBar(st.entity, "gliss.hud.stuck");
  else actionBar(st.entity, "gliss.hud", [fmtSpeed(st)]);
}

/** Wird jeden Tick für jeden Spieler (und jede Entity in der Nähe) aufgerufen. */
function updateEntity(entity, isPlayer) {
  const loc = entity.location;
  const prev = lastPos.get(entity.id);
  lastPos.set(entity.id, { x: loc.x, y: loc.y, z: loc.z, tick });
  const d = prev && tick - prev.tick <= 2
    ? { x: loc.x - prev.x, y: loc.y - prev.y, z: loc.z - prev.z }
    : { x: 0, y: 0, z: 0 };
  // Beim ersten Blick auf eine Entity ist ihre Geschwindigkeit noch unbekannt:
  // erst ab der zweiten Beobachtung darf das Rutschen beginnen.
  if (!prev && !sliders.has(entity.id)) return;

  const g = groundBelow(entity, loc, halfWidth(entity, isPlayer));
  let st = sliders.get(entity.id);
  // Einstieg erst, wenn die Körpermitte auf Gliss ist (dort gilt die Gliss-Reibung).
  // Kante: Mitte schon über Luft, aber eine Ecke der Hitbox noch auf Gliss – Minecraft
  // lässt die Figur dann noch stehen, rechnet aber mit normaler Reibung. Deshalb wird
  // weitergeschoben, bis nichts mehr trägt und die Figur wirklich fällt.
  const onGliss = g.centerGliss || (!!st && !g.centerSolid && g.anyGliss);
  // „Am Boden“ kann der Position um einen Tick hinterherhinken: über reiner Luft
  // gilt die Figur als fallend, auch wenn die Meldung noch „am Boden“ sagt.
  const grounded = entity.isOnGround && (g.anyGliss || g.anySolid);
  const canSlide = isPlayer ? playerCanSlide(entity) : true;
  const inWeb = isInWeb(entity, loc);

  if (!st) {
    if (onGliss && grounded && canSlide && !inWeb) startSliding(entity, isPlayer, d);
    return;
  }
  st.lastSeen = tick;
  st.displaySpeed += 0.4 * (Math.hypot(d.x, d.z) - st.displaySpeed);

  if (inWeb) return stopSliding(st, "web");
  if (!canSlide) return stopSliding(st, "other");
  if (grounded && !onGliss) return stopSliding(st, "ground");

  if (!grounded) {
    // Mobs springen (KI, Hindernisse). Auf Gliss gibt es nichts, wovon man sich abstoßen
    // könnte: Wer über Gliss abhebt, wird sofort auf die Oberfläche zurückgezogen –
    // mit seiner Rutschbewegung. Fallen (unterhalb der Oberfläche) bleibt erlaubt.
    if (!isPlayer && !st.canFly && loc.y > st.groundY + 0.01 && loc.y < st.groundY + 1.6) {
      const below = groundBelow(entity, { x: loc.x, y: st.groundY, z: loc.z }, halfWidth(entity, false));
      if (below.anyGliss && !below.centerSolid) {
        const a = st.anchor ?? { x: loc.x, z: loc.z };
        const floor = { x: a.x, y: st.groundY, z: a.z };
        if (tryMove(entity, floor, st.vx, st.vz)) st.anchor = { x: a.x + st.vx, z: a.z + st.vz };
        else tryMove(entity, floor, 0, 0);
        return;
      }
    }
    // In der Luft (Kante hinunter, Schubs): Der Impuls bleibt erhalten,
    // die Geschwindigkeit wird beim nächsten Bodenkontakt wieder angelegt.
    st.airborne = true;
    st.anchor = null;
    st.grace = Math.max(st.grace, 2);
    updateHud(st);
    return;
  }
  st.airborne = false;
  st.groundY = loc.y;
  if (isPlayer) tickSlide(st, d, loc);
  else tickSlideEntity(st, loc);
  updateHud(st);
}

const ENTITY_EXCLUDE = [
  "minecraft:player", "minecraft:xp_orb", "minecraft:arrow", "minecraft:snowball", "minecraft:egg",
  "minecraft:ender_pearl", "minecraft:fishing_hook", "minecraft:thrown_trident", "minecraft:splash_potion",
  "minecraft:lingering_potion", "minecraft:xp_bottle", "minecraft:boat", "minecraft:chest_boat",
  "minecraft:minecart", "minecraft:chest_minecart", "minecraft:hopper_minecart", "minecraft:tnt_minecart",
  "minecraft:command_block_minecart", "minecraft:tnt", "minecraft:falling_block", "minecraft:painting",
  "minecraft:leash_knot", "minecraft:area_effect_cloud", "minecraft:lightning_bolt", "minecraft:fireball",
  "minecraft:small_fireball", "minecraft:dragon_fireball", "minecraft:wither_skull", "minecraft:shulker_bullet",
];

function slidesLikeEntity(e) {
  if (sliders.has(e.id) || e.typeId === "minecraft:item") return true;
  try {
    return e.hasComponent("minecraft:movement");
  } catch {
    return false;
  }
}

function updateEntities() {
  const seen = new Set();
  for (const player of world.getAllPlayers()) {
    let entities;
    try {
      entities = player.dimension.getEntities({
        location: player.location,
        maxDistance: CONFIG.ENTITY_SCAN_RADIUS,
        excludeTypes: ENTITY_EXCLUDE,
      });
    } catch {
      continue;
    }
    for (const e of entities) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      try {
        if (!slidesLikeEntity(e)) continue;
        updateEntity(e, false);
      } catch (err) {
        if (CONFIG.DEBUG) console.warn("[Gliss] entity: " + err);
      }
    }
  }
}

function cleanup() {
  for (const [id, st] of sliders) {
    if (!isValid(st.entity) || tick - st.lastSeen > 40) sliders.delete(id);
  }
  for (const [id, p] of lastPos) {
    if (tick - p.tick > 100) lastPos.delete(id);
  }
}

// ---------------------------------------------------------------- Ereignisse
/** Rückstoß beim Werfen/Schießen: Das Objekt fliegt vorwärts, der Werfer rückwärts. */
world.afterEvents.entitySpawn.subscribe((ev) => {
  try {
    const e = ev.entity;
    const recoil = CONFIG.RECOIL[e.typeId];
    if (!recoil || String(ev.cause) === "Loaded") return;
    let best = null;
    let how = "";
    // 1) Geschosse kennen ihren Schützen (Projektil-Komponente).
    try {
      const proj = e.getComponent("minecraft:projectile");
      const owner = proj?.owner;
      if (owner) {
        const st = sliders.get(owner.id);
        if (st && st.isPlayer) {
          best = st;
          how = "Besitzer";
        }
      }
    } catch {}
    // 2) Sonst: rutschender Spieler, an dessen Kopf das Objekt erschien. Schnelle Geschosse
    //    sind beim Ereignis schon unterwegs – der Werfer muss dann hinter dem Objekt stehen.
    if (!best) {
      const loc = e.location;
      let vel = { x: 0, y: 0, z: 0 };
      try {
        vel = e.getVelocity();
      } catch {}
      const fast = Math.hypot(vel.x, vel.y, vel.z) > 0.5;
      let bestDist = CONFIG.RECOIL_MAX_DISTANCE * CONFIG.RECOIL_MAX_DISTANCE;
      for (const st of sliders.values()) {
        if (!st.isPlayer || !isValid(st.entity)) continue;
        const head = st.entity.getHeadLocation();
        const dx = head.x - loc.x, dy = head.y - loc.y, dz = head.z - loc.z;
        const dist = dx * dx + dy * dy + dz * dz;
        if (dist >= bestDist) continue;
        if (fast && dx * vel.x + dy * vel.y + dz * vel.z > 0) continue; // Spieler vor dem Geschoss: nicht der Schütze
        bestDist = dist;
        best = st;
        how = "Abstand";
      }
    }
    if (!best) return;
    const view = best.entity.getViewDirection();
    const n = Math.hypot(view.x, view.z);
    if (n < 1e-3) return; // senkrecht geworfen: kein waagerechter Rückstoß
    addImpulse(best, (-view.x / n) * recoil, (-view.z / n) * recoil);
    best.lastEvent = `${e.typeId.replace("minecraft:", "")} (${how}) +${(recoil * 20).toFixed(1)} m/s @${tick}`;
    sound(best.entity, "random.pop", 0.8, 0.7);
    if (best.stuckTicks > 0 || Math.hypot(best.vx, best.vz) < 0.1) hint(best.entity, "gliss.msg.recoil");
  } catch (err) {
    if (CONFIG.DEBUG) console.warn("[Gliss] recoil: " + err);
  }
});

/** Schläge und Treffer übertragen Impuls. */
world.afterEvents.entityHurt.subscribe((ev) => {
  try {
    const st = sliders.get(ev.hurtEntity.id);
    if (!st) return;
    const src = ev.damageSource;
    const attacker = src?.damagingEntity ?? src?.damagingProjectile;
    if (!attacker || !isValid(attacker)) return;
    const a = attacker.location;
    const v = ev.hurtEntity.location;
    const dx = v.x - a.x, dz = v.z - a.z;
    const n = Math.hypot(dx, dz);
    if (n < 1e-3) return;
    addImpulse(st, (dx / n) * CONFIG.HIT_IMPULSE, (dz / n) * CONFIG.HIT_IMPULSE);
  } catch {}
});


// ---------------------------------------------------------------- Gliss-Laser
/** @type {Map<string, {player: import("@minecraft/server").Player, targetKey: string|null, progress: number, cuts: number, lastSound: number}>} */
const lasers = new Map();

function laserStart(player) {
  lasers.set(player.id, { player, targetKey: null, progress: 0, cuts: 0, lastSound: -1000 });
}

function laserStop(player) {
  const L = lasers.get(player.id);
  if (!L) return;
  lasers.delete(player.id);
  laserWear(player, L.cuts);
}

/** Haltbarkeit erst beim Loslassen abziehen – ein Tausch des Gegenstands würde das Halten unterbrechen. */
function laserWear(player, cuts) {
  if (cuts <= 0) return;
  try {
    const eq = player.getComponent("minecraft:equippable");
    const item = eq?.getEquipment(EquipmentSlot.Mainhand);
    if (!item || item.typeId !== CONFIG.LASER_ID) return;
    const dur = item.getComponent("minecraft:durability");
    if (!dur) return;
    dur.damage = Math.min(dur.maxDurability, dur.damage + cuts * CONFIG.LASER_WEAR_PER_BLOCK);
    if (dur.damage >= dur.maxDurability) {
      eq.setEquipment(EquipmentSlot.Mainhand, undefined);
      sound(player, "random.break", 1, 0.8);
    } else {
      eq.setEquipment(EquipmentSlot.Mainhand, item);
    }
  } catch (err) {
    if (CONFIG.DEBUG) console.warn("[Gliss] laser wear: " + err);
  }
}

function laserTick(L) {
  const p = L.player;
  if (!isValid(p)) return lasers.delete(p.id);
  const dim = p.dimension;
  const head = p.getHeadLocation();
  const view = p.getViewDirection();
  let hit;
  try {
    hit = p.getBlockFromViewDirection({ maxDistance: CONFIG.LASER_RANGE, includeLiquidBlocks: false, includePassableBlocks: false });
  } catch {}
  // Strahl: vom Kopf (leicht versetzt, damit er in der Ich-Perspektive sichtbar ist) bis zum Auftreffpunkt
  const start = { x: head.x + view.x * 0.6, y: head.y - 0.12 + view.y * 0.6, z: head.z + view.z * 0.6 };
  let end;
  if (hit) end = { x: hit.block.x + hit.faceLocation.x, y: hit.block.y + hit.faceLocation.y, z: hit.block.z + hit.faceLocation.z };
  else end = { x: head.x + view.x * CONFIG.LASER_RANGE, y: head.y + view.y * CONFIG.LASER_RANGE, z: head.z + view.z * CONFIG.LASER_RANGE };
  if (tick % 2 === 0) {
    const len = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
    const n = Math.max(1, Math.floor(len / CONFIG.LASER_DOT_SPACING));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      try {
        dim.spawnParticle(CONFIG.LASER_PARTICLE, { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t, z: start.z + (end.z - start.z) * t });
      } catch {
        break;
      }
    }
  }
  if (tick - L.lastSound >= 50) {
    L.lastSound = tick;
    try {
      dim.playSound("mob.guardian.attack", head, { volume: 0.35, pitch: 1.4 });
    } catch {}
  }
  // Zerlegen: Fortschritt nur, solange der Strahl auf demselben Gliss-Block liegt
  if (hit && hit.block.typeId === CONFIG.BLOCK_ID) {
    const b = hit.block;
    const key = `${b.x},${b.y},${b.z}`;
    if (key !== L.targetKey) {
      L.targetKey = key;
      L.progress = 0;
    }
    L.progress++;
    if (L.progress % 5 === 0) {
      try {
        dim.spawnParticle("minecraft:basic_smoke_particle", end);
      } catch {}
    }
    if (L.progress >= CONFIG.LASER_CUT_TICKS) {
      L.progress = 0;
      L.targetKey = null;
      L.cuts++;
      try {
        const center = b.center();
        b.setType("minecraft:air");
        dim.spawnItem(new ItemStack(CONFIG.BLOCK_ID, 1), center);
        dim.playSound("random.glass", center, { volume: 0.8, pitch: 1.2 });
        dim.playSound("random.fizz", center, { volume: 0.6, pitch: 1.5 });
      } catch (err) {
        if (CONFIG.DEBUG) console.warn("[Gliss] laser cut: " + err);
      }
    }
    actionBar(p, "gliss.hud.laser", [`${Math.round((L.progress / CONFIG.LASER_CUT_TICKS) * 100)} %`]);
  } else {
    L.targetKey = null;
    L.progress = 0;
    if (tick % 4 === 0) actionBar(p, "gliss.hud.laser_idle", [String(CONFIG.LASER_RANGE)]);
  }
}

world.afterEvents.itemStartUse.subscribe((ev) => {
  try {
    if (ev.itemStack?.typeId === CONFIG.LASER_ID) laserStart(ev.source);
  } catch {}
});
world.afterEvents.itemStopUse.subscribe((ev) => {
  try {
    laserStop(ev.source);
  } catch {}
});
world.afterEvents.itemReleaseUse.subscribe((ev) => {
  try {
    laserStop(ev.source);
  } catch {}
});

world.afterEvents.playerSpawn.subscribe((ev) => {
  const st = sliders.get(ev.player.id);
  if (st) sliders.delete(ev.player.id);
  lastPos.delete(ev.player.id);
  setInputs(ev.player, true); // gespeicherte Sperren nach Tod/Neubeitritt aufheben
});

world.afterEvents.playerLeave.subscribe((ev) => {
  lasers.delete(ev.playerId);
  sliders.delete(ev.playerId);
  lastPos.delete(ev.playerId);
  lastEnterMsg.delete(ev.playerId);
});

world.afterEvents.entityDie.subscribe((ev) => {
  try {
    const st = sliders.get(ev.deadEntity.id);
    if (st) stopSliding(st, "death");
  } catch {}
});

// ---------------------------------------------------------------- Hauptschleife
system.runInterval(() => {
  tick++;
  const players = world.getAllPlayers();
  if (!announced && players.length > 0) {
    announced = true;
    try {
      const saved = world.getDynamicProperty("gliss:model_c");
      const savedN = world.getDynamicProperty("gliss:model_samples");
      if (typeof saved === "number" && Number.isFinite(saved)) modelC = clamp(saved, -0.5, 1.5);
      if (typeof savedN === "number" && Number.isFinite(savedN)) modelSamples = savedN;
    } catch {}
    for (const p of players) {
      setInputs(p, true);
      if (CONFIG.LOADED_MESSAGE) chat(p, "gliss.msg.loaded");
    }
  }
  for (const p of players) {
    try {
      updateEntity(p, true);
    } catch (err) {
      if (CONFIG.DEBUG) console.warn("[Gliss] player: " + err);
    }
  }
  if (CONFIG.ENTITIES_SLIDE) updateEntities();
  for (const L of lasers.values()) {
    try {
      laserTick(L);
    } catch (err) {
      if (CONFIG.DEBUG) console.warn("[Gliss] laser: " + err);
    }
  }
  if (tick % 100 === 0) {
    cleanup();
    try {
      world.setDynamicProperty("gliss:model_c", modelC);
      world.setDynamicProperty("gliss:model_samples", modelSamples);
    } catch {}
  }
}, 1);
