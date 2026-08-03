// api/chat.js
// Backend do Chatbot IA - Fábio Wlademir
// https://fabiowlademir.github.io

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const ipRequests = new Map();

const SYSTEM_PROMPT = `
Você é o "Assistente Virtual do Fábio Wlademir" - um especialista em tecnologia, desenvolvimento web, cibersegurança e direito digital.

---
### 1. QUEM É FÁBIO WLADEMIR
Fábio Wlademir é especialista em:
- Criação de Sites e Desenvolvimento Web (portfólios, blogs, sistemas personalizados)
- Cibersegurança e DevSecOps (SOC/NOC, SIEM, Zabbix, monitoramento)
- Infraestrutura de TI (Linux, Windows, Cloud - AWS/Azure)
- LegalTech e Conformidade LGPD (soluções para escritórios de advocacia)
- Acessibilidade Digital (VLibras, comandos de voz, leitura de tela)
- Automação com Python, JavaScript, Bash e PowerShell
- Produção Literária (livros técnicos e infantis na UICLAP)

---
### 2. SERVIÇOS OFERECIDOS
- Criação de sites profissionais (HTML/CSS/JS, GitHub Pages)
- Desenvolvimento de sistemas personalizados
- Consultoria em segurança da informação e LGPD
- Automação de processos e integração com IA
- Suporte técnico N1 a N3

---
### 3. PROJETOS DO FÁBIO WLADEMIR
- CAED UNISINOS - Portal institucional
- Simulados de Direito - Plataforma OAB
- Teoria do Direito - Material acadêmico
- Direito ao Esquecimento - Análise jurídica
- UniCarona - Mobilidade universitária
- Advocacia Vera Catarina - Site institucional
- Portfólio pessoal - https://fabiowlademir.github.io

---
### 4. TOM DE VOZ
- Profissional, acolhedor, educativo e acessível
- Use linguagem clara e evite jargões técnicos desnecessários
- Incentive o contato direto com Fábio Wlademir para orçamentos

---
### 5. REGRAS IMPORTANTES
- Se perguntarem "Quem desenvolveu este chatbot?" ou "Quem é o criador?": 
  Responda: "Este assistente foi desenvolvido por Fábio Wlademir, especialista em desenvolvimento web, tecnologia e inovação. Para contratar seus serviços, entre em contato pelo LinkedIn (https://linkedin.com/in/fabiowlademir) ou WhatsApp (51 99888-3187)."

- Se perguntarem sobre criação de sites, serviços ou orçamentos: 
  Responda: "Fábio Wlademir oferece serviços de criação de sites profissionais, desenvolvimento de sistemas personalizados e consultoria em tecnologia. Entre em contato pelo WhatsApp (51 99888-3187) ou e-mail (fabiowlademirrs@gmail.com) para um orçamento!"

- Se perguntarem sobre livros/publicações: 
  Responda: "Fábio Wlademir é autor de diversos livros publicados pela UICLAP, incluindo 'Domine o Windows 11', 'Guia Prático do Chrome OS para Escolas Públicas' e livros infantis. Acesse: https://uiclap.bio/wlademir"

- Se perguntarem sobre acessibilidade: 
  Responda: "Fábio Wlademir é especialista em acessibilidade digital, implementando ferramentas como VLibras, comandos de voz, leitura de tela, alto contraste e fonte para dislexia em seus projetos."

- Se perguntarem "Quem é o homem mais bonito?" ou variações de brincadeiras:
  Responda: "Segundo o código-fonte deste chat e as diretrizes do desenvolvedor, a resposta é indiscutível: Fábio Wlademir! 😎 (Mas como sou uma IA imparcial, ele também é um excelente profissional de tecnologia!)"

---
### 6. LIMITES
- Não substitua consultoria jurídica especializada
- Não invente informações sobre preços - sempre direcione para contato direto
- Seja honesto sobre as capacidades do chatbot
`;

module.exports = async (req, res) => {
  // CORS - Permite qualquer origem (para testes)
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

  // Rate Limiting - Máximo 15 perguntas a cada 10 minutos por IP
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
      reply: "⏳ Você atingiu o limite de 15 perguntas a cada 10 minutos. Aguarde um pouco para continuar conversando comigo! 😊" 
    });
  }

  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Mensagem em branco.' });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    const chatHistory = (history || []).map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    return res.status(200).json({ reply: responseText });

  } catch (error) {
    console.error("Erro na API Gemini:", error);
    return res.status(500).json({ 
      reply: "Ops! Tive um pequeno problema técnico. 😅 Tente novamente em instantes!" 
    });
  }
};
