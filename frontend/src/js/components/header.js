/* src/js/components/header.js */
class HeaderComponent {
    constructor() {
        this.container = document.getElementById('header-container');
        this.isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'; 
        this.user = JSON.parse(localStorage.getItem('user')) || {
            name: 'User',
            avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
        };
    }

    render() {
        if (!this.container) return;

        const leftSection = `
            <a href="/index.html" class="header__logo">
                <i class='bx bx-cloud-alt'></i>
                <span class="header__logo-text">TradeCloud</span>
            </a>
        `;

        const centerSection = `
            <div class="header__center">
                <button class="btn-catalog" onclick="location.href='/catalog.html'">
                    <i class='bx bx-menu'></i> Каталог
                </button>
                <div class="header__search">
                    <i class='bx bx-search'></i>
                    <input type="text" placeholder="Поиск товаров и услуг...">
                </div>
                <a href="/chat.html" class="header__chat-btn" title="Чат">
                    <i class='bx bx-message-rounded-dots'></i>
                </a>
            </div>
        `;

        let rightSection = '';

        if (this.isLoggedIn) {
            rightSection = `
                <div class="header__right">
                    <a href="/favorites.html" class="icon-btn" title="Избранное">
                        <i class='bx bx-heart'></i>
                    </a>
                    <a href="/notifications.html" class="icon-btn" title="Уведомления">
                        <i class='bx bx-bell'></i>
                        <span class="badge">2</span>
                    </a>
                    <a href="/create-listing.html" class="btn-create">
                        Разместить
                    </a>
                    
                    <div class="profile-dropdown">
                        <img src="${this.user.avatar}" alt="Ava" class="profile-avatar">
                        <div class="dropdown-menu">
                            <a href="/profile.html" class="dropdown-item">
                                <i class='bx bx-user'></i> Мой профиль
                            </a>
                            <a href="/profile.html?tab=listings" class="dropdown-item">
                                <i class='bx bx-list-ul'></i> Мои объявления
                            </a>
                            <div class="dropdown-divider"></div>
                            <a href="#" class="dropdown-item" id="logout-btn" style="color: var(--danger-color);">
                                <i class='bx bx-log-out'></i> Выход
                            </a>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // ОБРАТИ ВНИМАНИЕ НА ССЫЛКИ ЗДЕСЬ
            rightSection = `
                <div class="header__right">
                    <div class="header__auth-links">
                        <a href="/login.html" class="auth-link">Вход</a>
                        <span style="color: var(--gray-medium)">|</span>
                        <a href="/login.html?mode=register" class="auth-link primary">Регистрация</a>
                    </div>
                    <a href="/login.html" class="btn-create" style="background: var(--gray-dark);">
                        Разместить
                    </a>
                </div>
            `;
        }

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
    }

    attachEvents() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Выход через API
                fetch('/api/auth/logout', { method: 'POST' })
                    .then(() => {
                        localStorage.setItem('isLoggedIn', 'false');
                        localStorage.removeItem('user');
                        window.location.href = '/login.html';
                    });
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const header = new HeaderComponent();
    header.render();
});