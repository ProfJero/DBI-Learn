import { 
    auth, signOut, db, doc, getDoc, getDocs, collection, query, where, 
    onAuthStateChanged, updateDoc, setDoc, updateProfile
} from '../firebase-config.js';

let currentAdmin = null;
let currentAdminData = null;
let settings = {};

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '../../login.html'; return; }
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && (userDoc.data().role === 'admin' || userDoc.data().role === 'super_admin')) {
        currentAdmin = user;
        currentAdminData = userDoc.data();
        await loadAdminData(user.uid);
        await loadSettings();
        await loadNotifications(user.uid);
        await loadProfileData();
    } else {
        window.location.href = '../../student/dashboard.html';
    }
});

// Load admin data
async function loadAdminData(userId) {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
        const data = userDoc.data();
        document.getElementById('adminName').textContent = data.fullName || 'Administrator';
        document.getElementById('adminRole').textContent = data.role === 'super_admin' ? 'Super Administrator' : 'Administrator';
        const avatarUrl = `https://ui-avatars.com/api/?background=1e88e5&color=fff&bold=true&size=40&name=${encodeURIComponent(data.fullName || 'Admin')}`;
        document.getElementById('adminAvatar').src = avatarUrl;
        document.getElementById('dropdownAvatar').src = avatarUrl;
    }
}

// Load profile data
async function loadProfileData() {
    if (!currentAdminData) return;
    
    // Set profile avatar
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
        const avatarUrl = currentAdminData.photoURL || `https://ui-avatars.com/api/?background=1e88e5&color=fff&bold=true&size=80&name=${encodeURIComponent(currentAdminData.fullName || 'Admin')}`;
        profileAvatar.src = avatarUrl;
    }
    
    // Set form values
    document.getElementById('profileFullName').value = currentAdminData.fullName || '';
    document.getElementById('profileEmail').value = currentAdmin.email || '';
    document.getElementById('profilePhone').value = currentAdminData.phone || '';
    document.getElementById('profileDepartment').value = currentAdminData.department || '';
    document.getElementById('profileBio').value = currentAdminData.bio || '';
}

// Load settings from Firestore
async function loadSettings() {
    try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'platform'));
        if (settingsDoc.exists()) {
            settings = settingsDoc.data();
        } else {
            // Default settings
            settings = {
                platformName: 'Digital Bridge Initiative',
                platformTagline: 'Bridging the digital divide through education',
                supportEmail: 'support@dbi-learning.com',
                supportPhone: '+233 XX XXX XXXX',
                timezone: 'Africa/Accra',
                primaryColor: '#1e88e5',
                secondaryColor: '#00c853',
                logoUrl: '',
                faviconUrl: '',
                darkMode: false,
                publicRegistration: true,
                emailVerification: true,
                courseReviews: true,
                discussions: true,
                certificates: true,
                quizzes: true,
                sessionTimeout: 60,
                maxLoginAttempts: 5,
                passwordResetExpiry: 24,
                require2FA: false,
                ipWhitelist: false
            };
        }
        
        // Populate forms
        populateGeneralForm();
        populateAppearanceForm();
        populateEmailForm();
        populateFeaturesForm();
        populateSecurityForm();
        populateIntegrationsForm();
        
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Profile Form Submission
document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fullName = document.getElementById('profileFullName').value.trim();
    const email = document.getElementById('profileEmail').value.trim();
    const phone = document.getElementById('profilePhone').value.trim();
    const department = document.getElementById('profileDepartment').value.trim();
    const bio = document.getElementById('profileBio').value.trim();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!fullName) {
        showToast('Please enter your full name', 'error');
        return;
    }
    
    if (!email) {
        showToast('Please enter your email address', 'error');
        return;
    }
    
    try {
        // Update user profile in Firestore
        const userRef = doc(db, 'users', currentAdmin.uid);
        const updateData = {
            fullName: fullName,
            phone: phone,
            department: department,
            bio: bio,
            updatedAt: new Date().toISOString()
        };
        
        // Update email if changed
        if (email !== currentAdmin.email) {
            updateData.email = email;
            // Note: Email verification would need to be handled by Firebase Auth
            showToast('Email change will require re-verification', 'info');
        }
        
        await updateDoc(userRef, updateData);
        
        // Update display name in Firebase Auth
        if (fullName !== currentAdminData.fullName) {
            await updateProfile(currentAdmin, {
                displayName: fullName
            });
        }
        
        // Update password if provided
        if (newPassword) {
            if (newPassword !== confirmPassword) {
                showToast('New passwords do not match', 'error');
                return;
            }
            
            if (newPassword.length < 8) {
                showToast('Password must be at least 8 characters', 'error');
                return;
            }
            
            // Password validation
            const hasUpperCase = /[A-Z]/.test(newPassword);
            const hasLowerCase = /[a-z]/.test(newPassword);
            const hasNumbers = /\d/.test(newPassword);
            
            if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
                showToast('Password must contain uppercase, lowercase, and numbers', 'error');
                return;
            }
            
            // Update password in Firebase Auth
            // Note: This requires re-authentication in a real app
            showToast('Password update requires re-authentication. Please contact support for security reasons.', 'info');
        }
        
        // Update local data
        currentAdminData = { ...currentAdminData, ...updateData };
        
        // Update sidebar display
        document.getElementById('adminName').textContent = fullName;
        
        // Clear password fields
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        
        showToast('Profile updated successfully', 'success');
        
        // Refresh avatars
        const avatarUrl = `https://ui-avatars.com/api/?background=1e88e5&color=fff&bold=true&size=80&name=${encodeURIComponent(fullName)}`;
        document.getElementById('profileAvatar').src = avatarUrl;
        document.getElementById('adminAvatar').src = avatarUrl;
        document.getElementById('dropdownAvatar').src = avatarUrl;
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showToast('Failed to update profile', 'error');
    }
});

