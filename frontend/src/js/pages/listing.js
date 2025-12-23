document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const listingId = params.get('id');

    if (!listingId) {
        window.location.href = '/';
        return;
    }

    loadListingDetails(listingId);
});

let currentListing = null;
let currentUser = null;

async function loadListingDetails(id) {
    try {
        // 1. Получаем пользователя
        try {
            const userRes = await fetch('/api/user/me');
            if (userRes.ok) currentUser = await userRes.json();
        } catch (e) {}

        // 2. Получаем товар
        const res = await fetch(`/api/listings/${id}`);
        if (!res.ok) throw new Error(`Ошибка: ${res.status}`);
        
        const data = await res.json();
        currentListing = data;

        // Конвертация
        data.price = parseFloat(data.price);
        data.auction_start_price = parseFloat(data.auction_start_price);
        if (data.current_max_bid) data.current_max_bid = parseFloat(data.current_max_bid);
        if (data.auction_step) data.auction_step = parseFloat(data.auction_step);

        // Рендеринг
        renderGallery(data.images);
        renderInfo(data);
        
        // Статусы
        if (data.status === 'sold') {
            showSoldState();
        } else if (data.type === 'auction') {
            setupAuction(data);
        } else {
            renderStandardPrice(data);
        }

        // Владелец
        checkOwner(data);
        
        // Логика кнопок действий
        setupActionButtons(data);

    } catch (err) {
        console.error(err);
        document.getElementById('main-content').innerHTML = `
            <div style="text-align:center; padding:100px 20px;">
                <i class='bx bx-error-circle' style='font-size:50px; color:#ccc'></i>
                <h1>Не удалось загрузить объявление</h1>
                <a href="/" class="btn-secondary-action" style="display:inline-block; margin-top:20px">На главную</a>
            </div>
        `;
    }
}

// --- ГАЛЕРЕЯ ---
function renderGallery(images) {
    const mainImg = document.getElementById('main-img');
    const thumbsContainer = document.getElementById('thumbs-container');
    thumbsContainer.innerHTML = ''; 

    if (!images || images.length === 0) {
        mainImg.src = 'https://via.placeholder.com/800x600?text=No+Photo';
        return;
    }

    // Fade эффект при смене
    function setMainImage(src) {
        mainImg.style.opacity = '0';
        setTimeout(() => {
            mainImg.src = src;
            mainImg.style.opacity = '1';
        }, 200);
    }

    setMainImage(images[0].image_url);

    images.forEach((img, idx) => {
        const thumb = document.createElement('img');
        thumb.src = img.image_url;
        thumb.className = idx === 0 ? 'thumb active' : 'thumb';
        
        thumb.addEventListener('click', () => {
            setMainImage(img.image_url);
            document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
        });
        thumbsContainer.appendChild(thumb);
    });
}

// --- ИНФОРМАЦИЯ ---
function renderInfo(data) {
    document.getElementById('listing-title').innerText = data.title;
    document.getElementById('desc-text').innerText = data.description;
    document.getElementById('publish-date').innerText = new Date(data.created_at).toLocaleDateString();
    document.getElementById('listing-id-display').innerText = data.id;

    // Плашка (Overlay)
    const badge = document.getElementById('type-badge');
    const badgeStyles = {
        'service': { text: 'Услуга', bg: 'rgba(255, 149, 0, 0.8)' },
        'rent': { text: 'Аренда', bg: 'rgba(131, 56, 236, 0.8)' },
        'auction': { text: 'Аукцион', bg: 'rgba(255, 59, 48, 0.8)' },
        'sell': { text: 'Товар', bg: 'rgba(58, 134, 255, 0.8)' }
    };
    
    const style = badgeStyles[data.type] || badgeStyles['sell'];
    badge.className = 'status-badge-overlay';
    badge.innerText = style.text;
    badge.style.background = style.bg;

    // Продавец
    document.getElementById('seller-name').innerText = data.full_name || data.username;
    document.getElementById('seller-rating').innerText = data.author_rating || '0.0';
    if (data.author_avatar) document.getElementById('seller-ava').src = data.author_avatar;
    
    document.getElementById('seller-link').onclick = () => {
        window.location.href = `/public-profile.html?id=${data.user_id}`;
    };

    // Кнопка избранного
    const favBtn = document.getElementById('fav-btn');
    if (data.is_favorite) {
        favBtn.innerHTML = `<i class='bx bxs-heart' style="color:#FF3B30"></i> В избранном`;
        favBtn.style.color = '#FF3B30';
    }
    favBtn.onclick = () => {
        if(window.toggleFav) {
            window.toggleFav(favBtn, data.id);
            // Визуальное обновление текста
            const isFav = favBtn.innerHTML.includes('bxs-heart');
            if(isFav) {
                favBtn.innerHTML = `<i class='bx bx-heart'></i> Добавить в избранное`;
                favBtn.style.color = '#777';
            } else {
                favBtn.innerHTML = `<i class='bx bxs-heart' style="color:#FF3B30"></i> В избранном`;
                favBtn.style.color = '#FF3B30';
            }
        }
    };
}

