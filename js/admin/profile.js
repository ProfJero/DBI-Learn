import { 
    auth, signOut, db, doc, getDoc, getDocs, updateDoc, collection, query, where, onAuthStateChanged
} from '../firebase-config.js';

let currentAdmin = null;
let adminData = {};

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '../../login.html'; return; }
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && (userDoc.data().role === 'admin' || userDoc.data().role === 'super_admin')) {
        currentAdmin = user;
        await loadAdminData(user.uid);
        await loadPlatformStats();
        await loadRecentActivity();
        await loadNotifications(user.uid);
    } else {
        window.location.href = '../../student/dashboard.html';
    }
});

// Load admin data
async function loadAdminData(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            adminData = userDoc.data();
            
            // Update UI
            document.getElementById('adminName').textContent = adminData.fullName || 'Administrator';
            document.getElementById('adminRole').textContent = adminData.role === 'super_admin' ? 'Super Administrator' : 'Administrator';
            document.getElementById('profileName').textContent = adminData.fullName || 'Administrator';
            document.getElementById('profileEmail').textContent = adminData.email || '-';
            document.getElementById('profileRole').textContent = adminData.role === 'super_admin' ? 'Super Administrator' : 'Administrator';
            
            // Personal info
            document.getElementById('infoFullName').textContent = adminData.fullName || '-';
            document.getElementById('infoUsername').textContent = adminData.username || '-';
            document.getElementById('infoEmail').textContent = adminData.email || '-';
            document.getElementById('infoPhone').textContent = adminData.phone || 'Not provided';
            document.getElementById('infoRole').textContent = adminData.role === 'super_admin' ? 'Super Administrator' : 'Administrator';
            document.getElementById('infoDepartment').textContent = adminData.department || 'Administration';
            document.getElementById('infoBio').textContent = adminData.bio || 'No bio added yet.';
            
            // Join date
            if (adminData.createdAt) {
                const joinDate = adminData.createdAt.toDate ? adminData.createdAt.toDate() : new Date(adminData.createdAt);
                document.getElementById('joinDate').textContent = joinDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                document.getElementById('adminSince').textContent = joinDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            }
            
            // Update avatars
            const avatarName = encodeURIComponent(adminData.fullName || 'Admin');
            const avatarUrl = `https://ui-avatars.com/api/?background=1e88e5&color=fff&bold=true&size=120&name=${avatarName}`;
            document.getElementById('profileAvatar').src = avatarUrl;
            document.getElementById('adminAvatar').src = avatarUrl;
            document.getElementById('dropdownAvatar').src = avatarUrl;
            
            // Populate edit form
            document.getElementById('editFullName').value = adminData.fullName || '';
            document.getElementById('editPhone').value = adminData.phone || '';
            document.getElementById('editBio').value = adminData.bio || '';
        }
    } catch (error) {
        console.error('Error loading admin data:', error);
        showToast('Failed to load profile data', 'error');
    }
}

// Load platform statistics
async function loadPlatformStats() {
    try {
        // Get total users
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const totalUsers = usersSnapshot.size;
        document.getElementById('totalUsers').textContent = totalUsers;
        
        // Get total courses
        const coursesSnapshot = await getDocs(collection(db, 'courses'));
        const totalCourses = coursesSnapshot.size;
        document.getElementById('totalCourses').textContent = totalCourses;
        
        // Get total tickets
        const ticketsSnapshot = await getDocs(collection(db, 'supportTickets'));
        const totalTickets = ticketsSnapshot.size;
        document.getElementById('totalTickets').textContent = totalTickets;
        
    } catch (error) {
        console.error('Error loading platform stats:', error);
    }
}

