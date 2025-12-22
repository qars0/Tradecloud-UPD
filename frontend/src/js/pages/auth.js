const sign_in_btn = document.querySelector("#sign-in-btn");
const sign_up_btn = document.querySelector("#sign-up-btn");
const container = document.querySelector(".container");

// Анимация переключения
sign_up_btn.addEventListener("click", () => {
    container.classList.add("sign-up-mode");
});

sign_in_btn.addEventListener("click", () => {
    container.classList.remove("sign-up-mode");
});

// Логика ВХОДА
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
            // Сохраняем флаг и данные юзера для хедера
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('user', JSON.stringify({
                name: result.user.username,
                avatar: result.user.avatar_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
            }));
            
            // Редирект на профиль или главную
            window.location.href = '/profile.html'; 
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

// Логика РЕГИСТРАЦИИ
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
            window.location.href = '/profile.html'; 
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