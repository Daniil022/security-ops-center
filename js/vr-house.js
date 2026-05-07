if (!localStorage.getItem('sec_token') || localStorage.getItem('sec_role') !== 'administrator') {
    window.location.href = 'index.html';
}

const cameras = {
    1: { name: 'Главный вход', ip: '10.1.30.60', mac: '60:7e:a4:15:ad:eb', vendor: 'xiaomi' },
    2: { name: 'Серверная', ip: '10.1.30.37', mac: '60:7e:a4:15:c2:5c', vendor: 'xiaomi' },
    3: { name: 'Периметр', ip: '', mac: '', vendor: '' },
    4: { name: 'Склад', ip: '', mac: '', vendor: '' }
};

const timers = {};
const activeStreams = {};

// ========== МЕГА-БАЗА URL ДЛЯ ВСЕХ КАМЕР ==========
function getAllURLs(ip, vendor) {
    const urls = [];
    
    // Все возможные порты
    const ports = [80, 554, 8000, 8080, 8081, 8554, 88, 443, 8443, 34567, 37777, 55432, 35000, 30001];
    
    // Все возможные пути для снапшотов
    const snapshotPaths = [
        '/cgi-bin/snapshot.cgi',
        '/cgi-bin/snapshot.cgi?channel=1',
        '/cgi-bin/snapshot.cgi?channel=0',
        '/snapshot.jpg',
        '/snapshot.cgi',
        '/jpg/image.jpg',
        '/image.jpg',
        '/image/jpeg.cgi',
        '/cgi-bin/video.jpg',
        '/img/snapshot.cgi',
        '/img/video.jpg',
        '/webcam.jpg',
        '/snap.jpg',
        '/still.jpg',
        '/capture.jpg',
        '/ISAPI/Streaming/channels/101/picture',
        '/ISAPI/Streaming/channels/101/picture?snapShotImageType=JPEG',
        '/Streaming/channels/1/picture',
        '/Streaming/channels/1/picture?snapShotImageType=JPEG',
        '/Streaming/Channels/1/httppreview',
        '/onvif/snapshot',
        '/jpg/1/image.jpg',
        '/jpg/image.jpg',
    ];
    
    // Все возможные пути для MJPEG/видео
    const videoPaths = [
        '/',
        '/video',
        '/stream',
        '/live',
        '/mjpeg',
        '/video.mjpg',
        '/stream.mjpg',
        '/mjpg/video.mjpg',
        '/webcam.mjpeg',
        '/cgi-bin/mjpg/video.cgi',
        '/cgi-bin/mjpg/video.cgi?channel=1&subtype=0',
        '/cgi-bin/mjpg/video.cgi?channel=0&subtype=0',
        '/videostream.cgi',
        '/ipcam/mjpeg.cgi',
        '/ipcam/stream.cgi',
        '/goform/video',
        '/api/video/stream',
        '/tcp/av0_0',
        '/tcp/av0_1',
        '/udp/av0_0',
        '/udp/av0_1',
        '/h264',
        '/h264.sdp',
        '/play1.m3u8',
        '/live/0',
        '/live/1',
        '/live/2',
        '/live/ch00_0',
        '/live/ch00_1',
        '/Streaming/channels/1/httppreview',
        '/Streaming/channels/2/httppreview',
        '/ISAPI/Streaming/channels/101/httpPreview',
        '/ISAPI/Streaming/channels/102/httpPreview',
        '/cam/realmonitor?channel=1&subtype=0',
        '/cam/realmonitor?channel=1&subtype=1',
        '/axis-cgi/mjpg/video.cgi',
        '/mjpg/video.mjpg?camera=1',
        '/video1.mjpg',
        '/video2.mjpg',
        '/h264/ch1/main/av_stream',
        '/h264/ch1/sub/av_stream',
        '/Streaming/Channels/101',
        '/Streaming/Channels/102',
    ];
    
    // Сначала снапшоты (самый надёжный способ)
    for (const port of ports) {
        for (const path of snapshotPaths) {
            urls.push('http://' + ip + ':' + port + path);
        }
    }
    
    // Потом видео-пути
    for (const port of ports) {
        for (const path of videoPaths) {
            urls.push('http://' + ip + ':' + port + path);
        }
    }
    
    // Специальные URL для Xiaomi с авторизацией
    if (vendor === 'xiaomi') {
        const xiaomiURLs = [
            'http://' + ip + ':8080/cgi-bin/snapshot.cgi?user=admin&pwd=admin',
            'http://' + ip + ':8080/cgi-bin/snapshot.cgi?user=admin&pwd=',
            'http://' + ip + ':8080/cgi-bin/snapshot.cgi?user=&pwd=',
            'http://' + ip + ':8080/snapshot.jpg?user=admin&pwd=admin',
            'http://' + ip + ':80/cgi-bin/snapshot.cgi?user=admin&pwd=admin',
            'http://' + ip + ':554/stream?user=admin&pwd=admin',
            'http://' + ip + ':8080/video?user=admin&pwd=admin',
        ];
        urls.unshift(...xiaomiURLs);
    }
    
    return urls;
}

