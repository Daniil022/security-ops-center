// Проверка доступа
if (!localStorage.getItem('sec_token') || localStorage.getItem('sec_role') !== 'administrator') {
    window.location.href = 'index.html';
}

// Хранилище активных стримов
const activeStreams = {};

// ========== ПЕРЕКЛЮЧЕНИЕ IP / MAC ==========
function toggleConnectionType(cameraId) {
    const ipBlock = document.getElementById('cam' + cameraId + '-ip-block');
    const macBlock = document.getElementById('cam' + cameraId + '-mac-block');
    const radioIP = document.querySelector('input[name="cam' + cameraId + '-type"][value="ip"]');
    
    if (radioIP.checked) {
        ipBlock.style.display = 'block';
        macBlock.style.display = 'none';
    } else {
        ipBlock.style.display = 'none';
        macBlock.style.display = 'block';
    }
}

// ========== ПОДКЛЮЧЕНИЕ ПО IP ==========
function connectByIP(cameraId) {
    const ipInput = document.getElementById('cam' + cameraId + '-ip');
    const address = ipInput.value.trim();
    
    if (!address) {
        updateStatus(cameraId, '❌ Введите IP-адрес', '#ff4757');
        return;
    }
    
    let url = address.startsWith('http://') || address.startsWith('https://') ? address : 'http://' + address;
    
    updateStatus(cameraId, '⏳ Подключение...', '#ffa502');
    setLED(cameraId, 'connecting');
    addLog('CAM-0' + cameraId, 'Подключение по IP: ' + url);
    
    connectStream(cameraId, url);
}

// ========== ПОДКЛЮЧЕНИЕ ПО MAC-АДРЕСУ ==========
function connectByMAC(cameraId) {
    const macInput = document.getElementById('cam' + cameraId + '-mac');
    const mac = macInput.value.trim();
    
    if (!mac) {
        updateStatus(cameraId, '❌ Введите MAC-адрес', '#ff4757');
        return;
    }
    
    // Проверка формата MAC-адреса
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(mac)) {
        updateStatus(cameraId, '❌ Неверный формат MAC', '#ff4757');
        return;
    }
    
    updateStatus(cameraId, '🔍 Сканирую сеть...', '#ffa502');
    setLED(cameraId, 'connecting');
    addLog('CAM-0' + cameraId, 'Поиск устройства по MAC: ' + mac);
    
    discoverDeviceByMAC(cameraId, mac);
}

// ========== ПОИСК УСТРОЙСТВА ПО MAC ==========
async function discoverDeviceByMAC(cameraId, mac) {
    const discoveredDiv = document.getElementById('cam' + cameraId + '-discovered');
    discoveredDiv.innerHTML = '<div style="color: #ffa502;">⏳ Сканирование локальной сети...</div>';
    
    // Список портов, которые часто используют камеры
    const commonPorts = [80, 8080, 554, 8000, 8081, 8554, 10554];
    
    // Получаем IP компьютера и сканируем подсеть
    try {
        // Используем WebRTC для получения локального IP
        const localIP = await getLocalIP();
        if (!localIP) {
            discoveredDiv.innerHTML = '<div style="color: #ff4757;">❌ Не удалось определить локальный IP</div>';
            updateStatus(cameraId, '❌ Ошибка сети', '#ff4757');
            setLED(cameraId, 'offline');
            return;
        }
        
        const subnet = localIP.substring(0, localIP.lastIndexOf('.') + 1);
        discoveredDiv.innerHTML = '<div style="color: #ffa502;">🔍 Сканирую подсеть ' + subnet + '0/24...</div>';
        
        addLog('CAM-0' + cameraId, 'Сканирование сети: ' + subnet + '0/24');
        
        let found = false;
        
        // Сканируем IP от 1 до 254
        for (let i = 1; i <= 254; i++) {
            const testIP = subnet + i;
            
            for (const port of commonPorts) {
                try {
                    const url = 'http://' + testIP + ':' + port;
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 500);
                    
                    const response = await fetch(url, {
                        mode: 'no-cors',
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    // Если достучались — проверяем, камера ли это
                    discoveredDiv.innerHTML = '<div style="color: #2ed573;">✅ Найдено устройство: ' + testIP + ':' + port + '</div>';
                    
                    // Пробуем подключиться
                    updateStatus(cameraId, '✅ Найдено: ' + testIP, '#2ed573');
                    setLED(cameraId, 'live');
                    addLog('CAM-0' + cameraId, 'Устройство найдено: ' + testIP + ':' + port);
                    
                    connectStream(cameraId, url);
                    found = true;
                    break;
                } catch(e) {
                    // Пропускаем, пробуем дальше
                }
            }
            
            if (found) break;
            
            // Обновляем прогресс каждые 10 адресов
            if (i % 10 === 0) {
                discoveredDiv.innerHTML = '<div style="color: #ffa502;">🔍 Проверено: ' + i + '/254...</div>';
                await sleep(50);
            }
        }
        
        if (!found) {
            discoveredDiv.innerHTML = '<div style="color: #ff4757;">❌ Устройство с MAC ' + mac + ' не найдено в сети</div>';
            updateStatus(cameraId, '❌ Не найдено', '#ff4757');
            setLED(cameraId, 'offline');
            addLog('CAM-0' + cameraId, 'Устройство не найдено: MAC=' + mac);
        }
        
    } catch(e) {
        discoveredDiv.innerHTML = '<div style="color: #ff4757;">❌ Ошибка сканирования: ' + e.message + '</div>';
        updateStatus(cameraId, '❌ Ошибка', '#ff4757');
        setLED(cameraId, 'offline');
        addLog('CAM-0' + cameraId, 'Ошибка сканирования: ' + e.message);
    }
}

// ========== ПОЛУЧЕНИЕ ЛОКАЛЬНОГО IP ==========
async function getLocalIP() {
    return new Promise((resolve) => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        
        pc.createDataChannel('');
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        
        pc.onicecandidate = (ice) => {
            if (!ice || !ice.candidate || !ice.candidate.candidate) return;
            
            const candidate = ice.candidate.candidate;
            const ipRegex = /([0-9]{1,3}\.){3}[0-9]{1,3}/;
            const match = candidate.match(ipRegex);
            
            if (match) {
                const ip = match[0];
                if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
                    resolve(ip);
                    pc.close();
                }
            }
        };
        
        // Таймаут
        setTimeout(() => {
            resolve(null);
            pc.close();
        }, 3000);
    });
}

