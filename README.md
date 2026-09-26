# QR + NFC — Sistem Tag Sederhana

Setiap tag punya ID otomatis (1, 2, 3, …) dan satu URL tetap: `https://domain.com/{id}`.
URL yang sama dipakai untuk QR Code dan NFC.

## Cara kerja

- Buka `/{id}` (scan QR / tap NFC):
  - link Google masih kosong → tampil form untuk mengisi link
  - sudah terisi → langsung diteruskan (redirect) ke link Google
- Link hanya bisa diisi **sekali** lewat form publik dan tidak bisa ditimpa (admin bisa menggantinya atau
  mengembalikannya ke kondisi awal lewat `/admin`, lihat bagian Pemakaian). Hanya link Google yang diterima
  (daftar domain diatur di `ALLOWED_HOSTS`).
- `/admin` (login Basic Auth, 2 role — lihat bagian Keamanan): buat ID, kelola tag lewat scan QR (ubah link
  atau kembalikan ke kondisi awal), ekspor CSV, ekspor ZIP QR (PNG), lembar cetak.

## Kebutuhan

Node.js 18+ (diuji di Node 22) dan MySQL / MariaDB (diuji di MariaDB 10.11).

## Instalasi — cara termudah (satu perintah)

Untuk **VPS / server baru Ubuntu 24.04 atau Debian 12** dengan akses root. Siapkan dulu sebuah domain, lalu arahkan
(A record) ke IP server.

1. Salin folder `qr-nfc` ke server. Contoh, unggah `qr-nfc.zip` lewat FileZilla/WinSCP, lalu di server:

   ```bash
   apt-get install -y unzip && unzip qr-nfc.zip
   ```

2. Jalankan skrip pemasang (ganti `domain.com` dengan domain Anda):

   ```bash
   cd qr-nfc
   sudo bash install.sh domain.com
   ```

3. Selesai. Skrip menampilkan alamat admin, username, dan password. Buka `https://domain.com/admin`.

Yang dikerjakan skrip: memasang Node.js, MariaDB dan Caddy; membuat database + user dengan sandi acak; mengisi `.env`;
menjalankan aplikasi sebagai layanan yang hidup otomatis saat server menyala; dan mengaktifkan HTTPS otomatis
(butuh port 80 dan 443 terbuka, serta DNS domain sudah mengarah ke server). Aman dijalankan ulang: `.env` dan data
tidak ditimpa. Aplikasi terpasang di `/opt/qr-nfc`.

Jika di server itu sudah ada Nginx/Apache, atau Anda memakai sistem lain, pakai cara manual di bawah.

## Instalasi manual

**1. Buat database dan user** (jalankan di `mysql` sebagai root):

```sql
CREATE DATABASE qrnfc CHARACTER SET utf8mb4;
CREATE USER 'qrnfc'@'localhost' IDENTIFIED BY 'GANTI_PASSWORD_DB';
GRANT SELECT, INSERT, UPDATE, CREATE ON qrnfc.* TO 'qrnfc'@'localhost';
```

Tabel dibuat otomatis saat aplikasi start (`schema.sql`, aman diulang). Bisa juga diimpor manual.

**2. Pasang dan atur konfigurasi:**

```bash
npm install --omit=dev
cp .env.example .env
nano .env        # isi BASE_URL, ADMIN_USER, ADMIN_PASS (min. 10 karakter), DB_*, dan STAFF_USER/STAFF_PASS (opsional)
```

**3. Jalankan:**

```bash
npm start
```

Buka `https://domain.com/admin`.

## Produksi (pemasangan manual)

Bagian ini sudah dikerjakan otomatis oleh `install.sh`; baca hanya jika Anda memasang manual.

Aplikasi hanya mendengarkan `127.0.0.1` (port di `.env`, default 3000). Pasang reverse proxy dengan **HTTPS**
di depannya — wajib, karena login admin memakai Basic Auth. Lalu set `TRUST_PROXY=1` di `.env` agar batas percobaan
per IP membaca IP pengunjung yang asli.

Caddy (HTTPS otomatis), `Caddyfile`:

```
domain.com {
    reverse_proxy 127.0.0.1:3000
}
```

Nginx (sertifikat, mis. dari certbot):

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Agar jalan terus dan hidup lagi setelah reboot — pilih salah satu:

```bash
# PM2 (jalankan dari folder aplikasi)
npm i -g pm2 && pm2 start server.js --name qr-nfc && pm2 save && pm2 startup
```

