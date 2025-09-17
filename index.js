// meu-backend/index.js - VERSÃO COM CORREÇÃO DO ERRO PathError

// --- 1. IMPORTAÇÕES ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- 2. CONFIGURAÇÃO INICIAL ---
const app = express();

// --- CONFIGURAÇÃO DE CORS ---
const whitelist = [
    'https://rifeionlineapp.netlify.app',
    'http://localhost:5173',
    'https://rifeionline.com.br'
];
const corsOptions = {
    origin: function (origin, callback) {
        if (whitelist.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Acesso não permitido pela política de CORS'));
        }
    }
};

// REMOVEMOS a linha app.options('*', ...) que causava o crash.
// A linha abaixo é suficiente para lidar com todas as requisições, incluindo as de preflight (OPTIONS).
app.use(cors(corsOptions));
app.use(express.json());

// --- CONFIGURAÇÃO DO BANCO ---
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

// --- 3. ENDPOINTS DA API ---
// (O restante do seu código permanece exatamente o mesmo)
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'API RifeiOnline no ar! (Hospedado na Render)',
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

app.post('/register-admin', async (req, res) => {
    // seu código de registro...
});

app.post('/login', async (req, res) => {
    // seu código de login...
});


// --- 4. INICIALIZAÇÃO DO SERVIDOR ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
});