# Gliss für Minecraft Bedrock – Kurzanleitung

Der **Gliss-Block** ist der reibungsfreie Boden aus Andreas Eschbachs Roman
*„Gliss. Tödliche Weite“*. Wer ihn betritt, rutscht mit der Geschwindigkeit weiter,
die er beim Betreten hatte – ohne lenken, bremsen oder springen zu können.
Nur Rückstoß (etwas wegwerfen), Stöße, eine Wand oder fester Boden ändern das.

Technisch ist das ein **Add-On** (so heißen „Mods“ in der Bedrock Edition):
ein Verhaltenspaket mit Skript und ein Ressourcenpaket mit Textur. Es braucht
keine Experimente und keine Zusatzprogramme.

## 1. Voraussetzungen

- Minecraft für Windows (Bedrock Edition), **Version 1.21.90 oder neuer**, auf beiden PCs
  **dieselbe Version** (Microsoft Store aktualisiert automatisch).
- Die Datei `dist/Gliss.mcaddon` (auf den Windows-PC des Hosts kopieren, z. B. per USB-Stick oder Cloud).

## 2. Installation (nur der Host muss das tun)

1. `Gliss.mcaddon` auf dem Windows-PC **doppelklicken**. Minecraft startet und meldet
   „Import erfolgreich“ (zwei Pakete: *Gliss – Verhalten* und *Gliss – Ressourcen*).