// --- ЦЕНЫ И АУКЦИОН ---
function renderStandardPrice(data) {
    const priceEl = document.getElementById('price-val');
    const labelEl = document.getElementById('price-label');
    
    let priceNum = typeof data.price === 'number' ? data.price : parseFloat(data.price);
    let priceText = Math.floor(priceNum).toLocaleString('ru-RU') + ' ₽';
    let label = 'Цена';

    if (data.type === 'rent') {
        label = 'Стоимость аренды';
        priceText += ` <span class="price-unit">/ ${data.price_unit || 'сутки'}</span>`;
    } else if (data.type === 'service') {
        label = 'Стоимость услуги';
        if (data.is_price_from) priceText = 'от ' + priceText;
        if (data.price_unit) priceText += ` <span class="price-unit">/ ${data.price_unit}</span>`;
    }

    labelEl.innerText = label;
    priceEl.innerHTML = priceText;
    document.getElementById('standard-actions').style.display = 'flex';
}

function setupAuction(data) {
    document.getElementById('standard-actions').style.display = 'none'; // Скрываем обычные кнопки
    document.getElementById('auction-interface').style.display = 'block';
    
    document.getElementById('price-label').innerText = 'Начальная цена';
    document.getElementById('price-val').innerText = Math.floor(data.auction_start_price) + ' ₽';

    const currentPrice = data.current_max_bid || data.auction_start_price;
    document.getElementById('current-bid').innerText = Math.floor(currentPrice) + ' ₽';

    // Таймер
    const endDate = new Date(data.auction_end_date).getTime();
    
    if (window.auctionInterval) clearInterval(window.auctionInterval);

    function updateTimer() {
        const now = new Date().getTime();
        const distance = endDate - now;

        if (distance < 0) {
            clearInterval(window.auctionInterval);
            finishAuction(data);
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        document.getElementById('t-days').innerText = days;
        document.getElementById('t-hours').innerText = hours.toString().padStart(2, '0');
        document.getElementById('t-min').innerText = minutes.toString().padStart(2, '0');
        document.getElementById('t-sec').innerText = seconds.toString().padStart(2, '0');
    }

    updateTimer();
    window.auctionInterval = setInterval(updateTimer, 1000);

    // История
    renderBidHistory(data);
    
    // Форма ставки
    const form = document.getElementById('bid-form');
    // ... (логика отправки ставки такая же как в прошлом ответе) ...
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = document.getElementById('bid-input').value;
        const msg = document.getElementById('bid-msg');
        try {
            const res = await fetch('/api/listings/bid', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ listing_id: data.id, amount: amount })
            });
            const result = await res.json();
            if(res.ok) {
                msg.innerText = '✅ Принято!';
                msg.style.color = 'green';
                setTimeout(() => location.reload(), 1000);
            } else {
                msg.innerText = `❌ ${result.message}`;
                msg.style.color = 'red';
            }
        } catch(e) { msg.innerText = 'Ошибка'; }
    });
}

function finishAuction(data) {
    document.querySelector('.timer-display').innerHTML = '<div style="width:100%; background:#d4edda; color:#155724; padding:10px; border-radius:10px;">Аукцион завершен</div>';
    document.getElementById('bid-form').style.display = 'none';
}