// ========== ГЛАВНАЯ ФУНКЦИЯ ПОДКЛЮЧЕНИЯ ==========
async function connectCamera(id) {
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
    setStatus(id, '🔍 Сканирую...', '#ffa502');
    setDot(id, 'connecting');
    
    const view = document.getElementById('view' + id);
    const urls = getAllURLs(ip, cameras[id].vendor);
    
    // Показываем прогресс
    view.innerHTML = '<div style="text-align:center;color:#ffa502;padding-top:100px;">' +
        '<span style="font-size:48px;">🔍</span>' +
        '<p>Проверяю ' + urls.length + ' вариантов...</p>' +
        '<p style="font-size:0.7em;color:#888;">IP: ' + ip + '</p>' +
        '</div>';
    
    // Запускаем поиск в нескольких потоках (быстрее)
    const found = await scanURLsParallel(id, view, urls, ip);
    
    if (found) {
        setStatus(id, '✅ Работает', '#2ed573');
        setDot(id, 'online');
    } else {
        setStatus(id, '❌ Не найдена', '#ff4757');
        setDot(id, 'offline');
        view.innerHTML = '<div style="text-align:center;color:#ff4757;padding-top:100px;">' +
            '<span style="font-size:48px;">❌</span>' +
            '<p>Камера не отвечает</p>' +
            '<p style="font-size:0.7em;">IP: ' + ip + '</p>' +
            '<button onclick="connectCamera(' + id + ')" style="margin-top:20px;width:auto;">🔄 Попробовать снова</button>' +
            '</div>';
    }
}

// ========== ПАРАЛЛЕЛЬНОЕ СКАНИРОВАНИЕ ==========
async function scanURLsParallel(id, view, urls, ip) {
    const batchSize = 5; // По 5 URL одновременно
    
    for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        
        // Обновляем прогресс
        const progress = Math.round((i / urls.length) * 100);
        view.innerHTML = '<div style="text-align:center;color:#ffa502;padding-top:100px;">' +
            '<span style="font-size:48px;">🔍</span>' +
            '<p>Проверено: ' + i + '/' + urls.length + ' (' + progress + '%)</p>' +
            '<div style="background:#333;height:4px;width:80%;margin:10px auto;border-radius:2px;">' +
            '<div style="background:#ffa502;height:4px;width:' + progress + '%;border-radius:2px;"></div>' +
            '</div>' +
            '</div>';
        
        // Запускаем батч параллельно
        const promises = batch.map(url => testURL(url));
        const results = await Promise.all(promises);
        
        // Проверяем результаты
        for (let j = 0; j < results.length; j++) {
            if (results[j]) {
                // Нашли рабочий URL!
                showStream(id, view, batch[j]);
                return true;
            }
        }
        
        // Небольшая пауза между батчами
        await sleep(100);
    }
    
    return false;
}

// ========== ТЕСТ ОДНОГО URL ==========
function testURL(url) {
    return new Promise(function(resolve) {
        const img = new Image();
        let done = false;
        
        const timeout = setTimeout(function() {
            if (!done) { done = true; resolve(false); }
        }, 1500);
        
        img.onload = function() {
            if (!done && img.naturalWidth > 50 && img.naturalWidth < 10000) {
                done = true;
                clearTimeout(timeout);
                resolve(true);
            }
        };
        
        img.onerror = function() {
            if (!done) { done = true; clearTimeout(timeout); resolve(false); }
        };
        
        img.src = url + '?t=' + Date.now();
    });
}

// ========== ПОКАЗАТЬ ПОТОК ==========
function showStream(id, view, url) {
    view.innerHTML = '';
    
    const img = document.createElement('img');
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
    img.id = 'stream-img-' + id;
    img.src = url + '?t=' + Date.now();
    view.appendChild(img);
    
    // Кнопка фулскрина
    const btn = document.createElement('button');
    btn.textContent = '⛶';
    btn.style.cssText = 'position:absolute;top:10px;right:10px;z-index:10;background:rgba(0,0,0,0.6);border:none;color:white;padding:8px 12px;cursor:pointer;border-radius:4px;width:auto;font-size:16px;';
    btn.onclick = function() { view.requestFullscreen?.(); };
    view.appendChild(btn);
    
    // Кнопка переподключения
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = '🔄';
    refreshBtn.style.cssText = 'position:absolute;top:10px;right:60px;z-index:10;background:rgba(0,0,0,0.6);border:none;color:white;padding:8px 12px;cursor:pointer;border-radius:4px;width:auto;font-size:16px;';
    refreshBtn.onclick = function() { connectCamera(id); };
    view.appendChild(refreshBtn);
    
    // Временная метка
    const ts = document.createElement('div');
    ts.style.cssText = 'position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,0.7);padding:5px 10px;border-radius:3px;font-size:0.8em;z-index:10;color:white;';
    ts.id = 'ts' + id;
    view.appendChild(ts);
    
    // Сохраняем стрим
    activeStreams[id] = { url: url };
    
    // Автообновление кадра
    timers[id] = setInterval(function() {
        const el = document.getElementById('stream-img-' + id);
        if (el) {
            el.src = url + '?t=' + Date.now();
        } else {
            clearInterval(timers[id]);
        }
    }, 500); // Обновление каждые 500мс (2 кадра в секунду)
}

