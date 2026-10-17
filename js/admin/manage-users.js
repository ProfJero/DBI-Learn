import { auth } from '../firebase-config.js';
import { 
    db, 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc,
    getDoc,
    orderBy,
    limit,
    startAfter,
    serverTimestamp 
} from '../firebase-config.js';

// State management
let currentUser = null;
let currentUserData = null;
let users = [];
let filteredUsers = [];
let currentPage = 1;
let pageSize = 10;
let lastVisible = null;
let firstVisible = null;
let filters = {
    role: 'all',
    status: 'all',
    search: ''
};

// Check authentication and admin status
async function checkAuth() {
    return new Promise((resolve, reject) => {
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = '../login.html';
                return;
            }
            
            currentUser = user;
            
            try {
                // Get user data from Firestore
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (!userDoc.exists()) {
                    window.location.href = '../login.html';
                    return;
                }
                
                currentUserData = userDoc.data();
                
                // Check if user is admin or super admin
                if (currentUserData.role !== 'admin' && currentUserData.role !== 'super_admin') {
                    window.location.href = '../dashboard.html';
                    return;
                }
                
                // Update UI with user info
                updateUserInfo(currentUserData);
                
                // Load users
                await loadUsers();
                
                resolve();
            } catch (error) {
                console.error('Auth check error:', error);
                reject(error);
            }
        });
    });
}

// Update UI with user info
function updateUserInfo(userData) {
    const sidebarInitials = document.getElementById('sidebarUserInitials');
    const sidebarName = document.getElementById('sidebarUserName');
    const sidebarRole = document.getElementById('sidebarUserRole');
    
    if (userData.fullName) {
        const names = userData.fullName.split(' ');
        const initials = names.map(n => n[0]).join('').toUpperCase().substring(0, 2);
        if (sidebarInitials) sidebarInitials.textContent = initials;
        if (sidebarName) sidebarName.textContent = userData.fullName;
    }
    
    if (sidebarRole) {
        if (userData.role === 'super_admin') {
            sidebarRole.textContent = 'Super Admin';
        } else {
            sidebarRole.textContent = 'Admin';
        }
    }
}

// Load users from Firestore
async function loadUsers() {
    try {
        const usersRef = collection(db, 'users');
        let q = query(usersRef, orderBy('createdAt', 'desc'));
        
        // Apply filters
        if (filters.role !== 'all') {
            q = query(q, where('role', '==', filters.role));
        }
        
        if (filters.status !== 'all') {
            q = query(q, where('status', '==', filters.status));
        }
        
        const querySnapshot = await getDocs(q);
        users = [];
        querySnapshot.forEach((doc) => {
            users.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Apply search filter
        applySearchFilter();
        
        // Update stats
        updateStats();
        
        // Render table
        renderTable();
        
        // Update pending count
        updatePendingCount();
        
    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('Failed to load users', 'error');
    }
}

// Apply search filter
function applySearchFilter() {
    if (!filters.search) {
        filteredUsers = [...users];
    } else {
        const searchLower = filters.search.toLowerCase();
        filteredUsers = users.filter(user => 
            (user.fullName && user.fullName.toLowerCase().includes(searchLower)) ||
            (user.username && user.username.toLowerCase().includes(searchLower)) ||
            (user.email && user.email.toLowerCase().includes(searchLower))
        );
    }
}

// Update statistics
function updateStats() {
    const totalUsersEl = document.getElementById('totalUsers');
    const totalStudentsEl = document.getElementById('totalStudents');
    const totalInstructorsEl = document.getElementById('totalInstructors');
    const totalPendingEl = document.getElementById('totalPending');
    
    if (totalUsersEl) totalUsersEl.textContent = users.length;
    if (totalStudentsEl) totalStudentsEl.textContent = users.filter(u => u.role === 'student').length;
    if (totalInstructorsEl) totalInstructorsEl.textContent = users.filter(u => u.role === 'instructor').length;
    if (totalPendingEl) totalPendingEl.textContent = users.filter(u => u.status === 'pending').length;
}

// Update pending count badge
async function updatePendingCount() {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('status', '==', 'pending'));
        const snapshot = await getDocs(q);
        const pendingCountEl = document.getElementById('pendingCount');
        if (pendingCountEl) {
            pendingCountEl.textContent = snapshot.size;
        }
    } catch (error) {
        console.error('Error updating pending count:', error);
    }
}

