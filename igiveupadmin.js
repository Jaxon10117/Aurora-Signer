let allUsers = []; // Store all users

async function apiCall(action, payload) {
    try {
        const response = await fetch('https://admin.aurorasigner.xyz/api.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...payload }),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`Error during API call: ${error}`);
        alert(`An error occurred: ${error.message}`);
        throw error; // Rethrow for further handling if needed
    }
}

async function loadUsers(page = 1, limit = 10) {
    console.log('loadUsers called');
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser || !currentUser.isDev) {
        console.error('Unauthorized access to admin panel');
        return;
    }

    const adminPanel = document.getElementById('adminPanel');
    if (!adminPanel || adminPanel.classList.contains('hidden')) return;

    const userList = document.getElementById('adminUserList');
    if (!userList) {
        console.error('Admin user list element not found');
        return;
    }

    try {
        console.log('Fetching users...');
        const result = await apiCall('getAllUsers', {});
        console.log('API Response:', result);
        allUsers = result.users || []; // Ensure we handle the response correctly
        console.log('Fetched users:', allUsers);
        if (!allUsers || !Array.isArray(allUsers) || allUsers.length === 0) {
            console.log('No users found or invalid user data');
            userList.innerHTML = '<p>No users found.</p>';
            return;
        }
        filterAndDisplayUsers();
    } catch (error) {
        console.error('Error loading users:', error);
        userList.innerHTML = '<p>Error loading users. Please try again later.</p>';
    }
}

function filterAndDisplayUsers() {
    const userList = document.getElementById('adminUserList');
    if (!userList) {
        console.error('Admin user list element not found');
        return;
    }

    const searchTerm = document.getElementById('adminUserSearch')?.value.toLowerCase() || '';
    const premiumFilter = document.getElementById('premiumFilter')?.value || 'all';
    const devFilter = document.getElementById('devFilter')?.value || 'all';
    const dateFilter = document.getElementById('dateFilter')?.value || 'all';

    const filteredUsers = allUsers.filter(user => {
        const matchesSearch = searchTerm === '' || user.username.toLowerCase().includes(searchTerm);
        const matchesPremium = premiumFilter === 'all' || 
            (premiumFilter === 'yes' && user.premium) || 
            (premiumFilter === 'no' && !user.premium);
        const matchesDev = devFilter === 'all' || 
            (devFilter === 'yes' && user.isDev) || 
            (devFilter === 'no' && !user.isDev);
        const userDate = new Date(user.createdAt);
        const matchesDate = dateFilter === 'all' || 
            (dateFilter === 'lastWeek' && isWithinLastWeek(userDate)) ||
            (dateFilter === 'lastMonth' && isWithinLastMonth(userDate)) ||
            (dateFilter === 'lastYear' && isWithinLastYear(userDate));

        return matchesSearch && matchesPremium && matchesDev && matchesDate;
    });

    userList.innerHTML = filteredUsers.map(user => `
        <div class="user-item">
            <span>${user.username}</span>
            <span class="user-status">
                ${user.premium ? '<span class="premium-badge">Premium</span>' : ''}
                ${user.isDev ? '<span class="dev-badge">Dev</span>' : ''}
            </span>
            <span class="user-date">Registered: ${new Date(user.createdAt).toLocaleDateString()}</span>
            <button onclick="toggleUserOptions(${user.id})">Options</button>
            <div id="userOptions-${user.id}" class="user-options hidden">
                <button onclick="togglePremium(${user.id}, ${user.premium})">
                    ${user.premium ? 'Remove Premium' : 'Add Premium'}
                </button>
                <button onclick="toggleDev(${user.id}, ${user.isDev})">
                    ${user.isDev ? 'Remove Dev' : 'Make Dev'}
                </button>
                <button onclick="changePassword(${user.id})">Change Password</button>
                <button onclick="deleteUser(${user.id})">Delete User</button>
                <button onclick="revealPassword(${user.id})">Reveal Password</button>
                <button onclick="downloadLogs()">Download Logs</button>
            </div>
        </div>
    `).join('');
}

// Make sure this event listener is added only once
document.addEventListener('DOMContentLoaded', () => {
    const devButton = document.getElementById('devButton');
    if (devButton) {
        devButton.removeEventListener('click', toggleAdminPanel);
        devButton.addEventListener('click', toggleAdminPanel);
    }

    const userSearch = document.getElementById('adminUserSearch');
    if (userSearch) {
        userSearch.removeEventListener('input', filterAndDisplayUsers);
        userSearch.addEventListener('input', debounce(filterAndDisplayUsers, 300)); // 300ms debounce
    }

    const filterSelects = document.querySelectorAll('#adminPanel select');
    filterSelects.forEach(select => {
        select.removeEventListener('change', filterAndDisplayUsers);
        select.addEventListener('change', filterAndDisplayUsers);
    });

    // Add real-time filtering for all inputs
    const allInputs = document.querySelectorAll('#adminPanel input, #adminPanel select');
    allInputs.forEach(input => {
        input.addEventListener('input', filterAndDisplayUsers);
    });
});

function toggleAdminPanel() {
    const adminPanel = document.getElementById('adminPanel');
    if (!adminPanel) {
        console.error('Admin panel element not found');
        return;
    }
    adminPanel.classList.toggle('hidden');
    if (!adminPanel.classList.contains('hidden')) {
        loadUsers();
    }
}

