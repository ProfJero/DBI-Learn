import { auth } from './firebase-config.js';
import { checkAuthState } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize sidebar functionality
    initializeSidebar();
    
    // Check authentication state
    checkAuthState((user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        
        // Update UI with user info
        updateUserInfo(user);
    });
    
    // Initialize search functionality
    initializeSearch();
    
    // Initialize resource interactions
    initializeResourceButtons();
});

function initializeSidebar() {
    // Set active nav link based on current page
    const currentPage = window.location.pathname.split('/').pop() || 'resources.html';
    const navLinks = document.querySelectorAll('.nav-item');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('bg-emerald-50', 'text-emerald-600');
            const iconDiv = link.querySelector('.nav-icon');
            if (iconDiv) {
                iconDiv.classList.add('bg-emerald-100');
                const svg = iconDiv.querySelector('svg');
                if (svg) {
                    svg.classList.add('text-emerald-600');
                }
            }
        }
    });
    
    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (mobileMenuBtn && sidebar && overlay) {
        // Remove any existing event listeners
        mobileMenuBtn.replaceWith(mobileMenuBtn.cloneNode(true));
        const newMobileMenuBtn = document.getElementById('mobileMenuBtn');
        
        newMobileMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            sidebar.classList.toggle('-translate-x-full');
            overlay.classList.toggle('hidden');
        });
        
        overlay.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('hidden');
        });
    }
    
    // Logout functionality
    const logoutBtn = document.getElementById('sidebarLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await auth.signOut();
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }
}

function updateUserInfo(user) {
    const sidebarInitials = document.getElementById('sidebarUserInitials');
    const sidebarName = document.getElementById('sidebarUserName');
    const sidebarRole = document.getElementById('sidebarUserRole');
    
    // Update stats in sidebar
    const sidebarCourseCount = document.getElementById('sidebarCourseCount');
    const sidebarProgressCount = document.getElementById('sidebarProgressCount');
    const sidebarBadgeCount = document.getElementById('sidebarBadgeCount');
    
    if (user.displayName) {
        const names = user.displayName.split(' ');
        const initials = names.map(n => n[0]).join('').toUpperCase().substring(0, 2);
        
        if (sidebarInitials) sidebarInitials.textContent = initials;
        if (sidebarName) sidebarName.textContent = user.displayName;
    } else {
        if (sidebarInitials) sidebarInitials.textContent = user.email?.substring(0, 2).toUpperCase() || 'ST';
        if (sidebarName) sidebarName.textContent = user.email?.split('@')[0] || 'Student';
    }
    
    if (sidebarRole) sidebarRole.textContent = 'Student';
    
    // Update stats (these would normally come from Firebase)
    if (sidebarCourseCount) sidebarCourseCount.textContent = '6';
    if (sidebarProgressCount) sidebarProgressCount.textContent = '75%';
    if (sidebarBadgeCount) sidebarBadgeCount.textContent = '3';
}

function initializeSearch() {
    const searchInput = document.querySelector('input[placeholder="Search resources..."]');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            const query = e.target.value.trim().toLowerCase();
            if (query.length > 2) {
                searchResources(query);
            } else if (query.length === 0) {
                resetResourceDisplay();
            }
        }, 500));
    }
}

function initializeResourceButtons() {
    // Only target download buttons in resource cards
    const downloadButtons = document.querySelectorAll('.resource-download-btn, button:has(svg[stroke="currentColor"])');
    
    downloadButtons.forEach(button => {
        // Skip if this is the mobile menu button
        if (button.id === 'mobileMenuBtn' || button.closest('#mobileMenuBtn')) {
            return;
        }
        
        // Skip if this is a category card
        if (button.closest('.cursor-pointer') && !button.closest('.bg-white:not(.cursor-pointer)')) {
            return;
        }
        
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const resourceCard = button.closest('.bg-white');
            if (resourceCard) {
                const resourceTitle = resourceCard.querySelector('h3, h4')?.textContent || 'Resource';
                handleResourceDownload(resourceTitle);
            }
        });
    });
    
    // Add click handlers for category cards
    const categoryCards = document.querySelectorAll('.grid-cols-1.md\\:grid-cols-4 .cursor-pointer');
    categoryCards.forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const category = card.querySelector('h3')?.textContent;
            if (category) {
                filterByCategory(category);
            }
        });
    });
}

function searchResources(query) {
    console.log('Searching for:', query);
    // Implement search functionality
    // This would normally filter the resources based on the query
    highlightSearchResults(query);
}

function highlightSearchResults(query) {
    const resourceTitles = document.querySelectorAll('h3, h4');
    resourceTitles.forEach(title => {
        const text = title.textContent.toLowerCase();
        if (text.includes(query)) {
            title.closest('.bg-white')?.classList.add('ring-2', 'ring-emerald-500', 'ring-opacity-50');
        } else {
            title.closest('.bg-white')?.classList.remove('ring-2', 'ring-emerald-500', 'ring-opacity-50');
        }
    });
}

function resetResourceDisplay() {
    const resourceCards = document.querySelectorAll('.bg-white');
    resourceCards.forEach(card => {
        card.classList.remove('ring-2', 'ring-emerald-500', 'ring-opacity-50');
    });
}

function filterByCategory(category) {
    console.log('Filtering by category:', category);
    // Implement category filtering
    // This would normally show only resources in the selected category
}

function handleResourceDownload(resourceTitle) {
    console.log('Downloading:', resourceTitle);
    // Implement download functionality
    // This would normally trigger the actual file download
    
    // Show a temporary notification (you can enhance this)
    alert(`Downloading ${resourceTitle}...`);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}