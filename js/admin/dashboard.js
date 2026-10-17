import { 
    auth, 
    signOut,
    db,
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    onAuthStateChanged,
    orderBy,
    limit,
    updateDoc
} from '../firebase-config.js';

let currentAdmin = null;
let adminData = {};

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../login.html';
    } else {
        // Verify admin role
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
        await loadDashboardStats();
        await loadRecentActivity();
        await loadRecentCompletions();
        await loadNotifications(user.uid);
        await initCharts();
        
        // Setup notification dropdown
        setupNotificationDropdown();
    }
});

// Load admin data
async function loadAdminData(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            adminData = userDoc.data();
            
            // Update sidebar
            document.getElementById('adminName').textContent = adminData.fullName || 'Administrator';
            document.getElementById('adminRole').textContent = adminData.role === 'super_admin' ? 'Super Administrator' : 'Administrator';
            
            // Update welcome message
            document.getElementById('welcomeMessage').textContent = `Welcome back, ${adminData.fullName || 'Admin'}!`;
            
            // Update avatars
            const avatarName = encodeURIComponent(adminData.fullName || 'Admin');
            const avatarUrl = `https://ui-avatars.com/api/?background=1e88e5&color=fff&bold=true&size=40&name=${avatarName}`;
            
            const adminAvatar = document.getElementById('adminAvatar');
            const dropdownAvatar = document.getElementById('dropdownAvatar');
            
            if (adminAvatar) adminAvatar.src = avatarUrl;
            if (dropdownAvatar) dropdownAvatar.src = avatarUrl;
        }
    } catch (error) {
        console.error('Error loading admin data:', error);
    }
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        // Get total users
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        const totalUsers = usersSnapshot.size;
        
        // Get courses
        const coursesRef = collection(db, 'courses');
        const coursesSnapshot = await getDocs(coursesRef);
        const totalCourses = coursesSnapshot.size;
        
        // Get enrollments
        const enrollmentsRef = collection(db, 'enrollments');
        const enrollmentsSnapshot = await getDocs(enrollmentsRef);
        const totalEnrollments = enrollmentsSnapshot.size;
        
        // Calculate completion rate
        let completedEnrollments = 0;
        enrollmentsSnapshot.forEach(enrollmentDoc => {
            if (enrollmentDoc.data().status === 'completed') completedEnrollments++;
        });
        const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;
        
        // Update UI
        document.getElementById('totalUsers').textContent = totalUsers;
        document.getElementById('totalCourses').textContent = totalCourses;
        document.getElementById('totalEnrollments').textContent = totalEnrollments;
        document.getElementById('completionRate').textContent = `${completionRate}%`;
        
        // Calculate new users this week
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        let newUsers = 0;
        usersSnapshot.forEach(userDoc => {
            const createdAt = userDoc.data().createdAt;
            if (createdAt) {
                const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
                if (date > oneWeekAgo) newUsers++;
            }
        });
        document.getElementById('newUsers').textContent = `+${newUsers}`;
        
        // Calculate new courses this month
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        let newCourses = 0;
        coursesSnapshot.forEach(courseDoc => {
            const createdAt = courseDoc.data().createdAt;
            if (createdAt) {
                const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
                if (date > oneMonthAgo) newCourses++;
            }
        });
        document.getElementById('newCourses').textContent = `+${newCourses}`;
        
        // Calculate new enrollments this month
        let newEnrollments = 0;
        enrollmentsSnapshot.forEach(enrollmentDoc => {
            const enrolledAt = enrollmentDoc.data().enrolledAt;
            if (enrolledAt) {
                const date = enrolledAt.toDate ? enrolledAt.toDate() : new Date(enrolledAt);
                if (date > oneMonthAgo) newEnrollments++;
            }
        });
        document.getElementById('newEnrollments').textContent = `+${newEnrollments}`;
        
        // Update pending count in sidebar
        document.getElementById('pendingCount').textContent = '0';
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Load recent activity
async function loadRecentActivity() {
    const container = document.getElementById('activityList');
    
    try {
        // Combine different activities
        const activities = [];
        
        // Get recent users
        const usersRef = collection(db, 'users');
        const usersQuery = query(usersRef, orderBy('createdAt', 'desc'), limit(3));
        const usersSnapshot = await getDocs(usersQuery);
        usersSnapshot.forEach(userDoc => {
            const user = userDoc.data();
            activities.push({
                type: 'user',
                action: `New user registered: ${user.fullName || user.email}`,
                date: user.createdAt,
                icon: 'fa-user-plus',
                color: 'blue'
            });
        });
        
        // Get recent courses
        const coursesRef = collection(db, 'courses');
        const coursesQuery = query(coursesRef, orderBy('createdAt', 'desc'), limit(3));
        const coursesSnapshot = await getDocs(coursesQuery);
        coursesSnapshot.forEach(courseDoc => {
            const course = courseDoc.data();
            activities.push({
                type: 'course',
                action: `New course created: ${course.title}`,
                date: course.createdAt,
                icon: 'fa-book',
                color: 'green'
            });
        });
        
        // Get recent enrollments
        const enrollmentsRef = collection(db, 'enrollments');
        const enrollmentsQuery = query(enrollmentsRef, orderBy('enrolledAt', 'desc'), limit(3));
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        enrollmentsSnapshot.forEach(enrollmentDoc => {
            const enrollment = enrollmentDoc.data();
            activities.push({
                type: 'enrollment',
                action: `Student enrolled in: ${enrollment.courseTitle || 'a course'}`,
                date: enrollment.enrolledAt,
                icon: 'fa-graduation-cap',
                color: 'purple'
            });
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
            <div class="activity-item flex items-center space-x-3 p-3 border border-gray-100 rounded-lg">
                <div class="w-8 h-8 bg-${activity.color}-100 rounded-full flex items-center justify-center">
                    <i class="fas ${activity.icon} text-${activity.color}-600 text-sm"></i>
                </div>
                <div class="flex-1">
                    <p class="text-sm text-gray-800">${activity.action}</p>
                    <p class="text-xs text-gray-500">${getTimeAgo(activity.date)}</p>
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

// Load recent course completions - FIXED: renamed loop variable to avoid conflict with imported doc
async function loadRecentCompletions() {
    const container = document.getElementById('completionsList');
    
    try {
        const enrollmentsRef = collection(db, 'enrollments');
        const completionsQuery = query(
            enrollmentsRef, 
            where('status', '==', 'completed'), 
            orderBy('completedAt', 'desc'), 
            limit(5)
        );
        const completionsSnapshot = await getDocs(completionsQuery);
        
        const completions = [];
        for (const completionDoc of completionsSnapshot.docs) {
            const completion = completionDoc.data();
            // Get student name - use a different variable name to avoid conflict
            const studentDoc = await getDoc(doc(db, 'users', completion.studentId));
            const studentName = studentDoc.exists() ? studentDoc.data().fullName || 'Student' : 'Student';
            
            completions.push({
                ...completion,
                studentName: studentName,
                id: completionDoc.id
            });
        }
        
        document.getElementById('completionCount').textContent = `${completions.length} completions`;
        
        if (completions.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-trophy text-gray-300 text-3xl mb-2"></i>
                    <p class="text-gray-500">No course completions yet</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = completions.map(completion => `
            <div class="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <i class="fas fa-trophy text-green-600"></i>
                    </div>
                    <div class="flex-1">
                        <h3 class="font-medium text-gray-800">${escapeHtml(completion.studentName)}</h3>
                        <p class="text-sm text-gray-600">Completed: ${escapeHtml(completion.courseTitle || 'a course')}</p>
                        <p class="text-xs text-gray-500 mt-1">${getTimeAgo(completion.completedAt)}</p>
                    </div>
                    <a href="../admin/student-details.html?id=${completion.studentId}" 
                       class="text-[#1e88e5] text-sm hover:underline">
                        View Profile
                    </a>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading completions:', error);
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-exclamation-circle text-gray-300 text-3xl mb-2"></i>
                <p class="text-gray-500">Unable to load completions</p>
            </div>
        `;
    }
}

// Load notifications with dropdown
async function loadNotifications(userId) {
    try {
        const notificationsRef = collection(db, 'notifications');
        const q = query(
            notificationsRef, 
            where('userId', '==', userId), 
            orderBy('createdAt', 'desc'), 
            limit(10)
        );
        const snapshot = await getDocs(q);
        
        const unreadCount = snapshot.docs.filter(docSnapshot => !docSnapshot.data().read).length;
        document.getElementById('notificationCount').textContent = unreadCount;
        
        // Store notifications for dropdown
        window.notifications = [];
        snapshot.forEach(docSnapshot => {
            window.notifications.push({ id: docSnapshot.id, ...docSnapshot.data() });
        });
        
        updateNotificationDropdown();
        
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// Update notification dropdown
function updateNotificationDropdown() {
    const container = document.getElementById('notificationList');
    if (!container) return;
    
    const notifications = window.notifications || [];
    
    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="p-4 text-center text-gray-500">
                <i class="fas fa-bell-slash text-2xl mb-2"></i>
                <p class="text-sm">No notifications</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = notifications.map(notif => `
        <div class="notification-item p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${!notif.read ? 'bg-blue-50' : ''}"
             data-id="${notif.id}">
            <div class="flex items-start space-x-3">
                <div class="w-8 h-8 bg-${getNotificationColor(notif.type)}-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <i class="fas ${getNotificationIcon(notif.type)} text-${getNotificationColor(notif.type)}-600 text-sm"></i>
                </div>
                <div class="flex-1">
                    <p class="text-sm font-medium text-gray-800">${escapeHtml(notif.title || 'Notification')}</p>
                    <p class="text-xs text-gray-600 mt-1">${escapeHtml(notif.message || '')}</p>
                    <p class="text-xs text-gray-400 mt-1">${getTimeAgo(notif.createdAt)}</p>
                </div>
                ${!notif.read ? '<span class="w-2 h-2 bg-blue-500 rounded-full mt-2"></span>' : ''}
            </div>
        </div>
    `).join('');
    
    // Add click handlers for notifications
    document.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', async () => {
            const notifId = item.dataset.id;
            await markNotificationAsRead(notifId);
        });
    });
}

// Mark notification as read
async function markNotificationAsRead(notificationId) {
    try {
        await updateDoc(doc(db, 'notifications', notificationId), {
            read: true
        });
        
        // Reload notifications
        await loadNotifications(currentAdmin.uid);
        
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

// Mark all notifications as read
async function markAllNotificationsAsRead() {
    if (!window.notifications) return;
    
    try {
        const promises = window.notifications.map(notif => 
            updateDoc(doc(db, 'notifications', notif.id), { read: true })
        );
        await Promise.all(promises);
        
        await loadNotifications(currentAdmin.uid);
        showToast('All notifications marked as read', 'success');
        
    } catch (error) {
        console.error('Error marking all as read:', error);
        showToast('Failed to mark all as read', 'error');
    }
}

// Get notification icon based on type
function getNotificationIcon(type) {
    const icons = {
        'user': 'fa-user-plus',
        'course': 'fa-book',
        'enrollment': 'fa-graduation-cap',
        'completion': 'fa-trophy',
        'quiz': 'fa-question-circle',
        'instructor_approval': 'fa-user-check',
        'instructor_rejection': 'fa-user-times',
        'default': 'fa-bell'
    };
    return icons[type] || icons.default;
}

// Get notification color based on type
function getNotificationColor(type) {
    const colors = {
        'user': 'blue',
        'course': 'green',
        'enrollment': 'purple',
        'completion': 'yellow',
        'quiz': 'orange',
        'instructor_approval': 'green',
        'instructor_rejection': 'red',
        'default': 'gray'
    };
    return colors[type] || colors.default;
}

// Setup notification dropdown
function setupNotificationDropdown() {
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const markAllReadBtn = document.getElementById('markAllRead');
    
    if (notificationBtn && notificationDropdown) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationDropdown.classList.toggle('hidden');
        });
        
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', () => {
                markAllNotificationsAsRead();
            });
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!notificationDropdown.contains(e.target) && e.target !== notificationBtn) {
                notificationDropdown.classList.add('hidden');
            }
        });
    }
}

