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
let currentUser = null; // Данные текущего юзера

async function loadListingDetails(id) {
    try {
        // 1. Получаем инфо о текущем юзере (чтобы проверить, владелец ли он)
        // Если ошибка (не авторизован) - currentUser останется null
        try {
            const userRes = await fetch('/api/user/me');
            if (userRes.ok) currentUser = await userRes.json();
        } catch (e) {}

        // 2. Получаем объявление
        const res = await fetch(`/api/listings/${id}`);
        if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
        
        const data = await res.json();
        currentListing = data;

        // Преобразование типов
        data.price = parseFloat(data.price);
        data.auction_start_price = parseFloat(data.auction_start_price);
        if (data.current_max_bid) data.current_max_bid = parseFloat(data.current_max_bid);
        if (data.auction_step) data.auction_step = parseFloat(data.auction_step);

        // Рендеринг
        renderGallery(data.images);
        renderInfo(data);
        setupPhoneButton(data);
        
        // Проверяем статус
        if (data.status === 'sold') {
            showSoldState();
        } else {
            if (data.type === 'auction') {
                setupAuction(data);
            } else {
                renderStandardPrice(data);
            }
        }

        // 3. Проверяем владельца
        checkOwner(data);

    } catch (err) {
        console.error('CRITICAL ERROR:', err);
        document.getElementById('main-content').innerHTML = `
            <div style="text-align:center; padding: 50px;">
                <h1 style="color:red">Ошибка</h1>
                <p>${err.message}</p>
                <a href="/" class="btn-create" style="margin-top:20px">На главную</a>
            </div>
        `;
    }
}

// Проверка владельца и отрисовка кнопок управления
function checkOwner(data) {
    if (currentUser && currentUser.id === data.user_id) {
        // Показываем панель
        const panel = document.getElementById('owner-controls');
        panel.style.display = 'block';

        // Кнопка "Удалить"
        document.getElementById('btn-delete').onclick = async () => {
            if (confirm('Вы уверены, что хотите удалить объявление? Это действие нельзя отменить.')) {
                try {
                    const res = await fetch(`/api/listings/${data.id}`, { method: 'DELETE' });
                    if (res.ok) {
                        alert('Объявление удалено');
                        window.location.href = '/profile.html';
                    }
                } catch (e) { alert('Ошибка удаления'); }
            }
        };

        // Кнопка "Продано"
        const btnSold = document.getElementById('btn-mark-sold');
        if (data.status === 'sold') {
            btnSold.innerText = 'Вернуть в продажу';
            btnSold.onclick = () => updateStatus(data.id, 'active');
        } else {
            btnSold.innerText = 'Снять с продажи (Продано)';
            btnSold.onclick = () => updateStatus(data.id, 'sold');
        }

        // Владельцу не показываем кнопки "Купить" у самого себя
        const stdActions = document.getElementById('standard-actions');
        if (stdActions) stdActions.style.display = 'none';
        
        // Владельцу не даем делать ставки
        const bidForm = document.getElementById('bid-form');
        if (bidForm) bidForm.innerHTML = '<p style="color:#777; text-align:center">Вы организатор этого аукциона</p>';
    }
}

