import yaml
import os

path = r'apps/api/app/attack_library/payloads'
total = 0
for f in os.listdir(path):
    if f.endswith('.yaml'):
        d = yaml.safe_load(open(f'{path}/{f}', encoding='utf-8'))
        if isinstance(d, dict):
            count = len(d.get('attacks', []))
            total += count
            print(f'{f}: {count} payloads')

print(f'---\nTOTAL: {total}')
