#!/usr/bin/env bash
# Offline-Simulation der Rutsch-Logik (ohne Minecraft). Braucht nur Node.js.
set -euo pipefail
cd "$(dirname "$0")/sim"
cp ../../packs/Gliss_BP/scripts/main.js main.js
fail=0
for mode in set half add; do for slip in 1.0 0.98; do for lag in 0 1 2; do
  node sim.js "$mode" "$slip" "$lag" || fail=1
done; done; done
echo "=== Frontal gegen die Wand: stehen bleiben (RESTITUTION 0) ==="
for mode in set half add; do REST=0 node sim.js "$mode" 1.0 1 || fail=1; done
echo "=== Szenario B: festgefahren, Wurf, Pfeil, Schlag, Spinnennetz ==="
for mode in set half add; do node sim2.js "$mode" || fail=1; done
echo "=== Szenario B mit 3 verschluckten Schüben aus dem Stand ==="
for mode in set half add; do SWALLOW=3 node sim2.js "$mode" || fail=1; done
echo "=== Szenario D: über die Kante fallen ==="
for mode in set half add; do node sim4.js "$mode" || fail=1; done
echo "=== Szenario C: Gegenstand und Kuh (Teleport), Wand ==="
REST=0 node sim3.js || fail=1
REST=0.75 node sim3.js || fail=1
echo "=== Szenario E: Gliss-Laser ==="
node sim5.js || fail=1
[ $fail -eq 0 ] && echo "ALLE SIMULATIONEN OK" || { echo "MINDESTENS EINE SIMULATION FEHLGESCHLAGEN"; exit 1; }
