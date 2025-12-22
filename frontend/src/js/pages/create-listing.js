document.addEventListener('DOMContentLoaded', () => {
    // Проверка авторизации
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = '/login.html';
    }

    loadCategories();
    setupDragAndDrop();
    setupFormSubmit();
    togglePriceFields();
});

let filesToUpload = []; // Храним файлы здесь

async function loadCategories() {
    try {
        const res = await fetch('/api/listings/categories');
        const categories = await res.json();
        
        const select = document.getElementById('category-select');
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Ошибка категорий:', err);
    }
}

function setupDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    // Клик по зоне -> клик по инпуту
    dropZone.addEventListener('click', () => fileInput.click());

    // Изменение инпута
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    // Drag events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Анимация при наведении
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    // Drop
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });
}

function handleFiles(files) {
    const newFiles = [...files];
    if (filesToUpload.length + newFiles.length > 5) {
        alert('Максимум 5 фотографий');
        return;
    }

    newFiles.forEach(file => {
        // Проверка типа
        if (!file.type.startsWith('image/')) return;
        
        filesToUpload.push(file);
        showPreview(file);
    });
}

function showPreview(file) {
    const container = document.getElementById('preview-container');
    const reader = new FileReader();

    reader.readAsDataURL(file);
    reader.onloadend = () => {
        const div = document.createElement('div');
        div.className = 'preview-item';
        
        div.innerHTML = `
            <img src="${reader.result}" class="preview-img">
            <div class="remove-btn" title="Удалить">
                <i class='bx bx-x'></i>
            </div>
        `;

        // Удаление картинки
        div.querySelector('.remove-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // Чтобы не открывался инпут
            const index = filesToUpload.indexOf(file);
            if (index > -1) {
                filesToUpload.splice(index, 1);
            }
            div.remove();
        });

        container.appendChild(div);
    }
}

function setupFormSubmit() {
    const form = document.getElementById('create-form');
    const msgBox = document.getElementById('msg-box');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = form.querySelector('.submit-btn');
        btn.disabled = true;
        btn.innerText = 'Публикация...';

        const formData = new FormData(form);
        
        // Добавляем файлы из нашего массива
        filesToUpload.forEach(file => {
            formData.append('images', file);
        });

        try {
            const res = await fetch('/api/listings', {
                method: 'POST',
                body: formData // Отправляем как Multipart
            });

            if (res.ok) {
                const data = await res.json();
                msgBox.innerText = '✅ Объявление успешно опубликовано!';
                msgBox.style.color = 'green';
                
                // Редирект на созданное объявление (сделаем позже)
                // Или в профиль
                setTimeout(() => {
                    window.location.href = '/profile.html?tab=listings';
                }, 1000);
            } else {
                const err = await res.json();
                msgBox.innerText = `❌ Ошибка: ${err.message}`;
                msgBox.style.color = 'red';
                btn.disabled = false;
                btn.innerText = 'Опубликовать объявление';
            }
        } catch (error) {
            console.error(error);
            msgBox.innerText = '❌ Ошибка сети';
            btn.disabled = false;
            btn.innerText = 'Опубликовать объявление';
        }
    });
}

// ... существующий код ...

// Функция вызывается при загрузке страницы и при смене радио-кнопок
function togglePriceFields() {
    const type = document.querySelector('input[name="type"]:checked').value;
    
    const standardBlock = document.getElementById('standard-price-block');
    const auctionBlock = document.getElementById('auction-block');
    const unitSelector = document.getElementById('unit-selector');
    
    const mainPriceInput = document.getElementById('main-price');

    if (type === 'auction') {
        // Режим Аукциона
        standardBlock.style.display = 'none';
        auctionBlock.style.display = 'block';
        
        // Убираем обязательность стандартной цены
        mainPriceInput.removeAttribute('required');
        // Делаем поля аукциона обязательными
        document.querySelector('input[name="auction_start_price"]').setAttribute('required', 'true');
        document.querySelector('input[name="auction_end_date"]').setAttribute('required', 'true');
        
    } else {
        // Режим Обычный
        standardBlock.style.display = 'block';
        auctionBlock.style.display = 'none';
        
        mainPriceInput.setAttribute('required', 'true');
        // Убираем обязательность аукциона
        document.querySelector('input[name="auction_start_price"]').removeAttribute('required');
        document.querySelector('input[name="auction_end_date"]').removeAttribute('required');

        // Логика единиц измерения
        if (type === 'rent' || type === 'service') {
            unitSelector.style.display = 'block';
        } else {
            unitSelector.style.display = 'none'; // Для 'sell' скрываем
        }
    }
}