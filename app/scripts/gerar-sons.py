"""Gera os efeitos sonoros do app (app/assets/sfx/*.wav) por síntese, sem usar gravações de ninguém.

Por isso não há licença de terceiros: os sons são do próprio projeto. Para mudar um som, ajuste a
função dele aqui e rode de novo:

    python scripts/gerar-sons.py        (precisa de Python 3 com numpy: pip install numpy)

Formato: WAV mono, 16 bits, 22.050 Hz (toca em iOS, Android e navegador sem conversão).
"""
import os
import wave

import numpy as np

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sfx')
rng = np.random.default_rng(7)  # semente fixa: rodar de novo gera arquivos idênticos


def t(seconds):
    return np.arange(int(SR * seconds)) / SR


def env(n, attack=0.005, decay=6.0):
    """Envelope: sobe rápido e cai em exponencial (decay maior = som mais curto)."""
    x = np.arange(n) / SR
    return np.minimum(1.0, x / attack) * np.exp(-decay * x)


def tone(freq, seconds, decay=6.0, harmonics=(1.0, 0.3, 0.1)):
    x = t(seconds)
    wave_ = sum(a * np.sin(2 * np.pi * freq * (i + 1) * x) for i, a in enumerate(harmonics))
    return wave_ * env(len(x), decay=decay)


def sweep(f0, f1, seconds, decay=6.0):
    x = t(seconds)
    freq = f0 * (f1 / f0) ** (x / seconds)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    return np.sin(phase) * env(len(x), decay=decay)


def noise(seconds, decay=20.0, smooth=4):
    x = rng.standard_normal(int(SR * seconds))
    x = np.convolve(x, np.ones(smooth) / smooth, mode='same')  # tira o chiado mais agudo
    return x * env(len(x), attack=0.002, decay=decay)


def mix(*parts):
    """Soma trechos que começam em tempos diferentes: (inicio_em_segundos, amostras)."""
    total = max(int(start * SR) + len(p) for start, p in parts)
    out = np.zeros(total)
    for start, p in parts:
        i = int(start * SR)
        out[i:i + len(p)] += p
    return out


def save(name, samples, peak=0.6):
    samples = samples / max(1e-9, np.max(np.abs(samples))) * peak
    fade = min(len(samples), int(SR * 0.01))
    samples[-fade:] *= np.linspace(1, 0, fade)  # evita estalo no fim
    data = (samples * 32767).astype('<i2')
    os.makedirs(OUT, exist_ok=True)
    with wave.open(os.path.join(OUT, f'{name}.wav'), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(data.tobytes())
    print(f'{name}.wav  {len(samples) / SR:.2f} s  {len(data) * 2 / 1024:.0f} KB')


# Toque em botão: clique curto e seco.
save('tap', mix((0, tone(880, 0.05, decay=70)), (0, 0.3 * noise(0.02, decay=200))), peak=0.35)

# Escolher carta da mão: "blip" agudo.
save('select', sweep(700, 1100, 0.07, decay=35), peak=0.35)

# Carta colocada na mesa: sopro curto + batida grave.
save('play', mix((0, 0.5 * noise(0.12, decay=28, smooth=10)), (0.03, sweep(190, 90, 0.16, decay=22))), peak=0.6)

# Dano: estalo + queda grave.
save('hit', mix((0, 0.8 * noise(0.09, decay=40, smooth=3)), (0, sweep(260, 60, 0.22, decay=16))), peak=0.7)

# Sua vez: duas notas subindo.
save('turn', mix((0, tone(659.3, 0.25, decay=10)), (0.11, tone(880.0, 0.35, decay=9))), peak=0.45)

# Carta nova revelada: brilho subindo e um acorde.
save('reveal', mix(
    (0, 0.35 * sweep(500, 2400, 0.35, decay=5)),
    (0.3, tone(783.99, 0.6, decay=5)),
    (0.3, tone(987.77, 0.6, decay=5)),
    (0.3, tone(1174.66, 0.6, decay=5)),
), peak=0.5)

# Vitória: arpejo maior subindo.
save('win', mix(*[(i * 0.12, tone(f, 0.7 if i == 3 else 0.3, decay=4 if i == 3 else 9))
                  for i, f in enumerate([523.25, 659.25, 783.99, 1046.5])]), peak=0.55)

# Derrota: três notas descendo, mais abafadas.
save('lose', mix(*[(i * 0.2, tone(f, 0.6 if i == 2 else 0.3, decay=5 if i == 2 else 8, harmonics=(1.0, 0.15)))
                   for i, f in enumerate([392.0, 311.13, 261.63])]), peak=0.45)
