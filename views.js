'use strict';

/* Semua halaman berupa string HTML. Setiap nilai dinamis WAJIB lewat esc(). */

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const CSS = `
:root{--ink:#0e1b3d;--paper:#f3f5fa;--surface:#fff;--cobalt:#2748f0;--line:#d3d9e6;--muted:#56617c;
--danger:#b3261e;--danger-bg:#fdecea;--ok:#0b7a55;--ok-bg:#e6f5ee}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
.wrap{max-width:34rem;margin:0 auto;padding:20px 20px 56px}
.wrap.wide{max-width:46rem}
.wrap.solo{padding-top:14vh}
h1{margin:0 0 .6rem;font-size:1.75rem;line-height:1.15;letter-spacing:-.02em}
h2{margin:0 0 .3rem;font-size:1.15rem;line-height:1.3}
p{margin:0 0 1rem}
a{color:var(--cobalt)}
code{padding:.1em .35em;font:.9em ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#e4e9f5;border-radius:4px}
.muted{color:var(--muted)}
.small{font-size:.9rem}
:focus-visible{outline:3px solid var(--cobalt);outline-offset:2px}

/* Form */
label{display:block;margin:0 0 .4rem;font-weight:700}
input{display:block;width:100%;min-height:48px;padding:.6rem .8rem;font:inherit;color:inherit;background:var(--surface);border:2px solid var(--ink);border-radius:6px}
input::placeholder{color:#8a93a8}
button{min-height:48px;padding:.6rem 1.2rem;font:inherit;font-weight:700;color:#fff;background:var(--cobalt);border:2px solid var(--cobalt);border-radius:6px;cursor:pointer}
button:active{transform:translateY(1px)}
button.alt{color:var(--ink);background:transparent;border-color:var(--ink)}
.full{width:100%}
.field{margin:0 0 1rem}
.msg{margin:0 0 1rem;padding:.7rem .9rem;border-left:4px solid;border-radius:0 6px 6px 0}
.msg.err{color:#7a1712;background:var(--danger-bg);border-color:var(--danger)}
.msg.ok{color:#075a3f;background:var(--ok-bg);border-color:var(--ok)}

/* Halaman publik: panel tag */
.tag{position:relative;margin:0 0 28px;padding:46px 24px 22px;color:#fff;background:var(--ink);
clip-path:polygon(0 0,calc(100% - 40px) 0,100% 40px,100% 100%,0 100%)}
.tag::before{content:"";position:absolute;top:18px;left:22px;width:16px;height:16px;border-radius:50%;
background:var(--paper);box-shadow:inset 0 0 0 3px rgba(255,255,255,.2)}
.tag-label{display:block;font-size:1rem;opacity:.72}
.tag-num{display:block;font-size:clamp(3.75rem,21vw,6.75rem);font-weight:800;line-height:1;letter-spacing:-.045em;
font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.tag-num.l6{font-size:clamp(3rem,16vw,5rem)}
.tag-num.l8{font-size:clamp(2.25rem,11vw,3.5rem)}
.modal-backdrop{position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;
padding:20px;background:rgba(14,27,61,.5);opacity:0;pointer-events:none;transition:opacity .18s ease}
.modal-backdrop.open{opacity:1;pointer-events:auto}
.modal{width:100%;max-width:26rem;padding:26px 24px 24px;background:var(--surface);border-radius:18px;
box-shadow:0 20px 50px rgba(14,27,61,.28);transform:translateY(14px) scale(.97);opacity:0;
transition:transform .2s cubic-bezier(.2,.8,.2,1),opacity .2s ease}
.modal-backdrop.open .modal{transform:none;opacity:1}
.modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin:0 0 2px}
.modal-close{min-height:auto;padding:2px 6px;font-size:1.4rem;line-height:1;color:var(--muted);background:none;border:0;cursor:pointer}
.modal-stars{display:flex;gap:4px;margin:0 0 14px}
.modal-stars svg{width:16px;height:16px;fill:var(--cobalt);stroke:none}
.modal textarea{display:block;width:100%;min-height:96px;padding:.7rem .85rem;font:inherit;color:inherit;
background:var(--paper);border:2px solid var(--ink);border-radius:10px;resize:vertical}
.modal-actions{display:flex;flex-direction:column;gap:10px;margin-top:18px}
.wrap.solo{text-align:center}
.rate-eyebrow{display:flex;flex-direction:column;align-items:center;gap:8px;margin:0 0 18px;color:var(--cobalt)}
.rate-eyebrow svg{width:46px;height:46px;fill:var(--cobalt)}
.rate-eyebrow span{font-size:1.15rem;font-weight:800}
.stars{display:flex;flex-direction:row-reverse;gap:9px;justify-content:center;margin:0 0 10px}
.star{display:flex;align-items:center;justify-content:center;width:58px;height:58px;color:var(--ink);text-decoration:none;
background:var(--surface);border:2px solid var(--line);border-radius:14px;
transition:transform .12s ease,border-color .15s ease,background .15s ease,box-shadow .15s ease;
animation:star-in .32s cubic-bezier(.2,.8,.2,1) backwards}
.star:nth-child(1){animation-delay:.03s}.star:nth-child(2){animation-delay:.07s}.star:nth-child(3){animation-delay:.11s}
.star:nth-child(4){animation-delay:.15s}.star:nth-child(5){animation-delay:.19s}
.star svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round;transition:fill .15s ease}
.star:hover,.star:hover ~ .star,.star:focus-visible,.star:focus-visible ~ .star{
  color:var(--cobalt);border-color:var(--cobalt);background:#eef1fd;box-shadow:0 4px 14px rgba(39,72,240,.18)}
.star:hover svg,.star:hover ~ .star svg,.star:focus-visible svg,.star:focus-visible ~ .star svg{fill:var(--cobalt)}
.star:active{transform:scale(.9)}
.scale-ends{display:flex;justify-content:space-between;max-width:22rem;margin:0 auto 4px;font-size:.78rem;color:var(--muted)}
@keyframes star-in{from{opacity:0;transform:translateY(6px) scale(.85)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.star{animation:none}}

/* Admin */
.head{padding-top:28px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);margin:20px 0 32px;border-block:2px solid var(--ink)}
.stats div{padding:14px 0 14px 14px;border-left:1px solid var(--line)}
.stats div:first-child{padding-left:0;border-left:0}
.stats dt{font-size:.85rem;color:var(--muted)}
.stats dd{margin:0;font-size:clamp(1.6rem,7vw,2.4rem);font-weight:800;line-height:1.15;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
section{padding-bottom:28px}
.row{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}
.row .field{flex:1 1 9rem;margin:0}
.opts{margin:20px 0 0;padding:0;list-style:none;border-top:1px solid var(--line)}
.opts li{display:grid;grid-template-columns:13rem 1fr;gap:6px 16px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}
.opts button{width:100%}
@media (max-width:560px){.opts li{grid-template-columns:1fr}}

/* Lembar cetak */
.bar{position:sticky;top:0;z-index:1;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between;
padding:10px 16px;background:var(--surface);border-bottom:2px solid var(--ink)}
.bar p{margin:0}
.sheet{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));padding:16px}
.cell{margin:0;padding:12px;color:#000;text-align:center;background:#fff;border:1px dashed #8d95a8;break-inside:avoid}
.cell svg{display:block;width:100%;max-width:170px;height:auto;margin:0 auto}
.cell b{display:block;margin-top:6px;font-size:15px}
.cell span{display:block;font:11px/1.3 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow-wrap:anywhere}
@page{size:A4;margin:10mm}
@media print{
  body{background:#fff}
  .bar{display:none}
  .sheet{grid-template-columns:repeat(4,47.5mm);justify-content:center;padding:0}
  .cell{width:47.5mm;padding:3mm;border:.2mm dashed #777}
  .cell svg{width:38mm;max-width:none}
  .cell b{margin-top:1.5mm;font-size:10pt}
  .cell span{font-size:6.5pt}
}

/* Scan QR */
.scan-frame{margin:0 0 16px;border-radius:8px;overflow:hidden;background:#000}
#scan-video{display:block;width:100%;max-height:70vh;object-fit:cover}

/* Shell admin: sidebar + konten */
.shell{display:flex;min-height:100vh;align-items:stretch}
.sidebar{flex:0 0 220px;width:220px;padding:22px 14px;background:var(--surface);border-right:1px solid var(--line);display:flex;flex-direction:column}
.brand{margin:2px 6px 22px;font-size:1rem;font-weight:800;letter-spacing:-.01em}
.nav{display:flex;flex-direction:column;gap:2px}
.nav-link{display:block;padding:.6rem .7rem;border-left:3px solid transparent;border-radius:0 6px 6px 0;color:var(--muted);font-weight:700;font-size:.95rem;text-decoration:none;text-align:left;width:100%;background:none;border-top:0;border-right:0;border-bottom:0;font:inherit;font-weight:700;cursor:pointer}
.nav-link:hover{color:var(--ink);background:var(--paper)}
.nav-link.active{color:var(--ink);border-left-color:var(--cobalt);background:var(--paper)}
.nav-logout{margin-top:auto;padding-top:14px;border-top:1px solid var(--line)}
.shell-col{flex:1;min-width:0;display:flex;flex-direction:column}
.topbar{display:none;align-items:center;gap:12px;position:sticky;top:0;z-index:2;padding:14px 16px;background:var(--surface);border-bottom:1px solid var(--line)}
.topbar strong{font-size:1rem}
.hamburger{display:flex;flex-direction:column;justify-content:center;gap:4px;width:34px;min-height:34px;padding:0;background:none;border:0;cursor:pointer}
.hamburger span{display:block;height:2px;background:var(--ink);border-radius:2px}
.nav-backdrop[hidden]{display:none}
.content{flex:1;width:100%;max-width:1180px;margin:0 auto;padding:30px 32px 60px}
.content .narrow{max-width:34rem}
@media (max-width:860px){
  .sidebar{position:fixed;inset:0 auto 0 0;z-index:20;width:78vw;max-width:280px;transform:translateX(-100%);transition:transform .15s ease;box-shadow:2px 0 18px rgba(14,27,61,.14)}
  .sidebar.open{transform:translateX(0)}
  .topbar{display:flex}
  .nav-backdrop{position:fixed;inset:0;z-index:15;background:rgba(14,27,61,.35)}
  .content{padding:20px 16px 48px}
}

/* Toolbar: cari + filter */
.toolbar{display:flex;flex-wrap:wrap;gap:10px 12px;align-items:flex-end;margin:0 0 16px}
.toolbar .field{margin:0;flex:1 1 11rem}
select{display:block;width:100%;min-height:48px;padding:.5rem .7rem;font:inherit;color:inherit;background:var(--surface);border:2px solid var(--ink);border-radius:6px}

/* Tabel daftar tag */
.table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
table{width:100%;min-width:640px;border-collapse:collapse;font-size:.92rem}
thead th{padding:11px 14px;text-align:left;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);background:var(--paper);border-bottom:1px solid var(--line);white-space:nowrap}
tbody td{padding:11px 14px;border-bottom:1px solid var(--line);vertical-align:middle}
tbody tr:last-child td{border-bottom:0}
td.num{color:var(--muted);width:1%;white-space:nowrap}
.mono{font:.85em ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.truncate{display:inline-block;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle}
.copy-btn{margin-left:6px;min-height:auto;padding:.15rem .55rem;font-size:.72rem;font-weight:700;color:var(--muted);background:var(--paper);border:1px solid var(--line);border-radius:5px;cursor:pointer;vertical-align:middle}
.copy-btn:hover{color:var(--ink);background:#eceff6}
.badge{display:inline-block;padding:.2rem .65rem;border-radius:999px;font-size:.78rem;font-weight:700;white-space:nowrap}
.badge.on{color:#075a3f;background:var(--ok-bg)}
.badge.off{color:var(--muted);background:var(--paper);border:1px solid var(--line)}
.btn-sm{display:inline-block;padding:.35rem .8rem;min-height:auto;font-size:.85rem;font-weight:700;color:var(--ink);background:var(--surface);border:1.5px solid var(--ink);border-radius:6px;text-decoration:none;white-space:nowrap}
.btn-sm:hover{color:#fff;background:var(--ink)}
.empty{padding:44px 16px;text-align:center;color:var(--muted)}
.pagination{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;font-size:.88rem;color:var(--muted)}
.pagination a{padding:.4rem .9rem;border:1.5px solid var(--ink);border-radius:6px;color:var(--ink);font-weight:700;font-size:.85rem;text-decoration:none}
.pagination a.disabled{opacity:.35;pointer-events:none}
`;

