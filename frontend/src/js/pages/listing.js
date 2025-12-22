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

async function loadListingDetails(id) {
    try {
        const res = await fetch(`/api/listings/${id}`);
        
        if (!res.ok) {
            // Если сервер ответил 404 или 500
            throw new Error(`Ошибка сервера: ${res.status}`);
        }
        
        const data = await res.json();
        currentListing = data;

        // Преобразуем цены из строк в числа (Postgres отдает DECIMAL как строку)
        data.price = parseFloat(data.price);
        data.auction_start_price = parseFloat(data.auction_start_price);
        if (data.current_max_bid) data.current_max_bid = parseFloat(data.current_max_bid);
        if (data.auction_step) data.auction_step = parseFloat(data.auction_step);

        // Рендеринг
        renderGallery(data.images);
        renderInfo(data);
        
        if (data.type === 'auction') {
            setupAuction(data);
        } else {
            renderStandardPrice(data);
        }

    } catch (err) {
        console.error('CRITICAL ERROR:', err);
        // Выводим реальную ошибку на экран, чтобы ты увидел, в чем дело
        document.getElementById('main-content').innerHTML = `
            <div style="text-align:center; padding: 50px;">
                <h1 style="color:red">Что-то пошло не так</h1>
                <p style="font-size:18px">${err.message}</p>
                <p style="color:#777; font-size:12px; margin-top:10px">Открой консоль (F12) для подробностей</p>
                <a href="/" class="btn-create" style="display:inline-block; margin-top:20px">На главную</a>
            </div>
        `;
    }
}

// 1. Галерея
function renderGallery(images) {
    const mainImg = document.getElementById('main-img');
    const thumbsContainer = document.getElementById('thumbs-container');
    
    // Очистка контейнера миниатюр
    thumbsContainer.innerHTML = ''; 

    if (!images || images.length === 0) {
        mainImg.src = 'https://via.placeholder.com/600x400?text=No+Photo';
        return;
    }

    // Главная
    mainImg.src = images[0].image_url;

    // Миниатюры
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

// 2. Основная инфо
function renderInfo(data) {
    const titleEl = document.getElementById('listing-title');
    if (titleEl) titleEl.innerText = data.title;

    const descEl = document.getElementById('desc-text');
    if (descEl) descEl.innerText = data.description;

    const dateEl = document.getElementById('publish-date');
    if (dateEl) dateEl.innerText = new Date(data.created_at).toLocaleDateString();

    // Продавец
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

        favBtn.onclick = async () => {
            // Используем глобальную функцию из card-renderer.js (если она там есть)
            // или свою логику
            if (window.toggleFav) {
                window.toggleFav(favBtn, data.id);
            } else {
                alert('Добавлено в избранное (обновите страницу)');
            }
        };
    }
}

// 3. Логика для обычных товаров
function renderStandardPrice(data) {
    const priceEl = document.getElementById('price-val');
    const labelEl = document.getElementById('price-label');

    // Безопасное преобразование цены
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

    // Текущая ставка
    const currentPrice = data.current_max_bid || data.auction_start_price;
    document.getElementById('current-bid').innerText = Math.floor(currentPrice) + ' ₽';
    document.getElementById('bid-step').innerText = data.auction_step;

    // Таймер
    const endDate = new Date(data.auction_end_date).getTime();
    
    // Очищаем старый интервал если был
    if (window.auctionInterval) clearInterval(window.auctionInterval);

    window.auctionInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = endDate - now;

        const timerEl = document.getElementById('timer-val');
        if (!timerEl) return;

        if (distance < 0) {
            clearInterval(window.auctionInterval);
            timerEl.innerText = "ЗАВЕРШЕН";
            document.getElementById('timer-box').style.background = '#eee';
            document.getElementById('timer-box').style.color = '#777';
            document.getElementById('bid-form').style.display = 'none';
        } else {
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            
            timerEl.innerText = `${days}д ${hours}ч ${minutes}м ${seconds}с`;
        }
    }, 1000);

    // История ставок
    const historyContainer = document.getElementById('bid-history');
    historyContainer.innerHTML = ''; // Очистка

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

    // Обработка формы ставки
    const form = document.getElementById('bid-form');
    // Удаляем старые слушатели (клонированием)
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amountInput = document.getElementById('bid-input');
        const amount = amountInput.value;
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
            console.error(err);
            msg.innerText = 'Ошибка сети';
        }
    });
}