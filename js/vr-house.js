if (!localStorage.getItem('sec_token') || localStorage.getItem('sec_role') !== 'administrator') {
    window.location.href = 'index.html';
}

// ========== КАМЕРЫ КУПАЛОВ Д.К. ==========
const cameras = {
    1: {
        name: 'chuangmi-camera-021a04',
        deviceID: 'chuangmi-camera-021a04',
        ip: '10.1.30.60',
        mac: '60:7e:a4:15:ad:eb',
        connection: 'Wi-Fi 5 ГГц (VPN-VR)',
        network: 'Home network',
        added: '2026-04-06 11:44',
        uptime: '1 дн. 12:46:23',
        wifiSession: '1 дн. 12:46:23',
        sent: '47,3 МБ',
        received: '25,5 МБ',
        location: 'Главный вход',
        // RTSP и HTTP потоки Xiaomi Chuangmi
        rtsp: 'rtsp://10.1.30.60:554/live',
        http: 'http://10.1.30.60:8080',
        mjpeg: 'http://10.1.30.60:8080/video',
        snapshot_url: 'http://10.1.30.60:8080/snapshot.jpg'
    },
    2: {
        name: 'chuangmi-camera-021a04',
        deviceID: 'chuangmi.camera.021a04',
        ip: '10.1.30.37',
        mac: '60:7e:a4:15:c2:5c',
        connection: 'Wi-Fi 5 ГГц (VPN-VR)',
        network: 'Home network',
        added: '2024-11-22 21:58',
        uptime: '9 дн. 20:31:22',
        wifiSession: '1 дн. 12:46:58',
        sent: '46,9 МБ',
        received: '25,5 МБ',
        location: 'Серверная',
        // RTSP и HTTP потоки Xiaomi Chuangmi
        rtsp: 'rtsp://10.1.30.37:554/live',
        http: 'http://10.1.30.37:8080',
        mjpeg: 'http://10.1.30.37:8080/video',
        snapshot_url: 'http://10.1.30.37:8080/snapshot.jpg'
    },
    3: {
        name: 'Камера 3',
        deviceID: '',
        ip: '',
        mac: '',
        connection: 'Wi-Fi',
        network: 'Home network',
        added: '',
        uptime: '',
        wifiSession: '',
        sent: '',
        received: '',
        location: 'Периметр',
        rtsp: '',
        http: '',
        mjpeg: '',
        snapshot_url: ''
    },
    4: {
        name: 'Камера 4',
        deviceID: '',
        ip: '',
        mac: '',
        connection: 'Wi-Fi',
        network: 'Home network',
        added: '',
        uptime: '',
        wifiSession: '',
        sent: '',
        received: '',
        location: 'Склад',
        rtsp: '',
        http: '',
        mjpeg: '',
        snapshot_url: ''
    }
};

const activeStreams = {};
const streamElements = {};

// ========== ИНИЦИАЛИЗАЦИЯ ==========
function initCameras() {
    for (let i = 1; i <= 4; i++) {
        const cam = cameras[i];
        if (cam.ip) {
            // Заполняем IP в поле ввода если есть
            const ipInput = document.getElementById('ip' + i);
            if (ipInput) ipInput.value = cam.ip;
            
            // Обновляем инфо на карточке
            updateCameraInfo(i);
        }
    }
}

function updateCameraInfo(cameraId) {
    const cam = cameras[cameraId];
    
    // Обновляем заголовок
    const card = document.getElementById('card' + cameraId);
    if (!card) return;
    
    // Обновляем инфо-блок
    const infoDiv = card.querySelector('.vr-info');
    if (infoDiv && cam.ip) {
        infoDiv.innerHTML = `
            <span>🔗 MAC: ${cam.mac}</span>
            <span>📡 ${cam.connection}</span>
            <span>🌐 ${cam.ip}</span>
            <span>🆔 ${cam.deviceID}</span>
            <span style="width:100%; margin-top:4px;">📶 Сессия: ${cam.wifiSession}</span>
            <span>📤 Отпр: ${cam.sent}</span>
            <span>📥 Получ: ${cam.received}</span>
        `;
    }
}

