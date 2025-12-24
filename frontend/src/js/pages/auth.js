document.addEventListener('DOMContentLoaded', () => {
    // 1. Инициализация маски телефона
    const phoneEl = document.getElementById('reg-phone');
    if (phoneEl) {
        window.phoneMask = IMask(phoneEl, { mask: '+{7} (000) 000-00-00' });
    }

    // 2. Проверка URL (режим регистрации)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'register') {
        toggleAuthMode('register');
    }
});

// --- ПЕРЕКЛЮЧЕНИЕ ВХОД / РЕГИСТРАЦИЯ ---
const card = document.getElementById('auth-card');
const btnLogin = document.getElementById('tab-login');
const btnRegister = document.getElementById('tab-register');

btnLogin.addEventListener('click', () => toggleAuthMode('login'));
btnRegister.addEventListener('click', () => toggleAuthMode('register'));

function toggleAuthMode(mode) {
    if (mode === 'register') {
        card.classList.add('register-mode');
        btnLogin.classList.remove('active');
        btnRegister.classList.add('active');
        resetRegSteps();
    } else {
        card.classList.remove('register-mode');
        btnRegister.classList.remove('active');
        btnLogin.classList.add('active');
    }
}

// --- ЛОГИКА ШАГОВ РЕГИСТРАЦИИ ---
function resetRegSteps() {
    document.getElementById('step-1').classList.add('active');
    document.getElementById('step-2').classList.remove('active');
}

document.getElementById('btn-next').addEventListener('click', () => {
    if (validateStep1()) {
        document.getElementById('step-1').classList.remove('active');
        document.getElementById('step-2').classList.add('active');
    }
});

document.getElementById('btn-prev').addEventListener('click', () => {
    document.getElementById('step-2').classList.remove('active');
    document.getElementById('step-1').classList.add('active');
});

// --- ВАЛИДАЦИЯ ---
function setError(id, msg) {
    const group = document.getElementById('group-' + id);
    group.classList.add('error');
    group.querySelector('.error-text').innerText = msg;
    return false;
}

function clearError(id) {
    const group = document.getElementById('group-' + id);
    group.classList.remove('error');
    return true;
}

function validateStep1() {
    let isValid = true;
    const user = document.getElementById('reg-username').value;
    const pass = document.getElementById('reg-password').value;
    const conf = document.getElementById('reg-confirm').value;

    if (!/^[a-zA-Z0-9_]{3,}$/.test(user)) isValid = setError('reg-username', 'Мин. 3 символа, латиница');
    else clearError('reg-username');

    if (pass.length < 6) isValid = setError('reg-password', 'Мин. 6 символов');
    else clearError('reg-password');

    if (pass !== conf) isValid = setError('reg-confirm', 'Пароли не совпадают');
    else clearError('reg-confirm');

    return isValid;
}

function validateStep2() {
    let isValid = true;
    const name = document.getElementById('reg-fullname').value;
    const email = document.getElementById('reg-email').value;
    
    if (name.trim().length < 2) isValid = setError('reg-fullname', 'Введите имя');
    else clearError('reg-fullname');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) isValid = setError('reg-email', 'Некорректный email');
    else clearError('reg-email');

    if (!window.phoneMask.masked.isComplete) isValid = setError('reg-phone', 'Введите номер');
    else clearError('reg-phone');

    return isValid;
}

// --- ОТПРАВКА ФОРМ ---

// Вход
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errBox = document.getElementById('login-error');
    
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(Object.fromEntries(fd))
        });
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = '/profile.html';
        } else {
            errBox.innerText = data.message;
        }
    } catch(err) { errBox.innerText = 'Ошибка сети'; }
});

// Регистрация
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateStep2()) return;

    const data = {
        username: document.getElementById('reg-username').value,
        password: document.getElementById('reg-password').value,
        full_name: document.getElementById('reg-fullname').value,
        email: document.getElementById('reg-email').value,
        phone: window.phoneMask.value
    };

    const errBox = document.getElementById('register-error');

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (res.ok) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('user', JSON.stringify(result.user));
            window.location.href = '/profile.html';
        } else {
            errBox.innerText = result.message;
        }
    } catch(err) { errBox.innerText = 'Ошибка сети'; }
});

// Глазик пароля
document.querySelectorAll('.toggle-pass').forEach(btn => {
    btn.onclick = () => {
        const input = btn.previousElementSibling;
        if (input.type === 'password') {
            input.type = 'text';
            btn.className = 'bx bx-show toggle-pass';
        } else {
            input.type = 'password';
            btn.className = 'bx bx-hide toggle-pass';
        }
    };
});