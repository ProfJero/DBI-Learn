import { 
    auth, 
    signOut,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    db,
    doc,
    getDoc,
    updateDoc,
    onAuthStateChanged,
    collection,
    query,
    where,
    getDocs,
    deleteDoc
} from '../firebase-config.js';

let currentUser = null;
let userData = {};

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../login.html';
    } else {
        currentUser = user;
        await loadUserData(user.uid);
        await loadNotifications(user.uid);
        loadActiveSessions();
        loadPreferences();
    }
});

// Load user data
async function loadUserData(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            userData = userDoc.data();
            
            // Update UI elements
            document.getElementById('userName').textContent = userData.fullName || 'Student';
            document.getElementById('userRole').textContent = userData.role || 'Student';
            
            // Update avatars
            const avatarName = encodeURIComponent(userData.fullName || 'Student');
            const avatarUrl = `https://ui-avatars.com/api/?background=1e88e5&color=fff&bold=true&size=100&name=${avatarName}`;
            
            const profileAvatar = document.getElementById('profileAvatar');
            const userAvatar = document.getElementById('userAvatar');
            const dropdownAvatar = document.getElementById('dropdownAvatar');
            
            if (profileAvatar) profileAvatar.src = avatarUrl;
            if (userAvatar) userAvatar.src = avatarUrl;
            if (dropdownAvatar) dropdownAvatar.src = avatarUrl;
            
            // Populate profile form
            document.getElementById('fullName').value = userData.fullName || '';
            document.getElementById('username').value = userData.username || '';
            document.getElementById('email').value = userData.email || '';
            document.getElementById('phone').value = userData.phone || '';
            document.getElementById('school').value = userData.school || '';
            document.getElementById('grade').value = userData.grade || '';
            document.getElementById('location').value = userData.location || '';
            document.getElementById('bio').value = userData.bio || '';
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showToast('Failed to load user data', 'error');
    }
}

// Profile form submission
document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fullName = document.getElementById('fullName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const school = document.getElementById('school').value.trim();
    const grade = document.getElementById('grade').value;
    const location = document.getElementById('location').value.trim();
    const bio = document.getElementById('bio').value.trim();
    
    if (!fullName) {
        showToast('Please enter your full name', 'error');
        return;
    }
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            fullName: fullName,
            phone: phone || null,
            school: school || null,
            grade: grade || null,
            location: location || null,
            bio: bio || null,
            updatedAt: new Date().toISOString()
        });
        
        // Update display name in auth
        await currentUser.updateProfile({
            displayName: fullName
        });
        
        showToast('Profile updated successfully!', 'success');
        
        // Refresh user data
        await loadUserData(currentUser.uid);
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showToast('Failed to update profile', 'error');
    }
});

// Password strength checker
function checkPasswordStrength(password) {
    let strength = 0;
    let feedback = '';
    
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]+/)) strength++;
    if (password.match(/[A-Z]+/)) strength++;
    if (password.match(/[0-9]+/)) strength++;
    if (password.match(/[$@#&!]+/)) strength++;
    
    switch(strength) {
        case 0:
        case 1:
            feedback = 'Very Weak';
            document.getElementById('strengthMeter').className = 'strength-meter strength-1 rounded-full';
            break;
        case 2:
            feedback = 'Weak';
            document.getElementById('strengthMeter').className = 'strength-meter strength-2 rounded-full';
            break;
        case 3:
            feedback = 'Good';
            document.getElementById('strengthMeter').className = 'strength-meter strength-3 rounded-full';
            break;
        case 4:
        case 5:
            feedback = 'Strong';
            document.getElementById('strengthMeter').className = 'strength-meter strength-4 rounded-full';
            break;
    }
    
    document.getElementById('strengthText').textContent = `Password strength: ${feedback}`;
    return strength;
}

// Password form submission
document.getElementById('passwordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    try {
        // Reauthenticate user
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        
        // Update password
        await updatePassword(currentUser, newPassword);
        
        showToast('Password updated successfully!', 'success');
        document.getElementById('passwordForm').reset();
        document.getElementById('strengthMeter').className = 'strength-meter strength-0 rounded-full';
        document.getElementById('strengthText').textContent = '';
        
    } catch (error) {
        console.error('Error updating password:', error);
        if (error.code === 'auth/wrong-password') {
            showToast('Current password is incorrect', 'error');
        } else {
            showToast('Failed to update password', 'error');
        }
    }
});

