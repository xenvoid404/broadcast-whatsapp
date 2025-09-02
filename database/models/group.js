import { DataTypes } from 'sequelize';
import { sequelize } from '../setup.js';

export const Group = sequelize.define('group', {
    link: {
        type: DataTypes.STRING,
        allowNull: false
    },
    sent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
});
