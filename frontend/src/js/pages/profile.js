document.addEventListener('DOMContentLoaded', () => {
    loadProfileData();
    setupTabs();
    setupAvatarUpload();
    setupSettingsForm();
    loadMyListings();
});

// 1. Загрузка данных пользователя
async function loadProfileData() {
    try {
        const res = await fetch('/api/user/me');
        if (res.status === 401) {
            window.location.href = '/login.html'; // Если не вошел - на выход
            return;
        }
        
        const user = await res.json();

        // Заполняем карточку
        document.getElementById('profile-name').innerText = user.username;
        document.getElementById('profile-rating').innerText = user.rating || '5.0';
        
        if (user.avatar_url) {
            document.getElementById('profile-avatar-img').src = user.avatar_url;
        }
        
        // Дата регистрации (форматируем)
        const date = new Date(user.created_at);
        const options = { year: 'numeric', month: 'long' }; // "октябрь 2023"
        document.getElementById('join-date').innerText = date.toLocaleDateString('ru-RU', options);

        // Заполняем форму настроек
        document.getElementById('input-username').value = user.username;
        document.getElementById('input-email').value = user.email;
        document.getElementById('input-phone').value = user.phone || '';

    } catch (err) {
        console.error('Ошибка загрузки профиля:', err);
    }
}

// 2. Логика переключения вкладок
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Убираем активный класс у всех
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            // Добавляем текущему
            tab.classList.add('active');
            const targetId = `tab-${tab.dataset.tab}`;
            document.getElementById(targetId).classList.add('active');
        });
    });
    
    // Проверка URL (если хотим открыть конкретную вкладку по ссылке profile.html?tab=reviews)
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam) {
        const targetTab = document.querySelector(`.tab-btn[data-tab="${tabParam}"]`);
        if (targetTab) targetTab.click();
    }
}

// 3. Загрузка аватарки (сразу при выборе файла)
function setupAvatarUpload() {
    const fileInput = document.getElementById('avatar-upload');
    
    fileInput.addEventListener('change', async () => {
        if (fileInput.files.length === 0) return;

        const formData = new FormData();
        formData.append('avatar', fileInput.files[0]);

        try {
            const res = await fetch('/api/user/update', {
                method: 'PUT',
                body: formData
            });
            const data = await res.json();
            
            if (res.ok) {
                // Обновляем картинку сразу
                document.getElementById('profile-avatar-img').src = data.user.avatar_url;
                // Обновляем хедер (аватарку там)
                const storedUser = JSON.parse(localStorage.getItem('user'));
                storedUser.avatar = data.user.avatar_url;
                localStorage.setItem('user', JSON.stringify(storedUser));
            } else {
                alert('Ошибка загрузки фото');
            }
        } catch (err) {
            console.error(err);
        }
    });
}

// 4. Сохранение настроек
function setupSettingsForm() {
    const form = document.getElementById('settings-form');
    const msg = document.getElementById('save-msg');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        msg.innerText = 'Сохранение...';
        msg.style.color = 'gray';

        const formData = new FormData(form);
        // Преобразуем FormData в JSON, так как бэкенд (кроме аватара) ждет JSON или FormData, 
        // но userController updateProfile настроен на парсинг полей.
        // Чтобы upload middleware не ругался, лучше отправить JSON, если нет файлов, 
        // НО наш роут использует upload.single('avatar'), который ожидает multipart/form-data.
        // Поэтому отправляем просто FormData, multer сам распарсит текстовые поля.
        
        try {
            const res = await fetch('/api/user/update', {
                method: 'PUT',
                body: formData // Отправляем как multipart/form-data
            });
            
            if (res.ok) {
                msg.innerText = '✅ Данные успешно сохранены!';
                msg.style.color = 'green';
                
                // Обновляем имя в карточке
                const newName = document.getElementById('input-username').value;
                document.getElementById('profile-name').innerText = newName;
            } else {
                msg.innerText = '❌ Ошибка при сохранении';
                msg.style.color = 'red';
            }
        } catch (err) {
            msg.innerText = '❌ Ошибка сети';
        }
    });
}

// 5. Загрузка и рендеринг моих объявлений
async function loadMyListings() {
    const container = document.getElementById('listings-container');
    container.innerHTML = '<div style="text-align:center; width:100%">Загрузка...</div>';

    try {
        // 1. Получаем ID текущего юзера (мы уже получали его в loadProfileData, 
        // но для надежности можно взять из /api/user/me снова или сохранить в переменную)
        const userRes = await fetch('/api/user/me');
        const user = await userRes.json();
        
        // 2. Запрашиваем объявления этого юзера
        const res = await fetch(`/api/listings?user_id=${user.id}`);
        const listings = await res.json();

        container.innerHTML = ''; // Очистить лоадер

        if (listings.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class='bx bx-ghost'></i>
                    <h3>Здесь пока пусто</h3>
                    <p>Вы еще ничего не выставили на продажу</p>
                    <a href="/create-listing.html" class="btn-create" style="display:inline-block; margin-top:10px">Создать объявление</a>
                </div>
            `;
            // Обновим счетчик товаров в шапке профиля
            updateStats(0);
            return;
        }

        // Обновим счетчик товаров
        updateStats(listings.length);

        // 3. Рендерим карточки
        listings.forEach(item => {
            // renderCard берется из card-renderer.js
            container.innerHTML += renderCard(item);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = 'Ошибка загрузки объявлений';
    }
}

function updateStats(count) {
    // Ищем элемент "Товаров" в шапке профиля. 
    // В HTML это первый .stat-value
    const stats = document.querySelectorAll('.stat-value');
    if(stats[0]) stats[0].innerText = count;
}