// ========== ПОДКЛЮЧЕНИЕ ==========
function connectRTSP(cameraId, customIP) {
    const cam = cameras[cameraId];
    const ip = customIP || cam.ip;
    
    if (!ip) {
        alert('Введите IP-адрес камеры');
        return;
    }
    
    setStatus(cameraId, 'connecting');
    addLog(cam.name, 'RTSP подключение к ' + ip);
    
    disconnectStream(cameraId);
    
    // Для Xiaomi Chuangmi — пробуем HLS через порт 8080
    const hlsURL = 'http://' + ip + ':8080/play1.m3u8';
    const mjpegURL = 'http://' + ip + ':8080/video';
    const snapshotURL = 'http://' + ip + ':8080/snapshot.jpg';
    
    // Сначала пробуем MJPEG (надёжнее для Xiaomi)
    tryMJPEG(cameraId, mjpegURL, () => {
        // Если MJPEG не сработал — пробуем снапшот с автообновлением
        trySnapshot(cameraId, snapshotURL);
    });
}

function connectHTTP(cameraId, customIP) {
    const cam = cameras[cameraId];
    const ip = customIP || cam.ip;
    
    if (!ip) {
        alert('Введите IP-адрес камеры');
        return;
    }
    
    setStatus(cameraId, 'connecting');
    addLog(cam.name, 'HTTP подключение к ' + ip);
    
    disconnectStream(cameraId);
    
    // Порт 8080 для Xiaomi Chuangmi
    const urls = [
        'http://' + ip + ':8080/video',
        'http://' + ip + ':8080/',
        'http://' + ip + ':8080/stream',
        'http://' + ip + ':8080/mjpeg',
        'http://' + ip + ':80/',
        'http://' + ip + ':80/video',
        'http://' + ip + ':554/',
        'http://' + ip + ':8000/',
    ];
    
    tryHTTPUrls(cameraId, urls, 0);
}

function tryMJPEG(cameraId, url, fallback) {
    const img = new Image();
    let resolved = false;
    
    const timeout = setTimeout(() => {
        if (!resolved) {
            resolved = true;
            img.src = '';
            if (fallback) fallback();
        }
    }, 3000);
    
    img.onload = function() {
        if (!resolved && img.naturalWidth > 16) {
            resolved = true;
            clearTimeout(timeout);
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            showStream(cameraId, img, 'mjpeg');
            setStatus(cameraId, 'online');
            addLog(cameras[cameraId].name, 'MJPEG подключено: ' + url);
        }
    };
    
    img.onerror = function() {
        if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            if (fallback) fallback();
        }
    };
    
    img.src = url;
}

function trySnapshot(cameraId, url) {
    // Автообновляемый снапшот (каждые 2 секунды)
    const img = new Image();
    let interval;
    
    img.onload = function() {
        if (img.naturalWidth > 16) {
            showStream(cameraId, img, 'snapshot');
            setStatus(cameraId, 'online');
            addLog(cameras[cameraId].name, 'Snapshot: ' + url);
            
            // Автообновление
            interval = setInterval(() => {
                img.src = url + '?t=' + Date.now();
            }, 2000);
            
            streamElements[cameraId].interval = interval;
        }
    };
    
    img.onerror = function() {
        setStatus(cameraId, 'offline');
        addLog(cameras[cameraId].name, 'Не удалось подключиться');
    };
    
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.src = url;
}

function tryHTTPUrls(cameraId, urls, index) {
    if (index >= urls.length) {
        setStatus(cameraId, 'offline');
        addLog('Камера ' + cameraId, 'HTTP не найдено');
        return;
    }
    
    const url = urls[index];
    addLog(cameras[cameraId].name, 'Пробую: ' + url);
    
    tryMJPEG(cameraId, url, () => {
        tryHTTPUrls(cameraId, urls, index + 1);
    });
}

async function connectWebRTC(cameraId) {
    try {
        disconnectStream(cameraId);
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        showStream(cameraId, video, 'webrtc');
        setStatus(cameraId, 'online');
        addLog('Камера ' + cameraId, 'WebRTC (веб-камера)');
    } catch (e) {
        alert('Нет доступа к веб-камере');
    }
}

function connectCustomIP(cameraId) {
    const ipInput = document.getElementById('ip' + cameraId);
    if (!ipInput || !ipInput.value.trim()) {
        alert('Введите IP-адрес');
        return;
    }
    cameras[cameraId].ip = ipInput.value.trim();
    updateCameraInfo(cameraId);
    connectHTTP(cameraId);
}

