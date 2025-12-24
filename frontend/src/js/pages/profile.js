document.addEventListener('DOMContentLoaded', async () => {
    let currentUser = null;
    try {
        const userRes = await fetch('/api/user/me');
        if (userRes.ok) currentUser = await userRes.json();
    } catch (e) { console.error("Ошибка проверки авторизации:", e); }

    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get('id');

    let targetId = urlId;
    let isOwner = false;

    if (!targetId) {
        if (currentUser) {
            targetId = currentUser.id;
            isOwner = true;
        } else {
            window.location.href = '/login.html';
            return;
        }
    } else {
        if (currentUser && String(currentUser.id) === String(targetId)) {
            isOwner = true;
        }
    }

    await loadProfileData(targetId, isOwner);
    loadListings(targetId);
    loadReviews(targetId);
    setupTabs();
    
    if (isOwner) {
        setupOwnerFeatures();
    } else {
        setupGuestFeatures(targetId, currentUser);
    }
});

async function loadProfileData(userId, isOwner) {
    try {
        const endpoint = isOwner ? '/api/user/me' : `/api/user/${userId}`;
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error("User not found");
        const user = await res.json();

        // Если full_name есть в базе - берем его, иначе логин
        const nameToDisplay = user.full_name || user.username;
        document.getElementById('profile-name').innerText = nameToDisplay;
        document.getElementById('profile-login').innerText = `@${user.username}`;
        document.getElementById('stat-rating').innerText = user.rating || '0.0';
        
        if(user.avatar_url) {
            document.getElementById('profile-avatar').src = user.avatar_url;
        }
        
        const date = new Date(user.created_at);
        document.getElementById('join-date').innerText = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

        // ИСПРАВЛЕНИЕ: Заполнение настроек
        if (isOwner) {
            const setFullname = document.getElementById('set-fullname');
            const setUsername = document.getElementById('set-username');
            const setEmail = document.getElementById('set-email');
            const setPhone = document.getElementById('set-phone');

            if(setFullname) setFullname.value = user.full_name || '';
            if(setUsername) setUsername.value = user.username || '';
            if(setEmail) setEmail.value = user.email || '';
            if(setPhone) setPhone.value = user.phone || '';
        }
    } catch (err) {
        console.error(err);
    }
}

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
            for(let i=1; i<=5; i++) {
                stars += i <= review.rating ? "<i class='bx bxs-star' style='color:#FF9500'></i>" : "<i class='bx bx-star' style='color:#ddd'></i>";
            }
            
            // ДОБАВЛЕНИЕ: Форматирование даты и времени
            const dateObj = new Date(review.created_at);
            const formattedDate = dateObj.toLocaleDateString('ru-RU') + ' в ' + dateObj.toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'});

            const html = `
                <div class="review-card">
                    <div class="review-avatar-box">
                        <img src="${review.avatar_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'}" class="review-avatar">
                    </div>
                    <div class="review-content">
                        <div class="review-header">
                            <div>
                                <div class="review-author-name">${review.full_name || review.username}</div>
                                <div class="review-stars-display">${stars}</div>
                            </div>
                            <div class="review-date">${formattedDate}</div>
                        </div>
                        <div class="review-text">${review.comment}</div>
                    </div>
                </div>`;
            container.innerHTML += html;
        });
    } catch(e) { console.error(e); }
}

async function loadListings(userId) {
    const container = document.getElementById('listings-grid');
    try {
        const res = await fetch(`/api/listings?user_id=${userId}`);
        const listings = await res.json();
        container.innerHTML = '';
        if(listings.length === 0) {
            container.innerHTML = '<div class="empty-state">Нет активных объявлений</div>';
            return;
        }
        document.getElementById('stat-listings').innerText = listings.length;
        const soldCount = listings.filter(i => i.status === 'sold').length;
        document.getElementById('stat-sales').innerText = soldCount;

        listings.forEach(item => {
            container.innerHTML += renderCard(item);
        });
    } catch(e) { console.error(e); }
}

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

function setupOwnerFeatures() {
    document.getElementById('avatar-edit-btn').style.display = 'flex';
    document.getElementById('tab-btn-settings').style.display = 'block';
    document.getElementById('profile-actions').innerHTML = `
        <button onclick="location.href='/listing-form.html'" class="btn-profile-primary">
            <i class='bx bx-plus'></i> Добавить товар
        </button>
    `;

    document.getElementById('avatar-input').onchange = async (e) => {
        if(e.target.files.length === 0) return;
        const formData = new FormData();
        formData.append('avatar', e.target.files[0]);
        const res = await fetch('/api/user/update', { method: 'PUT', body: formData });
        if(res.ok) location.reload();
    };

    document.getElementById('settings-form').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = Object.fromEntries(fd.entries());
        
        const res = await fetch('/api/user/update', { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if(res.ok) {
            alert('Данные обновлены!');
            location.reload();
        }
    };
}

function setupGuestFeatures(targetId, currentUser) {
    document.getElementById('profile-actions').innerHTML = `
        <button id="btn-write" class="btn-profile-primary"><i class='bx bx-message-rounded-dots'></i> Написать</button>
        <button id="btn-review" class="btn-profile-secondary"><i class='bx bx-star'></i> Оставить отзыв</button>
    `;

    document.getElementById('btn-write').onclick = () => {
        if (!currentUser) return location.href = '/login.html';
        alert('Перейдите к любому объявлению пользователя, чтобы начать чат.');
    };

    const modal = document.getElementById('review-modal');
    document.getElementById('btn-review').onclick = () => {
        if (!currentUser) return location.href = '/login.html';
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('open'), 10);
    };

    document.getElementById('close-modal').onclick = () => {
        modal.classList.remove('open');
        setTimeout(() => modal.style.display = 'none', 400);
    };

    document.getElementById('review-form').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const res = await fetch('/api/reviews', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ target_id: targetId, rating: fd.get('rating'), comment: fd.get('comment') })
        });
        if(res.ok) location.reload();
        else alert('Ошибка публикации отзыва');
    };
}