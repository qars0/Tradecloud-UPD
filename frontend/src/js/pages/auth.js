const sign_in_btn = document.querySelector("#sign-in-btn");
const sign_up_btn = document.querySelector("#sign-up-btn");
const container = document.querySelector(".container");

// Функция переключения режимов
function toggleMode(isSignUp) {
    if (isSignUp) {
        container.classList.add("sign-up-mode");
    } else {
        container.classList.remove("sign-up-mode");
    }
}

// Слушатели кнопок слайдера
sign_up_btn.addEventListener("click", () => toggleMode(true));
sign_in_btn.addEventListener("click", () => toggleMode(false));

// Проверка URL параметров при загрузке
// Если в адресной строке есть ?mode=register, сразу открываем регистрацию
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'register') {
        toggleMode(true);
    }
});

// Логика "Глазика" пароля
document.querySelectorAll('.toggle-password').forEach(icon => {
    icon.addEventListener('click', function() {
        const input = this.previousElementSibling; // Инпут перед иконкой
        
        if (input.type === 'password') {
            // Показываем пароль
            input.type = 'text';
            this.classList.remove('bx-hide'); // Удаляем "скрытый"
            this.classList.add('bx-show');    // Добавляем "показать"
        } else {
            // Скрываем пароль
            input.type = 'password';
            this.classList.remove('bx-show');
            this.classList.add('bx-hide');
        }
    });
});

// Логика ВХОДА (AJAX)
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    const errorMsg = document.getElementById('login-error');

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();

        if (response.ok) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('user', JSON.stringify({
                name: result.user.username,
                avatar: result.user.avatar_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
            }));
            window.location.href = '/index.html'; // На главную
        } else {
            errorMsg.innerText = result.message;
            errorMsg.style.display = 'block';
        }
    } catch (err) {
        console.error(err);
        errorMsg.innerText = 'Ошибка соединения с сервером';
        errorMsg.style.display = 'block';
    }
});

// Логика РЕГИСТРАЦИИ (AJAX)
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    const errorMsg = document.getElementById('register-error');

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();

        if (response.ok) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('user', JSON.stringify({
                name: result.user.username,
                avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
            }));
            window.location.href = '/index.html';
        } else {
            errorMsg.innerText = result.message;
            errorMsg.style.display = 'block';
        }
    } catch (err) {
        console.error(err);
        errorMsg.innerText = 'Ошибка соединения с сервером';
        errorMsg.style.display = 'block';
    }
});