async function updateStatus(id, status) {
    try {
        const res = await fetch(`/api/listings/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: status })
        });
        if (res.ok) location.reload();
    } catch (e) { alert('Ошибка обновления статуса'); }
}

function showSoldState() {
    document.getElementById('price-val').innerText = 'ПРОДАНО';
    document.getElementById('price-val').style.color = '#999';
    document.getElementById('standard-actions').style.display = 'none';
    document.getElementById('auction-interface').style.display = 'none';
    
    // Добавляем бейдж на картинку
    const badge = document.getElementById('type-badge');
    badge.innerHTML = '<span class="card__badge" style="background:gray; font-size:16px; padding:8px 15px;">ПРОДАНО</span>';
}

// ... renderGallery и renderInfo (оставляем те же, что и были в прошлом ответе) ...
function renderGallery(images) {
    const mainImg = document.getElementById('main-img');
    const thumbsContainer = document.getElementById('thumbs-container');
    thumbsContainer.innerHTML = ''; 
    if (!images || images.length === 0) {
        mainImg.src = 'https://via.placeholder.com/600x400?text=No+Photo';
        return;
    }
    mainImg.src = images[0].image_url;
    images.forEach((img, idx) => {
        const thumb = document.createElement('img');
        thumb.src = img.image_url;
        thumb.className = idx === 0 ? 'thumb active' : 'thumb';
        thumb.addEventListener('click', () => {
            mainImg.src = img.image_url;
            document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
        });
        thumbsContainer.appendChild(thumb);
    });
}

function renderInfo(data) {
    document.getElementById('listing-title').innerText = data.title;
    document.getElementById('desc-text').innerText = data.description;
    document.getElementById('publish-date').innerText = new Date(data.created_at).toLocaleDateString();
    
    // Плашка типа
    const badge = document.getElementById('type-badge');
    let badgeHtml = '';
    if (data.type === 'service') badgeHtml = '<span class="card__badge badge--service">Услуга</span>';
    else if (data.type === 'rent') badgeHtml = '<span class="card__badge badge--rent">Аренда</span>';
    else if (data.type === 'auction') badgeHtml = '<span class="card__badge badge--top">Аукцион</span>';
    else if (data.type === 'sell') badgeHtml = '<span class="card__badge" style="background-color: #3A86FF;">Товар</span>';
    badge.innerHTML = badgeHtml;

    document.getElementById('seller-name').innerText = data.full_name || data.username;
    document.getElementById('seller-rating').innerText = data.author_rating || '0.0';
    if (data.author_avatar) document.getElementById('seller-ava').src = data.author_avatar;
    document.getElementById('seller-link').onclick = () => {
        window.location.href = `/public-profile.html?id=${data.user_id}`;
    };

    // Избранное
    const favBtn = document.getElementById('fav-btn');
    if (favBtn) {
        const favIcon = favBtn.querySelector('i');
        if (data.is_favorite) {
            favIcon.className = 'bx bxs-heart';
            favIcon.style.color = '#FF3B30';
            favBtn.innerHTML = `<i class='bx bxs-heart' style="color:#FF3B30; font-size:20px"></i> В избранном`;
        }
        favBtn.onclick = () => {
             if (window.toggleFav) window.toggleFav(favBtn, data.id);
             else alert('Функция доступна в каталоге');
        };
    }
}

function renderStandardPrice(data) {
    const priceEl = document.getElementById('price-val');
    const labelEl = document.getElementById('price-label');
    let priceNum = typeof data.price === 'number' ? data.price : parseFloat(data.price);
    let priceText = Math.floor(priceNum).toLocaleString('ru-RU') + ' ₽';
    
    if (data.type === 'rent') {
        labelEl.innerText = 'Стоимость аренды';
        priceText += ` / ${data.price_unit || 'сутки'}`;
    } else if (data.type === 'service') {
        labelEl.innerText = 'Стоимость услуги';
        if (data.is_price_from) priceText = 'от ' + priceText;
        if (data.price_unit) priceText += ` / ${data.price_unit}`;
    }
    priceEl.innerHTML = priceText;
    document.getElementById('standard-actions').style.display = 'block';
    document.getElementById('auction-interface').style.display = 'none';
}

// 4. Логика АУКЦИОНА
function setupAuction(data) {
    document.getElementById('standard-actions').style.display = 'none';
    document.getElementById('auction-interface').style.display = 'block';
    document.getElementById('price-label').innerText = 'Начальная цена';
    document.getElementById('price-val').innerText = Math.floor(data.auction_start_price) + ' ₽';

    const currentPrice = data.current_max_bid || data.auction_start_price;
    document.getElementById('current-bid').innerText = Math.floor(currentPrice) + ' ₽';
    document.getElementById('bid-step').innerText = data.auction_step;

    const endDate = new Date(data.auction_end_date).getTime();
    
    if (window.auctionInterval) clearInterval(window.auctionInterval);

    window.auctionInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = endDate - now;
        const timerEl = document.getElementById('timer-val');
        if (!timerEl) return;

        if (distance < 0) {
            clearInterval(window.auctionInterval);
            finishAuction(data); // Вызываем функцию завершения
        } else {
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            timerEl.innerText = `${days}д ${hours}ч ${minutes}м ${seconds}с`;
        }
    }, 1000);

    // Сразу проверяем, вдруг уже закончился
    if (endDate - new Date().getTime() < 0) {
        finishAuction(data);
    }

    renderBidHistory(data);
    setupBidForm(data);
}

// Функция окончания аукциона
function finishAuction(data) {
    const timerBox = document.getElementById('timer-box');
    timerBox.innerHTML = "<i class='bx bx-check-circle'></i> АУКЦИОН ЗАВЕРШЕН";
    timerBox.style.background = '#d4edda'; // Зеленый фон
    timerBox.style.color = '#155724';

    document.getElementById('bid-form').style.display = 'none';

    // Определяем победителя
    const resultBox = document.createElement('div');
    resultBox.style.marginTop = '20px';
    resultBox.style.padding = '15px';
    resultBox.style.borderRadius = '10px';
    resultBox.style.textAlign = 'center';

    if (data.bid_history && data.bid_history.length > 0) {
        const winner = data.bid_history[0]; // Первая в массиве - последняя ставка
        resultBox.style.background = '#FFF3CD';
        resultBox.style.border = '1px solid #FFEEBA';
        resultBox.innerHTML = `
            <div style="font-size: 14px; color: #856404;">Победитель:</div>
            <div style="font-size: 18px; font-weight: bold; margin-top:5px;">${winner.username}</div>
            <div style="font-size: 20px; color: var(--primary-color); font-weight: bold;">${Math.floor(winner.amount)} ₽</div>
        `;
    } else {
        resultBox.style.background = '#f8f9fa';
        resultBox.innerHTML = 'Ставок не было';
    }

    // Вставляем блок победителя после таймера
    if (!document.getElementById('winner-box')) {
        resultBox.id = 'winner-box';
        timerBox.after(resultBox);
    }
}

function renderBidHistory(data) {
    const historyContainer = document.getElementById('bid-history');
    historyContainer.innerHTML = '';
    if (data.bid_history && data.bid_history.length > 0) {
        data.bid_history.forEach(bid => {
            const time = new Date(bid.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            historyContainer.innerHTML += `
                <div class="history-item">
                    <span>${bid.username}</span>
                    <b>${Math.floor(bid.amount)} ₽</b>
                    <span style="color:#999">${time}</span>
                </div>
            `;
        });
    } else {
        historyContainer.innerHTML = '<div style="color:#999; text-align:center; padding:10px">Ставок пока нет</div>';
    }
}

function setupBidForm(data) {
    const form = document.getElementById('bid-form');
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = document.getElementById('bid-input').value;
        const msg = document.getElementById('bid-msg');
        try {
            const res = await fetch('/api/listings/bid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ listing_id: data.id, amount: amount })
            });
            const result = await res.json();
            if (res.ok) {
                msg.innerText = '✅ Ставка принята!';
                msg.style.color = 'green';
                setTimeout(() => location.reload(), 1000);
            } else {
                msg.innerText = `❌ ${result.message}`;
                msg.style.color = 'red';
            }
        } catch (err) {
            msg.innerText = 'Ошибка сети';
        }
    });
}

function setupPhoneButton(data) {
    const btn = document.getElementById('btn-show-phone');
    if (!btn) return;

    btn.onclick = () => {
        // Проверка авторизации (опционально)
        if (localStorage.getItem('isLoggedIn') !== 'true') {
            window.location.href = '/login.html';
            return;
        }

        const phone = data.phone || 'Номер скрыт';
        
        // Меняем стиль кнопки, чтобы показать номер
        btn.innerHTML = `<i class='bx bx-phone'></i> ${phone}`;
        btn.style.background = '#fff';
        btn.style.color = '#333';
        btn.style.border = '2px solid #2ecc71'; // Зеленая рамка
        btn.style.pointerEvents = 'none'; // Чтобы больше не нажималась
        
        if (!data.phone) {
            btn.style.borderColor = '#ccc';
        }
    };
}

// Логика кнопки "Написать сообщение"
const writeBtn = document.getElementById('btn-write-msg'); // Добавь этот ID в HTML!
if (writeBtn) {
    writeBtn.onclick = async () => {
        if (!localStorage.getItem('isLoggedIn')) {
            window.location.href = '/login.html';
            return;
        }

        try {
            // Создаем чат через API
            const res = await fetch('/api/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    listing_id: currentListing.id, 
                    seller_id: currentListing.user_id 
                })
            });

            const data = await res.json();
            
            if (res.ok) {
                // Переходим в чат
                window.location.href = `/chat.html?chat_id=${data.id}`;
            } else {
                alert(data.message); // Например "Нельзя писать самому себе"
            }
        } catch (err) {
            console.error(err);
        }
    };
}

// Глобальные функции для модалки
window.openReportModal = function() {
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = '/login.html';
        return;
    }
    const modal = document.getElementById('report-modal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('open'), 10);
};

window.closeReportModal = function() {
    const modal = document.getElementById('report-modal');
    modal.classList.remove('open');
    setTimeout(() => modal.style.display = 'none', 300);
};

// Обработка формы
document.getElementById('report-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
        const res = await fetch('/api/listings/report', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                listing_id: currentListing.id,
                reason: formData.get('reason'),
                comment: formData.get('comment')
            })
        });
        
        if (res.ok) {
            alert('Жалоба отправлена. Спасибо!');
            closeReportModal();
        } else {
            alert('Ошибка отправки');
        }
    } catch (err) { console.error(err); }
});