```ini
# atau systemd: /etc/systemd/system/qr-nfc.service  (lalu: systemctl enable --now qr-nfc)
[Unit]
Description=QR NFC
After=network.target mariadb.service

[Service]
WorkingDirectory=/opt/qr-nfc
ExecStart=/usr/bin/node server.js
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

## Pemakaian

1. `/admin` → isi jumlah → **Generate**. ID dilanjutkan otomatis dari ID terakhir.
2. Ekspor (bisa dibatasi dengan "Dari ID" / "Sampai ID"):
   - **CSV** — kolom `id,url`. Dipakai sebagai daftar URL untuk NFC Bulk Writer / NFC Tools (tulis sebagai record URL).
   - **ZIP** — `qr/00001.png, qr/00002.png, …` (jumlah angka nol mengikuti ID terbesar) ditambah `urls.csv`.
   - **Cetak** — halaman siap cetak berisi QR dan nomor ID.
3. Batas per permintaan: generate 10.000 ID, ekspor 20.000 ID, cetak 1.000 ID.
4. Domain (`BASE_URL`) tertanam di setiap QR/NFC. Pastikan sudah final sebelum mencetak atau menulis tag.

Link yang salah isi bisa diperbaiki langsung dari `/admin` (form publik sendiri tetap tidak bisa menimpa
link yang sudah ada):

- Buka `/admin` (role user langsung ke `/admin/scan`) → bagian **Kelola tag** → **Scan QR** → arahkan kamera
  ke QR pada tag. Tag langsung terbuka, tanpa mengetik ID.
- **Simpan link** mengisi atau mengganti link yang tertaut ke tag itu (hanya link Google yang diterima, sama
  seperti form publik).
- **Hapus link (reset)** mengembalikan tag ke kondisi awal (kosong) — pemindaian QR/NFC berikutnya akan
  menampilkan form pengisian lagi, seolah tag itu belum pernah diaktivasi.

Cara manual lewat SQL berikut masih bisa dipakai bila perlu, misalnya untuk mengosongkan banyak ID sekaligus:

```sql
UPDATE tags SET link_google = NULL, updated_at = NULL WHERE id = 5;
```

## Deploy gratis tanpa VPS (alternatif)

Tidak punya VPS? Aplikasi ini bisa dijalankan di layanan **PaaS gratis** + database MySQL cloud
gratis, tanpa perlu beli domain (pakai subdomain bawaan platform, mis. `*.onrender.com`):

1. Push folder ini ke repo GitHub (`node_modules` dan `.env` asli sudah otomatis diabaikan
   lewat `.gitignore` — jangan pernah commit `.env` yang berisi password asli).
2. Buat database MySQL gratis (mis. di Aiven, https://aiven.io/free-mysql-database — tidak
   perlu kartu kredit). Catat host, port, user, password, dan nama database yang diberikan.
3. Di penyedia PaaS (mis. Render, https://render.com), buat **Web Service** baru dari repo
   tadi. Build command: `npm install --omit=dev`. Start command: `npm start`.
4. Isi environment variables di dashboard PaaS sesuai `env.example`, dengan tambahan/nilai:
   - `HOST=0.0.0.0`
   - `BASE_URL=` URL yang diberikan platform (mis. `https://nama-app.onrender.com`)
   - `TRUST_PROXY=1`
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` sesuai data dari langkah 2
   - `DB_SSL=1` (koneksi ke database cloud lewat internet publik, bukan localhost)
5. Deploy, lalu buka `https://nama-app.onrender.com/admin`.

Catatan: tier gratis kebanyakan PaaS "tidur" setelah beberapa menit tanpa trafik, sehingga
kunjungan pertama setelah tidur terasa lambat (bisa ~30–60 detik). Untuk penggunaan yang harus
selalu responsif tanpa jeda sama sekali, VPS (bagian atas, mis. Oracle Cloud Always Free) lebih
cocok karena prosesnya menyala terus.

## Keamanan (ringkas)

- Login: Basic Auth dengan 2 role — ADMIN (semua fitur) dan USER (opsional, lewat STAFF_USER/STAFF_PASS;
  hanya Kelola Tag). Perbandingan password aman waktu; rute khusus admin dicek ulang di server (bukan hanya
  disembunyikan di tampilan); maksimal 10 percobaan gagal / 15 menit per IP.
- Form publik: maksimal 30 kiriman / 15 menit per IP; hanya `http(s)` ke domain Google; link berisi user:password ditolak.
- Pengisian link dijamin sekali walau ada kiriman bersamaan (`UPDATE ... WHERE link_google IS NULL`).
- Aksi POST admin menolak permintaan lintas situs (CSRF).
- Tidak ada input pengguna yang disisipkan langsung ke SQL; semua keluaran HTML di-escape; CSP dengan nonce, tanpa `unsafe-inline`.
- Jangan commit atau bagikan file `.env`.
