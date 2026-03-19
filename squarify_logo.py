from PIL import Image

def squarify(image_path):
    img = Image.open(image_path).convert('RGBA')
    width, height = img.size
    
    if width == height:
        print("Already square")
        return
        
    size = max(width, height)
    # Create new transparent image
    new_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    
    # Paste old image centered
    paste_x = (size - width) // 2
    paste_y = (size - height) // 2
    
    new_img.paste(img, (paste_x, paste_y))
    new_img.save(image_path)
    print(f"Squarified image from {width}x{height} to {size}x{size}")

squarify('frontend/src/assets/logo.png')
