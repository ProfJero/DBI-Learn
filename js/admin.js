import { auth, signOut } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is admin
    const userRole = localStorage.getItem('userRole');
    const username = localStorage.getItem('username');
    
    if (!userRole || (userRole !== 'super_admin' && userRole !== 'instructor')) {
        window.location.href = '../login.html';
        return;
    }
    
    // Update admin info display
    updateAdminInfo(userRole, username);
    
    // Logout functionality
    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if(confirm('Are you sure you want to logout?')) {
                try {
                    localStorage.removeItem('userRole');
                    localStorage.removeItem('username');
                    localStorage.removeItem('rememberedUsername');
                    
                    if (auth.currentUser) {
                        await signOut(auth);
                    }
                    window.location.href = '../login.html';
                } catch (error) {
                    console.error('Logout error:', error);
                }
            }
        });
    }
    
    // Set active nav item based on URL
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    const navItems = document.querySelectorAll('.admin-nav-item');
    
    navItems.forEach(item => {
        const href = item.getAttribute('href');
        // Remove default active class first
        item.classList.remove('bg-emerald-700', 'text-white');
        
        if (href === currentPage) {
            item.classList.add('bg-emerald-700', 'text-white');
        }
    });
});

function updateAdminInfo(role, username) {
    const adminInitials = document.getElementById('adminInitials');
    const adminName = document.getElementById('adminName');
    const adminRole = document.getElementById('adminRole');
    
    if (role === 'super_admin') {
        if (adminInitials) adminInitials.textContent = 'SA';
        if (adminName) adminName.textContent = 'Super Admin';
        if (adminRole) adminRole.textContent = 'Administrator';
    } else if (role === 'instructor') {
        // Logic to create initials from username (e.g., "John Doe" -> "JD")
        const displayName = username || 'Instructor';
        if (adminName) adminName.textContent = displayName;
        if (adminRole) adminRole.textContent = 'Course Instructor';
        
        if (adminInitials) {
            const initials = displayName
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .substring(0, 2);
            adminInitials.textContent = initials || 'IN';
        }
    }
}