const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

dotenv.config();

const memoryDir = './chatdata';
if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function loadHistory(chatId, systemMessage) {
  const filePath = path.join(memoryDir, `${chatId}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } else {
    return [{ role: 'system', content: systemMessage }];
  }
}

function saveHistory(chatId, history) {
  const filePath = path.join(memoryDir, `${chatId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(history.slice(-20), null, 2));
}

app.post('/chat', async (req, res) => {
  const { message, chatId } = req.body;

  const system_message = "あなたは、汎用的なサポートチャットシステムです。わからないことはわからないと正直に言ってください。";
  let history = loadHistory(chatId, system_message);

  history.push({ role: 'user', content: message });

  const contextMessages = [
    { role: 'system', content: system_message },
    ...history.filter(m => m.role !== 'system').slice(-13)
  ];

  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: contextMessages
    }, {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const reply = response.data.choices[0].message.content;
    history.push({ role: 'assistant', content: reply });
    saveHistory(chatId, history);

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: '❌ エラーが発生しました' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));