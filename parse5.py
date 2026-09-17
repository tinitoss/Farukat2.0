import re
with open('src/components/MediaDetailModal.tsx') as f:
    lines = f.readlines()

stack = []
for i, line in enumerate(lines):
    tags = []
    for m in re.finditer(r'<div\b[^>]*>', line):
        text = line[m.start():m.end()]
        if not text.endswith('/>'):
            tags.append((m.start(), 'open', text))
    for m in re.finditer(r'</div\s*>', line):
        tags.append((m.start(), 'close', '</div'))
    tags.sort(key=lambda x: x[0])
    
    for pos, kind, text in tags:
        if kind == 'open':
            stack.append((i+1, text))
        else:
            if stack:
                opened = stack.pop()
                if len(stack) < 2:
                    print(f"Line {i+1} closed {opened[0]}: {opened[1]} - Stack size now {len(stack)}")
            else:
                print(f"Line {i+1} EXTRA CLOSE")
