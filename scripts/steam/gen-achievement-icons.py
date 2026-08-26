#!/usr/bin/env python3
# Gera os 12 ícones de achievement (64×64) do Lago Quieto — versão colorida e cinza (locked).
# Saída: store/achievements/<id>.png e <id>_gray.png. Desenho vetorial simples com Pillow (sem fontes).
import math, os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'store', 'achievements')
os.makedirs(OUT, exist_ok=True)
S = 64; SS = 4; W = S * SS  # desenha em 256 e reduz (antialias)

NIGHT = (14, 22, 44); WATER = (26, 46, 84); MOON = (245, 236, 200)
FIRE = (255, 214, 102); GOLD = (255, 184, 60); LILY = (240, 170, 200)
LEAF = (60, 130, 90); FOG = (200, 210, 225); AUR = [(90, 230, 170), (120, 160, 255), (200, 120, 255)]

def base(bg=NIGHT):
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, W - 1, W - 1], radius=W // 6, fill=bg)
    return im, d

def water(d, y=0.62, col=WATER):
    d.rectangle([0, int(W * y), W, W], fill=col)

def rings(d, cx, cy, n=3, col=(180, 210, 255), step=0.09):
    for i in range(1, n + 1):
        r = W * step * i; ry = r * 0.45
        d.ellipse([cx - r, cy - ry, cx + r, cy + ry], outline=col + (max(60, 255 - i * 60),), width=SS * 2)

def glow(im, pts, col, r):
    g = Image.new('RGBA', (W, W), (0, 0, 0, 0)); gd = ImageDraw.Draw(g)
    for (x, y) in pts: gd.ellipse([x - r, y - r, x + r, y + r], fill=col + (200,))
    g = g.filter(ImageFilter.GaussianBlur(r * 0.8))
    im.alpha_composite(g)

def moon(d, cx, cy, r, col=MOON):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)

# ---- os 12 ícones -------------------------------------------------------
def first_stone():
    im, d = base(); water(d)
    rings(d, W * .5, W * .72, 3)
    d.ellipse([W * .44, W * .3, W * .56, W * .42], fill=(120, 120, 130))  # pedra caindo
    return im

def woke_someone():
    im, d = base(); water(d, .75)
    glow(im, [(W * .5, W * .4)], FIRE, W * .08)
    d = ImageDraw.Draw(im); d.ellipse([W * .45, W * .35, W * .55, W * .45], fill=FIRE)
    return im

def full_moon():
    im, d = base(); water(d, .65)
    glow(im, [(W * .5, W * .36)], MOON, W * .12)
    d = ImageDraw.Draw(im); moon(d, W * .5, W * .36, W * .18)
    for i in range(4):  # reflexo fatiado
        y = W * (.7 + i * .06); w = W * (.16 - i * .03)
        d.rectangle([W * .5 - w, y, W * .5 + w, y + SS * 2], fill=MOON + (160,))
    return im

def clear_view():
    im, d = base(); water(d, .7)
    # montanhas nítidas
    d.polygon([(0, W * .7), (W * .3, W * .3), (W * .55, W * .7)], fill=(40, 60, 100))
    d.polygon([(W * .4, W * .7), (W * .7, W * .38), (W, W * .7)], fill=(55, 80, 125))
    d.polygon([(W * .3, W * .3), (W * .25, W * .38), (W * .35, W * .38)], fill=(230, 235, 245))
    return im

def golden_fish():
    im, d = base(); water(d)
    glow(im, [(W * .5, W * .45)], GOLD, W * .1)
    d = ImageDraw.Draw(im)
    d.ellipse([W * .3, W * .36, W * .62, W * .54], fill=GOLD)                       # corpo
    d.polygon([(W * .6, W * .45), (W * .78, W * .32), (W * .78, W * .58)], fill=GOLD)  # cauda
    d.ellipse([W * .36, W * .41, W * .4, W * .45], fill=NIGHT)                        # olho
    rings(d, W * .46, W * .7, 2)
    return im

def night_bloom():
    im, d = base(); water(d, .55)
    cx, cy = W * .5, W * .6
    d.ellipse([cx - W * .3, cy - W * .1, cx + W * .3, cy + W * .12], fill=LEAF)  # folha
    for k in range(8):  # pétalas
        a = k * math.pi / 4; px, py = cx + math.cos(a) * W * .13, cy - W * .05 + math.sin(a) * W * .07
        d.ellipse([px - W * .07, py - W * .07, px + W * .07, py + W * .07], fill=LILY)
    d.ellipse([cx - W * .05, cy - W * .1, cx + W * .05, cy], fill=FIRE)
    return im

