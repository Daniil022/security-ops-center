// Проверка доступа
if (!localStorage.getItem('sec_token') || localStorage.getItem('sec_role') !== 'administrator') {
    window.location.href = 'index.html';
}

// Хранилище активных стримов
const activeStreams = {};

// Обновление времени на камерах
function updateTimestamps() {
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById('ts' + i);
        if (el) el.textContent = new Date().toLocaleString('ru-RU');
    }
}
setInterval(updateTimestamps, 1000);
updateTimestamps();

// Обновление счётчика активных камер
function updateActiveCount() {
    const count = Object.values(activeStreams).filter(s => s !== null).length;
    document.getElementById('active-cameras').textContent = count;
    
    for (let i = 1; i <= 4; i++) {
        const led = document.getElementById('led' + i);
        if (led) {
            if (activeStreams[i]) {
                led.className = 'camera-status status-live';
            } else {
                led.className = 'camera-status status-offline';
            }
        }
    }
}

// ========== ПОДКЛЮЧЕНИЕ WI-FI КАМЕРЫ ==========
function connectWiFiCamera(cameraId) {
    const ipInput = document.getElementById('cam' + cameraId + '-ip');
    const statusEl = document.getElementById('cam' + cameraId + '-status');
    
    if (!ipInput || !ipInput.value.trim()) {
        if (statusEl) {
            statusEl.textContent = '❌ Введите IP-адрес';
            statusEl.style.color = '#ff4757';
        }
        return;
    }
    
    const address = ipInput.value.trim();
    let url;
    
    // Автоматически определяем протокол
    if (address.startsWith('http://') || address.startsWith('https://')) {
        url = address;
    } else {
        url = 'http://' + address;
    }
    
    if (statusEl) {
        statusEl.textContent = '⏳ Подключение...';
        statusEl.style.color = '#ffa502';
    }
    
    addLog('CAM-0' + cameraId, 'Подключение к ' + url);
    
    // Отключаем предыдущий стрим если есть
    disconnectCamera(cameraId, true);
    
    // Создаём img для MJPEG / snapshot
    const container = document.getElementById('cam' + cameraId);
    container.innerHTML = '';
    
    // Пробуем MJPEG стрим через img (работает с большинством китайских камер)
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Wi-Fi Camera ' + cameraId;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    
    img.onload = function() {
        if (statusEl) {
            statusEl.textContent = '✅ Подключено (MJPEG)';
            statusEl.style.color = '#2ed573';
        }
        activeStreams[cameraId] = { type: 'mjpeg', url: url };
        updateActiveCount();
        addLog('CAM-0' + cameraId, 'Камера подключена: ' + url);
    };
    
    img.onerror = function() {
        // Если MJPEG не сработал, пробуем видео
        if (statusEl) {
            statusEl.textContent = '🔄 Пробуем видео...';
        }
        
        const video = document.createElement('video');
        video.src = url;
        video.autoplay = true;
        video.muted = true;
        video.controls = false;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        
        video.onloadeddata = function() {
            if (statusEl) {
                statusEl.textContent = '✅ Подключено (Video)';
                statusEl.style.color = '#2ed573';
            }
            activeStreams[cameraId] = { type: 'video', url: url, element: video };
            updateActiveCount();
            addLog('CAM-0' + cameraId, 'Камера подключена: ' + url);
        };
        
        video.onerror = function() {
            if (statusEl) {
                statusEl.textContent = '❌ Не удалось подключиться';
                statusEl.style.color = '#ff4757';
            }
            container.innerHTML = '<span class="camera-placeholder"><span class="icon">❌</span>Нет сигнала</span>';
            addLog('CAM-0' + cameraId, 'Ошибка подключения: ' + url);
        };
        
        container.innerHTML = '';
        container.appendChild(video);
        
        const ts = document.createElement('div');
        ts.className = 'timestamp-overlay';
        ts.id = 'ts' + cameraId;
        container.appendChild(ts);
    };
    
    container.appendChild(img);
    
    // Добавляем метку времени поверх
    const ts = document.createElement('div');
    ts.className = 'timestamp-overlay';
    ts.id = 'ts' + cameraId;
    container.appendChild(ts);
}

