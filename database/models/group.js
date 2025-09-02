import { DataTypes } from 'sequelize';
import { sequelize } from '../setup.js';

export const Group = sequelize.define('group', {
    link: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isUrl: true,
            isWhatsappGroupLink(value) {
                if (!value.startsWith('https://chat.whatsapp.com/')) {
                    throw new Error('Link harus merupakan link grup WhatsApp');
                }
            }
        }
    },
    sent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
});
