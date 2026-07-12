/* CI generator for the Asas hosted runner. Reads env PROJECT (JSON string),
   MODE (scaffold|build), SITE (folder name) → writes public/sites/<SITE>/index.html. */
import fs from 'node:fs';
import path from 'node:path';

if (!process.env.PROJECT || !process.env.SITE) {
  console.log('No project payload — nothing to generate (redeploy only).');
  process.exit(0);
}
const project = JSON.parse(process.env.PROJECT || '{}');
const MODE = process.env.MODE === 'build' ? 'build' : 'scaffold';
const SITE = (process.env.SITE || 'site').replace(/[^a-z0-9-]/gi, '') || 'site';
const d = project.data || {};
const slug = s => String(s || 'project').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'project';
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function shellHTML() {
  const name = d.name || 'Untitled', desc = d.desc || '';
  const primary = /^#[0-9a-f]{6}$/i.test(d.primary || '') ? d.primary : '#00674f';
  const rtl = (d.langs || []).some(x => /RTL|Arabic/i.test(x));
  const pages = (Array.isArray(d.pages) && d.pages.length ? d.pages : ['Home', 'About', 'Services', 'Contact']);
  const logo = (d.logo && d.logo.code) ? d.logo.code : '';
  const nav = pages.map(pg => `<a href="#${slug(pg)}">${esc(pg)}</a>`).join('');
  const sections = pages.map((pg, i) => `<section id="${slug(pg)}" class="sec${i === 0 ? ' hero' : ''}"><div class="wrap">${i === 0 ? `<div class="logo">${logo}</div>` : ''}<h${i === 0 ? 1 : 2}>${i === 0 ? esc(name) : esc(pg)}</h${i === 0 ? 1 : 2}><p>${i === 0 ? esc(desc || 'Building something worth building.') : 'The ' + esc(pg) + ' section — ready for real content.'}</p>${i === 0 ? `<a class="cta" href="#${slug(pages[pages.length - 1])}">${d.goal ? esc(d.goal) : 'Get in touch'}</a>` : ''}</div></section>`).join('');
  return `<!doctype html><html lang="${rtl ? 'ar' : 'en'}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)}</title><style>:root{--brand:${primary};--ink:#1c1c1c;--bg:#faf9f6;--muted:#6b6b66;--line:#e8e5de}*{box-sizing:border-box;margin:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:var(--ink);background:var(--bg);line-height:1.6}header{position:sticky;top:0;background:rgba(250,249,246,.85);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);z-index:9}.bar{max-width:1080px;margin:0 auto;padding:16px 24px;display:flex;align-items:center;gap:18px}.brand{font-weight:700;font-size:18px}nav{margin-inline-start:auto;display:flex;gap:20px}nav a{color:var(--muted);text-decoration:none;font-size:14px;font-weight:500}nav a:hover{color:var(--brand)}.sec{padding:80px 24px}.wrap{max-width:820px;margin:0 auto}.hero{padding:120px 24px;text-align:center}.hero .logo{width:72px;height:72px;margin:0 auto 26px}.hero .logo svg{width:100%;height:100%}h1{font-size:clamp(38px,7vw,68px);letter-spacing:-.03em;line-height:1.05}h2{font-size:32px;letter-spacing:-.02em;margin-bottom:12px}.hero p{font-size:20px;color:var(--muted);max-width:600px;margin:20px auto 0}p{color:var(--muted);max-width:640px}.cta{display:inline-block;margin-top:32px;background:var(--brand);color:#fff;padding:15px 30px;border-radius:12px;text-decoration:none;font-weight:600}.sec:nth-child(even){background:#fff}footer{padding:48px 24px;text-align:center;color:var(--muted);font-size:13px;border-top:1px solid var(--line)}</style></head><body><header><div class="bar"><span class="brand">${esc(name)}</span><nav>${nav}</nav></div></header>${sections}<footer>© ${new Date().getFullYear()} ${esc(name)} · built by Asas · أساس</footer></body></html>`;
}

async function geminiHTML() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { console.log('No GEMINI_API_KEY secret — falling back to shell.'); return shellHTML(); }
  const spec = project.prompt || project.brief || JSON.stringify(d);
  const logo = (d.logo && d.logo.code) ? `\n\nUse this exact SVG logo inline:\n${d.logo.code}` : '';
  const ask = `Build a complete, production-quality, SINGLE self-contained HTML file (inline CSS+JS, no external requests) for the project below. Real on-brand copy, fully responsive, accessible. ${(d.langs || []).some(x => /Arabic/i.test(x)) ? 'Full RTL (dir="rtl").' : ''} Output ONLY the raw HTML starting with <!doctype html>.${logo}\n\n--- SPEC ---\n${spec}`;
  const model = 'gemini-flash-latest';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: ask }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 16384 } }),
  });
  const j = await r.json();
  let html = j?.candidates?.[0]?.content?.parts?.map(x => x.text).join('') || '';
  html = html.replace(/^```html?\s*/i, '').replace(/```\s*$/i, '').trim();
  return /<html/i.test(html) ? html : shellHTML();
}

const out = path.join('public', 'sites', SITE);
fs.mkdirSync(out, { recursive: true });
const html = MODE === 'build' ? await geminiHTML() : shellHTML();
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('Wrote', out, '(' + html.length + ' bytes,', MODE + ')');
