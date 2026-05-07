if (!localStorage.getItem('sec_token') || localStorage.getItem('sec_role') !== 'administrator') {
    window.location.href = 'index.html';
}

const cameras = {
    1: { name: 'Главный вход', ip: '10.1.30.60', mac: '60:7e:a4:15:ad:eb' },
    2: { name: 'Серверная', ip: '10.1.30.37', mac: '60:7e:a4:15:c2:5c' },
    3: { name: 'Периметр', ip: '', mac: '' },
    4: { name: 'Склад', ip: '', mac: '' }
};

const timers = {};

// Все возможные URL для снапшотов
function getURLs(ip) {
    return [
        // Xiaomi Chuangmi
        'http://' + ip + ':8080/cgi-bin/snapshot.cgi',
        'http://' + ip + ':8080/snapshot.jpg',
        'http://' + ip + ':8080/jpg/image.jpg',
        'http://' + ip + ':8080/image.jpg',
        'http://' + ip + ':80/cgi-bin/snapshot.cgi',
        'http://' + ip + ':80/snapshot.jpg',
        'http://' + ip + ':8000/snapshot.jpg',
        // Универсальные
        'http://' + ip + ':8080/video',
        'http://' + ip + ':8080/stream',
        'http://' + ip + ':8080/mjpeg',
        'http://' + ip + ':80/video',
        'http://' + ip + ':554/stream',
    ];
}

// Главная функция подключения
function connectCamera(id) {
    let ip;
    
    if (id <= 2) {
        ip = cameras[id].ip;
    } else {
        const inp = document.getElementById('ip' + id);
        ip = inp ? inp.value.trim() : '';
        if (ip) cameras[id].ip = ip;
    }
    
    if (!ip) { setStatus(id, '❌ Нет IP', '#ff4757'); return; }
    
    stopStream(id);
    setStatus(id, '🔍 Поиск...', '#ffa502');
    setDot(id, 'connecting');
    
    const view = document.getElementById('view' + id);
    const urls = getURLs(ip);
    
    // Перебираем URL пока не найдём рабочий
    tryNextURL(id, view, urls, 0, ip);
}

function tryNextURL(id, view, urls, index, ip) {
    if (index >= urls.length) {
        setStatus(id, '❌ Не найдена', '#ff4757');
        setDot(id, 'offline');
        return;
    }
    
    const url = urls[index];
    
    // Создаём скрытый img для теста
    const testImg = new Image();
    let done = false;
    
    const timeout = setTimeout(() => {
        if (!done) { done = true; tryNextURL(id, view, urls, index + 1, ip); }
    }, 2000);
    
    testImg.onload = function() {
        if (!done && testImg.naturalWidth > 50) {
            done = true;
            clearTimeout(timeout);
            
            // Нашли рабочий URL!
            view.innerHTML = '';
            
            const img = document.createElement('img');
            img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
            img.id = 'cam-img-' + id;
            view.appendChild(img);
            
            // Кнопка фулскрина
            const btn = document.createElement('button');
            btn.textContent = '⛶';
            btn.style.cssText = 'position:absolute;top:10px;right:10px;z-index:10;background:rgba(0,0,0,0.6);border:none;color:white;padding:5px 10px;cursor:pointer;border-radius:4px;width:auto;';
            btn.onclick = function() { view.requestFullscreen?.(); };
            view.appendChild(btn);
            
            // Время
            const ts = document.createElement('div');
            ts.style.cssText = 'position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,0.7);padding:3px 8px;border-radius:3px;font-size:0.75em;z-index:10;color:white;';
            ts.id = 'ts' + id;
            view.appendChild(ts);
            
            // Обновляем кадр каждую секунду
            timers[id] = setInterval(function() {
                const el = document.getElementById('cam-img-' + id);
                if (el) {
                    el.src = url + '?t=' + Date.now();
                } else {
                    clearInterval(timers[id]);
                }
            }, 1000);
            
            // Первый кадр
            img.src = url + '?t=' + Date.now();
            
            setStatus(id, '✅ Работает', '#2ed573');
            setDot(id, 'online');
        }
    };
    
    testImg.onerror = function() {
        if (!done) { done = true; clearTimeout(timeout); tryNextURL(id, view, urls, index + 1, ip); }
    };
    
    testImg.src = url + '?t=' + Date.now();
}

function stopStream(id) {
    if (timers[id]) { clearInterval(timers[id]); timers[id] = null; }
    
    const view = document.getElementById('view' + id);
    view.innerHTML = '<div class="no-signal" style="text-align:center;color:#444;"><span style="font-size:40px;display:block;">🎥</span>Ожидание...</div>';
    
    const ts = document.createElement('div');
    ts.style.cssText = 'position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,0.7);padding:3px 8px;border-radius:3px;font-size:0.75em;z-index:10;color:white;';
    ts.id = 'ts' + id;
    view.appendChild(ts);
}

// Кнопки
function connectHTTP(id, ip) { if (ip) cameras[id].ip = ip; connectCamera(id); }
function connectRTSP(id, ip) { if (ip) cameras[id].ip = ip; connectCamera(id); }
function connectWebRTC(id) { connectCamera(id); }
function connectCustomIP(id) {
    const inp = document.getElementById('ip' + id);
    if (!inp || !inp.value.trim()) { alert('Введите IP'); return; }
    cameras[id].ip = inp.value.trim();
    connectCamera(id);
}

function snapshot(id) {
    const img = document.getElementById('cam-img-' + id);
    if (img) {
        const a = document.createElement('a');
        a.href = img.src;
        a.download = 'cam' + id + '.jpg';
        a.click();
    } else {
        alert('Нет картинки');
    }
}

// Помощники
function setDot(id, s) { const e = document.getElementById('dot' + id); if (e) e.className = 'status-dot status-' + s; }
function setStatus(id, t, c) {
    const card = document.getElementById('card' + id);
    if (card) { const n = card.querySelector('.name'); if (n) n.textContent = '📷 Камера ' + id + ' — ' + t; }
}

// Время
setInterval(function() {
    for (let i = 1; i <= 4; i++) {
        const ts = document.getElementById('ts' + i);
        if (ts) ts.textContent = new Date().toLocaleString('ru-RU');
    }
}, 1000);

// Выход
function logout() {
    for (let k in timers) clearInterval(timers[k]);
    localStorage.removeItem('sec_token');
    localStorage.removeItem('sec_role');
    window.location.href = 'index.html';
}

// Автозапуск
window.addEventListener('load', function() {
    setTimeout(function() { connectCamera(1); }, 500);
    setTimeout(function() { connectCamera(2); }, 1500);
});
