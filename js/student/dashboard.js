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
    limit
} from '../firebase-config.js';

// Global variables
let currentUser = null;
let enrolledCoursesData = [];
let courseProgress = {};

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../login.html';
    } else {
        currentUser = user;
        await loadUserData(user.uid);
        await loadDashboardData(user.uid);
        await loadNotifications(user.uid);
    }
});

// Load user data
async function loadUserData(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Update UI with user data
            document.getElementById('userName').textContent = userData.fullName || 'Student';
            document.getElementById('userRole').textContent = userData.role || 'Student';
            document.getElementById('welcomeMessage').textContent = `Welcome back, ${userData.fullName || 'Student'}!`;
            
            // Update avatars
            const avatarName = encodeURIComponent(userData.fullName || 'Student');
            const avatarUrl = `https://ui-avatars.com/api/?background=1e88e5&color=fff&bold=true&size=40&name=${avatarName}`;
            
            const userAvatar = document.getElementById('userAvatar');
            const dropdownAvatar = document.getElementById('dropdownAvatar');
            
            if (userAvatar) userAvatar.src = avatarUrl;
            if (dropdownAvatar) dropdownAvatar.src = avatarUrl;
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Load dashboard data
async function loadDashboardData(userId) {
    try {
        // Load enrolled courses
        await loadEnrolledCourses(userId);
        
        // Load certificates count
        await loadCertificatesCount(userId);
        
        // Load learning hours from course progress
        // await loadLearningHours(userId);
        
        // Load deadlines (quizzes and assignments)
        await loadDeadlines(userId);
        
        // Load recommended courses
        await loadRecommendedCourses(userId);
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showToast('Error loading dashboard data', 'error');
    }
}

// Load enrolled courses
async function loadEnrolledCourses(userId) {
    try {
        const enrollmentsRef = collection(db, 'enrollments');
        const q = query(enrollmentsRef, where('studentId', '==', userId));
        const enrollmentsSnapshot = await getDocs(q);
        
        enrolledCoursesData = [];
        const courseIds = [];
        
        enrollmentsSnapshot.forEach(doc => {
            const enrollment = { id: doc.id, ...doc.data() };
            enrolledCoursesData.push(enrollment);
            if (enrollment.courseId) {
                courseIds.push(enrollment.courseId);
            }
        });
        
        // Fetch course details for each enrollment
        const coursesMap = new Map();
        for (const courseId of courseIds) {
            const courseDoc = await getDoc(doc(db, 'courses', courseId));
            if (courseDoc.exists()) {
                coursesMap.set(courseId, { id: courseDoc.id, ...courseDoc.data() });
            }
        }
        
        // Combine enrollment data with course details
        const completeCourses = enrolledCoursesData.map(enrollment => {
            const course = coursesMap.get(enrollment.courseId);
            return {
                ...enrollment,
                courseTitle: course?.title || 'Unknown Course',
                courseLevel: course?.level || 'Beginner',
                courseDuration: course?.duration || 0,
                courseCategory: course?.category || 'General',
                courseImage: course?.imageUrl || null,
                progress: enrollment.progress || 0
            };
        });
        
        // Update stats
        const enrolledCount = completeCourses.length;
        const completedCount = completeCourses.filter(course => course.progress >= 100 || course.status === 'completed').length;
        
        document.getElementById('enrolledCount').textContent = enrolledCount;
        document.getElementById('completedCount').textContent = completedCount;
        
        // Update course count in sidebar
        document.getElementById('courseCount').textContent = enrolledCount;
        
        // Display in-progress courses
        const inProgressCourses = completeCourses.filter(course => 
            (course.progress < 100 && course.status !== 'completed') || !course.progress
        );
        displayInProgressCourses(inProgressCourses);
        
    } catch (error) {
        console.error('Error loading enrolled courses:', error);
        document.getElementById('enrolledCount').textContent = '0';
        document.getElementById('completedCount').textContent = '0';
        document.getElementById('inProgressCourses').innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-exclamation-circle text-4xl text-gray-300 mb-2"></i>
                <p class="text-gray-500">Error loading courses</p>
                <button onclick="location.reload()" class="text-[#1e88e5] text-sm mt-2 inline-block">Retry →</button>
            </div>
        `;
    }
}

// Load certificates count
async function loadCertificatesCount(userId) {
    try {
        const certificatesRef = collection(db, 'certificates');
        const q = query(certificatesRef, where('studentId', '==', userId));
        const snapshot = await getDocs(q);
        document.getElementById('certificateCount').textContent = snapshot.size;
    } catch (error) {
        console.error('Error loading certificates:', error);
        document.getElementById('certificateCount').textContent = '0';
    }
}

// Load learning hours from course progress
// Load learning hours from course progress
async function loadLearningHours(userId) {
    try {
        // First, check if the collection exists by trying to query it
        const progressRef = collection(db, 'courseProgress');
        const q = query(progressRef, where('studentId', '==', userId));
        const snapshot = await getDocs(q);
        
        let totalHours = 0;
        snapshot.forEach(doc => {
            const progress = doc.data();
            totalHours += progress.timeSpent || 0;
        });
        
        // Convert minutes to hours with 1 decimal
        const hours = (totalHours / 60).toFixed(1);
        document.getElementById('learningHours').textContent = hours;
        
    } catch (error) {
        console.error('Error loading learning hours:', error);
        
        // If the collection doesn't exist or permissions error, use fallback calculation
        if (error.code === 'permission-denied' || error.code === 'not-found') {
            console.log('Using fallback calculation for learning hours');
            await calculateLearningHoursFromEnrollments(userId);
        } else {
            document.getElementById('learningHours').textContent = '0';
        }
    }
}

// Fallback: Calculate learning hours from enrollments and course data
async function calculateLearningHoursFromEnrollments(userId) {
    try {
        // Get all enrollments for the user
        const enrollmentsRef = collection(db, 'enrollments');
        const enrollmentsQuery = query(enrollmentsRef, where('studentId', '==', userId));
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        
        if (enrollmentsSnapshot.empty) {
            document.getElementById('learningHours').textContent = '0';
            return;
        }
        
        let totalEstimatedHours = 0;
        let processedCourses = 0;
        
        // Loop through each enrollment to calculate estimated learning time
        for (const enrollmentDoc of enrollmentsSnapshot.docs) {
            const enrollment = enrollmentDoc.data();
            const courseId = enrollment.courseId;
            const progress = enrollment.progress || 0;
            
            try {
                // Get course details
                const courseDoc = await getDoc(doc(db, 'courses', courseId));
                if (courseDoc.exists()) {
                    const course = courseDoc.data();
                    const courseDuration = course.duration || 0; // Duration in hours
                    
                    // Calculate estimated hours based on progress percentage
                    const estimatedHours = (courseDuration * progress) / 100;
                    totalEstimatedHours += estimatedHours;
                    processedCourses++;
                }
            } catch (courseError) {
                console.error(`Error fetching course ${courseId}:`, courseError);
            }
        }
        
        // Display the estimated hours
        const displayHours = processedCourses > 0 ? totalEstimatedHours.toFixed(1) : '0';
        document.getElementById('learningHours').textContent = displayHours;
        
        // Optional: Show a subtle indicator that this is an estimate
        const learningHoursElement = document.getElementById('learningHours');
        if (learningHoursElement && processedCourses > 0) {
            learningHoursElement.title = 'Estimated based on course progress';
        }
        
    } catch (fallbackError) {
        console.error('Fallback calculation failed:', fallbackError);
        document.getElementById('learningHours').textContent = '0';
    }
}

// Load deadlines (quizzes and assignments)
async function loadDeadlines(userId) {
    try {
        const container = document.getElementById('upcomingDeadlines');
        const deadlines = [];
        
        // Get enrolled courses first
        const enrollmentsRef = collection(db, 'enrollments');
        const enrollmentsQuery = query(enrollmentsRef, where('studentId', '==', userId));
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        
        const enrolledCourseIds = [];
        enrollmentsSnapshot.forEach(doc => {
            enrolledCourseIds.push(doc.data().courseId);
        });
        
        if (enrolledCourseIds.length === 0) {
            displayNoDeadlines(container);
            return;
        }
        
        // Fetch quizzes from enrolled courses
        for (const courseId of enrolledCourseIds) {
            const quizzesRef = collection(db, 'quizzes');
            const quizzesQuery = query(
                quizzesRef, 
                where('courseId', '==', courseId),
                where('dueDate', '>=', new Date().toISOString())
            );
            const quizzesSnapshot = await getDocs(quizzesQuery);
            
            quizzesSnapshot.forEach(doc => {
                const quiz = doc.data();
                deadlines.push({
                    id: doc.id,
                    title: quiz.title,
                    dueDate: quiz.dueDate,
                    type: 'quiz',
                    priority: quiz.priority || 'medium',
                    courseId: courseId
                });
            });
        }
        
        // Fetch assignments from enrolled courses
        for (const courseId of enrolledCourseIds) {
            const assignmentsRef = collection(db, 'assignments');
            const assignmentsQuery = query(
                assignmentsRef, 
                where('courseId', '==', courseId),
                where('dueDate', '>=', new Date().toISOString())
            );
            const assignmentsSnapshot = await getDocs(assignmentsQuery);
            
            assignmentsSnapshot.forEach(doc => {
                const assignment = doc.data();
                deadlines.push({
                    id: doc.id,
                    title: assignment.title,
                    dueDate: assignment.dueDate,
                    type: 'assignment',
                    priority: assignment.priority || 'medium',
                    courseId: courseId
                });
            });
        }
        
        // Sort by due date
        deadlines.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        
        if (deadlines.length === 0) {
            displayNoDeadlines(container);
            return;
        }
        
        // Display only upcoming 3 deadlines
        const upcomingDeadlines = deadlines.slice(0, 3);
        
        container.innerHTML = upcomingDeadlines.map(deadline => {
            const daysLeft = calculateDaysLeft(deadline.dueDate);
            const priorityClass = deadline.priority === 'high' ? 'bg-red-100' : 
                                 deadline.priority === 'medium' ? 'bg-yellow-100' : 'bg-green-100';
            const iconClass = deadline.type === 'quiz' ? 'fa-question' : 'fa-pen';
            
            return `
                <div class="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 ${priorityClass} rounded-lg flex items-center justify-center">
                            <i class="fas ${iconClass} ${deadline.priority === 'high' ? 'text-red-600' : 'text-yellow-600'} text-sm"></i>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-800">${deadline.title}</p>
                            <p class="text-xs text-gray-500">Due: ${daysLeft}</p>
                        </div>
                    </div>
                    <button onclick="window.viewDeadline('${deadline.id}', '${deadline.type}')" 
                            class="text-[#1e88e5] text-xs hover:underline">
                        View
                    </button>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading deadlines:', error);
        const container = document.getElementById('upcomingDeadlines');
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-calendar-times text-4xl text-gray-300 mb-2"></i>
                <p class="text-gray-500">Unable to load deadlines</p>
            </div>
        `;
    }
}

// Display no deadlines message
function displayNoDeadlines(container) {
    container.innerHTML = `
        <div class="text-center py-8">
            <i class="fas fa-calendar-check text-4xl text-gray-300 mb-2"></i>
            <p class="text-gray-500">No upcoming deadlines</p>
            <p class="text-xs text-gray-400 mt-1">Complete your courses to see deadlines</p>
        </div>
    `;
}

// Calculate days left until deadline
function calculateDaysLeft(dueDate) {
    if (!dueDate) return 'No date';
    
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `${diffDays} days left`;
    return `${diffDays} days left`;
}

// Display in-progress courses
function displayInProgressCourses(courses) {
    const container = document.getElementById('inProgressCourses');
    
    if (courses.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-graduation-cap text-4xl text-gray-300 mb-2"></i>
                <p class="text-gray-500">No courses in progress</p>
                <a href="courses.html" class="text-[#1e88e5] text-sm mt-2 inline-block">Browse courses →</a>
            </div>
        `;
        return;
    }
    
    // Show only top 3 in-progress courses
    const topCourses = courses.slice(0, 3);
    
    container.innerHTML = topCourses.map(course => `
        <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
            <div class="flex items-center justify-between">
                <div class="flex-1">
                    <h3 class="font-medium text-gray-800">${escapeHtml(course.courseTitle)}</h3>
                    <p class="text-sm text-gray-500 mt-1">${course.progress || 0}% complete</p>
                </div>
                <div class="w-24">
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-[#1e88e5] rounded-full h-2 transition-all" style="width: ${course.progress || 0}%"></div>
                    </div>
                </div>
            </div>
            <button onclick="window.continueCourse('${course.courseId}')" 
                    class="mt-3 text-[#1e88e5] text-sm hover:underline">
                Continue Learning →
            </button>
        </div>
    `).join('');
}

// Load recommended courses
async function loadRecommendedCourses(userId) {
    const container = document.getElementById('recommendedCourses');
    
    try {
        // Get user interests and completed courses
        const userDoc = await getDoc(doc(db, 'users', userId));
        const userData = userDoc.data();
        const userInterests = userData?.interests || [];
        
        // Get enrolled course IDs to exclude
        const enrollmentsRef = collection(db, 'enrollments');
        const enrollmentsQuery = query(enrollmentsRef, where('studentId', '==', userId));
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        
        const enrolledCourseIds = new Set();
        enrollmentsSnapshot.forEach(doc => {
            enrolledCourseIds.add(doc.data().courseId);
        });
        
        // Fetch recommended courses
        const coursesRef = collection(db, 'courses');
        let coursesQuery = query(
            coursesRef,
            where('status', '==', 'published'),
            orderBy('createdAt', 'desc'),
            limit(6)
        );
        
        const coursesSnapshot = await getDocs(coursesQuery);
        let availableCourses = [];
        
        coursesSnapshot.forEach(doc => {
            const course = { id: doc.id, ...doc.data() };
            // Exclude already enrolled courses
            if (!enrolledCourseIds.has(course.id)) {
                availableCourses.push(course);
            }
        });
        
        // Sort by relevance to user interests
        if (userInterests.length > 0) {
            availableCourses.sort((a, b) => {
                const aRelevance = userInterests.some(interest => 
                    a.category?.toLowerCase().includes(interest.toLowerCase())
                ) ? 1 : 0;
                const bRelevance = userInterests.some(interest => 
                    b.category?.toLowerCase().includes(interest.toLowerCase())
                ) ? 1 : 0;
                return bRelevance - aRelevance;
            });
        }
        
        // Take top 3 recommended courses
        const recommended = availableCourses.slice(0, 3);
        
        if (recommended.length === 0) {
            container.innerHTML = `
                <div class="col-span-3 text-center py-8">
                    <i class="fas fa-lightbulb text-4xl text-gray-300 mb-2"></i>
                    <p class="text-gray-500">No recommended courses available yet</p>
                    <a href="courses.html" class="text-[#1e88e5] text-sm mt-2 inline-block">Browse all courses →</a>
                </div>
            `;
            return;
        }
        
        container.innerHTML = recommended.map(course => `
            <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer group" onclick="window.enrollCourse('${course.id}')">
                <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-200 transition">
                    <i class="fas ${getCourseIcon(course.category)} text-[#1e88e5] text-xl"></i>
                </div>
                <h3 class="font-semibold text-gray-800 mb-1 line-clamp-2">${escapeHtml(course.title)}</h3>
                <p class="text-xs text-gray-500">${course.level || 'Beginner'} • ${course.duration || 0} hours</p>
                <div class="mt-3">
                    <span class="text-[#00c853] text-sm font-medium group-hover:underline">Enroll Now →</span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading recommended courses:', error);
        container.innerHTML = `
            <div class="col-span-3 text-center py-8">
                <i class="fas fa-exclamation-circle text-4xl text-gray-300 mb-2"></i>
                <p class="text-gray-500">Unable to load recommendations</p>
                <button onclick="location.reload()" class="text-[#1e88e5] text-sm mt-2 inline-block">Retry →</button>
            </div>
        `;
    }
}

// Get icon based on course category
function getCourseIcon(category) {
    const icons = {
        'Web Development': 'fa-code',
        'Programming': 'fa-code',
        'Data Science': 'fa-chart-line',
        'Data Analytics': 'fa-chart-bar',
        'Design': 'fa-paint-brush',
        'UI/UX': 'fa-paintbrush-pencil',
        'Mobile Development': 'fa-mobile-alt',
        'Business': 'fa-briefcase',
        'Marketing': 'fa-chart-line',
        'Photography': 'fa-camera',
        'Music': 'fa-music',
        'Language': 'fa-language',
        'Health': 'fa-heartbeat'
    };
    return icons[category] || 'fa-book';
}

// Load notifications
async function loadNotifications(userId) {
    try {
        const notificationsRef = collection(db, 'notifications');
        const q = query(
            notificationsRef, 
            where('userId', '==', userId), 
            where('read', '==', false),
            orderBy('createdAt', 'desc'),
            limit(5)
        );
        const snapshot = await getDocs(q);
        
        const unreadCount = snapshot.size;
        const notificationCountElem = document.getElementById('notificationCount');
        if (notificationCountElem) {
            notificationCountElem.textContent = unreadCount;
            if (unreadCount > 0) {
                notificationCountElem.classList.add('notification-badge');
            } else {
                notificationCountElem.classList.remove('notification-badge');
            }
        }
        
        const notificationList = document.getElementById('notificationList');
        if (snapshot.empty) {
            notificationList.innerHTML = '<div class="p-3 text-center text-gray-500">No new notifications</div>';
        } else {
            let notificationsHtml = '';
            snapshot.forEach(doc => {
                const notif = doc.data();
                notificationsHtml += `
                    <div class="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100" onclick="window.markNotificationRead('${doc.id}')">
                        <p class="text-sm font-medium text-gray-800">${escapeHtml(notif.title || 'Notification')}</p>
                        <p class="text-xs text-gray-500 mt-1">${escapeHtml(notif.message || '')}</p>
                        <p class="text-xs text-gray-400 mt-1">${formatTime(notif.createdAt)}</p>
                    </div>
                `;
            });
            notificationList.innerHTML = notificationsHtml;
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// Mark notification as read
window.markNotificationRead = async (notificationId) => {
    try {
        const notificationRef = doc(db, 'notifications', notificationId);
        await updateDoc(notificationRef, {
            read: true
        });
        await loadNotifications(currentUser.uid);
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
};

// Format timestamp
function formatTime(timestamp) {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show toast notification
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

// Sidebar toggle functionality
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggleSidebar');
const mainContent = document.getElementById('mainContent');
let isCollapsed = false;

// Load sidebar state from localStorage
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
        
        // Hide text elements
        document.querySelectorAll('.nav-text, .user-info, .logo-text').forEach(el => {
            el.style.display = 'none';
        });
        
        // Add tooltips to nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            const text = item.querySelector('.nav-text')?.innerText;
            if (text) {
                item.classList.add('tooltip');
                item.setAttribute('data-tooltip', text);
            }
        });
        
        // Change chevron direction
        if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-chevron-right text-xl"></i>';
    } else {
        sidebar.classList.remove('sidebar-collapsed');
        sidebar.classList.add('sidebar-expanded');
        mainContent.style.marginLeft = '280px';
        localStorage.setItem('sidebarCollapsed', 'false');
        
        // Show text elements
        document.querySelectorAll('.nav-text, .user-info, .logo-text').forEach(el => {
            el.style.display = '';
        });
        
        // Remove tooltips
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('tooltip');
            item.removeAttribute('data-tooltip');
        });
        
        // Change chevron direction
        if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-chevron-left text-xl"></i>';
    }
}

// Mobile menu functionality
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

// Notification dropdown
const notificationBtn = document.getElementById('notificationBtn');
const notificationDropdown = document.getElementById('notificationDropdown');

if (notificationBtn) {
    notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationDropdown.classList.toggle('hidden');
        if (userDropdown) userDropdown.classList.add('hidden');
    });
}

// User dropdown
const userMenuBtn = document.getElementById('userMenuBtn');
const userDropdown = document.getElementById('userDropdown');

if (userMenuBtn) {
    userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('hidden');
        if (notificationDropdown) notificationDropdown.classList.add('hidden');
    });
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (notificationDropdown && !notificationDropdown.contains(e.target) && e.target !== notificationBtn) {
        notificationDropdown.classList.add('hidden');
    }
    if (userDropdown && !userDropdown.contains(e.target) && e.target !== userMenuBtn) {
        userDropdown.classList.add('hidden');
    }
});

// Search functionality
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const searchTerm = searchInput.value.trim();
            if (searchTerm) {
                window.location.href = `courses.html?search=${encodeURIComponent(searchTerm)}`;
            }
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
        showToast('Error logging out', 'error');
    }
}

// Attach logout to both buttons
const logoutBtns = document.querySelectorAll('#logoutBtn, #logoutDropdown');
logoutBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
});

// Global functions for buttons
window.continueCourse = (courseId) => {
    window.location.href = `course-view.html?id=${courseId}`;
};

window.enrollCourse = (courseId) => {
    window.location.href = `course-enroll.html?id=${courseId}`;
};

window.viewDeadline = (deadlineId, type) => {
    if (type === 'quiz') {
        window.location.href = `quiz.html?id=${deadlineId}`;
    } else {
        window.location.href = `assignment.html?id=${deadlineId}`;
    }
};

// Add CSS for animations if not present
if (!document.querySelector('#dashboard-styles')) {
    const style = document.createElement('style');
    style.id = 'dashboard-styles';
    style.textContent = `
        .animate-fade-in {
            animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .line-clamp-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
    `;
    document.head.appendChild(style);
}