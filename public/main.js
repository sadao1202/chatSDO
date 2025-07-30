const chatList = document.getElementById('chat-entries');
const newChatBtn = document.getElementById('new-chat-btn');
const chat = document.getElementById('chat');
const input = document.getElementById('input-message');
const sendBtn = document.getElementById('send-btn');

let chats = JSON.parse(localStorage.getItem('chats') || '{}');
let currentChatId = null;

function generateId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

// チャット一覧表示（編集可能タイトル含む）
function renderChatList() {
  chatList.innerHTML = '';
  for (const id in chats) {
    const li = document.createElement('li');
    li.dataset.id = id;
    li.classList.toggle('active', id === currentChatId);

    const span = document.createElement('span');
    span.textContent = chats[id].title || '無題のチャット';
    span.style.cursor = 'pointer';

    const inputTitle = document.createElement('input');
    inputTitle.type = 'text';
    inputTitle.value = chats[id].title || '無題のチャット';
    inputTitle.style.display = 'none';
    //（スタイルは省略）

    // 編集開始
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      span.style.display = 'none';
      inputTitle.style.display = 'inline-block';
      inputTitle.focus();
      inputTitle.select();
    });

    // 編集終了
    function finishEdit() {
      const newTitle = inputTitle.value.trim() || '無題のチャット';
      chats[id].title = newTitle;
      saveChats();
      span.textContent = newTitle;
      inputTitle.style.display = 'none';
      span.style.display = 'inline';
      renderChatList();
    }

    inputTitle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finishEdit();
      else if (e.key === 'Escape') {
        inputTitle.value = chats[id].title;
        inputTitle.style.display = 'none';
        span.style.display = 'inline';
      }
    });
    inputTitle.addEventListener('blur', finishEdit);

    // 削除ボタン（ゴミ箱アイコン）
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'チャットを削除';
    deleteBtn.classList.add('delete-button');

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('このチャットを削除してよろしいですか？')) {
        delete chats[id];
        requestDeleteChatOnServer(id);
        saveChats();
        // 削除したチャットが現在選択中なら切り替え
        if (currentChatId === id) {
          const keys = Object.keys(chats);
          currentChatId = keys.length ? keys[0] : null;
          renderMessages();
        }
        renderChatList();
      }
    });

    li.appendChild(span);
    li.appendChild(inputTitle);
    li.appendChild(deleteBtn);

    li.addEventListener('click', () => {
      if (inputTitle.style.display === 'none') {
        switchChat(id);
      }
    });

    chatList.appendChild(li);
  }
}


function renderMessages() {
  if (!currentChatId || !chats[currentChatId]) return;
  chat.innerHTML = '';
  const messages = chats[currentChatId].messages || [];
  messages.forEach(({ role, content }) => {
    const div = document.createElement('div');
    div.classList.add('message', role === 'user' ? 'user' : 'bot');
    div.textContent = `${role === 'user' ? '🧑' : '🤖'} ${content}`;
    chat.appendChild(div);
  });
  chat.scrollTop = chat.scrollHeight;
}

function switchChat(id) {
  if (currentChatId === id) return;
  currentChatId = id;
  input.value = '';
  renderChatList();
  renderMessages();
  input.focus();
}

function createNewChat() {
  const id = generateId();
  chats[id] = {
    title: '新しいチャット',
    messages: []
  };
  saveChats();
  switchChat(id);
}

function saveChats() {
  localStorage.setItem('chats', JSON.stringify(chats));
}

async function requestDeleteChatOnServer(id) {
  try {
    const res = await fetch('/delete_chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: id })
    });
    saveChats();
  } catch {
    confirm('エラーが発生しました。')
  }
}

async function sendMessage() {
  if (!currentChatId) {
    alert('チャットを選択してください');
    return;
  }
  const message = input.value.trim();
  if (!message) return;

  chats[currentChatId].messages.push({ role: 'user', content: message });
  renderMessages();

  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, chatId: currentChatId })
    });
    const data = await res.json();

    chats[currentChatId].messages.push({ role: 'bot', content: data.reply });
    renderMessages();

    saveChats();
  } catch {
    chats[currentChatId].messages.push({ role: 'bot', content: '❌ エラーが発生しました。' });
    renderMessages();
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

newChatBtn.addEventListener('click', createNewChat);
sendBtn.addEventListener('click', sendMessage);
input.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendMessage();
});

(function init() {
  const keys = Object.keys(chats);
  if (keys.length) {
    currentChatId = keys[0];
  } else {
    createNewChat();
  }
  renderChatList();
  renderMessages();
  input.focus();
})();