// Password strength monitoring
document.getElementById('newPassword')?.addEventListener('input', (e) => {
    checkPasswordStrength(e.target.value);
    validatePasswordMatch();
});

document.getElementById('confirmPassword')?.addEventListener('input', validatePasswordMatch);

function validatePasswordMatch() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorElement = document.getElementById('passwordMatchError');
    
    if (confirmPassword && newPassword !== confirmPassword) {
        errorElement.classList.remove('hidden');
        return false;
    } else {
        errorElement.classList.add('hidden');
        return true;
    }
}

// Avatar upload
document.getElementById('changeAvatarBtn')?.addEventListener('click', () => {
    document.getElementById('avatarUpload').click();
});

document.getElementById('avatarUpload')?.addEventListener('change', async (e) => {
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
        // Convert to base64 for preview (in production, upload to Firebase Storage)
        const reader = new FileReader();
        reader.onload = async (event) => {
            const avatarUrl = event.target.result;
            document.getElementById('profileAvatar').src = avatarUrl;
            
            // Update avatar in Firestore (store base64 or storage URL)
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                avatar: avatarUrl,
                updatedAt: new Date().toISOString()
            });
            
            showToast('Avatar updated successfully!', 'success');
        };
        reader.readAsDataURL(file);
        
    } catch (error) {
        console.error('Error uploading avatar:', error);
        showToast('Failed to upload avatar', 'error');
    }
});

// Settings navigation
function setupSettingsNavigation() {
    const navItems = document.querySelectorAll('.settings-nav-item');
    const sections = {
        'profile': document.getElementById('profileSection'),
        'security': document.getElementById('securitySection'),
        'preferences': document.getElementById('preferencesSection'),
        'notifications': document.getElementById('notificationsSection'),
        'privacy': document.getElementById('privacySection'),
        'data': document.getElementById('dataSection')
    };
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            
            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Show selected section
            Object.values(sections).forEach(sectionEl => {
                if (sectionEl) sectionEl.classList.add('hidden');
            });
            sections[section].classList.remove('hidden');
        });
    });
}

// Load preferences from localStorage
function loadPreferences() {
    // Theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.querySelector(`.theme-btn[data-theme="${savedTheme}"]`)?.classList.add('bg-[#1e88e5]', 'text-white');
    
    // Email digest
    const emailDigest = localStorage.getItem('emailDigest') === 'true';
    document.getElementById('emailDigest').checked = emailDigest;
    
    // Auto-play
    const autoPlay = localStorage.getItem('autoPlay') !== 'false';
    document.getElementById('autoPlay').checked = autoPlay;
    
    // Language
    const language = localStorage.getItem('language') || 'en';
    document.getElementById('language').value = language;
    
    // Notification settings
    const notifyCourseUpdates = localStorage.getItem('notifyCourseUpdates') !== 'false';
    document.getElementById('notifyCourseUpdates').checked = notifyCourseUpdates;
    
    const notifyQuizResults = localStorage.getItem('notifyQuizResults') !== 'false';
    document.getElementById('notifyQuizResults').checked = notifyQuizResults;
    
    const notifyCertificates = localStorage.getItem('notifyCertificates') !== 'false';
    document.getElementById('notifyCertificates').checked = notifyCertificates;
    
    const notifyDiscussions = localStorage.getItem('notifyDiscussions') !== 'false';
    document.getElementById('notifyDiscussions').checked = notifyDiscussions;
    
    const notifySupport = localStorage.getItem('notifySupport') !== 'false';
    document.getElementById('notifySupport').checked = notifySupport;
    
    // Privacy settings
    const profileVisibility = localStorage.getItem('profileVisibility') || 'public';
    document.getElementById('profileVisibility').value = profileVisibility;
    
    const showProgress = localStorage.getItem('showProgress') !== 'false';
    document.getElementById('showProgress').checked = showProgress;
    
    const showCertificates = localStorage.getItem('showCertificates') !== 'false';
    document.getElementById('showCertificates').checked = showCertificates;
}

