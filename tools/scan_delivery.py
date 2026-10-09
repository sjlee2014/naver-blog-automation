"""Offline allowlist/secret-pattern check. Never prints matched values."""
from pathlib import Path
import json
import re
import sys

root = Path(__file__).resolve().parents[1]
patterns = {
    'github_token': r'\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})',
    'service_key': r'\b(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,}|AKIA[A-Z0-9]{16})',
    'private_key': r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'credential_url': r'https?://[^\s/]+:[^\s/@]+@',
    'literal_secret': r'(?im)(?:api[_-]?key|password|client[_-]?secret|access[_-]?token)[\x22\x27]?\s*[:=]\s*[\x22\x27][A-Za-z0-9_+/=-]{12,}[\x22\x27]',
    'korean_phone': r'(?<!\d)0\d{1,2}[- .]?\d{3,4}[- .]?\d{4}(?!\d)',
    'personal_absolute_path': r'/(?:Users|home)/[^/\s]+/',
    'resident_identifier': r'(?<!\d)\d{6}[- ]?[1-4]\d{6}(?!\d)',
    'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b',
}
forbidden_parts = {'.env', 'private', 'accounts', 'node_modules', '.venv', 'venv', 'cache', '.cache', 'sessions', 'logs', 'browser-runtime'}
allowed_suffixes = {'.md', '.json', '.js', '.cjs', '.ts', '.py'}
findings = []
files = []
for p in sorted(root.rglob('*')):
    rel = p.relative_to(root)
    if '.git' in rel.parts or 'outputs' in rel.parts:
        continue
    if p.is_symlink():
        findings.append({'file': str(rel), 'rule': 'symlink_excluded'})
        continue
    if not p.is_file():
        continue
    files.append(p)
    if any(part in forbidden_parts or part.startswith('.env') for part in rel.parts):
        findings.append({'file': str(rel), 'rule': 'private_path'})
    if p.name != '.gitignore' and p.suffix not in allowed_suffixes:
        findings.append({'file': str(rel), 'rule': 'unlisted_file_type'})
    if p.stat().st_size > 256 * 1024:
        findings.append({'file': str(rel), 'rule': 'large_file'})
    try:
        text = p.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        findings.append({'file': str(rel), 'rule': 'binary_file'})
        continue
    hash_ranges = [m.span(1) for m in re.finditer(r'(?i)"[^"\n]*sha256"\s*:\s*"([a-f0-9]{64})"', text)]
    for rule, pattern in patterns.items():
        for match in re.finditer(pattern, text):
            if rule in {'korean_phone', 'resident_identifier'} and any(start <= match.start() and match.end() <= end for start, end in hash_ranges):
                continue
            findings.append({'file': str(rel), 'rule': rule, 'line': text[:match.start()].count('\n') + 1})
result = {'status': 'PASS' if not findings else 'FAIL', 'files': len(files), 'bytes': sum(p.stat().st_size for p in files), 'findings': findings, 'scope': 'delivery files only; values never printed'}
print(json.dumps(result, ensure_ascii=False, indent=2))
sys.exit(0 if not findings else 1)
