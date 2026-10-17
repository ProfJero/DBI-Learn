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
    
    // Load dashboard data
    loadDashboardData();
    
    // Search functionality
    const searchInput = document.getElementById('search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            const query = e.target.value.trim();
            if (query.length > 2) {
                searchCourses(query);
            }
        }, 500));
    }
});

function initializeSidebar() {
    // Set active nav link based on current page
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
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
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('-translate-x-full');
            overlay.classList.toggle('hidden');
        });
        
        overlay.addEventListener('click', () => {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('hidden');
        });
    }
    
    // Logout functionality
    const logoutBtn = document.getElementById('sidebarLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
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
    // Update sidebar user info
    const sidebarInitials = document.getElementById('sidebarUserInitials');
    const sidebarName = document.getElementById('sidebarUserName');
    const sidebarRole = document.getElementById('sidebarUserRole');
    const studentName = document.getElementById('studentName');
    
    // Update stats in sidebar
    const sidebarCourseCount = document.getElementById('sidebarCourseCount');
    const sidebarProgressCount = document.getElementById('sidebarProgressCount');
    const sidebarBadgeCount = document.getElementById('sidebarBadgeCount');
    
    if (user.displayName) {
        const names = user.displayName.split(' ');
        const initials = names.map(n => n[0]).join('').toUpperCase().substring(0, 2);
        
        if (sidebarInitials) sidebarInitials.textContent = initials;
        if (sidebarName) sidebarName.textContent = user.displayName;
        if (studentName) studentName.textContent = names[0];
    } else {
        if (sidebarInitials) sidebarInitials.textContent = user.email?.substring(0, 2).toUpperCase() || 'ST';
        if (sidebarName) sidebarName.textContent = user.email?.split('@')[0] || 'Student';
        if (studentName) studentName.textContent = 'Student';
    }
    
    if (sidebarRole) sidebarRole.textContent = 'Student';
    
    // Update stats (these would normally come from Firebase)
    if (sidebarCourseCount) sidebarCourseCount.textContent = '6';
    if (sidebarProgressCount) sidebarProgressCount.textContent = '75%';
    if (sidebarBadgeCount) sidebarBadgeCount.textContent = '3';
    
    // Update main stats
    const statCourses = document.getElementById('statCourses');
    const statCompleted = document.getElementById('statCompleted');
    const statHours = document.getElementById('statHours');
    const statAchievements = document.getElementById('statAchievements');
    
    if (statCourses) statCourses.textContent = '6';
    if (statCompleted) statCompleted.textContent = '24';
    if (statHours) statHours.textContent = '48';
    if (statAchievements) statAchievements.textContent = '8';
}

function loadDashboardData() {
    loadContinueLearning();
    loadRecommendedCourses();
    loadRecentActivity();
}

function loadContinueLearning() {
    const container = document.getElementById('continueLearning');
    if (!container) return;
    
    const courses = [
        {
            id: 1,
            title: 'Complete Web Development Bootcamp',
            instructor: 'Dr. Kwame Asante',
            progress: 75,
            thumbnail: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6',
            lastAccessed: '2 hours ago'
        },
        {
            id: 2,
            title: 'Python for Data Science',
            instructor: 'Prof. Mensah',
            progress: 45,
            thumbnail: 'https://images.unsplash.com/photo-1526379095098-400b3a3d6d9f',
            lastAccessed: 'Yesterday'
        },
        {
            id: 3,
            title: 'UI/UX Design Fundamentals',
            instructor: 'Esi Mawusi',
            progress: 30,
            thumbnail: 'https://images.unsplash.com/photo-1561070791-2526d30994b5',
            lastAccessed: '3 days ago'
        }
    ];
    
    container.innerHTML = courses.map(course => `
        <div class="bg-white rounded-xl shadow overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1">
            <div class="h-40 bg-gradient-to-r from-emerald-500 to-orange-500 relative">
                <img src="${course.thumbnail}" alt="${course.title}" class="w-full h-full object-cover opacity-20">
                <div class="absolute inset-0 bg-black bg-opacity-20"></div>
                <div class="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                    ${course.lastAccessed}
                </div>
            </div>
            <div class="p-4">
                <h4 class="font-semibold text-gray-800 mb-1 line-clamp-1">${course.title}</h4>
                <p class="text-sm text-gray-600 mb-3">${course.instructor}</p>
                <div class="mb-2">
                    <div class="flex items-center justify-between text-xs mb-1">
                        <span class="text-gray-600">Progress</span>
                        <span class="font-medium text-emerald-600">${course.progress}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-emerald-500 h-2 rounded-full" style="width: ${course.progress}%"></div>
                    </div>
                </div>
                <button onclick="continueCourse(${course.id})" 
                    class="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                    Continue Learning
                </button>
            </div>
        </div>
    `).join('');
}

