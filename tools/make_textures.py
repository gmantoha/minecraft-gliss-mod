#!/usr/bin/env python3
"""Erzeugt die Gliss-Textur (16x16) und die Pack-Icons ohne externe Bibliotheken."""
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def write_png(path, width, height, pixels):
    """pixels: Liste von Zeilen, jede Zeile Liste von (r, g, b, a)."""
    raw = bytearray()
    for row in pixels:
        raw.append(0)  # Filtertyp 0
        for r, g, b, a in row:
            raw += bytes((r, g, b, a))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(png)


def hash_noise(x, y, seed=7):
    n = (x * 374761393 + y * 668265263 + seed * 1442695041) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFF) / 255.0


def lerp(a, b, t):
    return a + (b - a) * t


def gliss_pixel(u, v, size):
    """u, v in [0, size). Glatte, spiegelnde, blass-blaue Oberflaeche mit Glanzstreifen."""
    t = (u + v) / (2.0 * (size - 1))
    r = lerp(222, 132, t)
    g = lerp(240, 176, t)
    b = lerp(248, 204, t)
    # Glanzstreifen (Reflexion) quer ueber den Block
    band = (u + v) / (size - 1)  # 0 .. 2
    for center, width, strength in ((0.62, 0.11, 34), (1.38, 0.05, 22)):
        d = abs(band - center)
        if d < width:
            k = (1 - d / width) * strength
            r += k
            g += k
            b += k
    # feines Rauschen, damit es nicht steril wirkt
    nz = (hash_noise(u * 16 // size, v * 16 // size) - 0.5) * 8
    r += nz
    g += nz
    b += nz
    # leichte Kante, damit Blockgrenzen auf grossen Flaechen lesbar bleiben
    edge = min(u, v, size - 1 - u, size - 1 - v)
    if edge == 0:
        r *= 0.86
        g *= 0.88
        b *= 0.92
    cl = lambda x: max(0, min(255, int(round(x))))
    return (cl(r), cl(g), cl(b), 255)


def make_block(path, size=16):
    write_png(path, size, size, [[gliss_pixel(u, v, size) for u in range(size)] for v in range(size)])


def make_icon(path, size=128):
    rows = []
    for v in range(size):
        row = []
        for u in range(size):
            r, g, b, a = gliss_pixel(u, v, size)
            # dunkler Rahmen
            edge = min(u, v, size - 1 - u, size - 1 - v)
            if edge < 4:
                r, g, b = int(r * 0.55), int(g * 0.6), int(b * 0.7)
            # stilisiertes "G" als dunkle Spur (Kreisbogen mit Luecke rechts + Querbalken)
            cx, cy, rad = size * 0.5, size * 0.5, size * 0.28
            dx, dy = u - cx, v - cy
            dist = (dx * dx + dy * dy) ** 0.5
            import math
            ang = math.degrees(math.atan2(dy, dx))  # -180..180, 0 = rechts
            on_arc = abs(dist - rad) < size * 0.045 and not (-60 < ang < 20)
            on_bar = abs(dy) < size * 0.04 and 0 <= dx <= rad + size * 0.02
            on_tip = abs(dx - rad) < size * 0.045 and 0 <= dy <= rad * 0.55
            if on_arc or on_bar or on_tip:
                r, g, b = int(r * 0.35), int(g * 0.42), int(b * 0.55)
            row.append((r, g, b, a))
        rows.append(row)
    write_png(path, size, size, rows)


# Farben des Laser-Icons. Kräftige Töne und ein dunkler Umriss wie bei Vanilla-Werkzeugen,
# damit das Symbol auf der dunklen Hotbar und im grauen Inventar sofort ins Auge fällt.
LASER_COLORS = {
    "o": (22, 24, 30, 255),      # Umriss
    "b": (172, 182, 196, 255),   # Gehäuse
    "B": (228, 234, 242, 255),   # Gehäuse, Lichtkante
    "s": (104, 114, 130, 255),   # Gehäuse, Schatten
    "n": (58, 62, 72, 255),      # Ringe / Griffabschluss
    "h": (84, 58, 40, 255),      # Griff
    "H": (128, 92, 64, 255),     # Griff, Lichtkante
    "k": (52, 36, 24, 255),      # Griff, Schatten
    "c": (110, 232, 255, 255),   # Linse
    "C": (214, 252, 255, 255),   # Linse, Glanz
    "y": (255, 204, 48, 255),    # Auslöser
    "r": (255, 56, 48, 255),     # Emitter
    "R": (255, 132, 108, 255),   # Strahl, hell
    "p": (255, 72, 60, 150),     # Strahl, Schein
}


def laser_sprite(size=16):
    """Zeichnet den Laser als diagonales Werkzeug (Griff unten links, Strahl oben rechts).

    Gearbeitet wird in Diagonalkoordinaten: s = x + y liegt quer zum Werkzeug (Breite),
    t = x - y läuft am Werkzeug entlang (vom Griff zur Spitze)."""
    grid = [["." for _ in range(size)] for _ in range(size)]

    def body_char(s, t):
        if t <= -6:                       # Griff
            if t == -12:
                return "n"
            return "H" if s == 13 else ("k" if s == 16 else "h")
        if t in (-5, 6):                  # Ringe zwischen Griff, Gehäuse und Linse
            return "n"
        if t <= 5:                        # Gehäuse
            if t == 0 and s == 13:
                return "y"
            return "B" if s == 13 else ("s" if s == 16 else "b")
        if t <= 9:                        # Linse
            return "C" if s == 13 else "c"
        return "r"                        # Emitter

    for y in range(size):
        for x in range(size):
            s, t = x + y, x - y
            if 13 <= s <= 16 and -12 <= t <= 10:
                grid[y][x] = body_char(s, t)
    # Umriss: alle leeren Nachbarn (4er-Nachbarschaft) des Körpers
    for y in range(size):
        for x in range(size):
            if grid[y][x] != ".":
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < size and 0 <= ny < size and grid[ny][nx] not in (".", "o"):
                    grid[y][x] = "o"
                    break
    # Strahl aus dem Emitter bis in die Ecke, mit Lichtschein daneben
    for y in range(size):
        for x in range(size):
            s, t = x + y, x - y
            if t >= 11:
                if s in (14, 15):
                    grid[y][x] = "R" if t <= 12 else "r"
                elif s in (13, 16) and grid[y][x] == ".":
                    grid[y][x] = "p"
    return ["".join(row) for row in grid]


def make_laser(path):
    rows = [[LASER_COLORS.get(ch, (0, 0, 0, 0)) for ch in line] for line in laser_sprite()]
    write_png(path, 16, 16, rows)


def make_dot(path, size=8):
    rows = []
    c = (size - 1) / 2
    for v in range(size):
        row = []
        for u in range(size):
            d = ((u - c) ** 2 + (v - c) ** 2) ** 0.5 / (size / 2)
            a = max(0.0, min(1.0, 1.15 - d * 1.3))
            row.append((255, 255, 255, int(round(a * 255))))
        rows.append(row)
    write_png(path, size, size, rows)


if __name__ == "__main__":
    make_dot(os.path.join(ROOT, "packs", "Gliss_RP", "textures", "particle", "laser_dot.png"))
    make_laser(os.path.join(ROOT, "packs", "Gliss_RP", "textures", "items", "gliss_laser.png"))
    make_block(os.path.join(ROOT, "packs", "Gliss_RP", "textures", "blocks", "gliss_block.png"))
    make_icon(os.path.join(ROOT, "packs", "Gliss_RP", "pack_icon.png"))
    make_icon(os.path.join(ROOT, "packs", "Gliss_BP", "pack_icon.png"))
    print("Texturen erzeugt.")
