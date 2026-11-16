const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DETECTORS_FILE = path.resolve(__dirname, '..', 'src', 'js', 'detectors', 'mature-content-detectors.js');
const DETECTORS_SOURCE = fs.readFileSync(DETECTORS_FILE, 'utf8');

function el(text, attrs = {}) {
  return { innerText: text, textContent: text, getAttribute: name => attrs[name] ?? null };
}

/**
 * Minimal document stub answering the selectors the Amazon detector uses.
 */
function amazonSignals(url, { title = '', breadcrumb = null, rank = [], h1 = [], jsonLd = [] } = {}) {
  const document = {
    title,
    querySelector(sel) {
      return sel.includes('wayfinding-breadcrumbs') && breadcrumb !== null ? el(breadcrumb) : null;
    },
    querySelectorAll(sel) {
      if (sel.includes('ld+json')) return jsonLd.map(o => el(JSON.stringify(o)));
      if (sel.includes('zg_hrsr')) return rank.map(t => el(t));
      if (sel === 'h1') return h1.map(t => el(t));
      return [];
    }
  };
  const context = { console: { log() {} }, document, location: { href: url }, URL };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(DETECTORS_SOURCE, context, { filename: DETECTORS_FILE });
  return JSON.parse(vm.runInContext('JSON.stringify(generateMatureContentSignals())', context));
}

const BLOCKED = ['VENDOR:amazon:mature'];
const ALLOWED = [];

// Category page from the bug report: blocked by node ID alone.
assert.deepStrictEqual(
  amazonSignals('https://www.amazon.com/Erotica-Fiction-eBooks/b/ref=dp_bc_4?ie=UTF8&node=157057011'),
  BLOCKED
);
assert.deepStrictEqual(amazonSignals('https://www.amazon.com/b?node=10141'), BLOCKED);
assert.deepStrictEqual(amazonSignals('https://www.amazon.com/gp/bestsellers/digital-text/157057011'), BLOCKED);
assert.deepStrictEqual(amazonSignals('https://www.amazon.com/s?i=digital-text&rh=n%3A157057011'), BLOCKED);

// Erotica sub-category pages with unknown node IDs: slug, heading, or title.
assert.deepStrictEqual(
  amazonSignals('https://www.amazon.com/Romantic-Erotica-eBooks/b?ie=UTF8&node=1'),
  BLOCKED
);
assert.deepStrictEqual(amazonSignals('https://www.amazon.com/b?node=2', { h1: ['Erotica'] }), BLOCKED);
assert.deepStrictEqual(
  amazonSignals('https://www.amazon.com/b?node=3', {
    title: 'Amazon.com: Erotica - Literature & Fiction: Books: BDSM, Romantic & More'
  }),
  BLOCKED
);
assert.deepStrictEqual(
  amazonSignals('https://www.amazon.com/zgbs/digital-text/4', { title: 'Amazon Best Sellers: Best Erotica' }),
  BLOCKED
);

// Parent category whose title lists Erotica as a sub-category is allowed.
assert.deepStrictEqual(
  amazonSignals('https://www.amazon.com/b?node=157028011', {
    title: 'Amazon.com: Literature & Fiction: Kindle Store: Romance, Erotica, Mystery & More',
    h1: ['Literature & Fiction']
  }),
  ALLOWED
);

// Book whose primary breadcrumb is not erotica but which is ranked in an
// erotica sub-category.
assert.deepStrictEqual(
  amazonSignals('https://www.amazon.com/dp/0063045656', {
    title: 'It Happened One Summer: A Novel: Amazon.com: Books',
    breadcrumb: 'Books › Literature & Fiction › Genre Fiction › Coming of Age',
    rank: ['See Top 100 in Books', 'Humorous Erotica (Books)', 'Romantic Erotica (Books)']
  }),
  BLOCKED
);
assert.deepStrictEqual(
  amazonSignals('https://www.amazon.com/dp/B083TZV25B', {
    breadcrumb: 'Kindle Store › Kindle eBooks › Literature & Fiction › Erotica'
  }),
  BLOCKED
);

// Ordinary books and products, including an "Erotic" book title outside
// any erotica category, are allowed.
assert.deepStrictEqual(
  amazonSignals('https://www.amazon.com/dp/0743273567', {
    breadcrumb: 'Books › Literature & Fiction › Classics',
    rank: ['See Top 100 in Books', 'Classic Literature & Fiction', 'Friendship Fiction (Books)']
  }),
  ALLOWED
);
assert.deepStrictEqual(
  amazonSignals('https://www.amazon.com/dp/1605500569', {
    title: 'Erotic Astrology: The Sex Secrets of Your Horoscope Revealed',
    breadcrumb: 'Books › Self-Help › Relationships › Love & Romance',
    rank: ['See Top 100 in Books', 'Astrology (Books)', 'Sex & Sexuality']
  }),
  ALLOWED
);
assert.deepStrictEqual(
  amazonSignals('https://www.amazon.com/s?k=xerotic+skin+cream', { h1: ['Results'] }),
  ALLOWED
);

console.log('PASS: Amazon erotica product rank categories and category pages');
