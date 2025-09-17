// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db'); // Importa nosso pool de conexões

// --- ENDPOINT DE REGISTRO DE ADMIN ---
router.post('/register-admin', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        // Usa o pool para executar a query. Não precisa mais criar/fechar conexão.
        await db.execute(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, 'admin']
        );
        res.status(201).json({ message: 'Usuário admin criado com sucesso!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Este email já está em uso.' });
        }
        console.error('Erro ao registrar admin:', error);
        res.status(500).json({ error: 'Erro no servidor ao registrar.' });
    }
});

// --- ENDPOINT DE LOGIN ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    try {
        // Usa o pool para executar a query
        const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);

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
        const token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET || 'SEGREDO_SUPER_SECRETO',
            { expiresIn: '8h' }
        );

        delete user.password;

        res.status(200).json({ message: "Login bem-sucedido!", token, user });
    } catch (error) {
        console.error("Erro no processo de login:", error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

module.exports = router;