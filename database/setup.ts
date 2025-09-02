import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'db.sqlite',
    logging: false
});

sequelize
    .sync()
    .then(() => console.log('Database ready!'))
    .catch(e => console.error('Gagal menyiapkan database: ', e));