const head = (nonce, title) => `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<style nonce="${nonce}">${CSS}</style>
</head>
`;

const layout = (nonce, title, body) => `${head(nonce, title)}<body>${body}</body>
</html>
`;

/* ---------- Shell admin: sidebar navigasi (dipakai semua halaman /admin) ---------- */

// Admin: akses penuh. User (staff): hanya Kelola Tag (lewat Scan QR), sesuai requireAdmin di server.js.
const navItems = (role) =>
  (role === 'admin' ? [{ key: 'dashboard', href: '/admin', label: 'Dashboard' }, { key: 'kelola', href: '/admin/kelola-tag', label: 'Kelola Tag' }] : []).concat([
    { key: 'scan', href: '/admin/scan', label: 'Scan QR' },
  ]);

const shellScript = (nonce) => `<script nonce="${nonce}">
(function () {
  var btn = document.getElementById('nav-toggle'), side = document.getElementById('sidebar'), back = document.getElementById('nav-backdrop');
  if (!btn || !side) return;
  function close() { side.classList.remove('open'); if (back) back.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
  function open() { side.classList.add('open'); if (back) back.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
  btn.addEventListener('click', function () { side.classList.contains('open') ? close() : open(); });
  if (back) back.addEventListener('click', close);
})();
</script>`;