// Load recent activity
async function loadRecentActivity() {
    const container = document.getElementById('activityTimeline');
    const activities = [];
    
    try {
        // Get recent user registrations
        const usersRef = collection(db, 'users');
        const usersQuery = query(usersRef, where('createdAt', '!=', null));
        const usersSnapshot = await getDocs(usersQuery);
        usersSnapshot.forEach(doc => {
            const user = doc.data();
            if (user.createdAt && user.role !== 'admin' && user.role !== 'super_admin') {
                activities.push({
                    type: 'user',
                    action: `New user registered: ${user.fullName || user.email}`,
                    date: user.createdAt,
                    icon: 'fa-user-plus',
                    color: 'blue'
                });
            }
        });
        
        // Get recent course creations
        const coursesRef = collection(db, 'courses');
        const coursesSnapshot = await getDocs(coursesRef);
        coursesSnapshot.forEach(doc => {
            const course = doc.data();
            if (course.createdAt) {
                activities.push({
                    type: 'course',
                    action: `New course created: ${course.title}`,
                    date: course.createdAt,
                    icon: 'fa-book',
                    color: 'green'
                });
            }
        });
        
        // Get recent support tickets
        const ticketsRef = collection(db, 'supportTickets');
        const ticketsSnapshot = await getDocs(ticketsRef);
        ticketsSnapshot.forEach(doc => {
            const ticket = doc.data();
            if (ticket.createdAt) {
                activities.push({
                    type: 'ticket',
                    action: `New support ticket: ${ticket.subject}`,
                    date: ticket.createdAt,
                    icon: 'fa-headset',
                    color: 'orange'
                });
            }
        });
        
        // Sort by date and get top 5
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        const recentActivities = activities.slice(0, 5);
        
        if (recentActivities.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-clock text-gray-300 text-3xl mb-2"></i>
                    <p class="text-gray-500">No recent activity</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = recentActivities.map(activity => `
            <div class="activity-item">
                <div class="activity-dot"></div>
                <div class="ml-4">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 bg-${activity.color}-100 rounded-full flex items-center justify-center">
                            <i class="fas ${activity.icon} text-${activity.color}-600 text-sm"></i>
                        </div>
                        <div class="flex-1">
                            <p class="text-sm text-gray-800">${activity.action}</p>
                            <p class="text-xs text-gray-500">${getTimeAgo(activity.date)}</p>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading recent activity:', error);
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-exclamation-circle text-gray-300 text-3xl mb-2"></i>
                <p class="text-gray-500">Unable to load activity</p>
            </div>
        `;
    }
}

// Get time ago
function getTimeAgo(date) {
    if (!date) return 'Just now';
    const d = date.toDate ? date.toDate() : new Date(date);
    const diff = new Date() - d;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 24) return `${hours} hours ago`;
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString();
}

// Avatar upload
function setupAvatarUpload() {
    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    const avatarUpload = document.getElementById('avatarUpload');
    const profileAvatar = document.getElementById('profileAvatar');
    
    changeAvatarBtn.addEventListener('click', () => {
        avatarUpload.click();
    });
    
    avatarUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 2 * 1024 * 1024) {
            showToast('File size must be less than 2MB', 'error');
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            showToast('Please upload an image file', 'error');
            return;
        }
        
        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const avatarUrl = event.target.result;
                profileAvatar.src = avatarUrl;
                
                // Update in Firestore
                const userRef = doc(db, 'users', currentAdmin.uid);
                await updateDoc(userRef, {
                    avatar: avatarUrl,
                    updatedAt: new Date().toISOString()
                });
                
                showToast('Avatar updated successfully', 'success');
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error uploading avatar:', error);
            showToast('Failed to upload avatar', 'error');
        }
    });
}

