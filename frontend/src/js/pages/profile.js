document.addEventListener('DOMContentLoaded', async () => {
    // 1. Получаем данные о себе (кто сейчас залогинен?)
    let currentUser = null;
    try {
        const res = await fetch('/api/user/me');
        if (res.ok) currentUser = await res.json();
    } catch (e) {}

    // 2. Чей профиль смотрим?
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get('id');

    // Если ID в URL нет, или он совпадает с моим -> Режим ВЛАДЕЛЬЦА
    // Если ID есть и он чужой -> Режим ГОСТЯ
    let targetId = urlId;
    let isOwner = false;

    if (!targetId) {
        if (currentUser) {
            targetId = currentUser.id;
            isOwner = true;
        } else {
            window.location.href = '/login.html'; // Не залогинен и не указан ID
            return;
        }
    } else {
        if (currentUser && String(currentUser.id) === String(targetId)) {
            isOwner = true;
        }
    }

    // 3. Загружаем данные профиля
    await loadProfileData(targetId, isOwner);
    
    // 4. Загружаем табы (объявления и отзывы)
    loadListings(targetId);
    loadReviews(targetId);
    
    // 5. Инициализация UI
    setupTabs();
    
    if (isOwner) {
        setupOwnerFeatures(targetId); // Настройки, загрузка аватара
    } else {
        setupGuestFeatures(targetId, currentUser); // Кнопки написать/отзыв
    }
});

// --- ЗАГРУЗКА ДАННЫХ ---
async function loadProfileData(userId, isOwner) {
    try {
        // Используем публичный endpoint для всех, кроме владельца (там расширенный)
        const endpoint = isOwner ? '/api/user/me' : `/api/user/${userId}`;
        const res = await fetch(endpoint);
        
        if (!res.ok) {
            document.body.innerHTML = '<h1 style="text-align:center;margin-top:50px">Пользователь не найден</h1>';
            return;
        }

        const user = await res.json();

        // Заполнение UI
        document.getElementById('profile-name').innerText = user.full_name || user.username;
        document.getElementById('profile-login').innerText = `@${user.username}`;
        document.getElementById('stat-rating').innerText = user.rating || '0.0';
        if(user.avatar_url) document.getElementById('profile-avatar').src = user.avatar_url;
        
        const date = new Date(user.created_at);
        document.getElementById('join-date').innerText = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

        // Если владелец - заполняем форму настроек
        if (isOwner) {
            document.getElementById('set-fullname').value = user.full_name || '';
            document.getElementById('set-username').value = user.username || '';
            document.getElementById('set-email').value = user.email || '';
            document.getElementById('set-phone').value = user.phone || '';
        }

    } catch (err) {
        console.error(err);
    }
}

// --- ОБЪЯВЛЕНИЯ ---
async function loadListings(userId) {
    const container = document.getElementById('listings-grid');
    container.innerHTML = '<div class="empty-state">Загрузка...</div>';

    try {
        const res = await fetch(`/api/listings?user_id=${userId}`);
        const listings = await res.json();

        container.innerHTML = '';
        if(listings.length === 0) {
            container.innerHTML = '<div class="empty-state">Нет активных объявлений</div>';
            document.getElementById('stat-listings').innerText = '0';
            return;
        }

        document.getElementById('stat-listings').innerText = listings.length;

        // Считаем проданные
        const soldCount = listings.filter(i => i.status === 'sold').length;
        document.getElementById('stat-sales').innerText = soldCount;

        listings.forEach(item => {
            container.innerHTML += renderCard(item);
        });
    } catch(e) { container.innerHTML = 'Ошибка'; }
}

