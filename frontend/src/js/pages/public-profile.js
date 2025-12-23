document.addEventListener('DOMContentLoaded', () => {
    // 1. Получаем ID из URL
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');

    if (!userId) {
        document.querySelector('.main-container').innerHTML = 
            '<h1 style="text-align:center; margin-top:50px;">Пользователь не указан</h1>';
        return;
    }

    // 2. Запускаем загрузку
    loadPublicProfile(userId);
    loadUserListings(userId);
    setupTabs();
    loadUserReviews(userId);
    setupReviewModal(userId);
    
    // 3. Логика кнопки "Написать"
    const writeBtn = document.getElementById('write-msg-btn');
    
    writeBtn.addEventListener('click', async () => {
        // Проверка авторизации
        if (localStorage.getItem('isLoggedIn') !== 'true') {
            window.location.href = '/login.html';
            return;
        }

        // Проверка: нельзя писать самому себе
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        // (ID юзера в localStorage мы не храним в явном виде в старой версии, 
        // но бэкенд все равно не даст создать чат с собой, вернет ошибку)

        // Проверка: есть ли товары для обсуждения?
        if (!userActiveListings || userActiveListings.length === 0) {
            alert('У этого пользователя нет активных объявлений для начала сделки.');
            return;
        }

        // Берем последнее объявление (первое в списке) как контекст диалога
        const contextListing = userActiveListings[0];
        
        // Меняем текст кнопки на загрузку
        const originalText = writeBtn.innerHTML;
        writeBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Создание...';
        writeBtn.disabled = true;

        try {
            // Создаем чат через API
            const res = await fetch('/api/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    listing_id: contextListing.id, 
                    seller_id: userId 
                })
            });

            const data = await res.json();
            
            if (res.ok) {
                // Переходим в чат
                window.location.href = `/chat.html?chat_id=${data.id}`;
            } else {
                alert(data.message || 'Ошибка создания чата');
                writeBtn.innerHTML = originalText;
                writeBtn.disabled = false;
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка сети');
            writeBtn.innerHTML = originalText;
            writeBtn.disabled = false;
        }
    });
});

// Глобальная переменная для хранения объявлений
let userActiveListings = [];

// --- Загрузка профиля ---
async function loadPublicProfile(id) {
    try {
        const res = await fetch(`/api/user/${id}`);
        
        if (res.status === 404) {
            document.querySelector('.main-container').innerHTML = 
                '<h1 style="text-align:center; margin-top:50px;">Пользователь не найден</h1>';
            return;
        }

        const user = await res.json();

        document.getElementById('profile-name').innerText = user.full_name || user.username;
        document.getElementById('profile-rating').innerText = user.rating || '0.0';
        
        if (user.avatar_url) {
            document.getElementById('profile-avatar-img').src = user.avatar_url;
        }

        // Онлайн/Оффлайн (имитация)
        const statusText = document.getElementById('status-text');
        const statusIndicator = document.getElementById('status-indicator');
        // Можно добавить логику рандома или реального статуса
        statusText.innerText = "В сети";
        statusIndicator.style.background = "#2ecc71"; // Зеленый

        const date = new Date(user.created_at);
        document.getElementById('join-date').innerText = 
            date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

        // Если это мой профиль - скрываем кнопку "Написать"
        // (Точная проверка требует запроса /api/user/me, но пока оставим так)

    } catch (err) {
        console.error('Ошибка загрузки профиля:', err);
    }
}

// --- Загрузка объявлений ---
async function loadUserListings(userId) {
    const container = document.getElementById('listings-container');
    
    try {
        const res = await fetch(`/api/listings?user_id=${userId}`);
        const listings = await res.json();

        // Сохраняем в глобальную переменную
        userActiveListings = listings;

        container.innerHTML = '';

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

        updateStats(listings.length);

        listings.forEach(item => {
            if (typeof renderCard === 'function') {
                container.innerHTML += renderCard(item);
            }
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="empty-state">Ошибка загрузки объявлений</div>';
    }
}

// --- Вспомогательные функции ---

function updateStats(count) {
    const statCount = document.getElementById('stat-count');
    if(statCount) statCount.innerText = count;
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

// --- ЗАГРУЗКА ОТЗЫВОВ ---
async function loadUserReviews(userId) {
    const container = document.getElementById('reviews-container');
    
    try {
        const res = await fetch(`/api/reviews/${userId}`);
        const reviews = await res.json();

        container.innerHTML = '';

        if (reviews.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:50px; color:#999;">
                    <i class='bx bx-star' style="font-size:48px; opacity:0.5"></i>
                    <p>Отзывов пока нет. Будьте первым!</p>
                </div>
            `;
            return;
        }

        reviews.forEach(review => {
            // Генерируем звезды
            let starsHtml = '';
            for(let i=1; i<=5; i++) {
                if(i <= review.rating) starsHtml += "<i class='bx bxs-star'></i>";
                else starsHtml += "<i class='bx bx-star' style='color:#ddd'></i>";
            }

            const date = new Date(review.created_at).toLocaleDateString('ru-RU');

            const html = `
                <div class="review-card">
                    <div class="review-avatar-box">
                        <img src="${review.avatar_url || 'https://via.placeholder.com/50'}" class="review-avatar">
                    </div>
                    <div class="review-content">
                        <div class="review-header">
                            <div>
                                <div class="review-author-name">${review.full_name || review.username}</div>
                                <div class="review-stars-display">${starsHtml}</div>
                            </div>
                            <div class="review-date">${date}</div>
                        </div>
                        <div class="review-text">${review.comment || ''}</div>
                    </div>
                </div>
            `;
            container.innerHTML += html;
        });

    } catch (err) {
        console.error(err);
    }
}

// --- МОДАЛЬНОЕ ОКНО ---
function setupReviewModal(targetUserId) {
    const modal = document.getElementById('review-modal');
    const openBtn = document.getElementById('write-review-btn');
    const closeBtn = document.getElementById('close-modal');
    const form = document.getElementById('review-form');

    // Открытие
    openBtn.addEventListener('click', () => {
        if (localStorage.getItem('isLoggedIn') !== 'true') {
            window.location.href = '/login.html';
            return;
        }
        modal.classList.add('open');
    });

    // Закрытие
    closeBtn.addEventListener('click', () => modal.classList.remove('open'));
    
    // Закрытие по клику вне окна
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
    });

    // Отправка формы
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const rating = formData.get('rating');
        const comment = formData.get('comment');

        try {
            const res = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: targetUserId, rating, comment })
            });

            const data = await res.json();

            if (res.ok) {
                alert('Спасибо за отзыв!');
                modal.classList.remove('open');
                form.reset();
                // Обновляем список и рейтинг без перезагрузки
                loadUserReviews(targetUserId);
                document.getElementById('profile-rating').innerText = data.newRating;
            } else {
                alert(data.message); // Например "Нельзя писать самому себе"
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка сети');
        }
    });
}