// Bingkai bersama untuk seluruh halaman /admin: sidebar (Dashboard/Kelola Tag/Scan QR/Logout) + konten.
// `active` menyorot menu yang sedang dibuka; `extraScript` disisipkan sebelum penutup body (mis. skrip scan/reset).
function shell(nonce, { title, role, active, extraScript = '' }, bodyHtml) {
  const links = navItems(role)
    .map((it) => `<a class="nav-link${it.key === active ? ' active' : ''}" href="${it.href}"${it.key === active ? ' aria-current="page"' : ''}>${esc(it.label)}</a>`)
    .join('');
  return layout(nonce, title, `
<div class="shell">
  <div id="nav-backdrop" class="nav-backdrop" hidden></div>
  <aside id="sidebar" class="sidebar">
    <div class="brand">Admin QR + NFC</div>
    <nav class="nav" aria-label="Navigasi admin">${links}</nav>
    <form method="post" action="/logout" class="nav-logout"><button type="submit" class="nav-link">Logout</button></form>
  </aside>
  <div class="shell-col">
    <header class="topbar">
      <button id="nav-toggle" type="button" class="hamburger" aria-label="Buka menu" aria-expanded="false" aria-controls="sidebar"><span></span><span></span><span></span></button>
      <strong>${esc(title)}</strong>
    </header>
    <main class="content">${bodyHtml}</main>
  </div>
</div>
${shellScript(nonce)}${extraScript}`);
}