// Initialize charts
async function initCharts() {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    script.onload = () => {
        createUserGrowthChart();
        createCourseChart();
    };
    document.head.appendChild(script);
}

// Create user growth chart
async function createUserGrowthChart() {
    const ctx = document.getElementById('userGrowthChart')?.getContext('2d');
    if (!ctx) return;
    
    const months = [];
    const userCounts = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(month.toLocaleString('default', { month: 'short' }));
        
        const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
        const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
        
        const usersRef = collection(db, 'users');
        // Note: For production, you'd need an index on createdAt
        // This is simplified for demo
        const q = query(usersRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        let count = 0;
        snapshot.forEach(userDoc => {
            const createdAt = userDoc.data().createdAt;
            if (createdAt) {
                const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
                if (date >= startOfMonth && date <= endOfMonth) {
                    count++;
                }
            }
        });
        userCounts.push(count);
    }
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'New Users',
                data: userCounts,
                borderColor: '#1e88e5',
                backgroundColor: 'rgba(30, 136, 229, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } }
        }
    });
}

// Create course chart
async function createCourseChart() {
    const ctx = document.getElementById('courseChart')?.getContext('2d');
    if (!ctx) return;
    
    const enrollmentsRef = collection(db, 'enrollments');
    const snapshot = await getDocs(enrollmentsRef);
    
    const courseEnrollment = {};
    snapshot.forEach(enrollmentDoc => {
        const courseTitle = enrollmentDoc.data().courseTitle || 'Unknown';
        courseEnrollment[courseTitle] = (courseEnrollment[courseTitle] || 0) + 1;
    });
    
    const sortedCourses = Object.entries(courseEnrollment)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    if (sortedCourses.length === 0) {
        // No data, show placeholder
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['No Data'],
                datasets: [{
                    label: 'Enrollments',
                    data: [0],
                    backgroundColor: '#e5e7eb',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } }
            }
        });
        return;
    }
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedCourses.map(c => c[0]),
            datasets: [{
                label: 'Enrollments',
                data: sortedCourses.map(c => c[1]),
                backgroundColor: '#00c853',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Number of Enrollments' } } }
        }
    });
}

// Get time ago string
function getTimeAgo(date) {
    if (!date) return 'Just now';
    const d = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const diff = now - d;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return d.toLocaleDateString();
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

// Sidebar toggle functionality
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