const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'database.sqlite',
    logging: false
});

const GroupLink = sequelize.define('GroupLink', {
    link: {
        type: DataTypes.STRING,
        allowNull: false
    },
    is_sent_to_admin: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
});

sequelize
    .sync()
    .then(() => console.log('Database dan tabel sudah siap!'))
    .catch(err => console.error('Gagal menyiapkan database: ', err));

module.exports = { GroupLink };
