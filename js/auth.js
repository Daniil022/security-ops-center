// Единственная учётная запись — Administrator
const ADMIN_CREDS = {
    user: "Administrator",
    pass: "S3cur3P@ss!"
};

function authenticate() {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value;
    const errorDiv = document.getElementById('error-message');
    
    // Защита от брутфорса
    let attempts = parseInt(localStorage.getItem('sec_attempts') || '0');
    if (attempts >= 5) {
        errorDiv.textContent = 'ДОСТУП ЗАБЛОКИРОВАН. Обратитесь к руководителю отдела.';
        return;
    }

    if (user === ADMIN_CREDS.user && pass === ADMIN_CREDS.pass) {
        // Создаём сессионный токен администратора
        const sessionToken = btoa('Administrator:' + new Date().getTime());
        localStorage.setItem('sec_token', sessionToken);
        localStorage.setItem('sec_role', 'administrator');
        localStorage.removeItem('sec_attempts');
        window.location.href = 'dashboard.html';
    } else {
        attempts++;
        localStorage.setItem('sec_attempts', attempts);
        const left = 5 - attempts;
        errorDiv.textContent = `Неверные учётные данные. Осталось попыток: ${left}`;
    }
}

// Обновление времени
setInterval(() => {
    const timeEl = document.getElementById('utc-time');
    if (timeEl) timeEl.textContent = new Date().toUTCString();
}, 1000);

// Обработка Enter на странице логина
document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        authenticate();
    }
});
