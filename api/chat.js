// api/chat.js - VERSÃO CORRETA COM DUAS CHAVES
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 🔑 Duas chaves de projetos DIFERENTES (cotas separadas!)
const genAI1 = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const genAI2 = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_RESERVA);

const ipRequests = new Map();

const SYSTEM_PROMPT = `
Você é o "Assistente Virtual do Fábio Wlademir" - um especialista em tecnologia, desenvolvimento web, cibersegurança e direito digital.

Responda de forma amigável, profissional e útil. Se perguntarem sobre serviços ou criação de sites, indique que Fábio Wlademir oferece esses serviços e dê o contato: WhatsApp (51) 99888-3187.

Seja sempre educado e acolhedor.
`;

// 📋 LISTA DE MODELOS - ESTRATÉGIA DE COTA SEPARADA
const MODELOS = [
  "gemini-2.0-flash",       // 🥇 Principal: rápido e inteligente
  "gemini-2.0-flash-lite",  // 🥈 Fallback: cota SEPARADA do principal!
  "gemini-1.5-pro",         // 🥉 Terceiro: mais inteligente (mais lento)
];

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Rate Limiting
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const maxRequests = 15;

  const userRecord = ipRequests.get(clientIp) || { count: 0, resetTime: now + windowMs };

  if (now > userRecord.resetTime) {
    userRecord.count = 1;
    userRecord.resetTime = now + windowMs;
  } else {
    userRecord.count++;
  }

  ipRequests.set(clientIp, userRecord);

  if (userRecord.count > maxRequests) {
    return res.status(429).json({ 
      reply: "⏳ Você atingiu o limite de 15 perguntas a cada 10 minutos. Aguarde um pouco para continuar! 😊" 
    });
  }

  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Mensagem em branco.' });
    }

    console.log("📩 Mensagem recebida:", message);

    let ultimoErro = null;

    // Tenta cada modelo com fallback de chave
    for (const modelo of MODELOS) {
      // 🥇 Primeiro tenta com a chave 1
      try {
        console.log(`🔍 Chave 1 - Testando modelo: ${modelo}...`);
        
        const model = genAI1.getGenerativeModel({
          model: modelo,
          systemInstruction: SYSTEM_PROMPT,
        });

        const chatHistory = (history || []).map(h => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }]
        }));

        const chat = model.startChat({ history: chatHistory });
        const result = await chat.sendMessage(message);
        const responseText = result.response.text();

        console.log(`✅ Chave 1 - Modelo ${modelo} funcionou!`);
        return res.status(200).json({ reply: responseText });

      } catch (error) {
        // Se erro de quota (429), tenta com a chave 2
        if (error.message && error.message.includes('429')) {
          console.log(`🔄 Chave 1 - Modelo ${modelo} sem cota, tentando chave 2...`);
          
          try {
            console.log(`🔍 Chave 2 - Testando modelo: ${modelo}...`);
            
            const model2 = genAI2.getGenerativeModel({
              model: modelo,
              systemInstruction: SYSTEM_PROMPT,
            });

            const chatHistory2 = (history || []).map(h => ({
              role: h.role === 'user' ? 'user' : 'model',
              parts: [{ text: h.text }]
            }));

            const chat2 = model2.startChat({ history: chatHistory2 });
            const result2 = await chat2.sendMessage(message);
            const responseText2 = result2.response.text();

            console.log(`✅ Chave 2 - Modelo ${modelo} funcionou!`);
            return res.status(200).json({ reply: responseText2 });

          } catch (error2) {
            console.log(`❌ Chave 2 - Modelo ${modelo} falhou:`, error2.message);
            ultimoErro = error2;
          }
        } else {
          console.log(`❌ Modelo ${modelo} falhou:`, error.message);
          ultimoErro = error;
        }
      }
    }

    return res.status(500).json({ 
      reply: `❌ Nenhum modelo disponível. Último erro: ${ultimoErro?.message || "Erro desconhecido"}`
    });

  } catch (error) {
    console.error("❌ ERRO GERAL:", error);
    return res.status(500).json({ 
      reply: `❌ Erro: ${error.message || "Erro desconhecido"}`
    });
  }
};
