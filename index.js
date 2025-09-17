// meu-backend/index.js - VERSÃO COMPLETA COM LÓGICA DE REGISTRO E LOGIN

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

app.get('/', (req, res) => {
    res.status(200).json({
        message: 'API RifeiOnline no ar! (Hospedado na Render)',
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// --- ENDPOINT DE REGISTRO DE ADMIN ---
app.post('/register-admin', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Todos os campos (nome, email, senha) são obrigatórios.' });
    }

    let connection;
    try {
        // Criptografa a senha antes de salvar
        const hashedPassword = await bcrypt.hash(password, 10);
        
        connection = await mysql.createConnection(dbConfig);
        
        // Insere o usuário com a senha criptografada e o role 'admin'
        await connection.execute(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, 'admin']
        );
        
        res.status(201).json({ message: 'Usuário admin criado com sucesso!' });
    } catch (error) {
        // Trata o erro de email duplicado
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Este email já está em uso.' });
        }
        console.error('Erro ao registrar admin:', error);
        res.status(500).json({ error: 'Erro no servidor ao registrar.' });
    } finally {
        if (connection) await connection.end();
    }
});

// --- ENDPOINT DE LOGIN ---
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        
        // 1. Busca o usuário pelo email
        const [rows] = await connection.execute('SELECT * FROM users WHERE email = ?', [email]);
        
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const user = rows[0];

        // 2. Verifica se o usuário é um admin
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        // 3. Compara a senha enviada com a senha criptografada no banco
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        // 4. Gera o Token JWT
        const tokenPayload = { id: user.id, role: user.role };
        const token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET || 'SEGREDO_SUPER_SECRETO',
            { expiresIn: '8h' }
        );
        
        // 5. Remove a senha antes de enviar a resposta
        delete user.password;

        res.status(200).json({
            message: "Login bem-sucedido!",
            token: token,
            user: user
        });

    } catch (error) {
        console.error("Erro no processo de login:", error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    } finally {
        if (connection) await connection.end();
    }
});


// --- 4. INICIALIZAÇÃO DO SERVIDOR ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
});