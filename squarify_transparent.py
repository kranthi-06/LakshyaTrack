from PIL import Image
import numpy as np

def extract_and_squarify(source_path, dest_path):
    img = Image.open(source_path).convert('RGBA')
    
    # 1. Exact pure crest bounds
    crest = img.crop((305, 51, 718, 590))
    
    # 2. Clean faint noise
    data = np.array(crest)
    alpha = data[:, :, 3]
    alpha[alpha < 80] = 0
    data[:, :, 3] = alpha
    clean_crest = Image.fromarray(data, 'RGBA')
    
    # 3. Squarify purely with transparent pixels to provide perfect structure for Favicon
    width, height = clean_crest.size
    size = max(width, height)
    
    square_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    paste_x = (size - width) // 2
    paste_y = (size - height) // 2
    
    square_img.paste(clean_crest, (paste_x, paste_y))
    square_img.save(dest_path)
    print("Saved perfect transparent square crest to", dest_path)

extract_and_squarify(
    r'C:\Users\Dell\.gemini\antigravity\brain\08c9ef05-504f-487a-b032-799ef2de4a2f\media__1773920604519.png',
    r'frontend/src/assets/logo.png'
)
