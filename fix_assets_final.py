from PIL import Image
import numpy as np

def fix_assets(source_path):
    # 1. Open original raw image
    img = Image.open(source_path).convert('RGBA')
    
    # 2. Extract pure crest precisely (the tight crop that you loved)
    crest = img.crop((305, 51, 718, 590))
    
    # 3. Clean alpha noise to make it super crisp
    data = np.array(crest)
    alpha = data[:, :, 3]
    alpha[alpha < 80] = 0
    data[:, :, 3] = alpha
    clean_crest = Image.fromarray(data, 'RGBA')
    
    # --- LOGO.PNG (Tight Crop) ---
    # This tight crop ensures the logo is MASSIVE inside the sidebar/navbar without weird padding
    clean_crest.save('frontend/src/assets/logo.png')
    
    # --- FAVICON.PNG (Perfectly Squared) ---
    # To make a Favicon look like Google/Gemini, it must be exactly 1:1 aspect ratio.
    # We create a perfect square constrained by the height of the tight logo, 
    # so the logo perfectly touches the absolute top and bottom of the tab!
    width, height = clean_crest.size
    size = max(width, height)
    favicon_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    paste_x = (size - width) // 2
    paste_y = (size - height) // 2
    favicon_img.paste(clean_crest, (paste_x, paste_y))
    favicon_img.save('frontend/src/assets/favicon.png')
    print("Assets generated perfectly: tight logo for UI, squared logo for Favicon.")

fix_assets(r'C:\Users\Dell\.gemini\antigravity\brain\08c9ef05-504f-487a-b032-799ef2de4a2f\media__1773920604519.png')
