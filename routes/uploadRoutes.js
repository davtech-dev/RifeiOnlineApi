const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const db = require('../config/db');
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

// ** ROTA PARA EXCLUIR IMAGEM (VERSÃO APRIMORADA) **
router.post('/delete-image', async (req, res) => {
    const { imageUrl } = req.body;

    if (!imageUrl) {
        return res.status(400).json({ error: 'URL da imagem é obrigatória.' });
    }
    console.log('Recebida requisição para excluir:', imageUrl);

    try {
        const match = imageUrl.match(/rifas\/(.+?)\.\w+$/);
        const public_id_encoded = match ? `rifas/${match[1]}` : null;

        if (!public_id_encoded) {
            throw new Error('Não foi possível extrair o public_id da URL.');
        }

        // ** AQUI ESTÁ A CORREÇÃO: Decodificamos o public_id **
        const public_id_decoded = decodeURIComponent(public_id_encoded);

        console.log('Public ID Extraído (codificado):', public_id_encoded);
        console.log('Public ID a ser enviado (decodificado):', public_id_decoded);

        // Enviamos a versão decodificada para o Cloudinary
        const deletionResult = await cloudinary.uploader.destroy(public_id_decoded);
        console.log('Resultado da exclusão do Cloudinary:', deletionResult);

        if (deletionResult.result !== 'ok') {
            console.warn(`Cloudinary não encontrou o recurso com public_id: ${public_id_decoded}. Verifique o nome do arquivo no painel do Cloudinary.`);
        }

        await db.execute('DELETE FROM raffle_images WHERE image_url = ?', [imageUrl]);

        res.status(200).json({ message: 'Imagem excluída com sucesso.' });

    } catch (error) {
        console.error('ERRO DETALHADO AO EXCLUIR IMAGEM:', error);
        res.status(500).json({ error: 'Erro interno ao excluir a imagem.' });
    }
});


module.exports = router;