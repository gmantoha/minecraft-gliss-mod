#!/usr/bin/env bash
# Baut dist/Gliss.mcaddon (beide Pakete) sowie die Einzelpakete als .mcpack.
set -euo pipefail
cd "$(dirname "$0")"
python3 tools/make_textures.py
for f in packs/Gliss_BP/manifest.json packs/Gliss_BP/blocks/gliss_block.json packs/Gliss_BP/recipes/gliss_block.json \
         packs/Gliss_RP/manifest.json packs/Gliss_RP/blocks.json packs/Gliss_RP/textures/terrain_texture.json \
         packs/Gliss_BP/texts/languages.json packs/Gliss_RP/texts/languages.json; do
  python3 -m json.tool "$f" > /dev/null || { echo "Ungültiges JSON: $f"; exit 1; }
done
node --check packs/Gliss_BP/scripts/main.js
mkdir -p dist
rm -f dist/Gliss.mcaddon dist/Gliss_BP.mcpack dist/Gliss_RP.mcpack
(cd packs && zip -qr ../dist/Gliss.mcaddon Gliss_BP Gliss_RP -x '*.DS_Store')
(cd packs/Gliss_BP && zip -qr ../../dist/Gliss_BP.mcpack . -x '*.DS_Store')
(cd packs/Gliss_RP && zip -qr ../../dist/Gliss_RP.mcpack . -x '*.DS_Store')
echo "Fertig:"; ls -la dist
