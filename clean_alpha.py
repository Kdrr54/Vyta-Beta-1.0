from PIL import Image, ImageFilter
from collections import deque
import math

def remove_white_bg(input_path, output_path):
    im = Image.open(input_path).convert('RGBA')
    w, h = im.size
    orig_pixels = im.load()
    
    # 1. Flood fill from 4 corners and center hole (512, 512)
    bg_set = set()
    q = deque([
        (0, 0), (w-1, 0), (0, h-1), (w-1, h-1),
        (w//2, h//2), (w//2 - 50, h//2), (w//2 + 50, h//2)
    ])
    
    for pt in q:
        bg_set.add(pt)
        
    while q:
        cx, cy = q.popleft()
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in bg_set:
                r, g, b, _ = orig_pixels[nx, ny]
                # High brightness background threshold
                if r >= 244 and g >= 244 and b >= 244:
                    bg_set.add((nx, ny))
                    q.append((nx, ny))
                    
    # 2. Build initial binary mask
    mask = Image.new('L', (w, h), 255)
    mask_pixels = mask.load()
    for (x, y) in bg_set:
        mask_pixels[x, y] = 0
        
    # 3. Find border pixels (distance 1 and 2 from background) for subpixel un-matting
    # Pixels that touch the background and have slight white blending
    new_im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    new_pixels = new_im.load()
    
    # Smooth mask boundary with a subtle Gaussian or box blur to get anti-aliased edges
    # We create an anti-aliased alpha channel
    smoothed_mask = mask.filter(ImageFilter.GaussianBlur(radius=0.7))
    sm_pixels = smoothed_mask.load()
    
    for y in range(h):
        for x in range(w):
            alpha = sm_pixels[x, y]
            if (x, y) in bg_set:
                # Fully transparent
                new_pixels[x, y] = (0, 0, 0, 0)
            elif alpha == 0:
                new_pixels[x, y] = (0, 0, 0, 0)
            else:
                r, g, b, _ = orig_pixels[x, y]
                
                # If near edge and alpha < 255, de-multiply white matte
                if alpha < 250:
                    a_norm = alpha / 255.0
                    if a_norm > 0.05:
                        # De-blend white: C = (C_obs - (1-a)*255) / a
                        nr = max(0, min(255, int((r - (1.0 - a_norm) * 255) / a_norm)))
                        ng = max(0, min(255, int((g - (1.0 - a_norm) * 255) / a_norm)))
                        nb = max(0, min(255, int((b - (1.0 - a_norm) * 255) / a_norm)))
                        new_pixels[x, y] = (nr, ng, nb, alpha)
                    else:
                        new_pixels[x, y] = (0, 0, 0, 0)
                else:
                    new_pixels[x, y] = (r, g, b, 255)
                    
    new_im.save(output_path, 'PNG')
    print(f"Successfully processed {input_path} -> {output_path}")

if __name__ == '__main__':
    src = r'C:\Users\flexy\.gemini\antigravity-ide\scratch\vyta-app\public\assets\ring\ring-angle-left.png'
    dst = r'C:\Users\flexy\.gemini\antigravity-ide\scratch\vyta-app\public\assets\ring\ring-angle-left.png'
    remove_white_bg(src, dst)
