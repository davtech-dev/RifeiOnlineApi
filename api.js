const serverless = require('serverless-http');
const app = require('./index'); // Importa seu app Express do index.js

// Envolve o app Express em um manipulador compatível com a Netlify
module.exports.handler = serverless(app);