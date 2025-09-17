// routes/uploadRoutes.js
const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const authMiddleware = require('../middleware/authMiddleware');

// Configura o SDK do Cloudinary com as credenciais do .env
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Protege a rota para garantir que apenas usuários logados possam obter assinaturas
router.use(authMiddleware);

// Rota que gera a assinatura para o upload
router.get('/generate-signature', (req, res) => {
    const timestamp = Math.round((new Date).getTime()/1000);

    try {
        const signature = cloudinary.utils.api_sign_request(
            { timestamp: timestamp },
            process.env.CLOUDINARY_API_SECRET
        );
        res.status(200).json({ timestamp, signature });
    } catch (error) {
        console.error('Erro ao gerar assinatura:', error);
        res.status(500).json({ error: 'Falha ao gerar assinatura para upload.' });
    }
});

module.exports = router;