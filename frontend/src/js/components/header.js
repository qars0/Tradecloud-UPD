class HeaderComponent {
    constructor() {
        this.container = document.getElementById('header-container');
        this.isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'; 
        this.user = JSON.parse(localStorage.getItem('user')) || null;
        this.socket = null;
    }

    async render() {
        if (!this.container) return;

        // Рендерим базу хедера (структура из прошлого шага)
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

        this.attachEvents();
        if (this.isLoggedIn) {
            this.initSocket();
            this.loadUnreadCount();
        }
    }

    getPrivateNav() {
        return `
            <a href="/chat.html" class="icon-btn" title="Сообщения"><i class='bx bx-message-rounded-dots'></i></a>
            <a href="/favorites.html" class="icon-btn" title="Избранное"><i class='bx bx-heart'></i></a>
            
            <!-- КОЛОКОЛЬЧИК -->
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

    getPublicNav() {
        return `
            <div class="auth-links">
                <a href="/login.html" class="link-login">Вход</a>
            </div>
            <a href="/login.html?mode=register" class="btn-create-header" style="background: var(--text-dark);">Регистрация</a>
        `;
    }

    attachEvents() {
        // Выход
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

        // Поиск
        const searchInput = document.getElementById('global-search');
        if (searchInput) {
            searchInput.onkeypress = (e) => {
                if (e.key === 'Enter') location.href = `/catalog.html?search=${encodeURIComponent(searchInput.value)}`;
            };
        }

        // --- ЛОГИКА ОТКРЫТИЯ УВЕДОМЛЕНИЙ ---
        const notifBtn = document.getElementById('notif-btn');
        const notifMenu = document.getElementById('notif-menu');
        
        if (notifBtn && notifMenu) {
            notifBtn.onclick = (e) => {
                e.stopPropagation();
                const isActive = notifMenu.classList.contains('active');
                
                // Закрываем всё остальное
                this.closeAllMenus();

                if (!isActive) {
                    notifMenu.classList.add('active');
                    this.loadNotifications();
                }
            };

            // Кнопка "Прочитать всё"
            const markAllBtn = document.getElementById('mark-read-all');
            if (markAllBtn) {
                markAllBtn.onclick = async (e) => {
                    e.stopPropagation();
                    await fetch('/api/notifications/read', { method: 'POST' });
                    this.loadUnreadCount();
                    this.loadNotifications();
                };
            }
        }

        // Клик вне меню закрывает его
        document.addEventListener('click', () => this.closeAllMenus());
    }

    closeAllMenus() {
        const notifMenu = document.getElementById('notif-menu');
        if (notifMenu) notifMenu.classList.remove('active');
    }

    // --- SOCKETS ---
    async initSocket() {
        if (typeof io === 'undefined') return;

        this.socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });

        // Узнаем свой ID и логинимся в комнату
        try {
            const res = await fetch('/api/user/me');
            const data = await res.json();
            if (data.id) {
                this.socket.emit('login', data.id);
            }
        } catch (e) {}

        this.socket.on('new_notification', (notif) => {
            this.playNotifAnimation();
            this.loadUnreadCount();
        });
    }

    playNotifAnimation() {
        const btn = document.getElementById('notif-btn');
        if (btn) {
            btn.classList.add('ringing');
            setTimeout(() => btn.classList.remove('ringing'), 1000);
        }
    }

    async loadUnreadCount() {
        try {
            const res = await fetch('/api/notifications/count');
            const { count } = await res.json();
            this.renderBadge(count);
        } catch (e) {}
    }

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

    async loadNotifications() {
        const list = document.getElementById('notif-list-content');
        list.innerHTML = '<div style="padding:20px; text-align:center;"><i class="bx bx-loader-alt bx-spin"></i></div>';

        try {
            const res = await fetch('/api/notifications');
            const data = await res.json();

            if (data.length === 0) {
                list.innerHTML = '<div style="padding:20px; text-align:center; color:#999">Уведомлений нет</div>';
                return;
            }

            list.innerHTML = data.map(n => {
                const iconMap = {
                    'outbid': 'bx-down-arrow-circle',
                    'win': 'bx-trophy',
                    'bid_placed': 'bx-gavel',
                    'message': 'bx-message-dots'
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

document.addEventListener('DOMContentLoaded', () => {
    const header = new HeaderComponent();
    header.render();
});