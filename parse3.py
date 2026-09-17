import re
with open('src/components/MediaDetailModal.tsx') as f:
    lines = f.readlines()

stack = []
for i, line in enumerate(lines):
    tags = []
    for m in re.finditer(r'<div\b[^>]*>', line):
        text = line[m.start():m.end()]
        if not text.endswith('/>'):
            tags.append((m.start(), 'open'))
    for m in re.finditer(r'</div\s*>', line):
        tags.append((m.start(), 'close'))
    tags.sort(key=lambda x: x[0])
    
    for pos, kind in tags:
        if kind == 'open':
            stack.append(i+1)
        else:
            if stack:
                stack.pop()
            else:
                print(f"Extra closing div at line {i+1}")
while stack:
    print(f"Unclosed open div at line {stack.pop()}")
