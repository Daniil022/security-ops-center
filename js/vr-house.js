if (!localStorage.getItem('sec_token') || localStorage.getItem('sec_role') !== 'administrator') {
    window.location.href = 'index.html';
}

const cameras = {
    1: { name: 'Главный вход', ip: '10.1.30.60', mac: '60:7e:a4:15:ad:eb', vendor: 'xiaomi_chuangmi' },
    2: { name: 'Серверная', ip: '10.1.30.37', mac: '60:7e:a4:15:c2:5c', vendor: 'xiaomi_chuangmi' },
    3: { name: 'Периметр', ip: '', mac: '', vendor: '' },
    4: { name: 'Склад', ip: '', mac: '', vendor: '' }
};

const activeStreams = {};
const streamTimers = {};

// ========== БАЗА КАМЕР ==========
const CAMERA_DB = {
    // Xiaomi Chuangmi — особый подход!
    xiaomi_chuangmi: {
        name: 'Xiaomi Chuangmi',
        ports: [8080, 80, 554, 8000, 8554],
        // Правильные пути для Xiaomi Chuangmi (IMILAB)
        paths: [
            // Снапшоты (самый надёжный способ)
            '/cgi-bin/snapshot.cgi',
            '/snapshot.jpg',
            '/jpg/image.jpg',
            '/image.jpg',
            '/image/jpeg.cgi',
            // MJPEG потоки
            '/cgi-bin/mjpg/video.cgi',
            '/cgi-bin/mjpg/video.cgi?channel=1&subtype=0',
            '/cgi-bin/mjpg/video.cgi?channel=0&subtype=0',
            '/mjpg/video.mjpg',
            '/video.mjpg',
            '/stream.mjpg',
            // Прямые потоки
            '/video',
            '/stream',
            '/live',
            '/mjpeg',
            '/tcp/av0_0',
            '/tcp/av0_1',
            '/udp/av0_0',
            '/udp/av0_1',
            // H264
            '/h264',
            '/h264.sdp',
            '/live/ch00_0',
            '/live/ch00_1',
            // ONVIF
            '/onvif/device_service',
            // ISAPI (Hikvision-подобные)
            '/ISAPI/Streaming/channels/101/httpPreview',
            '/ISAPI/Streaming/channels/101/picture',
            '/Streaming/channels/1/picture',
            '/Streaming/Channels/1/httppreview',
            // API
            '/api/video/stream',
            '/goform/video',
            '/webcam.mjpeg',
            '/videostream.cgi',
            '/ipcam/mjpeg.cgi',
            '/ipcam/stream.cgi',
            '/img/snapshot.cgi',
            '/img/video.mjpeg',
            // HLS
            '/play1.m3u8',
            '/live/0',
            '/live/1',
            '/live/2',
            // Просто корень
            '/'
        ]
    },
    
    hikvision: {
        name: 'Hikvision',
        ports: [80, 554, 8000, 8443, 7681],
        paths: [
            '/Streaming/channels/1/picture',
            '/ISAPI/Streaming/channels/101/picture',
            '/Streaming/Channels/1/httppreview',
            '/Streaming/channels/1/httppreview',
            '/snapshot.jpg',
            '/video',
            '/stream',
            '/mjpeg',
            '/video.mjpg'
        ]
    },
    
    dahua: {
        name: 'Dahua',
        ports: [80, 554, 37777, 35000],
        paths: [
            '/cgi-bin/snapshot.cgi?channel=1',
            '/cgi-bin/snapshot.cgi?channel=0',
            '/cgi-bin/mjpg/video.cgi?channel=1&subtype=0',
            '/cgi-bin/mjpg/video.cgi?channel=0&subtype=0',
            '/snapshot.jpg',
            '/video',
            '/stream'
        ]
    },
    
    reolink: {
        name: 'Reolink',
        ports: [80, 443, 554, 8000],
        paths: [
            '/cgi-bin/snapshot.cgi',
            '/snapshot.jpg',
            '/video',
            '/stream',
            '/mjpeg'
        ]
    },
    
    tplink: {
        name: 'TP-Link Tapo',
        ports: [80, 554, 8080, 443],
        paths: [
            '/snapshot.jpg',
            '/stream/snapshot.jpg',
            '/snapshot.cgi',
            '/video',
            '/stream',
            '/mjpeg',
            '/stream.mjpg'
        ]
    },
    
    generic: {
        name: 'Универсальная',
        ports: [80, 554, 8000, 8080, 8081, 8554, 88, 34567, 37777, 55432, 35000, 30001, 1024, 2000, 3000, 4000, 5000, 7000, 8001, 8082, 10000, 10554, 18080],
        paths: [
            '/snapshot.jpg', '/snapshot.cgi', '/cgi-bin/snapshot.cgi',
            '/img/snapshot.cgi', '/image.jpg', '/jpg/image.jpg',
            '/image/jpeg.cgi', '/cgi-bin/video.jpg',
            '/Streaming/channels/1/picture', '/ISAPI/Streaming/channels/101/picture',
            '/webcam.jpg', '/snap.jpg', '/still.jpg', '/capture.jpg',
            '/', '/video', '/stream', '/live', '/mjpeg',
            '/video.mjpg', '/stream.mjpg', '/mjpg/video.mjpg',
            '/webcam.mjpeg', '/cgi-bin/mjpg/video.cgi',
            '/cgi-bin/mjpg/video.cgi?channel=1&subtype=0',
            '/cgi-bin/mjpg/video.cgi?channel=0&subtype=0',
            '/videostream.cgi', '/ipcam/mjpeg.cgi',
            '/ipcam/stream.cgi', '/goform/video',
            '/tcp/av0_0', '/tcp/av0_1', '/udp/av0_0',
            '/h264', '/h264.sdp', '/play1.m3u8',
            '/live/0', '/live/1', '/live/2',
            '/Streaming/channels/1/httppreview',
            '/ISAPI/Streaming/channels/101/httpPreview',
            '/cam/realmonitor?channel=1&subtype=0',
            '/axis-cgi/mjpg/video.cgi',
            '/api/video/stream', '/img/video.mjpeg'
        ]
    }
};

