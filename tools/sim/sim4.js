// Szenario D: Gliss-Fläche x∈[0,10), dahinter Abgrund. Der Spieler muss über die Kante fallen.
import { world, system } from "@minecraft/server";
import { CONFIG } from "./main.js";
const MODE = process.argv[2] || "set";
const EDGE = 10, HALF = 0.3, WALK = 0.2158;
const dimension = {
  getBlock(p) {
    if (p.y === 64 && p.x >= -5 && p.x < EDGE) return { typeId: p.x < 0 ? "minecraft:stone" : CONFIG.BLOCK_ID, isSolid: true };
    return { typeId: "minecraft:air", isSolid: false, isAir: true };
  },
  getEntities() { return []; }, playSound() {},
};
const p = {
  id: "p1", name: "T", typeId: "minecraft:player", dimension, location: { x: -3.5, y: 65, z: 0.5 }, vel: { x: 0, y: 0, z: 0 },
  isOnGround: true, isFlying: false, isGliding: false, isInWater: false, isClimbing: false, isValid: true, perms: { 4: true, 6: true },
  input: { W: true }, view: { x: 1, y: 0, z: 0 }, knock: 0,
  inputPermissions: { setPermissionCategory(c, e) { p.perms[c] = e; } }, onScreenDisplay: { setActionBar() {} },
  sendMessage() {}, playSound() {}, getGameMode() { return "Survival"; }, hasComponent() { return false; }, hasTag() { return false; },
  getHeadLocation() { return { x: p.location.x, y: p.location.y + 1.62, z: p.location.z }; }, getViewDirection() { return p.view; },
  applyKnockback(f, vy) { p.knock++; if (MODE === "set") { p.vel.x = f.x; p.vel.z = f.z; p.vel.y = vy; } else if (MODE === "half") { p.vel.x = 0.5 * p.vel.x + f.x; p.vel.z = 0.5 * p.vel.z + f.z; } else { p.vel.x += f.x; p.vel.z += f.z; } },
  physics() {
    // Boden unter irgendeiner Ecke der Hitbox?
    const supported = [p.location.x - HALF, p.location.x + HALF].some(cx => { const b = dimension.getBlock({ x: Math.floor(cx), y: 64, z: 0 }); return b.isSolid; }) && p.location.y <= 65;
    const centerBlock = dimension.getBlock({ x: Math.floor(p.location.x), y: 64, z: 0 });
    if (supported) {
      p.isOnGround = true; p.vel.y = 0;
      if (p.input.W && p.perms[4] && centerBlock.typeId === "minecraft:stone") p.vel.x = WALK;
      p.location = { x: p.location.x + p.vel.x, y: 65, z: p.location.z + p.vel.z };
      const slip = centerBlock.typeId === CONFIG.BLOCK_ID ? 1.0 : centerBlock.isSolid ? 0.6 : 0.6; // Mitte über Luft: Vanilla nutzt Standardreibung
      p.vel.x *= slip * 0.91; p.vel.z *= slip * 0.91;
    } else {
      p.isOnGround = false;
      p.location = { x: p.location.x + p.vel.x, y: p.location.y + p.vel.y, z: p.location.z + p.vel.z };
      p.vel.y = (p.vel.y - 0.08) * 0.98; p.vel.x *= 0.91; p.vel.z *= 0.91;
    }
  },
};
world.players = [p];
let fellAt = -1, lockedWhenFalling = null, stoppedEarlyAt = -1;
for (let t = 1; t <= 300; t++) {
  p.physics(); system.tick(t);
  if (fellAt < 0 && !p.isOnGround) { fellAt = t; lockedWhenFalling = !p.perms[4]; }
  if (fellAt < 0 && stoppedEarlyAt < 0 && p.location.x > EDGE - 0.5 && p.perms[4] && Math.abs(p.vel.x) < 1e-3) stoppedEarlyAt = t;
  if (p.location.y < 40) break;
}
console.log(`MODE=${MODE}`);
console.log(`  Kante bei x=${EDGE}: ${fellAt > 0 ? `fällt ab Tick ${fellAt} bei x=${p.location.x.toFixed(2)}` : "fällt NICHT"}, y am Ende ${p.location.y.toFixed(1)}, Rutschen war beim Fallen noch aktiv=${lockedWhenFalling}, an der Kante hängen geblieben=${stoppedEarlyAt > 0}`);
const ok = fellAt > 0 && p.location.y < 60 && stoppedEarlyAt < 0;
console.log(ok ? "  ERGEBNIS: OK" : "  ERGEBNIS: FEHLER");
process.exit(ok ? 0 : 1);