function loadRecommendedCourses() {
    const container = document.getElementById('recommendedCourses');
    if (!container) return;
    
    const courses = [
        {
            id: 4,
            title: 'Advanced JavaScript',
            instructor: 'Michael Ansah',
            duration: '8 weeks',
            level: 'Intermediate',
            rating: 4.8,
            students: 1234,
            thumbnail: 'https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a'
        },
        {
            id: 5,
            title: 'Data Analysis with Python',
            instructor: 'Dr. Ama Serwaa',
            duration: '10 weeks',
            level: 'Beginner',
            rating: 4.9,
            students: 2341,
            thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71'
        },
        {
            id: 6,
            title: 'Graphic Design Masterclass',
            instructor: 'Kofi Annan',
            duration: '6 weeks',
            level: 'All Levels',
            rating: 4.7,
            students: 3421,
            thumbnail: 'https://images.unsplash.com/photo-1626785774573-4b799315345d'
        },
        {
            id: 7,
            title: 'Cybersecurity Basics',
            instructor: 'Nana Ama',
            duration: '8 weeks',
            level: 'Beginner',
            rating: 4.6,
            students: 892,
            thumbnail: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b'
        }
    ];
    
    container.innerHTML = courses.map(course => `
        <div class="bg-white rounded-xl shadow overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1">
            <div class="h-32 bg-gradient-to-r from-emerald-500 to-orange-500 relative">
                <img src="${course.thumbnail}" alt="${course.title}" class="w-full h-full object-cover opacity-20">
            </div>
            <div class="p-4">
                <h4 class="font-semibold text-gray-800 mb-1 line-clamp-1">${course.title}</h4>
                <p class="text-xs text-gray-600 mb-2">${course.instructor}</p>
                <div class="flex items-center mb-2">
                    <div class="flex items-center">
                        <svg class="h-4 w-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                        </svg>
                        <span class="text-xs text-gray-600 ml-1">${course.rating}</span>
                    </div>
                    <span class="text-xs text-gray-400 mx-2">•</span>
                    <span class="text-xs text-gray-600">${course.students} students</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-xs font-medium px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                        ${course.level}
                    </span>
                    <span class="text-xs text-gray-500">${course.duration}</span>
                </div>
                <button onclick="enrollCourse(${course.id})" 
                    class="w-full mt-3 border border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white text-sm font-medium py-2 rounded-lg transition-colors">
                    Enroll Now
                </button>
            </div>
        </div>
    `).join('');
}

function loadRecentActivity() {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    
    const activities = [
        {
            type: 'lesson',
            title: 'Completed "Introduction to HTML"',
            course: 'Web Development Bootcamp',
            time: '2 hours ago',
            icon: 'check-circle'
        },
        {
            type: 'quiz',
            title: 'Scored 85% on CSS Quiz',
            course: 'Web Development Bootcamp',
            time: 'Yesterday',
            icon: 'clipboard-check'
        },
        {
            type: 'achievement',
            title: 'Earned "Quick Learner" badge',
            course: 'Python for Data Science',
            time: '3 days ago',
            icon: 'badge'
        }
    ];
    
    container.innerHTML = activities.map(activity => `
        <div class="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
            <div class="h-8 w-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg class="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    ${getActivityIcon(activity.icon)}
                </svg>
            </div>
            <div class="flex-1">
                <p class="text-sm font-medium text-gray-800">${activity.title}</p>
                <p class="text-xs text-gray-500">${activity.course} • ${activity.time}</p>
            </div>
        </div>
    `).join('');
}

function getActivityIcon(icon) {
    const icons = {
        'check-circle': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>',
        'clipboard-check': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>',
        'badge': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>'
    };
    return icons[icon] || '';
}

function searchCourses(query) {
    console.log('Searching for:', query);
    // Implement search functionality
}

function continueCourse(courseId) {
    window.location.href = `course-detail.html?id=${courseId}`;
}

function enrollCourse(courseId) {
    window.location.href = `course-detail.html?id=${courseId}&enroll=true`;
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

// Make functions available globally for onclick handlers
window.continueCourse = continueCourse;
window.enrollCourse = enrollCourse;