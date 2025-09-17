// db.js
require('dotenv').config();
const mysql = require('mysql2/promise');

// Configuração do pool de conexões
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Exporta o pool para que possa ser usado em outros arquivos
module.exports = pool;
