if (!localStorage.getItem('sec_token') || localStorage.getItem('sec_role') !== 'administrator') {
    window.location.href = 'index.html';
}

// Конфигурация камер Купалов Д.К.
const cameras = {
    1: {
        name: 'Xiaomi Chuangmi',
        ip: '10.1.30.60',
        mac: '60:7E:A4:15:AD:EB',
        rtsp: 'rtsp://10.1.30.60:554/live',
        http: 'http://10.1.30.60:8080',
        mjpeg: 'http://10.1.30.60:8080/video',
        location: 'Главный вход'
    },
    2: {
        name: 'Kenetek Ultra',
        ip: '10.1.30.61',
        mac: 'B8:27:EB:XX:XX:XX',
        rtsp: 'rtsp://10.1.30.61:554/stream',
        http: 'http://10.1.30.61:34567',
        mjpeg: 'http://10.1.30.61:34567/tcp/av0_0',
        location: 'Серверная'
    },
    3: {
        name: 'Wi-Fi Camera 3',
        ip: '',
        mac: '',
        rtsp: '',
        http: '',
        mjpeg: '',
        location: 'Периметр'
    },
    4: {
        name: 'Wi-Fi Camera 4',
        ip: '',
        mac: '',
        rtsp: '',
        http: '',
        mjpeg: '',
        location: 'Склад'
    }
};

const activeStreams = {};
const streamElements = {};

// ========== RTSP СТРИМ ==========
function connectRTSP(cameraId, customIP) {
    const cam = cameras[cameraId];
    const ip = customIP || cam.ip;
    
    if (!ip) {
        alert('Введите IP-адрес камеры');
        return;
    }
    
    const rtspURL = 'rtsp://' + ip + ':554/live';
    
    setStatus(cameraId, 'connecting');
    addLog(cam.name || 'Камера ' + cameraId, 'RTSP: ' + rtspURL);
    
    // RTSP через HLS прокси (работает в браузере)
    const hlsURL = 'http://' + ip + ':8080/play1.m3u8';
    
    disconnectStream(cameraId);
    
    // Пробуем HLS
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        const video = document.createElement('video');
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        
        const hls = new Hls();
        hls.loadSource(hlsURL);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play();
            showStream(cameraId, video, 'rtsp-hls');
            setStatus(cameraId, 'online');
            addLog(cam.name || 'Камера ' + cameraId, 'RTSP/HLS подключено');
        });
        hls.on(Hls.Events.ERROR, () => {
            setStatus(cameraId, 'offline');
            addLog(cam.name || 'Камера ' + cameraId, 'Ошибка RTSP');
        });
    } else {
        // Фолбэк: прямая ссылка
        const video = document.createElement('video');
        video.src = rtspURL;
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        
        video.onloadedmetadata = () => {
            showStream(cameraId, video, 'rtsp');
            setStatus(cameraId, 'online');
        };
        video.onerror = () => {
            setStatus(cameraId, 'offline');
            alert('RTSP не поддерживается браузером. Используйте HTTP или VLC.');
        };
        
        showStream(cameraId, video, 'rtsp');
    }
}

// ========== HTTP/MJPEG СТРИМ ==========
function connectHTTP(cameraId, customIP) {
    const cam = cameras[cameraId];
    const ip = customIP || cam.ip;
    
    if (!ip) {
        alert('Введите IP-адрес камеры');
        return;
    }
    
    const urls = [
        'http://' + ip + ':8080/',
        'http://' + ip + ':8080/video',
        'http://' + ip + ':80/',
        'http://' + ip + ':80/video',
        'http://' + ip + ':8000/',
        'http://' + ip + ':34567/',
        'http://' + ip + ':34567/tcp/av0_0',
        'http://' + ip + ':8081/',
        'http://' + ip + ':8554/',
    ];
    
    setStatus(cameraId, 'connecting');
    addLog(cam.name || 'Камера ' + cameraId, 'HTTP поиск...');
    
    disconnectStream(cameraId);
    tryHTTPUrls(cameraId, urls, 0);
}

function tryHTTPUrls(cameraId, urls, index) {
    if (index >= urls.length) {
        setStatus(cameraId, 'offline');
        addLog('Камера ' + cameraId, 'HTTP не найдено');
        return;
    }
    
    const url = urls[index];
    const img = new Image();
    
    const timeout = setTimeout(() => {
        img.src = '';
        tryHTTPUrls(cameraId, urls, index + 1);
    }, 2000);
    
    img.onload = function() {
        if (img.naturalWidth > 16) {
            clearTimeout(timeout);
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            showStream(cameraId, img, 'mjpeg');
            setStatus(cameraId, 'online');
            addLog('Камера ' + cameraId, 'HTTP: ' + url);
        }
    };
    
    img.onerror = function() {
        clearTimeout(timeout);
        tryHTTPUrls(cameraId, urls, index + 1);
    };
    
    img.src = url;
}

// ========== WEBRTC (веб-камера) ==========
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

// ========== ПОДКЛЮЧЕНИЕ ПО ПОЛЬЗОВАТЕЛЬСКОМУ IP ==========
function connectCustomIP(cameraId) {
    const ipInput = document.getElementById('ip' + cameraId);
    if (!ipInput || !ipInput.value.trim()) {
        alert('Введите IP-адрес');
        return;
    }
    cameras[cameraId].ip = ipInput.value.trim();
    connectHTTP(cameraId);
}

// ========== ПОКАЗАТЬ ПОТОК ==========
function showStream(cameraId, element, type) {
    const container = document.getElementById('view' + cameraId);
    const placeholder = document.getElementById('placeholder' + cameraId);
    
    container.innerHTML = '';
    if (placeholder) placeholder.style.display = 'none';
    
    container.appendChild(element);
    
    // Добавляем временную метку
    const ts = document.createElement('div');
    ts.className = 'timestamp-overlay';
    ts.id = 'ts' + cameraId;
    container.appendChild(ts);
    
    // Кнопка фуллскрина
    const fsBtn = document.createElement('button');
    fsBtn.className = 'fullscreen-btn';
    fsBtn.textContent = '⛶';
    fsBtn.onclick = () => {
        if (element.requestFullscreen) {
            element.requestFullscreen();
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
        if (streamElements[cameraId].element.srcObject) {
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
    
    if (img && img.src) {
        const a = document.createElement('a');
        a.href = img.src;
        a.download = 'vr-house-cam' + cameraId + '-' + Date.now() + '.jpg';
        a.click();
        addLog('Камера ' + cameraId, 'Снимок сохранён');
    } else if (video && video.videoWidth) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/jpeg');
        a.download = 'vr-house-cam' + cameraId + '-' + Date.now() + '.jpg';
        a.click();
        addLog('Камера ' + cameraId, 'Снимок сохранён');
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
        if (streamElements[key]?.element?.srcObject) {
            streamElements[key].element.srcObject.getTracks().forEach(t => t.stop());
        }
    }
    localStorage.removeItem('sec_token');
    localStorage.removeItem('sec_role');
    window.location.href = 'index.html';
}

renderLogs();
updateActiveCount();
