const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const db = require('../config/db'); // IMPORTANTE: Usando o pool de conexões compartilhado

// --- ROTAS PROTEGIDAS POR AUTENTICAÇÃO ---
// Todas as rotas neste arquivo usarão o middleware
router.use(authMiddleware);

/**
 * ROTA PARA LISTAR TODAS AS RIFAS (Admin)
 * GET /api/raffles/
 */
router.get('/', async (req, res) => {
    try {
        // Usa o pool diretamente para uma query simples
        const [raffles] = await db.execute('SELECT * FROM raffles ORDER BY created_at DESC');
        res.status(200).json(raffles);
    } catch (error) {
        console.error('Erro ao buscar rifas:', error);
        res.status(500).json({ error: 'Erro ao buscar rifas.' });
    }
});

/**
 * ROTA PARA CADASTRAR UMA NOVA RIFA COMPLETA (Admin)
 * POST /api/raffles/
 */
router.post('/', async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }

    const { title, description, total_numbers, price_per_number, images, awards } = req.body;

    if (!title || !total_numbers || !price_per_number || !Array.isArray(images) || !Array.isArray(awards)) {
        return res.status(400).json({ error: 'Campos obrigatórios ou em formato inválido estão faltando.' });
    }

    // Para transações, pegamos uma conexão específica do pool
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Insere na tabela 'raffles'
        const [raffleResult] = await connection.execute(
            'INSERT INTO raffles (title, description, total_numbers, price_per_number) VALUES (?, ?, ?, ?)',
            [title, description, total_numbers, price_per_number]
        );
        const raffleId = raffleResult.insertId;

        // 2. Insere na tabela 'raffle_images' (usando Promise.all para performance)
        const imagePromises = images.map(image => {
            return connection.execute(
                'INSERT INTO raffle_images (raffle_id, image_url, is_primary) VALUES (?, ?, ?)',
                [raffleId, image.url, image.is_primary || false]
            );
        });
        await Promise.all(imagePromises);

        // 3. Insere na tabela 'raffle_awards' (usando Promise.all para performance)
        const awardPromises = awards.map(award => {
            return connection.execute(
                'INSERT INTO raffle_awards (raffle_id, placement, description) VALUES (?, ?, ?)',
                [raffleId, award.placement, award.description]
            );
        });
        await Promise.all(awardPromises);

        // Se tudo deu certo, confirma a transação
        await connection.commit();
        res.status(201).json({ message: 'Rifa criada com sucesso!', raffleId: raffleId });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Erro ao criar rifa:', error);
        res.status(500).json({ error: 'Erro interno ao criar a rifa.' });
    } finally {
        // IMPORTANTE: Libera a conexão de volta para o pool
        if (connection) connection.release();
    }
});

module.exports = router;