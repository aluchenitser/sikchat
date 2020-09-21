const { DataTypes } = require('sequelize');

exports.defineUsers = (sequelize) => {
    let definitions = {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        user_name: {
            type: DataTypes.STRING(20),
            unique: true,
        },
        real_name: DataTypes.STRING,
        password: DataTypes.STRING(12),
        role: {
            type: DataTypes.STRING,
            allowNull: true
        },
        email: {
            type: DataTypes.STRING(255),
            unique: true
        },
        answered: {
            type: DataTypes.INTEGER,
            min: 0
        },
        total_points: {
            type: DataTypes.INTEGER,
            min: 0
        }
    }

    return sequelize.define(
        'users', 
        definitions, 
        { 
            freezeTableName: true
        }
    )
}