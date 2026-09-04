// Szenario E: Gliss-Laser – Rechtsklick halten, Strahl auf Gliss-Block, nach LASER_CUT_TICKS zerlegt, Haltbarkeit beim Loslassen.
import { world, system } from "@minecraft/server";
import { CONFIG } from "./main.js";
const target = { typeId: CONFIG.BLOCK_ID, x: 13, y: 65, z: 10, setCalls: [], center() { return { x: 13.5, y: 65.5, z: 10.5 }; }, setType(t) { this.setCalls.push(t); this.typeId = t; } };
const spawned = [], sounds = [], particles = [];
const dimension = {
  getBlock(q) { const ty = q.y === 64 ? "minecraft:stone" : "minecraft:air"; return { typeId: ty, isAir: ty === "minecraft:air", isSolid: ty !== "minecraft:air" }; },
  getEntities() { return []; }, playSound(id) { sounds.push(id); }, spawnParticle(id, loc) { particles.push(id); }, spawnItem(stack, loc) { spawned.push(stack.typeId); },
};
const laserItem = { typeId: "gliss:laser", dur: { damage: 0, maxDurability: 512 }, getComponent(id) { return id === "minecraft:durability" ? this.dur : undefined; } };
let hand = laserItem;
const p = {
  id: "p1", name: "T", typeId: "minecraft:player", dimension, location: { x: 10.5, y: 65, z: 10.5 }, isOnGround: true, isFlying: false, isGliding: false, isInWater: false, isClimbing: false, isValid: true,
  perms: {}, bars: [], inputPermissions: { setPermissionCategory() {} }, onScreenDisplay: { setActionBar(t) { p.bars.push(JSON.stringify(t)); } }, sendMessage() {}, playSound(id) { sounds.push(id); },
  getGameMode() { return "Survival"; }, hasComponent() { return false; }, hasTag() { return false; },
  getHeadLocation() { return { x: 10.5, y: 66.62, z: 10.5 }; }, getViewDirection() { return { x: 1, y: 0, z: 0 }; },
  getBlockFromViewDirection() { return target.typeId === CONFIG.BLOCK_ID ? { block: target, face: "West", faceLocation: { x: 0, y: 0.5, z: 0.5 } } : undefined; },
  getComponent(id) { return id === "minecraft:equippable" ? { getEquipment() { return hand; }, setEquipment(slot, item) { hand = item; } } : undefined; },
  applyKnockback() {},
};
world.players = [p];
let t = 0; const step = (n) => { for (let i = 0; i < n; i++) { t++; system.tick(t); } };
step(2);
world.afterEvents.itemStartUse.emit({ itemStack: { typeId: "gliss:laser" }, source: p, useDuration: 100 });
step(CONFIG.LASER_CUT_TICKS - 1);
const notYet = target.typeId === CONFIG.BLOCK_ID;
step(1);
const cut = target.typeId === "minecraft:air" && spawned.length === 1 && spawned[0] === CONFIG.BLOCK_ID;
const beam = particles.filter(x => x === CONFIG.LASER_PARTICLE).length;
step(5);
world.afterEvents.itemStopUse.emit({ itemStack: { typeId: "gliss:laser" }, source: p, useDuration: 50 });
const wear = laserItem.dur.damage;
console.log(`  nach ${CONFIG.LASER_CUT_TICKS - 1} Ticks noch ganz=${notYet}, nach ${CONFIG.LASER_CUT_TICKS} Ticks zerlegt und Block gedroppt=${cut}, Strahl-Punkte=${beam}, Laser-Sound=${sounds.includes("mob.guardian.attack")}, Bruch-Sound=${sounds.includes("random.glass")}`);
console.log(`  Haltbarkeit nach Loslassen: Schaden ${wear} (Soll ${CONFIG.LASER_WEAR_PER_BLOCK}), letzte Anzeige: ${p.bars.at(-1)}`);
const ok = notYet && cut && beam > 20 && wear === CONFIG.LASER_WEAR_PER_BLOCK && sounds.includes("mob.guardian.attack");
console.log(ok ? "  ERGEBNIS: OK" : "  ERGEBNIS: FEHLER");
process.exit(ok ? 0 : 1);
