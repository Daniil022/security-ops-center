if (!localStorage.getItem('sec_token') || localStorage.getItem('sec_role') !== 'administrator') {
    window.location.href = 'index.html';
}

const activeStreams = {};

// ========== БАЗА ИЗВЕСТНЫХ УСТРОЙСТВ ==========
// Автоматически сопоставляет MAC → IP и настройки камеры
const knownDevices = {
    // Камера 1: Xiaomi Chuangmi
    '60:7e:a4:15:ad:eb': {
        name: 'chuangmi-camera-021a04',
        ip: '10.1.30.60',
        vendor: 'Xiaomi IMILAB',
        ports: [80, 8080, 554, 8000, 8554],
        paths: ['/', '/video', '/stream', '/mjpeg', '/live', '/onvif/device_service'],
        location: 'Главный вход',
        camId: 1
    },
    // Камера 2: Kenetek Ultra
    'b8:27:eb:xx:xx:xx': {
        name: 'Kenetek Ultra',
        ip: '10.1.30.61',
        vendor: 'Kenetek',
        ports: [34567, 8080, 8000, 8800, 554],
        paths: ['/', '/tcp/av0_0', '/video', '/stream'],
        location: 'Серверная',
        camId: 2
    }
};

// ========== АВТОЗАПОЛНЕНИЕ IP ПО MAC ==========
function findDeviceByMAC(mac) {
    const cleanMAC = mac.toUpperCase().replace(/-/g, ':').trim();
    return knownDevices[cleanMAC] || null;
}

// ========== АВТОПОИСК ВСЕХ КАМЕР В СЕТИ 10.1.30.x ==========
async function scanNetwork() {
    addLog('SYSTEM', 'Сканирование сети 10.1.30.0/24...');
    
    for (let i = 1; i <= 254; i++) {
        const ip = '10.1.30.' + i;
        
        // Проверяем, есть ли такое устройство в базе
        for (const [mac, device] of Object.entries(knownDevices)) {
            if (device.ip === ip) {
                const camId = device.camId || 1;
                document.getElementById('cam' + camId + '-ip').value = ip;
                addLog('SYSTEM', 'Найдено: ' + device.name + ' (' + ip + ') - ' + device.location);
            }
        }
    }
}