/* ---------- Halaman publik ---------- */

// Form pengisian link (tag masih kosong)
exports.form = (nonce, { id, value = '', wa = '', error = '' }) => {
  const len = String(id).length;
  const size = len >= 8 ? ' l8' : len >= 6 ? ' l6' : '';
  return layout(nonce, `Tag ${id}`, `
<main class="wrap">
  <header class="tag">
    <span class="tag-label">Tag</span>
    <span class="tag-num${size}">${esc(id)}</span>
  </header>
  <h1>Aktivasi tag</h1>
  <p class="muted">Tag ini belum punya tujuan. Isi link Google Review dan/atau nomor WhatsApp Admin/Owner di bawah.</p>
  <form method="post" action="/${esc(id)}">
    <div class="field">
      <label for="link">Link Google Review</label>
      <input id="link" name="link_google" type="text" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="2048" placeholder="https://g.page/r/…" value="${esc(value)}"${error ? ' aria-describedby="err"' : ''}>
    </div>
    <div class="field">
      <label for="wa">Nomor WhatsApp Admin/Owner</label>
      <input id="wa" name="whatsapp_number" type="text" inputmode="tel" autocomplete="off" maxlength="20" placeholder="08123456789" value="${esc(wa)}"${error ? ' aria-describedby="err"' : ''}>
    </div>
    ${error ? `<p class="msg err" id="err" role="alert">${esc(error)}</p>` : ''}
    <p class="muted small">Isi minimal salah satu. Tidak bisa diubah lagi lewat halaman ini setelah disimpan — pastikan sudah benar.</p>
    <button class="full" type="submit">Simpan</button>
  </form>
</main>`);
};

// Halaman rating (tag sudah dikonfigurasi admin): 1-3 -> WhatsApp, 4-5 -> Google Review.
exports.ratingPage = (nonce, { id }) => {
  const starIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.77 5.9 6.28.72-4.7 4.36 1.28 6.42L12 17.6l-5.63 2.99 1.28-6.42-4.7-4.36 6.28-.72L12 3.2z"/></svg>';
  // Ditulis 5→1 di markup (dibalik visual lewat CSS row-reverse) supaya hover memakai
  // trik CSS murni: elemen yang di-hover, ditambah semua penerusnya di DOM, ikut menyala —
  // dan karena arah tampilan dibalik, itu persis bintang di sebelah kirinya secara visual.
  // Bintang 1-3 dicegat lewat JS untuk membuka popup ulasan dulu (lihat modal-script di bawah);
  // tanpa JS, tautannya tetap valid dan langsung ke WhatsApp seperti semula.
  const star = (n) => {
    const modalAttrs = n <= 3 ? ` data-modal="1" data-rating="${n}"` : '';
    return `<a class="star" href="/${esc(id)}/rate/${n}" aria-label="Beri rating ${n} dari 5 bintang"${modalAttrs}>${starIcon}</a>`;
  };
  const modal = `
<div class="modal-backdrop" id="rate-modal" hidden>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-head">
      <h2 id="modal-title">Mohon maaf pengalamannya kurang baik</h2>
      <button type="button" class="modal-close" id="modal-close" aria-label="Tutup">&times;</button>
    </div>
    <div class="modal-stars" id="modal-stars" aria-hidden="true"></div>
    <p class="muted small">Ceritakan apa yang kurang, supaya bisa segera kami tindak lanjuti. Pesan ini akan disiapkan lewat WhatsApp — Anda tinggal menekan kirim di sana.</p>
    <textarea id="modal-note" maxlength="400" placeholder="Tulis masukan Anda di sini (opsional)…" aria-label="Masukan untuk Admin"></textarea>
    <div class="modal-actions">
      <button type="button" class="full" id="modal-send">Buka WhatsApp &amp; kirim masukan</button>
    </div>
  </div>
</div>`;
  const script = `<script nonce="${nonce}">
(function () {
  var backdrop = document.getElementById('rate-modal');
  var closeBtn = document.getElementById('modal-close');
  var sendBtn = document.getElementById('modal-send');
  var noteEl = document.getElementById('modal-note');
  var starsWrap = document.getElementById('modal-stars');
  var titleEl = document.getElementById('modal-title');
  var starSvg = '<svg viewBox="0 0 24 24"><path d="M12 3.2l2.77 5.9 6.28.72-4.7 4.36 1.28 6.42L12 17.6l-5.63 2.99 1.28-6.42-4.7-4.36 6.28-.72L12 3.2z"/></svg>';
  var targetHref = '', lastFocused = null;

  function openModal(n, href, el) {
    targetHref = href;
    lastFocused = el;
    starsWrap.innerHTML = new Array(n + 1).join(starSvg);
    titleEl.textContent = n === 3 ? 'Ceritakan yang kurang pas' : 'Mohon maaf pengalamannya kurang baik';
    noteEl.value = '';
    backdrop.hidden = false;
    requestAnimationFrame(function () { backdrop.classList.add('open'); });
    setTimeout(function () { noteEl.focus(); }, 160);
    document.addEventListener('keydown', onKeydown);
  }
  function closeModal() {
    backdrop.classList.remove('open');
    document.removeEventListener('keydown', onKeydown);
    setTimeout(function () { backdrop.hidden = true; if (lastFocused) lastFocused.focus(); }, 180);
  }
  function onKeydown(e) { if (e.key === 'Escape') closeModal(); }
  function go(withNote) {
    var url = targetHref;
    var note = withNote ? noteEl.value.trim().slice(0, 400) : '';
    if (note) url += (url.indexOf('?') === -1 ? '?' : '&') + 'note=' + encodeURIComponent(note);
    window.location.href = url;
  }

  document.querySelectorAll('.star[data-modal]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      openModal(Number(a.getAttribute('data-rating')), a.getAttribute('href'), a);
    });
  });
  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', function (e) { if (e.target === backdrop) closeModal(); });
  sendBtn.addEventListener('click', function () { go(true); });
})();
</script>`;
  return layout(nonce, `Beri rating`, `
<main class="wrap solo">
  <div class="rate-eyebrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.4"/></svg><span>Beri Ulasan</span></div>
  <h1>Bagaimana pengalaman Anda?</h1>
  <div class="stars">${[5, 4, 3, 2, 1].map(star).join('')}</div>
  <div class="scale-ends"><span>Kurang puas</span><span>Sangat puas</span></div>
</main>${modal}${script}`);
};

