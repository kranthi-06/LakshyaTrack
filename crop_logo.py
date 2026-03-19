import numpy as np
from PIL import Image

def crop_transparent(image_path):
    img = Image.open(image_path).convert('RGBA')
    # Convert image to a numpy array
    data = np.array(img)
    
    # Extract alpha channel
    alpha = data[:, :, 3]
    
    # Create mask where alpha is greater than a threshold (e.g., 50)
    # This filters out faint drop shadows that make the image bounding box huge
    mask = alpha > 50
    
    # Find the indices of non-transparent rows/cols
    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    
    # Determine bounding box
    if not np.any(rows) or not np.any(cols):
        print("Empty or fully transparent image - unable to crop")
        return
        
    ymin, ymax = np.where(rows)[0][[0, -1]]
    xmin, xmax = np.where(cols)[0][[0, -1]]
    
    print(f"Original size: {img.size}")
    print(f"Calculated tight bounding box with alpha > 50: ({xmin}, {ymin}, {xmax}, {ymax})")
    
    # Calculate a small padding (5% of shortest side)
    width = xmax - xmin
    height = ymax - ymin
    pad = int(min(width, height) * 0.05)
    
    new_box = (
        max(0, xmin - pad),
        max(0, ymin - pad),
        min(img.width, xmax + pad),
        min(img.height, ymax + pad)
    )
    
    cropped = img.crop((new_box[0], new_box[1], new_box[2] + 1, new_box[3] + 1))
    cropped.save(image_path)
    print("Cropped successfully to size:", cropped.size)

crop_transparent('frontend/src/assets/logo.png')
