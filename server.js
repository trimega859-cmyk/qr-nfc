'use strict';

require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const mysql = require('mysql2/promise');
const { Zip, ZipPassThrough, strToU8 } = require('fflate');
const { rateLimit } = require('express-rate-limit');
const view = require('./views');
const qr = require('./qr');

/* ============================== Konfigurasi ============================== */

const env = process.env;
const PORT = Number(env.PORT) || 3000;
const HOST = env.HOST || '127.0.0.1';
const BASE_URL = (env.BASE_URL || '').replace(/\/+$/, '');
const ADMIN_USER = env.ADMIN_USER || '';
const ADMIN_PASS = env.ADMIN_PASS || '';
// Akun kedua, opsional: akses terbatas ke Kelola Tag saja (role "user"). Kosongkan STAFF_USER bila tak perlu.
const STAFF_USER = env.STAFF_USER || '';
const STAFF_PASS = env.STAFF_PASS || '';
const ALLOWED_HOSTS = (env.ALLOWED_HOSTS ?? 'google.com,google.co.id,g.page,g.co,goo.gl,forms.gle,share.google')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const MAX_ID = 4294967295; // batas kolom INT UNSIGNED
const LIMITS = { generate: 10000, export: 20000, print: 1000 };

const die = (msg) => {
  console.error('[konfigurasi] ' + msg);
  process.exit(1);
};
if (!/^https?:\/\/[^/\s]+$/i.test(BASE_URL)) die('BASE_URL wajib diisi, contoh: https://domain.com (tanpa path).');
if (!ADMIN_USER || ADMIN_PASS.length < 10) die('ADMIN_USER wajib diisi dan ADMIN_PASS minimal 10 karakter.');
if (STAFF_USER && STAFF_PASS.length < 10) die('STAFF_PASS minimal 10 karakter jika STAFF_USER diisi.');
if (!env.DB_USER || !env.DB_NAME) die('DB_USER dan DB_NAME wajib diisi.');

const BASE_HOST = new URL(BASE_URL).host;

// DB_SSL=1 mengaktifkan koneksi terenkripsi ke database — wajib untuk hampir semua
// penyedia MySQL cloud gratis (mis. Aiven), karena koneksinya lewat internet publik.
// Biarkan 0/kosong untuk database lokal (127.0.0.1), seperti pada instalasi VPS manual.
// DB_SSL_STRICT=1 memverifikasi sertifikat CA penyedia database; default tidak strict
// (tetap terenkripsi, hanya tidak mencocokkan sertifikat) agar mudah dipakai tanpa
// perlu mengunduh file CA secara manual.
const useSsl = env.DB_SSL === '1' || env.DB_SSL === 'true';

const pool = mysql.createPool({
  host: env.DB_HOST || '127.0.0.1',
  port: Number(env.DB_PORT) || 3306,
  user: env.DB_USER,
  password: env.DB_PASS,
  database: env.DB_NAME,
  connectionLimit: 5,
  enableKeepAlive: true,
  ...(useSsl ? { ssl: { rejectUnauthorized: env.DB_SSL_STRICT === '1' } } : {}),
});

/* =============================== Helper ================================== */

const urlOf = (id) => `${BASE_URL}/${id}`;
const isId = (s) => /^[1-9]\d{0,9}$/.test(s) && Number(s) <= MAX_ID;

// Bandingkan rahasia tanpa bocor lewat waktu eksekusi.
const safeEqual = (a, b) => {
  const h = (s) => crypto.createHash('sha256').update(String(s)).digest();
  return crypto.timingSafeEqual(h(a), h(b));
};

// Validasi dan rapikan link. Mengembalikan URL bersih, atau null jika ditolak.
function cleanLink(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s || s.length > 2048) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s; // "g.page/r/abc" -> "https://g.page/r/abc"
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (ALLOWED_HOSTS.length && !ALLOWED_HOSTS.some((d) => host === d || host.endsWith('.' + d))) return null;
  return u.href.length <= 2048 ? u.href : null;
}

// Normalisasi nomor WhatsApp: buang +, spasi, -, (), ubah awalan 0 -> 62.
// Mengembalikan digit saja (format wa.me), atau null jika tidak valid.
function cleanWaNumber(raw) {
  if (typeof raw !== 'string') return null;
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if (!digits.startsWith('62')) digits = '62' + digits;
  return /^62\d{8,13}$/.test(digits) ? digits : null;
}

