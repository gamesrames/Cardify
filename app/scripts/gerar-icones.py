"""Gera os ícones do app na identidade Arena (carta verde-limão inclinada sobre o fundo escuro).

Uso (na pasta app/):  python scripts/gerar-icones.py
Precisa do Pillow (pip install pillow). Os PNGs gerados ficam em app/assets/ e entram no repositório;
só rode de novo se mudar as cores ou o desenho da marca.
"""
from pathlib import Path
from PIL import Image, ImageDraw

BG = (12, 14, 19, 255)        # colors.bg
ACCENT = (200, 240, 49, 255)  # colors.accent
BACK = (44, 50, 64, 255)      # colors.line (a carta de trás)
ASSETS = Path(__file__).resolve().parent.parent / "assets"
SS = 4  # desenha 4x maior e reduz no fim: bordas lisas


def card(size: int, height_frac: float, color, angle: float, offset=(0.0, 0.0)) -> Image.Image:
    """Uma carta (retângulo arredondado na proporção 0,72) inclinada, em uma camada transparente."""
    big = size * SS
    layer = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    h = big * height_frac
    w = h * 0.72
    cx = big / 2 + offset[0] * big
    cy = big / 2 + offset[1] * big
    ImageDraw.Draw(layer).rounded_rectangle(
        [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], radius=w * 0.2, fill=color
    )
    return layer.rotate(angle, resample=Image.BICUBIC, center=(cx, cy))


def mark(size: int, scale: float, mono: bool = False) -> Image.Image:
    """A marca: duas cartas em leque. `scale` = altura da carta em relação ao lado da imagem."""
    front = (255, 255, 255, 255) if mono else ACCENT
    back = (255, 255, 255, 110) if mono else BACK
    img = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    img.alpha_composite(card(size, scale, back, -14, offset=(0.07 * scale / 0.56, 0.01)))
    img.alpha_composite(card(size, scale, front, 9, offset=(-0.05 * scale / 0.56, 0.0)))
    return img.resize((size, size), Image.LANCZOS)


def on_background(size: int, scale: float) -> Image.Image:
    img = Image.new("RGBA", (size, size), BG)
    img.alpha_composite(mark(size, scale))
    return img


def main() -> None:
    on_background(1024, 0.56).convert("RGB").save(ASSETS / "icon.png")
    mark(1024, 0.5).save(ASSETS / "splash-icon.png")
    on_background(48, 0.66).save(ASSETS / "favicon.png")
    # Ícone adaptável do Android: o sistema corta a imagem (círculo, quadrado...), então a marca
    # fica dentro da área segura central (cerca de 60% do lado).
    Image.new("RGBA", (512, 512), BG).save(ASSETS / "android-icon-background.png")
    mark(512, 0.4).save(ASSETS / "android-icon-foreground.png")
    mark(432, 0.4, mono=True).save(ASSETS / "android-icon-monochrome.png")
    print("Ícones gerados em", ASSETS)


if __name__ == "__main__":
    main()
