// Проверка доступа
if (!localStorage.getItem('sec_token') || localStorage.getItem('sec_role') !== 'administrator') {
    window.location.href = 'index.html';
}

// Обновление времени на камерах
function updateTimestamps() {
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById('ts' + i);
        if (el) el.textContent = new Date().toLocaleString('ru-RU');
    }
}
setInterval(updateTimestamps, 1000);
updateTimestamps();

// Подключение веб-камеры
async function connectCamera(cameraId) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.muted = true;
        
        const container = document.getElementById('cam' + cameraId);
        container.innerHTML = '';
        container.appendChild(video);
        
        addLog('CAM-0' + cameraId, 'Камера подключена');
    } catch (err) {
        addLog('CAM-0' + cameraId, 'Ошибка: ' + err.message);
        alert('Не удалось подключить камеру: ' + err.message);
    }
}

// Снимок с камеры
function snapshot(cameraName) {
    addLog(cameraName, 'Сделан снимок');
    alert('📸 Снимок с ' + cameraName + ' сохранён в архив');
}

// Журнал событий камер
let cameraLogs = JSON.parse(localStorage.getItem('camera_logs') || '[]');

function addLog(camera, event) {
    cameraLogs.unshift({
        time: new Date().toLocaleString('ru-RU'),
        camera: camera,
        event: event,
        operator: 'Administrator'
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
    localStorage.removeItem('sec_token');
    localStorage.removeItem('sec_role');
    window.location.href = 'index.html';
}

renderCameraLog();
