import { 
    auth, 
    signOut,
    db,
    doc,
    getDoc,
    setDoc,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    onAuthStateChanged,
    orderBy,
    limit,
    startAfter,
    createUserWithEmailAndPassword,
    updatePassword
} from '../firebase-config.js';

let currentAdmin = null;
let allUsers = [];
let filteredUsers = [];
let currentPage = 1;
const itemsPerPage = 10;
let lastDoc = null;
let currentFilter = 'all';
let searchTerm = '';

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../login.html';
    } else {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            const userRole = userDoc.data().role;
            if (userRole !== 'admin' && userRole !== 'super_admin') {
                window.location.href = '../../student/dashboard.html';
                return;
            }
        }
        currentAdmin = user;
        await loadAdminData(user.uid);
        await loadUsers();
        await loadNotifications(user.uid);
        await loadPendingCount();
    }
});

// Load admin data
async function loadAdminData(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const adminData = userDoc.data();
            document.getElementById('adminName').textContent = adminData.fullName || 'Administrator';
            document.getElementById('adminRole').textContent = adminData.role === 'super_admin' ? 'Super Administrator' : 'Administrator';
            
            const avatarName = encodeURIComponent(adminData.fullName || 'Admin');
            const avatarUrl = `https://ui-avatars.com/api/?background=1e88e5&color=fff&bold=true&size=40&name=${avatarName}`;
            document.getElementById('adminAvatar').src = avatarUrl;
            document.getElementById('dropdownAvatar').src = avatarUrl;
        }
    } catch (error) {
        console.error('Error loading admin data:', error);
    }
}

// Load all users
async function loadUsers() {
    try {
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        
        allUsers = [];
        usersSnapshot.forEach(doc => {
            const user = { id: doc.id, ...doc.data() };
            // Don't include current admin in the list for editing
            if (user.id !== currentAdmin.uid) {
                allUsers.push(user);
            }
        });
        
        // Sort by join date (newest first)
        allUsers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        applyFilters();
        
    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Failed to load users', 'error');
    }
}

// Apply filters and search
function applyFilters() {
    filteredUsers = [...allUsers];
    
    // Apply role filter
    if (currentFilter !== 'all') {
        filteredUsers = filteredUsers.filter(user => user.role === currentFilter);
    }
    
    // Apply search
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredUsers = filteredUsers.filter(user => 
            user.fullName?.toLowerCase().includes(term) ||
            user.email?.toLowerCase().includes(term) ||
            user.username?.toLowerCase().includes(term)
        );
    }
    
    // Update pagination
    updatePagination();
    displayUsers();
}

// Update pagination info
function updatePagination() {
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, filteredUsers.length);
    
    document.getElementById('paginationInfo').textContent = `Showing ${start}-${end} of ${filteredUsers.length} users`;
    document.getElementById('currentPage').textContent = `Page ${currentPage}`;
    
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages || totalPages === 0;
}