// Save preferences
function setupPreferences() {
    // Theme
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            localStorage.setItem('theme', theme);
            document.querySelectorAll('.theme-btn').forEach(b => {
                b.classList.remove('bg-[#1e88e5]', 'text-white');
                b.classList.add('border');
            });
            btn.classList.add('bg-[#1e88e5]', 'text-white');
            btn.classList.remove('border');
            
            // Apply theme (simplified)
            if (theme === 'dark') {
                document.body.classList.add('dark');
            } else {
                document.body.classList.remove('dark');
            }
            
            showToast(`Theme changed to ${theme}`, 'success');
        });
    });
    
    // Email digest
    document.getElementById('emailDigest')?.addEventListener('change', (e) => {
        localStorage.setItem('emailDigest', e.target.checked);
        showToast('Preference saved', 'success');
    });
    
    // Auto-play
    document.getElementById('autoPlay')?.addEventListener('change', (e) => {
        localStorage.setItem('autoPlay', e.target.checked);
        showToast('Preference saved', 'success');
    });
    
    // Language
    document.getElementById('language')?.addEventListener('change', (e) => {
        localStorage.setItem('language', e.target.value);
        showToast('Language preference saved', 'success');
    });
    
    // Notification settings
    const notificationToggles = ['notifyCourseUpdates', 'notifyQuizResults', 'notifyCertificates', 'notifyDiscussions', 'notifySupport'];
    notificationToggles.forEach(id => {
        document.getElementById(id)?.addEventListener('change', (e) => {
            localStorage.setItem(id, e.target.checked);
            showToast('Notification settings saved', 'success');
        });
    });
    
    // Privacy settings
    document.getElementById('profileVisibility')?.addEventListener('change', (e) => {
        localStorage.setItem('profileVisibility', e.target.value);
        showToast('Privacy setting saved', 'success');
    });
    
    document.getElementById('showProgress')?.addEventListener('change', (e) => {
        localStorage.setItem('showProgress', e.target.checked);
        showToast('Privacy setting saved', 'success');
    });
    
    document.getElementById('showCertificates')?.addEventListener('change', (e) => {
        localStorage.setItem('showCertificates', e.target.checked);
        showToast('Privacy setting saved', 'success');
    });
}