// ========== ПОДКЛЮЧЕНИЕ ==========
async function connectCamera(cameraId, vendorHint) {
    let ip;
    
    if (cameraId <= 2) {
        ip = cameras[cameraId].ip;
        vendorHint = cameras[cameraId].vendor;
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
    addLog(cameras[cameraId].name, '🔍 Сканирую ' + ip);
    
    let found = false;
    
    // Шаг 1: Проверяем по известному вендору
    if (vendorHint && CAMERA_DB[vendorHint]) {
        addLog(cameras[cameraId].name, 'Тип: ' + CAMERA_DB[vendorHint].name);
        found = await scanPorts(cameraId, ip, CAMERA_DB[vendorHint]);
    }
    
    // Шаг 2: Все остальные вендоры
    if (!found) {
        for (const key in CAMERA_DB) {
            if (found) break;
            if (key === vendorHint || key === 'generic') continue;
            found = await scanPorts(cameraId, ip, CAMERA_DB[key]);
            if (found) addLog(cameras[cameraId].name, '✅ ' + CAMERA_DB[key].name);
        }
    }
    
    // Шаг 3: Универсальный поиск
    if (!found) {
        found = await scanPorts(cameraId, ip, CAMERA_DB['generic']);
    }
    
    if (found) {
        updateStatus(cameraId, '✅ Подключено', '#2ed573');
        setDot(cameraId, 'online');
    } else {
        updateStatus(cameraId, '❌ Нет сигнала', '#ff4757');
        setDot(cameraId, 'offline');
        addLog(cameras[cameraId].name, '❌ Не найдена');
        
        // Показываем подсказку
        const view = document.getElementById('view' + cameraId);
        view.innerHTML = `
            <div class="no-signal" style="color:#ffa502;text-align:center;padding:20px;">
                <span class="icon">⚠️</span>
                <p>Камера ${cameras[cameraId].name}</p>
                <p style="font-size:0.8em;">IP: ${ip}</p>
                <p style="font-size:0.7em;color:#888;">Проверьте что телефон и камера в одной сети Wi-Fi</p>
            </div>
        `;
        addTS(view, cameraId);
    }
    
    updateCount();
}

// ========== СКАНИРОВАНИЕ ПОРТОВ ==========
async function scanPorts(cameraId, ip, vendorConfig) {
    const ports = vendorConfig.ports || [80];
    const paths = vendorConfig.paths || [];
    
    for (const port of ports) {
        updateStatus(cameraId, 'Порт ' + port + '...', '#ffa502');
        
        for (const path of paths) {
            const url = 'http://' + ip + ':' + port + path;
            const ok = await testURL(cameraId, url);
            if (ok) return true;
        }
    }
    return false;
}

// ========== ТЕСТ URL ==========
function testURL(cameraId, url) {
    return new Promise((resolve) => {
        const view = document.getElementById('view' + cameraId);
        const img = new Image();
        let done = false;
        
        const timer = setTimeout(() => {
            if (!done) { done = true; img.src = ''; resolve(false); }
        }, 3000);
        
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
                    if (el) {
                        el.src = url + '?t=' + Date.now();
                    }
                }, 500);
                
                resolve(true);
            }
        };
        
        img.onerror = function() {
            if (!done) { done = true; clearTimeout(timer); resolve(false); }
        };
        
        // Пробуем с разными параметрами для обхода кеша
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
    if (view) {
        view.innerHTML = '<div class="no-signal"><span class="icon">🎥</span>Ожидание...</div>';
        addTS(view, cameraId);
    }
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

// ========== ХЕЛПЕРЫ ==========
function setDot(id, status) {
    const dot = document.getElementById('dot' + id);
    if (dot) dot.className = 'status-dot status-' + status;
}
function updateStatus(id, text, color) {
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

// Время
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
    addLog('VR House', '🚀 Запуск v2.0');
    
    setTimeout(() => connectCamera(1, 'xiaomi_chuangmi'), 1000);
    setTimeout(() => connectCamera(2, 'xiaomi_chuangmi'), 2500);
});
