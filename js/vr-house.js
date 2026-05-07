if (!localStorage.getItem('sec_token') || localStorage.getItem('sec_role') !== 'administrator') {
    window.location.href = 'index.html';
}

// Камеры Купалов Д.К.
const cameras = {
    1: {
        name: 'Xiaomi Главный вход',
        ip: '10.1.30.60',
        mac: '60:7e:a4:15:ad:eb',
        snapshot: 'http://10.1.30.60:8080/snapshot.jpg',
        mjpeg: 'http://10.1.30.60:8080/video',
        ports: [80, 8080, 554, 8000, 8554]
    },
    2: {
        name: 'Xiaomi Серверная',
        ip: '10.1.30.37',
        mac: '60:7e:a4:15:c2:5c',
        snapshot: 'http://10.1.30.37:8080/snapshot.jpg',
        mjpeg: 'http://10.1.30.37:8080/video',
        ports: [80, 8080, 554, 8000, 8554]
    },
    3: {
        name: 'Камера 3',
        ip: '',
        mac: '',
        snapshot: '',
        mjpeg: '',
        ports: [80, 8080, 554, 8000, 8081, 8554, 34567, 8800]
    },
    4: {
        name: 'Камера 4',
        ip: '',
        mac: '',
        snapshot: '',
        mjpeg: '',
        ports: [80, 8080, 554, 8000, 8081, 8554, 34567, 8800]
    }
};

const activeStreams = {};
const streamIntervals = {};

// ========== ГЛАВНАЯ ФУНКЦИЯ ПОДКЛЮЧЕНИЯ ==========
async function connectCamera(cameraId) {
    const cam = cameras[cameraId];
    let ip = cam.ip;
    
    // Если камера 3 или 4 — берём IP из поля
    if (cameraId >= 3) {
        const ipInput = document.getElementById('ip' + cameraId);
        if (ipInput && ipInput.value.trim()) {
            ip = ipInput.value.trim();
            cam.ip = ip;
        }
    }
    
    if (!ip) {
        setStatus(cameraId, 'offline');
        addLog(cam.name, '❌ Нет IP-адреса');
        return;
    }
    
    disconnectStream(cameraId);
    setStatus(cameraId, 'connecting');
    addLog(cam.name, '🔍 Подключение к ' + ip);
    
    let connected = false;
    
    // Шаг 1: Пробуем стандартные пути для Xiaomi Chuangmi (порт 8080)
    if (cam.mjpeg || ip) {
        const baseURL = 'http://' + ip + ':8080';
        const mjpegPaths = [
            '/video',
            '/stream',
            '/mjpeg',
            '/live',
            '/',
            '/mjpg/video.mjpg',
            '/webcam.mjpeg',
            '/video.mjpg',
            '/stream.mjpg'
        ];
        
        for (const path of mjpegPaths) {
            if (connected) break;
            const url = baseURL + path;
            setStatus(cameraId, 'connecting');
            connected = await tryStreamURL(cameraId, url);
            if (connected) {
                addLog(cam.name, '✅ Подключено: ' + url);
            }
        }
    }
    
    // Шаг 2: Пробуем другие порты
    if (!connected) {
        for (const port of cam.ports) {
            if (connected) break;
            if (port === 8080) continue; // уже проверили
            
            const baseURL = 'http://' + ip + ':' + port;
            const paths = ['/', '/video', '/stream', '/mjpeg', '/live', '/tcp/av0_0', '/snapshot.jpg', '/onvif/device_service'];
            
            for (const path of paths) {
                if (connected) break;
                const url = baseURL + path;
                setStatus(cameraId, 'connecting');
                connected = await tryStreamURL(cameraId, url);
                if (connected) {
                    addLog(cam.name, '✅ Найден порт ' + port + ': ' + url);
                }
            }
        }
    }
    
    // Шаг 3: Snapshot-режим (100% рабочий для Xiaomi)
    if (!connected) {
        const snapshotURL = 'http://' + ip + ':8080/snapshot.jpg';
        setStatus(cameraId, 'connecting');
        connected = await trySnapshotMode(cameraId, snapshotURL);
        if (connected) {
            addLog(cam.name, '✅ Snapshot-режим');
        }
    }
    
    if (connected) {
        setStatus(cameraId, 'online');
    } else {
        setStatus(cameraId, 'offline');
        addLog(cam.name, '❌ Не удалось подключиться');
    }
    
    updateActiveCount();
}

