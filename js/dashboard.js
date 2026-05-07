// Проверка: только Administrator
if (!localStorage.getItem('sec_token') || localStorage.getItem('sec_role') !== 'administrator') {
    window.location.href = 'index.html';
}

// Данные инцидентов (локальное хранилище)
let incidents = JSON.parse(localStorage.getItem('sec_incidents')) || [
    { id: 1, type: 'Фишинг', source: 'hr@fake.com', status: 'open' },
    { id: 2, type: 'Brute Force', source: '45.33.32.156', status: 'progress' },
    { id: 3, type: 'Утечка данных', source: 'Бухгалтерия', status: 'closed' }
];

function renderTable() {
    const tbody = document.getElementById('incident-body');
    tbody.innerHTML = incidents.map(inc => `
        <tr>
            <td>INC-${inc.id}</td>
            <td>${inc.type}</td>
            <td>${inc.source}</td>
            <td class="status-${inc.status}">${inc.status.toUpperCase()}</td>
            <td>
                <button onclick="changeStatus(${inc.id})" style="padding:2px 10px; width:auto;">Сменить статус</button>
                <button onclick="deleteIncident(${inc.id})" style="padding:2px 10px; width:auto; border-color:#ff4757;">X</button>
            </td>
        </tr>
    `).join('');
    
    document.getElementById('crit-count').textContent = incidents.filter(i => i.status === 'open').length;
    document.getElementById('prog-count').textContent = incidents.filter(i => i.status === 'progress').length;
    document.getElementById('closed-count').textContent = incidents.filter(i => i.status === 'closed').length;
}

window.changeStatus = function(id) {
    const inc = incidents.find(i => i.id === id);
    const statuses = ['open', 'progress', 'closed'];
    const currentIndex = statuses.indexOf(inc.status);
    inc.status = statuses[(currentIndex + 1) % 3];
    saveAndRender();
}

window.deleteIncident = function(id) {
    if (confirm('Удалить инцидент INC-' + id + '?')) {
        incidents = incidents.filter(i => i.id !== id);
        saveAndRender();
    }
}

window.addIncident = function() {
    const type = document.getElementById('new-type').value.trim();
    const source = document.getElementById('new-source').value.trim();
    if (!type || !source) return alert('Заполните все поля');
    
    incidents.push({
        id: Date.now(),
        type,
        source,
        status: 'open'
    });
    saveAndRender();
    document.getElementById('new-type').value = '';
    document.getElementById('new-source').value = '';
}

function saveAndRender() {
    localStorage.setItem('sec_incidents', JSON.stringify(incidents));
    renderTable();
}

function logout() {
    localStorage.removeItem('sec_token');
    localStorage.removeItem('sec_role');
    window.location.href = 'index.html';
}

// Администратор видит все панели всегда
document.getElementById('admin-panel').style.display = 'block';

renderTable();
