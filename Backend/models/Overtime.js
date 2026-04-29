import { Sequelize } from 'sequelize';
import db from '../config/Database.js';
import DataPegawai from './DataPegawaiModel.js';

const { DataTypes } = Sequelize;

const Overtime = db.define('overtime_entries', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    employeeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: DataPegawai,
            key: 'id'
        }
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    hours: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
            max: 6
        }
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            len: [10, 1000]
        }
    },
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending'
    },
    approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    approvedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    freezeTableName: true
});

DataPegawai.hasMany(Overtime, {
    foreignKey: 'employeeId',
    as: 'overtimeEntries'
});

Overtime.belongsTo(DataPegawai, {
    foreignKey: 'employeeId',
    as: 'employee'
});

export default Overtime;
