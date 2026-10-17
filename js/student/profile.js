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

let currentUser = null;
let userData = {};
let enrolledCourses = [];
let certificates = [];
let quizAttempts = [];

// Achievement definitions
const achievements = [
    { id: 'first_course', name: 'First Steps', description: 'Enroll in your first course', icon: 'fa-rocket', points: 10 },
    { id: 'course_complete', name: 'Course Champion', description: 'Complete your first course', icon: 'fa-trophy', points: 50 },
    { id: 'quiz_master', name: 'Quiz Master', description: 'Pass 5 quizzes with 80% or higher', icon: 'fa-brain', points: 30 },
    { id: 'certificate_collector', name: 'Certificate Collector', description: 'Earn your first certificate', icon: 'fa-certificate', points: 25 },
    { id: 'learning_streak', name: 'Learning Streak', description: 'Learn for 7 days in a row', icon: 'fa-fire', points: 40 },
    { id: 'discussion_starter', name: 'Community Builder', description: 'Start 3 discussions', icon: 'fa-comments', points: 20 },
    { id: 'resource_hunter', name: 'Resource Hunter', description: 'Download 10 resources', icon: 'fa-download', points: 15 },
    { id: 'perfect_score', name: 'Perfect Score', description: 'Get 100% on any quiz', icon: 'fa-star', points: 35 },
    { id: 'course_collector', name: 'Course Collector', description: 'Complete 5 courses', icon: 'fa-graduation-cap', points: 100 },
    { id: 'expert_learner', name: 'Expert Learner', description: 'Spend 100 hours learning', icon: 'fa-chart-line', points: 150 }
];

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../login.html';
    } else {
        currentUser = user;
        await loadUserData(user.uid);
        await loadEnrolledCourses(user.uid);
        await loadCertificates(user.uid);
        await loadQuizAttempts(user.uid);
        await loadNotifications(user.uid);
        await calculateAchievements();
        await loadRecentActivity();
    }
});

// Load user data
async function loadUserData(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            userData = userDoc.data();
            
            // Update sidebar
            document.getElementById('userName').textContent = userData.fullName || 'Student';
            document.getElementById('userRole').textContent = userData.role || 'Student';
            
            // Update profile header
            const avatarName = encodeURIComponent(userData.fullName || 'Student');
            const avatarUrl = `https://ui-avatars.com/api/?background=1e88e5&color=fff&bold=true&size=120&name=${avatarName}`;
            
            document.getElementById('profileAvatar').src = avatarUrl;
            document.getElementById('profileName').textContent = userData.fullName || 'Student';
            document.getElementById('profileEmail').textContent = userData.email || '-';
            document.getElementById('profileLocation').textContent = userData.location || 'Not specified';
            document.getElementById('profileBio').textContent = userData.bio || 'No bio added yet. Click edit profile to add a bio.';
            
            // Update contact info
            document.getElementById('contactEmail').textContent = userData.email || '-';
            document.getElementById('contactPhone').textContent = userData.phone || 'Not provided';
            document.getElementById('contactLocation').textContent = userData.location || 'Not provided';
            document.getElementById('contactSchool').textContent = userData.school || 'Not provided';
            
            // Update join date
            if (userData.createdAt) {
                const joinDate = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
                document.getElementById('joinDate').textContent = joinDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                document.getElementById('memberSince').textContent = joinDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            }
            
            // Update last active
            if (userData.lastLogin) {
                const lastActive = userData.lastLogin.toDate ? userData.lastLogin.toDate() : new Date(userData.lastLogin);
                document.getElementById('lastActive').textContent = getTimeAgo(lastActive);
            }
            
            // Update skills
            displaySkills(userData.interests || []);
            
            // Update avatars in sidebar and dropdown
            const sidebarAvatar = document.getElementById('userAvatar');
            const dropdownAvatar = document.getElementById('dropdownAvatar');
            if (sidebarAvatar) sidebarAvatar.src = avatarUrl;
            if (dropdownAvatar) dropdownAvatar.src = avatarUrl;
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Load enrolled courses
async function loadEnrolledCourses(userId) {
    try {
        const enrollmentsRef = collection(db, 'enrollments');
        const q = query(enrollmentsRef, where('studentId', '==', userId));
        const snapshot = await getDocs(q);
        
        enrolledCourses = [];
        let totalHours = 0;
        let completed = 0;
        
        // Change 'doc' to 'enrollmentDoc' or 'enrollmentSnapshot'
        for (const enrollmentDoc of snapshot.docs) {
            const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() };
            
            // Get course details
            const courseDoc = await getDoc(doc(db, 'courses', enrollment.courseId));
            if (courseDoc.exists()) {
                enrollment.course = { id: courseDoc.id, ...courseDoc.data() };
                enrolledCourses.push(enrollment);
                
                if (enrollment.status === 'completed') {
                    completed++;
                }
                
                // Calculate learning hours (simulated)
                totalHours += enrollment.progress ? (enrollment.progress / 100) * 20 : 0;
            }
        }
        
        // Update stats
        document.getElementById('enrolledCount').textContent = enrolledCourses.length;
        document.getElementById('completedCount').textContent = completed;
        document.getElementById('learningHours').textContent = Math.round(totalHours);
        document.getElementById('courseCount').textContent = enrolledCourses.length;
        
        // Display course progress
        displayCourseProgress();
        
    } catch (error) {
        console.error('Error loading enrolled courses:', error);
    }
}