// Edit profile modal
function setupEditProfileModal() {
    const editProfileBtn = document.querySelector('a[href="settings.html"]');
    const modal = document.getElementById('editProfileModal');
    const closeBtn = document.getElementById('closeEditModal');
    const cancelBtn = document.getElementById('cancelEditModal');
    const form = document.getElementById('editProfileForm');
    
    // Open modal when clicking Edit Profile button
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            modal.classList.remove('hidden');
        });
    }
    
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fullName = document.getElementById('editFullName').value.trim();
        const phone = document.getElementById('editPhone').value.trim();
        const bio = document.getElementById('editBio').value.trim();
        
        if (!fullName) {
            showToast('Please enter your full name', 'error');
            return;
        }
        
        try {
            const userRef = doc(db, 'users', currentAdmin.uid);
            await updateDoc(userRef, {
                fullName: fullName,
                phone: phone || null,
                bio: bio || null,
                updatedAt: new Date().toISOString()
            });
            
            // Update display name in Auth
            await currentAdmin.updateProfile({
                displayName: fullName
            });
            
            showToast('Profile updated successfully', 'success');
            modal.classList.add('hidden');
            
            // Reload admin data
            await loadAdminData(currentAdmin.uid);
            
        } catch (error) {
            console.error('Error updating profile:', error);
            showToast('Failed to update profile', 'error');
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

// Sidebar setup
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    const mainContent = document.getElementById('mainContent');
    let isCollapsed = localStorage.getItem('adminSidebarCollapsed') === 'true';
    if (isCollapsed) toggleSidebar(true);
    toggleBtn?.addEventListener('click', () => toggleSidebar(!isCollapsed));
    function toggleSidebar(collapse) {
        isCollapsed = collapse;
        if (collapse) {
            sidebar.classList.add('sidebar-collapsed'); sidebar.classList.remove('sidebar-expanded');
            mainContent.style.marginLeft = '80px';
            localStorage.setItem('adminSidebarCollapsed', 'true');
            document.querySelectorAll('.nav-text, .admin-info, .logo-text').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.nav-item').forEach(item => {
                const text = item.querySelector('.nav-text')?.innerText;
                if (text) { item.classList.add('tooltip'); item.setAttribute('data-tooltip', text); }
            });
            toggleBtn.innerHTML = '<i class="fas fa-chevron-right text-xl"></i>';
        } else {
            sidebar.classList.add('sidebar-expanded'); sidebar.classList.remove('sidebar-collapsed');
            mainContent.style.marginLeft = '280px';
            localStorage.setItem('adminSidebarCollapsed', 'false');
            document.querySelectorAll('.nav-text, .admin-info, .logo-text').forEach(el => el.style.display = '');
            document.querySelectorAll('.nav-item').forEach(item => { item.classList.remove('tooltip'); item.removeAttribute('data-tooltip'); });
            toggleBtn.innerHTML = '<i class="fas fa-chevron-left text-xl"></i>';
        }
    }
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileOverlay = document.getElementById('mobileOverlay');
    mobileMenuBtn?.addEventListener('click', () => { sidebar.classList.add('mobile-open'); mobileOverlay.classList.remove('hidden'); });
    mobileOverlay?.addEventListener('click', () => { sidebar.classList.remove('mobile-open'); mobileOverlay.classList.add('hidden'); });
}

function setupDropdowns() {
    const btn = document.getElementById('adminMenuBtn');
    const dropdown = document.getElementById('adminDropdown');
    btn?.addEventListener('click', (e) => { e.stopPropagation(); dropdown?.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => { if (dropdown && !dropdown.contains(e.target) && e.target !== btn) dropdown.classList.add('hidden'); });
}

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in ${type === 'success' ? 'bg-green-500 text-white' : type === 'error' ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

async function logout() { await signOut(auth); window.location.href = '../../login.html'; }

document.addEventListener('DOMContentLoaded', () => {
    setupAvatarUpload();
    setupEditProfileModal();
    setupSidebar();
    setupDropdowns();
    document.querySelectorAll('#logoutBtn, #logoutDropdown').forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); logout(); }));
});

const style = document.createElement('style');
style.textContent = `.animate-fade-in { animation: fadeIn 0.3s ease; } @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } .role-admin { background: #e9d5ff; color: #6b21a5; }`;
document.head.appendChild(style);