// Render users table
function renderTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageUsers = filteredUsers.slice(start, end);
    
    if (pageUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                    No users found
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = pageUsers.map(user => `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <div class="h-10 w-10 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                            ${getInitials(user.fullName || user.username)}
                        </div>
                        <div class="ml-3">
                            <p class="text-sm font-medium text-gray-800">${user.fullName || 'No name'}</p>
                            <p class="text-xs text-gray-500">${user.email || 'No email'}</p>
                            <p class="text-xs text-gray-400">@${user.username || 'unknown'}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="role-badge ${getRoleClass(user.role)}">
                        ${formatRole(user.role)}
                    </span>
                </td>
                <td class="px-6 py-4">
                    <span class="status-badge ${getStatusClass(user.status)}">
                        ${user.status || 'unknown'}
                    </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">
                    ${formatDate(user.createdAt)}
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">
                    ${formatDate(user.lastLogin)}
                </td>
                <td class="px-6 py-4">
                    <div class="flex space-x-2">
                        <button onclick="viewUser('${user.id}')" class="text-purple-600 hover:text-purple-800">
                            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                            </svg>
                        </button>
                        
                        ${user.status === 'pending' ? `
                            <button onclick="approveUser('${user.id}')" class="text-green-600 hover:text-green-800">
                                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                            </button>
                            
                            <button onclick="rejectUser('${user.id}')" class="text-red-600 hover:text-red-800">
                                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        ` : ''}
                        
                        ${currentUserData && currentUserData.role === 'super_admin' && user.role !== 'super_admin' ? `
                            <button onclick="deleteUser('${user.id}')" class="text-red-600 hover:text-red-800">
                                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    // Update pagination
    updatePagination();
}

// Helper functions
function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function getRoleClass(role) {
    switch(role) {
        case 'super_admin': return 'role-super-admin';
        case 'admin': return 'role-admin';
        case 'instructor': return 'role-instructor';
        default: return 'role-student';
    }
}

function getStatusClass(status) {
    switch(status) {
        case 'active': return 'status-active';
        case 'pending': return 'status-pending';
        case 'rejected': return 'status-rejected';
        default: return 'status-pending';
    }
}

function formatRole(role) {
    switch(role) {
        case 'super_admin': return 'Super Admin';
        case 'admin': return 'Admin';
        case 'instructor': return 'Instructor';
        default: return 'Student';
    }
}

function formatDate(timestamp) {
    if (!timestamp) return 'Never';
    
    // Handle Firestore timestamps
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
}

function updatePagination() {
    const startCountEl = document.getElementById('startCount');
    const endCountEl = document.getElementById('endCount');
    const totalCountEl = document.getElementById('totalCount');
    const pageInfoEl = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    const total = filteredUsers.length;
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(start + pageSize - 1, total);
    
    if (startCountEl) startCountEl.textContent = total ? start : 0;
    if (endCountEl) endCountEl.textContent = total ? end : 0;
    if (totalCountEl) totalCountEl.textContent = total;
    if (pageInfoEl) pageInfoEl.textContent = `Page ${currentPage} of ${Math.ceil(total / pageSize) || 1}`;
    
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = end >= total;
}

// Show notification
function showNotification(message, type = 'info') {
    // You can implement a toast notification here
    alert(message); // Simple alert for now
}

// View user details
window.viewUser = async (userId) => {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) return;
        
        const user = userDoc.data();
        
        const modalContent = document.getElementById('userModalContent');
        if (!modalContent) return;
        
        modalContent.innerHTML = `
            <div class="space-y-4">
                <div class="flex items-center">
                    <div class="h-16 w-16 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-xl">
                        ${getInitials(user.fullName || user.username)}
                    </div>
                    <div class="ml-4">
                        <h3 class="text-lg font-semibold">${user.fullName || 'No name'}</h3>
                        <p class="text-sm text-gray-600">@${user.username}</p>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-xs text-gray-500">Email</p>
                        <p class="text-sm font-medium">${user.email || 'Not provided'}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Phone</p>
                        <p class="text-sm font-medium">${user.phone || 'Not provided'}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Role</p>
                        <p class="text-sm font-medium">${formatRole(user.role)}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Status</p>
                        <p class="text-sm font-medium capitalize">${user.status || 'unknown'}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Joined</p>
                        <p class="text-sm font-medium">${formatDate(user.createdAt)}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Last Login</p>
                        <p class="text-sm font-medium">${formatDate(user.lastLogin)}</p>
                    </div>
                </div>
                
                ${user.role === 'instructor' ? `
                    <div class="border-t pt-4">
                        <h4 class="font-semibold mb-2">Instructor Details</h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <p class="text-xs text-gray-500">Department</p>
                                <p class="text-sm">${user.department || 'Not specified'}</p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-500">Experience</p>
                                <p class="text-sm">${user.experience || 'Not specified'}</p>
                            </div>
                        </div>
                        <div class="mt-2">
                            <p class="text-xs text-gray-500">Bio</p>
                            <p class="text-sm">${user.bio || 'No bio provided'}</p>
                        </div>
                    </div>
                ` : ''}
                
                ${user.role === 'student' ? `
                    <div class="border-t pt-4">
                        <h4 class="font-semibold mb-2">Student Details</h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <p class="text-xs text-gray-500">School</p>
                                <p class="text-sm">${user.school || 'Not specified'}</p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-500">Grade</p>
                                <p class="text-sm">${user.grade || 'Not specified'}</p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-500">Gender</p>
                                <p class="text-sm">${user.gender || 'Not specified'}</p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-500">Location</p>
                                <p class="text-sm">${user.location || 'Not specified'}</p>
                            </div>
                        </div>
                        <div class="mt-2">
                            <p class="text-xs text-gray-500">Interests</p>
                            <div class="flex flex-wrap gap-2 mt-1">
                                ${user.interests?.map(interest => 
                                    `<span class="px-2 py-1 bg-gray-100 text-xs rounded-full">${interest}</span>`
                                ).join('') || 'None specified'}
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        const modal = document.getElementById('userModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error viewing user:', error);
        showNotification('Failed to load user details', 'error');
    }
};

