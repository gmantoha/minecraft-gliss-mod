// Simulation: Spieler läuft auf eine Gliss-Fläche zu, rutscht, prallt an einer Wand ab, verlässt die Fläche.
import { world, system, InputPermissionCategory } from "@minecraft/server";
import { CONFIG } from "./main.js";
const REST = process.env.REST !== undefined ? parseFloat(process.env.REST) : 0.75;
CONFIG.RESTITUTION = REST; // 0.75: Abprall-Test (Flipper), 0: frontal stehen bleiben

const MODE = process.argv[2] || "set";        // set | half | add
const SLIP = parseFloat(process.argv[3] || "1.0"); // Rutschigkeit des Gliss-Blocks (1.0 = keine Reibung)
const LAG = parseInt(process.argv[4] || "0"); // Ticks, bis ein Knockback beim Client wirkt
const VERBOSE = process.argv[5] === "-v";
const WALK = 0.2158;
const GLISS = { x0: 0, x1: 30, z0: -5, z1: 5, y: 64 };
const WALL_X = 30; // Wand bei x=30 (Blöcke y=65)

const dimension = {
  getBlock(p) {
    if (p.y === GLISS.y && p.x >= GLISS.x0 && p.x < GLISS.x1 && p.z >= GLISS.z0 && p.z < GLISS.z1) return { typeId: CONFIG.BLOCK_ID, isSolid: true };
    if (p.y === GLISS.y) return { typeId: "minecraft:stone", isSolid: true };
    if (p.x === WALL_X && (p.y === 65 || p.y === 66)) return { typeId: "minecraft:stone", isSolid: true };
    return { typeId: "minecraft:air", isSolid: false, isAir: true };
  },
  getEntities() { return []; },
  playSound() {},
};

function makePlayer() {
  const p = {
    id: "p1", name: "Tester", typeId: "minecraft:player", dimension,
    location: { x: -3.5, y: 65, z: 0.5 }, vel: { x: 0, y: 0, z: 0 },
    isOnGround: true, isFlying: false, isGliding: false, isInWater: false, isClimbing: false, isValid: true,
    input: { W: true }, perms: { 4: true, 6: true }, view: { x: 1, y: 0, z: 0 },
    log: { msgs: [], bars: [], knock: 0 },
    inputPermissions: { setPermissionCategory(c, e) { p.perms[c] = e; }, isPermissionCategoryEnabled(c) { return p.perms[c]; } },
    onScreenDisplay: { setActionBar(t) { p.log.bars.push(JSON.stringify(t)); } },
    sendMessage(m) { p.log.msgs.push(JSON.stringify(m)); },
    playSound() {},
    getGameMode() { return "Survival"; },
    hasComponent() { return false; },
    getHeadLocation() { return { x: p.location.x, y: p.location.y + 1.62, z: p.location.z }; },
    getViewDirection() { return p.view; },
    pending: [],
    applyKnockback(f, vy) {
      p.log.knock++;
      p.pending.push({ f, left: LAG });
    },
    applyPending() {
      const rest = [];
      for (const k of p.pending) {
        if (k.left <= 0) {
          const f = k.f;
          if (MODE === "set") { p.vel.x = f.x; p.vel.z = f.z; }
          else if (MODE === "half") { p.vel.x = 0.5 * p.vel.x + f.x; p.vel.z = 0.5 * p.vel.z + f.z; }
          else { p.vel.x += f.x; p.vel.z += f.z; }
        } else { k.left--; rest.push(k); }
      }
      p.pending = rest;
    },
    physics() {
      p.applyPending();
      const below = dimension.getBlock({ x: Math.floor(p.location.x), y: 64, z: Math.floor(p.location.z) });
      const onGliss = below.typeId === CONFIG.BLOCK_ID;
      const slip = onGliss ? SLIP : 0.6;
      if (p.input.W && p.perms[4]) {
        // Laufen: auf normalem Boden ~ sofort Laufgeschwindigkeit, auf Gliss nur winzige Beschleunigung
        const accel = onGliss ? 0.02 * Math.pow(0.6 / slip, 3) : 0.1;
        p.vel.x = Math.min(WALK, p.vel.x + accel);
        if (!onGliss) p.vel.x = WALK;
      }
      let nx = p.location.x + p.vel.x;
      if (nx + 0.3 > WALL_X && p.location.z > GLISS.z0 && p.location.z < GLISS.z1) { nx = WALL_X - 0.3; p.vel.x = 0; }
      p.location = { x: nx, y: 65, z: p.location.z + p.vel.z };
      p.vel.x *= slip; p.vel.z *= slip;
    },
  };
  return p;
}

