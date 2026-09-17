import re
with open('src/components/MediaDetailModal.tsx') as f:
    lines = f.readlines()

opens = []
closes = []
for i, line in enumerate(lines):
    for m in re.finditer(r'<div\b[^>]*>', line):
        if not line[m.start():m.end()].endswith('/>'):
            opens.append((i+1, line[m.start():m.end()]))
    for m in re.finditer(r'</div\s*>', line):
        closes.append((i+1, line[m.start():m.end()]))

print(f"Total opens: {len(opens)}")
print(f"Total closes: {len(closes)}")