// Load active sessions (simulated)
function loadActiveSessions() {
    const container = document.getElementById('activeSessions');
    const sessions = [
        { device: 'Chrome on Windows', location: 'Current Session', date: 'Today', active: true },
        { device: 'Safari on iPhone', location: 'Accra, Ghana', date: '2 days ago', active: false },
        { device: 'Firefox on Mac', location: 'Kumasi, Ghana', date: '5 days ago', active: false }
    ];
    
    container.innerHTML = sessions.map(session => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center space-x-3">
                <i class="fas ${session.device.includes('Windows') ? 'fa-laptop' : session.device.includes('iPhone') ? 'fa-mobile-alt' : 'fa-desktop'} text-gray-500"></i>
                <div>
                    <p class="text-sm font-medium text-gray-800">${session.device}</p>
                    <p class="text-xs text-gray-500">${session.location} • ${session.date}</p>
                </div>
            </div>
            ${session.active ? '<span class="text-xs text-green-500">Active Now</span>' : '<span class="text-xs text-gray-400">Inactive</span>'}
        </div>
    `).join('');
}

// Export data
document.getElementById('exportDataBtn')?.addEventListener('click', async () => {
    showToast('Preparing your data for export...', 'info');
    
    try {
        // Collect user data
        const userData = {
            profile: {
                name: document.getElementById('fullName').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                school: document.getElementById('school').value,
                grade: document.getElementById('grade').value,
                location: document.getElementById('location').value
            },
            preferences: {
                language: localStorage.getItem('language'),
                theme: localStorage.getItem('theme'),
                emailDigest: localStorage.getItem('emailDigest') === 'true'
            },
            exportedAt: new Date().toISOString()
        };
        
        // Create JSON file
        const dataStr = JSON.stringify(userData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dbi_data_${currentUser.uid}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('Data exported successfully!', 'success');
        
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast('Failed to export data', 'error');
    }
});

// Delete account
document.getElementById('deleteAccountBtn')?.addEventListener('click', async () => {
    const confirmDelete = confirm('WARNING: This will permanently delete your account and all associated data. This action cannot be undone. Are you absolutely sure?');
    
    if (!confirmDelete) return;
    
    const password = prompt('Please enter your password to confirm account deletion:');
    if (!password) return;
    
    try {
        // Reauthenticate
        const credential = EmailAuthProvider.credential(currentUser.email, password);
        await reauthenticateWithCredential(currentUser, credential);
        
        // Delete user data from Firestore
        await deleteDoc(doc(db, 'users', currentUser.uid));
        
        // Delete user from Authentication
        await currentUser.delete();
        
        showToast('Account deleted successfully', 'success');
        
        // Redirect to login
        setTimeout(() => {
            window.location.href = '../../login.html';
        }, 2000);
        
    } catch (error) {
        console.error('Error deleting account:', error);
        if (error.code === 'auth/wrong-password') {
            showToast('Incorrect password', 'error');
        } else {
            showToast('Failed to delete account', 'error');
        }
    }
});

// Logout all sessions
document.getElementById('logoutAllSessions')?.addEventListener('click', async () => {
    const confirm = window.confirm('This will log you out from all devices. Continue?');
    if (confirm) {
        // In a real app, you'd invalidate all tokens here
        showToast('Logged out from all devices', 'success');
        setTimeout(() => {
            signOut(auth);
            window.location.href = '../../login.html';
        }, 2000);
    }
});

// Enable 2FA
document.getElementById('enable2FA')?.addEventListener('click', () => {
    showToast('Two-Factor Authentication coming soon!', 'info');
});

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

// Sidebar toggle functionality
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    const mainContent = document.getElementById('mainContent');
    let isCollapsed = false;
    
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState === 'true') {
        toggleSidebar(true);
    }
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            toggleSidebar(!isCollapsed);
        });
    }
    
    function toggleSidebar(collapse) {
        isCollapsed = collapse;
        
        if (isCollapsed) {
            sidebar.classList.remove('sidebar-expanded');
            sidebar.classList.add('sidebar-collapsed');
            mainContent.style.marginLeft = '80px';
            localStorage.setItem('sidebarCollapsed', 'true');
            
            document.querySelectorAll('.nav-text, .user-info, .logo-text').forEach(el => {
                el.style.display = 'none';
            });
            
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
            localStorage.setItem('sidebarCollapsed', 'false');
            
            document.querySelectorAll('.nav-text, .user-info, .logo-text').forEach(el => {
                el.style.display = '';
            });
            
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('tooltip');
                item.removeAttribute('data-tooltip');
            });
            
            toggleBtn.innerHTML = '<i class="fas fa-chevron-left text-xl"></i>';
        }
    }
    
    // Mobile menu
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
    const notificationBtn = document.getElementById('notificationBtn');
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    
    if (notificationBtn) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (userDropdown) userDropdown.classList.add('hidden');
        });
    }
    
    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown?.classList.toggle('hidden');
        });
    }
    
    document.addEventListener('click', (e) => {
        if (userDropdown && !userDropdown.contains(e.target) && e.target !== userMenuBtn) {
            userDropdown.classList.add('hidden');
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
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Logout function
async function logout() {
    try {
        await signOut(auth);
        window.location.href = '../../login.html';
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    setupSettingsNavigation();
    setupPreferences();
    setupSidebar();
    setupDropdowns();
    
    // Logout handlers
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
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    .animate-fade-in {
        animation: fade-in 0.3s ease;
    }
`;
document.head.appendChild(style);