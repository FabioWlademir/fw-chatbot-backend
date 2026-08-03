// api/chat.js - VERSÃO SEGURA (SEM CHAVE NO CÓDIGO)
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ✅ CORRETO: Pega a chave da variável de ambiente
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const ipRequests = new Map();

const SYSTEM_PROMPT = `
Você é o "Assistente Virtual do Fábio Wlademir" - um especialista em tecnologia, desenvolvimento web, cibersegurança e direito digital.

Responda de forma amigável, profissional e útil. Se perguntarem sobre serviços ou criação de sites, indique que Fábio Wlademir oferece esses serviços e dê o contato: WhatsApp (51) 99888-3187.

Seja sempre educado e acolhedor.
`;

// 📋 LISTA DE MODELOS - VERSÃO 2.0
const MODELOS = [
  "gemini-2.5-flash",       // 🥇 Primeira opção: Modelo atual, ultra rápido e ideal para Web/Chatbots
  "gemini-2.0-flash",       // 🥈 Segunda opção (Fallback): Muito estável para assistentes
  "gemini-1.5-flash"        // 🥉 Terceira opção: Legado estável

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

    // Tenta cada modelo
    for (const modelo of MODELOS) {
      try {
        console.log(`🔍 Testando modelo: ${modelo}...`);
        
        const model = genAI.getGenerativeModel({
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

        console.log(`✅ Modelo ${modelo} funcionou!`);
        return res.status(200).json({ reply: responseText });

      } catch (error) {
        console.log(`❌ Modelo ${modelo} falhou:`, error.message);
        ultimoErro = error;
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
