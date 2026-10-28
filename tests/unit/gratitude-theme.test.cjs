const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../..');
const page = fs.readFileSync(path.join(root, 'public/gratitude/index.html'), 'utf8');

test('gratitude frontend presents the microglow art-journal theme', () => {
  assert.match(page, /微光拾暖，‘艺’绘感恩/);
  assert.match(page, /assets\/gratitude-tree-hero\.webp/);
  assert.match(page, /assets\/gratitude-sapling-progress\.webp/);
  assert.match(page, /class="microglow-stage"/);
});

test('gratitude login uses the generated artistic title lockup accessibly', () => {
  assert.match(page, /class="theme-title-art"/);
  assert.match(page, /assets\/gratitude-title-art\.webp/);
  assert.match(page, /alt="微光拾暖，‘艺’绘感恩"/);
  assert.match(page, /class="theme-title-fallback"/);
});

test('gratitude calendar carries the poster language into progress feedback', () => {
  for (const artwork of ['gratitude-journal-canopy.webp', 'gratitude-journal-wash.webp']) {
    assert.ok(fs.existsSync(path.join(root, 'public/gratitude/assets', artwork)), artwork + ' should exist');
    assert.match(page, new RegExp(artwork.replace('.', '\\.')));
  }
  assert.match(page, /class="journal-canopy-art"/);
  assert.match(page, /class="journal-wash-divider"/);
  const generatedLeaves = [
    'gratitude-leaf-sticker-ginkgo.webp',
    'gratitude-leaf-sticker-oak.webp',
    'gratitude-leaf-sticker-linden.webp',
    'gratitude-leaf-sticker-birch.webp',
  ];
  for (const leaf of generatedLeaves) {
    assert.ok(fs.existsSync(path.join(root, 'public/gratitude/assets', leaf)), leaf + ' should exist');
    assert.match(page, new RegExp(leaf.replace('.', '\\.')));
  }
  assert.match(page, /const LEAF_FILES=\[[^\]]+\]/);
  assert.match(page, /assets\/gratitude-leaf-sticker\.webp/);
  assert.match(page, /gratitude-leaf-sticker-olive\.webp/);
  assert.match(page, /gratitude-leaf-sticker-red\.webp/);
  assert.match(page, /class="day-leaf-art"/);
  assert.match(page, /week-heading/);
  assert.match(page, /week-brush-label/);
  assert.match(page, /class="save-spark"/);
  assert.match(page, /class="save-feedback-note"/);
  assert.match(page, /@keyframes spark-to-tree/);
  assert.match(page, /@keyframes feedback-note-in/);
  assert.match(page, /\.save-feedback\.on \.save-feedback-note\s*\{[^}]*animation:[^;}]*1\.05s[^;}]*both/s);
  assert.match(page, /id="preview-completion-motion"/);
  assert.match(page, /function previewCompletionMotion\(\)/);
  assert.match(page, /--spark-x/);
  assert.match(page, /getBoundingClientRect\(\)/);
});

test('gratitude artwork is web optimized and defers post-login decoration', () => {
  const assetDir = path.join(root, 'public/gratitude/assets');
  const optimized = fs.readdirSync(assetDir).filter(file => file.endsWith('.webp'));
  assert.equal(optimized.length, 12);
  let total = 0;
  for (const file of optimized) {
    const size = fs.statSync(path.join(assetDir, file)).size;
    total += size;
    const limit = file.includes('leaf-sticker') ? 35 * 1024 : 250 * 1024;
    assert.ok(size <= limit, file + ' exceeds its size budget');
  }
  assert.ok(total <= 800 * 1024, 'artwork exceeds the total size budget');
  assert.doesNotMatch(page, /assets\/gratitude-[A-Za-z0-9-]+\.png/);
  assert.match(page, /<img(?=[^>]*class="theme-title-art")(?=[^>]*loading="eager")(?=[^>]*fetchpriority="high")[^>]*>/);
  for (const className of ['journal-canopy-art', 'gratitude-sapling-art', 'journal-wash-divider']) {
    assert.match(page, new RegExp('class="' + className + '"[^>]*loading="lazy"'));
  }
});

test('gratitude leaf tags sit on unfinished notes and disappear when collected', () => {
  const sizes = page.match(/const LEAF_SIZES=\[([^\]]+)\]/)?.[1].split(',').map(Number) || [];
  const tops = page.match(/const LEAF_TOPS=\[([^\]]+)\]/)?.[1].split(',').map(Number) || [];
  const rights = page.match(/const LEAF_RIGHTS=\[([^\]]+)\]/)?.[1].split(',').map(Number) || [];
  assert.equal(sizes.length, 7);
  assert.ok(sizes.every(size => size === 35));
  assert.ok(tops.every(top => top >= -10 && top <= -4));
  assert.ok(rights.filter(right => right < 0).length >= 3);
  assert.match(page, /const leaf=!x\.done\?/);
  assert.match(page, /@keyframes leaf-tag-collect/);
  assert.match(page, /filter:\s*saturate\(\.78\)/);
  assert.match(page, /class="journal-owner"/);
  assert.match(page, /class="journal-today"/);
});

test('gratitude frontend includes restrained interaction feedback', () => {
  assert.match(page, /@keyframes screen-in/);
  assert.match(page, /@keyframes leaf-check/);
  assert.match(page, /\.screen\.on\s*\{[^}]*animation:\s*screen-in/s);
  assert.match(page, /class="save-feedback"[^>]*aria-live="polite"/);
  assert.match(page, /@media\s*\(prefers-reduced-motion:reduce\)/);
});

test('gratitude frontend keeps multimedia check-in support', () => {
  assert.match(page, /图片、视频或录音/);
  assert.match(page, /matVideo/);
  assert.match(page, /matAudio/);
});

test('daily check-in is presented as a functional journal page', () => {
  assert.match(page, /class="[^"]*\bfill-page-heading\b[^"]*"/);
  assert.match(page, /class="[^"]*\bfill-date-ticket\b[^"]*"/);
  assert.match(page, /class="[^"]*\bfill-journal-intro\b[^"]*"/);
  assert.match(page, /class="[^"]*\bphoto-slot-grid\b[^"]*"/);
  assert.match(page, /id="photo-count"/);
  assert.match(page, /class="[^"]*\bfill-media-section\b[^"]*"/);
  assert.match(page, /class="[^"]*\bfill-submit-dock\b[^"]*"/);
  assert.match(page, /role="button"[^>]*tabindex="0"[^>]*onclick="pickImage\(\)"/);
  assert.match(page, /document\.getElementById\('photo-count'\)/);
  assert.match(page, /action_images:\[\.\.\.imgs,\.\.\.vids\]\.map/);
  assert.match(page, /function saveDay\(dayno,isSpecial\)/);
});
