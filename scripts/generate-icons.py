"""Generate Pockit's geometric pocket mark at PWA and Apple icon sizes."""
from pathlib import Path
from PIL import Image, ImageDraw

destination = Path(__file__).resolve().parents[1] / 'public' / 'icons'
destination.mkdir(parents=True, exist_ok=True)
for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png'), (180, 'apple-touch-icon.png')]:
    scale = 4
    image = Image.new('RGB', (size * scale, size * scale), '#3265d8')
    draw = ImageDraw.Draw(image)
    def points(coords):
        return [(round(x * size * scale), round(y * size * scale)) for x, y in coords]
    draw.line(points([(0.29, 0.28), (0.71, 0.28), (0.71, 0.59), (0.67, 0.66), (0.5, 0.76), (0.33, 0.66), (0.29, 0.59), (0.29, 0.28)]), fill='#fffdf6', width=round(size * scale * .035), joint='curve')
    draw.ellipse((.45*size*scale,.15*size*scale,.65*size*scale,.35*size*scale), fill='#ffd65a')
    draw.line(points([(0.4, 0.4), (0.6, 0.4)]), fill='#fffdf6', width=round(size * scale * .035))
    image.resize((size, size), Image.Resampling.LANCZOS).save(destination / name)