// Template pesan WhatsApp bawaan sistem (rating 1-3). Tidak dapat diubah dari admin panel.
// `note` opsional: ulasan singkat yang ditulis pengunjung di popup halaman rating.
const waMessage = (rating, note) =>
  `Halo Admin, saya ingin menyampaikan masukan mengenai pengalaman saya. Rating saya: ${rating} bintang.` +
  (note ? `\n\nUlasan: ${note}` : '');
const waLinkOf = (number, rating, note) => `https://wa.me/${number}?text=${encodeURIComponent(waMessage(rating, note))}`;

// Bersihkan catatan dari popup: string saja, potong ke 400 karakter, baris baru dirapikan,
// karakter kendali dibuang. Tidak pernah disimpan ke database atau dirender sebagai HTML —
// hanya diteruskan sebagai teks ke tautan wa.me.
function cleanNote(raw) {
  if (typeof raw !== 'string' || !raw) return '';
  return raw
    .replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, 400);
}

// Ambil daftar ID sesuai ?from=&to=. Sudah membalas ke klien bila hasilnya tidak valid (return null).
async function pickIds(req, res, max) {
  const num = (v, fallback) => (/^\d{1,10}$/.test(v) ? Number(v) : fallback);
  const [rows] = await pool.query('SELECT id FROM tags WHERE id BETWEEN ? AND ? ORDER BY id LIMIT ?', [
    num(req.query.from, 1),
    num(req.query.to, MAX_ID),
    max + 1,
  ]);
  const msg = (code, title, text) => {
    res.status(code).send(view.message(res.locals.nonce, title, text, '/admin'));
    return null;
  };
  if (!rows.length) return msg(404, 'Tidak ada ID', 'Tidak ada ID pada rentang itu. Periksa angka "Dari ID" dan "Sampai ID".');
  if (rows.length > max) return msg(400, 'Rentang terlalu besar', `Maksimal ${max} ID sekali ekspor. Persempit rentang ID.`);
  return rows.map((r) => r.id);
}

const csvOf = (ids) => 'id,url\n' + ids.map((id) => `${id},${urlOf(id)}`).join('\n') + '\n';
const rangeOf = (ids) => `${ids[0]}-${ids[ids.length - 1]}`;

/* ============================== Middleware =============================== */

const app = express();
app.disable('x-powered-by');
if (Number(env.TRUST_PROXY)) app.set('trust proxy', Number(env.TRUST_PROXY));