function renderBidHistory(data) {
    const list = document.getElementById('bid-history');
    list.innerHTML = '';
    if(data.bid_history?.length) {
        data.bid_history.forEach(bid => {
            list.innerHTML += `<div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #eee;"><span>${bid.username}</span><b>${Math.floor(bid.amount)} ₽</b></div>`;
        });
    } else { list.innerHTML = '<div style="text-align:center; color:#ccc;">Ставок нет</div>'; }
}

// --- ДЕЙСТВИЯ ---
function setupActionButtons(data) {
    // Телефон
    const btnPhone = document.getElementById('btn-show-phone');
    if (btnPhone) {
        btnPhone.onclick = () => {
            if (localStorage.getItem('isLoggedIn') !== 'true') return window.location.href = '/login.html';
            btnPhone.innerHTML = `<i class='bx bx-phone'></i> ${data.phone || 'Скрыт'}`;
            btnPhone.style.background = '#2ecc71';
        };
    }

    // Чат
    const btnMsg = document.getElementById('btn-write-msg');
    if (btnMsg) {
        btnMsg.onclick = async () => {
            if (localStorage.getItem('isLoggedIn') !== 'true') return window.location.href = '/login.html';
            try {
                const res = await fetch('/api/chats', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ listing_id: data.id, seller_id: data.user_id })
                });
                const chat = await res.json();
                if(res.ok) window.location.href = `/chat.html?chat_id=${chat.id}`;
                else alert(chat.message);
            } catch(e) { console.error(e); }
        };
    }
}

// --- УПРАВЛЕНИЕ ВЛАДЕЛЬЦА ---
function checkOwner(data) {
    if (currentUser && currentUser.id === data.user_id) {
        document.getElementById('owner-controls').style.display = 'block';
        document.getElementById('standard-actions').style.display = 'none';
        
        // --- ДОБАВЛЕНА КНОПКА РЕДАКТИРОВАТЬ ---
        // Создаем кнопку динамически или добавь её в HTML заранее
        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn-secondary-action';
        btnEdit.style.width = '100%';
        btnEdit.style.marginBottom = '10px';
        btnEdit.innerHTML = `<i class='bx bx-edit'></i> Редактировать`;
        btnEdit.onclick = () => window.location.href = `/edit-listing.html?id=${data.id}`;
        
        // Вставляем её первой в action-btn-group
        const group = document.querySelector('#owner-controls .action-btn-group');
        group.insertBefore(btnEdit, group.firstChild);
        // Удаление
        document.getElementById('btn-delete').onclick = async () => {
            if(confirm('Удалить навсегда?')) {
                await fetch(`/api/listings/${data.id}`, { method: 'DELETE' });
                window.location.href = '/profile.html';
            }
        };
        // Статус
        const btnSold = document.getElementById('btn-mark-sold');
        btnSold.innerText = data.status === 'sold' ? 'Вернуть в продажу' : 'Снять с продажи';
        btnSold.onclick = async () => {
            await fetch(`/api/listings/${data.id}/status`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ status: data.status === 'sold' ? 'active' : 'sold' })
            });
            location.reload();
        };
    }
}

function showSoldState() {
    document.getElementById('price-val').innerText = 'ПРОДАНО';
    document.getElementById('price-val').style.color = '#aaa';
    document.getElementById('standard-actions').style.display = 'none';
    document.getElementById('auction-interface').style.display = 'none';
    document.getElementById('type-badge').style.background = '#666';
    document.getElementById('type-badge').innerText = 'ПРОДАНО';
}

// Модалка жалоб (глобальные)
window.openReportModal = () => {
    if (localStorage.getItem('isLoggedIn') !== 'true') return window.location.href = '/login.html';
    const m = document.getElementById('report-modal'); m.style.display='flex'; setTimeout(()=>m.classList.add('open'),10);
};
window.closeReportModal = () => {
    const m = document.getElementById('report-modal'); m.classList.remove('open'); setTimeout(()=>m.style.display='none',300);
};
document.getElementById('report-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    await fetch('/api/listings/report', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ listing_id: currentListing.id, reason: data.get('reason'), comment: data.get('comment') })
    });
    closeReportModal();
    alert('Жалоба отправлена');
});