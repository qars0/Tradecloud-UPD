// Элементы
const sign_in_btn = document.querySelector("#sign-in-btn");
const sign_up_btn = document.querySelector("#sign-up-btn");
const container = document.querySelector(".container");

// 1. Анимация Слайдера (Вход <-> Регистрация)
sign_up_btn.addEventListener("click", () => {
    container.classList.add("sign-up-mode");
    // Сброс шагов при переключении
    showStep(1);
});

sign_in_btn.addEventListener("click", () => {
    container.classList.remove("sign-up-mode");
});

// Проверка URL (если перешли по ссылке)
if (new URLSearchParams(window.location.search).get('mode') === 'register') {
    container.classList.add("sign-up-mode");
}

// 2. Логика Шагов Регистрации
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const btnNext = document.getElementById('btn-next');
const btnPrev = document.getElementById('btn-prev');

function showStep(step) {
    if (step === 1) {
        step1.classList.add('active');
        step2.classList.remove('active');
    } else {
        step1.classList.remove('active');
        step2.classList.add('active');
    }
}

// Валидация Шага 1
btnNext.addEventListener('click', () => {
    if (validateStep1()) {
        showStep(2);
    }
});

btnPrev.addEventListener('click', () => {
    showStep(1);
});

// 3. Маска для телефона (IMask)
const phoneInput = document.getElementById('reg-phone');
const phoneMask = IMask(phoneInput, {
    mask: '+{7} (000) 000-00-00'
});

// 4. Функции Валидации
function showError(id, message) {
    const el = document.getElementById(id); // Элемент инпута
    const errEl = document.getElementById('err-' + id.split('-')[1]); // span ошибки
    
    el.parentElement.classList.add('error'); // Красная рамка
    errEl.innerText = message;
    return false;
}

function clearError(id) {
    const el = document.getElementById(id);
    const errEl = document.getElementById('err-' + id.split('-')[1]);
    
    el.parentElement.classList.remove('error');
    errEl.innerText = '';
    return true;
}

function validateStep1() {
    let isValid = true;
    
    // Логин: Латиница, цифры, _, мин 3 символа
    const username = document.getElementById('reg-username').value;
    const userRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!userRegex.test(username)) {
        isValid = showError('reg-username', 'Только латиница и цифры, от 3 символов');
    } else {
        clearError('reg-username');
    }

    // Пароль: Мин 6 символов
    const pass = document.getElementById('reg-password').value;
    if (pass.length < 6) {
        isValid = showError('reg-password', 'Минимум 6 символов');
    } else {
        clearError('reg-password');
    }

    // Повтор пароля
    const confirm = document.getElementById('reg-password-confirm').value;
    if (pass !== confirm) {
        isValid = showError('reg-password-confirm', 'Пароли не совпадают');
    } else {
        clearError('reg-password-confirm');
    }

    return isValid;
}

function validateStep2() {
    let isValid = true;

    // Имя Фамилия: Кириллица, пробел, мин 2 слова
    const fullname = document.getElementById('reg-fullname').value;
    // Просто проверка на не пустое для простоты, или /^[А-Яа-яЁё\s]+$/
    if (fullname.trim().length < 3) {
        isValid = showError('reg-fullname', 'Введите Имя и Фамилию');
    } else {
        clearError('reg-fullname');
    }

    // Email: Regex
    const email = document.getElementById('reg-email').value;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        isValid = showError('reg-email', 'Некорректный email');
    } else {
        clearError('reg-email');
    }

    // Телефон: Проверка заполненности маски
    if (!phoneMask.masked.isComplete) {
        isValid = showError('reg-phone', 'Введите полный номер');
    } else {
        clearError('reg-phone');
    }

    return isValid;
}

// 5. Обработка Глазика
document.querySelectorAll('.toggle-password').forEach(icon => {
    icon.addEventListener('click', function() {
        const input = this.previousElementSibling;
        if (input.type === 'password') {
            input.type = 'text';
            this.classList.remove('bx-hide');
            this.classList.add('bx-show');
        } else {
            input.type = 'password';
            this.classList.remove('bx-show');
            this.classList.add('bx-hide');
        }
    });
});

// 6. Отправка формы РЕГИСТРАЦИИ
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateStep1() || !validateStep2()) return;

    const data = {
        username: document.getElementById('reg-username').value,
        password: document.getElementById('reg-password').value,
        full_name: document.getElementById('reg-fullname').value,
        email: document.getElementById('reg-email').value,
        phone: phoneMask.value // Берем значение из маски
    };

    const errorMsg = document.getElementById('register-error');
    errorMsg.style.display = 'none';

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (res.ok) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('user', JSON.stringify(result.user));
            window.location.href = '/profile.html';
        } else {
            errorMsg.innerText = result.message;
            errorMsg.style.display = 'block';
        }
    } catch (err) {
        errorMsg.innerText = 'Ошибка сети';
        errorMsg.style.display = 'block';
    }
});

// 7. Отправка формы ВХОДА (осталась прежней)
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    const errorMsg = document.getElementById('login-error');

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (res.ok) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('user', JSON.stringify(result.user));
            window.location.href = '/profile.html';
        } else {
            errorMsg.innerText = result.message;
            errorMsg.style.display = 'block';
        }
    } catch (err) {
        errorMsg.innerText = 'Ошибка сети';
        errorMsg.style.display = 'block';
    }
});