require('dotenv').config();
const express = require('express');
const cors = require('cors');
require('./config/db'); // Importa e inicializa o pool de conexões

// Importa nossas rotas
const authRoutes = require('./routes/authRoutes');
const raffleRoutes = require('./routes/raffleRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();

// --- CONFIGURAÇÃO DE CORS ---
const whitelist = [
    'https://rifeionlineapi.onrender.com', // Frontend em produção
    'http://localhost:5173', // Frontend em desenvolvimento
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

// --- REGISTRO DAS ROTAS ---
// Padronizando todas as rotas da API sob o prefixo /api
app.use('/api/auth', authRoutes); // Ex: /api/auth/login
app.use('/api/raffles', raffleRoutes); // Ex: /api/raffles/
app.use('/api/upload', uploadRoutes);

// Rota raiz para verificação de status
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'API RifeiOnline no ar! (Hospedado na Render)',
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
});