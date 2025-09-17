const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const authMiddleware = require('../middleware/authMiddleware');

// --- VERIFICAÇÃO DE CONFIGURAÇÃO NA INICIALIZAÇÃO ---
// Pega a configuração que o SDK do Cloudinary carregou automaticamente do .env
const cloudinaryConfig = cloudinary.config();

// Se a chave secreta (api_secret) não foi carregada, significa que a variável de ambiente está faltando ou incorreta.
// Lançamos um erro claro no log do servidor para facilitar a depuração em futuros deploys.
if (!cloudinaryConfig.api_secret) {
    console.error("ERRO CRÍTICO DE CONFIGURAÇÃO: A API Secret do Cloudinary não foi encontrada.");
    console.error("Verifique se a variável de ambiente CLOUDINARY_URL está definida corretamente no seu ambiente de produção (Render).");
} else {
    console.log("SDK do Cloudinary configurado com sucesso.");
}
// --- FIM DA VERIFICAÇÃO ---

// Aplica o middleware de autenticação para todas as rotas neste arquivo
router.use(authMiddleware);

/**
 * Rota que gera a assinatura para o upload direto do frontend.
 * MÉTODO: POST
 * URL: /api/upload/generate-signature
 */
router.post('/generate-signature', (req, res) => {
    const params_to_sign = req.body;

    // Validação para garantir que o corpo da requisição não está vazio
    if (!params_to_sign || Object.keys(params_to_sign).length === 0) {
        return res.status(400).json({ error: 'Parâmetros para assinatura são necessários.' });
    }

    try {
        // Usa a api_secret da configuração já carregada e verificada
        const signature = cloudinary.utils.api_sign_request(
            params_to_sign,
            cloudinaryConfig.api_secret
        );

        res.status(200).json({ signature });

    } catch (error) {
        // Loga o erro detalhado no console do servidor para que possamos depurar
        console.error('Erro ao gerar a assinatura do Cloudinary:', error);

        // Envia uma resposta de erro genérica para o cliente por segurança
        res.status(500).json({ error: 'Falha ao gerar assinatura para upload.' });
    }
});

module.exports = router;