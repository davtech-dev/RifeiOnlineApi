// raffleRoutes.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const db = require('../config/db');

// Aplica o middleware de autenticação a todas as rotas de rifas
router.use(authMiddleware);

// --- AJUSTE: ROTA PARA LISTAR TODAS AS RIFAS COM IMAGEM PRINCIPAL ---
// GET /api/raffles
// Objetivo: Retornar uma lista otimizada para os cards do frontend.
router.get('/', async (req, res) => {
    try {
        // SQL Otimizado: Usamos LEFT JOIN para buscar a imagem principal (is_primary = true)
        // de cada rifa em uma única consulta. Isso é muito mais performático.
        const query = `
            SELECT 
                r.*, 
                ri.image_url AS imageUrl
            FROM raffles r
            LEFT JOIN raffle_images ri ON r.id = ri.raffle_id AND ri.is_primary = true
            ORDER BY r.created_at DESC
        `;
        const [raffles] = await db.execute(query);

        res.status(200).json(raffles);
    } catch (error) {
        console.error('Erro ao buscar rifas:', error);
        res.status(500).json({ error: 'Erro ao buscar rifas.' });
    }
});

// --- ROTA PARA CADASTRAR UMA NOVA RIFA (Admin) ---
// POST /api/raffles
// Lógica mantida, pois já estava correta e robusta com o uso de transações.
router.post('/', async (req, res) => {
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


// --- NOVO: ROTA PARA EXCLUIR UMA RIFA (Admin) ---
// DELETE /api/raffles/:id
// Corresponde à ação do botão "Excluir" no frontend.
router.delete('/:id', async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }

    const { id } = req.params;
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // É crucial deletar de tabelas "filhas" antes da tabela "pai" para evitar erros de chave estrangeira.
        await connection.execute('DELETE FROM raffle_images WHERE raffle_id = ?', [id]);
        await connection.execute('DELETE FROM raffle_awards WHERE raffle_id = ?', [id]);
        // Se houver uma tabela de tickets, também deve ser deletada aqui.
        // await connection.execute('DELETE FROM raffle_tickets WHERE raffle_id = ?', [id]);

        const [deleteResult] = await connection.execute('DELETE FROM raffles WHERE id = ?', [id]);

        if (deleteResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Rifa não encontrada.' });
        }

        await connection.commit();
        res.status(200).json({ message: 'Rifa excluída com sucesso.' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`Erro ao excluir rifa ${id}:`, error);
        res.status(500).json({ error: 'Erro interno ao excluir a rifa.' });
    } finally {
        if (connection) connection.release();
    }
});


// --- NOVO: ROTA PARA ATUALIZAR UMA RIFA (Admin) ---
// PUT /api/raffles/:id
// Corresponde à ação do botão "Editar" e salvar no formulário de edição.
// Nota: PUT geralmente substitui o recurso inteiro. Se fosse para atualizações parciais, PATCH seria mais indicado.
router.put('/:id', async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }

    const { id } = req.params;
    const { title, description, total_numbers, price_per_number, images, awards } = req.body;

    // Validação similar à da criação
    if (!title || !total_numbers || !price_per_number || !Array.isArray(images) || !Array.isArray(awards)) {
        return res.status(400).json({ error: 'Campos obrigatórios ou em formato inválido estão faltando.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Atualiza os dados principais da rifa
        await connection.execute(
            'UPDATE raffles SET title = ?, description = ?, total_numbers = ?, price_per_number = ? WHERE id = ?',
            [title, description, total_numbers, price_per_number, id]
        );

        // 2. Limpa as imagens e prêmios antigos (estratégia "delete-and-insert", mais simples de gerenciar)
        await connection.execute('DELETE FROM raffle_images WHERE raffle_id = ?', [id]);
        await connection.execute('DELETE FROM raffle_awards WHERE raffle_id = ?', [id]);

        // 3. Insere as novas imagens e prêmios
        const imagePromises = images.map(image =>
            connection.execute('INSERT INTO raffle_images (raffle_id, image_url, is_primary) VALUES (?, ?, ?)', [id, image.url, image.is_primary || false])
        );

        const awardPromises = awards.map(award =>
            connection.execute('INSERT INTO raffle_awards (raffle_id, placement, description) VALUES (?, ?, ?)', [id, award.placement, award.description])
        );

        await Promise.all([...imagePromises, ...awardPromises]);

        await connection.commit();
        res.status(200).json({ message: 'Rifa atualizada com sucesso!' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`Erro ao atualizar rifa ${id}:`, error);
        res.status(500).json({ error: 'Erro interno ao atualizar a rifa.' });
    } finally {
        if (connection) connection.release();
    }
});


module.exports = router;