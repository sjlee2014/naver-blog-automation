'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { assertPresentationPolicy } = require('../scripts/lib/blog_presentation_policy.cjs');
const root = path.resolve(__dirname, '..');
for (const profile of ['mark2', 'mark3']) {
  const dir = path.join(root, 'examples', profile);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const payload = JSON.parse(fs.readFileSync(path.join(dir, 'blocks.json'), 'utf8'));
  const article = fs.readFileSync(path.join(dir, 'article.md'), 'utf8');
  assert.equal(manifest.sample, true);
  assert.equal(manifest.images_included, false);
  assert.equal(manifest.published, false);
  assert.equal(manifest.editor_upload_verified, false);
  assert.equal(manifest.paragraphs.length, 22);
  assert.equal(manifest.images.length, manifest.image_count);
  assert.equal(manifest.image_count, 20);
  assert.equal(new Set(manifest.images.map(image => image.relative_path)).size, 20);
  assert.equal(payload.blocks.length, 42);
  assert.equal(payload.title, manifest.title);
  const mapped = payload.blocks.map(block => block.type === 'paragraph' ? { ...block, type: 'text' } : block);
  assertPresentationPolicy(article, mapped);
  for (let i = 0; i < 20; i++) {
    const image = manifest.images[i];
    assert.equal(image.paragraph_id, `P${String(i + 1).padStart(2, '0')}`);
    assert.equal(image.insert_after_exact_text, manifest.paragraphs[i]);
    assert.equal(payload.blocks[i * 2].text, manifest.paragraphs[i]);
    assert.equal(payload.blocks[i * 2 + 1].path, image.relative_path);
    assert.equal(image.caption_to_insert, '');
    assert.equal(image.sha256, null);
    assert.equal(image.generation_evidence, null);
    assert.equal(image.visual_review, 'NOT_REVIEWED_SAMPLE');
    assert(!image.relative_path.includes('..'));
    assert(!Object.hasOwn(image, 'aiToggle'));
    assert(!Object.hasOwn(image, 'aiMarked'));
  }
  for (const paragraph of manifest.paragraphs) assert(article.includes(paragraph));
  console.log(JSON.stringify({ profile, status: 'SAMPLE_STRUCTURE_CHECKED', paragraphs: 22, imageRoles: 20, imageBytesIncluded: false }));
}