// ========== ПОДКЛЮЧЕНИЕ КАМЕРЫ ==========
async function connectCamera(cameraId) {
    const ipInput = document.getElementById('cam' + cameraId + '-ip');
    let ip = ipInput.value.trim();
    
    // Проверяем MAC в поле IP (на случай если вставили MAC)
    if (ip.includes(':')) {
        const device = findDeviceByMAC(ip);
        if (device) {
            ip = device.ip;
            ipInput.value = ip;
            addLog('CAM-0' + cameraId, 'MAC найден: ' + device.name + ' → ' + ip);
        }
    }

    if (!ip) {
        setStatus(cameraId, '❌ Введите IP или MAC', '#ff4757');
        return;
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
        setStatus(cameraId, '❌ Неверный формат', '#ff4757');
        return;
    }

    disconnectCamera(cameraId, true);
    setStatus(cameraId, '🔍 Поиск камеры...', '#ffa502');
    setLED(cameraId, 'offline');
    addLog('CAM-0' + cameraId, 'Подключение к ' + ip);

    // Проверяем, известное ли устройство
    let knownDevice = null;
    for (const [mac, device] of Object.entries(knownDevices)) {
        if (device.ip === ip) {
            knownDevice = device;
            break;
        }
    }

    // Порты для сканирования
    let portsToScan;
    let pathsToScan;

    if (knownDevice) {
        // Для известного устройства — сначала его порты
        portsToScan = [...knownDevice.ports, 80, 8080, 554, 8000, 8081, 8554, 88, 37777, 34567, 8800, 8899, 9000, 34567, 34568, 34599, 55432, 35000, 30001];
        pathsToScan = [...knownDevice.paths, '/', '/video', '/stream', '/live', '/mjpeg', '/onvif/device_service',
            '/cgi-bin/mjpg/video.cgi', '/cgi-bin/mjpg/video.cgi?channel=1&subtype=0',
            '/ISAPI/Streaming/channels/101/httpPreview', '/ISAPI/Streaming/channels/102/httpPreview',
            '/Streaming/Channels/1/httppreview', '/Streaming/Channels/2/httppreview',
            '/tcp/av0_0', '/tcp/av0_1', '/udp/av0_0', '/udp/av0_1',
            '/h264', '/h264.sdp', '/video.mjpg', '/stream.mjpg', '/webcam.mjpeg',
            '/videostream.cgi', '/snapshot.cgi', '/img/snapshot.cgi',
            '/mjpg/video.mjpg', '/ipcam/mjpeg.cgi', '/ipcam/stream.cgi',
            '/goform/video', '/api/video/stream', '/play1.m3u8', '/play2.m3u8',
            '/live/0', '/live/1', '/live/2'];
    } else {
        // Полный список для неизвестных камер
        portsToScan = [80, 88, 554, 808, 888, 1024, 1025, 2000, 3000, 4000, 5000, 6000, 7000, 7070,
            8000, 8001, 8002, 8080, 8081, 8082, 8083, 8084, 8085, 8554, 8800, 8899, 9000, 9090, 9500,
            10000, 10080, 10554, 18080, 30001, 34567, 34568, 34599, 35000, 37777, 55432];
        pathsToScan = ['/', '/video', '/stream', '/live', '/mjpeg', '/video.mjpg', '/stream.mjpg',
            '/cgi-bin/mjpg/video.cgi', '/videostream.cgi', '/webcam.mjpeg', '/snapshot.cgi',
            '/tcp/av0_0', '/tcp/av0_1', '/h264', '/h264.sdp', '/onvif/device_service',
            '/ISAPI/Streaming/channels/101/httpPreview', '/Streaming/Channels/1/httppreview'];
    }

    let connected = false;

    // Быстрые комбинации для Xiaomi Chuangmi
    if (knownDevice && knownDevice.vendor === 'Xiaomi IMILAB') {
        const xiaomiQuick = [
            'http://' + ip + ':80/',
            'http://' + ip + ':8080/',
            'http://' + ip + ':8080/video',
            'http://' + ip + ':8080/stream',
            'http://' + ip + ':554/',
            'http://' + ip + ':554/onvif/device_service',
            'http://' + ip + ':8000/',
            'http://' + ip + ':8554/',
        ];
        
        for (const url of xiaomiQuick) {
            if (connected) break;
            setStatus(cameraId, '🔍 Xiaomi: ' + url.split(':')[2].split('/')[0], '#ffa502');
            if (await tryConnect(cameraId, url)) {
                connected = true;
                setStatus(cameraId, '✅ Xiaomi Chuangmi', '#2ed573');
                setLED(cameraId, 'live');
                addLog('CAM-0' + cameraId, 'Xiaomi: ' + url);
            }
        }
    }

    // Быстрые комбинации для Kenetek
    if (!connected && knownDevice && knownDevice.vendor === 'Kenetek') {
        const kenetekQuick = [
            'http://' + ip + ':34567/',
            'http://' + ip + ':34567/tcp/av0_0',
            'http://' + ip + ':8080/',
            'http://' + ip + ':8080/video',
            'http://' + ip + ':8000/',
            'http://' + ip + ':8800/',
        ];
        
        for (const url of kenetekQuick) {
            if (connected) break;
            setStatus(cameraId, '🔍 Kenetek: порт ' + url.split(':')[2].split('/')[0], '#ffa502');
            if (await tryConnect(cameraId, url)) {
                connected = true;
                setStatus(cameraId, '✅ Kenetek Ultra', '#2ed573');
                setLED(cameraId, 'live');
                addLog('CAM-0' + cameraId, 'Kenetek: ' + url);
            }
        }
    }

    // Полный перебор если не нашли
    if (!connected) {
        for (const port of portsToScan) {
            if (connected) break;
            setStatus(cameraId, '🔍 Порт ' + port, '#ffa502');

            for (const path of pathsToScan) {
                if (connected) break;
                const url = 'http://' + ip + ':' + port + path;
                if (await tryConnect(cameraId, url)) {
                    connected = true;
                    setStatus(cameraId, '✅ Порт ' + port, '#2ed573');
                    setLED(cameraId, 'live');
                    addLog('CAM-0' + cameraId, 'Найдено: ' + url);
                }
            }
        }
    }

    if (!connected) {
        setStatus(cameraId, '❌ Нет сигнала', '#ff4757');
        setLED(cameraId, 'offline');
        showPlaceholder(cameraId, 'Нет сигнала');
        addLog('CAM-0' + cameraId, 'Не удалось подключиться');
    }

    updateActiveCount();
}

// ========== ПОПЫТКА ПОДКЛЮЧЕНИЯ ==========
function tryConnect(cameraId, url) {
    return new Promise((resolve) => {
        const container = document.getElementById('cam' + cameraId);
        let resolved = false;

        const finish = (success) => {
            if (!resolved) {
                resolved = true;
                resolve(success);
            }
        };

        // MJPEG через img
        const img = new Image();
        img.crossOrigin = 'anonymous';

        const imgTimeout = setTimeout(() => {
            img.src = '';
            finish(false);
        }, 2500);

        img.onload = function () {
            if (img.naturalWidth > 0 && img.naturalWidth > 16 && img.naturalWidth < 10000) {
                clearTimeout(imgTimeout);
                container.innerHTML = '';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                container.appendChild(img);
                addTimestamp(container, cameraId);
                activeStreams[cameraId] = { type: 'mjpeg', url: url };
                finish(true);
            }
        };

        img.onerror = function () {
            clearTimeout(imgTimeout);
            tryVideo(cameraId, url, container, finish);
        };

        img.src = url;
    });
}

