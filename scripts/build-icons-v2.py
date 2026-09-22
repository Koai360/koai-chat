#!/opt/koai-api/.venv/bin/python3
"""Íconos del PWA a partir del App Icon de iOS (candidato A: la marca de Noa sobre navy).

S332 — decisión de Jesús del 2026-08-22 en noa-ios: el logo nuevo (azul/cian/violeta sobre
navy #000C2D) es la identidad de Noa; el cerebro hexagonal en lima quedó atrás. El PWA
seguía generando sus íconos desde el master viejo (build-icons.py); este script los deriva
del MISMO PNG que usa la app (design/noa-appicon-A-1024.png, RGB, sin alpha, sin esquinas:
Android/iOS aplican su máscara), así los dos productos se ven iguales en la misma pantalla.

    scripts/build-icons-v2.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "design" / "noa-appicon-A-1024.png"
OUT = ROOT / "public"

master = Image.open(SRC).convert("RGB")
assert master.size == (1024, 1024), master.size

targets = {
    OUT / "icons" / "noa-appicon-1024.png": 1024,
    OUT / "icons" / "noa-512.png": 512,
    OUT / "icons" / "noa-192.png": 192,
    OUT / "apple-touch-icon.png": 180,
}
for path, side in targets.items():
    img = master if side == 1024 else master.resize((side, side), Image.LANCZOS)
    img.save(path, "PNG", optimize=True)
    print(f"✓ {path.relative_to(ROOT)} {side}px")

# favicons PNG explícitos (index.html los declara con sizes) — ver también el SVG en public/brand/
for s_ in (32, 16):
    master.resize((s_, s_), Image.LANCZOS).save(OUT / "icons" / f"favicon-{s_}.png", "PNG", optimize=True)
    print(f"✓ public/icons/favicon-{s_}.png")

# favicon.ico multi-tamaño (el navegador elige)
fav = [master.resize((s, s), Image.LANCZOS) for s in (16, 32, 48)]
fav[0].save(OUT / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=fav[1:])
print("✓ public/favicon.ico 16/32/48")