// Load certificates
async function loadCertificates(userId) {
    try {
        const certificatesRef = collection(db, 'certificates');
        const q = query(certificatesRef, where('studentId', '==', userId));
        const snapshot = await getDocs(q);
        
        certificates = [];
        snapshot.forEach(certdoc => {
            certificates.push({ id: certdoc.id, ...certdoc.data() });
        });
        
        document.getElementById('certificateCount').textContent = certificates.length;
        
    } catch (error) {
        console.error('Error loading certificates:', error);
    }
}

// Load quiz attempts
async function loadQuizAttempts(userId) {
    try {
        const attemptsRef = collection(db, 'quizAttempts');
        const q = query(attemptsRef, where('studentId', '==', userId), where('status', '==', 'completed'));
        const snapshot = await getDocs(q);
        
        quizAttempts = [];
        snapshot.forEach(attemptdoc => {
            quizAttempts.push({ id: attemptdoc.id, ...attemptdoc.data() });
        });
        
    } catch (error) {
        console.error('Error loading quiz attempts:', error);
    }
}

// Display skills
function displaySkills(interests) {
    const container = document.getElementById('skillsContainer');
    
    if (!interests || interests.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-lightbulb text-gray-300 text-3xl mb-2"></i>
                <p class="text-gray-500 text-sm">No skills added yet</p>
                <p class="text-xs text-gray-400">Update your profile to add interests</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = interests.map(skill => `
        <span class="skill-tag px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gradient-to-r hover:from-[#1e88e5] hover:to-[#00c853] hover:text-white cursor-pointer transition">
            ${skill}
        </span>
    `).join('');
}

// Calculate and display achievements
async function calculateAchievements() {
    const earnedAchievements = [];
    
    // Check each achievement
    if (enrolledCourses.length > 0) earnedAchievements.push('first_course');
    if (enrolledCourses.filter(c => c.status === 'completed').length > 0) earnedAchievements.push('course_complete');
    if (quizAttempts.filter(q => q.score >= 80).length >= 5) earnedAchievements.push('quiz_master');
    if (certificates.length > 0) earnedAchievements.push('certificate_collector');
    if (enrolledCourses.filter(c => c.status === 'completed').length >= 5) earnedAchievements.push('course_collector');
    if (quizAttempts.some(q => q.score === 100)) earnedAchievements.push('perfect_score');
    
    // Update achievement count
    document.getElementById('achievementCount').textContent = `${earnedAchievements.length}/${achievements.length} earned`;
    
    // Display achievements grid
    displayAchievements(earnedAchievements);
}

// Display achievements
function displayAchievements(earnedIds) {
    const container = document.getElementById('achievementsGrid');
    
    container.innerHTML = achievements.map(achievement => {
        const earned = earnedIds.includes(achievement.id);
        return `
            <div class="achievement-badge ${!earned ? 'achievement-locked' : ''} bg-gray-50 rounded-lg p-3 text-center hover:shadow-md transition">
                <div class="w-12 h-12 mx-auto bg-gradient-to-r from-[#1e88e5] to-[#00c853] rounded-full flex items-center justify-center mb-2">
                    <i class="fas ${achievement.icon} text-white text-xl"></i>
                </div>
                <h3 class="font-semibold text-sm text-gray-800">${achievement.name}</h3>
                <p class="text-xs text-gray-500 mt-1">${achievement.description}</p>
                ${earned ? '<span class="text-xs text-green-500 mt-2 inline-block"><i class="fas fa-check-circle"></i> Earned</span>' : 
                           '<span class="text-xs text-gray-400 mt-2 inline-block">Locked</span>'}
            </div>
        `;
    }).join('');
}

// Display course progress
function displayCourseProgress() {
    const container = document.getElementById('courseProgressList');
    const inProgress = enrolledCourses.filter(c => c.status === 'active').slice(0, 3);
    
    if (inProgress.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-book-open text-gray-300 text-3xl mb-2"></i>
                <p class="text-gray-500">No courses in progress</p>
                <a href="courses.html" class="text-[#1e88e5] text-sm hover:underline">Browse courses →</a>
            </div>
        `;
        return;
    }
    
    container.innerHTML = inProgress.map(course => `
        <div class="border border-gray-200 rounded-lg p-3">
            <div class="flex items-center justify-between mb-2">
                <h3 class="font-medium text-gray-800 text-sm">${course.course?.title || 'Untitled Course'}</h3>
                <span class="text-xs text-gray-500">${course.progress || 0}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-[#1e88e5] rounded-full h-2 transition-all" style="width: ${course.progress || 0}%"></div>
            </div>
        </div>
    `).join('');
}

// Load recent activity
async function loadRecentActivity() {
    const container = document.getElementById('activityTimeline');
    const activities = [];
    
    // Add course enrollments
    enrolledCourses.forEach(course => {
        if (course.enrolledAt) {
            activities.push({
                type: 'enrollment',
                title: `Enrolled in ${course.course?.title || 'a course'}`,
                date: course.enrolledAt,
                icon: 'fa-book-open',
                color: 'blue'
            });
        }
        if (course.completedAt) {
            activities.push({
                type: 'completion',
                title: `Completed ${course.course?.title || 'a course'}`,
                date: course.completedAt,
                icon: 'fa-check-circle',
                color: 'green'
            });
        }
    });
    
    // Add certificates
    certificates.forEach(cert => {
        if (cert.issuedAt) {
            activities.push({
                type: 'certificate',
                title: `Earned certificate: ${cert.courseTitle}`,
                date: cert.issuedAt,
                icon: 'fa-certificate',
                color: 'purple'
            });
        }
    });
    
    // Add quiz attempts
    quizAttempts.forEach(quiz => {
        if (quiz.completedAt) {
            activities.push({
                type: 'quiz',
                title: `Completed quiz: ${quiz.quizTitle} (${quiz.score}%)`,
                date: quiz.completedAt,
                icon: 'fa-question-circle',
                color: 'orange'
            });
        }
    });
    
    // Sort by date (newest first)
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentActivities = activities.slice(0, 5);
    
    if (recentActivities.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-clock text-gray-300 text-3xl mb-2"></i>
                <p class="text-gray-500">No recent activity</p>
                <p class="text-sm text-gray-400">Start learning to see your activity here</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = recentActivities.map(activity => `
        <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="ml-4">
                <div class="flex items-center space-x-2 mb-1">
                    <div class="w-8 h-8 bg-${activity.color}-100 rounded-full flex items-center justify-center">
                        <i class="fas ${activity.icon} text-${activity.color}-600 text-sm"></i>
                    </div>
                    <div>
                        <p class="text-sm font-medium text-gray-800">${activity.title}</p>
                        <p class="text-xs text-gray-500">${getTimeAgo(new Date(activity.date))}</p>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Get time ago string
function getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 24) return `${hours} hours ago`;
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
}

// Edit profile button
document.getElementById('editProfileBtn')?.addEventListener('click', () => {
    window.location.href = 'settings.html';
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
    
    // Logout handlers
    const logoutBtns = document.querySelectorAll('#logoutBtn, #logoutDropdown');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    });
});