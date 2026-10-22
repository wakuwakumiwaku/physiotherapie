"""Deterministic import of the pinned, official 2026 ordinance annex (stdlib + pdftotext)."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PDF_SHA256 = 'd10462e61e5aa6594660dfa6e04d5085aa417caa7f2a54d0c8781e87278936a9'
EXPECTED = ['7301','7311','7313','7330','7340','7350','7351','7352','7353','7354','7361','7362','7363']
TAXONOMY = [
    {'id': 'sessions', 'label': 'Sitzungspauschalen', 'overview': '1.1', 'detail': '2'},
    {'id': 'supplements', 'label': 'Zuschlagspositionen', 'overview': '1.2', 'detail': '3'},
    {'id': 'incontinence', 'label': 'Pauschale für Verbrauchs- und Hygienematerial bei der physiotherapeutischen Inkontinenztherapie', 'overview': '1.3', 'detail': '3, abschliessende Tabelle'},
]

def sha(data): return hashlib.sha256(data).hexdigest()
def tidy(text): return '\n'.join(line.rstrip() for line in text.splitlines()).strip()

def parse_text(text):
    pages = text.split('\f')
    if len(pages) != 8 or pages[-1].strip(): raise ValueError('Expected seven complete source pages')
    if 'Gültig ab 1. Januar 2026' not in pages[0]: raise ValueError('Wrong edition')
    overview = {}; category = None; previous = None
    for line in pages[2].splitlines():
        if re.match(r'1\.1\s', line): category = 'sessions'
        elif re.match(r'1\.2\s', line): category = 'supplements'
        elif re.match(r'1\.3\s', line): category = 'incontinence'
        match = re.match(r'^(7\d{3})\s+(.+?)(?:\s{2,}(Fr\. \d+\.-|\d+))?\s*$', line)
        if match:
            code, title, value = match.groups(); previous = code
            if code in overview: raise ValueError('Duplicate overview code')
            price = {'type':'points','value':value} if value and value.isdigit() else ({'type':'chf','value':re.search(r'\d+',value).group()+'.00'} if value else {'type':'purchase-cost','value':None})
            overview[code] = {'id': code, 'code': code, 'title': title.strip(), 'category': category, 'price': price, 'sourcePages':[3], 'detailPages':[], 'allowedSupplements':[], 'notes':''}
        elif previous == '7351' and '(Alter:' in line:
            overview[previous]['title'] += ' ' + line.strip()
    if list(overview) != EXPECTED: raise ValueError('Overview position set/order mismatch')
    current = None; blocks = {}; combinations = {}; detail_values = {}
    for page_number, page in enumerate(pages[3:7], 4):
        for line in page.splitlines():
            if 'Tarifstruktur für physiotherapeutische Leistungen, 1.1.2026' in line or re.fullmatch(r'\s*\d/7\s*',line): continue
            if re.match(r'^\s*3\s+Zuschlagspositionen',line): continue
            if re.match(r'^Ziffer\s',line) or any(x in line for x in ['Kombina-', 'tionen']) and not line[:84].strip(): continue
            if re.match(r'^\s*(Erlaubte|tione?n?|Kombina-)\s*$',line): continue
            if 'physiotherapeutischen Inkontinenztherapie' in line and line.lstrip().startswith('physiotherapeutischen'): continue
            if re.match(r'^\s*physiotherapeutischen Inkontinenztherapie',line): continue
            match = re.match(r'^(7\d{3})\s', line)
            if match:
                current = match.group(1)
                if current not in overview or current in blocks: raise ValueError('Unexpected/duplicate detail code')
                blocks[current] = []; combinations[current] = []
                p = overview[current]; p['detailPages'].append(page_number)
                value = line[84:100].strip()
                detail_values[current] = value
            if current is None: continue
            if line.strip() and page_number not in overview[current]['detailPages']: overview[current]['detailPages'].append(page_number)
            left = line[:84].strip()
            right = line[100:].strip()
            if right:
                if not re.fullmatch(r'7\d{3}',right): raise ValueError(f'Unexpected combination cell: {right}')
                combinations[current].append(right)
            if left: blocks[current].append(left)
    if list(blocks) != EXPECTED: raise ValueError('Detail set/order mismatch')
    for code, position in overview.items():
        block = blocks[code]
        # Title ends at the first numbered rule. This preserves every original rule line.
        start = next((i for i,line in enumerate(block) if re.match(r'^1\s', line)),len(block))
        position['notes'] = tidy('\n'.join(block[start:]))
        position['allowedSupplements'] = combinations[code]
        position['sourcePages'] = sorted(set([3]+position['detailPages']))
        price = position['price']; expected = price['value'] if price['type']=='points' else ('Fr. '+price['value'].split('.')[0]+'.-' if price['type']=='chf' else '')
        if detail_values[code] != expected: raise ValueError('Overview/detail value mismatch: '+code)
    # The two material flat rates share the following numbered source block.
    overview['7362']['notes'] = overview['7363']['notes']
    for code in ['7362','7363']: overview[code]['sharedRulesWith'] = ['7362','7363']
    for code, position in overview.items():
        position['allowedSessions'] = [p['code'] for p in overview.values() if code in p['allowedSupplements']]
        if not position['notes']: raise ValueError('Missing rules: '+code)
    intro = pages[1].split('Einleitende Bemerkungen',1)[1]
    intro = re.sub(r'\s*2/7\s*$','',intro)
    return {'schemaVersion':1,'id':'physiotherapie-2026','title':'Tarifstruktur für physiotherapeutische Leistungen','validFrom':'2026-01-01','sourceSha256':PDF_SHA256,'taxonomy':TAXONOMY,'intro':tidy(intro),'introPage':2,'positions':list(overview.values())}

def generate(source_dir, output):
    manifest = json.loads((source_dir/'manifest.json').read_text())
    for source in manifest['sources']:
        data = (source_dir/source['file']).read_bytes()
        if len(data)!=source['bytes'] or sha(data)!=source['sha256']: raise ValueError('Source integrity mismatch')
    pdf = source_dir/'tarifstruktur-2026.pdf'
    if sha(pdf.read_bytes())!=PDF_SHA256: raise ValueError('Unreviewed source PDF')
    text = subprocess.run(['pdftotext','-layout',str(pdf),'-'],check=True,capture_output=True).stdout.decode('utf-8')
    catalog = parse_text(text)
    provenance = {'schemaVersion':1,'catalogId':catalog['id'],'retrievedAt':manifest['retrievedAt'],'sources':manifest['sources'],
      'versionNote':'Gültig ab 1. Januar 2026; formale Revision. Laut BAG inhaltlich unverändert gegenüber der am 1. Januar 2018 in Kraft getretenen Tarifstruktur. Keine neuen Preise behauptet.',
      'scope':'Vollständiger Anhang nach Artikel 2 der Verordnung über die Festlegung von Tarifstrukturen in der Krankenversicherung, SR 832.102.5. Ambulante Physiotherapie im KVG-Bereich; keine UV/MV/IV-Tarife.',
      'rights':{'basis':'Amtlicher Verordnungsanhang; Gesetze, Verordnungen und andere amtliche Erlasse sind nach Art. 5 Abs. 1 Bst. a URG nicht urheberrechtlich geschützt. Veröffentlicht werden abgeleitete normative Tarifdaten und Regeln, keine BAG-Webseitenkopie, Logos oder Drittanbieterinstrumente. Keine amtliche App, keine pauschale Lizenzbehauptung für fremde Inhalte.', 'lawUrl':'https://www.fedlex.admin.ch/eli/cc/1993/1798_1798_1798/de#art_5'},
      'taxPointValue':{'status':'unknown','note':'Kantonal bzw. vertraglich unterschiedlich; kein verifizierter kantonaler Wert hinterlegt. Ausschliesslich eigene Eingabe in CHF pro Taxpunkt.'},
      'extraction':'pdftotext -layout; sämtliche 13 Übersichtspositionen gegen Detailtabellen geprüft; gemeinsame Regeln 7362/7363 bei beiden Positionen enthalten; PDF-Seiten 1–7.',
      'publicationDate':None}
    report = {'schemaVersion':1,'positions':len(catalog['positions']),'points':sum(p['price']['type']=='points' for p in catalog['positions']),'fixedChf':sum(p['price']['type']=='chf' for p in catalog['positions']),'purchaseCost':sum(p['price']['type']=='purchase-cost' for p in catalog['positions']),'codes':EXPECTED,'sourcePages':7,'missingRules':0,'overviewDetailMismatches':0,'unresolvedCombinationCodes':sorted({c for p in catalog['positions'] for c in p['allowedSupplements'] if c not in overview_ids(catalog)})}
    # Validate all sources and calculations before writing any derived output.
    encoded = {name:json.dumps(value,ensure_ascii=False,indent=2)+'\n' for name,value in [('catalog.json',catalog),('provenance.json',provenance),('import-report.json',report)]}
    output.mkdir(parents=True,exist_ok=True)
    for name,data in encoded.items(): (output/name).write_text(data)
    print(json.dumps(report,ensure_ascii=False,indent=2))

def overview_ids(catalog): return {p['code'] for p in catalog['positions']}

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--sources',type=Path,default=ROOT/'sources'); parser.add_argument('--output',type=Path,default=ROOT/'public/data')
    args=parser.parse_args(); generate(args.sources,args.output)
