const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const Groq = require('groq-sdk');

dotenv.config();

// Groq SDK クライアント
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// メモリ保存フォルダ
const memoryDir = path.join(__dirname, 'chatdata');
if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// システムメッセージ
const system_message = `
あなたは、汎用的なサポートチャットシステムです。
・わからないことは「わかりません」と正直に述べてください。
・URL や外部リソースにアクセスできない場合は「確認できませんでした」と明記し、推測はしません。
・推測が必要な場合は「推測です」「おそらくです」と必ずラベルを付け、根拠を提示してください。
・事実と意見を混同しないでください。
`;

// 履歴読み込み
function loadHistory(chatId, systemMessage) {
  const filePath = path.join(memoryDir, `${chatId}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } else {
    return [{ role: 'system', content: systemMessage }];
  }
}

// 履歴保存
function saveHistory(chatId, history) {
  const sys = history.find(m => m.role === 'system');
  const recent = history.filter(m => m.role !== 'system').slice(-19);
  fs.writeFileSync(
    path.join(memoryDir, `${chatId}.json`),
    JSON.stringify([sys, ...recent], null, 2)
  );
}

// 履歴削除
function deleteHistory(chatId) {
  const filePath = path.join(memoryDir, `${chatId}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// ====== メインチャットAPI ======
app.post('/chat', async (req, res) => {
  const { message, chatId } = req.body;
  let history = loadHistory(chatId, system_message);

  // 新しいユーザー発話を追加
  history.push({ role: 'user', content: message });

  // コンテキストを整理（システム + 直近13件）
  const contextMessages = [
    { role: 'system', content: system_message },
    ...history.filter(m => m.role !== 'system').slice(-13)
  ];

  try {
    const completion = await groq.chat.completions.create({
      model: "groq/compound",
      messages: contextMessages
    });

    const reply = completion.choices?.[0]?.message?.content 
      ?? '⚠️ 返答が取得できませんでした';

    // 履歴に保存
    history.push({ role: 'assistant', content: reply });
    saveHistory(chatId, history);

    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: '❌ エラーが発生しました' });
  }
});

// ====== チャット削除API ======
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

// ====== 履歴ロードAPI ======
app.get('/chats/:chatId', (req, res) => {
  const { chatId } = req.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(chatId)) return res.status(400).send('Invalid');
  const history = loadHistory(chatId, system_message);
  res.json(history.filter(m => m.role !== 'system')); // system を除く
});

// ====== 起動 ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
