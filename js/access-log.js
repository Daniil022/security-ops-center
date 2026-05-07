// Проверка доступа
if (!localStorage.getItem('sec_token') || localStorage.getItem('sec_role') !== 'administrator') {
    window.location.href = 'index.html';
}

// Демо-данные СКУД
let accessRecords = JSON.parse(localStorage.getItem('access_records')) || [
    { time: '2026-05-07 08:30:15', card: 'RFID-7845', employee: 'Иванов И.И.', zone: 'Главный вход', status: 'Разрешён', method: 'Карта' },
    { time: '2026-05-07 08:45:22', card: 'RFID-3291', employee: 'Петров П.П.', zone: 'Серверная', status: 'Разрешён', method: 'Карта + PIN' },
    { time: '2026-05-07 09:02:11', card: 'RFID-5555', employee: 'Неизвестный', zone: 'Серверная', status: 'Отклонён', method: 'Карта' },
    { time: '2026-05-07 09:15:47', card: 'BIO-001', employee: 'Сидоров С.С.', zone: 'Кабинет руководителя', status: 'Разрешён', method: 'Биометрия' },
    { time: '2026-05-07 10:30:03', card: 'RFID-9999', employee: 'Неизвестный', zone: 'Периметр', status: 'Тревога', method: 'Карта' },
];

function renderTable() {
    const tbody = document.getElementById('access-table');
    const filtered = getFilteredRecords();
    
    tbody.innerHTML = filtered.map(r => `
        <tr>
            <td>${r.time}</td>
            <td>${r.card}</td>
            <td>${r.employee}</td>
            <td>${r.zone}</td>
            <td><span class="badge ${r.status === 'Разрешён' ? 'badge-success' : r.status === 'Отклонён' ? 'badge-warning' : 'badge-danger'}">${r.status}</span></td>
            <td>${r.method}</td>
        </tr>
    `).join('');
    
    document.getElementById('total-records').textContent = filtered.length;
}

function getFilteredRecords() {
    const date = document.getElementById('filter-date').value;
    const zone = document.getElementById('filter-zone').value;
    const status = document.getElementById('filter-status').value;
    const card = document.getElementById('filter-card').value.toLowerCase();
    
    return accessRecords.filter(r => {
        if (date && !r.time.startsWith(date)) return false;
        if (zone && r.zone !== zone) return false;
        if (status && r.status !== status) return false;
        if (card && !r.card.toLowerCase().includes(card) && !r.employee.toLowerCase().includes(card)) return false;
        return true;
    });
}

function applyFilters() {
    renderTable();
}

function exportLog() {
    const csv = 'Время;Карта;Сотрудник;Зона;Статус;Метод\n' + 
        getFilteredRecords().map(r => `${r.time};${r.card};${r.employee};${r.zone};${r.status};${r.method}`).join('\n');
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'access-log-export.csv';
    link.click();
}

function logout() {
    localStorage.removeItem('sec_token');
    localStorage.removeItem('sec_role');
    window.location.href = 'index.html';
}

renderTable();