// Halaman pesan singkat (404, error, batas percobaan)
exports.message = (nonce, title, text, back) => layout(nonce, title, `
<main class="wrap solo">
  <h1>${esc(title)}</h1>
  <p class="muted">${esc(text)}</p>
  ${back ? `<p><a href="${esc(back)}">Kembali ke admin</a></p>` : ''}
</main>`);

/* ---------- Login ---------- */

// Satu halaman login untuk kedua role. Tidak ada pilihan role di form — server.js yang menentukan
// dari kredensial mana yang cocok (ADMIN_USER -> Dashboard, STAFF_USER -> Kelola Tag).
exports.login = (nonce, { error = '' } = {}) => layout(nonce, 'Login', `
<main class="wrap solo">
  <h1>Login</h1>
  ${error ? `<p class="msg err" id="err" role="alert">${esc(error)}</p>` : ''}
  <form method="post" action="/login">
    <div class="field">
      <label for="username">Username</label>
      <input id="username" name="username" type="text" autocomplete="username" required autofocus${error ? ' aria-describedby="err"' : ''}>
    </div>
    <div class="field">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
    </div>
    <button class="full" type="submit">Masuk</button>
  </form>
</main>`);

/* ---------- Admin ---------- */

// Dashboard: statistik ringkas + tabel Daftar Tag (cari, filter status, pagination).
// Aksi massal (Buat ID/Ekspor) dipindah ke halaman Kelola Tag agar dashboard tidak penuh.
exports.admin = (nonce, { role, total, filled, baseUrl, created, tags, q, status, page, totalPages, filteredTotal }) => {
  const nonaktif = total - filled;
  const host = (() => {
    try {
      return new URL(baseUrl).host;
    } catch {
      return baseUrl;
    }
  })();

  const qs = (overrides) => {
    const p = new URLSearchParams();
    const merged = { q, status, page, ...overrides };
    if (merged.q) p.set('q', merged.q);
    if (merged.status) p.set('status', merged.status);
    if (merged.page > 1) p.set('page', merged.page);
    const s = p.toString();
    return s ? `/admin?${s}` : '/admin';
  };

  const rows = tags
    .map((t, i) => {
      const url = `${baseUrl}/${t.id}`;
      const isOn = !!t.link_google;
      return `<tr>
      <td class="num">${(page - 1) * 20 + i + 1}</td>
      <td><span class="truncate mono" title="${esc(url)}">/${esc(t.id)}</span> <button type="button" class="copy-btn" data-copy="${esc(url)}">Salin</button></td>
      <td>${
        isOn
          ? `<a class="truncate" href="${esc(t.link_google)}" target="_blank" rel="noopener" title="${esc(t.link_google)}">${esc(t.link_google)}</a>`
          : '<span class="muted small">Belum diisi</span>'
      }</td>
      <td>${isOn ? '<span class="badge on">Aktif</span>' : '<span class="badge off">Nonaktif</span>'}</td>
      <td><a class="btn-sm" href="/admin/tag/${esc(t.id)}">Kelola</a></td>
    </tr>`;
    })
    .join('');

  return shell(nonce, { title: 'Dashboard', role, active: 'dashboard' }, `
  <div class="head">
    <h1>Dashboard</h1>
    <p class="muted">Ringkasan tag dan status koneksinya.</p>
  </div>
  ${created ? `<p class="msg ok" role="status">ID ${esc(created[0])}–${esc(created[1])} berhasil dibuat.</p>` : ''}
  <dl class="stats">
    <div><dt>Total Tag</dt><dd>${esc(total)}</dd></div>
    <div><dt>Aktif</dt><dd>${esc(filled)}</dd></div>
    <div><dt>Nonaktif</dt><dd>${esc(nonaktif)}</dd></div>
  </dl>
  <section>
    <h2>Daftar Tag</h2>
    <form method="get" action="/admin" class="toolbar">
      <div class="field">
        <label for="q">Cari</label>
        <input id="q" name="q" type="text" placeholder="Nomor ID atau link tujuan…" value="${esc(q)}">
      </div>
      <div class="field">
        <label for="status">Status</label>
        <select id="status" name="status">
          <option value="">Semua</option>
          <option value="aktif"${status === 'aktif' ? ' selected' : ''}>Aktif</option>
          <option value="nonaktif"${status === 'nonaktif' ? ' selected' : ''}>Nonaktif</option>
        </select>
      </div>
      <button type="submit" class="alt">Terapkan</button>
      ${q || status ? '<a class="small" href="/admin">Bersihkan</a>' : ''}
    </form>
    ${
      tags.length
        ? `<div class="table-wrap">
      <table>
        <thead><tr><th>No</th><th>URL Kode Unik QR</th><th>Link Tujuan</th><th>Status</th><th>Kelola Tag</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="pagination">
      <span>Halaman ${page} dari ${totalPages} · ${filteredTotal} tag</span>
      <span>
        <a href="${qs({ page: page - 1 })}"${page <= 1 ? ' class="disabled"' : ''}>‹ Sebelumnya</a>
        <a href="${qs({ page: page + 1 })}"${page >= totalPages ? ' class="disabled"' : ''}>Selanjutnya ›</a>
      </span>
    </div>`
        : `<p class="empty">${q || status ? 'Tidak ada tag yang cocok dengan pencarian.' : 'Belum ada tag. Buat tag baru di menu Kelola Tag.'}</p>`
    }
  </section>
  <script nonce="${nonce}">
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.copy-btn');
    if (!btn || !navigator.clipboard) return;
    navigator.clipboard.writeText(btn.getAttribute('data-copy') || '').then(function () {
      var prev = btn.textContent;
      btn.textContent = 'Disalin';
      setTimeout(function () { btn.textContent = prev; }, 1200);
    }).catch(function () {});
  });
  </script>
  `);
};

