import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
def load(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/f'{name}.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

class ImportTests(unittest.TestCase):
    def test_published_inventory_and_type_counts(self):
        module=load('import_catalog')
        data=json.loads((ROOT/'public/data/catalog.json').read_text())
        self.assertEqual([p['id'] for p in data['positions']],module.EXPECTED)
        self.assertEqual(len(data['positions']),13)
        self.assertEqual(sum(p['price']['type']=='points' for p in data['positions']),10)
        self.assertTrue(all(p['notes'] and p['detailPages'] for p in data['positions']))
        self.assertEqual(data['sourceSha256'],module.PDF_SHA256)
        self.assertEqual(data['taxonomy'],module.TAXONOMY)
    def test_rejects_wrong_or_truncated_text(self):
        module=load('import_catalog')
        for text in ['', 'Gültig ab 2018', '\f'*7, 'Gültig ab 1. Januar 2026'+'\f'*7]:
            with self.subTest(text=text), self.assertRaises(ValueError):module.parse_text(text)
    def test_source_integrity_before_any_output(self):
        module=load('import_catalog')
        with tempfile.TemporaryDirectory(prefix='physio-import-test-') as directory:
            root=Path(directory);sources=root/'sources';sources.mkdir();out=root/'output'
            (sources/'manifest.json').write_text(json.dumps({'sources':[{'file':'test.pdf','bytes':10,'sha256':'0'*64}]}))
            (sources/'test.pdf').write_bytes(b'incorrect')
            with self.assertRaises(ValueError):module.generate(sources,out)
            self.assertFalse(out.exists())
    def test_official_link_discovery(self):
        parser=load('acquire_sources').Links()
        parser.feed('<a href="https://www.fedlex.admin.ch/exact.pdf">Anhang: <span>Tarifstruktur für physiotherapeutische Leistungen</span>, gültig ab 1.1.2026</a>')
        self.assertEqual(parser.items,[['https://www.fedlex.admin.ch/exact.pdf','Anhang: Tarifstruktur für physiotherapeutische Leistungen, gültig ab 1.1.2026']])

if __name__=='__main__':unittest.main()
