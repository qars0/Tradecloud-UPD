class HeaderComponent {
    constructor() {
        this.container = document.getElementById('header-container');
        this.isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'; 
        this.user = JSON.parse(localStorage.getItem('user')) || {
            name: 'Гость',
            avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
        };
    }

    render() {
        if (!this.container) return;

        // --- ЛЕВАЯ ЧАСТЬ ---
        const leftSection = `
            <a href="/index.html" class="header__logo">
                <i class='bx bx-cloud-alt'></i>
                <span class="header__logo-text">TradeCloud</span>
            </a>
        `;

        // --- ЦЕНТРАЛЬНАЯ ЧАСТЬ ---
        const centerSection = `
            <div class="header__center">
                <button class="btn-catalog-header" onclick="location.href='/catalog.html'">
                    <i class='bx bx-grid-alt'></i> Каталог
                </button>
                <div class="header__search">
                    <i class='bx bx-search'></i>
                    <input type="text" placeholder="Найти товар, услугу..." id="global-search">
                </div>
            </div>
        `;

        // --- ПРАВАЯ ЧАСТЬ ---
        let rightSection = '';

        if (this.isLoggedIn) {
            rightSection = `
                <div class="header__right">
                    <a href="/chat.html" class="icon-btn" title="Сообщения">
                        <i class='bx bx-message-rounded-dots'></i>
                    </a>
                    
                    <a href="/favorites.html" class="icon-btn" title="Избранное">
                        <i class='bx bx-heart'></i>
                    </a>
                    
                    <a href="/notifications.html" class="icon-btn" title="Уведомления" id="notif-link">
                        <i class='bx bx-bell'></i>
                        <!-- Бейдж (если есть) -->
                    </a>
                    
                    <a href="/create-listing.html" class="btn-create-header">
                        <i class='bx bx-plus'></i> Разместить
                    </a>
                    
                    <div class="profile-dropdown">
                        <div class="profile-trigger" onclick="location.href='/profile.html'">
                            <img src="${this.user.avatar}" alt="Ava" class="profile-avatar">
                            <i class='bx bx-chevron-down' style="color:#999"></i>
                        </div>
                        
                        <div class="dropdown-menu">
                            <a href="/profile.html" class="dropdown-item">
                                <i class='bx bx-user'></i> Мой профиль
                            </a>
                            <a href="/profile.html?tab=listings" class="dropdown-item">
                                <i class='bx bx-list-ul'></i> Мои объявления
                            </a>
                            <a href="/profile.html?tab=settings" class="dropdown-item">
                                <i class='bx bx-cog'></i> Настройки
                            </a>
                            
                            <div class="dropdown-divider"></div>
                            
                            <a href="#" class="dropdown-item" id="logout-btn" style="color: var(--danger-color);">
                                <i class='bx bx-log-out' style="color: var(--danger-color);"></i> Выход
                            </a>
                        </div>
                    </div>
                </div>
            `;
        } else {
            rightSection = `
                <div class="header__right">
                    <div class="auth-links">
                        <a href="/login.html" class="link-login">Вход</a>
                    </div>
                    <a href="/login.html?mode=register" class="btn-create-header" style="background: var(--text-dark);">
                        Регистрация
                    </a>
                </div>
            `;
        }

        // СБОРКА
        this.container.innerHTML = `
            <header class="header">
                <div class="header__content">
                    ${leftSection}
                    ${centerSection}
                    ${rightSection}
                </div>
            </header>
        `;

        this.attachEvents();
        if (this.isLoggedIn) this.initNotifications();
    }

    attachEvents() {
        // Логика выхода
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                fetch('/api/auth/logout', { method: 'POST' })
                    .then(() => {
                        localStorage.setItem('isLoggedIn', 'false');
                        localStorage.removeItem('user');
                        window.location.href = '/login.html';
                    });
            });
        }

        // Поиск
        const searchInput = document.getElementById('global-search');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    window.location.href = `/catalog.html?search=${encodeURIComponent(searchInput.value)}`;
                }
            });
        }
    }

    // Уведомления
    async initNotifications() {
        if (!this.isLoggedIn) return;

        // 1. Загрузка счетчика
        this.loadUnreadCount();

        // 2. Обработчик клика по колокольчику
        const btn = document.getElementById('notif-btn');
        const menu = document.getElementById('notif-menu');
        
        if (btn && menu) {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                // Тоггл меню
                if (menu.classList.contains('active')) {
                    menu.classList.remove('active');
                } else {
                    // Закрываем другие меню
                    document.querySelectorAll('.dropdown-menu').forEach(el => el.style.display = 'none');
                    
                    menu.classList.add('active');
                    await this.loadNotificationsList();
                    this.markAsRead(); // Помечаем прочитанными
                }
            });

            // Закрытие при клике вне
            document.addEventListener('click', (e) => {
                if (!menu.contains(e.target) && !btn.contains(e.target)) {
                    menu.classList.remove('active');
                }
            });
        }

        // 3. Сокеты
        if (typeof io !== 'undefined') {
            const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
            
            try {
                const userRes = await fetch('/api/user/me');
                if(userRes.ok) {
                    const user = await userRes.json();
                    socket.emit('login', user.id);
                }
            } catch(e) {}

            socket.on('new_notification', (data) => {
                this.loadUnreadCount(); // Обновить цифру
                
                // Эффект звонка
                const icon = document.querySelector('#notif-btn i');
                if(icon) {
                    icon.parentElement.classList.add('ringing');
                    setTimeout(() => icon.parentElement.classList.remove('ringing'), 500);
                }
                
                // Если меню открыто - добавить в список
                const list = document.getElementById('notif-list');
                if (document.getElementById('notif-menu').classList.contains('active')) {
                    this.loadNotificationsList(); 
                }
            });
        }
    }

    async loadUnreadCount() {
        try {
            const res = await fetch('/api/notifications/count');
            const data = await res.json();
            this.renderBadge(data.count);
        } catch(e) {}
    }

    renderBadge(count) {
        const btn = document.getElementById('notif-btn');
        let badge = btn.querySelector('.badge');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'badge';
                btn.appendChild(badge);
            }
            badge.innerText = count > 99 ? '99+' : count;
        } else {
            if (badge) badge.remove();
        }
    }

    async loadNotificationsList() {
        const container = document.getElementById('notif-list');
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#999">Загрузка...</div>';
        
        try {
            const res = await fetch('/api/notifications');
            const list = await res.json();
            
            container.innerHTML = '';
            
            if (list.length === 0) {
                container.innerHTML = '<div style="padding:20px; text-align:center; color:#999">Нет уведомлений</div>';
                return;
            }

            list.forEach(item => {
                let icon = 'bx-bell';
                let styleClass = 'icon-system';
                
                if (item.type === 'outbid') { icon = 'bx-down-arrow-circle'; styleClass = 'icon-outbid'; }
                if (item.type === 'win') { icon = 'bx-trophy'; styleClass = 'icon-win'; }
                if (item.type === 'bid_placed') { icon = 'bx-gavel'; styleClass = 'icon-bid_placed'; }

                const html = `
                    <a href="${item.link || '#'}" class="notif-item ${item.is_read ? '' : 'unread'}">
                        <div class="notif-icon-box ${styleClass}">
                            <i class='bx ${icon}'></i>
                        </div>
                        <div class="notif-text">
                            <h4>${item.title}</h4>
                            <p>${item.message}</p>
                            <div class="notif-time">${new Date(item.created_at).toLocaleString()}</div>
                        </div>
                    </a>
                `;
                container.innerHTML += html;
            });
        } catch(e) {
            container.innerHTML = 'Ошибка';
        }
    }

    async markAsRead() {
        await fetch('/api/notifications/read', { method: 'POST' });
        this.renderBadge(0);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const header = new HeaderComponent();
    header.render();
});