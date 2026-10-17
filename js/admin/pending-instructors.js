import { auth } from '../firebase-config.js';
import { 
    db, 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    updateDoc, 
    getDoc,
    orderBy,
    serverTimestamp 
} from '../firebase-config.js';

// State management
let currentUser = null;
let currentUserData = null;
let applications = [];
let filteredApplications = [];
let currentPage = 1;
let pageSize = 5;
let currentApplicationId = null;
let filters = {
    status: 'pending',
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
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (!userDoc.exists()) {
                    window.location.href = '../login.html';
                    return;
                }
                
                currentUserData = userDoc.data();
                
                if (currentUserData.role !== 'admin' && currentUserData.role !== 'super_admin') {
                    window.location.href = '../dashboard.html';
                    return;
                }
                
                updateUserInfo(currentUserData);
                await loadApplications();
                
                resolve();
            } catch (error) {
                console.error('Auth check error:', error);
                reject(error);
            }
        });
    });
}

// Update user info in sidebar
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
        sidebarRole.textContent = userData.role === 'super_admin' ? 'Super Admin' : 'Admin';
    }
}

// Load applications from Firestore
async function loadApplications() {
    try {
        const usersRef = collection(db, 'users');
        let q = query(
            usersRef, 
            where('role', '==', 'instructor'),
            orderBy('createdAt', 'desc')
        );
        
        // Apply status filter
        if (filters.status !== 'all') {
            q = query(q, where('status', '==', filters.status));
        }
        
        const querySnapshot = await getDocs(q);
        applications = [];
        querySnapshot.forEach((doc) => {
            applications.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        applySearchFilter();
        updateStats();
        renderApplications();
        updatePendingCount();
        
    } catch (error) {
        console.error('Error loading applications:', error);
        showNotification('Failed to load applications', 'error');
    }
}

// Apply search filter
function applySearchFilter() {
    if (!filters.search) {
        filteredApplications = [...applications];
    } else {
        const searchLower = filters.search.toLowerCase();
        filteredApplications = applications.filter(app => 
            (app.fullName && app.fullName.toLowerCase().includes(searchLower)) ||
            (app.email && app.email.toLowerCase().includes(searchLower)) ||
            (app.username && app.username.toLowerCase().includes(searchLower))
        );
    }
}

// Update statistics
function updateStats() {
    const pendingEl = document.getElementById('pendingApplications');
    const approvedEl = document.getElementById('approvedApplications');
    const rejectedEl = document.getElementById('rejectedApplications');
    const totalEl = document.getElementById('totalApplications');
    
    const pending = applications.filter(a => a.status === 'pending').length;
    const approved = applications.filter(a => a.status === 'active').length;
    const rejected = applications.filter(a => a.status === 'rejected').length;
    
    if (pendingEl) pendingEl.textContent = pending;
    if (approvedEl) approvedEl.textContent = approved;
    if (rejectedEl) rejectedEl.textContent = rejected;
    if (totalEl) totalEl.textContent = applications.length;
}

// Update pending count badge
async function updatePendingCount() {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('status', '==', 'pending'), where('role', '==', 'instructor'));
        const snapshot = await getDocs(q);
        const pendingCountEl = document.getElementById('pendingCount');
        if (pendingCountEl) {
            pendingCountEl.textContent = snapshot.size;
        }
    } catch (error) {
        console.error('Error updating pending count:', error);
    }
}

