from PIL import Image
import numpy as np

def analyze_and_extract(src):
    img = Image.open(src).convert("RGBA")
    data = np.array(img)
    alpha = data[:, :, 3]
    
    # Let's find bounding box for alpha > 10, > 20, > 30, > 40
    for threshold in (10, 20, 30, 40, 50, 60, 70, 80):
        y_indices, x_indices = np.where(alpha > threshold)
        if len(y_indices) > 0:
            ymin, ymax = y_indices.min(), y_indices.max()
            xmin, xmax = x_indices.min(), x_indices.max()
            print(f"Alpha > {threshold}: bbox is ({xmin}, {ymin}, {xmax}, {ymax}). Width: {xmax-xmin}, Height: {ymax-ymin}")

analyze_and_extract(r'C:\Users\Dell\.gemini\antigravity\brain\08c9ef05-504f-487a-b032-799ef2de4a2f\media__1773920604519.png')
