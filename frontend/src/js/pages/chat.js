// Подключение к сокету (адрес бэкенда)
const socket = io({
    path: '/socket.io',
    transports: ['websocket', 'polling']
});

let currentUser = null;
let currentChatId = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Проверяем авторизацию
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = '/login.html';
        return;
    }

    // 2. Получаем данные о себе
    try {
        const userRes = await fetch('/api/user/me');
        if (userRes.ok) currentUser = await userRes.json();
    } catch (e) { console.error(e); }

    // 3. Загружаем список чатов
    loadChatList();

    // 4. Слушаем входящие сообщения
    socket.on('receive_message', (msg) => {
        // Если сообщение пришло в открытый чат - рисуем его
        if (currentChatId && msg.chat_id == currentChatId) {
            appendMessage(msg);
            scrollToBottom();
        }
        // В любом случае обновляем список чатов (чтобы поднять чат вверх или обновить превью)
        loadChatList(); 
    });

    // 5. Обработка отправки
    const form = document.getElementById('msg-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('msg-input');
        const text = input.value.trim();
        
        if (text && currentChatId) {
            // Отправляем через сокет
            console.log('Отправляю сообщение:', text);
            
            socket.emit('send_message', {
                chatId: currentChatId,
                senderId: currentUser.id,
                content: text
            });
            input.value = '';
        }
        else {
            console.error('Ошибка: нет текста или ID чата', currentChatId);
        }
    });
});

async function loadChatList() {
    const listContainer = document.getElementById('chat-list');
    
    try {
        const res = await fetch('/api/chats');
        const chats = await res.json();

        listContainer.innerHTML = '';

        if (chats.length === 0) {
            listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#999">У вас пока нет диалогов</div>';
            return;
        }

        chats.forEach(chat => {
            const div = document.createElement('div');
            div.className = `chat-item ${chat.id == currentChatId ? 'active' : ''}`;
            
            // Аватар собеседника
            const avatar = chat.other_avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
            const lastMsg = chat.last_message || 'Нет сообщений';
            
            div.innerHTML = `
                <img src="${avatar}" class="chat-avatar">
                <div class="chat-info">
                    <div class="chat-name">${chat.other_name}</div>
                    <div class="chat-preview">${lastMsg}</div>
                    <div class="chat-meta" style="color:var(--primary-color)">${chat.listing_title}</div>
                </div>
            `;

            div.onclick = () => openChat(chat);
            listContainer.appendChild(div);
        });

        // Проверяем, нужно ли открыть чат по URL (chat.html?chat_id=5)
        const params = new URLSearchParams(window.location.search);
        const urlChatId = params.get('chat_id');
        if (urlChatId && !currentChatId) {
            const targetChat = chats.find(c => c.id == urlChatId);
            if (targetChat) openChat(targetChat);
        }

    } catch (err) {
        console.error(err);
    }
}

async function openChat(chat) {
    currentChatId = chat.id;
    
    // UI переключения
    document.getElementById('no-chat-screen').style.display = 'none';
    document.getElementById('active-chat-screen').style.display = 'flex';
    
    // Подсветка активного в списке
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
    // (тут можно найти div по ID, если бы мы его задали, но пока просто перерисуем список при обновлении)
    
    // Заполняем хедер
    document.getElementById('chat-header-name').innerText = chat.other_name;
    document.getElementById('chat-header-avatar').src = chat.other_avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
    document.getElementById('chat-listing-title').innerText = chat.listing_title;
    document.getElementById('chat-listing-link').href = `/listing.html?id=${chat.listing_id}`;

    // Подключаемся к комнате сокетов
    socket.emit('join_chat', chat.id);

    // Загружаем историю
    loadMessages(chat.id);
}

async function loadMessages(chatId) {
    const area = document.getElementById('messages-area');
    area.innerHTML = '<div style="text-align:center; color:#999; margin-top:20px">Загрузка истории...</div>';

    try {
        const res = await fetch(`/api/chats/${chatId}/messages`);
        const messages = await res.json();

        area.innerHTML = '';
        
        messages.forEach(msg => appendMessage(msg));
        scrollToBottom();

    } catch (err) {
        console.error(err);
    }
}

function appendMessage(msg) {
    const area = document.getElementById('messages-area');
    const div = document.createElement('div');
    
    // Определяем, кто отправил (я или нет)
    const isMy = msg.sender_id === currentUser.id;
    
    div.className = `message ${isMy ? 'my' : 'other'}`;
    
    const time = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    div.innerHTML = `
        ${msg.content}
        <div class="message-time">${time}</div>
    `;

    area.appendChild(div);
}

function scrollToBottom() {
    const area = document.getElementById('messages-area');
    area.scrollTop = area.scrollHeight;
}