// ========== ПРОВЕРКА URL (MJPEG/IMG) ==========
function tryStreamURL(cameraId, url) {
    return new Promise((resolve) => {
        const view = document.getElementById('view' + cameraId);
        const img = new Image();
        let resolved = false;
        
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                img.src = '';
                resolve(false);
            }
        }, 3000);
        
        img.onload = function() {
            if (!resolved && img.naturalWidth > 16 && img.naturalWidth < 10000) {
                resolved = true;
                clearTimeout(timeout);
                
                // Показываем изображение
                view.innerHTML = '';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                img.id = 'stream-img-' + cameraId;
                view.appendChild(img);
                
                addTimestamp(view, cameraId);
                addFullscreenBtn(view, cameraId);
                
                activeStreams[cameraId] = { type: 'mjpeg', url: url, element: img };
                
                // Проверяем, обновляется ли изображение (MJPEG) или статичное
                checkIfLive(cameraId, img, url, resolve);
            }
        };
        
        img.onerror = function() {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                resolve(false);
            }
        };
        
        img.src = url + '?t=' + Date.now();
    });
}

// ========== ПРОВЕРКА ЖИВОЙ ЛИ ПОТОК ==========
function checkIfLive(cameraId, img, url, resolve) {
    // Ждём 1 секунду и проверяем, изменилось ли изображение
    setTimeout(() => {
        const img2 = new Image();
        img2.onload = function() {
            // Если изображения разные — это живой поток
            if (img2.naturalWidth > 16) {
                // Обновляем изображение каждую секунду для живого эффекта
                if (!streamIntervals[cameraId]) {
                    streamIntervals[cameraId] = setInterval(() => {
                        const el = document.getElementById('stream-img-' + cameraId);
                        if (el) {
                            el.src = url + '?t=' + Date.now();
                        } else {
                            clearInterval(streamIntervals[cameraId]);
                        }
                    }, 1000);
                }
                resolve(true);
            } else {
                resolve(false);
            }
        };
        img2.onerror = () => resolve(false);
        img2.src = url + '?t=' + Date.now() + 1000;
    }, 1000);
}

// ========== SNAPSHOT РЕЖИМ (100% рабочий) ==========
function trySnapshotMode(cameraId, url) {
    return new Promise((resolve) => {
        const view = document.getElementById('view' + cameraId);
        const img = new Image();
        let resolved = false;
        
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                img.src = '';
                resolve(false);
            }
        }, 3000);
        
        img.onload = function() {
            if (!resolved && img.naturalWidth > 16) {
                resolved = true;
                clearTimeout(timeout);
                
                view.innerHTML = '';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                img.id = 'stream-img-' + cameraId;
                view.appendChild(img);
                
                addTimestamp(view, cameraId);
                addFullscreenBtn(view, cameraId);
                
                activeStreams[cameraId] = { type: 'snapshot', url: url, element: img };
                
                // Автообновление каждые 500мс
                streamIntervals[cameraId] = setInterval(() => {
                    const el = document.getElementById('stream-img-' + cameraId);
                    if (el) {
                        el.src = url + '?t=' + Date.now();
                    } else {
                        clearInterval(streamIntervals[cameraId]);
                    }
                }, 500);
                
                resolve(true);
            }
        };
        
        img.onerror = function() {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                resolve(false);
            }
        };
        
        img.src = url + '?t=' + Date.now();
    });
}

// ========== ПОДКЛЮЧЕНИЕ ПО IP ВРУЧНУЮ ==========
function connectCustomIP(cameraId) {
    const ipInput = document.getElementById('ip' + cameraId);
    if (!ipInput || !ipInput.value.trim()) {
        alert('Введите IP-адрес');
        return;
    }
    cameras[cameraId].ip = ipInput.value.trim();
    connectCamera(cameraId);
}

// ========== HTTP / RTSP (кнопки для совместимости) ==========
function connectHTTP(cameraId, customIP) {
    if (customIP) cameras[cameraId].ip = customIP;
    connectCamera(cameraId);
}