// Close modal
window.closeUserModal = () => {
    const modal = document.getElementById('userModal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

// Approve user
window.approveUser = async (userId) => {
    if (!confirm('Are you sure you want to approve this user?')) return;
    
    try {
        await updateDoc(doc(db, 'users', userId), {
            status: 'active',
            reviewedBy: currentUser.uid,
            reviewedAt: serverTimestamp()
        });
        
        showNotification('User approved successfully', 'success');
        await loadUsers();
    } catch (error) {
        console.error('Error approving user:', error);
        showNotification('Failed to approve user', 'error');
    }
};

// Reject user
window.rejectUser = async (userId) => {
    const reason = prompt('Please enter rejection reason:');
    if (reason === null) return;
    
    try {
        await updateDoc(doc(db, 'users', userId), {
            status: 'rejected',
            rejectionReason: reason,
            reviewedBy: currentUser.uid,
            reviewedAt: serverTimestamp()
        });
        
        showNotification('User rejected', 'success');
        await loadUsers();
    } catch (error) {
        console.error('Error rejecting user:', error);
        showNotification('Failed to reject user', 'error');
    }
};

// Delete user
window.deleteUser = async (userId) => {
    if (!confirm('WARNING: This will permanently delete the user. Are you sure?')) return;
    
    try {
        await deleteDoc(doc(db, 'users', userId));
        showNotification('User deleted successfully', 'success');
        await loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Failed to delete user', 'error');
    }
};

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await checkAuth();
        
        // Mobile menu
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        
        if (mobileMenuBtn && sidebar && sidebarOverlay) {
            mobileMenuBtn.addEventListener('click', () => {
                sidebar.classList.toggle('-translate-x-full');
                sidebarOverlay.classList.toggle('hidden');
            });
            
            sidebarOverlay.addEventListener('click', () => {
                sidebar.classList.add('-translate-x-full');
                sidebarOverlay.classList.add('hidden');
            });
        }
        
        // Logout - Check for both possible IDs
        const logoutBtn = document.getElementById('logoutBtn') || document.getElementById('sidebarLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    await auth.signOut();
                    window.location.href = '../login.html';
                } catch (error) {
                    console.error('Logout error:', error);
                }
            });
        }
        
        // Filters
        const applyFiltersBtn = document.getElementById('applyFilters');
        const resetFiltersBtn = document.getElementById('resetFilters');
        const roleFilter = document.getElementById('roleFilter');
        const statusFilter = document.getElementById('statusFilter');
        const searchInput = document.getElementById('searchInput');
        
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                if (roleFilter) filters.role = roleFilter.value;
                if (statusFilter) filters.status = statusFilter.value;
                if (searchInput) filters.search = searchInput.value;
                currentPage = 1;
                applySearchFilter();
                renderTable();
            });
        }
        
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => {
                if (roleFilter) roleFilter.value = 'all';
                if (statusFilter) statusFilter.value = 'all';
                if (searchInput) searchInput.value = '';
                filters = { role: 'all', status: 'all', search: '' };
                currentPage = 1;
                filteredUsers = [...users];
                renderTable();
            });
        }
        
        // Search input with debounce
        let searchTimeout;
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    filters.search = e.target.value;
                    currentPage = 1;
                    applySearchFilter();
                    renderTable();
                }, 500);
            });
        }
        
        // Pagination
        const prevPage = document.getElementById('prevPage');
        const nextPage = document.getElementById('nextPage');
        
        if (prevPage) {
            prevPage.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderTable();
                }
            });
        }
        
        if (nextPage) {
            nextPage.addEventListener('click', () => {
                if (currentPage * pageSize < filteredUsers.length) {
                    currentPage++;
                    renderTable();
                }
            });
        }
        
    } catch (error) {
        console.error('Initialization error:', error);
    }
});

// Make functions available globally
window.viewUser = viewUser;
window.closeUserModal = closeUserModal;
window.approveUser = approveUser;
window.rejectUser = rejectUser;
window.deleteUser = deleteUser;