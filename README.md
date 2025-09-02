
# WhatsApp Bot BC

Bot WhatsApp untuk broadcast pesan ke semua grup yang diikuti.

## Fitur

- Mengumpulkan link grup WhatsApp secara otomatis dari pesan yang masuk.
- Mengirimkan kumpulan link grup ke nomor admin jika sudah mencapai batas tertentu.
- Broadcast pesan teks ke semua grup yang diikuti.
- Penjadwalan broadcast pesan.

## Instalasi

1. Clone repositori ini
2. Install dependensi dengan `pnpm install`
3. Buat file `.env` dari contoh `.env.example` dan sesuaikan isinya.
4. Jalankan aplikasi dengan `pnpm start`

## Perintah

- `pnpm start`: Menjalankan aplikasi
- `pnpm dev`: Menjalankan aplikasi dengan `nodemon` (untuk development)
