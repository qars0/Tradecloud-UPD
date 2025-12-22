/**
 * Генерирует HTML карточки товара
 * @param {Object} item - Объект объявления из БД
 */
function renderCard(item) {
    const image = item.images && item.images.length > 0 
        ? item.images[0].image_url 
        : 'https://via.placeholder.com/300x200?text=No+Image';

    // ... (код генерации плашек badgeHtml оставляем прежним) ...
    let badgeHtml = '';
    if (item.type === 'service') badgeHtml = '<span class="card__badge badge--service">Услуга</span>';
    else if (item.type === 'rent') badgeHtml = '<span class="card__badge badge--rent">Аренда</span>';
    else if (item.type === 'auction') badgeHtml = '<span class="card__badge badge--top">Аукцион</span>';
    else if (item.type === 'sell') badgeHtml = '<span class="card__badge" style="background-color: #3A86FF;">Товар</span>';
    if (item.status === 'sold') badgeHtml = '<span class="card__badge" style="background:gray">Продано</span>';

    // ... (код цены priceDisplay оставляем прежним) ...
    let priceDisplay = '';
    if (item.type === 'auction') {
         priceDisplay = `<span style="color:var(--danger-color);"><i class='bx bx-stopwatch'></i> ${Math.floor(item.price)} ₽</span>`;
    } else {
        const value = Math.floor(item.price).toLocaleString('ru-RU');
        const prefix = item.is_price_from ? '<span style="font-size:0.8em; color:#777">от </span>' : '';
        const units = { 'hour': '/ час', 'day': '/ сутки', 'sqm': '/ м²', 'service': '/ услуга', 'piece': '' };
        const suffix = item.price_unit ? ` <span style="font-size:0.7em; color:#999">${units[item.price_unit] || ''}</span>` : '';
        priceDisplay = `${prefix}${value} ₽${suffix}`;
    }

    const date = new Date(item.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const author = item.full_name || item.username || 'Продавец';

    // --- ЛОГИКА ИЗБРАННОГО ---
    // Если is_favorite = true, добавляем класс active и меняем иконку
    const activeClass = item.is_favorite ? 'active' : '';
    const iconClass = item.is_favorite ? 'bxs-heart' : 'bx-heart'; // bxs = solid (залитое)

    return `
        <div class="card" onclick="location.href='/listing.html?id=${item.id}'">
            <div class="card__image-holder">
                ${badgeHtml}
                
                <!-- Кнопка Лайка -->
                <button class="card__favorite ${activeClass}" 
                        onclick="event.stopPropagation(); window.toggleFav(this, ${item.id})">
                    <i class='bx ${iconClass}'></i>
                </button>
                
                <img src="${image}" class="card__image" loading="lazy" alt="${item.title}">
            </div>
            <div class="card__content">
                <div class="card__price">${priceDisplay}</div>
                <div class="card__title">${item.title}</div>
                <div class="card__meta">
                    <span>${author}</span>
                    <span>${date}</span>
                </div>
            </div>
        </div>
    `;
}

// Глобальная функция клика по сердечку
window.toggleFav = async function(btn, listingId) {
    // Проверка авторизации
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = '/login.html';
        return;
    }

    // Оптимистичный UI: сразу меняем вид кнопки, не дожидаясь сервера
    const icon = btn.querySelector('i');
    const isActive = btn.classList.contains('active');
    
    // Переключаем классы
    btn.classList.toggle('active');
    if (isActive) {
        // Было активно -> Стало неактивно
        icon.classList.remove('bxs-heart');
        icon.classList.add('bx-heart');
    } else {
        // Было неактивно -> Стало активно
        icon.classList.remove('bx-heart');
        icon.classList.add('bxs-heart');
    }

    // Отправляем запрос
    try {
        const res = await fetch('/api/favorites/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listing_id: listingId })
        });
        
        if (!res.ok) {
            // Если ошибка, откатываем изменения (можно добавить алерт)
            console.error('Ошибка сервера');
            btn.classList.toggle('active'); // Возвращаем как было
        }
    } catch (err) {
        console.error(err);
    }
};