const player = makePlayer();
world.players = [player];
const TICKS = 1500;
const passes = []; // je Durchlauf: enter, bounce, exit, speeds (Rutschphase), after (nach Abprall)
let cur = null;
for (let t = 1; t <= TICKS; t++) {
  const before = player.location.x;
  player.physics();
  system.tick(t);
  const dx = player.location.x - before;
  const sliding = !player.perms[4];
  if (!cur && sliding) { cur = { enter: t, bounce: -1, exit: -1, speeds: [], after: [] }; passes.push(cur); }
  if (cur) {
    if (cur.bounce < 0 && dx < -0.01) cur.bounce = t;
    const atWall = player.location.x > WALL_X - 0.9;
    if (cur.bounce < 0 && t > cur.enter + 6 && !atWall) cur.speeds.push(dx);
    if (cur.bounce > 0 && t > cur.bounce + 4 && !atWall && sliding && player.location.x > 0.8) cur.after.push(dx);
    if (!sliding && t > cur.enter) {
      cur.exit = t; cur = null;
      if (passes.length >= 2) break;
      // zurück zum Start und erneut loslaufen (zweiter Durchlauf = eingeschwungener Zustand)
      player.location = { x: -3.5, y: 65, z: 0.5 }; player.vel = { x: 0, z: 0 }; player.pending = []; player.input.W = true;
    }
  }
}
const stats = (arr) => { const m = arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length); return { mean: m, max: Math.max(0, ...arr.map(v => Math.abs(v - m))) }; };
console.log(`MODE=${MODE} SLIP=${SLIP} LAG=${LAG} REST=${REST}`);
let ok;
if (REST === 0) {
  const ps = passes[0];
  const s1 = stats(ps.speeds);
  const atWall = Math.abs(player.location.x - (WALL_X - 0.3)) < 0.05;
  const stuckHint = player.log.msgs.some(m => m.includes("gliss.msg.stuck"));
  console.log(`  Rutschen: mittel ${s1.mean.toFixed(4)} (Soll ${WALK}), Schwankung ±${s1.max.toFixed(4)} | Ende: x=${player.location.x.toFixed(3)} (Wand bei ${WALL_X - 0.3}), Abprall=${ps.bounce > 0}, gesperrt=${!player.perms[4]}, Hinweis festgefahren=${stuckHint}`);
  ok = passes.length === 1 && ps.bounce < 0 && atWall && !player.perms[4] && stuckHint && Math.abs(s1.mean - WALK) < 0.03;
} else {
  ok = passes.length === 2;
  passes.forEach((ps, i) => {
    const s1 = stats(ps.speeds), s2 = stats(ps.after);
    const devTarget = Math.abs(s1.mean - WALK), devAfter = Math.abs(s2.mean + WALK * CONFIG.RESTITUTION);
    console.log(`  Durchlauf ${i + 1}: betreten ${ps.enter}, Abprall ${ps.bounce}, verlassen ${ps.exit} | Rutschen: mittel ${s1.mean.toFixed(4)} (Soll ${WALK}), Schwankung ±${s1.max.toFixed(4)} | nach Abprall: mittel ${s2.mean.toFixed(4)} (Soll ${(-WALK * CONFIG.RESTITUTION).toFixed(4)}), Schwankung ±${s2.max.toFixed(4)}`);
    if (ps.exit < 0 || ps.bounce < 0) ok = false;
    if (i === 1 && (devTarget > 0.02 || s1.max > 0.03 || devAfter > 0.02 || s2.max > 0.03)) ok = false;
  });
  console.log(`  gelerntes Modell c = ${world.props["gliss:model_c"]?.toFixed(3)} nach ${world.props["gliss:model_samples"]} Messungen (erwartet: set≈0, half≈${(0.5*SLIP).toFixed(2)}, add≈${SLIP}), Knockbacks: ${player.log.knock}, Bewegung wieder frei: ${player.perms[4]}`);
}
console.log(ok ? "  ERGEBNIS: OK" : "  ERGEBNIS: FEHLER");
process.exit(ok ? 0 : 1);
