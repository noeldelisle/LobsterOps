import json

path = 'package.json'

with open(path, 'r') as f:
    pkg = json.load(f)

pkg['scripts']['start'] = 'node server.js'
pkg['scripts']['demo'] = 'node example.js'

pkg.setdefault('dependencies', {})['express'] = '^4.18.2'

with open(path, 'w') as f:
    json.dump(pkg, f, indent=2)

print('Done.')
print(f"  start -> {pkg['scripts']['start']}")
print(f"  express -> {pkg['dependencies']['express']}")
