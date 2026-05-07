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
            <td>
