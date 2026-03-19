from PIL import Image

def restore(src, dest):
    img = Image.open(src).convert("RGBA")
    # Squarify the image WITHOUT cropping to preserve the full original artwork
    width, height = img.size
    size = max(width, height)
    square = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    paste_x = (size - width) // 2
    paste_y = (size - height) // 2
    square.paste(img, (paste_x, paste_y))
    square.save(dest)
    print("Safely squarified and saved to", dest)

src = r'C:\Users\Dell\.gemini\antigravity\brain\08c9ef05-504f-487a-b032-799ef2de4a2f\media__1773920604519.png'
restore(src, 'frontend/src/assets/logo.png')
restore(src, 'frontend/src/assets/favicon.png')
