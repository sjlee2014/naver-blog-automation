#!/usr/bin/env node
if (require.main === module) throw new Error('Source reference only; private browser/login adapters are deliberately excluded.');

// Temporary-save bridge for this batch. It never opens the publish panel.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getProfileOrThrow } = require('../blog_profiles');
const { getLoggedInBrowser } = require('../naver_login');
const { postRichToBlog } = require('./lib/draft_editor.cjs');

const dir = path.resolve(process.argv[3] || 'drafts/2026-09-26/rewrite');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'image-manifest.json'), 'utf8'));
const account = process.argv[2];
const profiles = { mark1: 'leak', mark2: 'mark2', mark3: 'gomterior', mark5: 'mark5' };
if (!profiles[account]) throw Error('Expected mark1, mark2, mark3, or mark5');
const resultPath = path.join(dir, `${account}-repaired-save-result.json`);
if (fs.existsSync(resultPath)) throw Error('Save result exists; inspect before retrying');
const markdown = fs.readFileSync(path.join(dir, `${account}.md`), 'utf8');
const lines = markdown.split(/\r?\n/);
const title = lines[0].replace(/^#\s+/u, '').trim();
const blocks = [];
for (let i = 1; i < lines.length; i++) {
  const raw = lines[i].trim();
  if (!raw) continue;
  const image = raw.match(/^!\[[^\]]*\]\(([^)]+)\)$/u);
  if (image) {
    const imagePath = path.resolve(dir, image[1]);
    if (!imagePath.startsWith(path.dirname(dir) + path.sep) || !fs.existsSync(imagePath)) throw Error('Missing or external image');
    const job = manifest.jobs.find(j => j.account === account && j.expectedPath === imagePath);
    if (!job || !['ai', 'field'].includes(job.sourceType)) throw Error(`Missing image source type: ${imagePath}`);
    blocks.push({ type: 'image', path: imagePath, sourceType: job.sourceType });
  } else if (/^#{2,3} /.test(raw)) {
    blocks.push({ type: 'heading', text: raw.replace(/^#{2,3} /,''), align: 'center' });
  } else {
    blocks.push({ type: 'text', text: raw.replace(/\*\*/gu, '').replace(/^\*(.*)\*$/u, '$1'), align: 'center', blockRole: raw.startsWith('태그:') ? 'tags' : undefined });
  }
}
const expectedImages = blocks.filter(b => b.type === 'image').length;
if (!title || expectedImages !== manifest.jobs.filter(j=>j.account===account).length) throw Error('Invalid batch article or image count');
// No minimum field-photo count: fresh AI images may fill all planned roles.
if (manifest.status !== 'READY_FOR_EDITOR_QA') throw Error('Content baseline review must pass before save');
const { validateRevision } = require('./lib/validate_blog_revision.cjs');
validateRevision(dir,account);
const oldTitle = manifest.articles[account].oldTitle;
// AI 활용 settings are managed by the user; do not infer or change them from provenance.

async function editorSnapshot(context) {
  for (const page of context.pages()) {
    if (page.isClosed()) continue;
    for (const frame of page.frames()) {
      const found = await frame.evaluate(expected => (
        document.querySelector('.se-title-text')?.innerText?.trim() === expected &&
        Boolean(document.querySelector('.se-content'))
      ), title).catch(() => false);
      if (found) { const body = await frame.locator('.se-content').innerText(); const c=x=>x.replace(/[\s\u200b]/gu,''); if(blocks.filter(b=>b.type!=='image').every(b=>c(body).includes(c(b.text)))) return { page, frame }; }
    }
  }
  throw Error('Editor scope not found');
}

async function main() {
  const profile = getProfileOrThrow(profiles[account]);
  const configuredBlog = new URL(profile.writeUrl).pathname.split('/')[1];
  if (!configuredBlog) throw Error('Profile has no blog target');
  const session = await getLoggedInBrowser({
    cookieFile: profile.cookieFile,
    naverId: profile.naverId,
    naverPw: profile.naverPw,
    writeUrl: profile.writeUrl,
    headless: false,
    slowMo: 0,
  });
  session.context.setDefaultTimeout(10000);
  const owned = new Set();
  let saved = false;
  try {
    const before = new Set(session.context.pages());
    const page = process.env.REVIEW_EXISTING ? (await editorSnapshot(session.context)).page : await session.context.newPage();
    owned.add(page);
    if (!process.env.REVIEW_EXISTING) {
      const blogId=configuredBlog;
      await page.goto(`https://blog.naver.com/PostWriteForm.naver?blogId=${blogId}&Redirect=Write&redirect=Write`,{waitUntil:'domcontentloaded',timeout:30000});
      let frame=page.frames().find(f=>f.url().includes('PostWriteForm'))||page;
      const cancel=frame.locator('.se-popup-button-cancel');
      if(await cancel.isVisible().catch(()=>false))await cancel.click();
      const count=frame.locator('[data-click-area="tpb*s.count"]');
      await count.waitFor({state:'visible',timeout:15000});await count.click();
      const rows=frame.locator('li.item__k1QHQ').filter({hasText:oldTitle});
      await rows.first().waitFor({state:'visible',timeout:15000});
      const records=await rows.evaluateAll(nodes=>nodes.map(x=>({title:x.querySelector('strong')?.innerText?.trim(),stamp:x.querySelector('span.date__fCMep')?.innerText?.trim()})));
      const matching=records.filter(x=>x.title===oldTitle);
      if(matching.length!==1)throw Error('Expected exactly one old saved draft');
      const row=rows.filter({has:frame.locator('span.date__fCMep',{hasText:matching[0].stamp})});
      await row.locator('button.article_button__p0NRG').click();
      await frame.waitForFunction(t=>document.querySelector('.se-title-text')?.innerText?.trim()===t,oldTitle,{timeout:20000});
      const backup=await frame.evaluate(()=>({title:document.querySelector('.se-title-text')?.innerText,body:document.querySelector('.se-content')?.innerText,images:document.querySelectorAll('.se-module-image').length}));
      fs.writeFileSync(path.join(dir,`${account}-before-repair-backup.json`),JSON.stringify({record:matching[0],...backup},null,2));
    }
    const post = { title, blocks };
    await postRichToBlog(page, post, true, {
      writeUrl: profile.writeUrl,
      reviewExisting: Boolean(process.env.REVIEW_EXISTING),
      useOpenEditor: !process.env.REVIEW_EXISTING,
      onProgress: async ({ stage }) => {
        if (stage !== 'draft_saving') return;
        for (const candidate of session.context.pages()) if (!before.has(candidate)) owned.add(candidate);
        const { page: editorPage, frame } = await editorSnapshot(session.context);
        await editorPage.waitForTimeout(1200);
        // User-managed AI toggles: no automated click or mandatory ON check.
        const qa = await frame.evaluate(() => {
          const body = document.querySelector('.se-content');
          const title = document.querySelector('.se-title-text');
          const images = [...document.querySelectorAll('.se-module-image')];
          return {
            title: title?.innerText?.trim() || '',
            body: body?.innerText || '',
            imageCount: images.length,
            imagesLoaded: images.map(node => [...node.querySelectorAll('img')].some(img => img.complete && img.naturalWidth > 0)),
            saveButton: document.querySelector('[data-click-area="tpb.save"]')?.innerText || '',
          };
        });
        const phone = profile.info?.phone || '';
        const opening = blocks.find(b => b.type === 'text')?.text.slice(0, 22) || '';
        const failures = [];
        const compact = x => String(x).replace(/[\s\u200b]/gu, '');
        const missing = blocks.filter(b=>b.type!=='image'&&!compact(qa.body).includes(compact(b.text)));
        if(missing.length) failures.push('missing text blocks '+missing.length);
        if (qa.title !== title) failures.push('title');
        if (!qa.body.includes(opening)) failures.push('opening');
        if (!qa.body.includes(phone)) failures.push('phone');

        if (!qa.imagesLoaded.every(Boolean)) failures.push('image loading');
        if (qa.imageCount !== expectedImages) failures.push(`images ${qa.imageCount}/${expectedImages}`);
        if (qa.body.length < 1000) failures.push(`body short ${qa.body.length}`);
        if (failures.length) throw Error('PRE_SAVE_QA_FAILED: ' + failures.join(', '));
        const token = crypto.randomUUID();
        const shots = [];
        await frame.evaluate(() => document.querySelector('.se-sidebar-close-button')?.click());
        for (const [index, fraction] of [0, 0.5, 1].entries()) {
          await frame.evaluate(f => {
            const content = document.querySelector('.se-content');
            content.scrollTop = (content.scrollHeight - content.clientHeight) * f;
          }, fraction);
          await editorPage.waitForTimeout(450);
          const shot = path.join(dir, `${account}-repaired-review-${index + 1}.png`);
          await editorPage.screenshot({ path: shot });
          shots.push(shot);
        }
        const request = { token, account, title, screenshots: shots, checks: {
          bodyChars: qa.body.length, imageCount: qa.imageCount, phonePresent: true,
          titleExact: true, bodyTagsAbsent: true, imagesLoaded: qa.imagesLoaded,
        } };
        fs.writeFileSync(path.join(dir, `${account}-repaired-visual-request.json`), JSON.stringify(request, null, 2));
        console.log(`[visual-read] ${path.join(dir, `${account}-repaired-visual-request.json`)}`);
        const responsePath = path.join(dir, `${account}-repaired-visual-review.json`);
        let approved = false;
        for (let i = 0; i < 300; i++) {
          if (fs.existsSync(responsePath)) {
            const response = JSON.parse(fs.readFileSync(responsePath, 'utf8'));
            if (response.token === token) {
              if (response.status !== 'PASS') throw Error('Visual review failed');
              approved = true;
              break;
            }
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (!approved) throw Error('Visual review timed out; draft remains unsaved');
        fs.writeFileSync(path.join(dir, `${account}-repaired-pre-save-qa.json`), JSON.stringify({ status: 'PASS', ...request, reviewedAt: new Date().toISOString() }, null, 2));
      },
    });
    await new Promise(resolve => setTimeout(resolve, 2200));
    const { frame } = await editorSnapshot(session.context);
    const final = await frame.evaluate(() => ({
      title: document.querySelector('.se-title-text')?.innerText?.trim() || '',
      saveButton: document.querySelector('[data-click-area="tpb.save"]')?.innerText || '',
      body: document.querySelector('.se-content')?.innerText || '',
    }));
    if (final.title !== title || !final.body.includes(profile.info?.phone || '')) throw Error('Save post-check failed');
    fs.writeFileSync(resultPath, JSON.stringify({
      status: 'SAVE_CLICKED_EDITOR_CHECKED', account, blogId: configuredBlog, title,
      savedAt: new Date().toISOString(), imageCount: expectedImages,
      editorBodyChars: final.body.length, saveButtonAfter: final.saveButton,
      note: 'Saved-draft list verification remains required before claiming draft verified',
    }, null, 2));
    saved = true;
    console.log(JSON.stringify({ status: 'SAVE_CLICKED_EDITOR_CHECKED', account, title, imageCount: expectedImages, saveButtonAfter: final.saveButton }));
  } finally {
    if (saved) for (const page of owned) if (!page.isClosed()) await page.close().catch(() => {});
    await session.browser.close();
  }
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
