// config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

// Cria o pool de conexões com as configurações do .env
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10, // Limite de conexões no pool
    queueLimit: 0
});

console.log("Pool de conexões com o banco de dados criado com sucesso.");

// Exporta o pool para que outros arquivos possam usá-lo para fazer queries
module.exports = pool;