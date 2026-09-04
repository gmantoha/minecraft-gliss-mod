# Gliss – der reibungsfreie Block für Minecraft Bedrock

Ein Add-On für Minecraft Bedrock Edition (Windows), das das **Gliss** aus Andreas Eschbachs Roman
*„Gliss. Tödliche Weite“* ins Spiel bringt: einen Boden ohne jede Reibung. Wer ihn betritt, rutscht
mit seiner Geschwindigkeit weiter, kann weder lenken noch bremsen und kommt nur durch Rückstoß,
Stöße, Wände oder festen Boden wieder davon.

**Spielen:** siehe [ANLEITUNG.md](ANLEITUNG.md) (Installation, Spielregeln, LAN zu zweit).
**Fertige Datei:** `dist/Gliss.mcaddon` (mit `./build.sh` neu erzeugen).

```
packs/Gliss_BP/          Verhaltenspaket: Blockdefinition, Rezept, Skript (Physik)
packs/Gliss_RP/          Ressourcenpaket: Textur, Blocksound, Texte (de/en)
tools/make_textures.py   erzeugt Textur und Pack-Icons (ohne Zusatzbibliotheken)
tools/sim/               Offline-Simulation der Rutsch-Logik (Node.js, ohne Minecraft)
build.sh                 prüft JSON/JS, baut dist/Gliss.mcaddon und die .mcpack-Dateien
```

## 1. Das Buch

*Gliss. Tödliche Weite* von Andreas Eschbach, Arena Verlag, erschienen am 14. Oktober 2021,
456 Seiten, ISBN 978-3-401-60581-4, All-Age-Science-Fiction ab 14 Jahren.

**Die Welt.** Die Menschen leben auf einem fremden Planeten in wenigen Siedlungen – der Stadt *Hope*
und Dörfern wie *Letz* – die vollständig vom GLISS umgeben sind: „einem Boden, auf dem nichts haftet
und nichts gebaut werden kann“ (Klappentext). Das Gliss ist für diese Welt, was für uns das Meer ist:
eine Fläche, die alles trennt. Wer auf sie gerät, gleitet ohne Halt weiter, „dazu verdammt, ruhelos
umherzutreiben“, bis er auf ein Hindernis trifft. Die Siedlungen sichern ihre Ränder mit Barrikaden,
damit niemand versehentlich in die Weite rutscht. Zwischen den Orten verkehren *Glisser*, bootsähnliche
Fahrzeuge, die über die Substanz gleiten. Die Sonne steht fast unbeweglich nahe am Horizont, was auf
einen gebunden rotierenden Planeten hindeutet. Werkzeuge greifen auf Gliss nicht, deshalb kann man es
weder bearbeiten noch bebauen.

**Die Handlung.** Der 17-jährige Ajit weiß, dass er Hope nie verlassen wird, denn hinter dem Gliss
gibt es angeblich nichts und niemanden. Dann treibt ein toter Fremder über das Gliss heran. Für Ajit
und seine Freunde Phil (impulsiv) und Majala (klug, willensstark) ist damit klar: Die Geschichte ihrer
Welt ist eine Lüge, und die Menschen, die Ajit für seine Familie hielt, verteidigen diese Lüge. Die
Wahrheit liegt hinter dem Gliss, „aus der noch niemals jemand zurückgekehrt ist“. Sein Cousin Nagendra
ist beliebt, ehrgeizig und manipulativ. Die Gruppe wagt die Überquerung.

**Was das Buch über die Physik sagt.** Zwei Regeln des Gliss werden in Besprechungen immer wieder
zitiert: Alles, was darauf gerät, gleitet weiter, bis es auf ein Hindernis trifft und dort seine Richtung
ändert; und wer Dinge zwischen zwei Orten befördern will, muss sie „nur leicht in die richtige Richtung
anstoßen“, dann kommen sie irgendwann drüben an. Genau diese beiden Regeln bilden das Add-On ab.

## 2. Die Physik hinter Gliss

Gliss ist ein Gedankenexperiment: ein Boden mit **Reibungskoeffizient μ = 0**. Daraus folgt alles Weitere.

