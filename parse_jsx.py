import re
with open('src/components/MediaDetailModal.tsx') as f:
    text = f.read()

# Let's just find all the { ... && ( and )} and JSX tags.
# Actually it's easier to just print the lines 500-660 and visually inspect.
