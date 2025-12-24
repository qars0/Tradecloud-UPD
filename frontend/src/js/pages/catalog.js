// Состояние
let currentState = {
    page: 1,
    limit: 12,
    search: '',
    category_id: '',
    type: '',
    min_price: '',
    max_price: '',
    sort: 'new'
};

document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    
    // 1. Считываем параметры из URL (если перешли из хедера или по ссылке)
    const params = new URLSearchParams(window.location.search);
    if (params.get('search')) currentState.search = params.get('search');
    if (params.get('category_id')) currentState.category_id = params.get('category_id');
    if (params.get('type')) currentState.type = params.get('type');
    if (params.get('page')) currentState.page = parseInt(params.get('page'));

    // 2. Устанавливаем значения в UI
    syncUIWithState();

    // 3. Загружаем данные
    applyFilters(currentState.page);

    // 4. Слушатель поиска (debounce)
    let timeout;
    document.getElementById('search-input').addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            currentState.search = e.target.value;
            applyFilters(1);
        }, 500);
    });
});

// Синхронизация полей с состоянием (при первой загрузке)
function syncUIWithState() {
    document.getElementById('search-input').value = currentState.search;
    if(currentState.type) {
        const radio = document.querySelector(`input[name="type"][value="${currentState.type}"]`);
        if(radio) radio.checked = true;
    }
    // Категория синхронизируется внутри loadCategories, т.к. они грузятся асинхронно
}

async function loadCategories() {
    try {
        const res = await fetch('/api/listings/categories');
        const cats = await res.json();
        const container = document.getElementById('category-filters');
        
        container.innerHTML = `
            <label class="filter-chip">
                <input type="radio" name="category" value="" ${currentState.category_id === '' ? 'checked' : ''} onchange="updateCategory('')">
                <span class="chip-content">Все</span>
            </label>
        `;

        cats.forEach(cat => {
            const isChecked = String(cat.id) === String(currentState.category_id) ? 'checked' : '';
            container.innerHTML += `
                <label class="filter-chip">
                    <input type="radio" name="category" value="${cat.id}" ${isChecked} onchange="updateCategory('${cat.id}')">
                    <span class="chip-content"><i class='${cat.icon_class}'></i> ${cat.name}</span>
                </label>
            `;
        });
    } catch (e) { console.error(e); }
}

// Обновление состояния из UI
function updateStateFromUI() {
    currentState.search = document.getElementById('search-input').value;
    currentState.type = document.querySelector('input[name="type"]:checked')?.value || '';
    // категория обновляется отдельным обработчиком onchange
    currentState.min_price = document.getElementById('min-price').value;
    currentState.max_price = document.getElementById('max-price').value;
    currentState.sort = document.getElementById('sort-select').value;
}

function updateCategory(id) {
    currentState.category_id = id;
    applyFilters(1);
}

// ГЛАВНАЯ ФУНКЦИЯ ЗАГРУЗКИ
async function applyFilters(page = 1) {
    currentState.page = page;
    updateStateFromUI(); // Собрать свежие данные из полей (цена, тип, сорт)

    // Обновляем URL (чтобы можно было скопировать ссылку)
    const params = new URLSearchParams();
    for (const key in currentState) {
        if (currentState[key]) params.set(key, currentState[key]);
    }
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`);

    // UI загрузки
    const grid = document.getElementById('catalog-grid');
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;">Загрузка...</div>';
    
    renderActiveTags(); // Показываем теги

    try {
        const res = await fetch(`/api/listings?${params}`);
        const result = await res.json();
        
        // Бэкенд возвращает { data: [], pagination: {} }
        const listings = result.data || result; // Поддержка старого и нового формата
        const pagination = result.pagination;

        grid.innerHTML = '';

        if (listings.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1; text-align:center; padding:50px; color:#777">
                    <i class='bx bx-search-alt' style="font-size:48px; opacity:0.5"></i>
                    <h3>Ничего не найдено</h3>
                    <p>Попробуйте изменить условия поиска</p>
                </div>
            `;
            document.getElementById('pagination').innerHTML = '';
            return;
        }

        // Рендер карточек
        listings.forEach((item, index) => {
            const html = renderCard(item);
            const wrapper = document.createElement('div');
            wrapper.innerHTML = html;
            const card = wrapper.firstElementChild;
            
            card.classList.add('fade-in-up');
            card.style.animationDelay = `${index * 0.05}s`;
            
            grid.appendChild(card);
        });

        // Рендер пагинации
        if (pagination) renderPagination(pagination);

        // Скролл наверх
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
        console.error(err);
        grid.innerHTML = 'Ошибка загрузки';
    }
}

// ТЕГИ АКТИВНЫХ ФИЛЬТРОВ
function renderActiveTags() {
    const container = document.getElementById('active-filters');
    container.innerHTML = '';

    if (currentState.search) addTag(`Поиск: ${currentState.search}`, () => {
        document.getElementById('search-input').value = '';
        applyFilters(1);
    });

    if (currentState.min_price) addTag(`От ${currentState.min_price} ₽`, () => {
        document.getElementById('min-price').value = '';
        applyFilters(1);
    });

    // Можно добавить и другие (Тип, Категория), если нужно
    
    function addTag(text, onRemove) {
        const tag = document.createElement('div');
        tag.className = 'active-tag';
        tag.innerHTML = `<span>${text}</span> <i class='bx bx-x'></i>`;
        tag.querySelector('i').onclick = onRemove;
        container.appendChild(tag);
    }
}

// ПАГИНАЦИЯ
function renderPagination({ page, totalPages }) {
    const container = document.getElementById('pagination');
    container.innerHTML = '';

    if (totalPages <= 1) return;

    // Кнопка "Назад"
    if (page > 1) {
        container.innerHTML += `<button class="page-btn" onclick="applyFilters(${page - 1})"><i class='bx bx-chevron-left'></i></button>`;
    }

    // Цифры (упрощенно: показываем все, или можно сделать 1,2...5,6)
    // Для красоты покажем диапазон вокруг текущей
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, page + 2);

    if (start > 1) container.innerHTML += `<button class="page-btn" onclick="applyFilters(1)">1</button><span>...</span>`;

    for (let i = start; i <= end; i++) {
        const active = i === page ? 'active' : '';
        container.innerHTML += `<button class="page-btn ${active}" onclick="applyFilters(${i})">${i}</button>`;
    }

    if (end < totalPages) container.innerHTML += `<span>...</span><button class="page-btn" onclick="applyFilters(${totalPages})">${totalPages}</button>`;

    // Кнопка "Вперед"
    if (page < totalPages) {
        container.innerHTML += `<button class="page-btn" onclick="applyFilters(${page + 1})"><i class='bx bx-chevron-right'></i></button>`;
    }
}

function resetFilters() {
    currentState = {
        page: 1, limit: 12, search: '', category_id: '', type: '', min_price: '', max_price: '', sort: 'new'
    };
    document.getElementById('search-input').value = '';
    document.getElementById('min-price').value = '';
    document.getElementById('max-price').value = '';
    document.querySelector('input[name="type"][value=""]').checked = true;
    document.querySelector('input[name="category"][value=""]').checked = true;
    applyFilters(1);
}

// Мобильное меню
function toggleSidebar() {
    const sb = document.getElementById('filters-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (sb.classList.contains('open')) {
        sb.classList.remove('open');
        overlay.classList.remove('open');
        document.getElementById('close-filters').style.display = 'none';
    } else {
        sb.classList.add('open');
        overlay.classList.add('open');
        document.getElementById('close-filters').style.display = 'block';
    }
}
document.getElementById('close-filters').onclick = toggleSidebar;