// Kelola Tag: aksi massal (buat ID baru, ekspor CSV/ZIP/cetak) — dipindah dari dashboard ke sini.
// Endpoint tujuan form (POST/GET) tidak berubah, hanya lokasi tampilannya.
exports.kelolaTag = (nonce, { role, last, baseUrl, created, limits }) => {
  const from = created ? created[0] : 1;
  const to = created ? created[1] : last || '';
  return shell(nonce, { title: 'Kelola Tag', role, active: 'kelola' }, `
  <div class="narrow">
  <div class="head">
    <h1>Kelola Tag</h1>
    <p class="muted">Setiap ID punya satu URL untuk QR dan NFC, misalnya <code>${esc(baseUrl)}/1</code>.</p>
  </div>
  ${created ? `<p class="msg ok" role="status">ID ${esc(created[0])}–${esc(created[1])} berhasil dibuat. Rentang ekspor di bawah sudah terisi.</p>` : ''}
  <section>
    <h2>Buat ID baru</h2>
    <p class="muted small">Nomor dilanjutkan dari ID terakhir dan tidak pernah dipakai ulang.</p>
    <form method="post" action="/admin/generate" class="row">
      <div class="field">
        <label for="count">Jumlah ID</label>
        <input id="count" name="count" type="number" inputmode="numeric" min="1" max="${esc(limits.generate)}" value="100" required>
      </div>
      <button type="submit">Buat ID</button>
    </form>
  </section>
  <section>
    <h2>Ekspor untuk cetak dan NFC</h2>
    <p class="muted small">Isi rentang ID, lalu pilih format.</p>
    <form method="get">
      <div class="row">
        <div class="field">
          <label for="from">Dari ID</label>
          <input id="from" name="from" type="number" inputmode="numeric" min="1" value="${esc(from)}" required>
        </div>
        <div class="field">
          <label for="to">Sampai ID</label>
          <input id="to" name="to" type="number" inputmode="numeric" min="1" value="${esc(to)}" required>
        </div>
      </div>
      <ul class="opts">
        <li><button type="submit" class="alt" formaction="/admin/export.csv">Unduh CSV</button><span>Daftar <code>id,url</code> untuk NFC bulk writer. Maks. ${esc(limits.export)} ID.</span></li>
        <li><button type="submit" class="alt" formaction="/admin/export.zip">Unduh ZIP</button><span>Gambar QR (PNG) per ID ditambah <code>urls.csv</code>. Maks. ${esc(limits.export)} ID.</span></li>
        <li><button type="submit" class="alt" formaction="/admin/print" formtarget="_blank">Buka lembar cetak</button><span>QR beserta URL, siap dicetak di A4. Maks. ${esc(limits.print)} ID.</span></li>
      </ul>
    </form>
  </section>
  </div>`);
};

