document.addEventListener('DOMContentLoaded', async () => {
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = '/login.html';
        return;
    }

    await loadCategories();
    
    // Проверяем режим: Создание или Редактирование
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('id');

    if (editId) {
        enableEditMode(editId);
    } else {
        setupTypeSwitcher(); // Включаем переключатель типов (только для создания)
    }

    setupDragAndDrop();
    setupFormSubmit(editId);
});

// Глобальные переменные
let filesToUpload = []; // Новые файлы
let existingImages = []; // Старые файлы (для редактирования)

// --- ИНИЦИАЛИЗАЦИЯ ---
async function loadCategories() {
    const res = await fetch('/api/listings/categories');
    const cats = await res.json();
    const select = document.getElementById('category-select');
    select.innerHTML = '<option value="" disabled selected>Выберите категорию</option>';
    cats.forEach(c => select.innerHTML += `<option value="${c.id}">${c.name}</option>`);
}

// --- ЛОГИКА ТИПОВ ОБЪЯВЛЕНИЙ ---
function setupTypeSwitcher() {
    const radios = document.querySelectorAll('input[name="type"]');
    radios.forEach(r => {
        r.addEventListener('change', () => updateFieldsVisibility(r.value));
    });
    // Инициализация
    updateFieldsVisibility('sell');
}

function updateFieldsVisibility(type) {
    const stdBlock = document.getElementById('block-standard');
    const aucBlock = document.getElementById('block-auction');
    const unitField = document.getElementById('field-unit');
    const fromField = document.getElementById('field-price-from');
    
    // Сброс видимости
    stdBlock.classList.remove('visible');
    aucBlock.classList.remove('visible');
    unitField.classList.remove('visible');
    fromField.classList.remove('visible');

    // Логика полей
    if (type === 'auction') {
        setTimeout(() => {
            stdBlock.style.display = 'none';
            aucBlock.style.display = 'block';
            setTimeout(() => aucBlock.classList.add('visible'), 10);
        }, 300);
        
        // Обязательные поля
        document.getElementById('input-price').removeAttribute('required');
        document.querySelector('[name="auction_start_price"]').setAttribute('required', 'true');
        document.querySelector('[name="auction_end_date"]').setAttribute('required', 'true');

    } else {
        setTimeout(() => {
            aucBlock.style.display = 'none';
            stdBlock.style.display = 'block';
            setTimeout(() => stdBlock.classList.add('visible'), 10);
        }, 300);

        document.getElementById('input-price').setAttribute('required', 'true');
        document.querySelector('[name="auction_start_price"]').removeAttribute('required');
        document.querySelector('[name="auction_end_date"]').removeAttribute('required');

        // Доп поля для аренды/услуг
        if (type === 'rent' || type === 'service') {
            unitField.style.display = 'block';
            setTimeout(() => unitField.classList.add('visible'), 300);
            
            if(type === 'service') {
                fromField.style.display = 'block';
                setTimeout(() => fromField.classList.add('visible'), 300);
            }
        } else {
            unitField.style.display = 'none';
            fromField.style.display = 'none';
        }
    }
}

// --- РЕЖИМ РЕДАКТИРОВАНИЯ ---
async function enableEditMode(id) {
    document.getElementById('page-title').innerText = 'Редактировать объявление';
    document.getElementById('submit-btn').innerText = 'Сохранить изменения';

    // Блокируем смену типа (слишком сложно менять структуру данных на лету)
    const typeSelector = document.getElementById('type-selector');
    typeSelector.style.pointerEvents = 'none';
    typeSelector.style.opacity = '0.6';

    try {
        const res = await fetch(`/api/listings/${id}`);
        const data = await res.json();

        // Заполняем форму
        const form = document.getElementById('listing-form');
        form.querySelector('[name="title"]').value = data.title;
        form.querySelector('[name="category_id"]').value = data.category_id;
        form.querySelector('[name="description"]').value = data.description;
        
        // Тип
        const typeRadio = form.querySelector(`input[name="type"][value="${data.type}"]`);
        if(typeRadio) typeRadio.checked = true;
        updateFieldsVisibility(data.type); // Обновляем поля под тип

        // Цены
        if(data.type === 'auction') {
            form.querySelector('[name="auction_start_price"]').value = data.auction_start_price;
            form.querySelector('[name="auction_step"]').value = data.auction_step;
            // Дата требует форматирования для input datetime-local
            if(data.auction_end_date) {
                const dt = new Date(data.auction_end_date);
                dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
                form.querySelector('[name="auction_end_date"]').value = dt.toISOString().slice(0,16);
            }
        } else {
            form.querySelector('[name="price"]').value = data.price;
            if(data.price_unit) form.querySelector('[name="price_unit"]').value = data.price_unit;
            if(data.is_price_from) form.querySelector('[name="is_price_from"]').checked = true;
        }

        // Картинки
        existingImages = data.images;
        renderGallery();

    } catch (err) {
        console.error(err);
        alert('Ошибка загрузки данных');
    }
}