// ========== ОТКЛЮЧЕНИЕ КАМЕРЫ ==========
function disconnectCamera(cameraId, silent = false) {
    if (activeStreams[cameraId]) {
        const container = document.getElementById('cam' + cameraId);
        container.innerHTML = '<span class="camera-placeholder"><span class="icon">🎥</span>Введите IP камеры и нажмите "Подключить"</span>';
        
        const ts = document.createElement('div');
        ts.className = 'timestamp-overlay';
        ts.id = 'ts' + cameraId;
        container.appendChild(ts);
        
        activeStreams[cameraId] = null;
        updateActiveCount();
        
        const statusEl = document.getElementById('cam' + cameraId + '-status');
        if (statusEl) {
            statusEl.textContent = 'Отключено';
            statusEl.style.color = '#888';
        }
        
        if (!silent) {
            addLog('CAM-0' + cameraId, 'Камера отключена');
        }
    }
}

// ========== СНИМОК ==========
function snapshot(cameraId) {
    const container = document.getElementById('cam' + cameraId);
    const img = container.querySelector('img');
    const video = container.querySelector('video');
    
    if (img && img.src && activeStreams[cameraId]) {
        // Скачиваем текущий кадр
        const link = document.createElement('a');
        link.href = img.src;
        link.download = 'snapshot-cam' + cameraId + '-' + Date.now() + '.jpg';
        link.click();
        addLog('CAM-0' + cameraId, 'Снимок сохранён');
    } else if (video && activeStreams[cameraId]) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/jpeg');
            link.download = 'snapshot-cam' + cameraId + '-' + Date.now() + '.jpg';
            link.click();
            addLog('CAM-0' + cameraId, 'Снимок сохранён');
        } catch(e) {
            alert('Не удалось сделать снимок');
        }
    } else {
        alert('Камера не подключена');
    }
}

// ========== ВЕБ-КАМЕРА КОМПЬЮТЕРА ==========
async function useWebcam(cameraId) {
    try {
        disconnectCamera(cameraId, true);
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        
        const container = document.getElementById('cam' + cameraId);
        container.innerHTML = '';
        
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.muted = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        
        container.appendChild(video);
        
        const ts = document.createElement('div');
        ts.className = 'timestamp-overlay';
        ts.id = 'ts' + cameraId;
        container.appendChild(ts);
        
        activeStreams[cameraId] = { type: 'webcam', stream: stream };
        updateActiveCount();
        
        const statusEl = document.getElementById('cam' + cameraId + '-status');
        if (statusEl) {
            statusEl.textContent = '✅ Веб-камера';
            statusEl.style.color = '#2ed573';
        }
        
        addLog('CAM-0' + cameraId, 'Веб-камера подключена');
    } catch (err) {
        alert('Ошибка доступа к веб-камере: ' + err.message);
        addLog('CAM-0' + cameraId, 'Ошибка веб-камеры: ' + err.message);
    }
}

// ========== ЖУРНАЛ ==========
let cameraLogs = JSON.parse(localStorage.getItem('camera_logs') || '[]');

function addLog(camera, event) {
    cameraLogs.unshift({
        time: new Date().toLocaleString('ru-RU'),
        camera: camera,
        event: event,
        operator: 'Купалов Д.К.'
    });
    if (cameraLogs.length > 50) cameraLogs.pop();
    localStorage.setItem('camera_logs', JSON.stringify(cameraLogs));
    renderCameraLog();
}

function renderCameraLog() {
    const tbody = document.getElementById('camera-log');
    if (!tbody) return;
    tbody.innerHTML = cameraLogs.slice(0, 10).map(log => `
        <tr>
            <td>${log.time}</td>
            <td>${log.camera}</td>
            <td>${log.event}</td>
            <td>${log.operator}</td>
        </tr>
    `).join('');
}

function logout() {
    // Отключаем все стримы перед выходом
    for (let i = 1; i <= 4; i++) {
        if (activeStreams[i] && activeStreams[i].stream) {
            activeStreams[i].stream.getTracks().forEach(track => track.stop());
        }
    }
    localStorage.removeItem('sec_token');
    localStorage.removeItem('sec_role');
    window.location.href = 'index.html';
}

renderCameraLog();
updateActiveCount();
