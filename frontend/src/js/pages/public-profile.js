document.addEventListener('DOMContentLoaded', () => {
    // Получаем ID из URL: public-profile.html?id=123
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');

    if (!userId) {
        alert('Пользователь не указан');
        window.location.href = '/';
        return;
    }

    loadPublicProfile(userId);
    setupTabs();
    
    // Логика кнопки "Написать"
    document.getElementById('write-msg-btn').addEventListener('click', () => {
        // Проверка авторизации
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        if (!isLoggedIn) {
            window.location.href = '/login.html';
        } else {
            // Переход в чат с этим юзером (функционал чатов будем делать позже)
            alert('Переход в чат с пользователем ID: ' + userId);
            // window.location.href = `/chat.html?with=${userId}`;
        }
    });
});

async function loadPublicProfile(id) {
    try {
        const res = await fetch(`/api/user/${id}`);
        
        if (res.status === 404) {
            document.querySelector('.main-container').innerHTML = '<h1 style="text-align:center; margin-top:50px;">Пользователь не найден</h1>';
            return;
        }

        const user = await res.json();

        // Заполняем данные
        document.getElementById('profile-name').innerText = user.username;
        document.getElementById('profile-rating').innerText = user.rating || '0.0';
        
        if (user.avatar_url) {
            document.getElementById('profile-avatar-img').src = user.avatar_url;
        }

        // Дата
        const date = new Date(user.created_at);
        document.getElementById('join-date').innerText = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

        // Если это мой собственный профиль -> редирект на "Мой профиль"
        // (Опционально, но удобно)
        checkIfMe(user.id);

    } catch (err) {
        console.error(err);
    }
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        });
    });
}

// Проверка: "Это я?"
function checkIfMe(profileId) {
    const myData = localStorage.getItem('user'); // Мы не храним ID в localStorage в login.js, только имя
    // Лучше сделать запрос /api/user/me и сравнить ID, но пока оставим как есть.
    // Если бы мы хранили ID:
    // const me = JSON.parse(myData);
    // if(me && me.id === profileId) window.location.href = '/profile.html';
}

// Загрузка объявлений этого пользователя (НОВАЯ ФУНКЦИЯ)
async function loadUserListings(userId) {
    const container = document.getElementById('listings-container');
    container.innerHTML = '<div style="width:100%; text-align:center">Загрузка объявлений...</div>';

    try {
        // Запрашиваем объявления конкретного пользователя
        const res = await fetch(`/api/listings?user_id=${userId}`);
        const listings = await res.json();

        container.innerHTML = ''; // Очищаем "Загрузку"

        // Если пусто
        if (listings.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class='bx bx-ghost'></i>
                    <h3>Здесь пусто</h3>
                    <p>Пользователь пока ничего не продает</p>
                </div>
            `;
            updateStats(0);
            return;
        }

        // Обновляем цифру "Товаров" в шапке
        updateStats(listings.length);

        // Рисуем карточки
        listings.forEach(item => {
            // renderCard - это функция из card-renderer.js
            container.innerHTML += renderCard(item);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="empty-state">Ошибка загрузки</div>';
    }
}

function updateStats(count) {
    // Ищем элемент "Товаров" в шапке профиля. 
    // В HTML это первый .stat-value
    const stats = document.querySelectorAll('.stat-value');
    if(stats[0]) stats[0].innerText = count;
}