function toggleUserOptions(userId) {
    const optionsDiv = document.getElementById(`userOptions-${userId}`);
    optionsDiv.classList.toggle('hidden');
}

async function togglePremium(id, currentStatus) {
    console.log(`Toggling premium status for user ID: ${id}, current status: ${currentStatus}`);
    
    try {
        const result = await apiCall('updateUser', { id, updateData: { premium: currentStatus ? 0 : 1 } }); // Send the correct payload
        if (result.success) {
            console.log('Premium status updated successfully');
            loadUsers();
        } else {
            console.error('Failed to update premium status:', result.error);
        }
    } catch (error) {
        console.error('Error toggling premium status:', error);
    }
}

async function toggleDev(id, currentStatus) {
    try {
        const result = await apiCall('updateUser', { id, updateData: { isDev: currentStatus ? 0 : 1 } }); // Send the correct payload
        if (result.success) {
            loadUsers();
        } else {
            console.error('Failed to update dev status:', result.error);
        }
    } catch (error) {
        console.error('Error toggling dev status:', error);
    }
}

async function resetPassword(id) {
    const result = await db.updateUser(id, { password: null });
    if (result) alert('Password reset. User can now log in with any password.');
}

async function deleteUser(id) {
    if (confirm('Are you sure you want to delete this user?')) {
        try {
            const result = await apiCall('deleteUser', { id });
            if (result.success) {
                loadUsers(); // Reload users after deletion
                alert('User deleted successfully.');
            } else {
                console.error('Failed to delete user:', result.error);
                alert('Error deleting user: ' + result.error);
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('An error occurred while trying to delete the user.');
        }
    }
}

async function changePassword(id) {
    const newPassword = prompt("Enter new password for the user:");
    if (newPassword) {
        if (newPassword.length < 8) {
            alert("Password must be at least 8 characters long.");
            return;
        }
        // Validate that the password meets other criteria if necessary
        try {
            const result = await apiCall('updateUser', { id, updateData: { password: newPassword } });
            if (result.success) {
                alert('Password changed successfully.');
                loadUsers();
            } else {
                alert('Failed to change password.');
            }
        } catch (error) {
            console.error('Error changing password:', error);
        }
    }
}

async function viewUserStats(id) {
    try {
        const stats = await db.getUserStats(id);
        alert(`User Statistics:\nTotal Sign-ins: ${stats.totalSignIns}\nLast Login: ${stats.lastLogin}\nIPAs Signed: ${stats.ipasSigned}`);
    } catch (error) {
        console.error('Error fetching user stats:', error);
        alert('Failed to fetch user statistics.');
    }
}

async function toggleBan(id, currentStatus) {
    const result = await db.updateUser(id, { isBanned: !currentStatus });
    if (result) {
        alert(`User ${currentStatus ? 'unbanned' : 'banned'} successfully.`);
        loadUsers();
    } else {
        alert('Failed to update user ban status.');
    }
}

async function exportUserData(id) {
    try {
        const userData = await db.getUserData(id);
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(userData));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `user_${id}_data.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    } catch (error) {
        console.error('Error exporting user data:', error);
        alert('Failed to export user data.');
    }
}

function checkAdminPanel() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const adminPanel = document.getElementById('adminPanel');
    const devButton = document.getElementById('devButton');

    if (currentUser && currentUser.isDev) {
        devButton.classList.remove('hidden');
        devButton.removeEventListener('click', toggleAdminPanel);
        devButton.addEventListener('click', toggleAdminPanel);
    } else {
        devButton.classList.add('hidden');
        if (adminPanel) {
            adminPanel.classList.add('hidden');
        }
    }
}

async function revealPassword(id) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    if (!currentUser || !currentUser.isDev) {
        alert('You do not have permission to reveal passwords.');
        return;
    }

    try {
        const data = await apiCall('revealPassword', { id });
        if (data.success) {
            alert(`User's password: ${data.password}`);
        } else {
            alert('Failed to reveal password: ' + (data.error || 'Unknown error.'));
        }
    } catch (error) {
        console.error('Error revealing password:', error);
        alert('An error occurred while trying to reveal the password.');
    }
}

function isWithinLastWeek(date) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return date >= oneWeekAgo;
}

function isWithinLastMonth(date) {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    return date >= oneMonthAgo;
}

function isWithinLastYear(date) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return date >= oneYearAgo;
}

window.toggleAdminPanel = toggleAdminPanel;

async function downloadLogs() {
    try {
        const data = await apiCall('getLogsAndStats');
        
        if (data.success) {
            const csvContent = generateCSV(data.logs, data.stats);
            downloadCSV(csvContent, 'logs_and_stats.csv');
        } else {
            throw new Error(data.error || 'Unknown error occurred');
        }
    } catch (error) {
        console.error('Error fetching logs and statistics:', error);
    }
}

function generateCSV(logs, stats) {
    let csvContent = "data:text/csv;charset=utf-8,";

    // Add usage statistics
    csvContent += "Usage Statistics\n";
    csvContent += "Date,IPAs Signed\n";
    Object.entries(stats).forEach(([date, count]) => {
        csvContent += `${date},${count}\n`;
    });

    csvContent += "\nActivity Logs\n";
    csvContent += "Timestamp,User,Action,Details\n";
    logs.forEach(log => {
        csvContent += `${log.timestamp},${log.username || 'N/A'},${log.action},${log.details}\n`;
    });

    return csvContent;
}

function downloadCSV(content, fileName) {
    const encodedUri = encodeURI(content);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}
