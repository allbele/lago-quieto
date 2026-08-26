#!/usr/bin/env python3
# Gera as cápsulas da loja Steam a partir dos screenshots (1280x720) + título/tagline.
# Uso: python3 scripts/gerar-capsulas.py   (requer Pillow)
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(RAIZ, "store", "screenshots")
OUT = os.path.join(RAIZ, "store", "capsules")
os.makedirs(OUT, exist_ok=True)

FONTE = "/System/Library/Fonts/Supplemental/Baskerville.ttc"
CLARO = (233, 242, 255)          # #e9f2ff — lua/estrelas
CEU = (5, 9, 20)                 # #050914
TITULO = "Lago Quieto"
TAGLINE = "Jogue uma pedra. O lago faz o resto."

def fonte(tam, italico=False):
    # Baskerville.ttc: índice 0 = Regular, 2 = Italic
    try:
        return ImageFont.truetype(FONTE, tam, index=2 if italico else 0)
    except Exception:
        return ImageFont.truetype(FONTE, tam)

def shot(nome):
    return Image.open(os.path.join(SHOTS, nome)).convert("RGBA")

def cover(img, w, h, foco=(0.5, 0.5)):
    """Escala para cobrir w×h e recorta ao redor do ponto de foco (frações)."""
    iw, ih = img.size
    s = max(w / iw, h / ih)
    img = img.resize((round(iw * s), round(ih * s)), Image.LANCZOS)
    iw, ih = img.size
    x = min(max(int(iw * foco[0] - w / 2), 0), iw - w)
    y = min(max(int(ih * foco[1] - h / 2), 0), ih - h)
    return img.crop((x, y, x + w, y + h))

def escurecer_base(img, forca=0.55, altura=0.45):
    """Gradiente escuro na parte inferior para legibilidade do texto."""
    w, h = img.size
    grad = Image.new("L", (1, h), 0)
    px = grad.load()
    ini = int(h * (1 - altura))
    for y in range(ini, h):
        t = (y - ini) / max(1, h - ini)
        px[0, y] = int(255 * forca * (t ** 1.2))
    grad = grad.resize((w, h))
    capa = Image.new("RGBA", (w, h), CEU + (255,))
    capa.putalpha(grad)
    return Image.alpha_composite(img, capa)

def texto_glow(base, xy, txt, f, cor=CLARO, glow=8, ancora="mm"):
    """Escreve texto com brilho suave (como a lua) e sombra leve."""
    w, h = base.size
    camada = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    d.text(xy, txt, font=f, fill=cor + (140,), anchor=ancora)
    camada = camada.filter(ImageFilter.GaussianBlur(glow))
    base = Image.alpha_composite(base, camada)
    d = ImageDraw.Draw(base)
    d.text((xy[0] + 1, xy[1] + 2), txt, font=f, fill=(0, 0, 0, 110), anchor=ancora)
    d.text(xy, txt, font=f, fill=cor + (255,), anchor=ancora)
    return base

def anel(base, cx, cy, r, cor=(31, 95, 122), alpha=120, largura=2):
    """Anel de ondulação (marca do jogo) — elipse achatada como reflexo na água."""
    w, h = base.size
    camada = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    for i, a in enumerate((alpha, alpha // 2, alpha // 4)):
        rr = r + i * r * 0.45
        d.ellipse((cx - rr, cy - rr * 0.35, cx + rr, cy + rr * 0.35),
                  outline=cor + (a,), width=largura)
    return Image.alpha_composite(base, camada)

def salvar(img, nome, w, h):
    assert img.size == (w, h), (nome, img.size)
    img.save(os.path.join(OUT, f"{nome}_{w}x{h}.png"), "PNG", optimize=True)
    print("ok", f"{nome}_{w}x{h}.png")

def composicao(img_nome, w, h, foco, t_tam, tag_tam, pos_y, tagline=True, escurecer=0.55):
    base = cover(shot(img_nome), w, h, foco)
    base = escurecer_base(base, escurecer)
    ty = int(h * pos_y)
    base = texto_glow(base, (w // 2, ty), TITULO, fonte(t_tam), glow=max(4, t_tam // 14))
    if tagline:
        base = texto_glow(base, (w // 2, ty + int(t_tam * 0.85)), TAGLINE,
                          fonte(tag_tam, italico=True), glow=3)
    return base

# --- Cápsulas ---------------------------------------------------------------
# header 920x430 — lua + vagalumes, título grande centralizado embaixo
salvar(composicao("04-lirios-sapo.png", 920, 430, (0.62, 0.45), 96, 30, 0.72), "header", 920, 430)

# small 462x174 — só o título, legível em miniatura
salvar(composicao("03-lua.png", 462, 174, (0.62, 0.35), 58, 0, 0.62, tagline=False, escurecer=0.6),
       "small", 462, 174)

# main 1232x706 — cena completa + título + tagline
salvar(composicao("04-lirios-sapo.png", 1232, 706, (0.55, 0.5), 132, 40, 0.74), "main", 1232, 706)

# vertical 748x896 — aurora/amanhecer, retrato; título no terço inferior
salvar(composicao("05-aurora.png", 748, 896, (0.55, 0.5), 104, 30, 0.78, escurecer=0.65),
       "vertical", 748, 896)

# library 600x900 — retrato com lua acima e água embaixo
salvar(composicao("03-lua.png", 600, 900, (0.68, 0.5), 92, 26, 0.80, escurecer=0.65),
       "library", 600, 900)

# library hero 3840x1240 — só a cena, sem texto (o logo vai por cima na Steam)
hero = cover(shot("03-lua.png"), 3840, 1240, (0.5, 0.42))
hero = escurecer_base(hero, 0.35, 0.5)
salvar(hero, "library_hero", 3840, 1240)

# library logo 1280x720 — fundo transparente, título + anel
logo = Image.new("RGBA", (1280, 720), (0, 0, 0, 0))
logo = texto_glow(logo, (640, 330), TITULO, fonte(170), glow=14)
logo = texto_glow(logo, (640, 470), TAGLINE, fonte(44, italico=True), glow=4)
logo = anel(logo, 640, 560, 160, cor=CLARO, alpha=150, largura=3)
salvar(logo, "library_logo", 1280, 720)

# page background 1438x810 — cena escurecida e suavizada (fundo da página da loja)
bg = cover(shot("02-vagalumes.png"), 1438, 810, (0.5, 0.5)).filter(ImageFilter.GaussianBlur(2))
capa = Image.new("RGBA", bg.size, CEU + (120,))
bg = Image.alpha_composite(bg, capa)
salvar(bg, "page_background", 1438, 810)

# community icon 184x184 — lua sobre água + inicial "L"
ic = cover(shot("03-lua.png"), 184, 184, (0.68, 0.25))
ic = escurecer_base(ic, 0.5, 0.6)
ic = texto_glow(ic, (92, 108), "LQ", fonte(78), glow=5)
salvar(ic, "community_icon", 184, 184)

# client icon 32x32 — versão minúscula: céu + anel + ponto de lua
ci = Image.new("RGBA", (32, 32), CEU + (255,))
d = ImageDraw.Draw(ci)
for y in range(32):
    t = y / 31
    d.line((0, y, 32, y), fill=(int(5 + 13 * t), int(9 + 49 * t), int(20 + 72 * t), 255))
d.ellipse((21, 5, 27, 11), fill=CLARO + (255,))
ci = anel(ci, 16, 22, 10, cor=CLARO, alpha=230, largura=1)
salvar(ci, "client_icon", 32, 32)