// --- ОТЗЫВЫ ---
async function loadReviews(userId) {
    const container = document.getElementById('reviews-container');
    try {
        const res = await fetch(`/api/reviews/${userId}`);
        const reviews = await res.json();
        
        container.innerHTML = '';
        if(reviews.length === 0) {
            container.innerHTML = '<div class="empty-state">Отзывов пока нет</div>';
            return;
        }

        reviews.forEach(review => {
            let stars = '';
            for(let i=1; i<=5; i++) stars += i <= review.rating ? "<i class='bx bxs-star'></i>" : "<i class='bx bx-star'></i>";
            
            const html = `
                <div class="review-card">
                    <div class="review-avatar-box">
                        <img src="${review.avatar_url || 'https://via.placeholder.com/50'}" class="review-avatar">
                    </div>
                    <div class="review-content">
                        <div class="review-header">
                            <div class="review-author-name">${review.full_name || review.username}</div>
                            <div class="review-stars-display">${stars}</div>
                        </div>
                        <div class="review-text">${review.comment}</div>
                    </div>
                </div>`;
            container.innerHTML += html;
        });
    } catch(e) {}
}

// --- UI ФУНКЦИИ ---
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-link');
    const panes = document.querySelectorAll('.tab-pane');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        });
    });
}

// --- ФУНКЦИИ ВЛАДЕЛЬЦА ---
function setupOwnerFeatures(userId) {
    const actions = document.getElementById('profile-actions');
    
    // Кнопка выхода (для мобильных или удобства)
    actions.innerHTML = `
        <button onclick="location.href='/create-listing.html'" class="btn-profile-primary">
            <i class='bx bx-plus'></i> Добавить товар
        </button>
    `;

    // Показываем кнопку смены аватара
    document.getElementById('avatar-edit-btn').style.display = 'flex';
    
    // Показываем таб настроек
    document.getElementById('tab-btn-settings').style.display = 'block';

    // Логика загрузки аватара
    const fileInput = document.getElementById('avatar-input');
    fileInput.onchange = async () => {
        if(fileInput.files.length === 0) return;
        const formData = new FormData();
        formData.append('avatar', fileInput.files[0]);
        await fetch('/api/user/update', { method: 'PUT', body: formData });
        location.reload();
    };

    // Логика сохранения настроек
    document.getElementById('settings-form').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        await fetch('/api/user/update', { method: 'PUT', body: fd });
        alert('Сохранено');
        location.reload();
    };
}

// --- ФУНКЦИИ ГОСТЯ ---
function setupGuestFeatures(targetId, currentUser) {
    const actions = document.getElementById('profile-actions');
    
    // Кнопки "Написать" и "Отзыв"
    actions.innerHTML = `
        <button id="btn-write" class="btn-profile-primary">
            <i class='bx bx-message-rounded-dots'></i> Написать
        </button>
        <button id="btn-review" class="btn-profile-secondary">
            <i class='bx bx-star'></i> Оставить отзыв
        </button>
    `;

    // Логика "Написать"
    document.getElementById('btn-write').onclick = async () => {
        if (!currentUser) return location.href = '/login.html';
        
        // Находим любой товар этого юзера для контекста
        // Упрощенно: если нет товаров, не даем создать. Или создаем без товара (если бэкенд позволит)
        // Для твоего бэкенда нужен listing_id.
        // Здесь можно дописать логику: взять последний товар из загруженного списка.
        const listings = document.querySelectorAll('.card'); // Грубый способ
        // Но лучше использовать глобальную переменную (если сохраняли) или просто редирект
        alert('Чтобы написать, перейдите на страницу товара этого пользователя'); 
        // Или редирект на /chat.html если бэкенд поддерживает чат без товара (пока нет)
    };

    // Логика "Отзыв"
    const modal = document.getElementById('review-modal');
    document.getElementById('btn-review').onclick = () => {
        if (!currentUser) return location.href = '/login.html';
        modal.style.display = 'flex'; setTimeout(()=>modal.classList.add('open'),10);
    };
    
    // Закрытие модалки
    document.getElementById('close-modal').onclick = () => {
        modal.classList.remove('open'); setTimeout(()=>modal.style.display='none',300);
    };

    // Отправка отзыва
    document.getElementById('review-form').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const res = await fetch('/api/reviews', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ target_id: targetId, rating: fd.get('rating'), comment: fd.get('comment') })
        });
        if(res.ok) location.reload();
        else alert('Ошибка');
    };
}