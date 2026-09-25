import re

with open("pnpm-lock.yaml", "r") as f:
    lines = f.readlines()

output = []
stack = [(-1, set())]

for i, line in enumerate(lines):
    if not line.strip() or line.strip().startswith('#'):
        output.append(line)
        continue

    indent = len(line) - len(line.lstrip())
    
    while stack and stack[-1][0] > indent:
        stack.pop()
    
    if not stack or stack[-1][0] < indent:
        stack.append((indent, set()))
    
    match = re.match(r'^(\s*)([^:]+):\s*(.+)$', line)
    if match:
        key = match.group(2)
        if key in stack[-1][1]:
            # comment out scalar duplicates
            output.append("# DUPLICATE SCALAR: " + line)
        else:
            stack[-1][1].add(key)
            output.append(line)
    else:
        # For non-scalars, we just add them to the set and don't skip them
        # (This might still be invalid YAML if there are duplicate blocks, but let's hope not)
        match_block = re.match(r'^(\s*)([^:]+):\s*$', line)
        if match_block:
            key = match_block.group(2)
            stack[-1][1].add(key)
        output.append(line)

with open("pnpm-lock.yaml", "w") as f:
    f.writelines(output)