// Kelola satu tag (admin): ubah link yang tersimpan, atau kembalikan ke kondisi awal (kosong)
// sehingga tampil lagi seperti sebelum diaktivasi (form publik akan muncul kembali).
exports.tagManage = (nonce, { id, link = '', whatsapp = '', createdAt, updatedAt, notice = '', error = '', role }) => {
  const len = String(id).length;
  const size = len >= 8 ? ' l8' : len >= 6 ? ' l6' : '';
  const fmt = (d) => (d ? new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '');
  const back = role === 'admin' ? { href: '/admin', label: '← Kembali ke Dashboard' } : { href: '/admin/scan', label: '← Kembali ke Scan QR' };
  const configured = link || whatsapp;
  const resetScript = configured
    ? `<script nonce="${nonce}">document.getElementById('reset-form').addEventListener('submit',function(e){if(!confirm('Hapus konfigurasi ini dan kembalikan tag ke kondisi awal (belum diisi)?'))e.preventDefault()});</script>`
    : '';
  return shell(nonce, { title: `Kelola Tag ${id}`, role, active: role === 'admin' ? 'dashboard' : 'scan', extraScript: resetScript }, `
  <div class="narrow">
  <header class="tag">
    <span class="tag-label">Tag</span>
    <span class="tag-num${size}">${esc(id)}</span>
  </header>
  <div class="head">
    <h1>Kelola tag</h1>
    <p class="muted small">Dibuat ${esc(fmt(createdAt))}${updatedAt ? ` · diisi ${esc(fmt(updatedAt))}` : ''}</p>
  </div>
  ${notice ? `<p class="msg ok" role="status">${esc(notice)}</p>` : ''}
  <section>
    <h2>${configured ? 'Sudah terhubung' : 'Belum terhubung'}</h2>
    <p class="muted small">${
      configured
        ? 'Pemindaian QR/NFC tag ini menampilkan halaman rating, lalu diteruskan ke WhatsApp (rating 1–3) atau Google Review (rating 4–5). Simpan perubahan di bawah untuk menggantinya.'
        : 'Tag ini belum diisi. Pengunjung akan melihat form pengisian sampai link diisi di sini atau lewat pemindaian pertama.'
    }</p>
    <form method="post" action="/admin/tag/${esc(id)}/link">
      <div class="field">
        <label for="link">Google Review URL</label>
        <input id="link" name="link_google" type="text" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="2048" placeholder="https://g.page/r/…" value="${esc(link)}"${error ? ' aria-describedby="err"' : ''}>
      </div>
      <div class="field">
        <label for="wa">Nomor WhatsApp Admin/Owner</label>
        <input id="wa" name="whatsapp_number" type="text" inputmode="tel" autocomplete="off" maxlength="20" placeholder="08123456789" value="${esc(whatsapp)}"${error ? ' aria-describedby="err"' : ''}>
      </div>
      ${error ? `<p class="msg err" id="err" role="alert">${esc(error)}</p>` : ''}
      <button class="full" type="submit">Simpan</button>
    </form>
  </section>
  ${
    configured
      ? `<section>
    <h2>Kembalikan ke kondisi awal</h2>
    <p class="muted small">Menghapus link ini. Tag kembali kosong seperti sebelum diaktivasi, dan pemindaian berikutnya akan menampilkan form pengisian lagi.</p>
    <form method="post" action="/admin/tag/${esc(id)}/reset" id="reset-form">
      <button class="full alt" type="submit">Hapus link (reset)</button>
    </form>
  </section>`
      : ''
  }
  <p><a href="${back.href}">${back.label}</a></p>
  </div>`);
};