// ========== ОСТАНОВКА ==========
function stopStream(id) {
    if (timers[id]) { clearInterval(timers[id]); timers[id] = null; }
    activeStreams[id] = null;
    
    const view = document.getElementById('view' + id);
    if (view) {
        view.innerHTML = '<div style="text-align:center;color:#444;padding-top:100px;">' +
            '<span style="font-size:48px;display:block;">🎥</span>Ожидание...</div>';
        
        const ts = document.createElement('div');
        ts.style.cssText = 'position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,0.7);padding:5px 10px;border-radius:3px;font-size:0.8em;z-index:10;color:white;';
        ts.id = 'ts' + id;
        view.appendChild(ts);
    }
}

// ========== ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ==========

// Сканирование всей сети на камеры
async function scanNetwork() {
    const subnet = '10.1.30';
    const results = [];
    
    for (let i = 1; i <= 254; i++) {
        const ip = subnet + '.' + i;
        // Проверяем только порт 8080 (быстро)
        const url = 'http://' + ip + ':8080';
        try {
            const controller = new AbortController();
            const timeout = setTimeout(function() { controller.abort(); }, 500);
            await fetch(url, { mode: 'no-cors', signal: controller.signal });
            clearTimeout(timeout);
            results.push(ip);
        } catch(e) {}
    }
    
    return results;
}

// Проверка доступности камеры
function pingCamera(ip) {
    return new Promise(function(resolve) {
        const img = new Image();
        const timeout = setTimeout(function() { resolve(false); }, 2000);
        
        img.onload = function() { clearTimeout(timeout); resolve(true); };
        img.onerror = function() { clearTimeout(timeout); resolve(false); };
        
        img.src = 'http://' + ip + ':8080/snapshot.jpg?t=' + Date.now();
    });
}

// Переподключение всех камер
function reconnectAll() {
    for (let i = 1; i <= 4; i++) {
        if (cameras[i].ip) {
            stopStream(i);
            setTimeout(function() { connectCamera(i); }, i * 1000);
        }
    }
}

// ========== КНОПКИ ==========
function connectHTTP(id, ip) { if (ip) cameras[id].ip = ip; connectCamera(id); }
function connectRTSP(id, ip) { if (ip) cameras[id].ip = ip; connectCamera(id); }
function connectWebRTC(id) { connectCamera(id); }
function connectCustomIP(id) {
    const inp = document.getElementById('ip' + id);
    if (!inp || !inp.value.trim()) { alert('Введите IP-адрес камеры'); return; }
    cameras[id].ip = inp.value.trim();
    connectCamera(id);
}

// Снимок
function snapshot(id) {
    const img = document.getElementById('stream-img-' + id);
    if (img && img.src) {
        const a = document.createElement('a');
        a.href = img.src;
        a.download = 'camera-' + id + '-' + Date.now() + '.jpg';
        a.click();
    } else {
        alert('Нет активного видеопотока');
    }
}

// ========== ХЕЛПЕРЫ ==========
function setDot(id, status) {
    const dot = document.getElementById('dot' + id);
    if (dot) dot.className = 'status-dot status-' + status;
}

function setStatus(id, text, color) {
    const card = document.getElementById('card' + id);
    if (card) {
        const nameEl = card.querySelector('.name');
        if (nameEl) nameEl.textContent = '📷 Камера ' + id + ' — ' + text;
    }
}

function sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

// ========== ВРЕМЯ ==========
setInterval(function() {
    for (let i = 1; i <= 4; i++) {
        const ts = document.getElementById('ts' + i);
        if (ts) ts.textContent = new Date().toLocaleString('ru-RU');
    }
}, 1000);

// ========== ВЫХОД ==========
function logout() {
    for (const k in timers) clearInterval(timers[k]);
    localStorage.removeItem('sec_token');
    localStorage.removeItem('sec_role');
    window.location.href = 'index.html';
}

// ========== АВТОЗАПУСК ==========
window.addEventListener('load', function() {
    console.log('🚀 VR House v4.0 — Мега-поиск камер');
    console.log('📷 Камера 1:', cameras[1].ip);
    console.log('📷 Камера 2:', cameras[2].ip);
    
    setTimeout(function() { connectCamera(1); }, 800);
    setTimeout(function() { connectCamera(2); }, 2000);
});
