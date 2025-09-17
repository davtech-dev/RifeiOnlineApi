const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    // 1. Pega o token do cabeçalho 'Authorization'
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato "Bearer TOKEN"

    if (token == null) {
        // 2. Se não houver token, retorna erro 401 (Não Autorizado)
        return res.sendStatus(401);
    }

    // 3. Verifica se o token é válido
    jwt.verify(token, process.env.JWT_SECRET || 'SEGREDO_SUPER_SECRETO', (err, user) => {
        if (err) {
            // 4. Se o token for inválido (expirado, etc.), retorna erro 403 (Proibido)
            return res.sendStatus(403);
        }

        // 5. Se o token for válido, anexa os dados do usuário à requisição
        req.user = user;
        next(); // Passa para o próximo middleware ou para a rota final
    });
}

module.exports = authMiddleware;