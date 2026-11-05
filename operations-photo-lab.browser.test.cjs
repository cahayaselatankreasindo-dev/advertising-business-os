// The Apps Script endpoint is stubbed: this browser test never uploads a real photo or contacts the live LAB.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = __dirname;
const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}/index.html`;
const PHOTO_URL = 'https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec';

const seedDb = {
  leads: [],
  clients: [],
  projects: [{
    id: 'PRJ-TEST-01',
    title: 'Booth Uji CSK',
    client: 'Brand Uji',
    value: 1000000,
    status: 'plan',
    deadline: '2026-11-15',
    notes: 'Record sintetis untuk browser test',
    sopChecklist: 'Brief:0;Produksi:0;Review:0;Revisi:0;Delivery:0'
  }],
  finance: [],
  memory: [],
  marketingSpend: [],
  settings: { googleSheetUrl: '', apiToken: '', lastSync: '' },
  role: 'owner'
};

async function main() {
  const server = spawn('python3', [
    '-m', 'http.server', String(PORT),
    '--bind', '127.0.0.1',
    '--directory', ROOT
  ], { stdio: 'ignore' });
  let browser;

  try {
    await new Promise((resolve, reject) => {
      const started = Date.now();
      const probe = () => {
        const request = require('node:http').get(BASE_URL, response => {
          response.resume();
          if (response.statusCode === 200) resolve();
          else reject(new Error('Static preview returned HTTP ' + response.statusCode));
        });
        request.on('error', error => {
          if (Date.now() - started > 10000) reject(error);
          else setTimeout(probe, 150);
        });
      };
      probe();
    });

    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      serviceWorkers: 'block'
    });
    await context.addInitScript(db => {
      localStorage.setItem('csk_business_os_db', JSON.stringify(db));
    }, seedDb);

    await context.route(
      'https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec**',
      route => route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><html lang="id"><title>Stub CSK Photo LAB</title><body>Browser test only</body></html>'
      })
    );

    const requests = [];
    context.on('request', request => requests.push({
      method: request.method(),
      url: request.url()
    }));

    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() =>
      Boolean(window.CSKOperationsUI && window.CSKOperations &&
        document.querySelector('#ops-root')?.dataset.opsInit === '1'),
      null,
      { timeout: 30000 }
    );

    await page.getByRole('button', { name: /Operasional Terpadu/ }).click();
    await page.getByRole('tab', { name: 'QC Produksi' }).click();

    const settingsForm = page.locator('form[data-form="photo-settings"]');
    const urlInput = settingsForm.locator('input[name="uploaderUrl"]');
    await urlInput.fill('https://example.com/not-a-lab-uploader');
    await settingsForm.getByRole('button', { name: 'Simpan URL Uploader LAB' }).click();
    await page.locator('#ops-error').waitFor();
    assert.match(await page.locator('#ops-error').innerText(), /Gunakan URL HTTPS Apps Script LAB/);
    assert.equal(await page.evaluate(() => localStorage.getItem('csk_photo_lab_uploader_url_v1')), null);

    await page.locator('form[data-form="photo-settings"] input[name="uploaderUrl"]').fill(PHOTO_URL);
    await page.getByRole('button', { name: 'Simpan URL Uploader LAB' }).click();
    assert.equal(
      await page.evaluate(() => localStorage.getItem('csk_photo_lab_uploader_url_v1')),
      PHOTO_URL
    );

    const launchForm = page.locator('form[data-form="photo-launch"]');
    const projectSelect = launchForm.locator('select[name="projectId"]');
    const projectOption = await projectSelect.locator('option[value="PRJ-TEST-01"]').innerText();
    assert.match(projectOption, /Booth Uji CSK/);
    await projectSelect.selectOption('PRJ-TEST-01');
    await launchForm.locator('select[name="stage"]').selectOption('Fabrikasi');

    const popupPromise = context.waitForEvent('page');
    await launchForm.locator('button[data-action="photo-upload"]').click();
    const popup = await popupPromise;
    await popup.waitForURL(url =>
      url.toString().startsWith('https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec'),
      { timeout: 10000 }
    );
    const popupUrl = new URL(popup.url());
    assert.equal(popupUrl.searchParams.get('projectId'), 'PRJ-TEST-01');
    assert.equal(popupUrl.searchParams.get('stage'), 'Fabrikasi');
    assert.match(await page.locator('#ops-error').innerText(), /Uploader LAB diminta dibuka/);

    const appWrites = requests.filter(request =>
      request.method === 'POST' &&
      request.url.startsWith('https://script.google.com/')
    );
    assert.deepEqual(appWrites, [], 'Business OS must not POST photo data to Apps Script');

    const storedCrm = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('csk_business_os_db') || '{}')
    );
    assert.equal(storedCrm.projects[0].id, 'PRJ-TEST-01');
    assert.equal(storedCrm.projects[0].title, 'Booth Uji CSK');

    const artifactDir = path.join(ROOT, 'artifacts');
    fs.mkdirSync(artifactDir, { recursive: true });
    await page.screenshot({
      path: path.join(artifactDir, 'csk-photo-lab-desktop.png'),
      fullPage: true
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.mob-btn').filter({ hasText: 'Ops' }).click();
    assert.equal(await page.locator('#page-ops').isVisible(), true);
    await page.getByRole('tab', { name: 'QC Produksi' }).click();
    const mobilePhotoCard = page.locator('#ops-root .ops-card')
      .filter({ hasText: 'Foto Laporan Proyek' });
    await mobilePhotoCard.scrollIntoViewIfNeeded();
    assert.equal(await mobilePhotoCard.isVisible(), true);
    const widths = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth
    }));
    assert.ok(widths.document <= widths.viewport + 2,
      'Mobile preview has horizontal overflow: ' + JSON.stringify(widths));
    await mobilePhotoCard.screenshot({
      path: path.join(artifactDir, 'csk-photo-lab-mobile.png')
    });

    await popup.close();
    await context.close();
    console.log('PASS: CRM project title, owner-only URL validation, project/stage handoff, no photo POST, desktop and mobile layout.');
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
