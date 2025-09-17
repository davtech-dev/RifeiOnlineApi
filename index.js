// ... todo o seu código da API

// A inicialização do servidor (app.listen) é necessária para a Render
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});