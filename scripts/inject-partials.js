// One-time script: replaces duplicated navbar/footer HTML with EJS includes
// Run with: node scripts/inject-partials.js
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PAGES = ['index.html', 'sobre.html', 'artigos.html', 'contactos.html', 'areas-de-atuacao.html'];

// End marker shared by all mobile-nav sections
const MOBILE_NAV_END = '    <a href="https://wa.me/351912484143" target="_blank" rel="noopener noreferrer" class="btn btn-gold" data-i18n="nav.cta">Agendar Consulta</a>\n  </div>';

// Footer markers
const FOOTER_START = '  <footer>';
const FOOTER_END   = '  </footer>';

// Nav start markers differ between index and inner pages
const NAV_STARTS = {
  'index.html':               '  <!-- NAVBAR -->\n  <nav class="navbar" id="navbar">',
  'sobre.html':               '  <nav class="navbar scrolled">',
  'artigos.html':             '  <nav class="navbar scrolled">',
  'contactos.html':           '  <nav class="navbar scrolled">',
  'areas-de-atuacao.html':    '  <nav class="navbar scrolled">',
};

// For index.html, also replace the top-bar with its include
const TOPBAR_START = '  <!-- TOP BAR -->';
const TOPBAR_END   = '  </div>\n\n  <!-- NAVBAR -->';

PAGES.forEach(page => {
  const filePath = join(ROOT, page);
  let html = readFileSync(filePath, 'utf8');
  const original = html;

  // --- Replace top-bar (index.html only) ---
  if (page === 'index.html') {
    const tbStart = html.indexOf(TOPBAR_START);
    const tbEnd   = html.indexOf(TOPBAR_END);
    if (tbStart !== -1 && tbEnd !== -1) {
      html = html.slice(0, tbStart)
        + "  <%- include('./partials/top-bar.html') %>\n\n  <!-- NAVBAR -->"
        + html.slice(tbEnd + TOPBAR_END.length);
      console.log(`  [OK] ${page}: replaced top-bar`);
    } else {
      console.log(`  [SKIP] ${page}: top-bar markers not found`);
    }
  }

  // --- Replace navbar + mobile-nav ---
  const navStart = NAV_STARTS[page];
  const navStartIdx = html.indexOf(navStart);
  const mobileNavEndIdx = html.indexOf(MOBILE_NAV_END);

  if (navStartIdx !== -1 && mobileNavEndIdx !== -1) {
    const endIdx = mobileNavEndIdx + MOBILE_NAV_END.length;
    html = html.slice(0, navStartIdx)
      + "  <%- include('./partials/navbar.html') %>"
      + html.slice(endIdx);
    console.log(`  [OK] ${page}: replaced navbar + mobile-nav`);
  } else {
    console.log(`  [SKIP] ${page}: nav markers not found (start=${navStartIdx}, end=${mobileNavEndIdx})`);
  }

  // --- Replace footer ---
  const footerStartIdx = html.indexOf(FOOTER_START);
  const footerEndIdx   = html.indexOf(FOOTER_END);

  if (footerStartIdx !== -1 && footerEndIdx !== -1) {
    const endIdx = footerEndIdx + FOOTER_END.length;
    html = html.slice(0, footerStartIdx)
      + "  <%- include('./partials/footer.html') %>"
      + html.slice(endIdx);
    console.log(`  [OK] ${page}: replaced footer`);
  } else {
    console.log(`  [SKIP] ${page}: footer markers not found`);
  }

  if (html !== original) {
    writeFileSync(filePath, html, 'utf8');
    console.log(`  [SAVED] ${page}`);
  }
});

console.log('\nDone.');