// ========== ПОКАЗ ПОТОКА ==========
function showStream(cameraId, element, type) {
    const container = document.getElementById('view' + cameraId);
    const placeholder = document.getElementById('placeholder' + cameraId);
    
    container.innerHTML = '';
    if (placeholder) placeholder.style.display = 'none';
    
    container.appendChild(element);
    
    // Временная метка
    const ts = document.createElement('div');
    ts.className = 'timestamp-overlay';
    ts.id = 'ts' + cameraId;
    container.appendChild(ts);
    
    // Кнопка фуллскрина
    const fsBtn = document.createElement('button');
    fsBtn.className = 'fullscreen-btn';
    fsBtn.textContent = '⛶';
    fsBtn.onclick = () => {
        if (container.requestFullscreen) {
            container.requestFullscreen();
        }
    };
    container.appendChild(fsBtn);
    
    activeStreams[cameraId] = true;
    streamElements[cameraId] = { element, type };
    updateActiveCount();
}

// ========== ОТКЛЮЧЕНИЕ ==========
function disconnectStream(cameraId) {
    if (streamElements[cameraId]) {
        if (streamElements[cameraId].interval) {
            clearInterval(streamElements[cameraId].interval);
        }
        if (streamElements[cameraId].element?.srcObject) {
            streamElements[cameraId].element.srcObject.getTracks().forEach(t => t.stop());
        }
        streamElements[cameraId] = null;
    }
    activeStreams[cameraId] = false;
    
    const container = document.getElementById('view' + cameraId);
    const placeholder = document.getElementById('placeholder' + cameraId);
    
    container.innerHTML = '';
    if (placeholder) {
        placeholder.style.display = 'block';
        container.appendChild(placeholder);
    }
    
    const ts = document.createElement('div');
    ts.className = 'timestamp-overlay';
    ts.id = 'ts' + cameraId;
    container.appendChild(ts);
    
    updateActiveCount();
}

// ========== СНИМОК ==========
function snapshot(cameraId) {
    const container = document.getElementById('view' + cameraId);
    const video = container.querySelector('video');
    const img = container.querySelector('img');
    
    if (img && img.src && activeStreams[cameraId]) {
        const a = document.createElement('a');
        a.href = img.src;
        a.download = 'vr-house-cam' + cameraId + '-' + Date.now() + '.jpg';
        a.click();
        addLog(cameras[cameraId].name, 'Снимок сохранён');
    } else if (video && video.videoWidth) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/jpeg');
        a.download = 'vr-house-cam' + cameraId + '-' + Date.now() + '.jpg';
        a.click();
        addLog(cameras[cameraId].name, 'Снимок сохранён');
    } else {
        alert('Нет активного потока');
    }
}

// ========== ХЕЛПЕРЫ ==========
function setStatus(cameraId, status) {
    const dot = document.getElementById('dot' + cameraId);
    if (dot) {
        dot.className = 'status-dot status-' + status;
    }
    updateActiveCount();
}

function updateActiveCount() {
    const count = Object.values(activeStreams).filter(Boolean).length;
    document.getElementById('active-count').textContent = count;
}

// Время
setInterval(() => {
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById('ts' + i);
        if (el) el.textContent = new Date().toLocaleString('ru-RU');
    }
}, 1000);

// Журнал
let logs = JSON.parse(localStorage.getItem('vr_house_logs') || '[]');

function addLog(camera, event) {
    logs.unshift({
        time: new Date().toLocaleString('ru-RU'),
        camera: camera,
        event: event
    });
    if (logs.length > 50) logs.pop();
    localStorage.setItem('vr_house_logs', JSON.stringify(logs));
    renderLogs();
}

function renderLogs() {
    const tbody = document.getElementById('vr-log');
    if (tbody) {
        tbody.innerHTML = logs.slice(0, 10).map(l =>
            `<tr><td>${l.time}</td><td>${l.camera}</td><td>${l.event}</td></tr>`
        ).join('');
    }
}

function logout() {
    for (const key in streamElements) {
        if (streamElements[key]?.interval) clearInterval(streamElements[key].interval);
        if (streamElements[key]?.element?.srcObject) {
            streamElements[key].element.srcObject.getTracks().forEach(t => t.stop());
        }
    }
    localStorage.removeItem('sec_token');
    localStorage.removeItem('sec_role');
    window.location.href = 'index.html';
}

// ========== СТАРТ ==========
window.addEventListener('load', () => {
    initCameras();
    renderLogs();
    updateActiveCount();
    addLog('VR House', 'Система загружена');
    
    // Автоподключение камер с IP
    setTimeout(() => {
        for (let i = 1; i <= 2; i++) {
            if (cameras[i].ip) {
                addLog(cameras[i].name, 'Автоподключение...');
                connectHTTP(i);
            }
        }
    }, 1000);
});
