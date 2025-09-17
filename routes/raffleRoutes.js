const express = require('express');
const router = express.Router(); // 1. Garante que o router foi inicializado
const authMiddleware = require('../middleware/authMiddleware');
const db = require('../config/db'); // Garante que está usando o pool de conexões

// Aplica o middleware de autenticação a todas as rotas deste arquivo
router.use(authMiddleware);

/**
 * ROTA PARA LISTAR TODAS AS RIFAS (Admin)
 * GET /api/raffles
 */
router.get('/', async (req, res) => {
    try {
        const [raffles] = await db.execute('SELECT * FROM raffles ORDER BY created_at DESC');
        res.status(200).json(raffles);
    } catch (error) {
        console.error('Erro ao buscar rifas:', error);
        res.status(500).json({ error: 'Erro ao buscar rifas.' });
    }
});

/**
 * ROTA PARA CADASTRAR UMA NOVA RIFA COMPLETA (Admin)
 * POST /api/raffles
 */
router.post('/', async (req, res) => {
    // 2. Garante que a rota está definida com router.post('/', ...)
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }

    const { title, description, total_numbers, price_per_number, images, awards } = req.body;

    if (!title || !total_numbers || !price_per_number || !Array.isArray(images) || !Array.isArray(awards)) {
        return res.status(400).json({ error: 'Campos obrigatórios ou em formato inválido estão faltando.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [raffleResult] = await connection.execute(
            'INSERT INTO raffles (title, description, total_numbers, price_per_number) VALUES (?, ?, ?, ?)',
            [title, description, total_numbers, price_per_number]
        );
        const raffleId = raffleResult.insertId;

        const imagePromises = images.map(image => 
            connection.execute('INSERT INTO raffle_images (raffle_id, image_url, is_primary) VALUES (?, ?, ?)', [raffleId, image.url, image.is_primary || false])
        );
        
        const awardPromises = awards.map(award => 
            connection.execute('INSERT INTO raffle_awards (raffle_id, placement, description) VALUES (?, ?, ?)', [raffleId, award.placement, award.description])
        );

        await Promise.all([...imagePromises, ...awardPromises]);

        await connection.commit();
        res.status(201).json({ message: 'Rifa criada com sucesso!', raffleId: raffleId });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Erro ao criar rifa:', error);
        res.status(500).json({ error: 'Erro interno ao criar a rifa.' });
    } finally {
        if (connection) connection.release();
    }
});

// 3. PONTO MAIS CRÍTICO: Garante que o router está sendo exportado no final
module.exports = router;