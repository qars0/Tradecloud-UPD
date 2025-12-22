/**
 * Генерирует HTML карточки товара
 * @param {Object} item - Объект объявления из БД
 */
function renderCard(item) {
    // 1. Картинка (заглушка, если нет)
    const image = item.images && item.images.length > 0 
        ? item.images[0].image_url 
        : 'https://via.placeholder.com/300x200?text=No+Image';

    // 2. Плашка (Badge)
    let badgeHtml = '';
    if (item.type === 'service') badgeHtml = '<span class="card__badge badge--service">Услуга</span>';
    else if (item.type === 'rent') badgeHtml = '<span class="card__badge badge--rent">Аренда</span>';
    else if (item.type === 'auction') badgeHtml = '<span class="card__badge badge--top">Аукцион</span>';
    else if (item.status === 'sold') badgeHtml = '<span class="card__badge" style="background:gray">Продано</span>';
    
    // 3. Логика отображения цены
    let priceDisplay = '';
    
    if (item.type === 'auction') {
        // Для аукциона показываем текущую ставку или начальную цену
        // (Предполагаем, что в item.price лежит актуальная цена)
        priceDisplay = `<span style="color:var(--danger-color);"><i class='bx bx-gavel'></i> ${Math.floor(item.price)} ₽</span>`;
    } else {
        // Форматирование числа (1000 -> 1 000)
        const value = Math.floor(item.price).toLocaleString('ru-RU');
        
        // Префикс "от"
        const prefix = item.is_price_from ? '<span style="font-size:0.8em; font-weight:400; color:#777">от </span>' : '';
        
        // Суффикс (единица измерения)
        const units = {
            'hour': '/ час',
            'day': '/ сутки',
            'sqm': '/ м²',
            'service': '/ услуга',
            'piece': '' // за шт не пишем, это дефолт
        };
        // Если unit не указан, берем пустую строку
        const suffixText = units[item.price_unit] || '';
        const suffix = suffixText ? `<span style="font-size:0.7em; color:#999; font-weight:400"> ${suffixText}</span>` : '';
        
        priceDisplay = `${prefix}${value} ₽${suffix}`;
    }

    // 4. Дата и Автор
    const date = new Date(item.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const author = item.username || 'Продавец'; // Убедись, что SQL запрос возвращает username

    return `
        <div class="card" onclick="location.href='/listing.html?id=${item.id}'">
            <div class="card__image-holder">
                ${badgeHtml}
                <button class="card__favorite" onclick="event.stopPropagation(); toggleFav(${item.id})">
                    <i class='bx bx-heart'></i>
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