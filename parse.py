import re
with open('src/components/MediaDetailModal.tsx') as f:
    text = f.read()

lines = text.split('\n')
stack = []
for i, line in enumerate(lines):
    # simple heuristic: find <div and </div
    opens = list(re.finditer(r'<div[^>]*>', line))
    closes = list(re.finditer(r'</div\s*>', line))
    # just sort them by index and apply
    tags = [(m.start(), '<div', line[m.start():m.end()]) for m in opens] + [(m.start(), '</div', line[m.start():m.end()]) for m in closes]
    tags.sort(key=lambda x: x[0])
    
    for pos, kind, content in tags:
        if kind == '<div':
            if not content.endswith('/>'):
                stack.append(i + 1)
        else:
            if not stack:
                print(f"Error: closing div at line {i+1} without open.")
            else:
                stack.pop()

print("Unclosed divs at lines:", stack)