// Cancel profile changes
document.getElementById('cancelProfileBtn')?.addEventListener('click', () => {
    loadProfileData();
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    showToast('Changes discarded', 'info');
});

// Change avatar
document.getElementById('changeAvatarBtn')?.addEventListener('click', () => {
    // Create file input for avatar upload
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Check file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            showToast('Image must be less than 2MB', 'error');
            return;
        }
        
        // Check file type
        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file', 'error');
            return;
        }
        
        // Create preview
        const reader = new FileReader();
        reader.onload = async (e) => {
            const imageUrl = e.target.result;
            document.getElementById('profileAvatar').src = imageUrl;
            
            // Note: In a production app, you would upload this to Firebase Storage
            // For now, we'll just update the avatar URL in Firestore
            try {
                const userRef = doc(db, 'users', currentAdmin.uid);
                await updateDoc(userRef, {
                    photoURL: imageUrl,
                    updatedAt: new Date().toISOString()
                });
                
                // Update sidebar avatars
                document.getElementById('adminAvatar').src = imageUrl;
                document.getElementById('dropdownAvatar').src = imageUrl;
                
                showToast('Profile picture updated', 'success');
            } catch (error) {
                console.error('Error updating avatar:', error);
                showToast('Failed to update profile picture', 'error');
            }
        };
        reader.readAsDataURL(file);
    };
    
    fileInput.click();
});

// Populate General Settings Form
function populateGeneralForm() {
    document.getElementById('platformName').value = settings.platformName || '';
    document.getElementById('platformTagline').value = settings.platformTagline || '';
    document.getElementById('supportEmail').value = settings.supportEmail || '';
    document.getElementById('supportPhone').value = settings.supportPhone || '';
    document.getElementById('timezone').value = settings.timezone || 'Africa/Accra';
}

// Populate Appearance Form
function populateAppearanceForm() {
    document.getElementById('primaryColor').value = settings.primaryColor || '#1e88e5';
    document.getElementById('primaryColorHex').value = settings.primaryColor || '#1e88e5';
    document.getElementById('secondaryColor').value = settings.secondaryColor || '#00c853';
    document.getElementById('secondaryColorHex').value = settings.secondaryColor || '#00c853';
    document.getElementById('logoUrl').value = settings.logoUrl || '';
    document.getElementById('faviconUrl').value = settings.faviconUrl || '';
    document.getElementById('darkMode').checked = settings.darkMode || false;
}

