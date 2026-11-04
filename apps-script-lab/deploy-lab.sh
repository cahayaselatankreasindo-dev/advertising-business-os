#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

MODE="${1:-preflight}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPECTED_LAB_SCRIPT_ID="1IushkEIqi-CsKxsdx83sxs08_G5wk8rbOQ9A_eM0UF1wOKszDfYJqzB4"
PRODUCTION_SCRIPT_ID="1eUjEvbe4dGsAIT32P3vLVdf1CKIsk0swleiJg1FHX0OugYddNYWbB3qC"

cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js belum tersedia. Install melalui Termux: pkg install nodejs"
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "Clasp versi terbaru membutuhkan Node.js >= 22. Versi saat ini: $(node -v)"
  echo "Perbarui Node.js melalui Termux sebelum melanjutkan."
  exit 1
fi

node - <<'NODE'
const fs = require('node:fs');
const clasp = JSON.parse(fs.readFileSync('.clasp.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('appsscript.json', 'utf8'));
const code = fs.readFileSync('Code.gs', 'utf8');
const guard = fs.readFileSync('LabRequestGuard.gs', 'utf8');
const self = fs.readFileSync('LabSelfTest.gs', 'utf8');
const expected = '1IushkEIqi-CsKxsdx83sxs08_G5wk8rbOQ9A_eM0UF1wOKszDfYJqzB4';
const production = '1eUjEvbe4dGsAIT32P3vLVdf1CKIsk0swleiJg1FHX0OugYddNYWbB3qC';
const sheet = '19le34ltpZCMIHmjw2n_JbEvrtZBWNTKd61U-xEAoR5Y';
if (clasp.scriptId !== expected || clasp.scriptId === production) throw new Error('STOP: target bukan Script ID LAB.');
if (manifest.webapp?.access !== 'MYSELF' || manifest.webapp?.executeAs !== 'USER_DEPLOYING') throw new Error('STOP: manifest wajib private MYSELF / USER_DEPLOYING.');
if (!self.includes(sheet) || !guard.includes('cskLabRequireDummySheet_') || !code.includes('cskLabGuardPost_(payload)')) throw new Error('STOP: guard atau spreadsheet LAB tidak cocok.');
console.log('Preflight PASS — Script ID LAB, spreadsheet dummy, dan manifest privat terverifikasi.');
NODE

node --check --input-type=commonjs < Code.gs
node --check --input-type=commonjs < LabRequestGuard.gs
node --check --input-type=commonjs < LabSelfTest.gs
node --check --input-type=commonjs < LabHandlerVerification.gs
node --check --input-type=commonjs < TinyFishService.gs
node --check --input-type=commonjs < AppsScriptBridge.html
node lab-deployment.test.cjs
node tinyfish-service.test.cjs

if [ "$MODE" = "preflight" ]; then
  echo "Preflight selesai. Tidak ada kode yang diunggah."
  echo "Gunakan: bash deploy-lab.sh deploy"
  exit 0
fi

if [ "$MODE" != "push" ] && [ "$MODE" != "deploy" ]; then
  echo "Mode tidak dikenal: $MODE (gunakan preflight, push, atau deploy)"
  exit 2
fi

if ! command -v clasp >/dev/null 2>&1; then
  echo "clasp belum terpasang. Jalankan: npm install -g @google/clasp"
  exit 1
fi

clasp status
clasp push --force

if [ "$MODE" = "deploy" ]; then
  clasp deploy -d "CSK Business OS private LAB owner-only"
  echo "Deployment dibuat. Buka URL /exec yang ditampilkan dengan akhiran ?view=app."
else
  echo "Source berhasil di-push ke LAB. Belum membuat deployment baru."
fi