| Prinzip | Auf Gliss | Im Add-On |
|---|---|---|
| **Trägheit** (1. Newtonsches Gesetz) | Ohne Reibungskraft bleibt die Geschwindigkeit exakt erhalten. Wer mit 4 km/h betritt, gleitet mit 4 km/h weiter – für immer. | Das Skript speichert die Geschwindigkeit beim Betreten und hält sie jeden Tick konstant. |
| **Gehen braucht Haftreibung** | Beim Gehen drückt der Fuß nach hinten gegen den Boden; die Reibung liefert die Vorwärtskraft. Mit μ = 0 rutscht der Fuß einfach durch. Man kann weder anfahren noch lenken noch bremsen. | Bewegungseingaben (WASD) und Springen werden auf Gliss in allen Spielmodi abgeschaltet (physikalisch wäre ein senkrechter Sprung möglich, im Spiel würde er aber Luftsteuerung erlauben). |
| **Impulserhaltung** | Der Gesamtimpuls eines abgeschlossenen Systems bleibt gleich. Wirft man eine Masse *m* mit *v* nach vorn, gleitet man selbst mit *m·v / M* nach hinten. So bewegt man sich auf Gliss: Rückstoß. | Werfen (Q), Bogen, Schneeball, Dreizack usw. geben einen Rückstoß entgegen der Blickrichtung. Die Werte sind zugunsten der Spielbarkeit übertrieben (ein echter Schneeball würde einen 70-kg-Menschen um ~1 cm/s beschleunigen). |
| **Stoß** | Beim Zusammenstoß wird Impuls übertragen. An einer Wand geht die Geschwindigkeitskomponente senkrecht zur Wand verloren (unelastisch) oder kehrt sich um (elastisch); die Komponente längs der Wand bleibt, weil die Wand ebenso reibungsfrei ist. | Ein Schlag überträgt Impuls in Schlagrichtung. Wände sind unelastisch: frontal bleibt man stehen, schräg rutscht man an der Wand entlang weiter (`RESTITUTION` in `CONFIG` macht daraus einen Flipper). Spinnennetze stoppen alles und geben Kontrolle zurück. |
| **Normalkraft bleibt** | Reibung ist die Kraft *parallel* zur Fläche. Die Kraft *senkrecht* dazu (Normalkraft) gibt es weiterhin: Man fällt nicht durch, man wird getragen. | Der Block ist ein normaler fester Block. |
| **Luftwiderstand** | Die einzige verbleibende Bremse. Sie ist bei Gehgeschwindigkeit winzig (Größenordnung 0,1 N), man käme erst nach Kilometern zum Stehen. | Wird ignoriert, wie Minecraft ihn am Boden generell ignoriert. |

**Was der Natur am nächsten kommt.** Vollständig reibungsfreie Festkörper gibt es nicht, aber es gibt Annäherungen:

| Material / Zustand | Reibungskoeffizient μ (ungefähr) |
|---|---|
| Gummi auf Asphalt | 0,7 – 1,0 |
| Stahl auf Stahl, trocken | 0,5 – 0,8 |
| Teflon auf Teflon | 0,04 |
| Schlittschuh auf Eis | 0,003 – 0,03 (dünner Wasserfilm) |
| Air-Hockey-Puck auf Luftkissen | < 0,01 |
| *Superlubrizität* (z. B. Graphit auf Graphen, inkommensurable Gitter) | < 0,001 |
| Supraflüssiges Helium-4 (unter 2,17 K) | Viskosität 0: fließt widerstandslos, kriecht Wände hinauf |
| **Gliss (Roman)** | **0** |

Minecraft selbst kennt dieses Spektrum: normale Blöcke haben eine „Rutschigkeit“ von 0,6 pro Tick,
Eis 0,98, Blaueis 0,989. Der Gliss-Block ist auf 1,0 gesetzt – keine Abnahme der Geschwindigkeit.

## 3. Wie das Add-On funktioniert

**Block** (`packs/Gliss_BP/blocks/gliss_block.json`): ein normaler Vollblock mit
`"minecraft:friction": 0.0` und `"minecraft:redstone_conductivity"` (eigene Blöcke leiten in Bedrock
sonst kein Redstone-Signal). In Bedrock reicht dieser Wert von 0,0 (glatter als Eis, das 0,02 hat) bis
0,9; er entspricht 1 − Rutschigkeit. Damit rutschen Gegenstände und Mobs schon ohne Skript endlos.
Für Spieler reicht das nicht, weil die Spielfigur weiterhin selbst beschleunigen könnte und weil
Minecraft die Steuerung nie ganz abgibt.

**Skript** (`packs/Gliss_BP/scripts/main.js`, stabile Skript-API `@minecraft/server` 2.0.0, keine Experimente):

1. Jeden Tick wird für jeden Spieler geprüft, ob der Block unter der Figur Gliss ist und sie am Boden steht.
2. Beim Betreten wird die Geschwindigkeit aus der Positionsänderung des letzten Ticks übernommen,
   die seitliche Bewegung (und außerhalb des Kreativmodus das Springen) per `inputPermissions` gesperrt.
3. Jeden Tick am Boden wird die Sollgeschwindigkeit per `applyKnockback` angelegt – der einzige Weg,
   die Geschwindigkeit eines Spielers vom Server aus zu setzen.
4. Kommt die Figur trotz Sollgeschwindigkeit nicht voran (zwei Ticks unter 25 % der erwarteten Strecke)
   und steht in Bewegungsrichtung wirklich ein fester Block, wird die betroffene Achse gestoppt (oder mit
   `RESTITUTION` gespiegelt). Ohne festen Block bleibt die Sollgeschwindigkeit erhalten und wird weiter
   angelegt, damit ein vom Client verschluckter Schubs nicht als Wand gilt.
   Ein Spinnennetz an Füßen oder Kopf beendet das Rutschen und gibt die Steuerung zurück.
