-- Struktur database QR + NFC.
-- Dijalankan otomatis saat aplikasi start (aman diulang), atau impor manual
-- lewat phpMyAdmin / mysql CLI.
--
-- id          : 1, 2, 3, ... otomatis. Menjadi bagian akhir URL: https://domain.com/{id}
-- link_google : NULL atau kosong = belum diisi (tampil form). Terisi = redirect.

CREATE TABLE IF NOT EXISTS tags (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  link_google     VARCHAR(2048) NULL DEFAULT NULL,
  whatsapp_number VARCHAR(20)   NULL DEFAULT NULL, -- format wa.me, mis. 628123456789
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NULL DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
