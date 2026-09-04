// Szenario C: Gegenstand und Kuh rutschen per Teleport, Wand bei x=30, Spinnennetz optional.
import { world, system } from "@minecraft/server";
import { CONFIG } from "./main.js";
const REST = process.env.REST !== undefined ? parseFloat(process.env.REST) : 0;
CONFIG.RESTITUTION = REST;
const WALL_X = 30;
const solidAt = (x, y, z) => y === 65 && x === WALL_X; // Wand: Block bei x=30, y=65
const dimension = {
  getBlock(p) { if (p.y === 64) return { typeId: CONFIG.BLOCK_ID }; if (solidAt(p.x, p.y, p.z)) return { typeId: "minecraft:stone" }; return { typeId: "minecraft:air" }; },
  getEntities() { return ents; }, playSound() {},
};
function makeEntity(id, typeId, x, z, vx, vz, half) {
  const e = {
    id, typeId, dimension, location: { x, y: 65, z }, isOnGround: true, isValid: true, vel: { x: vx, z: vz }, tp: 0,
    hasComponent(c) { return typeId !== "minecraft:item" && c === "minecraft:movement"; },
    clearVelocity() {}, applyImpulse() {}, playSound() {},
    tryTeleport(loc, opts) {
      // Blockprüfung: AABB (halbe Breite half) an Ziel gegen Wandblock
      for (const cx of [loc.x - half, loc.x + half]) if (solidAt(Math.floor(cx), 65, Math.floor(loc.z))) return false;
      e.location = { x: loc.x, y: loc.y, z: loc.z }; e.tp++;
      if (!opts || !opts.keepVelocity) { e.vel.x = 0; e.vel.z = 0; }
      return true;
    },
    physics() { // Vanilla: erste Ticks Bewegung mit Dämpfung 0.91 (Mob) / 0.98 (Item), solange das Skript noch nicht steuert
      e.location = { x: e.location.x + e.vel.x, y: 65, z: e.location.z + e.vel.z };
      const damp = typeId === "minecraft:item" ? 0.98 : 0.91; e.vel.x *= damp; e.vel.z *= damp;
    },
  };
  return e;
}
const player = { id: "p", typeId: "minecraft:player", dimension, location: { x: 5, y: 65, z: 20 }, isOnGround: true, isFlying: false, isGliding: false, isInWater: false, isClimbing: false, isValid: true,
  perms: {}, inputPermissions: { setPermissionCategory() {} }, onScreenDisplay: { setActionBar() {} }, sendMessage() {}, playSound() {}, getGameMode() { return "Survival"; }, hasComponent() { return false; }, hasTag() { return false; },
  getHeadLocation() { return this.location; }, getViewDirection() { return { x: 1, y: 0, z: 0 }; }, applyKnockback() {} };
// Spieler steht auf Stein (y=64 ist überall Gliss im Mock → Spieler auf 20/20 rutscht auch, egal)
world.players = [player];
const item = makeEntity("i1", "minecraft:item", 10.5, 2.5, 0.2, 0, 0.125);
const cow = makeEntity("c1", "minecraft:cow", 10.5, 6.5, 0.1, 0.05, 0.45);
const ents = [item, cow];
let t = 0;
const xs = { i1: [], c1: [] };
for (let i = 0; i < 400; i++) {
  t++;
  const before = Object.fromEntries(ents.map(e => [e.id, e.location.x]));
  for (const e of ents) e.physics();   // Vanilla-Bewegung (gedämpft), solange das Skript noch nicht steuert
  system.tick(t);                       // Skript: ab der zweiten Beobachtung Teleport um die Startgeschwindigkeit
  for (const e of ents) xs[e.id].push(e.location.x - before[e.id]);
}
const stepsItem = xs.i1.slice(5, 60), stepsCow = xs.c1.slice(5, 60);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`REST=${REST}`);
console.log(`  Gegenstand: mittlere Verschiebung/Tick ${mean(stepsItem).toFixed(4)} (Eintritt 0.2·0.98≈0.196), Ende x=${item.location.x.toFixed(2)} (Wand bei ${WALL_X - 0.125}), Teleports=${item.tp}`);
console.log(`  Kuh: mittlere Verschiebung/Tick ${mean(stepsCow).toFixed(4)} (Eintritt ≈0.091), Ende x=${cow.location.x.toFixed(2)}, z=${cow.location.z.toFixed(2)} (rutscht längs der Wand weiter: z wächst), Teleports=${cow.tp}`);
const okItem = mean(stepsItem) > 0.15 && Math.abs(item.location.x - (WALL_X - 0.125)) < 0.25;
const okCow = mean(stepsCow) > 0.07 && Math.abs(cow.location.x - (WALL_X - 0.45)) < 0.25 && cow.location.z > 15;
const ok = REST === 0 ? okItem && okCow : item.location.x < WALL_X - 3 && cow.location.x < WALL_X - 3;
console.log(ok ? "  ERGEBNIS: OK" : "  ERGEBNIS: FEHLER");
process.exit(ok ? 0 : 1);
