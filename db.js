const { Sequelize } = require('sequelize')
const os = require('os')

module.exports = new Sequelize(
    process.env.DB_NAME,
    os.platform() === 'linux' ? process.env.DB_USER_LINUX : process.env.DB_USER,
    os.platform() === 'linux' ? process.env.DB_PASSWORD_LINUX : process.env.DB_PASSWORD,
    {
        dialect: 'postgres',
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        // dialectOptions: {
        //     ssl: true
        // }
    }
)