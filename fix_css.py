import re

css_path = r'd:\ai agent resume\frontend\src\index.css'

with open(css_path, 'r', encoding='utf-8') as f:
    text = f.read()

colors = 'gray|slate|purple|blue|green|orange|red|yellow|rose|indigo|emerald|cyan|pink'

def replace_with_opacities(match):
    full_match = match.group(0) # e.g. ".dark .bg-gray-50"
    
    opacities = ['10', '20', '30', '40', '50', '60', '70', '80', '90', '95']
    replacements = [full_match]
    
    if ':hover' in full_match:
        core_class = full_match.replace('.dark .', '').replace(':hover', '')
        for op in opacities:
            replacements.append(f".dark .{core_class}\\/{op}:hover")
    else:
        core_class = full_match.replace('.dark .', '')
        for op in opacities:
            replacements.append(f".dark .{core_class}\\/{op}")
            
    return ",\n".join(replacements)


pattern = re.compile(r'\.dark \.(?:hover\\:)?bg-(?:' + colors + r')-\d+(?::hover)?(?![\\/a-zA-Z0-9\-])')

new_text = pattern.sub(replace_with_opacities, text)

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(new_text)

print("CSS updated.")