// --- ЗАГРУЗКА КАРТИНОК ---
function setupDragAndDrop() {
    const zone = document.getElementById('drop-zone');
    const input = document.getElementById('file-input');

    zone.onclick = () => input.click();
    
    input.onchange = (e) => addFiles(e.target.files);
    
    zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('dragover'); };
    zone.ondragleave = () => zone.classList.remove('dragover');
    zone.ondrop = (e) => { e.preventDefault(); zone.classList.remove('dragover'); addFiles(e.dataTransfer.files); };
}

function addFiles(files) {
    if (filesToUpload.length + existingImages.length + files.length > 5) {
        alert('Максимум 5 фото');
        return;
    }
    [...files].forEach(file => {
        if(file.type.startsWith('image/')) filesToUpload.push(file);
    });
    renderGallery();
}

function renderGallery() {
    const container = document.getElementById('gallery-preview');
    container.innerHTML = '';

    // 1. Старые фото
    existingImages.forEach(img => {
        const div = document.createElement('div');
        div.className = 'photo-item';
        div.innerHTML = `<img src="${img.image_url}"><div class="photo-remove"><i class='bx bx-x'></i></div>`;
        div.querySelector('.photo-remove').onclick = async () => {
            if(!confirm('Удалить фото?')) return;
            // Удаляем через API сразу
            try {
                // Если мы в режиме редактирования, у картинки есть ID
                if (img.id) {
                    // Берем ID объявления из URL
                    const listingId = new URLSearchParams(window.location.search).get('id');
                    await fetch(`/api/listings/${listingId}/images/${img.id}`, { method: 'DELETE' });
                }
                existingImages = existingImages.filter(i => i !== img);
                renderGallery();
            } catch(e) { alert('Ошибка удаления'); }
        };
        container.appendChild(div);
    });

    // 2. Новые фото
    filesToUpload.forEach((file, idx) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const div = document.createElement('div');
            div.className = 'photo-item';
            div.innerHTML = `<img src="${reader.result}"><div class="photo-remove"><i class='bx bx-x'></i></div>`;
            div.querySelector('.photo-remove').onclick = () => {
                filesToUpload.splice(idx, 1);
                renderGallery();
            };
            container.appendChild(div);
        };
    });
}

// --- ОТПРАВКА ФОРМЫ ---
function setupFormSubmit(editId) {
    const form = document.getElementById('listing-form');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submit-btn');
        btn.disabled = true;
        btn.innerText = 'Обработка...';

        const formData = new FormData(form);
        filesToUpload.forEach(f => formData.append('images', f));

        // URL и метод зависят от режима
        const url = editId ? `/api/listings/${editId}` : '/api/listings';
        const method = editId ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, { method: method, body: formData });
            const data = await res.json();

            if (res.ok) {
                // Редирект
                const newId = editId || data.listingId;
                window.location.href = `/listing.html?id=${newId}`;
            } else {
                alert(data.message || 'Ошибка');
                btn.disabled = false;
                btn.innerText = 'Попробовать снова';
            }
        } catch (err) {
            console.error(err);
            btn.disabled = false;
        }
    });
}