from PIL import Image
import numpy as np

def create_favicon(source_path, dest_path):
    img = Image.open(source_path).convert('RGBA')
    
    # Extract just the top square of the crest (the main medallion/star)
    # The full crest was (305, 51, 718, 590) -> roughly 413 wide
    # To make a perfectly bold 1:1 favicon, we crop just the top 413px height
    # so we get the solid, bold circle of the emblem!
    favicon = img.crop((305, 51, 718, 464)) # (x1, y1, x2, y2)
    
    # Clean faint noise aggressively to ensure crisp 16x16 edges
    data = np.array(favicon)
    alpha = data[:, :, 3]
    alpha[alpha < 80] = 0
    data[:, :, 3] = alpha
    clean_favicon = Image.fromarray(data, 'RGBA')
    
    clean_favicon.save(dest_path)
    print("Saved perfect bold square favicon to", dest_path)

create_favicon(
    r'C:\Users\Dell\.gemini\antigravity\brain\08c9ef05-504f-487a-b032-799ef2de4a2f\media__1773920604519.png',
    r'frontend/src/assets/favicon.png'
)
