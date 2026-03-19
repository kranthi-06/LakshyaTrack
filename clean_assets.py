from PIL import Image

def generate_perfect_assets():
    # Load original raw AI image untouched
    src = r'C:\Users\Dell\.gemini\antigravity\brain\08c9ef05-504f-487a-b032-799ef2de4a2f\media__1773920604519.png'
    img = Image.open(src).convert('RGBA')
    
    # Crop precisely based on the tight bounding box WITHOUT applying any jagged alpha filters!
    # This preserves the glowing edges, the smooth anti-aliasing, and the exact artwork.
    # The bounding box maxes at (304, 51) to (718, 590) 
    logo_img = img.crop((304, 51, 718, 590))
    
    # Save logo.png right away. The edges are completely smooth and natural.
    logo_img.save('frontend/src/assets/logo.png')
    
    # For the Favicon: squarify the logo precisely so the browser can center it.
    width, height = logo_img.size
    size = max(width, height)
    # create transparent square
    favicon_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    # paste the logo perfectly in the center
    paste_x = (size - width) // 2
    paste_y = (size - height) // 2
    favicon_img.paste(logo_img, (paste_x, paste_y))
    # resize down to standard typical high-res favicon format with heavy anti-aliasing
    favicon_img = favicon_img.resize((512, 512), Image.Resampling.LANCZOS)
    
    favicon_img.save('frontend/src/assets/favicon.png')
    print("Flawless smooth logo and favicon generated!")

generate_perfect_assets()
