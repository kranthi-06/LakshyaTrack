from PIL import Image
import numpy as np

def extract_pure_crest(source_path, dest_path):
    img = Image.open(source_path).convert('RGBA')
    
    # The true bounding box of the crest from the original image was:
    # (305, 51, 718, 590) Let's add no padding.
    crest = img.crop((305, 51, 718, 590))
    
    # Clean faint noise aggressively without adding any shapes or backgrounds
    data = np.array(crest)
    alpha = data[:, :, 3]
    alpha[alpha < 80] = 0
    data[:, :, 3] = alpha
    
    clean_crest = Image.fromarray(data, 'RGBA')
    clean_crest.save(dest_path)
    print("Saved pure extracted crest without background to", dest_path)

extract_pure_crest(
    r'C:\Users\Dell\.gemini\antigravity\brain\08c9ef05-504f-487a-b032-799ef2de4a2f\media__1773920604519.png',
    r'frontend/src/assets/logo.png'
)
