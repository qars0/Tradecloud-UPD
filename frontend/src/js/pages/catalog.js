document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    applyFilters(); // Первая загрузка
    setupMobileFilters();
    setupSearchDebounce();
});

// 1. Загрузка категорий в сайдбар
async function loadCategories() {
    try {
        const res = await fetch('/api/listings/categories');
        const categories = await res.json();
        
        const container = document.getElementById('category-filters');
        container.innerHTML = `
            <label class="filter-chip">
                <input type="radio" name="category" value="" checked onchange="applyFilters()">
                <span class="chip-content">Все</span>
            </label>
        `;

        categories.forEach(cat => {
            container.innerHTML += `
                <label class="filter-chip">
                    <input type="radio" name="category" value="${cat.id}" onchange="applyFilters()">
                    <span class="chip-content"><i class='${cat.icon_class}'></i> ${cat.name}</span>
                </label>
            `;
        });
    } catch (err) {
        console.error(err);
    }
}

// 2. Сбор данных и запрос к API
async function applyFilters() {
    const grid = document.getElementById('catalog-grid');
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#777">Загрузка...</div>';

    // Собираем значения
    const search = document.getElementById('search-input').value;
    const minPrice = document.getElementById('min-price').value;
    const maxPrice = document.getElementById('max-price').value;
    const sort = document.getElementById('sort-select').value;
    
    // Радио-кнопки
    const type = document.querySelector('input[name="type"]:checked')?.value || '';
    const category = document.querySelector('input[name="category"]:checked')?.value || '';

    // Строим URL
    const params = new URLSearchParams({
        search, type, category_id: category, min_price: minPrice, max_price: maxPrice, sort
    });

    try {
        const res = await fetch(`/api/listings?${params}`);
        const listings = await res.json();

        grid.innerHTML = '';

        if (listings.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class='bx bx-search-alt'></i>
                    <h3>Ничего не найдено</h3>
                    <p>Попробуйте изменить параметры фильтрации</p>
                </div>
            `;
            return;
        }

        // Рендерим с задержкой (Staggered Animation)
        listings.forEach((item, index) => {
            const cardHtml = renderCard(item); // Функция из card-renderer.js
            
            // Оборачиваем в div для анимации
            const wrapper = document.createElement('div');
            wrapper.innerHTML = cardHtml;
            const cardElement = wrapper.firstElementChild; // Достаем саму карточку
            
            // Добавляем класс анимации и задержку
            cardElement.classList.add('fade-up');
            cardElement.style.animationDelay = `${index * 0.05}s`; // Каждая следующая карточка на 50мс позже
            
            grid.appendChild(cardElement);
        });

        // Закрываем мобильное меню после поиска
        if (window.innerWidth < 900) {
            document.getElementById('filters-sidebar').classList.remove('active');
        }

    } catch (err) {
        console.error(err);
        grid.innerHTML = 'Ошибка загрузки';
    }
}

// 3. Живой поиск с задержкой (Debounce)
function setupSearchDebounce() {
    const input = document.getElementById('search-input');
    let timeout;

    input.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            applyFilters();
        }, 500); // Ждем 500мс после окончания ввода
    });
}

// 4. Сброс фильтров
function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('min-price').value = '';
    document.getElementById('max-price').value = '';
    
    // Сбрасываем радио на "Все"
    const allRadios = document.querySelectorAll('input[type="radio"][value=""]');
    allRadios.forEach(r => r.checked = true);
    
    applyFilters();
}

// 5. Мобильное меню
function setupMobileFilters() {
    const sidebar = document.getElementById('filters-sidebar');
    const openBtn = document.getElementById('open-filters');
    const closeBtn = document.getElementById('close-filters');

    openBtn.addEventListener('click', () => {
        sidebar.classList.add('active');
        closeBtn.style.display = 'block';
    });

    closeBtn.addEventListener('click', () => {
        sidebar.classList.remove('active');
    });
}