// Scan QR (admin): kamera + baca QR di browser (jsQR), lalu cocokkan ke tag yang sudah ada.
// Tidak ada form ID manual di sini — hasil baca langsung dipakai untuk membuka tag.
exports.tagScan = (nonce, { baseUrl, role }) => {
  const back = role === 'admin' ? { href: '/admin', label: '← Kembali ke Dashboard' } : null;
  const scanScript = `<script nonce="${nonce}" src="/admin/lib/jsQR.js"></script>
<script nonce="${nonce}">
(function () {
  var BASE = ${JSON.stringify(baseUrl)};
  var MAX_ID = 4294967295;
  var videoEl = document.getElementById('scan-video');
  var statusEl = document.getElementById('scan-status');
  var msgEl = document.getElementById('scan-msg');
  var retryBtn = document.getElementById('scan-retry');
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  var stream = null, raf = null, scanning = false;

  function setStatus(text) { msgEl.hidden = true; statusEl.hidden = false; statusEl.textContent = text; }
  function showError(text) { statusEl.hidden = true; msgEl.hidden = false; msgEl.textContent = text; retryBtn.hidden = false; }

  function stopCamera() {
    scanning = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
  }

  // Sama seperti urlOf()/isId() di server.js: URL tag = "{BASE_URL}/{id}".
  function extractId(text) {
    text = (typeof text === 'string' ? text : '').trim();
    var prefix = BASE + '/';
    if (text.indexOf(prefix) !== 0) return null;
    var rest = text.slice(prefix.length);
    if (!/^[1-9]\\d{0,9}$/.test(rest)) return null;
    return Number(rest) <= MAX_ID ? rest : null;
  }

  function onDecoded(text) {
    stopCamera();
    var id = extractId(text);
    if (!id) return showError('QR tidak valid. Pastikan QR berasal dari tag pada sistem ini.');
    setStatus('Memeriksa tag ' + id + '…');
    fetch('/admin/scan/check/' + id)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.found) window.location.href = '/admin/tag/' + id;
        else showError('Tag ' + id + ' tidak ditemukan.');
      })
      .catch(function () {
        window.location.href = '/admin/tag/' + id; // tetap arahkan; halaman tujuan yang menentukan status sebenarnya
      });
  }

  function tick() {
    if (!scanning) return;
    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var code = window.jsQR(img.data, img.width, img.height);
      if (code && code.data) { onDecoded(code.data); return; }
    }
    raf = requestAnimationFrame(tick);
  }

  function start() {
    stopCamera();
    msgEl.hidden = true;
    retryBtn.hidden = true;
    if (typeof window.jsQR !== 'function') return showError('Pustaka pemindai gagal dimuat. Muat ulang halaman.');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return showError('Browser ini tidak mendukung pemindaian kamera.');
    setStatus('Meminta izin kamera…');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(function (s) {
        stream = s;
        videoEl.srcObject = s;
        return videoEl.play();
      })
      .then(function () {
        setStatus('Arahkan kamera ke QR…');
        scanning = true;
        raf = requestAnimationFrame(tick);
      })
      .catch(function (err) {
        var text = 'Tidak bisa mengakses kamera.';
        if (err && err.name === 'NotAllowedError') text = 'Izin kamera ditolak. Aktifkan izin kamera untuk situs ini di pengaturan browser, lalu tekan Scan ulang.';
        else if (err && err.name === 'NotFoundError') text = 'Kamera tidak ditemukan di perangkat ini.';
        else if (err && err.name === 'NotReadableError') text = 'Kamera sedang dipakai aplikasi lain.';
        showError(text);
      });
  }

  retryBtn.addEventListener('click', start);
  start();
})();
</script>`;

  return shell(nonce, { title: 'Scan QR', role, active: 'scan', extraScript: scanScript }, `
  <div class="narrow">
  <div class="head">
    <h1>Scan QR</h1>
    <p class="muted small">Arahkan kamera ke QR pada tag. Tag yang cocok langsung terbuka, tanpa mengetik ID.</p>
  </div>
  <div class="scan-frame">
    <video id="scan-video" autoplay playsinline muted aria-label="Pratinjau kamera untuk memindai QR"></video>
  </div>
  <p id="scan-status" class="muted small" role="status">Menyiapkan kamera…</p>
  <p id="scan-msg" class="msg err" role="alert" hidden></p>
  <button id="scan-retry" type="button" class="full alt" hidden>Scan ulang</button>
  ${back ? `<p><a href="${back.href}">${back.label}</a></p>` : ''}
  </div>`);
};

/* ---------- Lembar cetak (dikirim bertahap: head, banyak cell, foot) ---------- */

exports.printHead = (nonce, { count, label }) => `${head(nonce, `Lembar cetak ID ${label}`)}<body>
<div class="bar">
  <p><strong>Lembar cetak</strong>, ID ${esc(label)}, total ${esc(count)} kode. Cetak dengan skala 100%.</p>
  <button type="button" id="print-btn">Cetak atau simpan PDF</button>
</div>
<main class="sheet">
`;

exports.printCell = (id, url, svg) =>
  `<figure class="cell">${svg}<figcaption><b>${esc(id)}</b><span>${esc(url)}</span></figcaption></figure>\n`;

exports.printFoot = (nonce) => `</main>
<script nonce="${nonce}">document.getElementById('print-btn').addEventListener('click',function(){window.print()});</script>
</body>
</html>
`;
