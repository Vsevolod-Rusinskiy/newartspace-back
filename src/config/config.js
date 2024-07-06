const path = require('path');
const dotenvPath = path.resolve(__dirname, '../../.env');

require('dotenv').config({ path: dotenvPath });

module.exports = {
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_NAME,
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    dialect: process.env.SQL_DIALECT,
    logging: process.env.SQL_LOGGING === 'true'
};