// Populate Email Settings Form
function populateEmailForm() {
    document.getElementById('smtpHost').value = settings.smtpHost || '';
    document.getElementById('smtpPort').value = settings.smtpPort || '587';
    document.getElementById('smtpUsername').value = settings.smtpUsername || '';
    document.getElementById('smtpPassword').value = settings.smtpPassword || '';
    document.getElementById('fromEmail').value = settings.fromEmail || '';
    document.getElementById('fromName').value = settings.fromName || '';
}

// Populate Features Form
function populateFeaturesForm() {
    document.getElementById('publicRegistration').checked = settings.publicRegistration !== false;
    document.getElementById('emailVerification').checked = settings.emailVerification !== false;
    document.getElementById('courseReviews').checked = settings.courseReviews !== false;
    document.getElementById('discussions').checked = settings.discussions !== false;
    document.getElementById('certificates').checked = settings.certificates !== false;
    document.getElementById('quizzes').checked = settings.quizzes !== false;
}

// Populate Security Form
function populateSecurityForm() {
    document.getElementById('sessionTimeout').value = settings.sessionTimeout || 60;
    document.getElementById('maxLoginAttempts').value = settings.maxLoginAttempts || 5;
    document.getElementById('passwordResetExpiry').value = settings.passwordResetExpiry || 24;
    document.getElementById('require2FA').checked = settings.require2FA || false;
    document.getElementById('ipWhitelist').checked = settings.ipWhitelist || false;
}

// Populate Integrations Form
function populateIntegrationsForm() {
    document.getElementById('googleAnalytics').checked = settings.googleAnalytics || false;
    document.getElementById('gaTrackingId').value = settings.gaTrackingId || '';
    document.getElementById('facebookPixel').checked = settings.facebookPixel || false;
    document.getElementById('fpPixelId').value = settings.fpPixelId || '';
    document.getElementById('paymentGateway').checked = settings.paymentGateway || false;
    document.getElementById('paymentProvider').value = settings.paymentProvider || '';
}

// Save General Settings
document.getElementById('generalSettingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedSettings = {
        platformName: document.getElementById('platformName').value,
        platformTagline: document.getElementById('platformTagline').value,
        supportEmail: document.getElementById('supportEmail').value,
        supportPhone: document.getElementById('supportPhone').value,
        timezone: document.getElementById('timezone').value
    };
    await saveSettings(updatedSettings);
    showToast('General settings saved', 'success');
});

// Save Appearance Settings
document.getElementById('appearanceForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedSettings = {
        primaryColor: document.getElementById('primaryColorHex').value,
        secondaryColor: document.getElementById('secondaryColorHex').value,
        logoUrl: document.getElementById('logoUrl').value,
        faviconUrl: document.getElementById('faviconUrl').value,
        darkMode: document.getElementById('darkMode').checked
    };
    await saveSettings(updatedSettings);
    showToast('Appearance settings saved', 'success');
});

// Save Email Settings
document.getElementById('emailSettingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedSettings = {
        smtpHost: document.getElementById('smtpHost').value,
        smtpPort: parseInt(document.getElementById('smtpPort').value),
        smtpUsername: document.getElementById('smtpUsername').value,
        smtpPassword: document.getElementById('smtpPassword').value,
        fromEmail: document.getElementById('fromEmail').value,
        fromName: document.getElementById('fromName').value
    };
    await saveSettings(updatedSettings);
    showToast('Email settings saved', 'success');
});

// Save Feature Flags
document.getElementById('featuresForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedSettings = {
        publicRegistration: document.getElementById('publicRegistration').checked,
        emailVerification: document.getElementById('emailVerification').checked,
        courseReviews: document.getElementById('courseReviews').checked,
        discussions: document.getElementById('discussions').checked,
        certificates: document.getElementById('certificates').checked,
        quizzes: document.getElementById('quizzes').checked
    };
    await saveSettings(updatedSettings);
    showToast('Feature settings saved', 'success');
});