// Header keamanan + nonce per respons (CSP tanpa 'unsafe-inline').
app.use((req, res, next) => {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.nonce = nonce;
  res.set({
    'Content-Security-Policy': `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'no-store',
  });
  next();
});

const parseForm = express.urlencoded({ extended: false, limit: '8kb' });
const WINDOW = 15 * 60 * 1000;

// Batasi pengisian form publik per IP (mencegah pengisian massal otomatis).
const submitLimit = rateLimit({
  windowMs: WINDOW,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).send(view.message(res.locals.nonce, 'Terlalu banyak percobaan', 'Tunggu beberapa menit, lalu coba lagi.')),
});

// Batasi tebakan password admin per IP (hanya percobaan yang gagal yang dihitung).
const loginLimit = rateLimit({
  windowMs: WINDOW,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Terlalu banyak percobaan login. Coba lagi nanti.',
});

// Sesi login: token acak disimpan di memori server (role + kedaluwarsa), dikirim ke klien lewat cookie HttpOnly.
// Tidak ada tabel database untuk ini — sesuai instruksi, tidak ada perubahan skema.
const sessions = new Map(); // token -> { role, expires }
const SESSION_TTL = 12 * 60 * 60 * 1000; // 12 jam
const SECURE_COOKIE = BASE_URL.startsWith('https://');

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function startSession(res, role) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { role, expires: Date.now() + SESSION_TTL });
  res.cookie('sid', token, { httpOnly: true, secure: SECURE_COOKIE, sameSite: 'strict', maxAge: SESSION_TTL, path: '/' });
}

function endSession(req, res) {
  const token = parseCookies(req).sid;
  if (token) sessions.delete(token);
  res.clearCookie('sid', { path: '/' });
}

// Gerbang sesi untuk seluruh area /admin (dashboard maupun Kelola Tag). Role tetap ditentukan
// oleh sesi yang tersimpan di server, sama seperti basicAuth sebelumnya menentukannya dari kredensial.
function requireSession(req, res, next) {
  const token = parseCookies(req).sid;
  const sess = token && sessions.get(token);
  if (sess) {
    if (sess.expires > Date.now()) {
      res.locals.role = sess.role;
      return next();
    }
    sessions.delete(token);
  }
  res.redirect(302, '/login');
}

// Rute yang hanya boleh dipakai role admin (buat ID, ekspor, cetak, dashboard).
// Role user (akses terbatas ke Kelola Tag) diarahkan balik ke halaman scan, bukan ditolak mentah.
function requireAdmin(req, res, next) {
  if (res.locals.role === 'admin') return next();
  res.redirect(302, '/admin/scan');
}

// Proteksi CSRF sederhana: tolak POST (login, logout, form admin) yang bukan berasal dari situs sendiri.
function sameOriginOnly(req, res, next) {
  const site = req.get('sec-fetch-site');
  if (site) return site === 'same-origin' ? next() : res.status(403).send('Forbidden');
  const origin = req.get('origin');
  if (origin) {
    let host = '';
    try {
      host = new URL(origin).host;
    } catch {
      /* Origin: null */
    }
    if (host !== req.get('host') && host !== BASE_HOST) return res.status(403).send('Forbidden');
  }
  next();
}

/* ================================ Login ================================== */

// Satu halaman login untuk kedua role; role ditentukan otomatis dari kredensial yang cocok
// (ADMIN_USER/ADMIN_PASS atau STAFF_USER/STAFF_PASS) — tidak ada pilihan role di form.
app.get('/login', (req, res) => {
  const token = parseCookies(req).sid;
  const sess = token && sessions.get(token);
  if (sess && sess.expires > Date.now()) return res.redirect(302, sess.role === 'admin' ? '/admin' : '/admin/scan');
  res.send(view.login(res.locals.nonce, { error: req.query.error === '1' ? 'Username atau password salah.' : '' }));
});

app.post('/login', loginLimit, sameOriginOnly, parseForm, (req, res) => {
  const user = typeof req.body?.username === 'string' ? req.body.username : '';
  const pass = typeof req.body?.password === 'string' ? req.body.password : '';
  if (safeEqual(user, ADMIN_USER) && safeEqual(pass, ADMIN_PASS)) {
    startSession(res, 'admin');
    return res.redirect(303, '/admin'); // Admin -> Dashboard
  }
  if (STAFF_USER && safeEqual(user, STAFF_USER) && safeEqual(pass, STAFF_PASS)) {
    startSession(res, 'user');
    return res.redirect(303, '/admin/scan'); // User -> Kelola Tag
  }
  res.redirect(303, '/login?error=1');
});

// Menghapus sesi/token di server lalu kembali ke /login. Dipakai Admin maupun User.
app.post('/logout', sameOriginOnly, (req, res) => {
  endSession(req, res);
  res.redirect(303, '/login');
});

/* ================================ Admin ================================== */

const admin = express.Router();
admin.use(requireSession);

const TAGS_PAGE_SIZE = 20;

admin.get('/', requireAdmin, async (req, res) => {
  const [[s]] = await pool.query(
    "SELECT COUNT(*) AS total, COUNT(NULLIF(link_google, '')) AS filled, MAX(id) AS last FROM tags"
  );

  // Cari (ID atau link tujuan) + filter status, dipakai untuk tabel Daftar Tag di dashboard.
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  const status = req.query.status === 'aktif' || req.query.status === 'nonaktif' ? req.query.status : '';
  const where = [];
  const params = [];
  if (q) {
    where.push('(CAST(id AS CHAR) LIKE ? OR link_google LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (status === 'aktif') where.push("link_google IS NOT NULL AND link_google <> ''");
  if (status === 'nonaktif') where.push("(link_google IS NULL OR link_google = '')");
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[{ count: filteredTotal }]] = await pool.query(`SELECT COUNT(*) AS count FROM tags ${whereSql}`, params);
  const totalPages = Math.max(1, Math.ceil(filteredTotal / TAGS_PAGE_SIZE));
  const page = Math.min(Math.max(1, Number.parseInt(req.query.page, 10) || 1), totalPages);
  const [tags] = await pool.query(`SELECT id, link_google FROM tags ${whereSql} ORDER BY id ASC LIMIT ? OFFSET ?`, [
    ...params,
    TAGS_PAGE_SIZE,
    (page - 1) * TAGS_PAGE_SIZE,
  ]);

  const m = /^(\d{1,10})-(\d{1,10})$/.exec(String(req.query.baru ?? ''));
  res.send(
    view.admin(res.locals.nonce, {
      role: res.locals.role,
      total: Number(s.total),
      filled: Number(s.filled),
      baseUrl: BASE_URL,
      created: m ? [m[1], m[2]] : null,
      tags,
      q,
      status,
      page,
      totalPages,
      filteredTotal,
    })
  );
});

// Kelola Tag: aksi massal (buat ID baru, ekspor) — dipindah dari dashboard supaya dashboard tidak penuh.
admin.get('/kelola-tag', requireAdmin, async (req, res) => {
  const [[s]] = await pool.query('SELECT MAX(id) AS last FROM tags');
  const m = /^(\d{1,10})-(\d{1,10})$/.exec(String(req.query.baru ?? ''));
  res.send(
    view.kelolaTag(res.locals.nonce, {
      role: res.locals.role,
      last: Number(s.last) || 0,
      baseUrl: BASE_URL,
      created: m ? [m[1], m[2]] : null,
      limits: LIMITS,
    })
  );
});

// Generate ID baru: 1, 2, 3, ... dilanjutkan otomatis oleh AUTO_INCREMENT.
admin.post('/generate', requireAdmin, sameOriginOnly, parseForm, async (req, res) => {
  const n = Number.parseInt(req.body?.count, 10);
  if (!Number.isInteger(n) || n < 1 || n > LIMITS.generate) {
    return res.status(400).send(view.message(res.locals.nonce, 'Jumlah tidak valid', `Isi angka 1 sampai ${LIMITS.generate}.`, '/admin'));
  }
  const [r] = await pool.query(`INSERT INTO tags (link_google) VALUES ${Array(n).fill('(NULL)').join(',')}`);
  res.redirect(303, `/admin/kelola-tag?baru=${r.insertId}-${r.insertId + r.affectedRows - 1}`);
});

admin.get('/export.csv', requireAdmin, async (req, res) => {
  const ids = await pickIds(req, res, LIMITS.export);
  if (!ids) return;
  res.attachment(`url_${rangeOf(ids)}.csv`).send(csvOf(ids));
});

admin.get('/export.zip', requireAdmin, async (req, res) => {
  const ids = await pickIds(req, res, LIMITS.export);
  if (!ids) return;
  const pad = String(ids[ids.length - 1]).length; // 001.png, 002.png, ... agar urut di folder
  res.attachment(`qr_${rangeOf(ids)}.zip`);
  const zip = new Zip((err, chunk, final) => {
    if (err) return res.destroy(err);
    res.write(chunk);
    if (final) res.end();
  });
  const add = (name, data) => {
    const file = new ZipPassThrough(name); // PNG sudah terkompresi, cukup disimpan
    zip.add(file);
    file.push(data, true);
  };
  add('urls.csv', strToU8(csvOf(ids)));
  for (const id of ids) {
    if (res.destroyed) return; // klien membatalkan unduhan
    add(`qr/${String(id).padStart(pad, '0')}.png`, await qr.png(urlOf(id)));
  }
  zip.end();
});

admin.get('/print', requireAdmin, async (req, res) => {
  const ids = await pickIds(req, res, LIMITS.print);
  if (!ids) return;
  const out = [view.printHead(res.locals.nonce, { count: ids.length, label: rangeOf(ids) })];
  for (const id of ids) out.push(view.printCell(id, urlOf(id), await qr.svg(urlOf(id))));
  out.push(view.printFoot(res.locals.nonce));
  res.type('html').send(out.join(''));
});

// Kelola satu tag: lihat status saat ini, lalu ubah link atau kembalikan ke kondisi awal (kosong).
admin.get('/tag/:id', async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).send(view.message(res.locals.nonce, 'ID tidak valid', 'Nomor ID tidak dikenali.', '/admin'));
  const id = Number(req.params.id);
  const [rows] = await pool.query('SELECT link_google, whatsapp_number, created_at, updated_at FROM tags WHERE id = ?', [id]);
  if (!rows.length) return res.status(404).send(view.message(res.locals.nonce, 'Tag tidak ditemukan', `Tag ${id} tidak terdaftar.`, '/admin'));
  const ok = req.query.ok;
  const notice = ok === 'link' ? 'Link berhasil disimpan.' : ok === 'reset' ? 'Link berhasil dihapus. Tag kembali ke kondisi awal.' : '';
  res.send(
    view.tagManage(res.locals.nonce, {
      id,
      link: rows[0].link_google || '',
      whatsapp: rows[0].whatsapp_number || '',
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at,
      notice,
      role: res.locals.role,
    })
  );
});

// Ubah link tag (khusus admin, boleh menimpa yang sudah ada — beda dari form publik yang hanya sekali isi).
admin.post('/tag/:id/link', sameOriginOnly, parseForm, async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).send(view.message(res.locals.nonce, 'ID tidak valid', 'Nomor ID tidak dikenali.', '/admin'));
  const id = Number(req.params.id);
  const [rows] = await pool.query('SELECT created_at, updated_at FROM tags WHERE id = ?', [id]);
  if (!rows.length) return res.status(404).send(view.message(res.locals.nonce, 'Tag tidak ditemukan', `Tag ${id} tidak terdaftar.`, '/admin'));
  const rawLink = typeof req.body?.link_google === 'string' ? req.body.link_google.trim() : '';
  const rawWa = typeof req.body?.whatsapp_number === 'string' ? req.body.whatsapp_number.trim() : '';
  const link = rawLink ? cleanLink(rawLink) : null;
  const wa = rawWa ? cleanWaNumber(rawWa) : null;
  const error = rawLink && !link
    ? 'Link Google tidak bisa dipakai. Gunakan link dari Google, misalnya google.com, g.page, atau maps.app.goo.gl.'
    : rawWa && !wa
    ? 'Nomor WhatsApp tidak valid. Gunakan format 08xxxxxxxxxx atau +62xxxxxxxxxx.'
    : '';
  if (error) {
    return res.status(400).send(
      view.tagManage(res.locals.nonce, {
        id,
        link: rawLink,
        whatsapp: rawWa,
        createdAt: rows[0].created_at,
        updatedAt: rows[0].updated_at,
        error,
        role: res.locals.role,
      })
    );
  }
  await pool.query('UPDATE tags SET link_google = ?, whatsapp_number = ?, updated_at = NOW() WHERE id = ?', [link, wa, id]);
  res.redirect(303, `/admin/tag/${id}?ok=link`);
});

// Kembalikan tag ke kondisi awal (kosong), persis seperti sebelum diaktivasi — setara fix manual lewat SQL di README.
admin.post('/tag/:id/reset', sameOriginOnly, parseForm, async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).send(view.message(res.locals.nonce, 'ID tidak valid', 'Nomor ID tidak dikenali.', '/admin'));
  const id = Number(req.params.id);
  const [r] = await pool.query('UPDATE tags SET link_google = NULL, whatsapp_number = NULL, updated_at = NULL WHERE id = ?', [id]);
  if (!r.affectedRows) return res.status(404).send(view.message(res.locals.nonce, 'Tag tidak ditemukan', `Tag ${id} tidak terdaftar.`, '/admin'));
  res.redirect(303, `/admin/tag/${id}?ok=reset`);
});

// Halaman scan QR: kamera + pembacaan QR berjalan di browser (lihat views.js: tagScan).
// Hasil baca dicocokkan ke pola urlOf()/isId() yang sama dipakai rute-rute admin lain di atas.
admin.get('/scan', (req, res) => {
  res.send(view.tagScan(res.locals.nonce, { baseUrl: BASE_URL, role: res.locals.role }));
});

// Dipanggil lewat fetch() dari halaman scan: cek cepat apakah ID hasil scan terdaftar,
// tanpa pindah halaman dulu, supaya "tag tidak ditemukan" bisa tampil dengan tombol Scan ulang.
// Tag yang ditemukan tetap dibuka lewat /admin/tag/:id yang sudah ada (bukan alur baru).
admin.get('/scan/check/:id', async (req, res) => {
  if (!isId(req.params.id)) return res.json({ found: false });
  const [rows] = await pool.query('SELECT 1 FROM tags WHERE id = ? LIMIT 1', [Number(req.params.id)]);
  res.json({ found: rows.length > 0 });
});

// Pustaka pembaca QR (jsQR, sudah dipasang lewat npm) untuk halaman /admin/scan.
admin.get('/lib/jsQR.js', (req, res) => res.sendFile(path.join(__dirname, 'node_modules/jsqr/dist/jsQR.js')));

app.use('/admin', admin);

/* ============================ URL unik: /{id} ============================ */

// Scan QR / tap NFC: link kosong -> tampilkan form, sudah terisi -> redirect.
app.get('/:id', async (req, res, next) => {
  if (!isId(req.params.id)) return next();
  const [rows] = await pool.query('SELECT link_google, whatsapp_number FROM tags WHERE id = ?', [Number(req.params.id)]);
  if (!rows.length) return next();
  const { link_google, whatsapp_number } = rows[0];
  if (!link_google && !whatsapp_number) return res.send(view.form(res.locals.nonce, { id: req.params.id }));
  res.send(view.ratingPage(res.locals.nonce, { id: req.params.id }));
});

app.post('/:id', submitLimit, parseForm, async (req, res, next) => {
  if (!isId(req.params.id)) return next();
  const id = Number(req.params.id);
  const rawLink = typeof req.body?.link_google === 'string' ? req.body.link_google.trim() : '';
  const rawWa = typeof req.body?.whatsapp_number === 'string' ? req.body.whatsapp_number.trim() : '';
  const link = rawLink ? cleanLink(rawLink) : null;
  const wa = rawWa ? cleanWaNumber(rawWa) : null;
  const error = rawLink && !link
    ? 'Link Google tidak bisa dipakai. Gunakan link dari Google, misalnya google.com, g.page, atau maps.app.goo.gl.'
    : rawWa && !wa
    ? 'Nomor WhatsApp tidak valid. Gunakan format 08xxxxxxxxxx atau +62xxxxxxxxxx.'
    : !link && !wa
    ? 'Isi minimal salah satu: link Google atau nomor WhatsApp.'
    : '';
  if (error) {
    return res.status(400).send(view.form(res.locals.nonce, { id, value: rawLink, wa: rawWa, error }));
  }
  // Hanya mengisi kolom yang masih kosong: tidak menimpa data yang sudah ada, aman dari balapan (race).
  await pool.query(
    "UPDATE tags SET link_google = ?, whatsapp_number = ?, updated_at = NOW() WHERE id = ? AND (link_google IS NULL OR link_google = '') AND (whatsapp_number IS NULL OR whatsapp_number = '')",
    [link, wa, id]
  );
  res.redirect(303, `/${id}`); // GET berikutnya menampilkan halaman rating
});

// Halaman rating memilih tujuan: 1-3 -> WhatsApp Admin (pesan otomatis terisi), 4-5 -> Google Review.
app.get('/:id/rate/:rating', submitLimit, async (req, res, next) => {
  if (!isId(req.params.id) || !/^[1-5]$/.test(req.params.rating)) return next();
  const id = Number(req.params.id);
  const rating = Number(req.params.rating);
  const note = cleanNote(typeof req.query.note === 'string' ? req.query.note : '');
  const [rows] = await pool.query('SELECT link_google, whatsapp_number FROM tags WHERE id = ?', [id]);
  if (!rows.length) return next();
  const { link_google, whatsapp_number } = rows[0];

  if (rating >= 4) {
    if (link_google) return res.redirect(302, link_google);
    return res.send(view.message(res.locals.nonce, 'Belum dikonfigurasi', 'Tag ini belum memiliki link Google Review.'));
  }
  if (whatsapp_number) return res.redirect(302, waLinkOf(whatsapp_number, rating, note));
  if (link_google) return res.redirect(302, link_google); // fallback: nomor WhatsApp belum diisi
  res.send(view.message(res.locals.nonce, 'Belum dikonfigurasi', 'Tag ini belum memiliki tujuan yang aktif.'));
});

/* ============================ 404 dan error ============================== */

app.use((req, res) => {
  res.status(404).send(view.message(res.locals.nonce, 'Halaman tidak ditemukan', 'Nomor tag ini tidak terdaftar. Periksa kembali QR atau NFC yang dipindai.'));
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return res.destroy();
  res.status(500).send(view.message(res.locals.nonce, 'Terjadi kesalahan', 'Coba lagi beberapa saat.'));
});

/* ================================ Start ================================== */

(async () => {
  try {
    await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')); // buat tabel bila belum ada
  } catch (err) {
    console.error('[database] Gagal terhubung/menyiapkan tabel:', err.message);
    process.exit(1);
  }
  // Migrasi aman untuk database lama: tambah kolom whatsapp_number bila belum ada.
  // Butuh privilege ALTER pada user DB; jika tidak ada, hanya dicatat sebagai peringatan (tidak menghentikan aplikasi).
  try {
    await pool.query('ALTER TABLE tags ADD COLUMN whatsapp_number VARCHAR(20) NULL DEFAULT NULL AFTER link_google');
  } catch (err) {
    if (err.code !== 'ER_DUP_FIELDNAME') {
      console.error('[database] Migrasi whatsapp_number gagal (jalankan ALTER manual atau GRANT ALTER bila perlu):', err.message);
    }
  }
  app.listen(PORT, HOST, () => console.log(`Berjalan di http://${HOST}:${PORT} (URL publik: ${BASE_URL})`));
})();