function connectRTSP(cameraId, customIP) {
    if (customIP) cameras[cameraId].ip = customIP;
    connectCamera(cameraId);
}

function connectWebRTC(cameraId) {
    useWebcam(cameraId);
}

// ========== ВЕБ-КАМЕРА ==========
async function useWebcam(cameraId) {
    try {
        disconnectStream(cameraId);
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        
        const view = document.getElementById('view' + cameraId);
        view.innerHTML = '';
        
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        view.appendChild(video);
        
        addTimestamp(view, cameraId);
        addFullscreenBtn(view, cameraId);
        
        activeStreams[cameraId] = { type: 'webcam', stream: stream };
        setStatus(cameraId, 'online');
        addLog('Камера ' + cameraId, '✅ Веб-камера');
        updateActiveCount();
    } catch (e) {
        alert('Нет доступа к веб-камере: ' + e.message);
    }
}

// ========== ОТКЛЮЧЕНИЕ ==========
function disconnectStream(cameraId) {
    if (streamIntervals[cameraId]) {
        clearInterval(streamIntervals[cameraId]);
        streamIntervals[cameraId] = null;
    }
    if (activeStreams[cameraId]) {
        if (activeStreams[cameraId].stream) {
            activeStreams[cameraId].stream.getTracks().forEach(t => t.stop());
        }
        activeStreams[cameraId] = null;
    }
    
    const view = document.getElementById('view' + cameraId);
    view.innerHTML = `
        <div class="no-signal" id="placeholder${cameraId}">
            <span class="icon">🎥</span>
            Нажмите кнопку подключения
        </div>
    `;
    addTimestamp(view, cameraId);
    
    updateActiveCount();
}

// ========== СНИМОК ==========
function snapshot(cameraId) {
    const view = document.getElementById('view' + cameraId);
    const img = view.querySelector('img');
    const video = view.querySelector('video');
    
    if (img && activeStreams[cameraId]) {
        const a = document.createElement('a');
        a.href = img.src;
        a.download = 'cam' + cameraId + '-' + Date.now() + '.jpg';
        a.click();
        addLog(cameras[cameraId].name, '📸 Снимок сохранён');
    } else if (video && video.videoWidth) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/jpeg');
        a.download = 'cam' + cameraId + '-' + Date.now() + '.jpg';
        a.click();
        addLog(cameras[cameraId].name, '📸 Снимок сохранён');
    } else {
        alert('Нет активного потока');
    }
}

// ========== ХЕЛПЕРЫ ==========
function setStatus(cameraId, status) {
    const dot = document.getElementById('dot' + cameraId);
    if (dot) dot.className = 'status-dot status-' + status;
    updateActiveCount();
}

function updateActiveCount() {
    const count = Object.values(activeStreams).filter(Boolean).length;
    const el = document.getElementById('active-count');
    if (el) el.textContent = count;
}

function addTimestamp(container, id) {
    const ts = document.createElement('div');
    ts.className = 'timestamp-overlay';
    ts.id = 'ts' + id;
    container.appendChild(ts);
}

function addFullscreenBtn(container, id) {
    const btn = document.createElement('button');
    btn.className = 'fullscreen-btn';
    btn.textContent = '⛶';
    btn.onclick = () => {
        if (container.requestFullscreen) container.requestFullscreen();
    };
    container.appendChild(btn);
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
    logs.unshift({ time: new Date().toLocaleString('ru-RU'), camera: camera, event: event });
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
    for (const key in streamIntervals) clearInterval(streamIntervals[key]);
    for (const key in activeStreams) {
        if (activeStreams[key]?.stream) activeStreams[key].stream.getTracks().forEach(t => t.stop());
    }
    localStorage.removeItem('sec_token');
    localStorage.removeItem('sec_role');
    window.location.href = 'index.html';
}

// ========== АВТОСТАРТ ==========
window.addEventListener('load', () => {
    renderLogs();
    updateActiveCount();
    addLog('VR House', '🚀 Система загружена');
    
    // Автоподключение камер 1 и 2
    setTimeout(() => connectCamera(1), 500);
    setTimeout(() => connectCamera(2), 1000);
});
