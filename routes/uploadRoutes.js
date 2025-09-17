const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const authMiddleware = require('../middleware/authMiddleware');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.use(authMiddleware);

router.get('/generate-signature', (req, res) => {
    const timestamp = Math.round((new Date).getTime()/1000);

    try {
        // --- ALTERAÇÃO AQUI ---
        // Os parâmetros que vamos assinar DEVEM ser os mesmos que o frontend enviará,
        // exceto pela 'file' e 'api_key'.
        const paramsToSign = {
            timestamp: timestamp,
            folder: 'rifas' // Adicionamos o mesmo nome da pasta aqui
        };

        // Usa o objeto com todos os parâmetros para gerar a assinatura
        const signature = cloudinary.utils.api_sign_request(
            paramsToSign,
            process.env.CLOUDINARY_API_SECRET
        );

        res.status(200).json({ timestamp, signature });
        
    } catch (error) {
        console.error('Erro ao gerar assinatura:', error);
        res.status(500).json({ error: 'Falha ao gerar assinatura para upload.' });
    }
});

module.exports = router;