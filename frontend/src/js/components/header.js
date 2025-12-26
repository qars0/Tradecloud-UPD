class HeaderComponent {
    constructor() {
        // Находим контейнер, куда будет вставлен HTML хедера
        this.container = document.getElementById('header-container');
        // Проверяем статус входа из локального хранилища браузера
        this.isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'; 
        // Получаем данные пользователя (имя, аватар и т.д.)
        this.user = JSON.parse(localStorage.getItem('user')) || null;
        // Переменная для хранения экземпляра Socket.io
        this.socket = null;
    }

    /**
     * Основной метод отрисовки компонента
     */
    async render() {
        if (!this.container) return;

        // Вставляем HTML-структуру хедера
        this.container.innerHTML = `
            <header class="header">
                <div class="header__content">
                    <a href="/index.html" class="header__logo">
                        <i class='bx bx-cloud-alt'></i>
                        <span class="header__logo-text">TradeCloud</span>
                    </a>

                    <div class="header__center">
                        <button class="btn-catalog-header" onclick="location.href='/catalog.html'">
                            <i class='bx bx-grid-alt'></i> Каталог
                        </button>
                        <div class="header__search">
                            <i class='bx bx-search'></i>
                            <input type="text" placeholder="Найти товар..." id="global-search">
                        </div>
                    </div>

                    <div class="header__right">
                        ${this.isLoggedIn ? this.getPrivateNav() : this.getPublicNav()}
                    </div>
                </div>
            </header>
        `;

        // Навешиваем обработчики событий (клики, ввод текста)
        this.attachEvents();
        
        // Если пользователь авторизован, запускаем сокеты и счетчик уведомлений
        if (this.isLoggedIn) {
            this.initSocket();
            this.loadUnreadCount();
        }
    }

    /**
     * Возвращает HTML для авторизованного пользователя (сообщения, колокольчик, профиль)
     */
    getPrivateNav() {
        return `
            <a href="/chat.html" class="icon-btn" title="Сообщения"><i class='bx bx-message-rounded-dots'></i></a>
            <a href="/favorites.html" class="icon-btn" title="Избранное"><i class='bx bx-heart'></i></a>
            
            <div class="notif-dropdown">
                <div class="icon-btn" id="notif-btn" style="cursor:pointer">
                    <i class='bx bx-bell'></i>
                </div>
                <div class="notif-menu" id="notif-menu">
                    <div class="notif-header">
                        <span>Уведомления</span>
                        <button id="mark-read-all" style="background:none; border:none; color:var(--primary-color); font-size:11px; cursor:pointer">Прочитать всё</button>
                    </div>
                    <div id="notif-list-content">
                        <div style="padding:20px; text-align:center; color:#999">Нет новых уведомлений</div>
                    </div>
                </div>
            </div>

            <a href="/listing-form.html" class="btn-create-header"><i class='bx bx-plus'></i> Разместить</a>
            
            <div class="profile-dropdown">
                <div class="profile-trigger">
                    <img src="${this.user?.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'}" class="profile-avatar">
                </div>
                <div class="dropdown-menu">
                    <a href="/profile.html" class="dropdown-item"><i class='bx bx-user'></i> Профиль</a>
                    <a href="/profile.html?tab=settings" class="dropdown-item"><i class='bx bx-cog'></i> Настройки</a>
                    <div class="dropdown-divider"></div>
                    <a href="#" class="dropdown-item" id="logout-btn" style="color:var(--danger-color)"><i class='bx bx-log-out'></i> Выход</a>
                </div>
            </div>
        `;
    }

    /**
     * Возвращает HTML для гостя (кнопки Вход и Регистрация)
     */
    getPublicNav() {
        return `
            <div class="auth-links">
                <a href="/login.html" class="link-login">Вход</a>
            </div>
            <a href="/login.html?mode=register" class="btn-create-header" style="background: var(--text-dark);">Регистрация</a>
        `;
    }

    /**
     * Назначение обработчиков кликов и ввода
     */
    attachEvents() {
        // Логика кнопки "Выход"
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = (e) => {
                e.preventDefault();
                fetch('/api/auth/logout', { method: 'POST' }).then(() => {
                    localStorage.clear();
                    location.href = '/login.html';
                });
            };
        }

        // Поиск по нажатию на Enter
        const searchInput = document.getElementById('global-search');
        if (searchInput) {
            searchInput.onkeypress = (e) => {
                if (e.key === 'Enter') location.href = `/catalog.html?search=${encodeURIComponent(searchInput.value)}`;
            };
        }

        // Открытие/закрытие уведомлений
        const notifBtn = document.getElementById('notif-btn');
        const notifMenu = document.getElementById('notif-menu');
        
        if (notifBtn && notifMenu) {
            notifBtn.onclick = (e) => {
                e.stopPropagation(); // Чтобы клик не дошел до document
                const isActive = notifMenu.classList.contains('active');
                
                this.closeAllMenus(); // Закрываем другие открытые меню

                if (!isActive) {
                    notifMenu.classList.add('active');
                    this.loadNotifications(); // Подгружаем список при открытии
                }
            };

            // Кнопка "Прочитать всё"
            const markAllBtn = document.getElementById('mark-read-all');
            if (markAllBtn) {
                markAllBtn.onclick = async (e) => {
                    e.stopPropagation();
                    await fetch('/api/notifications/read', { method: 'POST' });
                    this.loadUnreadCount(); // Обнуляем счетчик
                    this.loadNotifications(); // Обновляем список (убираем выделение unread)
                };
            }
        }

        // Клик в любом месте документа закрывает выпадающие меню
        document.addEventListener('click', () => this.closeAllMenus());
    }

    closeAllMenus() {
        const notifMenu = document.getElementById('notif-menu');
        if (notifMenu) notifMenu.classList.remove('active');
    }

    /**
     * Инициализация WebSockets для получения уведомлений в реальном времени
     */
    async initSocket() {
        if (typeof io === 'undefined') return; // Если библиотека socket.io не загружена

        this.socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });

        try {
            const res = await fetch('/api/user/me');
            const data = await res.json();
            if (data.id) {
                // Привязываем сокет-соединение к ID пользователя на бэкенде
                this.socket.emit('login', data.id);
            }
        } catch (e) {}

        // Слушаем событие нового уведомления
        this.socket.on('new_notification', (notif) => {
            this.playNotifAnimation(); // Визуальный эффект
            this.loadUnreadCount();    // Обновляем число на бейджике
        });
    }

    /**
     * Анимация "тряски" колокольчика
     */
    playNotifAnimation() {
        const btn = document.getElementById('notif-btn');
        if (btn) {
            btn.classList.add('ringing');
            setTimeout(() => btn.classList.remove('ringing'), 1000);
        }
    }

    /**
     * Запрос на бэкенд для получения количества непрочитанных уведомлений
     */
    async loadUnreadCount() {
        try {
            const res = await fetch('/api/notifications/count');
            const { count } = await res.json();
            this.renderBadge(count);
        } catch (e) {}
    }

    /**
     * Отрисовка красного кружка (бейджика) с числом над колокольчиком
     */
    renderBadge(count) {
        const btn = document.getElementById('notif-btn');
        if (!btn) return;
        let badge = btn.querySelector('.badge');
        
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'badge';
                btn.appendChild(badge);
            }
            badge.innerText = count > 9 ? '9+' : count;
        } else if (badge) {
            badge.remove();
        }
    }

    /**
     * Загрузка списка уведомлений и их генерация в HTML
     */
    async loadNotifications() {
        const list = document.getElementById('notif-list-content');
        // Показываем спиннер загрузки
        list.innerHTML = '<div style="padding:20px; text-align:center;"><i class="bx bx-loader-alt bx-spin"></i></div>';

        try {
            const res = await fetch('/api/notifications');
            const data = await res.json();

            if (data.length === 0) {
                list.innerHTML = '<div style="padding:20px; text-align:center; color:#999">Уведомлений нет</div>';
                return;
            }

            // Маппинг иконок и цветов в зависимости от типа уведомления
            list.innerHTML = data.map(n => {
                const iconMap = {
                    'outbid': 'bx-down-arrow-circle', // Ставку перебили
                    'win': 'bx-trophy',               // Победа в аукционе
                    'bid_placed': 'bx-gavel',         // Ставка принята
                    'message': 'bx-message-dots'      // Новое сообщение
                };
                const classMap = {
                    'outbid': 'icon-outbid',
                    'win': 'icon-win',
                    'bid_placed': 'icon-bid_placed',
                    'message': 'icon-system'
                };

                return `
                    <a href="${n.link || '#'}" class="notif-item ${n.is_read ? '' : 'unread'}">
                        <div class="notif-icon-box ${classMap[n.type] || 'icon-system'}">
                            <i class='bx ${iconMap[n.type] || 'bx-bell'}'></i>
                        </div>
                        <div class="notif-text">
                            <h4>${n.title}</h4>
                            <p>${n.message}</p>
                            <div class="notif-time">${new Date(n.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                        </div>
                    </a>
                `;
            }).join('');
        } catch (e) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:red">Ошибка загрузки</div>';
        }
    }
}

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const header = new HeaderComponent();
    header.render();
});