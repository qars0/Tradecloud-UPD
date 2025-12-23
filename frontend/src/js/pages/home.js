document.addEventListener('DOMContentLoaded', () => {
    loadHeroCards();
    loadCategories();
    loadFreshListings();
});

// 1. Загрузка 3 карточек для Hero
async function loadHeroCards() {
    const container = document.getElementById('hero-cards-container');
    
    try {
        // Берем 5 последних, из них возьмем 3 (или рандом)
        const res = await fetch('/api/listings?limit=5');
        const listings = await res.json();

        if (listings.length === 0) {
            container.innerHTML = ''; // Пусто, если нет товаров
            return;
        }

        // Берем первые 3
        const top3 = listings.slice(0, 3);
        
        container.innerHTML = ''; // Очищаем скелет

        // Углы поворота для карточек
        const rotations = [-10, 5, 12];

        top3.forEach((item, index) => {
            // Форматируем цену
            let priceText = Math.floor(item.price).toLocaleString() + ' ₽';
            if(item.type === 'auction') priceText = 'Аукцион';

            // Картинка
            const img = item.images[0]?.image_url || 'https://via.placeholder.com/260x160';

            const card = document.createElement('div');
            card.className = 'floating-card';
            // Передаем переменную вращения в CSS
            card.style.setProperty('--rot', `${rotations[index]}deg`);
            
            // Ссылка на товар
            card.onclick = () => location.href = `/listing.html?id=${item.id}`;
            card.style.cursor = 'pointer';

            card.innerHTML = `
                <img src="${img}" class="mini-card-img" alt="${item.title}">
                <div class="mini-card-title">${item.title}</div>
                <div class="mini-card-price">${priceText}</div>
            `;

            container.appendChild(card);
        });

    } catch (err) {
        console.error('Ошибка hero:', err);
    }
}

// 2. Загрузка категорий
async function loadCategories() {
    const container = document.getElementById('categories-container');
    try {
        const res = await fetch('/api/listings/categories');
        const cats = await res.json();

        container.innerHTML = '';

        cats.forEach(cat => {
            container.innerHTML += `
                <a href="/catalog.html?category_id=${cat.id}" class="cat-card">
                    <div class="cat-icon-box">
                        <i class='${cat.icon_class}'></i>
                    </div>
                    <div class="cat-name">${cat.name}</div>
                </a>
            `;
        });

    } catch (err) {
        console.error(err);
    }
}

// 3. Загрузка свежих товаров
async function loadFreshListings() {
    const container = document.getElementById('fresh-listings');
    try {
        const res = await fetch('/api/listings?limit=8');
        const listings = await res.json();

        container.innerHTML = '';

        if (listings.length === 0) {
            container.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:40px; color:#777;">
                    <i class='bx bx-ghost' style="font-size:48px;"></i>
                    <p>Пока объявлений нет</p>
                </div>
            `;
            return;
        }

        listings.forEach((item, index) => {
            // Используем общий рендерер, но добавляем анимацию
            const html = renderCard(item);
            
            const wrapper = document.createElement('div');
            wrapper.innerHTML = html;
            const card = wrapper.firstElementChild;
            
            // Анимация появления
            card.style.animation = `fadeInUp 0.6s ease forwards ${index * 0.1}s`;
            card.style.opacity = '0'; // Начальное состояние для анимации
            
            container.appendChild(card);
        });

    } catch (err) {
        console.error(err);
    }
}

// Добавляем keyframe для анимации JS-ом (или можно в CSS)
const styleSheet = document.createElement("style");
styleSheet.innerText = `
    @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(styleSheet);