2. Falls der Doppelklick nichts tut: Minecraft schließen, Datei in `Gliss.zip` umbenennen,
   entpacken und die beiden Ordner in den Minecraft-Datenordner kopieren:
   `Gliss_BP` nach `behavior_packs\`, `Gliss_RP` nach `resource_packs\`.
   Der Datenordner liegt seit Version 1.21.120 (Oktober 2025) hier
   (in die Adresszeile des Explorers eintippen):
   `%APPDATA%\Minecraft Bedrock\Users\Shared\games\com.mojang\`
   Alternativ der Ordner deines Kontos: `%APPDATA%\Minecraft Bedrock\Users\<Zahlenfolge>\games\com.mojang\`.
   Der alte Ort `%LOCALAPPDATA%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\`
   enthält bei aktuellen Versionen nur noch `bootstrapStorage` und wird nicht mehr benutzt.

## 3. Welt anlegen

1. **Spielen → Neu erstellen → Neue Welt erstellen**.
2. Links unter **Verhaltenspakete → Verfügbar** das Paket **Gliss – Verhalten** aktivieren.
   Das Ressourcenpaket wird automatisch mit aktiviert (sonst unter **Ressourcenpakete** ebenfalls aktivieren).
3. Empfehlung zum Bauen: Spielmodus **Kreativ**. Für den Befehl `/give` müssen **Cheats** an sein
   (das schaltet Erfolge ab; im Kreativ-Inventar geht es auch ohne Cheats).
4. **Erstellen**. Beim Start erscheint im Chat „[Gliss] Add-On aktiv“. Das ist der Test, dass alles läuft.

Eine bestehende Welt: im Weltenmenü auf den **Stift** (Bearbeiten) und die Pakete genauso aktivieren.

## 4. Block holen

- Kreativ-Inventar: oben im Suchfeld **„Gliss“** eingeben (Kategorie *Konstruktion*).
- Mit Cheats: `/give @s gliss:gliss_block 64`
- Überleben: **8 Eis + 1 Schleimball** in der Werkbank (Eis ringsum, Schleimball in die Mitte) ergeben 8 Gliss-Blöcke.

**Gliss wieder entfernen.** Wie im Roman lässt sich Gliss weder sprengen noch mit normalem Werkzeug
bearbeiten: TNT, Creeper und Feuerbälle richten nichts aus, von Hand oder mit Spitzhacke dauert ein Block
25 Minuten. Das einzige Werkzeug ist der **Gliss-Laser** (ein Block in etwa 3 Sekunden, 512 Einsätze):

```
[ ] [Glas]           [Diamant]
[Redstone-Block] [Glas]  [ ]
[Eisenbarren] [ ]        [ ]
```

Im Kreativ-Inventar unter „Ausrüstung“ oder mit `/give @s gliss:laser`. Im Kreativmodus bricht man jeden
Block ohnehin sofort.

## 5. So spielt sich Gliss

| Situation | Was passiert |
|---|---|
| Du willst Gliss sprengen oder abbauen | Explosionen prallen wirkungslos ab, Werkzeuge greifen nicht. Nur der Gliss-Laser zerlegt den Block (siehe oben). |
| Du gehst/rennst auf Gliss | Du behältst dein Tempo und rutschst geradeaus weiter. Laufen und Springen sind in jedem Spielmodus gesperrt, die Kamera bleibt frei. Oben im Bildschirm siehst du dein Tempo in m/s. |
| Du stehst still auf Gliss (z. B. Block unter dir gesetzt) | Du hängst fest – wie im Roman. Nach 3 s kommt ein Hinweis. |
| Du wirfst etwas weg (Taste **Q**) oder schießt (Bogen, Schneeball, Dreizack) | **Rückstoß**: Du gleitest in die Gegenrichtung deines Blicks. Mehrfach werfen = schneller. So steuert man auf Gliss. Aus dem Stand macht der Abstoß einen kleinen Hüpfer. |
| Du wirst geschlagen oder getroffen | Der Schlag überträgt Impuls: Du gleitest vom Angreifer weg. So kann dich ein Mitspieler „anschubsen“. |
| Du rutschst frontal gegen eine Wand | Du bleibst stehen (unelastischer Stoß) und hängst fest, bis du Rückstoß erzeugst. Triffst du die Wand schräg, rutschst du an ihr entlang weiter. |
| Du rutschst in ein Spinnennetz | Du hältst komplett an und hast im Netz wieder Kontrolle. Spinnennetze sind die „Barrikaden“ aus dem Roman: Damit sicherst du Ränder und baust Haltepunkte. |
| Du rutschst auf festen Boden, ins Wasser oder fällst von der Kante | Fester Boden hat Reibung: Du stoppst und hast wieder Kontrolle. In der Luft bleibt dein Impuls erhalten. |
| Tiere, Monster oder Gegenstände geraten auf Gliss | Sie rutschen endlos geradeaus weiter, können nicht springen, bleiben an Wänden stehen und werden von Spinnennetzen gestoppt. Nur flugfähige Tiere (Bienen, Fledermäuse) dürfen abheben. Genau wie im Roman kommt Fracht, die man anschubst, irgendwann drüben an. |
| Kreativmodus | Auch hier ist Springen (und damit das Losfliegen) gesperrt. Notausgang: den Block unter dir mit dem Gliss-Laser zerlegen (im Kreativmodus reicht die Hand), ein Spinnennetz setzen oder `/gamemode spectator`. Wer schon fliegt, rutscht nicht. |

**Bauideen**

- **Gliss-Bahn:** eine lange Bahn aus Gliss, am Ende ein Feld aus normalem Boden. Wer setzt sich mit
  einem einzigen Anlauf am weitesten ab? Spinnennetze am Ende bilden die Bremszone.
- **Die tödliche Weite:** eine große Gliss-Fläche mit wenigen Inseln aus Stein. Ihr startet am Rand mit
  einem Stapel Steine im Inventar. Nur durch geschicktes Werfen erreicht ihr die Inseln und den anderen Rand.
  Wer keine Steine mehr hat, treibt hilflos – genau wie die Figuren im Buch.
- **Arena:** eine Gliss-Fläche mit Rand aus Zäunen. Ihr schießt euch gegenseitig mit Schneebällen an;
  jeder Treffer stößt den anderen ab. Wer zuerst über die Kante in die Lava rutscht, verliert.
- **Fracht-Post:** zwei Stationen, dazwischen Gliss. Wirf Gegenstände oder schubse eine Kuh in die richtige
  Richtung, und sie kommen beim Mitspieler an. Ein Spinnennetz an der Station fängt sie auf.

## 6. Zu zweit im LAN

Nur der Host braucht das Add-On. Beim Beitritt überträgt Minecraft die Pakete automatisch an den Gast.

**Host (PC 1)**

1. Beide PCs im selben Netzwerk (gleicher Router/WLAN). Das Windows-Netzwerkprofil sollte auf
   **„Privat“** stehen (Einstellungen → Netzwerk und Internet → Eigenschaften der Verbindung).
2. Welt öffnen: im Weltenmenü auf den **Stift** → Reiter **Multiplayer** → **Multiplayer-Spiel: an**
   und **Sichtbar für LAN-Spieler: an**. Dann **Spielen**.
3. Wenn Windows beim ersten Mal fragt, ob Minecraft durch die Firewall darf: für **private Netzwerke** erlauben.

**Gast (PC 2)**

1. **Spielen → Reiter „Freunde“**. Unter **LAN-Spiele** erscheint die Welt des Hosts. Anklicken – fertig.
2. Erscheint sie nicht: Reiter **Server → Server hinzufügen**, als Adresse die lokale IP des Hosts
   (Host tippt in der Eingabeaufforderung `ipconfig`, Zeile „IPv4-Adresse“, z. B. `192.168.178.20`),
   Port **19132**.

**Wenn es hakt**

- Beide auf der gleichen Minecraft-Version? (Einstellungen → Profil, unten rechts steht die Versionsnummer.)
- Firewall auf dem Host: Windows-Sicherheit → Firewall → „App durch Firewall zulassen“ → Minecraft für „Privat“ anhaken.
  Notfalls Port **UDP 19132** freigeben.
- Sieht der Gast den Block ohne Textur (lila-schwarz)? Dann `Gliss.mcaddon` auch auf dem Gast-PC importieren.
- Läuft das Skript nicht (keine Chat-Meldung „[Gliss] Add-On aktiv“)? In den Einstellungen unter
  **Ersteller → Inhaltsprotokoll-GUI aktivieren** einschalten; Fehler des Skripts werden dann im Spiel angezeigt.

## 7. Meldungen und Anpassen

Standardmäßig ist das Add-On ruhig: Im Chat erscheint nur einmal beim Start „Add-On aktiv“ und,
wenn du länger als 3 s festhängst, höchstens jede Minute ein Hinweis. Über der Hotbar läuft während
des Rutschens die Tempoanzeige.

- Ohne Neubau abschalten: mit Cheats `/tag @s add gliss_quiet` eingeben. Der Spieler bekommt dann
  weder Chat-Hinweise noch Tempoanzeige (`/tag @s remove gliss_quiet` schaltet sie wieder ein).
- Dauerhaft im Skript: oben in `CONFIG` stehen `HUD` (Tempoanzeige), `CHAT_HINTS` (Hinweise beim
  Betreten, Verlassen, Rückstoß), `STUCK_HINT` (Hinweis beim Festhängen) und `LOADED_MESSAGE`.

Alle weiteren Stellschrauben stehen ebenfalls in `packs/Gliss_BP/scripts/main.js` im Block `CONFIG`
(Rückstoß-Stärke je Wurfgegenstand, `RESTITUTION` für Abprallen an Wänden statt Stehenbleiben,
`JUMP_ALLOWED_IN_CREATIVE`, ob Gegenstände und Tiere rutschen, Höchstgeschwindigkeit …).
Nach Änderungen `./build.sh` ausführen (Linux/macOS, braucht Python 3, Node und zip) und die neue
`dist/Gliss.mcaddon` erneut importieren. Damit der Import das alte Paket ersetzt, vorher in beiden
`manifest.json` die `version` erhöhen (z. B. `[1, 1, 0]` → `[1, 2, 0]`). Danach in der Welt
(Stift → Verhaltenspakete) prüfen, dass **Gliss – Verhalten** noch aktiv ist.
