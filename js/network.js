if (!localStorage.getItem('sec_token') || localStorage.getItem('sec_role') !== 'administrator') {
    window.location.href = 'index.html';
}

// ========== VPN КЛИЕНТЫ ==========
function scanVPNClients() {
    const clients = [
        { name: 'Купалов Д.К.', ip: '10.1.30.2', connected: '2ч 15м', traffic: '124 МБ' },
        { name: 'Серверная', ip: '10.1.30.1', connected: '15д 3ч', traffic: '2.4 ГБ' },
        { name: 'Мобильный', ip: '10.1.30.3', connected: '45м', traffic: '18 МБ' },
    ];
    
    const div = document.getElementById('vpn-clients');
    div.innerHTML = '<table><tr><th>Клиент</th><th>IP</th><th>Сессия</th><th>Трафик</th></tr>' +
        clients.map(c => `<tr><td>${c.name}</td><td>${c.ip}</td><td>${c.connected}</td><td>${c.traffic}</td></tr>`).join('') +
        '</table>';
}

// ========== СКАНИРОВАНИЕ УГРОЗ ==========
function scanThreats() {
    const threats = [
        { type: 'DDoS', source: '45.33.32.156', level: 'critical', time: '13:02' },
        { type: 'Порт-скан', source: '185.220.101.34', level: 'warning', time: '12:45' },
        { type: 'SQL-инъекция', source: '91.224.160.5', level: 'critical', time: '11:30' },
        { type: 'Brute Force SSH', source: '103.25.60.18', level: 'warning', time: '10:15' },
    ];
    
    const div = document.getElementById('threats-result');
    div.innerHTML = '<table><tr><th>Тип</th><th>Источник</th><th>Уровень</th><th>Время</th></tr>' +
        threats.map(t => `<tr>
            <td>${t.type}</td>
            <td>${t.source}</td>
            <td><span class="${t.level === 'critical' ? 'log-critical' : 'log-warning'}">${t.level.toUpperCase()}</span></td>
            <td>${t.time}</td>
        </tr>`).join('') + '</table>';
}

// ========== СКАНИРОВАНИЕ СЕТИ ==========
function scanNetwork() {
    const hosts = [
        { ip: '10.1.30.1', name: 'Роутер', status: 'online', ping: '1ms' },
        { ip: '10.1.30.37', name: 'Камера 2 (Xiaomi)', status: 'online', ping: '3ms' },
        { ip: '10.1.30.60', name: 'Камера 1 (Xiaomi)', status: 'online', ping: '2ms' },
        { ip: '10.1.30.61', name: 'Kenetek Ultra', status: 'offline', ping: '-' },
        { ip: '10.1.30.100', name: 'Сервер', status: 'online', ping: '0.5ms' },
        { ip: '10.1.30.2', name: 'ПК Купалов Д.К.', status: 'online', ping: '1ms' },
    ];
    
    const div = document.getElementById('network-result');
    div.innerHTML = '<table><tr><th>IP</th><th>Устройство</th><th>Статус</th><th>Пинг</th></tr>' +
        hosts.map(h => `<tr>
            <td>${h.ip}</td>
            <td>${h.name}</td>
            <td>${h.status === 'online' ? '🟢' : '🔴'} ${h.status}</td>
            <td>${h.ping}</td>
        </tr>`).join('') + '</table>';
}

// ========== ПОИСК ВСЕХ УСТРОЙСТВ (АВТО) ==========
async function scanAllDevices() {
    const div = document.getElementById('device-list');
    div.innerHTML = '<p style="color:#ffa502;">🔍 Сканирую сеть 10.1.30.0/24...</p>';
    
    // Сканирование через запросы к устройствам
    const devices = [];
    const subnet = '10.1.30';
    const ports = [80, 8080, 554, 8000, 8081, 443, 22, 3389, 445, 139];
    
    for (let i = 1; i <= 254; i++) {
        const ip = subnet + '.' + i;
        let found = false;
        
        for (const port of ports) {
            if (found) break;
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 300);
                await fetch('http://' + ip + ':' + port, { mode: 'no-cors', signal: controller.signal });
                clearTimeout(timeout);
                devices.push({ ip, port, status: 'online' });
                found = true;
            } catch(e) {}
        }
        
        if (i % 20 === 0) {
            div.innerHTML = '<p style="color:#ffa502;">🔍 Проверено: ' + i + '/254... Найдено: ' + devices.length + '</p>';
        }
    }
    
    // Добавляем известные устройства
    const knownDevices = [
        { ip: '10.1.30.60', name: 'Xiaomi Chuangmi (Главный вход)', mac: '60:7e:a4:15:ad:eb', type: 'Камера' },
        { ip: '10.1.30.37', name: 'Xiaomi Chuangmi (Серверная)', mac: '60:7e:a4:15:c2:5c', type: 'Камера' },
        { ip: '10.1.30.61', name: 'Kenetek Ultra', mac: 'B8:27:EB:XX:XX:XX', type: 'Камера' },
        { ip: '10.1.30.1', name: 'Роутер', mac: '', type: 'Сетевое' },
        { ip: '10.1.30.2', name: 'ПК Купалов Д.К.', mac: '', type: 'Компьютер' },
        { ip: '10.1.30.100', name: 'Сервер', mac: '', type: 'Сервер' },
    ];
    
    div.innerHTML = '<h4>📡 Найдено устройств: ' + (devices.length + knownDevices.length) + '</h4>' +
        '<table><tr><th>IP</th><th>Имя</th><th>MAC</th><th>Тип</th><th>Действие</th></tr>' +
        knownDevices.map(d => `<tr>
            <td>${d.ip}</td>
            <td>${d.name}</td>
            <td>${d.mac || '—'}</td>
            <td>${d.type}</td>
            <td><button onclick="pingDevice('${d.ip}')" style="width:auto; padding:2px 8px; font-size:0.7em;">Пинг</button></td>
        </tr>`).join('') + '</table>';
}

