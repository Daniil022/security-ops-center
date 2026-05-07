if (!localStorage.getItem('sec_token') || localStorage.getItem('sec_role') !== 'administrator') {
    window.location.href = 'index.html';
}

// Ваши камеры
const cameras = {
    1: { name: 'Главный вход', ip: '10.1.30.60', mac: '60:7e:a4:15:ad:eb' },
    2: { name: 'Серверная', ip: '10.1.30.37', mac: '60:7e:a4:15:c2:5c' },
    3: { name: 'Периметр', ip: '', mac: '' },
    4: { name: 'Склад', ip: '', mac: '' }
};

const activeStreams = {};
const streamTimers = {};

// ========== ПОДКЛЮЧЕНИЕ КАМЕРЫ (ТОЛЬКО HTTP/ IP) ==========
async function connectCamera(cameraId) {
    let ip;
    
    if (cameraId <= 2) {
        ip = cameras[cameraId].ip;
    } else {
        const input = document.getElementById('ip' + cameraId);
        ip = input ? input.value.trim() : '';
        if (ip) cameras[cameraId].ip = ip;
    }
    
    if (!ip) {
        updateStatus(cameraId, '❌ Введите IP', '#ff4757');
        return;
    }
    
    stopStream(cameraId);
    updateStatus(cameraId, '🔍 Поиск...', '#ffa502');
    setDot(cameraId, 'connecting');
    addLog(cameras[cameraId].name, 'Поиск камеры: ' + ip);
    
    // Все порты
    const ports = [8080, 80, 554, 8000, 8081, 8554, 88, 34567, 8800, 8899, 9000, 37777, 55432, 35000, 30001, 1024, 2000, 3000, 4000, 5000, 7000, 8001, 8082, 10000, 10554, 18080];
    
    // Все пути
    const paths = [
        '/', '/video', '/stream', '/live', '/mjpeg', '/video.mjpg', '/stream.mjpg',
        '/cgi-bin/mjpg/video.cgi', '/videostream.cgi', '/webcam.mjpeg',
        '/snapshot.jpg', '/snapshot.cgi', '/img/snapshot.cgi', '/img/video.mjpeg',
        '/tcp/av0_0', '/tcp/av0_1', '/udp/av0_0', '/udp/av0_1',
        '/h264', '/h264.sdp', '/onvif/device_service',
        '/ISAPI/Streaming/channels/101/httpPreview', '/ISAPI/Streaming/channels/102/httpPreview',
        '/Streaming/Channels/1/httppreview', '/Streaming/Channels/1/picture',
        '/mjpg/video.mjpg', '/ipcam/mjpeg.cgi', '/ipcam/stream.cgi',
        '/goform/video', '/api/video/stream', '/play1.m3u8',
        '/live/0', '/live/1', '/live/2'
    ];
    
    let found = false;
    
    // Перебираем порты
    for (const port of ports) {
        if (found) break;
        updateStatus(cameraId, 'Порт ' + port + '...', '#ffa502');
        
        for (const path of paths) {
            if (found) break;
            const url = 'http://' + ip + ':' + port + path;
            found = await testURL(cameraId, url);
            if (found) {
                updateStatus(cameraId, '✅ Порт ' + port, '#2ed573');
                setDot(cameraId, 'online');
                addLog(cameras[cameraId].name, '✅ ' + url);
            }
        }
    }
    
    if (!found) {
        updateStatus(cameraId, '❌ Нет ответа', '#ff4757');
        setDot(cameraId, 'offline');
        addLog(cameras[cameraId].name, '❌ Не найдена');
    }
    
    updateCount();
}

// ========== ТЕСТ URL ==========
function testURL(cameraId, url) {
    return new Promise((resolve) => {
        const view = document.getElementById('view' + cameraId);
        const img = new Image();
        let done = false;
        
        const timer = setTimeout(() => {
            if (!done) { done = true; img.src = ''; resolve(false); }
        }, 2000);
        
        img.onload = function() {
            if (!done && img.naturalWidth > 16 && img.naturalWidth < 10000) {
                done = true;
                clearTimeout(timer);
                
                view.innerHTML = '';
                img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
                img.id = 'img' + cameraId;
                view.appendChild(img);
                addTS(view, cameraId);
                addFS(view);
                
                activeStreams[cameraId] = { url: url };
                
                // Автообновление каждые 500мс
                streamTimers[cameraId] = setInterval(() => {
                    const el = document.getElementById('img' + cameraId);
                    if (el) el.src = url + '?t=' + Date.now();
                }, 500);
                
                resolve(true);
            }
        };
        
        img.onerror = function() {
            if (!done) { done = true; clearTimeout(timer); resolve(false); }
        };
        
        img.src = url + '?t=' + Date.now();
    });
}

