"""Gera versões transparentes do logo a partir de public/logo.jpeg.

- logo-dark.png: fundo preto removido, cores originais (para fundos escuros)
- logo-light.png: fundo removido e texto branco escurecido (para fundos claros)
"""
from PIL import Image
import os

ROOT = os.path.join(os.path.dirname(__file__), "..", "public")
src = Image.open(os.path.join(ROOT, "logo.jpeg")).convert("RGBA")
px = src.load()
w, h = src.size

LO, HI = 35, 110  # rampa de alpha baseada no canal mais claro (mata ruído do JPEG)
DARK_TEXT = (26, 26, 46)  # #1a1a2e, mesma cor primária do app

dark = Image.new("RGBA", (w, h))
light = Image.new("RGBA", (w, h))
dpx, lpx = dark.load(), light.load()

for y in range(h):
    for x in range(w):
        r, g, b, _ = px[x, y]
        v = max(r, g, b)
        if v <= LO:
            a = 0
        elif v >= HI:
            a = 255
        else:
            a = int(255 * (v - LO) / (HI - LO))
        if a == 0:
            continue
        # remove a mistura com o fundo preto (evita borda escura)
        scale = 255 / v
        rr, gg, bb = min(255, int(r * scale)), min(255, int(g * scale)), min(255, int(b * scale))
        dpx[x, y] = (rr, gg, bb, a)
        # versão clara: pixels brancos/cinza (baixa saturação) viram escuros
        mn = min(rr, gg, bb)
        if mn > 140 and (max(rr, gg, bb) - mn) < 60:
            lpx[x, y] = (*DARK_TEXT, a)
        else:
            lpx[x, y] = (rr, gg, bb, a)

bbox = dark.getbbox()
pad = 8
bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(w, bbox[2] + pad), min(h, bbox[3] + pad))
dark.crop(bbox).save(os.path.join(ROOT, "logo-dark.png"))
light.crop(bbox).save(os.path.join(ROOT, "logo-light.png"))
print("ok", bbox)
