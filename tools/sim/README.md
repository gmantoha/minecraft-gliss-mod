Offline-Simulation der Gliss-Logik. `../run-sim.sh` kopiert das aktuelle Skript hierher und
lässt alle Szenarien laufen. `node_modules/@minecraft/server/index.js` ist ein minimaler Nachbau
der Skript-API; `sim.js` simuliert Laufen → Rutschen → Wand → Abprall → Verlassen,
`sim2.js` Festhängen → Wurf/Pfeil (Rückstoß) → Schlag (Impuls).
Argumente von sim.js: `<set|half|add> <Rutschigkeit> <Verzögerung in Ticks> [-v]`.
