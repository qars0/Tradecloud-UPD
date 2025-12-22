document.addEventListener('DOMContentLoaded', () => {
    // 1. Получаем ID из URL (например: public-profile.html?id=1)
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');

    if (!userId) {
        document.querySelector('.main-container').innerHTML = 
            '<h1 style="text-align:center; margin-top:50px;">Пользователь не указан</h1>';
        return;
    }

    // 2. Запускаем загрузку данных
    loadPublicProfile(userId);
    loadUserListings(userId);
    setupTabs();
    
    // Логика кнопки "Написать"
    document.getElementById('write-msg-btn').addEventListener('click', () => {
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        if (!isLoggedIn) {
            window.location.href = '/login.html';
        } else {
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

        // ОБНОВЛЕНИЕ: Показываем Имя Фамилию, если есть, иначе логин
        document.getElementById('profile-name').innerText = user.full_name || user.username;
        
        document.getElementById('profile-rating').innerText = user.rating || '0.0';
        
        if (user.avatar_url) {
            document.getElementById('profile-avatar-img').src = user.avatar_url;
        }

        // Статус (можно доработать логику онлайн/оффлайн позже)
        // Пока просто ставим серый
        const statusText = document.getElementById('status-text');
        const statusIndicator = document.getElementById('status-indicator');
        // if (user.is_online) ... (это на будущее)

        // Дата регистрации
        const date = new Date(user.created_at);
        document.getElementById('join-date').innerText = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

        // Проверка "Это я?"
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

// --- Загрузка объявлений пользователя ---
async function loadUserListings(userId) {
    const container = document.getElementById('listings-container');
    
    try {
        // Запрос к API
        const res = await fetch(`/api/listings?user_id=${userId}`);
        const listings = await res.json();

        container.innerHTML = ''; // Очищаем "Загрузка..."

        if (listings.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class='bx bx-package'></i>
                    <h3>Нет активных объявлений</h3>
                    <p>У пользователя пока нет товаров на продажу</p>
                </div>
            `;
            updateStats(0);
            return;
        }

        // Обновляем счетчик
        updateStats(listings.length);

        // Рендерим карточки
        listings.forEach(item => {
            // Функция renderCard берется из card-renderer.js
            if (typeof renderCard === 'function') {
                container.innerHTML += renderCard(item);
            } else {
                console.error('renderCard is not defined. Проверьте подключение скрипта.');
            }
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="empty-state">Ошибка загрузки объявлений</div>';
    }
}

function updateStats(count) {
    const statCount = document.getElementById('stat-count');
    if(statCount) statCount.innerText = count;
}