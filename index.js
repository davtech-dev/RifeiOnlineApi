// meu-backend/index.js

// --- 1. IMPORTAÇÕES ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- 2. CONFIGURAÇÃO INICIAL ---
const app = express();
const PORT = process.env.PORT || 3001;

// --- CONFIGURAÇÃO DE CORS ROBUSTA ---
// Lista de domínios que têm permissão para acessar esta API
const whitelist = [
    'https://rifeionlineapp.netlify.app', // Seu frontend em produção
    'http://localhost:5173', // Seu frontend em desenvolvimento local
    'https://rifeionline.com.br' // URL original que você adicionou
];

const corsOptions = {
    origin: function (origin, callback) {
        // Permite requisições se a origem estiver na whitelist ou se não houver origem (ex: Postman)
        if (whitelist.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Acesso não permitido pela política de CORS'));
        }
    }
};

// --- ALTERAÇÃO IMPORTANTE ---
// Habilita a resposta para as requisições "preflight" (OPTIONS) em todas as rotas.
// O navegador envia isso antes de requisições como POST ou PUT para verificar as permissões de CORS.
// Esta linha é crucial para resolver o erro.
app.options('*', cors(corsOptions));

// Aplica o middleware do CORS para todas as outras requisições (GET, POST, etc.)
app.use(cors(corsOptions));

// Middleware para interpretar o corpo das requisições como JSON
app.use(express.json());

// Configuração da conexão com o banco de dados
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
        message: 'API RifeiOnline no ar!',
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

app.post('/register-admin', async (req, res) => {
    // ... seu código de registro
    const { name, email, password } = req.body;
    if (!name || !email || !password) { return res.status(400).json({ error: 'Todos os campos são obrigatórios.' }); }
    let connection;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        connection = await mysql.createConnection(dbConfig);
        await connection.execute('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hashedPassword, 'admin']);
        res.status(201).json({ message: 'Usuário admin criado com sucesso!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') { return res.status(409).json({ error: 'Este email já está em uso.' }); }
        res.status(500).json({ error: 'Erro no servidor ao registrar.' });
    } finally {
        if (connection) await connection.end();
    }
});

app.post('/login', async (req, res) => {
    // ... seu código de login
    const { email, password } = req.body;
    if (!email || !password) { return res.status(400).json({ error: 'Email e senha são obrigatórios.' }); }
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) { return res.status(401).json({ error: 'Credenciais inválidas.' }); }
        const user = rows[0];
        if (user.role !== 'admin') { return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' }); }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) { return res.status(401).json({ error: 'Credenciais inválidas.' }); }
        const tokenPayload = { id: user.id, role: user.role };
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'SEGREDO_PADRAO_PARA_TESTES', { expiresIn: '8h' });
        delete user.password;
        res.status(200).json({ message: "Login bem-sucedido!", token: token, user: user });
    } catch (error) {
        console.error("Erro no processo de login:", error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    } finally {
        if (connection) await connection.end();
    }
});

// --- 4. EXPORTAÇÃO PARA A NETLIFY ---
module.exports = app;