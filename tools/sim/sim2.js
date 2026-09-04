// Szenario B: Spieler steht still auf Gliss (festgefahren), wirft einen Gegenstand → Rückstoß; wird geschlagen → Impuls.
import { world, system } from "@minecraft/server";
import { CONFIG } from "./main.js";
const MODE = process.argv[2] || "set";
let webAt = null; // {x, z} eines Spinnennetzes auf Höhe 65
const dimension = {
  getBlock(p) {
    if (webAt && p.y === 65 && p.x === webAt.x && p.z === webAt.z) return { typeId: "minecraft:web" };
    const ty = p.y === 64 ? CONFIG.BLOCK_ID : "minecraft:air"; return { typeId: ty, isAir: ty === "minecraft:air", isSolid: ty !== "minecraft:air" };
  },
  getEntities() { return []; }, playSound() {},
};
const p = {
  id: "p1", name: "T", typeId: "minecraft:player", dimension, location: { x: 10.5, y: 65, z: 10.5 }, vel: { x: 0, z: 0 },
  isOnGround: true, isFlying: false, isGliding: false, isInWater: false, isClimbing: false, isValid: true, perms: { 4: true, 6: true },
  view: { x: 0.7071, y: 0, z: 0.7071 }, msgs: [], bars: [],
  inputPermissions: { setPermissionCategory(c, e) { p.perms[c] = e; } },
  onScreenDisplay: { setActionBar(t) { p.bars.push(JSON.stringify(t)); } },
  sendMessage(m) { p.msgs.push(JSON.stringify(m)); }, playSound() {}, getGameMode() { return "Survival"; }, hasComponent() { return false; },
  getHeadLocation() { return { x: p.location.x, y: p.location.y + 1.62, z: p.location.z }; }, getViewDirection() { return p.view; },
  swallow: parseInt(process.env.SWALLOW || "0"), kicks: [],
  applyKnockback(f, vy) { p.kicks.push(vy); if (p.swallow > 0 && Math.hypot(p.vel.x, p.vel.z) < 1e-6 && vy === 0) { p.swallow--; return; } if (MODE === "set") { p.vel.x = f.x; p.vel.z = f.z; } else if (MODE === "half") { p.vel.x = 0.5 * p.vel.x + f.x; p.vel.z = 0.5 * p.vel.z + f.z; } else { p.vel.x += f.x; p.vel.z += f.z; } },
  physics() { if (webAt && Math.floor(p.location.x) === webAt.x && Math.floor(p.location.z) === webAt.z) { p.vel.x = 0; p.vel.z = 0; } p.location = { x: p.location.x + p.vel.x, y: 65, z: p.location.z + p.vel.z }; },
};
world.players = [p];
const speed = () => Math.hypot(p.vel.x, p.vel.z);
let t = 0;
const step = (n) => { for (let i = 0; i < n; i++) { t++; p.physics(); system.tick(t); } };
step(80);
console.log(`MODE=${MODE}`);
console.log(`  nach 80 Ticks still: Geschwindigkeit ${speed().toFixed(4)}, Bewegung gesperrt=${!p.perms[4]}, Hinweis 'stuck' gesendet=${p.msgs.some(m => m.includes("gliss.msg.stuck"))}`);
// Wurf: Item erscheint am Kopf (aus dem Stand → erster Schubs mit Hüpfer)
world.afterEvents.entitySpawn.emit({ cause: "Spawned", entity: { typeId: "minecraft:item", location: p.getHeadLocation() } });
step(20);
const dirOk = p.vel.x < 0 && p.vel.z < 0; // entgegen Blickrichtung (+x,+z)
const kicked = p.kicks.some(v => v > 0);
console.log(`  nach Wurf: v=(${p.vel.x.toFixed(4)}, ${p.vel.z.toFixed(4)}) |v|=${speed().toFixed(4)} (Soll ${CONFIG.RECOIL["minecraft:item"]}), Richtung entgegen Blick=${dirOk}, Hüpfer=${kicked}, verschluckte Schübe=${process.env.SWALLOW || 0}`);
// Pfeil geschossen
world.afterEvents.entitySpawn.emit({ cause: "Spawned", entity: { typeId: "minecraft:arrow", location: p.getHeadLocation() } });
step(20);
console.log(`  nach Pfeil: |v|=${speed().toFixed(4)} (Soll ${(CONFIG.RECOIL["minecraft:item"] + CONFIG.RECOIL["minecraft:arrow"]).toFixed(2)})`);
// Schlag von einem Angreifer, der westlich steht → Impuls nach +x
const attacker = { id: "a", location: { x: p.location.x - 1, y: 65, z: p.location.z }, isValid: true };
world.afterEvents.entityHurt.emit({ hurtEntity: p, damage: 1, damageSource: { cause: "entityAttack", damagingEntity: attacker } });
step(20);
console.log(`  nach Schlag: v=(${p.vel.x.toFixed(4)}, ${p.vel.z.toFixed(4)})  (x sollte um +${CONFIG.HIT_IMPULSE} größer sein)`);
// Weit entferntes Item darf keinen Rückstoß geben
const before = speed();
world.afterEvents.entitySpawn.emit({ cause: "Spawned", entity: { typeId: "minecraft:item", location: { x: p.location.x + 5, y: 66, z: p.location.z } } });
step(5);
console.log(`  fernes Item: |v| vorher ${before.toFixed(4)} nachher ${speed().toFixed(4)} (muss gleich sein)`);
const speedBeforeWeb = speed();
// Spinnennetz genau dort, wo der Spieler gerade ist → kompletter Stopp, Kontrolle zurück
webAt = { x: Math.floor(p.location.x), z: Math.floor(p.location.z) };
step(3);
const webStopped = p.perms[4] === true;
const posInWeb = { ...p.location };
step(10);
const stillInWeb = Math.abs(p.location.x - posInWeb.x) < 1e-9 && p.perms[4] === true;
console.log(`  Spinnennetz: vorher |v|=${speedBeforeWeb.toFixed(4)}, danach Steuerung frei=${webStopped}, bleibt stehen=${stillInWeb}`);
webAt = null;
step(5);
console.log(`  Netz entfernt: rutscht wieder (gesperrt)=${!p.perms[4]}, |v|=${speed().toFixed(4)} (0 = festgefahren)`);
const ok = !p.perms[4] && dirOk && kicked && webStopped && stillInWeb && speed() < 1e-6 && Math.abs(speedBeforeWeb - Math.hypot(0.06 * 0.7071 + 0.16 * 0.7071 - 0.4, (0.06 + 0.16) * 0.7071)) < 0.02;
console.log(ok ? "  ERGEBNIS: OK" : "  ERGEBNIS: FEHLER");
process.exit(ok ? 0 : 1);
