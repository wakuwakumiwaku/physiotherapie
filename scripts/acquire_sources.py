"""Acquire immutable official sources; never overwrite an existing different capture."""
import argparse
import datetime as dt
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
import tempfile
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
PAGE_URL = 'https://www.bag.admin.ch/de/leistungen-physiotherapie'

class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.items = []; self.active = None
    def handle_starttag(self, tag, attrs):
        if tag == 'a': self.active = [dict(attrs).get('href', ''), '']
    def handle_data(self, text):
        if self.active is not None: self.active[1] += text
    def handle_endtag(self, tag):
        if tag == 'a' and self.active is not None:
            self.items.append(self.active); self.active = None

def fetch(url):
    with tempfile.TemporaryDirectory(prefix='physio-acquire-') as tmp:
        target = Path(tmp) / 'download'
        subprocess.run(['curl', '--fail', '--location', '--retry', '2', '--max-time', '90',
                        '--silent', '--show-error', '-A', 'Mozilla/5.0', url, '-o', str(target)], check=True)
        return target.read_bytes()

def save(directory, name, data, url, **metadata):
    path = directory / name
    if path.exists() and path.read_bytes() != data:
        raise ValueError(f'{name} exists with different bytes: use a new capture directory')
    path.write_bytes(data)
    return {'file': name, 'url': url, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), **metadata}

def acquire(directory):
    directory.mkdir(parents=True, exist_ok=True)
    page = fetch(PAGE_URL)
    parser = Links(); parser.feed(page.decode('utf-8'))
    candidates = [(u, t) for u, t in parser.items if 'Tarifstruktur für physiotherapeutische Leistungen' in t and '1.1.2026' in t]
    if len(candidates) != 1: raise ValueError('Expected exactly one official 2026 annex link')
    url, title = candidates[0]; url = urljoin(PAGE_URL, url)
    if not url.startswith('https://www.fedlex.admin.ch/'): raise ValueError('Unexpected annex host')
    entries = [save(directory, 'bag-physiotherapie.html', page, PAGE_URL, title='Leistungen: Physiotherapie')]
    pdf = fetch(url)
    if not pdf.startswith(b'%PDF-'): raise ValueError('Not a PDF')
    entries.append(save(directory, 'tarifstruktur-2026.pdf', pdf, url, title=title.strip(), validFrom='2026-01-01', publicationDate=None))
    manifest = {'schemaVersion': 1, 'retrievedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'sources': entries}
    (directory / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(manifest, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--output', type=Path, default=ROOT / 'sources')
    acquire(parser.parse_args().output)
