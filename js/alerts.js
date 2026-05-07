// Проверка доступа
if (!localStorage.getItem('sec_token') || localStorage.getItem('sec_role') !== 'administrator') {
    window.location.href = 'index.html';
}

// Система тревог
let alerts = JSON.parse(localStorage.getItem('sec_alerts')) || [
    { level: 'critical', message: 'Попытка несанкционированного доступа в серверную', time: '10:30', status: 'active' },
    { level: 'warning', message: 'Камера CAM-04 не отвечает', time: '09:15', status: 'active' },
    { level: 'info', message: 'Плановая проверка систем', time: '08:00', status: 'resolved' }
];

// Звук тревоги (Web Audio API — без внешних файлов)
function playAlarmSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'square';
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        setTimeout(() => {
            oscillator.stop();
            ctx.close();
        }, 500);
    } catch(e) {
        // Браузер не поддерживает Web Audio API
    }
}

function renderAlerts() {
    const container = document.getElementById('alerts-container');
    if (!container) return;
    
    const criticalAlerts = alerts.filter(a => a.status === 'active' && a.level === 'critical');
    if (criticalAlerts.length > 0) {
        try { playAlarmSound(); } catch(e) {}
    }
    
    container.innerHTML = alerts.map((a, i) => `
        <div style="
            padding: 12px;
            margin: 8px 0;
            background: ${a.level === 'critical' ? '#3a1a1a' : a.level === 'warning' ? '#3a351a' : '#1a2a3a'};
            border-left: 4px solid ${a.level === 'critical' ? '#ff4757' : a.level === 'warning' ? '#ffa502' : '#00d2ff'};
            display: flex;
            justify-content: space-between;
            align-items: center;
        ">
            <div>
                <strong>${a.level === 'critical' ? '🔴' : a.level === 'warning' ? '🟡' : '🔵'} ${a.message}</strong>
                <br><small>${a.time} | Статус: ${a.status === 'active' ? 'Активна' : 'Снята'}</small>
            </div>
            ${a.status === 'active' ? `<button onclick="resolveAlert(${i})" style="width:auto; padding:5px 15px;">СНЯТЬ</button>` : ''}
        </div>
    `).join('');
    
    document.getElementById('active-count').textContent = alerts.filter(a => a.status === 'active').length;
}

window.resolveAlert = function(index) {
    alerts[index].status = 'resolved';
    localStorage.setItem('sec_alerts', JSON.stringify(alerts));
    renderAlerts();
}

function logout() {
    localStorage.removeItem('sec_token');
    localStorage.removeItem('sec_role');
    window.location.href = 'index.html';
}

renderAlerts();