def aurora():
    im, d = base(); water(d, .72)
    for i, c in enumerate(AUR):  # faixas onduladas
        pts = [(x, W * (.25 + i * .1) + math.sin(x / W * 6 + i) * W * .05) for x in range(0, W + 1, SS * 2)]
        d.line(pts, fill=c + (190,), width=SS * 7)
    im = im.filter(ImageFilter.GaussianBlur(SS))
    return im

def until_dawn():
    im, d = base((70, 60, 110))
    for y in range(int(W * .62)):  # gradiente de amanhecer
        t = y / (W * .62); c = tuple(int(a + (b - a) * t) for a, b in zip((60, 50, 110), (250, 170, 120)))
        d.line([(0, y), (W, y)], fill=c)
    water(d, .62, (90, 80, 130))
    d.rounded_rectangle([0, 0, W - 1, W - 1], radius=W // 6, outline=(0, 0, 0, 0), width=1)
    d.ellipse([W * .35, W * .46, W * .65, W * .76], fill=(255, 220, 150))
    d.rectangle([0, W * .62, W, W * .63], fill=(90, 80, 130))
    d.rectangle([0, W * .63, W, W], fill=(90, 80, 130))
    d.ellipse([W * .35, W * .46, W * .65, W * .62], fill=(255, 220, 150))  # sol meio nascido
    return im

def just_watching():
    im, d = base(); water(d, .7)
    d.ellipse([W * .3, W * .3, W * .7, W * .7], outline=FOG, width=SS * 3)  # relógio
    d.line([(W * .5, W * .5), (W * .5, W * .35)], fill=FOG, width=SS * 3)
    d.line([(W * .5, W * .5), (W * .6, W * .5)], fill=FOG, width=SS * 3)
    # olho fechado
    d.arc([W * .38, W * .74, W * .62, W * .9], 0, 180, fill=FOG, width=SS * 2)
    return im

def accidental_melody():
    im, d = base(); water(d, .8)
    for i in range(5):  # 5 notas ascendentes
        x = W * (.18 + i * .16); y = W * (.62 - i * .09)
        d.ellipse([x - W * .05, y - W * .04, x + W * .05, y + W * .04], fill=(180, 220, 255))
        d.line([(x + W * .045, y), (x + W * .045, y - W * .16)], fill=(180, 220, 255), width=SS * 2)
    return im

def left_light_on():
    im, d = base(); water(d, .78)
    glow(im, [(W * .5, W * .42)], FIRE, W * .14)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([W * .4, W * .3, W * .6, W * .62], radius=SS * 4, fill=(90, 70, 50))  # lanterna
    d.rectangle([W * .44, W * .36, W * .56, W * .56], fill=FIRE)
    d.rectangle([W * .47, W * .24, W * .53, W * .3], fill=(90, 70, 50))
    return im

def thousand_ripples():
    im, d = base(); water(d, .3, WATER)
    for (x, y) in [(.3, .5), (.65, .45), (.5, .75), (.8, .7), (.2, .8)]:
        rings(d, W * x, W * y, 3, (200, 225, 255), .06)
    return im

ICONS = {
    'first_stone': first_stone, 'woke_someone': woke_someone, 'full_moon': full_moon,
    'clear_view': clear_view, 'golden_fish': golden_fish, 'night_bloom': night_bloom,
    'aurora': aurora, 'until_dawn': until_dawn, 'just_watching': just_watching,
    'accidental_melody': accidental_melody, 'left_light_on': left_light_on,
    'thousand_ripples': thousand_ripples,
}

for name, fn in ICONS.items():
    im = fn().resize((S, S), Image.LANCZOS)
    im.save(os.path.join(OUT, f'{name}.png'))
    # versão cinza (locked): dessatura + escurece, mantém alpha
    a = im.getchannel('A')
    g = im.convert('L').point(lambda v: int(v * 0.55 + 20)).convert('RGBA'); g.putalpha(a)
    g.save(os.path.join(OUT, f'{name}_gray.png'))
    print('ok', name)
