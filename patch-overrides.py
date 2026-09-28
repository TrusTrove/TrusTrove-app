import yaml

with open('pnpm-workspace.yaml') as f:
    data = yaml.safe_load(f)

data['overrides']['undici'] = '>=7.29.0 <8'

with open('pnpm-workspace.yaml', 'w') as f:
    yaml.dump(data, f, sort_keys=False)
