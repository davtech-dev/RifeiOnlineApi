// meu-backend/index.js

// --- 1. IMPORTAÇÕES ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs'); // Para comparar senhas
const jwt = require('jsonwebtoken'); // Para criar o token de acesso

// --- 2. CONFIGURAÇÃO INICIAL ---
const app = express();
const PORT = process.env.PORT || 3001;

// --- NOVA CONFIGURAÇÃO DE CORS ---
// Lista de domínios que têm permissão para acessar esta API
const whitelist = [
    'https://rifeionlineapp.netlify.app', // Seu frontend em produção
    'http://localhost:5173', // Seu frontend em desenvolvimento local (ajuste a porta se for diferente)
    'https://rifeionline.com.br'// URL original
];

const corsOptions = {
    origin: function (origin, callback) {
        // Se a origem da requisição estiver na nossa lista, permite
        if (whitelist.indexOf(origin) !== -1 || !origin) { // !origin permite requisições sem origem (ex: Postman)
            callback(null, true)
        } else {
            // Se não estiver na lista, rejeita com um erro de CORS
            callback(new Error('Not allowed by CORS'))
        }
    }
};

// Aplica o middleware do CORS com as opções que definimos
app.use(cors(corsOptions));
app.use(express.json());

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

// --- 3. ENDPOINTS DA API ---
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'API RifeiOnline no ar!',
        status: 'ok',
        timestamp: new Date().toISOString() // Adiciona a data/hora atual
    });
});
// --- ENDPOINT DE REGISTRO DE ADMIN ---
app.post('/register-admin', async (req, res) => {
    console.log('Recebida requisição em /register-admin');
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    let connection;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        connection = await mysql.createConnection(dbConfig);
        await connection.execute(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, 'admin']
        );
        res.status(201).json({ message: 'Usuário admin criado com sucesso!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Este email já está em uso.' });
        }
        res.status(500).json({ error: 'Erro no servidor ao registrar.' });
    } finally {
        if (connection) await connection.end();
    }
});


// --- NOVO ENDPOINT DE LOGIN ---
app.post('/login', async (req, res) => {
    console.log('Recebida requisição em /login');
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);

        // 1. Busca o usuário no banco pelo email
        const [rows] = await connection.execute('SELECT * FROM users WHERE email = ?', [email]);

        // Se não encontrar o usuário, retorna um erro genérico por segurança
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const user = rows[0];

        // 2. Verifica se o usuário encontrado é um 'admin'
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        }

        // 3. Compara a senha enviada com a senha criptografada no banco
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        // 4. Se a senha estiver correta, cria o payload do Token JWT
        const tokenPayload = {
            id: user.id,
            role: user.role
        };

        // 5. Gera o token
        const token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET || 'SEGREDO_PADRAO_PARA_TESTES', // Use uma chave secreta forte no .env!
            { expiresIn: '8h' } // O token será válido por 8 horas
        );

        // Remove a senha do objeto de usuário antes de enviar a resposta
        delete user.password;

        // 6. Envia a resposta com o token e os dados do usuário
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


module.exports = app;