// Render applications
function renderApplications() {
    const container = document.getElementById('applicationsList');
    if (!container) return;
    
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageApps = filteredApplications.slice(start, end);
    
    if (pageApps.length === 0) {
        container.innerHTML = `
            <div class="p-12 text-center">
                <svg class="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                </svg>
                <p class="text-gray-500 text-lg">No applications found</p>
                <p class="text-gray-400 text-sm mt-2">Applications will appear here when instructors sign up</p>
            </div>
        `;
        updatePagination();
        return;
    }
    
    container.innerHTML = pageApps.map(app => `
        <div class="p-6 hover:bg-gray-50 transition-colors ${app.status === 'pending' ? 'border-l-4 border-yellow-400' : ''}">
            <div class="flex items-start justify-between">
                <div class="flex items-start space-x-4">
                    <div class="h-12 w-12 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                        ${getInitials(app.fullName)}
                    </div>
                    <div>
                        <div class="flex items-center space-x-3">
                            <h3 class="text-lg font-semibold text-gray-800">${app.fullName}</h3>
                            <span class="status-badge ${getStatusClass(app.status)}">
                                ${app.status || 'pending'}
                            </span>
                            ${app.status === 'pending' ? `
                                <span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full new-application">
                                    New
                                </span>
                            ` : ''}
                        </div>
                        <p class="text-sm text-gray-600">${app.email}</p>
                        <p class="text-sm text-gray-500">@${app.username}</p>
                        
                        <div class="flex flex-wrap gap-4 mt-3">
                            <div class="flex items-center text-sm text-gray-600">
                                <svg class="h-4 w-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                                </svg>
                                ${app.department || 'Not specified'}
                            </div>
                            <div class="flex items-center text-sm text-gray-600">
                                <svg class="h-4 w-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                ${app.experience || 'Experience not specified'}
                            </div>
                            <div class="flex items-center text-sm text-gray-600">
                                <svg class="h-4 w-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                                Applied ${formatDate(app.createdAt)}
                            </div>
                        </div>
                        
                        ${app.bio ? `
                            <p class="text-sm text-gray-600 mt-3 line-clamp-2">${app.bio}</p>
                        ` : ''}
                    </div>
                </div>
                
                <div class="flex space-x-2">
                    <button onclick="viewApplication('${app.id}')" class="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="View Details">
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                    </button>
                    
                    ${app.status === 'pending' ? `
                        <button onclick="approveApplication('${app.id}')" class="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Approve">
                            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                        </button>
                        
                        <button onclick="showRejectionModal('${app.id}')" class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Reject">
                            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            </div>
            
            ${app.rejectionReason ? `
                <div class="mt-4 p-3 bg-red-50 rounded-lg">
                    <p class="text-xs text-red-800 font-medium">Rejection Reason:</p>
                    <p class="text-sm text-red-700">${app.rejectionReason}</p>
                </div>
            ` : ''}
            
            ${app.reviewedBy ? `
                <div class="mt-2 text-xs text-gray-500">
                    Reviewed by: ${app.reviewedBy} on ${formatDate(app.reviewedAt)}
                </div>
            ` : ''}
        </div>
    `).join('');
    
    updatePagination();
}

// Helper functions
function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function getStatusClass(status) {
    switch(status) {
        case 'active': return 'status-active';
        case 'pending': return 'status-pending';
        case 'rejected': return 'status-rejected';
        default: return 'status-pending';
    }
}

function formatDate(timestamp) {
    if (!timestamp) return 'Unknown';
    
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
    const total = filteredApplications.length;
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(start + pageSize - 1, total);
    
    const paginationInfo = document.getElementById('paginationInfo');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (paginationInfo) {
        paginationInfo.textContent = `Showing ${total ? start : 0} to ${total ? end : 0} of ${total} applications`;
    }
    
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = end >= total;
}

// View application details
window.viewApplication = async (applicationId) => {
    try {
        const appDoc = await getDoc(doc(db, 'users', applicationId));
        if (!appDoc.exists()) return;
        
        const app = appDoc.data();
        currentApplicationId = applicationId;
        
        const modalContent = document.getElementById('modalContent');
        const modalActions = document.getElementById('modalActions');
        
        modalContent.innerHTML = `
            <div class="space-y-6">
                <div class="flex items-center">
                    <div class="h-20 w-20 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold text-2xl">
                        ${getInitials(app.fullName)}
                    </div>
                    <div class="ml-4">
                        <h3 class="text-2xl font-bold text-gray-800">${app.fullName}</h3>
                        <p class="text-gray-600">${app.email}</p>
                        <p class="text-gray-500">@${app.username}</p>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                    <div>
                        <p class="text-xs text-gray-500">Status</p>
                        <p class="text-sm font-medium capitalize">${app.status}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Phone</p>
                        <p class="text-sm font-medium">${app.phone || 'Not provided'}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Department</p>
                        <p class="text-sm font-medium">${app.department || 'Not specified'}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Experience</p>
                        <p class="text-sm font-medium">${app.experience || 'Not specified'}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Applied On</p>
                        <p class="text-sm font-medium">${formatDate(app.createdAt)}</p>
                    </div>
                </div>
                
                <div>
                    <h4 class="font-semibold text-gray-800 mb-2">Bio / Qualifications</h4>
                    <p class="text-gray-600 bg-gray-50 p-4 rounded-lg">${app.bio || 'No bio provided'}</p>
                </div>
                
                ${app.rejectionReason ? `
                    <div>
                        <h4 class="font-semibold text-red-800 mb-2">Rejection Reason</h4>
                        <p class="text-red-600 bg-red-50 p-4 rounded-lg">${app.rejectionReason}</p>
                    </div>
                ` : ''}
                
                ${app.reviewedBy ? `
                    <div class="text-xs text-gray-500 border-t pt-4">
                        <p>Reviewed by: ${app.reviewedBy}</p>
                        <p>Reviewed on: ${formatDate(app.reviewedAt)}</p>
                    </div>
                ` : ''}
            </div>
        `;
        
        if (app.status === 'pending') {
            modalActions.innerHTML = `
                <button onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                    Cancel
                </button>
                <button onclick="approveApplication('${applicationId}')" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    Approve Application
                </button>
                <button onclick="showRejectionModal('${applicationId}')" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                    Reject Application
                </button>
            `;
        } else {
            modalActions.innerHTML = `
                <button onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                    Close
                </button>
            `;
        }
        
        document.getElementById('applicationModal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error viewing application:', error);
        showNotification('Failed to load application details', 'error');
    }
};

// Close modal
window.closeModal = () => {
    document.getElementById('applicationModal').classList.add('hidden');
    currentApplicationId = null;
};

// Show rejection modal
window.showRejectionModal = (applicationId) => {
    currentApplicationId = applicationId;
    document.getElementById('rejectionModal').classList.remove('hidden');
};

// Close rejection modal
window.closeRejectionModal = () => {
    document.getElementById('rejectionModal').classList.add('hidden');
    document.getElementById('rejectionReason').value = '';
};

// Submit rejection
window.submitRejection = async () => {
    const reason = document.getElementById('rejectionReason').value.trim();
    if (!reason) {
        alert('Please provide a rejection reason');
        return;
    }
    
    await rejectApplication(currentApplicationId, reason);
    closeRejectionModal();
};

// Approve application
window.approveApplication = async (applicationId) => {
    if (!confirm('Are you sure you want to approve this instructor application?')) return;
    
    try {
        await updateDoc(doc(db, 'users', applicationId), {
            status: 'active',
            reviewedBy: currentUser.email || currentUser.uid,
            reviewedAt: serverTimestamp()
        });
        
        showNotification('Application approved successfully!', 'success');
        closeModal();
        await loadApplications();
        
    } catch (error) {
        console.error('Error approving application:', error);
        showNotification('Failed to approve application', 'error');
    }
};

// Reject application
window.rejectApplication = async (applicationId, reason) => {
    try {
        await updateDoc(doc(db, 'users', applicationId), {
            status: 'rejected',
            rejectionReason: reason,
            reviewedBy: currentUser.email || currentUser.uid,
            reviewedAt: serverTimestamp()
        });
        
        showNotification('Application rejected', 'success');
        closeModal();
        await loadApplications();
        
    } catch (error) {
        console.error('Error rejecting application:', error);
        showNotification('Failed to reject application', 'error');
    }
};

// Show notification
function showNotification(message, type = 'info') {
    alert(message); // Simple alert for now
}

// Initialize
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
        
        // Logout
        const logoutBtn = document.getElementById('sidebarLogoutBtn');
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
        const statusFilter = document.getElementById('statusFilter');
        const searchInput = document.getElementById('searchInput');
        
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                filters.status = e.target.value;
                currentPage = 1;
                loadApplications();
            });
        }
        
        // Search with debounce
        let searchTimeout;
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    filters.search = e.target.value;
                    currentPage = 1;
                    applySearchFilter();
                    renderApplications();
                }, 500);
            });
        }
        
        // Pagination
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderApplications();
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (currentPage * pageSize < filteredApplications.length) {
                    currentPage++;
                    renderApplications();
                }
            });
        }
        
    } catch (error) {
        console.error('Initialization error:', error);
    }
});

// Make functions globally available
window.viewApplication = viewApplication;
window.closeModal = closeModal;
window.approveApplication = approveApplication;
window.showRejectionModal = showRejectionModal;
window.closeRejectionModal = closeRejectionModal;
window.submitRejection = submitRejection;