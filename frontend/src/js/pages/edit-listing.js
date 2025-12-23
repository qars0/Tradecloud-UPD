document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = '/login.html';
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const listingId = params.get('id');

    if (!listingId) {
        alert('Ошибка: ID не указан');
        window.location.href = '/profile.html';
        return;
    }

    loadCategories().then(() => loadListingData(listingId));
    setupDragAndDrop();
    setupFormSubmit(listingId);
});

let filesToUpload = [];

async function loadCategories() {
    const res = await fetch('/api/listings/categories');
    const categories = await res.json();
    const select = document.getElementById('category-select');
    select.innerHTML = '<option value="" disabled>Выберите категорию</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        select.appendChild(option);
    });
}

async function loadListingData(id) {
    try {
        const res = await fetch(`/api/listings/${id}`);
        const data = await res.json();

        // Заполняем поля
        document.getElementById('input-title').value = data.title;
        document.getElementById('input-desc').value = data.description;
        document.getElementById('input-price').value = data.price;
        document.getElementById('category-select').value = data.category_id;
        document.getElementById('input-is-from').checked = data.is_price_from;
        if(data.price_unit) document.getElementById('input-unit').value = data.price_unit;

        // Отображаем тип (только чтение)
        const typeNames = { 'sell': 'Продажа', 'rent': 'Аренда', 'service': 'Услуга', 'auction': 'Аукцион' };
        document.getElementById('input-type-display').value = typeNames[data.type] || data.type;

        // Отображаем старые картинки
        renderExistingImages(data.images, id);

    } catch (err) {
        console.error(err);
        alert('Ошибка загрузки данных');
    }
}

function renderExistingImages(images, listingId) {
    const container = document.getElementById('existing-photos-container');
    container.innerHTML = '';

    if (!images || images.length === 0) {
        container.innerHTML = '<span style="color:#999; font-size:14px;">Нет фото</span>';
        return;
    }

    // В ответе API images - это массив объектов {image_url: "..."}
    // Но для удаления нам нужен ID картинки. 
    // Нужно убедиться, что getListingById возвращает ID картинок.
    // Если getListingById в контроллере возвращает просто массив строк или объектов без ID, 
    // нужно поправить контроллер. (Ниже я напишу правку для контроллера)
    
    // ПРЕДПОЛАГАЕМ, что images = [{id: 1, image_url: '...'}, ...]
    images.forEach(img => {
        const div = document.createElement('div');
        div.className = 'photo-card';
        div.innerHTML = `
            <img src="${img.image_url}">
            <div class="photo-delete" title="Удалить"><i class='bx bx-x'></i></div>
        `;
        
        // Кнопка удаления
        div.querySelector('.photo-delete').onclick = async () => {
            if(!confirm('Удалить фото?')) return;
            // Здесь нужен ID картинки. 
            // Если в твоем API сейчас images не возвращает ID, давай сделаем Delete по URL (плохая практика) 
            // ИЛИ лучше поправим контроллер getListingById
            
            // ВРЕМЕННО: Если ID нет, просто скроем (визуально), 
            // но для реального удаления нужно обновить listingController.js
            try {
                // Предполагаем, что у нас есть img.id
                if(img.id) {
                    await fetch(`/api/listings/${listingId}/images/${img.id}`, { method: 'DELETE' });
                    div.remove();
                } else {
                    alert('Ошибка: ID картинки не найден. Обновите контроллер.');
                }
            } catch(e) { alert('Ошибка'); }
        };
        container.appendChild(div);
    });
}

function setupFormSubmit(listingId) {
    const form = document.getElementById('edit-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('.submit-btn');
        btn.innerText = 'Сохранение...';
        btn.disabled = true;

        const formData = new FormData(form);
        filesToUpload.forEach(file => formData.append('images', file));

        try {
            const res = await fetch(`/api/listings/${listingId}`, {
                method: 'PUT',
                body: formData
            });
            if(res.ok) {
                alert('Успешно сохранено!');
                window.location.href = `/listing.html?id=${listingId}`;
            } else {
                alert('Ошибка сохранения');
                btn.disabled = false;
            }
        } catch(e) {
            console.error(e);
            btn.disabled = false;
        }
    });
}

// Drag & Drop (копия из create-listing)
function setupDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    dropZone.onclick = () => fileInput.click();
    fileInput.onchange = (e) => handleFiles(e.target.files);
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
    dropZone.ondragleave = () => dropZone.classList.remove('dragover');
    dropZone.ondrop = (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); };
}

function handleFiles(files) {
    const container = document.getElementById('preview-container');
    [...files].forEach(file => {
        if(!file.type.startsWith('image/')) return;
        filesToUpload.push(file);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const div = document.createElement('div');
            div.className = 'preview-item'; // Использует стили create-listing
            div.style.cssText = "width:100px; height:100px; position:relative; overflow:hidden; border-radius:10px; box-shadow:0 2px 5px rgba(0,0,0,0.1)";
            div.innerHTML = `<img src="${reader.result}" style="width:100%; height:100%; object-fit:cover"><div style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.5); color:white; border-radius:50%; width:20px; height:20px; text-align:center; cursor:pointer" onclick="this.parentElement.remove()">×</div>`;
            container.appendChild(div);
        };
    });
}