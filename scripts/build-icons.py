#!/usr/bin/env python3
"""Genera los iconos de la PWA desde el master de la marca de Noa.

    /opt/koai-api/.venv/bin/python3 scripts/build-icons.py

S232 compuso estos PNG a mano y no dejó script: el master vivía sólo en
/home/koai/uploads (cajón de scratch) y el asset no se podía regenerar. Ahora
el master está versionado en design/ y esto es la única fuente de los iconos.

S239 — color: el master mide hue 60.8° (amarillo puro) y Noa reportaba el icono
como "dorado". El lima canónico KOAI es #D1FF03 (hue 71.0°). Se rota el TONO y
se conservan saturación y valor: el master es un render 3D con bevel y brillos
especulares, y repintarlo plano mata el volumen. Los píxeles casi acromáticos
(los brillos) se dejan intactos — teñirlos ensucia el gloss.

Fondo: Morado deep #1A0D27 de la paleta canónica (antes negro). El icono tiene
que leerse "KOAI" en la home screen; una tile negra más no distingue nada.
"""
from __future__ import annotations

import colorsys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "design" / "noa-icon-master-2048.png"
PUBLIC = ROOT / "public"

BG = "#1A0D27"  # Morado deep — paleta canónica KOAI
HUE_MASTER = 60.8  # medido sobre el master (mediana de los píxeles cromáticos)
HUE_LIMA = colorsys.rgb_to_hsv(0xD1 / 255, 0xFF / 255, 0x03 / 255)[0] * 360  # 71.0

# Cuánto del lado ocupa la marca en cada destino:
#   192/512 → 66%: el manifest los declara también `maskable` y Android recorta
#             hasta el 80% central; a sangre se comía las puntas del hexágono.
#   180 (apple-touch) → 76%: iOS sólo redondea esquinas y NO respeta alpha.
#   favicon → 86%: a 16px el margen sobra.
TARGETS = [
    (PUBLIC / "icons" / "noa-192.png", 192, 0.66),
    (PUBLIC / "icons" / "noa-512.png", 512, 0.66),
    (PUBLIC / "apple-touch-icon.png", 180, 0.76),
]
FAVICON_SIZES = [16, 32, 48, 64]
FAVICON_SCALE = 0.86


def to_lime(img: Image.Image) -> Image.Image:
    """Rota el tono del master hasta el lima canónico, preservando el render.

    HSV vectorizado: V = max(r,g,b) y S = (max-min)/max se conservan intactos,
    así que el bevel y los brillos del render 3D quedan exactamente igual —
    sólo se mueve el matiz.
    """
    delta = ((HUE_LIMA - HUE_MASTER) / 360.0) % 1.0
    arr = np.asarray(img, dtype=np.float32) / 255.0
    rgb, alpha = arr[..., :3], arr[..., 3]

    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    chroma = mx - mn
    sat = np.divide(chroma, mx, out=np.zeros_like(mx), where=mx > 0)

    # Matiz en [0,1) — misma definición que colorsys.rgb_to_hsv
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    hue = np.zeros_like(mx)
    safe = chroma > 0
    with np.errstate(invalid="ignore", divide="ignore"):
        rc = np.where(safe, (mx - r) / np.where(safe, chroma, 1), 0)
        gc = np.where(safe, (mx - g) / np.where(safe, chroma, 1), 0)
        bc = np.where(safe, (mx - b) / np.where(safe, chroma, 1), 0)
    hue = np.where(mx == r, bc - gc, np.where(mx == g, 2.0 + rc - bc, 4.0 + gc - rc))
    hue = np.mod(hue / 6.0, 1.0)

    # Sólo los píxeles cromáticos y visibles: el brillo especular casi blanco
    # se deja como está (teñirlo ensucia el gloss).
    touch = (alpha > 0) & (sat >= 0.12)
    hue = np.where(touch, np.mod(hue + delta, 1.0), hue)

    # HSV → RGB vectorizado
    i = np.floor(hue * 6.0)
    f = hue * 6.0 - i
    p = mx * (1.0 - sat)
    q = mx * (1.0 - sat * f)
    t = mx * (1.0 - sat * (1.0 - f))
    i = np.mod(i, 6).astype(np.int32)[..., None]
    out_rgb = np.select(
        [i == 0, i == 1, i == 2, i == 3, i == 4, i == 5],
        [
            np.stack([mx, t, p], -1),
            np.stack([q, mx, p], -1),
            np.stack([p, mx, t], -1),
            np.stack([p, q, mx], -1),
            np.stack([t, p, mx], -1),
            np.stack([mx, p, q], -1),
        ],
    )
    out_rgb = np.where(touch[..., None], out_rgb, rgb)

    out = np.concatenate([out_rgb, alpha[..., None]], axis=-1)
    return Image.fromarray(np.rint(out * 255).clip(0, 255).astype(np.uint8), "RGBA")


def compose(mark: Image.Image, size: int, scale: float) -> Image.Image:
    """Marca centrada sobre BG opaco, ocupando `scale` del lado."""
    canvas = Image.new("RGBA", (size, size), BG)
    box = mark.getbbox()
    assert box is not None
    m = mark.crop(box)
    target = size * scale
    ratio = min(target / m.width, target / m.height)
    m = m.resize((max(1, round(m.width * ratio)), max(1, round(m.height * ratio))), Image.Resampling.LANCZOS)
    canvas.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return canvas


def main() -> None:
    master = Image.open(MASTER).convert("RGBA")
    mark = to_lime(master)

    for path, size, scale in TARGETS:
        path.parent.mkdir(parents=True, exist_ok=True)
        compose(mark, size, scale).save(path, "PNG", optimize=True)
        print(f"  {path.relative_to(ROOT)}  {size}x{size}  marca {scale:.0%}")

    ico = compose(mark, 256, FAVICON_SCALE).convert("RGB")
    ico.save(PUBLIC / "favicon.ico", sizes=[(s, s) for s in FAVICON_SIZES])
    print(f"  {(PUBLIC / 'favicon.ico').relative_to(ROOT)}  {FAVICON_SIZES}  marca {FAVICON_SCALE:.0%}")


if __name__ == "__main__":
    main()
