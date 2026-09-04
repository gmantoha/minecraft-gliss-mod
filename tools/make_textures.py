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


LASER_SPRITE = [
    "................",
    "............rr..",
    "...........rcc..",
    "..........gggc..",
    ".........gGgg...",
    "........gGgg....",
    ".......gGgg.....",
    "......gGgg......",
    ".....gGgg.......",
    "....gGgg........",
    "...dGg..........",
    "..ddd...........",
    ".ddd............",
    ".dd.............",
    "................",
    "................",
]
LASER_COLORS = {
    "g": (96, 104, 112, 255),    # Gehäuse
    "G": (150, 160, 170, 255),   # Glanzkante
    "d": (58, 42, 30, 255),      # Griff
    "c": (120, 235, 255, 255),   # Linse
    "r": (255, 70, 60, 255),     # Emitter/Strahl
}


def make_laser(path):
    rows = [[LASER_COLORS.get(ch, (0, 0, 0, 0)) for ch in line] for line in LASER_SPRITE]
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
