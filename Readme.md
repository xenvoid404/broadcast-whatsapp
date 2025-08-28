# 📢 Broadcast WhatsApp Bot

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-v22%2B-green?logo=node.js)](https://nodejs.org/)
[![Baileys](https://img.shields.io/badge/Baileys-WhatsApp%20API-blue)](https://github.com/WhiskeySockets/Baileys)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

Bot WhatsApp otomatis berbasis [Baileys](https://github.com/WhiskeySockets/Baileys) untuk menyimpan link grup dan broadcast ke semua grup WhatsApp.

</div>

---

## ✨ Fitur Utama

-   🔍 **Deteksi Otomatis**: Mendeteksi dan menyimpan link grup WhatsApp (`chat.whatsapp.com`) dari pesan masuk (grup dan personal) untuk kebutuhan broadcast ataupun promosi.
-   📤 **Notifikasi Admin**: Mengirim link yang terkumpul ke admin, ketika sudah mencapai ambang batas.
-   📢 **Broadcast Massal**: Mengirim pesan teks ke semua grup yang tergabung.
-   🛡️ **Anti Spam**: Delay acak antar pengiriman untuk menghindari deteksi spam.
-   ⏰ **Broadcast Terjadwal**: Mengirim pesan otomatis berdasarkan jadwal yang telah ditentukan.

---

## 🛠️ Tech Stack

<div align="center">
  
![Node.js](https://img.shields.io/badge/-Node.js-339933?logo=node.js&logoColor=white)
![Baileys](https://img.shields.io/badge/-Baileys-25D366?logo=whatsapp&logoColor=white)
![Sequelize](https://img.shields.io/badge/-Sequelize-52B0E7?logo=sequelize&logoColor=white)
![SQLite](https://img.shields.io/badge/-SQLite-003B57?logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/-Docker-2496ED?logo=docker&logoColor=white)

</div>

---

## 📦 Instalasi

### 🚀 Instalasi Manual

#### 1️⃣ Clone Repository

```bash
git clone https://github.com/xenvoid404/broadcast-whatsapp.git
cd broadcast-whatsapp
```

#### 2️⃣ Install Dependencies

> **💡 Tip**: Gunakan PNPM untuk performa yang lebih baik!

PNPM (Recommended)

```bash
pnpm install
```

NPM

```bash
npm install
```

Yarn

```bash
yarn install
```

#### 3️⃣ Konfigurasi Environment

Buat file `.env` di root directory:

```env
# 🔑 Konfigurasi Admin
ADMIN_JID=628xxxxxxxxxx@s.whatsapp.net

# 📊 Pengaturan Threshold
GROUP_THRESHOLD=5

# ⏰ Pengaturan Delay (milliseconds)
DELAY_MIN=10000
DELAY_MAX=60000

# 🕰️ Broadcast Terjadwal
# Format: menit jam tanggal bulan hari_dalam_minggu
BROADCAST_SCHEDULE_1="0 8 * * *"          # Setiap hari jam 08:00
BROADCAST_MESSAGE_FILE_1="messages/promo_pagi.txt"

BROADCAST_SCHEDULE_2="0 17 * * *"         # Setiap hari jam 17:00
BROADCAST_MESSAGE_FILE_2="messages/promo_sore.txt"
```

> **📋 Penjelasan Variabel:**
>
> -   `ADMIN_JID`: Nomor WhatsApp admin (format JID)
> -   `GROUP_THRESHOLD`: Jumlah link minimal sebelum dikirim ke admin
> -   `DELAY_MIN/MAX`: Range delay acak antar broadcast
> -   `BROADCAST_SCHEDULE_*`: Jadwal broadcast otomatis menggunakan cron format
> -   `BROADCAST_MESSAGE_FILE_*`: Path ke file pesan untuk broadcast terjadwal

#### 4️⃣ Jalankan Bot

```bash
pnpm start    # atau npm start / yarn start
```

---

### 🐳 Instalasi via Docker

#### 1️⃣ Build & Run Container

```bash
docker compose up -d --build
```

#### 2️⃣ Verifikasi Container

```bash
docker ps
docker logs -f broadcast-whatsapp
```

> **⚠️ Penting**: Pastikan file `.env` sudah ada di direktori root sebelum menjalankan Docker!

---

## 📁 Struktur Project

```
broadcast-whatsapp/
├── 📁 auth/                    # Sesi login Baileys (auto-generated)
├── 📁 messages/                # File pesan untuk broadcast terjadwal
├── 📄 app.js                  # Entry point utama
├── 📄 GroupLink.js            # Model database Sequelize
├── 📄 .env                    # Konfigurasi environment
├── 📄 Dockerfile              # Docker build configuration
├── 📄 docker-compose.yml      # Docker compose setup
├── 📄 package.json            # Dependencies & scripts
└── 📄 README.md               # Dokumentasi ini
```

---

## 🔄 Workflow Save Link Grup

1. **Pesan Masuk** → Bot menerima pesan baru
2. **Cek Link Grup** → Apakah mengandung link grup WhatsApp?
    - ✅ **Ya**: Lanjut ke step 3
    - ❌ **Tidak**: Abaikan pesan
3. **Simpan ke Database** → Link grup disimpan (jika belum ada)
4. **Cek Threshold** → Apakah jumlah link ≥ batas yang ditentukan?
    - ✅ **Ya**: Kirim semua link ke admin
    - ❌ **Tidak**: Tunggu link berikutnya
5. **Reset Counter** → Setelah dikirim ke admin, reset penghitung

### 🧲 Contoh Link yang Terdeteksi

```
https://chat.whatsapp.com/ABCdefGHIjklMNOpqrstuv
https://chat.whatsapp.com/XYZ123abc456DEF789ghi
```

---

## 🤝 Berkontribusi

Kami terbuka untuk kontribusi! Beberapa ide pengembangan:

-   🖼️ Broadcast media (gambar/dokumen)
-   🗃️ Dukungan database eksternal (PostgreSQL/MySQL)
-   📢 Auto broadcast dengan cron

**Langkah kontribusi:**

1. **Fork** repository ini
2. **Create** branch fitur (`git checkout -b feature/AmazingFeature`)
3. **Commit** perubahan (`git commit -m 'Add some AmazingFeature'`)
4. **Push** ke branch (`git push origin feature/AmazingFeature`)
5. **Open** Pull Request

---

## 📊 Stats

<div align="center">

![GitHub stars](https://img.shields.io/github/stars/xenvoid404/broadcast-whatsapp?style=social)
![GitHub forks](https://img.shields.io/github/forks/xenvoid404/broadcast-whatsapp?style=social)
![GitHub issues](https://img.shields.io/github/issues/xenvoid404/broadcast-whatsapp)
![GitHub pull requests](https://img.shields.io/github/issues-pr/xenvoid404/broadcast-whatsapp)

</div>

---

## 📜 Lisensi

Distributed under the [MIT License](LICENSE). See `LICENSE` for more information.

```
MIT License - Bebas digunakan, dimodifikasi, dan dibagikan.
Jangan lupa berikan atribusi yang sesuai! 🙏
```

---

## 👨‍💻 Author

<div align="center">

**🛰️ Xenvoid 404**

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/xenvoid404)

</div>

---

<div align="center">

**⭐ Jika project ini membantu, berikan star ya! ⭐**

**💬 Ada pertanyaan? Silakan buka [Issues](https://github.com/xenvoid404/broadcast-whatsapp/issues)**

---

_Made with ❤️ by Xenvoid 404_

</div>