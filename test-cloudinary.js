// test-cloudinary.js
require('dotenv').config();
const cloudinary = require('cloudinary').v2;

// A SDK se autoconfigura com a CLOUDINARY_URL do seu .env
// Se essa variável não existir, ele tentará usar as chaves separadas.

async function testSignature() {
    // Pega as credenciais que o SDK realmente está usando
    const config = cloudinary.config();

    // Se as credenciais não foram carregadas, o problema é o .env
    if (!config.api_key || !config.api_secret || !config.cloud_name) {
        console.error("\nERRO CRÍTICO: As credenciais do Cloudinary não foram carregadas do .env!");
        console.error("Verifique se o arquivo .env existe e contém a CLOUDINARY_URL ou as três chaves separadas.\n");
        return;
    }

    console.log("--- Credenciais Carregadas pelo SDK ---");
    console.log("Cloud Name:", config.cloud_name);
    console.log("API Key:", config.api_key);
    console.log("API Secret: ...", config.api_secret ? config.api_secret.slice(-4) : "NÃO CARREGADO");
    console.log("----------------------------------------\n");

    // 1. Vamos simular os mesmos parâmetros que o frontend enviaria
    const timestamp = Math.round((new Date).getTime() / 1000);
    const params_to_sign = {
        timestamp: timestamp,
        folder: 'rifas'
    };

    // 2. Geramos a assinatura, exatamente como na nossa rota
    const signature = cloudinary.utils.api_sign_request(
        params_to_sign,
        config.api_secret
    );

    console.log("--- Dados para o Teste de Upload ---");
    console.log("Estes são os valores que você deve usar em uma ferramenta como o Postman para testar o upload.");
    console.log("\nURL do POST:", `https://api.cloudinary.com/v1_1/${config.cloud_name}/image/upload`);
    console.log("\nParâmetros (form-data):");
    console.log("  file: (selecione um arquivo de imagem)");
    console.log("  api_key:", config.api_key);
    console.log("  timestamp:", timestamp);
    console.log("  folder:", "rifas");
    console.log("  signature:", signature);
    console.log("\n------------------------------------\n");
}

testSignature();