// ========== ОСТАНОВКА ==========
function stopStream(cameraId) {
    if (streamTimers[cameraId]) {
        clearInterval(streamTimers[cameraId]);
        streamTimers[cameraId] = null;
    }
    activeStreams[cameraId] = null;
    
    const view = document.getElementById('view' + cameraId);
    view.innerHTML = '<div class="no-signal"><span class="icon">🎥</span>Ожидание...</div>';
    addTS(view, cameraId);
    
    updateCount();
}

// ========== КНОПКИ ==========
function connectHTTP(cameraId, ip) {
    if (ip && cameraId >= 3) cameras[cameraId].ip = ip;
    connectCamera(cameraId);
}

function connectRTSP(cameraId, ip) {
    if (ip && cameraId >= 3) cameras[cameraId].ip = ip;
    connectCamera(cameraId);
}

function connectWebRTC(cameraId) {
    // Не используем WebRTC вообще
    connectCamera(cameraId);
}

function connectCustomIP(cameraId) {
    const input = document.getElementById('ip' + cameraId);
    if (!input || !input.value.trim()) {
        alert('Введите IP-адрес');
        return;
    }
    cameras[cameraId].ip = input.value.trim();
    connectCamera(cameraId);
}

function snapshot(cameraId) {
    const img = document.getElementById('img' + cameraId);
    if (img && activeStreams[cameraId]) {
        const a = document.createElement('a');
        a.href = img.src;
        a.download = 'cam' + cameraId + '.jpg';
        a.click();
        addLog(cameras[cameraId].name, '📸 Снимок');
    } else {
        alert('Нет потока');
    }
}

// ========== ПОМОЩНИКИ ==========
function setDot(id, status) {
    const dot = document.getElementById('dot' + id);
    if (dot) dot.className = 'status-dot status-' + status;
}

function updateStatus(id, text, color) {
    // Обновляем заголовок камеры
    const card = document.getElementById('card' + id);
    if (card) {
        const nameEl = card.querySelector('.name');
        if (nameEl) nameEl.textContent = '📷 Камера ' + id + ' — ' + text;
    }
}

function updateCount() {
    const count = Object.values(activeStreams).filter(Boolean).length;
    const el = document.getElementById('active-count');
    if (el) el.textContent = count;
}

function addTS(container) {
    const ts = document.createElement('div');
    ts.className = 'timestamp-overlay';
    container.appendChild(ts);
}

function addFS(container) {
    const btn = document.createElement('button');
    btn.className = 'fullscreen-btn';
    btn.textContent = '⛶';
    btn.onclick = () => container.requestFullscreen?.();
    container.appendChild(btn);
}

// Время на камерах
setInterval(() => {
    for (let i = 1; i <= 4; i++) {
        const ts = document.querySelector('#view' + i + ' .timestamp-overlay');
        if (ts) ts.textContent = new Date().toLocaleString('ru-RU');
    }
}, 1000);

// Журнал
let logs = JSON.parse(localStorage.getItem('vr_house_logs') || '[]');

function addLog(cam, ev) {
    logs.unshift({ time: new Date().toLocaleString('ru-RU'), camera: cam, event: ev });
    if (logs.length > 50) logs.pop();
    localStorage.setItem('vr_house_logs', JSON.stringify(logs));
    const tbody = document.getElementById('vr-log');
    if (tbody) tbody.innerHTML = logs.slice(0, 10).map(l =>
        `<tr><td>${l.time}</td><td>${l.camera}</td><td>${l.event}</td></tr>`
    ).join('');
}

function logout() {
    for (const key in streamTimers) clearInterval(streamTimers[key]);
    localStorage.removeItem('sec_token');
    localStorage.removeItem('sec_role');
    window.location.href = 'index.html';
}

// АВТОСТАРТ
window.addEventListener('load', () => {
    const tbody = document.getElementById('vr-log');
    if (tbody) tbody.innerHTML = logs.slice(0, 10).map(l =>
        `<tr><td>${l.time}</td><td>${l.camera}</td><td>${l.event}</td></tr>`
    ).join('');
    updateCount();
    addLog('VR House', '🚀 Запуск');
    
    // Подключаем камеры 1 и 2
    setTimeout(() => connectCamera(1), 500);
    setTimeout(() => connectCamera(2), 1500);
});
