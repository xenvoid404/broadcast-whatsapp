import { Sequelize } from 'sequelize';

// Untuk production, disarankan menggunakan database seperti PostgreSQL atau MySQL.
// Konfigurasi di bawah ini akan menggunakan PostgreSQL jika NODE_ENV diatur ke 'production'.
export const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'database/db.sqlite',
    logging: false
});

sequelize
    .authenticate()
    .then(() => {
        console.log('Koneksi database berhasil.');
        return sequelize.sync();
    })
    .then(() => {
        console.log('Database siap!');
    })
    .catch(err => {
        console.error('Tidak dapat terhubung ke database:', err);
        process.exit(1);
    });