// Display users in table
function displayUsers() {
    const tbody = document.getElementById('usersTableBody');
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageUsers = filteredUsers.slice(start, end);
    
    if (pageUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-8 text-gray-500">
                    <i class="fas fa-users text-4xl text-gray-300 mb-2"></i>
                    <p>No users found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = pageUsers.map(user => `
        <tr>
            <td>
                <div class="flex items-center space-x-3">
                    <img src="https://ui-avatars.com/api/?background=1e88e5&color=fff&size=32&name=${encodeURIComponent(user.fullName || 'User')}" 
                         class="w-8 h-8 rounded-full">
                    <div>
                        <p class="font-medium text-gray-800">${escapeHtml(user.fullName || 'Unnamed')}</p>
                        <p class="text-xs text-gray-500">@${escapeHtml(user.username || 'no-username')}</p>
                    </div>
                </div>
            </td>
            <td><span class="role-${user.role}">${user.role === 'student' ? 'Student' : user.role === 'instructor' ? 'Instructor' : 'Admin'}</span></td>
            <td class="text-gray-600">${escapeHtml(user.email || '-')}</td>
            <td><span class="status-${user.status || 'active'}">${user.status || 'Active'}</span></td>
            <td class="text-sm text-gray-500">${formatDate(user.createdAt)}</td>
            <td class="text-sm text-gray-500">${user.lastLogin ? formatDate(user.lastLogin) : 'Never'}</td>
            <td>
                <div class="flex space-x-2">
                    <button onclick="window.viewUserDetails('${user.id}')" class="text-green-500 hover:text-green-700 transition" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="window.editUser('${user.id}')" class="text-blue-500 hover:text-blue-700 transition" title="Edit User">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="window.deleteUser('${user.id}', '${escapeHtml(user.fullName)}')" class="text-red-500 hover:text-red-700 transition" title="Delete User">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// View user details
window.viewUserDetails = async (userId) => {
    try {
        // Get user data to check role
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Redirect based on user role
            if (userData.role === 'student') {
                window.location.href = `student-details.html?id=${userId}`;
            } else if (userData.role === 'instructor') {
                window.location.href = `instructor-details.html?id=${userId}`;
            } else if (userData.role === 'admin') {
                window.location.href = `admin-details.html?id=${userId}`;
            } else {
                showToast('User type not recognized', 'error');
            }
        } else {
            showToast('User not found', 'error');
        }
    } catch (error) {
        console.error('Error viewing user details:', error);
        showToast('Failed to load user details', 'error');
    }
};

// Format date
function formatDate(date) {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Load pending count
async function loadPendingCount() {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', 'instructor'), where('status', '==', 'pending'));
        const snapshot = await getDocs(q);
        document.getElementById('pendingCount').textContent = snapshot.size;
    } catch (error) {
        console.error('Error loading pending count:', error);
    }
}

// Add/Edit user modal
function setupUserModal() {
    const addBtn = document.getElementById('addUserBtn');
    const modal = document.getElementById('userModal');
    const closeBtn = document.getElementById('closeModalBtn');
    const form = document.getElementById('userForm');
    let isEditing = false;
    
    addBtn.addEventListener('click', () => {
        isEditing = false;
        document.getElementById('modalTitle').textContent = 'Add New User';
        form.reset();
        document.getElementById('userId').value = '';
        document.getElementById('userPassword').placeholder = 'Enter password for new user';
        document.getElementById('userPassword').required = true;
        modal.classList.remove('hidden');
    });
    
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const userId = document.getElementById('userId').value;
        const fullName = document.getElementById('userFullName').value.trim();
        const email = document.getElementById('userEmail').value.trim();
        const username = document.getElementById('userUsername').value.trim();
        const password = document.getElementById('userPassword').value;
        const role = document.getElementById('userRole').value;
        const status = document.getElementById('userStatus').value;
        
        if (!fullName || !email || !username) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        try {
            if (userId) {
                // Update existing user
                const userRef = doc(db, 'users', userId);
                const updateData = {
                    fullName,
                    email,
                    username,
                    usernameLower: username.toLowerCase(),
                    role,
                    status,
                    updatedAt: new Date().toISOString(),
                    updatedBy: currentAdmin.uid
                };
                
                if (password) {
                    updateData.passwordUpdated = true;
                }
                
                await updateDoc(userRef, updateData);
                showToast('User updated successfully', 'success');
                
            } else {
                // Create new user
                if (!password) {
                    showToast('Password is required for new users', 'error');
                    return;
                }
                
                // Create auth user
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const newUser = userCredential.user;
                
                // Create user document
                const userData = {
                    userId: newUser.uid,
                    fullName,
                    username,
                    usernameLower: username.toLowerCase(),
                    email,
                    role,
                    status,
                    createdAt: new Date().toISOString(),
                    createdBy: currentAdmin.uid,
                    profileComplete: true
                };
                
                await setDoc(doc(db, 'users', newUser.uid), userData);
                showToast('User created successfully', 'success');
            }
            
            modal.classList.add('hidden');
            await loadUsers();
            
        } catch (error) {
            console.error('Error saving user:', error);
            showToast(error.message || 'Failed to save user', 'error');
        }
    });
}

// Edit user
window.editUser = async (userId) => {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    const modal = document.getElementById('userModal');
    document.getElementById('modalTitle').textContent = 'Edit User';
    document.getElementById('userId').value = user.id;
    document.getElementById('userFullName').value = user.fullName || '';
    document.getElementById('userEmail').value = user.email || '';
    document.getElementById('userUsername').value = user.username || '';
    document.getElementById('userRole').value = user.role || 'student';
    document.getElementById('userStatus').value = user.status || 'active';
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').placeholder = 'Leave blank to keep current password';
    document.getElementById('userPassword').required = false;
    
    modal.classList.remove('hidden');
};

// Delete user
window.deleteUser = async (userId, userName) => {
    const modal = document.getElementById('deleteModal');
    document.getElementById('deleteUserName').textContent = `User: ${userName}`;
    modal.classList.remove('hidden');
    
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    
    const handleConfirm = async () => {
        try {
            // Delete user document
            await deleteDoc(doc(db, 'users', userId));
            
            showToast('User deleted successfully', 'success');
            modal.classList.add('hidden');
            await loadUsers();
            
        } catch (error) {
            console.error('Error deleting user:', error);
            showToast('Failed to delete user', 'error');
        }
        
        cleanup();
    };
    
    const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', cleanup);
    };
    
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', cleanup);
};

// Close delete modal
document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => {
    document.getElementById('deleteModal').classList.add('hidden');
});

// Setup filters
function setupFilters() {
    const filterBtns = document.querySelectorAll('.role-filter');
    const searchInput = document.getElementById('searchInput');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => {
                b.classList.remove('bg-[#1e88e5]', 'text-white');
                b.classList.add('bg-gray-100', 'text-gray-700');
            });
            btn.classList.add('bg-[#1e88e5]', 'text-white');
            btn.classList.remove('bg-gray-100', 'text-gray-700');
            
            currentFilter = btn.dataset.role;
            currentPage = 1;
            applyFilters();
        });
    });
    
    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        currentPage = 1;
        applyFilters();
    });
}

// Pagination
function setupPagination() {
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayUsers();
            updatePagination();
        }
    });
    
    document.getElementById('nextPage').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            displayUsers();
            updatePagination();
        }
    });
}

// Load notifications
async function loadNotifications(userId) {
    try {
        const notificationsRef = collection(db, 'notifications');
        const q = query(notificationsRef, where('userId', '==', userId), where('read', '==', false));
        const snapshot = await getDocs(q);
        document.getElementById('notificationCount').textContent = snapshot.size;
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// Sidebar toggle
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    const mainContent = document.getElementById('mainContent');
    let isCollapsed = false;
    
    const savedState = localStorage.getItem('adminSidebarCollapsed');
    if (savedState === 'true') toggleSidebar(true);
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => toggleSidebar(!isCollapsed));
    }
    
    function toggleSidebar(collapse) {
        isCollapsed = collapse;
        if (isCollapsed) {
            sidebar.classList.remove('sidebar-expanded');
            sidebar.classList.add('sidebar-collapsed');
            mainContent.style.marginLeft = '80px';
            localStorage.setItem('adminSidebarCollapsed', 'true');
            document.querySelectorAll('.nav-text, .admin-info, .logo-text').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.nav-item').forEach(item => {
                const text = item.querySelector('.nav-text')?.innerText;
                if (text) {
                    item.classList.add('tooltip');
                    item.setAttribute('data-tooltip', text);
                }
            });
            toggleBtn.innerHTML = '<i class="fas fa-chevron-right text-xl"></i>';
        } else {
            sidebar.classList.remove('sidebar-collapsed');
            sidebar.classList.add('sidebar-expanded');
            mainContent.style.marginLeft = '280px';
            localStorage.setItem('adminSidebarCollapsed', 'false');
            document.querySelectorAll('.nav-text, .admin-info, .logo-text').forEach(el => el.style.display = '');
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('tooltip');
                item.removeAttribute('data-tooltip');
            });
            toggleBtn.innerHTML = '<i class="fas fa-chevron-left text-xl"></i>';
        }
    }
    
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileOverlay = document.getElementById('mobileOverlay');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.add('mobile-open');
            mobileOverlay.classList.remove('hidden');
        });
    }
    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            mobileOverlay.classList.add('hidden');
        });
    }
}

// Dropdown setup
function setupDropdowns() {
    const adminMenuBtn = document.getElementById('adminMenuBtn');
    const adminDropdown = document.getElementById('adminDropdown');
    
    if (adminMenuBtn) {
        adminMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            adminDropdown?.classList.toggle('hidden');
        });
    }
    
    document.addEventListener('click', (e) => {
        if (adminDropdown && !adminDropdown.contains(e.target) && e.target !== adminMenuBtn) {
            adminDropdown.classList.add('hidden');
        }
    });
}

// Toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in ${
        type === 'success' ? 'bg-green-500 text-white' : 
        type === 'error' ? 'bg-red-500 text-white' : 
        'bg-gray-800 text-white'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Logout
async function logout() {
    try {
        await signOut(auth);
        window.location.href = '../../login.html';
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupUserModal();
    setupFilters();
    setupPagination();
    setupSidebar();
    setupDropdowns();
    
    const logoutBtns = document.querySelectorAll('#logoutBtn, #logoutDropdown');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    });
});

// Add animation style
const style = document.createElement('style');
style.textContent = `
    @keyframes fade-in {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in { animation: fade-in 0.3s ease; }
`;
document.head.appendChild(style);