function tryVideo(cameraId, url, container, finish) {
    const video = document.createElement('video');
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.loop = true;
    video.crossOrigin = 'anonymous';
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';

    const videoTimeout = setTimeout(() => {
        video.src = '';
        finish(false);
    }, 3500);

    video.onloadedmetadata = function () {
        clearTimeout(videoTimeout);
        container.innerHTML = '';
        container.appendChild(video);
        addTimestamp(container, cameraId);
        video.play().catch(() => {});
        activeStreams[cameraId] = { type: 'video', url: url, element: video };
        finish(true);
    };

    video.onerror = function () {
        clearTimeout(videoTimeout);
        finish(false);
    };

    video.src = url;
}

// ========== ОТКЛЮЧЕНИЕ ==========
function disconnectCamera(cameraId, silent = false) {
    if (activeStreams[cameraId]) {
        if (activeStreams[cameraId].stream) {
            activeStreams[cameraId].stream.getTracks().forEach(t => t.stop());
        }
        activeStreams[cameraId] = null;
    }
    showPlaceholder(cameraId, 'Введите IP или MAC');
    setLED(cameraId, 'offline');
    setStatus(cameraId, 'Отключено', '#888');
    updateActiveCount();
    if (!silent) addLog('CAM-0' + cameraId, 'Отключена');
}

// ========== ВЕБ-КАМЕРА ==========
async function useWebcam(cameraId) {
    try {
        disconnectCamera(cameraId, true);
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        const container = document.getElementById('cam' + cameraId);
        container.innerHTML = '';
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        container.appendChild(video);
        addTimestamp(container, cameraId);
        activeStreams[cameraId] = { type: 'webcam', stream: stream };
        setLED(cameraId, 'live');
        setStatus(cameraId, '✅ Веб-камера', '#2ed573');
        updateActiveCount();
        addLog('CAM-0' + cameraId, 'Веб-камера');
    } catch (err) {
        alert('Нет доступа: ' + err.message);
    }
}

// ========== СНИМОК ==========
function snapshot(cameraId) {
    const container = document.getElementById('cam' + cameraId);
    const img = container.querySelector('img');
    const video = container.querySelector('video');

    if (img && activeStreams[cameraId]) {
        const a = document.createElement('a');
        a.href = img.src;
        a.download = 'cam' + cameraId + '-' + Date.now() + '.jpg';
        a.click();
        addLog('CAM-0' + cameraId, 'Снимок');
    } else if (video && activeStreams[cameraId] && video.videoWidth) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/jpeg');
        a.download = 'cam' + cameraId + '-' + Date.now() + '.jpg';
        a.click();
        addLog('CAM-0' + cameraId, 'Снимок');
    } else {
        alert('Нет видеопотока');
    }
}

// ========== ХЕЛПЕРЫ ==========
function setLED(id, status) {
    const el = document.getElementById('led' + id);
    if (el) el.className = 'camera-status status-' + status;
}

function setStatus(id, text, color) {
    const el = document.getElementById('cam' + id + '-status');
    if (el) { el.textContent = text; el.style.color = color; }
}

function showPlaceholder(id, text) {
    const container = document.getElementById('cam' + id);
    container.innerHTML = '<span class="camera-placeholder"><span class="icon">🎥</span>' + text + '</span>';
    addTimestamp(container, id);
}

function addTimestamp(container, id) {
    const ts = document.createElement('div');
    ts.className = 'timestamp-overlay';
    ts.id = 'ts' + id;
    container.appendChild(ts);
}

function updateActiveCount() {
    const count = Object.values(activeStreams).filter(Boolean).length;
    document.getElementById('active-cameras').textContent = count;
}

// Время
setInterval(() => {
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById('ts' + i);
        if (el) el.textContent = new Date().toLocaleString('ru-RU');
    }
}, 1000);

// Журнал
let logs = JSON.parse(localStorage.getItem('camera_logs') || '[]');

function addLog(cam, ev) {
    logs.unshift({ time: new Date().toLocaleString('ru-RU'), camera: cam, event: ev, operator: 'Купалов Д.К.' });
    if (logs.length > 50) logs.pop();
    localStorage.setItem('camera_logs', JSON.stringify(logs));
    renderLogs();
}

function renderLogs() {
    const tbody = document.getElementById('camera-log');
    if (tbody) {
        tbody.innerHTML = logs.slice(0, 10).map(l =>
            `<tr><td>${l.time}</td><td>${l.camera}</td><td>${l.event}</td><td>${l.operator}</td></tr>`
        ).join('');
    }
}

// Автосканирование при загрузке
window.addEventListener('load', () => {
    renderLogs();
    updateActiveCount();
    // Автоматически заполняем IP для известных камер
    for (const [mac, device] of Object.entries(knownDevices)) {
        if (device.camId && device.ip) {
            const ipInput = document.getElementById('cam' + device.camId + '-ip');
            if (ipInput && !ipInput.value) {
                ipInput.value = device.ip;
                addLog('SYSTEM', device.name + ' → ' + device.ip + ' (' + device.location + ')');
            }
        }
    }
});

function logout() {
    for (let i = 1; i <= 4; i++) {
        if (activeStreams[i]?.stream) activeStreams[i].stream.getTracks().forEach(t => t.stop());
    }
    localStorage.removeItem('sec_token');
    localStorage.removeItem('sec_role');
    window.location.href = 'index.html';
}
