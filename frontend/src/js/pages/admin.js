document.addEventListener('DOMContentLoaded', () => {
    checkAdmin();
    setupTabs();
    loadStats();
});

async function checkAdmin() {
    try {
        const res = await fetch('/api/user/me');
        if (!res.ok) window.location.href = '/login.html';
        const user = await res.json();
        // В реальном проекте тут лучше проверить is_admin, но бэкенд все равно не пустит к API
    } catch (e) { window.location.href = '/'; }
}

function setupTabs() {
    const tabs = document.querySelectorAll('.nav-item[data-tab]');
    const sections = document.querySelectorAll('.section');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            tab.classList.add('active');
            const target = document.getElementById(tab.dataset.tab);
            target.classList.add('active');

            // Подгружаем данные при клике
            if (tab.dataset.tab === 'users') loadUsers();
            if (tab.dataset.tab === 'reports') loadReports();
        });
    });
}

async function loadStats() {
    try {
        const res = await fetch('/api/admin/stats');
        if (res.status === 403) {
            document.body.innerHTML = '<h1 style="text-align:center;margin-top:50px">Доступ запрещен</h1>';
            return;
        }
        const data = await res.json();
        document.getElementById('stat-users').innerText = data.users;
        document.getElementById('stat-listings').innerText = data.listings;
        document.getElementById('stat-deals').innerText = data.deals;
        document.getElementById('stat-reports').innerText = data.reports;

        if (data.reports > 0) {
            const badge = document.getElementById('badge-reports');
            badge.style.display = 'inline-block';
            badge.innerText = data.reports;
        }
    } catch (e) { console.error(e); }
}

async function loadUsers() {
    const tbody = document.getElementById('users-table');
    tbody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
    
    try {
        const res = await fetch('/api/admin/users');
        const users = await res.json();
        tbody.innerHTML = '';

        users.forEach(user => {
            const date = new Date(user.created_at).toLocaleDateString();
            const role = user.is_admin ? '<span class="badge badge-resolved">Админ</span>' : 'Юзер';
            
            tbody.innerHTML += `
                <tr>
                    <td>#${user.id}</td>
                    <td>
                        <div style="font-weight:600">${user.full_name || user.username}</div>
                        <div style="font-size:12px;color:#999">@${user.username}</div>
                    </td>
                    <td>${user.email}</td>
                    <td>${role}</td>
                    <td>${date}</td>
                    <td>
                        ${!user.is_admin ? `<button class="action-btn btn-trash" onclick="banUser(${user.id})" title="Удалить"><i class='bx bx-trash'></i></button>` : ''}
                    </td>
                </tr>
            `;
        });
    } catch (e) { tbody.innerHTML = '<tr><td colspan="6">Ошибка</td></tr>'; }
}

async function banUser(id) {
    if(!confirm('Удалить пользователя и все его данные?')) return;
    try {
        await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
        loadUsers();
    } catch(e) { alert('Ошибка'); }
}

async function loadReports() {
    const tbody = document.getElementById('reports-table');
    tbody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
    
    try {
        const res = await fetch('/api/admin/reports');
        const reports = await res.json();
        tbody.innerHTML = '';

        if(reports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Нет жалоб</td></tr>';
            return;
        }

        reports.forEach(r => {
            const statusClass = r.status === 'pending' ? 'badge-pending' : (r.status === 'resolved' ? 'badge-resolved' : 'badge-dismissed');
            const statusText = r.status === 'pending' ? 'Новая' : (r.status === 'resolved' ? 'Решено' : 'Отклонено');
            
            // Кнопки только для pending
            let actions = '';
            if (r.status === 'pending') {
                actions = `
                    <button class="action-btn btn-trash" onclick="resolveReport(${r.id}, 'delete_listing')" title="Удалить объявление"><i class='bx bx-trash'></i></button>
                    <button class="action-btn btn-check" onclick="resolveReport(${r.id}, 'dismiss')" title="Отклонить жалобу"><i class='bx bx-check'></i></button>
                `;
            }

            tbody.innerHTML += `
                <tr>
                    <td>#${r.id}</td>
                    <td><span style="font-weight:600">${r.reason}</span></td>
                    <td>
                        <a href="/listing.html?id=${r.listing_id}" target="_blank" style="color:var(--primary-color)">
                            ${r.listing_title || 'Удалено'}
                        </a>
                    </td>
                    <td>${r.comment || '-'}</td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                    <td>${actions}</td>
                </tr>
            `;
        });
    } catch (e) { tbody.innerHTML = '<tr><td colspan="6">Ошибка</td></tr>'; }
}

async function resolveReport(id, action) {
    if(!confirm(action === 'delete_listing' ? 'Удалить объявление?' : 'Отклонить жалобу?')) return;
    try {
        await fetch('/api/admin/reports/resolve', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ reportId: id, action })
        });
        loadReports();
        loadStats(); // Обновить счетчики
    } catch(e) { alert('Ошибка'); }
}