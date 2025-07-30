const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

dotenv.config();

const memoryDir = path.join(__dirname, 'chatdata');
if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const system_message = `
あなたは、汎用的なサポートチャットシステムです。
・わからないことは「わかりません」と正直に述べてください。
・URL や外部リソースにアクセスできない場合は「確認できませんでした」と明記し、推測はしません。
・推測が必要な場合は「推測です」「おそらくです」と必ずラベルを付け、根拠を提示してください。
・事実と意見を混同しないでください。
`;

function loadHistory(chatId, systemMessage) {
  const filePath = path.join(memoryDir, `${chatId}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } else {
    return [{ role: 'system', content: systemMessage }];
  }
}

function saveHistory(chatId, history) {
  const sys = history.find(m => m.role === 'system');
  const recent = history.filter(m => m.role !== 'system').slice(-19);
  fs.writeFileSync(
    path.join(memoryDir, `${chatId}.json`),
    JSON.stringify([sys, ...recent], null, 2)
  );
}

function deleteHistory(chatId) {
  const filePath = path.join(memoryDir, `${chatId}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

app.post('/chat', async (req, res) => {
  const { message, chatId } = req.body;
  let history = loadHistory(chatId, system_message);

  history.push({ role: 'user', content: message });

  const contextMessages = [
    { role: 'system', content: system_message },
    ...history.filter(m => m.role !== 'system').slice(-13)
  ];

  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'moonshotai/kimi-k2-instruct',
      messages: contextMessages
    }, {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const reply = response.data?.choices?.[0]?.message?.content ?? '⚠️ 返答が取得できませんでした';
    history.push({ role: 'assistant', content: reply });
    saveHistory(chatId, history);

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: '❌ エラーが発生しました' });
  }
});

app.post('/delete_chat', (req, res) => {
  const chatId = req.body.chatId;
  try {
    deleteHistory(chatId);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: '削除に失敗しました' });
  }
});

app.get('/chats/:chatId', (req, res) => {
  const { chatId } = req.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(chatId)) return res.status(400).send('Invalid');
  const history = loadHistory(chatId, system_message);
  res.json(history.filter(m => m.role !== 'system'));  // システムプロンプトは除く
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));