5. `entitySpawn` erkennt geworfene Gegenstände und Geschosse, die am Kopf eines rutschenden Spielers
   entstehen, und gibt Rückstoß entgegen der Blickrichtung. `entityHurt` überträgt bei Schlägen Impuls.
   Ein Abstoß aus dem Stand bekommt einen winzigen Hüpfer (`KICK_VERTICAL`), weil ein rein waagerechter
   Schubs auf einen stehenden Spieler sonst wirkungslos bleiben kann.
6. Verlässt die Figur das Gliss auf festen Boden (oder Wasser, Flug, Zuschauer), werden die Eingaben
   wieder freigegeben. Beim (Wieder-)Einloggen und nach dem Tod werden gespeicherte Sperren aufgehoben.
7. Gegenstände und Mobs in Spielernähe werden pro Tick per `tryTeleport` um ihre gespeicherte
   Geschwindigkeit versetzt. Über die Geschwindigkeit ginge das nicht: Minecraft dämpft sie am Boden jeden
   Tick um 9 % (Mobs) bzw. 2 % (Gegenstände), selbst bei Rutschigkeit 1,0. Steht ein Block im Weg, wird der
   blockierte Anteil gestoppt, der freie rutscht weiter.

**Selbstkalibrierung.** Die Dokumentation legt nicht fest, ob `applyKnockback` die Geschwindigkeit
*setzt*, *halbiert und addiert* (wie Vanilla-Knockback) oder *addiert*. Das Skript misst deshalb
laufend, wie die Figur auf die letzte Korrektur reagiert hat, und schätzt den Faktor *c* im Modell
*v′ = c·v + F*. Daraus folgt die nötige Kraft *F = V − c·v*. Ist sicher, dass Knockback die
Geschwindigkeit setzt (*c* ≈ 0), wird jeden Tick korrigiert; sonst nur alle 4 Ticks, damit die um 1–2
Ticks verzögerte Messung die letzte Korrektur schon enthält und nichts aufschwingt. Der gelernte Wert
wird in der Welt gespeichert, die Lernphase (einige Sekunden auf dem ersten Rutsch) fällt also nur einmal an.

## 4. Was geprüft wurde – und was nicht

Auf diesem Rechner läuft kein Minecraft. Geprüft wurde deshalb offline:

- JSON-Dateien und das Skript sind syntaktisch gültig (`build.sh`).
- `tools/sim/` bildet die Skript-API nach und lässt einen Spieler auf eine Gliss-Fläche laufen,
  gegen eine Wand rutschen, zurückgleiten und die Fläche verlassen. Getestet wurden alle drei denkbaren
  Knockback-Semantiken, zwei Rutschigkeitswerte des Blocks (1,0 und 0,98) und Netzwerkverzögerungen
  von 0, 1 und 2 Ticks. In allen 18 Fällen wird nach der Lernphase die Sollgeschwindigkeit auf
  ±0,02 Blöcke/Tick gehalten, das Abprallen liefert 75 % des Tempos, die Steuerung wird beim Verlassen
  wieder freigegeben. Weitere Szenarien prüfen das Stehenbleiben an einer Wand, Festhängen, Rückstoß
  durch Wurf und Pfeil, Impuls durch einen Schlag, den Stopp im Spinnennetz sowie das Rutschen eines
  Gegenstands und einer Kuh per Teleport. Aufruf: `tools/run-sim.sh`.

Nicht geprüft ist das Verhalten im echten Spiel (Texturdarstellung, genaue Stärke des Knockbacks,
Tonnamen). Sollte etwas nicht wie beschrieben laufen, hilft das Inhaltsprotokoll (Einstellungen →
Ersteller); die Stellschrauben stehen in `CONFIG` am Anfang des Skripts.

## 5. Lizenz

MIT, siehe [LICENSE](LICENSE). Der Roman „Gliss. Tödliche Weite“ ist Eigentum von Andreas Eschbach und
dem Arena Verlag; dieses Add-On ist ein Fan-Projekt ohne Verbindung zu beiden.

## 6. Quellen

- Arena Verlag, Produktseite mit Klappentext: https://www.arena-verlag.de/artikel/gliss-toedliche-weite-978-3-401-60581-4
- Perry-Rhodan-Redaktion, Meldung zur Veröffentlichung: https://perry-rhodan.net/aktuelles/news/andreas-eschbach-ver%C3%B6ffentlichte-%C2%BBgliss-t%C3%B6dliche-weite%C2%AB
- Rezensionen mit Details zur Welt: https://buchszene.de/gliss-rezension/ , https://blog4aleshanee.blogspot.com/2021/09/gliss-eschbach.html , https://buchlabyrinth.blogspot.com/2021/10/rezension-gliss-todliche-weite-von.html , https://www.lesejury.de/andreas-eschbach/buecher/gliss-toedliche-weite/9783401605814
- Microsoft Learn, Block-Komponente `minecraft:friction`: https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_friction
- Microsoft Learn, Skript-API `Entity` (applyKnockback, applyImpulse): https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity
- Microsoft Learn, `InputPermissionCategory` und Versionierung der Skript-Module: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/inputpermissioncategory , https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/versioning
- Bedrock Wiki, Einstieg ins Scripting (Manifest-Vorlage): https://wiki.bedrock.dev/scripting/scripting-intro
