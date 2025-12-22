/**
 * Компонент хедера
 * Рендерит хедер в элемент с id="header-container"
 */
class HeaderComponent {
    constructor() {
        this.container = document.getElementById('header-container');
        // Временная заглушка авторизации (позже заменим на реальную проверку API)
        this.isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'; 
        this.user = JSON.parse(localStorage.getItem('user')) || {
            name: 'Студент',
            avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
        };
    }

    render() {
        if (!this.container) return;

        // Левая часть
        const leftSection = `
            <a href="/" class="header__logo">
                <i class='bx bx-cloud-alt'></i>
                <span class="header__logo-text">TradeCloud</span>
            </a>
        `;

        // Центральная часть
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

        // Правая часть (Динамическая)
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
                        Разместить объявление
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
                            <a href="/profile.html?tab=orders" class="dropdown-item">
                                <i class='bx bx-package'></i> Заказы
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
            rightSection = `
                <div class="header__right">
                    <div class="header__auth-links">
                        <a href="/login.html" class="auth-link">Вход</a>
                        <span style="color: var(--gray-medium)">|</span>
                        <a href="/register.html" class="auth-link primary">Регистрация</a>
                    </div>
                    <a href="/login.html" class="btn-create" style="background: var(--gray-dark);">
                        Разместить объявление
                    </a>
                </div>
            `;
        }

        // Сборка
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
        // Логика кнопки выхода
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.setItem('isLoggedIn', 'false');
                location.reload(); // Перезагружаем страницу, чтобы обновить хедер
            });
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const header = new HeaderComponent();
    header.render();
});