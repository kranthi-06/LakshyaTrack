import numpy as np
from PIL import Image, ImageDraw

def clean_and_mask_logo(image_path):
    # Open the image and ensure it's RGBA
    img = Image.open(image_path).convert('RGBA')
    
    width, height = img.size
    
    # We create a perfect circular mask
    # Since the image is 550x550, the circle should smoothly fit in it
    # We will use anti-aliased drawing by creating a high-res mask and downsizing
    mask_size = width * 4
    mask = Image.new('L', (mask_size, mask_size), 0)
    draw = ImageDraw.Draw(mask)
    
    # Let's add a small padding so we don't crop the emblem itself
    # The logo appears to be slightly smaller than the 550x550 bounds.
    # The true object might be around 450x450 or so.
    pad = int(width * 0.02)
    draw.ellipse((pad*4, pad*4, mask_size - pad*4, mask_size - pad*4), fill=255)
    
    # Downsamplemask with anti-aliasing
    mask = mask.resize((width, height), Image.Resampling.LANCZOS)
    
    # Apply the mask to the alpha channel
    # This completely erases ANY faint noise outside the central circle!
    img_data = np.array(img)
    alpha_channel = img_data[:, :, 3]
    mask_data = np.array(mask)
    
    # Combine original alpha with the circular mask (minimum of both)
    # Actually, we just enforce that anything outside the circle is 0
    new_alpha = np.minimum(alpha_channel, mask_data)
    
    # Additionally, let's aggressively clear ANY noise inside the circle that has alpha < 30
    # to make it perfectly clean.
    new_alpha[new_alpha < 30] = 0
    # And make anything > 200 fully solid 255 for punchiness
    new_alpha[new_alpha > 200] = 255
    
    img_data[:, :, 3] = new_alpha
    
    cleaned_img = Image.fromarray(img_data, 'RGBA')
    cleaned_img.save(image_path)
    print("Cleaned logo with circular anti-aliased mask and aggressive alpha thresholding. Size:", cleaned_img.size)

clean_and_mask_logo('frontend/src/assets/logo.png')
