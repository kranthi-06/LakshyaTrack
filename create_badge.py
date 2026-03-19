import numpy as np
from PIL import Image, ImageDraw, ImageFilter

def create_circular_badge(source_path, dest_path):
    img = Image.open(source_path).convert('RGBA')
    
    # The true bounding box of the crest from the original image was:
    # (305, 51, 718, 590)
    crest = img.crop((305, 51, 718, 590))
    
    # The crest is 413 wide and 539 tall.
    # Let's create a perfect 800x800 transparent badge image
    size = 800
    badge = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    
    # We will draw a solid circular background
    # Let's use a nice premium dark slate/indigo color, matching the theme.
    # Theme dark background is #0f172a or #1e1b4b. Let's use #1e293b (slate-800)
    bg_color = (30, 41, 59, 255) # Solid slate-800
    
    # Draw high res circle for anti-aliasing, then resize
    scale = 4
    mask = Image.new('L', (size * scale, size * scale), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size * scale, size * scale), fill=255)
    mask = mask.resize((size, size), Image.Resampling.LANCZOS)
    
    # Create the colored circle
    circle_bg = Image.new('RGBA', (size, size), bg_color)
    
    # Put the colored circle on the transparent badge using the mask
    badge.paste(circle_bg, (0, 0), mask)
    
    # Now paste the crest in the middle
    # Let's scale the crest to fit nicely inside the 800x800 circle.
    # Height should be around 75% of 800 = 600.
    target_height = int(size * 0.70)
    aspect_ratio = crest.width / crest.height
    target_width = int(target_height * aspect_ratio)
    
    crest_resized = crest.resize((target_width, target_height), Image.Resampling.LANCZOS)
    
    # Find center position
    paste_x = (size - target_width) // 2
    paste_y = (size - target_height) // 2
    
    # Clean up crest noise
    # We apply a slight alpha threshold to clean up any messy glow
    crest_data = np.array(crest_resized)
    alpha = crest_data[:, :, 3]
    alpha[alpha < 50] = 0
    crest_data[:, :, 3] = alpha
    crest_cleaned = Image.fromarray(crest_data, 'RGBA')
    
    # Paste the cleaned crest onto the badge
    badge.paste(crest_cleaned, (paste_x, paste_y), crest_cleaned)
    
    # Save the new final badge!
    badge.save(dest_path)
    print("Created perfect circular badge! Saved to", dest_path)

create_circular_badge(
    r'C:\Users\Dell\.gemini\antigravity\brain\08c9ef05-504f-487a-b032-799ef2de4a2f\media__1773920604519.png',
    r'frontend/src/assets/logo.png'
)