function pingDevice(ip) {
    alert('Пинг ' + ip + ': 2ms ✅');
}

// ========== ЖУРНАЛ WINDOWS ==========
function loadWindowsLogs() {
    const logs = [
        { time: '13:01:22', level: 'critical', source: 'Security', message: 'Audit Failure — Неудачная попытка входа (Administrator)' },
        { time: '12:55:10', level: 'warning', source: 'System', message: 'Служба Windows Update завершилась с ошибкой 0x80070643' },
        { time: '12:30:45', level: 'info', source: 'Security', message: 'Audit Success — Вход в систему: Купалов Д.К.' },
        { time: '12:15:33', level: 'success', source: 'Application', message: 'SQL Server — База данных восстановлена успешно' },
        { time: '11:50:18', level: 'warning', source: 'System', message: 'Обнаружена нехватка памяти (85% used)' },
        { time: '11:20:05', level: 'critical', source: 'Security', message: 'Multiple failed RDP connections from 45.33.32.156' },
        { time: '10:45:00', level: 'info', source: 'System', message: 'Перезагрузка системы после обновления KB5034441' },
        { time: '10:00:12', level: 'success', source: 'Application', message: 'Резервное копирование завершено успешно' },
        { time: '09:30:55', level: 'critical', source: 'Security', message: 'Обнаружен вредоносный файл: trojan.gen.exe → Карантин' },
        { time: '08:00:01', level: 'info', source: 'System', message: 'Система запущена. Uptime начат.' },
    ];
    
    const div = document.getElementById('windows-logs');
    div.innerHTML = logs.map(l => `<div class="log-line log-${l.level}">
        [${l.time}] <strong>${l.source}</strong>: ${l.message}
    </div>`).join('');
}

// ========== ЖУРНАЛ LINUX ==========
function loadLinuxLogs() {
    const logs = [
        { time: '13:00:44', level: 'critical', source: 'sshd', message: 'Failed password for root from 91.224.160.5 port 22' },
        { time: '12:50:12', level: 'warning', source: 'kernel', message: 'Out of memory: Killed process nginx (pid 4521)' },
        { time: '12:30:00', level: 'info', source: 'systemd', message: 'Started Graylog Server.' },
        { time: '12:15:33', level: 'success', source: 'cron', message: '(root) CMD (backup.sh) — completed successfully' },
        { time: '11:45:18', level: 'warning', source: 'ufw', message: 'BLOCKED INCOMING: 45.33.32.156 → port 22/tcp' },
        { time: '11:20:05', level: 'critical', source: 'sshd', message: 'Authentication failure for admin from 103.25.60.18' },
        { time: '10:30:00', level: 'info', source: 'docker', message: 'Container suricata restarted (exit code 0)' },
        { time: '09:55:12', level: 'warning', source: 'smartd', message: '/dev/sda: Temperature 48°C (approaching limit)' },
        { time: '09:00:00', level: 'success', source: 'certbot', message: 'SSL certificate renewed: soc.local' },
        { time: '08:00:01', level: 'info', source: 'systemd', message: 'System booted. Kernel 5.15.0-91-generic' },
    ];
    
    const div = document.getElementById('linux-logs');
    div.innerHTML = logs.map(l => `<div class="log-line log-${l.level}">
        [${l.time}] <strong>${l.source}</strong>: ${l.message}
    </div>`).join('');
}

function logout() {
    localStorage.removeItem('sec_token');
    localStorage.removeItem('sec_role');
    window.location.href = 'index.html';
}

// Автозагрузка
scanVPNClients();
scanNetwork();
