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
import { world, system, InputPermissionCategory, GameMode } from "@minecraft/server";

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
  RECOIL_MAX_DISTANCE: 2.5,  // Objekt muss so nah am Kopf des Werfers erscheinen
  KICK_VERTICAL: 0.2,        // kleiner Hüpfer beim Abstoßen aus dem Stand (sonst kann der Client
                            // einen rein waagerechten Schubs auf einen stehenden Spieler verschlucken)
  RETRY_GRACE_TICKS: 3,      // kam ein Schubs nicht an (keine Bewegung, kein Block im Weg): nach so
                            // vielen Ticks erneut anlegen, wieder mit Hüpfer
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
 * @property {number} blockedX
 * @property {number} blockedZ
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
    blockedX: 0,
    blockedZ: 0,
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
  st.blockedX = 0;
  st.blockedZ = 0;
  st.grace = Math.max(st.grace, 4);
  st.forceApply = true;
  if (st.isPlayer && st.measuredSpeed < CONFIG.STUCK_SPEED * 2) st.kick = true; // Abstoßen aus dem Stand
  st.stuckTicks = 0;
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

  // 2) Wand? Erwartete Strecke vs. tatsächliche Strecke je Achse
  if (st.grace > 0) {
    st.grace--;
  } else if (speed > CONFIG.STUCK_SPEED) {
    const ax = Math.abs(st.vx), az = Math.abs(st.vz);
    st.blockedX = ax > 0.03 && Math.abs(d.x) < CONFIG.BLOCKED_RATIO * ax ? st.blockedX + 1 : 0;
    st.blockedZ = az > 0.03 && Math.abs(d.z) < CONFIG.BLOCKED_RATIO * az ? st.blockedZ + 1 : 0;
    // Nur ein wirklich vorhandener fester Block zählt als Wand. Kommt der Spieler aus
    // anderen Gründen nicht voran (z. B. verschluckter Schubs aus dem Stand), bleibt die
    // Sollgeschwindigkeit erhalten und wird weiter angelegt.
    let bounced = false, retry = false;
    if (st.blockedX >= CONFIG.BLOCKED_TICKS) {
      st.blockedX = 0;
      if (solidAhead(st.entity, loc, Math.sign(st.vx) * 0.5, 0)) {
        st.vx = -st.vx * CONFIG.RESTITUTION;
        bounced = true;
      } else retry = true;
    }
    if (st.blockedZ >= CONFIG.BLOCKED_TICKS) {
      st.blockedZ = 0;
      if (solidAhead(st.entity, loc, 0, Math.sign(st.vz) * 0.5)) {
        st.vz = -st.vz * CONFIG.RESTITUTION;
        bounced = true;
      } else retry = true;
    }
    if (bounced) {
      st.grace = 4;
      st.forceApply = true;
      sound(st.entity, "random.bowhit", 0.7, 0.8);
    } else if (retry && st.isPlayer) {
      // Der Schubs ist nicht angekommen (keine Bewegung, aber auch kein Block im Weg):
      // erneut anlegen, mit Hüpfer – so oft, bis der Spieler wirklich in Fahrt ist.
      st.kick = true;
      st.forceApply = true;
      st.grace = CONFIG.RETRY_GRACE_TICKS;
    }
  }

  // 3) Geschwindigkeit halten (Sollwert V, Modell v' = c·v + F  ⇒  F = V − c·v)
  const due = perTick || st.forceApply || tick - st.lastApplyTick >= CONFIG.SPARSE_EVERY_TICKS;
  if (due) {
    const c = st.isPlayer ? modelC : 0;
    const fx = st.vx - c * d.x;
    const fz = st.vz - c * d.z;
    applyVelocity(st.entity, st.isPlayer, fx, fz, st.kick ? CONFIG.KICK_VERTICAL : 0);
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
  if (Math.hypot(st.vx, st.vz) <= CONFIG.STUCK_SPEED) return;
  const e = st.entity;
  if (tryMove(e, loc, st.vx, st.vz)) return;
  if (Math.abs(st.vx) > 1e-4 && !tryMove(e, loc, st.vx, 0)) st.vx = -st.vx * CONFIG.RESTITUTION;
  const loc2 = e.location;
  if (Math.abs(st.vz) > 1e-4 && !tryMove(e, loc2, 0, st.vz)) st.vz = -st.vz * CONFIG.RESTITUTION;
}

function updateHud(st) {
  if (!CONFIG.HUD || !st.isPlayer || tick % CONFIG.HUD_EVERY_TICKS !== 0) return;
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
        const floor = { x: loc.x, y: st.groundY, z: loc.z };
        if (!tryMove(entity, floor, st.vx, st.vz)) tryMove(entity, floor, 0, 0);
        return;
      }
    }
    // In der Luft (Kante hinunter, Schubs): Der Impuls bleibt erhalten,
    // die Geschwindigkeit wird beim nächsten Bodenkontakt wieder angelegt.
    st.airborne = true;
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
    const loc = e.location;
    let best = null;
    let bestDist = CONFIG.RECOIL_MAX_DISTANCE * CONFIG.RECOIL_MAX_DISTANCE;
    for (const st of sliders.values()) {
      if (!st.isPlayer || !isValid(st.entity)) continue;
      const head = st.entity.getHeadLocation();
      const dist = (head.x - loc.x) ** 2 + (head.y - loc.y) ** 2 + (head.z - loc.z) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = st;
      }
    }
    if (!best) return;
    const view = best.entity.getViewDirection();
    const n = Math.hypot(view.x, view.z);
    if (n < 1e-3) return; // senkrecht geworfen: kein waagerechter Rückstoß
    addImpulse(best, (-view.x / n) * recoil, (-view.z / n) * recoil);
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

world.afterEvents.playerSpawn.subscribe((ev) => {
  const st = sliders.get(ev.player.id);
  if (st) sliders.delete(ev.player.id);
  lastPos.delete(ev.player.id);
  setInputs(ev.player, true); // gespeicherte Sperren nach Tod/Neubeitritt aufheben
});

world.afterEvents.playerLeave.subscribe((ev) => {
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
  if (tick % 100 === 0) {
    cleanup();
    try {
      world.setDynamicProperty("gliss:model_c", modelC);
      world.setDynamicProperty("gliss:model_samples", modelSamples);
    } catch {}
  }
}, 1);