// Save Security Settings
document.getElementById('securityForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedSettings = {
        sessionTimeout: parseInt(document.getElementById('sessionTimeout').value),
        maxLoginAttempts: parseInt(document.getElementById('maxLoginAttempts').value),
        passwordResetExpiry: parseInt(document.getElementById('passwordResetExpiry').value),
        require2FA: document.getElementById('require2FA').checked,
        ipWhitelist: document.getElementById('ipWhitelist').checked
    };
    await saveSettings(updatedSettings);
    showToast('Security settings saved', 'success');
});

// Save Integrations
document.getElementById('integrationsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedSettings = {
        googleAnalytics: document.getElementById('googleAnalytics').checked,
        gaTrackingId: document.getElementById('gaTrackingId').value,
        facebookPixel: document.getElementById('facebookPixel').checked,
        fpPixelId: document.getElementById('fpPixelId').value,
        paymentGateway: document.getElementById('paymentGateway').checked,
        paymentProvider: document.getElementById('paymentProvider').value
    };
    await saveSettings(updatedSettings);
    showToast('Integration settings saved', 'success');
});

// Save settings to Firestore
async function saveSettings(updatedSettings) {
    try {
        const settingsRef = doc(db, 'settings', 'platform');
        Object.assign(settings, updatedSettings);
        await setDoc(settingsRef, settings, { merge: true });
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Failed to save settings', 'error');
    }
}

// Color picker sync
document.getElementById('primaryColor')?.addEventListener('input', (e) => {
    document.getElementById('primaryColorHex').value = e.target.value;
});
document.getElementById('primaryColorHex')?.addEventListener('input', (e) => {
    document.getElementById('primaryColor').value = e.target.value;
});
document.getElementById('secondaryColor')?.addEventListener('input', (e) => {
    document.getElementById('secondaryColorHex').value = e.target.value;
});
document.getElementById('secondaryColorHex')?.addEventListener('input', (e) => {
    document.getElementById('secondaryColor').value = e.target.value;
});

// Backup functionality
document.getElementById('createBackupBtn')?.addEventListener('click', async () => {
    showToast('Creating backup...', 'info');
    // Simulate backup creation
    setTimeout(() => {
        const backupData = {
            timestamp: new Date().toISOString(),
            users: 'User data exported',
            courses: 'Course data exported',
            settings: settings
        };
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dbi_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Backup created successfully', 'success');
    }, 1500);
});

document.getElementById('restoreBackupBtn')?.addEventListener('click', () => {
    const fileInput = document.getElementById('backupFile');
    if (!fileInput.files.length) {
        showToast('Please select a backup file', 'error');
        return;
    }
    showToast('Restore functionality coming soon', 'info');
});

document.getElementById('resetPlatformBtn')?.addEventListener('click', () => {
    if (confirm('⚠️ WARNING: This will reset all platform settings to default. This action cannot be undone. Are you absolutely sure?')) {
        showToast('Reset functionality coming soon', 'info');
    }
});

// Settings navigation
function setupSettingsNavigation() {
    const navItems = document.querySelectorAll('.settings-nav-item');
    const sections = {
        'profile': document.getElementById('profileSection'),
        'general': document.getElementById('generalSection'),
        'appearance': document.getElementById('appearanceSection'),
        'email': document.getElementById('emailSection'),
        'features': document.getElementById('featuresSection'),
        'security': document.getElementById('securitySection'),
        'integrations': document.getElementById('integrationsSection'),
        'backup': document.getElementById('backupSection')
    };
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            Object.values(sections).forEach(sectionEl => {
                if (sectionEl) sectionEl.classList.add('hidden');
            });
            if (sections[section]) sections[section].classList.remove('hidden');
        });
    });
}

// Load notifications
async function loadNotifications(userId) {
    try {
        const snapshot = await getDocs(query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false)));
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
    setupSettingsNavigation();
    setupSidebar();
    setupDropdowns();
    document.querySelectorAll('#logoutBtn, #logoutDropdown').forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); logout(); }));
});

const style = document.createElement('style');
style.textContent = `.animate-fade-in { animation: fadeIn 0.3s ease; } @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`;
document.head.appendChild(style);