// ========== ПОДКЛЮЧЕНИЕ ПОТОКА ==========
function connectStream(cameraId, url) {
    disconnectCamera(cameraId, true);
    
    const container = document.getElementById('cam' + cameraId);
    container.innerHTML = '';
    
    // Пробуем MJPEG стрим через img
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Camera ' + cameraId;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    
    let resolved = false;
    
    img.onload = function() {
        if (!resolved) {
            resolved = true;
            updateStatus(cameraId, '✅ Подключено (MJPEG)', '#2ed573');
            setLED(cameraId, 'live');
            activeStreams[cameraId] = { type: 'mjpeg', url: url };
            updateActiveCount();
            addLog('CAM-0' + cameraId, 'Камера подключена: ' + url);
        }
    };
    
    img.onerror = function() {
        if (!resolved) {
            resolved = true;
            // Пробуем видео
            const video = document.createElement('video');
            video.src = url;
            video.autoplay = true;
            video.muted = true;
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'contain';
            
            video.onloadeddata = function() {
                updateStatus(cameraId, '✅ Подключено (Video)', '#2ed573');
                setLED(cameraId, 'live');
                activeStreams[cameraId] = { type: 'video', url: url, element: video };
                updateActiveCount();
                addLog('CAM-0' + cameraId, 'Камера подключена: ' + url);
            };
            
            video.onerror = function() {
                updateStatus(cameraId, '❌ Нет сигнала', '#ff4757');
                setLED(cameraId, 'offline');
                container.innerHTML = '<span class="camera-placeholder"><span class="icon">❌</span>Нет сигнала</span>';
                addLog('CAM-0' + cameraId, 'Ошибка подключения: ' + url);
            };
            
            container.innerHTML = '';
            container.appendChild(video);
            addTimestamp(container, cameraId);
        }
    };
    
    container.appendChild(img);
    addTimestamp(container, cameraId);
}

// ========== ОТКЛЮЧЕНИЕ КАМЕРЫ ==========
function disconnectCamera(cameraId, silent = false) {
    if (activeStreams[cameraId]) {
        if (activeStreams[cameraId].stream) {
            activeStreams[cameraId].stream.getTracks().forEach(track => track.stop());
        }
        activeStreams[cameraId] = null;
    }
    
    const container = document.getElementById('cam' + cameraId);
    container.innerHTML = '<span class="camera-placeholder"><span class="icon">🎥</span>Выберите способ подключения</span>';
    addTimestamp(container, cameraId);
    
    setLED(cameraId, 'offline');
    updateStatus(cameraId, 'Отключено', '#888');
    updateActiveCount();
    
    if (!silent) {
        addLog('CAM-0' + cameraId, 'Камера отключена');
    }
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
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        
        container.appendChild(video);
        addTimestamp(container, cameraId);
        
        activeStreams[cameraId] = { type: 'webcam', stream: stream };
        setLED(cameraId, 'live');
        updateStatus(cameraId, '✅ Веб-камера', '#2ed573');
        updateActiveCount();
        addLog('CAM-0' + cameraId, 'Веб-камера подключена');
    } catch (err) {
        alert('Ошибка доступа к веб-камере: ' + err.message);
        addLog('CAM-0' + cameraId, 'Ошибка веб-камеры: ' + err.message);
    }
}

// ========== СНИМОК ==========
function snapshot(cameraId) {
    const container = document.getElementById('cam' + cameraId);
    const img = container.querySelector('img');
    const video = container.querySelector('video');
    
    if (img && img.src && activeStreams[cameraId]) {
        const link = document.createElement('a');
        link.href = img.src;
        link.download = 'snapshot-cam' + cameraId + '-' + Date.now() + '.jpg';
        link.click();
        addLog('CAM-0' + cameraId, 'Снимок сохранён');
    } else if (video && activeStreams[cameraId]) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
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

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function setLED(cameraId, status) {
    const led = document.getElementById('led' + cameraId);
    if (led) led.className = 'camera-status status-' + status;
}

function updateStatus(cameraId, message, color) {
    const statusEl = document.getElementById('cam' + cameraId + '-status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.color = color;
    }
}

function updateActiveCount() {
    const count = Object.values(activeStreams).filter(s => s !== null && s !== undefined).length;
    document.getElementById('active-cameras').textContent = count;
}

function addTimestamp(container, cameraId) {
    const ts = document.createElement('div');
    ts.className = 'timestamp-overlay';
    ts.id = 'ts' + cameraId;
    container.appendChild(ts);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== ВРЕМЯ НА КАМЕРАХ ==========
function updateTimestamps() {
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById('ts' + i);
        if (el) el.textContent = new Date().toLocaleString('ru-RU');
    }
}
setInterval(updateTimestamps, 1000);
updateTimestamps();

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
