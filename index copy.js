// routes/admin.js
const express = require('express');
const router = express.Router(); // <-- ESTA É A LINHA QUE ESTAVA FALTANDO ANTES DO CÓDIGO DA ROTA
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

// Configuração do banco de dados (necessária para as rotas funcionarem)
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

// --- ROTA TEMPORÁRIA PARA CRIAR ADMIN (REMOVER DEPOIS) ---
router.post('/register-admin', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Todos os campos são necessários.' });
    }

    let connection;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        connection = await mysql.createConnection(dbConfig);

        await connection.execute(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, 'admin']
        );
        res.status(201).json({ message: 'Admin criado com sucesso!' });
    } catch (error) {
        console.error('Erro ao criar admin:', error);
        res.status(500).json({ error: 'Erro ao criar admin.' });
    } finally {
        if (connection) await connection.end();
    }
});


// --- ROTA DE LOGIN COMPLETA ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SELECT * FROM users WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const user = rows[0];
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const tokenPayload = { id: user.id, role: user.role };
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'SEGREDO_SUPER_SECRETO', {
            expiresIn: '8h',
        });

        delete user.password;
        res.json({ token, user });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    } finally {
        if (connection) await connection.end();
    }
});

// ... (suas outras rotas de admin placeholder podem vir aqui)

// Exporta o router para ser usado no index.js
module.exports = router;