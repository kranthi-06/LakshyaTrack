from PIL import Image
import numpy as np

img = Image.open(r'C:\Users\Dell\.gemini\antigravity\brain\08c9ef05-504f-487a-b032-799ef2de4a2f\media__1773920604519.png').convert("RGBA")
data = np.array(img)
alpha = data[:, :, 3]

for threshold in (10, 50, 80):
    y, x = np.where(alpha > threshold)
    print(f"Alpha>{threshold}: {x.min()},{y.min()},{x.max()},{y.max()} W:{x.max()-x.min()} H:{y.max()-y.min()}")
