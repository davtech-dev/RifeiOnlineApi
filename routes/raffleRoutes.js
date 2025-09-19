// raffleRoutes.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const db = require('../config/db');
const cloudinary = require('cloudinary').v2;

// Aplica o middleware de autenticação a todas as rotas de rifas
router.use(authMiddleware);

// --- AJUSTE: ROTA PARA LISTAR TODAS AS RIFAS COM IMAGEM PRINCIPAL ---
// GET /api/raffles
// --- ROTA PARA LISTAR TODAS AS RIFAS COM PAGINAÇÃO ---
// GET /api/raffles?page=1&limit=12
router.get('/', async (req, res) => {
    try {
        // 1. Captura os parâmetros da query, com valores padrão
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 12; // 12 itens por página como padrão
        const offset = (page - 1) * limit;

        // 2. Query para contar o total de itens (sem paginação)
        const countQuery = 'SELECT COUNT(*) as total FROM raffles';
        const [totalResult] = await db.execute(countQuery);
        const totalItems = totalResult[0].total;
        const totalPages = Math.ceil(totalItems / limit);

        // 3. Query para buscar os dados da página atual
        const dataQuery = `
            SELECT 
                r.id, r.title, r.total_numbers, r.price_per_number, r.status, r.draw_date,
                ri.image_url AS imageUrl
            FROM raffles r
            LEFT JOIN raffle_images ri ON r.id = ri.raffle_id AND ri.is_primary = true
            ORDER BY r.created_at DESC
            LIMIT ?
            OFFSET ?
        `;
        const [raffles] = await db.execute(dataQuery, [limit, offset]);

        // 4. Envia uma resposta estruturada com os dados e informações de paginação
        res.status(200).json({
            data: raffles,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalItems,
                limit: limit
            }
        });

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

    // ** ATUALIZADO: Captura dos novos campos do body **
    const { title, description, rules, draw_date, status, total_numbers, price_per_number, images, awards } = req.body;

    // ** ATUALIZADO: Validação incluindo os novos campos **
    if (!title || !draw_date || !status || !total_numbers || !price_per_number || !Array.isArray(images) || !Array.isArray(awards)) {
        return res.status(400).json({ error: 'Campos obrigatórios ou em formato inválido estão faltando.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // ** ATUALIZADO: Query de inserção com os novos campos **
        const sql = `
            INSERT INTO raffles 
            (title, description, rules, total_numbers, price_per_number, status, draw_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [title, description, rules, total_numbers, price_per_number, status, draw_date];

        const [raffleResult] = await connection.execute(sql, values);
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


// --- NOVO: ROTA PARA OBTER DADOS DE UMA ÚNICA RIFA ---
// GET /api/raffles/:id
// Essencial para carregar os dados no formulário de edição.
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Busca os dados principais da rifa
        const [raffle] = await db.execute('SELECT * FROM raffles WHERE id = ?', [id]);

        if (raffle.length === 0) {
            return res.status(404).json({ error: 'Rifa não encontrada.' });
        }

        // 2. Busca os dados relacionados (imagens e prêmios)
        const [images] = await db.execute('SELECT image_url as url, is_primary FROM raffle_images WHERE raffle_id = ?', [id]);
        const [awards] = await db.execute('SELECT placement, description FROM raffle_awards WHERE raffle_id = ? ORDER BY placement ASC', [id]);

        // 3. Monta o objeto final no mesmo formato que o frontend espera
        const raffleDetails = {
            ...raffle[0],
            images: images || [], // Garante que seja sempre um array
            awards: awards || []  // Garante que seja sempre um array
        };

        res.status(200).json(raffleDetails);

    } catch (error) {
        console.error(`Erro ao buscar detalhes da rifa ${id}:`, error);
        res.status(500).json({ error: 'Erro interno ao buscar detalhes da rifa.' });
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
    // ** ATUALIZADO: Captura dos novos campos do body **
    const { title, description, rules, draw_date, status, total_numbers, price_per_number, images, awards } = req.body;

    // ** ATUALIZADO: Validação incluindo os novos campos **
    if (!title || !draw_date || !status || !total_numbers || !price_per_number || !Array.isArray(images) || !Array.isArray(awards)) {
        return res.status(400).json({ error: 'Campos obrigatórios ou em formato inválido estão faltando.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // ** ATUALIZADO: Query de atualização com os novos campos **
        const sql = `
            UPDATE raffles SET 
            title = ?, description = ?, rules = ?, draw_date = ?, status = ?, 
            total_numbers = ?, price_per_number = ? 
            WHERE id = ?
        `;
        const values = [title, description, rules, draw_date, status, total_numbers, price_per_number, id];
        await connection.execute(sql, values);

        // 2. Limpa as imagens e prêmios antigos (estratégia "delete-and-insert")
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



// --- NOVO: ROTA PARA EXCLUIR UMA RIFA (Admin) ---
// DELETE /api/raffles/:id
// Corresponde à ação do botão "Excluir" no frontend.
router.delete('/:id', async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado.' });
    }

    const { id } = req.params;
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // --- VALIDAÇÃO DE REGRAS DE NEGÓCIO (permanece a mesma) ---
        const [raffleResult] = await connection.execute('SELECT status FROM raffles WHERE id = ?', [id]);
        if (raffleResult.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Rifa não encontrada.' });
        }
        if (raffleResult[0].status === 'sorteada') {
            await connection.rollback();
            return res.status(403).json({ error: 'Não é possível excluir uma rifa que já foi sorteada.' });
        }
        const [salesResult] = await connection.execute('SELECT COUNT(*) as salesCount FROM order_numbers WHERE raffle_id = ?', [id]);
        if (salesResult[0].salesCount > 0) {
            await connection.rollback();
            return res.status(403).json({ error: 'Não é possível excluir uma rifa que já possui números vendidos.' });
        }

        // --- NOVO: LÓGICA PARA EXCLUIR IMAGENS DO CLOUDINARY ---
        // 1. Buscar todas as URLs de imagem da rifa
        const [images] = await connection.execute('SELECT image_url FROM raffle_images WHERE raffle_id = ?', [id]);

        if (images.length > 0) {
            console.log(`Encontradas ${images.length} imagens para excluir do Cloudinary.`);

            // 2. Criar uma lista de promessas de exclusão
            const deletionPromises = images.map(image => {
                const imageUrl = image.image_url;
                const match = imageUrl.match(/rifas\/(.+?)\.\w+$/);
                const public_id_encoded = match ? `rifas/${match[1]}` : null;

                if (public_id_encoded) {
                    const public_id_decoded = decodeURIComponent(public_id_encoded);
                    console.log(`Agendando exclusão para o public_id: ${public_id_decoded}`);
                    // 3. Retorna a promessa de exclusão do Cloudinary
                    return cloudinary.uploader.destroy(public_id_decoded);
                }
                return Promise.resolve(); // Retorna uma promessa resolvida para URLs inválidas
            });

            // 4. Executa todas as exclusões em paralelo para maior eficiência
            await Promise.all(deletionPromises);
            console.log('Processo de exclusão do Cloudinary finalizado.');
        }

        // --- EXCLUSÃO DO BANCO DE DADOS (após exclusão no Cloudinary) ---
        console.log(`Iniciando exclusão do banco de dados para a rifa ID: ${id}`);
        await connection.execute('DELETE FROM raffle_images WHERE raffle_id = ?', [id]);
        await connection.execute('DELETE FROM raffle_awards WHERE raffle_id = ?', [id]);
        const [deleteResult] = await connection.execute('DELETE FROM raffles WHERE id = ?', [id]);

        if (deleteResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Rifa não encontrada durante a exclusão.' });
        }

        await connection.commit();
        res.status(200).json({ message: 'Rifa e todas as imagens associadas foram excluídas com sucesso.' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`Erro ao excluir rifa ${id}:`, error);
        res.status(500).json({ error: 'Erro interno ao excluir a rifa.' });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;