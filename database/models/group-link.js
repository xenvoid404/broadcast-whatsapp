const { DataTypes } = require('sequelize');
const { sequelize } = require('../setup.js');

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

module.exports = { GroupLink };
