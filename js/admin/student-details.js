import { 
    auth, signOut, db, doc, getDoc, getDocs, updateDoc, collection, query, where, orderBy, onAuthStateChanged
} from '../firebase-config.js';

let currentAdmin = null;
let studentId = null;
let studentData = null;
let enrollments = [];
let quizAttempts = [];
let activityLogs = [];
let progressChart = null;
let quizScoreChart = null;

// Get student ID from URL - FIXED
const urlParams = new URLSearchParams(window.location.search);
studentId = urlParams.get('id');

// Validate student ID
if (!studentId) {
    console.error('No student ID provided in URL');
    // Show error message on page
    document.addEventListener('DOMContentLoaded', () => {
        const loadingState = document.getElementById('loadingState');
        if (loadingState) {
            loadingState.innerHTML = `
                <div class="text-center py-12">
                    <i class="fas fa-exclamation-circle text-5xl text-red-500 mb-4"></i>
                    <p class="text-gray-500">No student ID provided</p>
                    <a href="users.html" class="mt-4 inline-block px-4 py-2 bg-[#1e88e5] text-white rounded-lg">Back to Users</a>
                </div>
            `;
        }
    });
}

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../login.html';
        return;
    }
    
    if (!studentId) return; // Exit if no student ID
    
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && (userDoc.data().role === 'admin' || userDoc.data().role === 'super_admin')) {
            currentAdmin = user;
            await loadAdminData(user.uid);
            await loadStudentData();
            await loadNotifications(user.uid);
        } else {
            window.location.href = '../../student/dashboard.html';
        }
    } catch (error) {
        console.error('Error in authentication check:', error);
        showToast('Authentication error', 'error');
    }
});

// Load admin data
async function loadAdminData(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const data = userDoc.data();
            document.getElementById('adminName').textContent = data.fullName || 'Administrator';
            document.getElementById('adminRole').textContent = data.role === 'super_admin' ? 'Super Administrator' : 'Administrator';
            const avatarUrl = `https://ui-avatars.com/api/?background=1e88e5&color=fff&bold=true&size=40&name=${encodeURIComponent(data.fullName || 'Admin')}`;
            const adminAvatar = document.getElementById('adminAvatar');
            const dropdownAvatar = document.getElementById('dropdownAvatar');
            if (adminAvatar) adminAvatar.src = avatarUrl;
            if (dropdownAvatar) dropdownAvatar.src = avatarUrl;
        }
    } catch (error) {
        console.error('Error loading admin data:', error);
    }
}

// Load student data
async function loadStudentData() {
    try {
        const loadingState = document.getElementById('loadingState');
        const studentContent = document.getElementById('studentContent');
        
        if (loadingState) loadingState.classList.remove('hidden');
        if (studentContent) studentContent.classList.add('hidden');
        
        // Validate studentId
        if (!studentId) {
            throw new Error('Student ID is required');
        }
        
        // Get student details - FIXED: Use proper document reference
        const studentDocRef = doc(db, 'users', studentId);
        const studentDoc = await getDoc(studentDocRef);
        
        if (!studentDoc.exists()) {
            showToast('Student not found', 'error');
            setTimeout(() => window.location.href = 'users.html', 2000);
            return;
        }
        
        studentData = { id: studentDoc.id, ...studentDoc.data() };
        
        // Get enrollments
        const enrollmentsRef = collection(db, 'enrollments');
        const enrollmentsQuery = query(enrollmentsRef, where('studentId', '==', studentId));
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        enrollments = [];
        enrollmentsSnapshot.forEach(doc => enrollments.push({ id: doc.id, ...doc.data() }));
        
        // Get quiz attempts
        const attemptsRef = collection(db, 'quizAttempts');
        const attemptsQuery = query(attemptsRef, where('studentId', '==', studentId), orderBy('completedAt', 'desc'));
        const attemptsSnapshot = await getDocs(attemptsQuery);
        quizAttempts = [];
        attemptsSnapshot.forEach(doc => quizAttempts.push({ id: doc.id, ...doc.data() }));
        
        // Generate activity logs
        generateActivityLogs();
        
        // Update UI
        updateStudentHeader();
        updateStats();
        updateProfileTab();
        updateCoursesTab();
        updateQuizzesTab();
        updateActivityTab();
        updateAnalyticsCharts();
        
        if (loadingState) loadingState.classList.add('hidden');
        if (studentContent) studentContent.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading student data:', error);
        showToast('Failed to load student data: ' + error.message, 'error');
        
        const loadingState = document.getElementById('loadingState');
        if (loadingState) {
            loadingState.innerHTML = `
                <div class="text-center py-12">
                    <i class="fas fa-exclamation-circle text-5xl text-red-500 mb-4"></i>
                    <p class="text-gray-500">Failed to load student data</p>
                    <p class="text-sm text-gray-400 mt-2">${error.message}</p>
                    <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-[#1e88e5] text-white rounded-lg">Retry</button>
                    <a href="users.html" class="mt-4 ml-2 inline-block px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Back to Users</a>
                </div>
            `;
        }
    }
}

// Update student header
function updateStudentHeader() {
    const avatarName = encodeURIComponent(studentData.fullName || 'Student');
    const studentAvatar = document.getElementById('studentAvatar');
    if (studentAvatar) {
        studentAvatar.src = `https://ui-avatars.com/api/?background=1e88e5&color=fff&bold=true&size=96&name=${avatarName}`;
    }
    
    const studentName = document.getElementById('studentName');
    const studentEmail = document.getElementById('studentEmail');
    if (studentName) studentName.textContent = studentData.fullName || 'Unnamed Student';
    if (studentEmail) studentEmail.textContent = studentData.email || '-';
    
    const status = studentData.status || 'active';
    const statusElement = document.getElementById('studentStatus');
    if (statusElement) {
        statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        statusElement.className = `status-${status} px-2 py-0.5 rounded-full text-xs`;
    }
    
    if (studentData.createdAt) {
        const joinDate = studentData.createdAt.toDate ? studentData.createdAt.toDate() : new Date(studentData.createdAt);
        const joinDateElement = document.getElementById('joinDate');
        if (joinDateElement) {
            joinDateElement.textContent = joinDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
    }
    
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = `Student Details: ${studentData.fullName || 'Student'}`;
    }
}

// Update stats
function updateStats() {
    const enrolled = enrollments.length;
    const completed = enrollments.filter(e => e.status === 'completed').length;
    const learningHours = enrollments.reduce((sum, e) => sum + (e.learningHours || 0), 0);
    const certificates = enrollments.filter(e => e.certificateIssued).length;
    
    const enrolledCount = document.getElementById('enrolledCount');
    const completedCount = document.getElementById('completedCount');
    const learningHoursEl = document.getElementById('learningHours');
    const certificatesCount = document.getElementById('certificatesCount');
    
    if (enrolledCount) enrolledCount.textContent = enrolled;
    if (completedCount) completedCount.textContent = completed;
    if (learningHoursEl) learningHoursEl.textContent = Math.round(learningHours);
    if (certificatesCount) certificatesCount.textContent = certificates;
}

// Update profile tab
function updateProfileTab() {
    // Personal Information
    const elements = {
        detailFullName: studentData.fullName || '-',
        detailUsername: studentData.username || '-',
        detailEmail: studentData.email || '-',
        detailPhone: studentData.phone || 'Not provided',
        detailGender: studentData.gender || 'Not specified',
        detailLocation: studentData.location || 'Not specified',
        detailSchool: studentData.school || 'Not specified',
        detailGrade: studentData.grade || 'Not specified',
        detailExperience: studentData.experience || 'Not specified',
        detailInterests: studentData.interests?.join(', ') || 'Not specified',
        detailReferral: studentData.referral || 'Not specified',
        detailGuardianName: studentData.guardianName || 'Not provided',
        detailGuardianPhone: studentData.guardianPhone || 'Not provided',
        detailGuardianEmail: studentData.guardianEmail || 'Not provided',
        detailConsent: studentData.consent ? 'Yes' : 'No',
        detailBio: studentData.bio || 'No bio added'
    };
    
    for (const [id, value] of Object.entries(elements)) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }
    
    // Account dates
    if (studentData.createdAt) {
        const createdAt = studentData.createdAt.toDate ? studentData.createdAt.toDate() : new Date(studentData.createdAt);
        const detailCreatedAt = document.getElementById('detailCreatedAt');
        if (detailCreatedAt) detailCreatedAt.textContent = createdAt.toLocaleString();
    }
    
    if (studentData.lastLogin) {
        const lastLogin = studentData.lastLogin.toDate ? studentData.lastLogin.toDate() : new Date(studentData.lastLogin);
        const detailLastLogin = document.getElementById('detailLastLogin');
        if (detailLastLogin) detailLastLogin.textContent = lastLogin.toLocaleString();
    }
    
    const status = studentData.status || 'active';
    const detailAccountStatus = document.getElementById('detailAccountStatus');
    if (detailAccountStatus) {
        detailAccountStatus.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        detailAccountStatus.className = `status-${status} px-2 py-0.5 rounded-full text-xs inline-block`;
    }
    
    // Populate edit form
    const editFields = {
        editFullName: studentData.fullName || '',
        editEmail: studentData.email || '',
        editPhone: studentData.phone || '',
        editLocation: studentData.location || '',
        editSchool: studentData.school || '',
        editGrade: studentData.grade || '',
        editBio: studentData.bio || '',
        editStatus: studentData.status || 'active'
    };
    
    for (const [id, value] of Object.entries(editFields)) {
        const element = document.getElementById(id);
        if (element) element.value = value;
    }
}

// Update courses tab
async function updateCoursesTab() {
    const container = document.getElementById('coursesProgressList');
    if (!container) return;
    
    if (enrollments.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-book-open text-4xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No courses enrolled</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    for (const enrollment of enrollments) {
        try {
            const courseDoc = await getDoc(doc(db, 'courses', enrollment.courseId));
            const course = courseDoc.exists() ? courseDoc.data() : { title: 'Unknown Course' };
            
            html += `
                <div class="border border-gray-200 rounded-lg p-4">
                    <div class="flex flex-wrap items-start justify-between gap-4">
                        <div class="flex-1">
                            <h3 class="font-semibold text-gray-800">${escapeHtml(course.title || enrollment.courseTitle || 'Untitled Course')}</h3>
                            <div class="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                                <span><i class="fas fa-calendar-alt mr-1"></i> Enrolled: ${formatDate(enrollment.enrolledAt)}</span>
                                <span><i class="fas fa-hourglass-half mr-1"></i> ${enrollment.learningHours || 0} hours spent</span>
                            </div>
                            <div class="mt-3">
                                <div class="flex justify-between text-sm mb-1">
                                    <span class="text-gray-600">Progress</span>
                                    <span class="text-[#1e88e5] font-medium">${enrollment.progress || 0}%</span>
                                </div>
                                <div class="w-full bg-gray-200 rounded-full h-2">
                                    <div class="bg-[#1e88e5] rounded-full h-2" style="width: ${enrollment.progress || 0}%"></div>
                                </div>
                            </div>
                            ${enrollment.completedAt ? `
                                <div class="mt-3 text-sm text-green-600">
                                    <i class="fas fa-check-circle mr-1"></i> Completed on ${formatDate(enrollment.completedAt)}
                                </div>
                            ` : ''}
                        </div>
                        <div class="text-right">
                            <span class="status-${enrollment.status || 'active'} px-3 py-1 rounded-full text-xs">${enrollment.status || 'Active'}</span>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error loading course details:', error);
        }
    }
    container.innerHTML = html;
}

// Update quizzes tab
function updateQuizzesTab() {
    const container = document.getElementById('quizAttemptsList');
    if (!container) return;
    
    if (quizAttempts.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-question-circle text-4xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No quiz attempts</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = quizAttempts.map(attempt => `
        <div class="border border-gray-200 rounded-lg p-4">
            <div class="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h3 class="font-semibold text-gray-800">${escapeHtml(attempt.quizTitle || 'Untitled Quiz')}</h3>
                    <p class="text-sm text-gray-500 mt-1">Attempted on ${formatDate(attempt.completedAt)}</p>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold ${attempt.score >= 70 ? 'text-green-600' : 'text-orange-600'}">${attempt.score || 0}%</div>
                    <p class="text-xs text-gray-500">Score</p>
                </div>
                <div class="text-center">
                    <div class="text-sm font-medium">${attempt.correctPoints || 0}/${attempt.totalPoints || 0}</div>
                    <p class="text-xs text-gray-500">Correct/Total</p>
                </div>
                <div>
                    <span class="${attempt.score >= 70 ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'} px-3 py-1 rounded-full text-xs">
                        ${attempt.score >= 70 ? 'Passed' : 'Failed'}
                    </span>
                </div>
            </div>
        </div>
    `).join('');
}

// Generate activity logs
function generateActivityLogs() {
    activityLogs = [];
    
    // Add enrollment activities
    enrollments.forEach(enrollment => {
        if (enrollment.enrolledAt) {
            activityLogs.push({
                type: 'enrollment',
                title: `Enrolled in ${enrollment.courseTitle || 'a course'}`,
                date: enrollment.enrolledAt,
                icon: 'fa-book-open',
                color: 'blue'
            });
        }
        if (enrollment.completedAt) {
            activityLogs.push({
                type: 'completion',
                title: `Completed ${enrollment.courseTitle || 'a course'}`,
                date: enrollment.completedAt,
                icon: 'fa-check-circle',
                color: 'green'
            });
        }
    });
    
    // Add quiz activities
    quizAttempts.forEach(attempt => {
        if (attempt.completedAt) {
            activityLogs.push({
                type: 'quiz',
                title: `Completed quiz: ${attempt.quizTitle} (${attempt.score}%)`,
                date: attempt.completedAt,
                icon: 'fa-question-circle',
                color: 'orange'
            });
        }
    });
    
    // Add account creation
    if (studentData && studentData.createdAt) {
        activityLogs.push({
            type: 'account',
            title: 'Account created',
            date: studentData.createdAt,
            icon: 'fa-user-plus',
            color: 'purple'
        });
    }
    
    // Sort by date (newest first)
    activityLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Update activity tab
function updateActivityTab() {
    const container = document.getElementById('activityLog');
    if (!container) return;
    
    if (activityLogs.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-clock text-4xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No activity recorded</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = activityLogs.map(activity => `
        <div class="activity-item flex items-center space-x-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition">
            <div class="w-8 h-8 bg-${activity.color}-100 rounded-full flex items-center justify-center">
                <i class="fas ${activity.icon} text-${activity.color}-600 text-sm"></i>
            </div>
            <div class="flex-1">
                <p class="text-sm text-gray-800">${escapeHtml(activity.title)}</p>
                <p class="text-xs text-gray-500">${getTimeAgo(activity.date)}</p>
            </div>
        </div>
    `).join('');
}

// Update analytics charts
function updateAnalyticsCharts() {
    // Progress Chart
    const progressCtx = document.getElementById('progressChart')?.getContext('2d');
    if (progressCtx && typeof Chart !== 'undefined') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        const progressData = [0, 15, 28, 45, 62, 78];
        
        if (progressChart) progressChart.destroy();
        progressChart = new Chart(progressCtx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Course Completion Progress (%)',
                    data: progressData,
                    borderColor: '#1e88e5',
                    backgroundColor: 'rgba(30, 136, 229, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { min: 0, max: 100 } }
            }
        });
    }
    
    // Quiz Score Chart
    const quizCtx = document.getElementById('quizScoreChart')?.getContext('2d');
    if (quizCtx && quizAttempts.length > 0 && typeof Chart !== 'undefined') {
        const quizNames = quizAttempts.slice(0, 5).map(q => (q.quizTitle || 'Quiz').substring(0, 15));
        const quizScores = quizAttempts.slice(0, 5).map(q => q.score || 0);
        
        if (quizScoreChart) quizScoreChart.destroy();
        quizScoreChart = new Chart(quizCtx, {
            type: 'bar',
            data: {
                labels: quizNames,
                datasets: [{
                    label: 'Score (%)',
                    data: quizScores,
                    backgroundColor: '#00c853',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { min: 0, max: 100 } }
            }
        });
    }
    
    // Heatmap (simplified)
    const heatmapContainer = document.getElementById('heatmapContainer');
    if (heatmapContainer) {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        
        heatmapContainer.innerHTML = `
            <div class="inline-block min-w-full">
                <table class="w-full">
                    <thead>
                        <tr>
                            <th class="p-2"></th>
                            ${days.map(day => `<th class="p-2 text-xs font-medium text-gray-500">${day}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${weeks.map(week => `
                            <tr>
                                <td class="p-2 text-xs text-gray-500 font-medium">${week}</td>
                                ${days.map(() => `
                                    <td class="p-2">
                                        <div class="w-8 h-8 rounded-lg ${getActivityLevel()} cursor-pointer hover:scale-110 transition" title="Activity level"></div>
                                    </td>
                                `).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
}

// Get random activity level for heatmap
function getActivityLevel() {
    const levels = ['bg-green-100', 'bg-green-200', 'bg-green-300', 'bg-green-400', 'bg-green-500'];
    return levels[Math.floor(Math.random() * levels.length)];
}

// Edit student modal
function setupEditModal() {
    const modal = document.getElementById('editStudentModal');
    const openBtn = document.getElementById('editStudentBtn');
    const closeBtn = document.getElementById('closeEditModal');
    const cancelBtn = document.getElementById('cancelEditModal');
    const form = document.getElementById('editStudentForm');
    
    if (!modal || !openBtn || !closeBtn || !cancelBtn || !form) return;
    
    openBtn.addEventListener('click', () => modal.classList.remove('hidden'));
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const updatedData = {
            fullName: document.getElementById('editFullName')?.value.trim() || '',
            email: document.getElementById('editEmail')?.value.trim() || '',
            phone: document.getElementById('editPhone')?.value.trim() || '',
            location: document.getElementById('editLocation')?.value.trim() || '',
            school: document.getElementById('editSchool')?.value.trim() || '',
            grade: document.getElementById('editGrade')?.value || '',
            bio: document.getElementById('editBio')?.value.trim() || '',
            status: document.getElementById('editStatus')?.value || 'active',
            updatedAt: new Date().toISOString(),
            updatedBy: currentAdmin?.uid || ''
        };
        
        try {
            const userRef = doc(db, 'users', studentId);
            await updateDoc(userRef, updatedData);
            showToast('Student information updated successfully', 'success');
            modal.classList.add('hidden');
            await loadStudentData();
        } catch (error) {
            console.error('Error updating student:', error);
            showToast('Failed to update student: ' + error.message, 'error');
        }
    });
}

// Suspend student
function setupSuspendButton() {
    const suspendBtn = document.getElementById('suspendStudentBtn');
    if (!suspendBtn) return;
    
    suspendBtn.addEventListener('click', async () => {
        if (!studentData) return;
        
        const newStatus = studentData.status === 'suspended' ? 'active' : 'suspended';
        const action = newStatus === 'suspended' ? 'suspend' : 'activate';
        
        if (!confirm(`Are you sure you want to ${action} this student?`)) return;
        
        try {
            const userRef = doc(db, 'users', studentId);
            await updateDoc(userRef, {
                status: newStatus,
                statusUpdatedAt: new Date().toISOString(),
                statusUpdatedBy: currentAdmin?.uid || ''
            });
            showToast(`Student ${action}d successfully`, 'success');
            await loadStudentData();
        } catch (error) {
            console.error('Error updating student status:', error);
            showToast('Failed to update student status', 'error');
        }
    });
}

// Helper function to escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Format date
function formatDate(date) {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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

// Tab switching
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = {
        'profile': document.getElementById('profileTab'),
        'courses': document.getElementById('coursesTab'),
        'quizzes': document.getElementById('quizzesTab'),
        'activity': document.getElementById('activityTab'),
        'analytics': document.getElementById('analyticsTab')
    };
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            tabs.forEach(t => {
                t.classList.remove('active', 'text-[#1e88e5]', 'border-b-2', 'border-[#1e88e5]');
                t.classList.add('text-gray-500');
            });
            tab.classList.add('active', 'text-[#1e88e5]', 'border-b-2', 'border-[#1e88e5]');
            tab.classList.remove('text-gray-500');
            
            Object.values(tabContents).forEach(content => {
                if (content) content.classList.add('hidden');
            });
            if (tabContents[tabId]) tabContents[tabId].classList.remove('hidden');
        });
    });
}

// Load notifications
async function loadNotifications(userId) {
    try {
        const notificationsRef = collection(db, 'notifications');
        const q = query(notificationsRef, where('userId', '==', userId), where('read', '==', false));
        const snapshot = await getDocs(q);
        const countElement = document.getElementById('notificationCount');
        if (countElement) countElement.textContent = snapshot.size;
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// Sidebar setup
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    const mainContent = document.getElementById('mainContent');
    if (!sidebar || !mainContent) return;
    
    let isCollapsed = localStorage.getItem('adminSidebarCollapsed') === 'true';
    if (isCollapsed) toggleSidebar(true);
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => toggleSidebar(!isCollapsed));
    }
    
    function toggleSidebar(collapse) {
        isCollapsed = collapse;
        if (collapse) {
            sidebar.classList.add('sidebar-collapsed');
            sidebar.classList.remove('sidebar-expanded');
            mainContent.style.marginLeft = '80px';
            localStorage.setItem('adminSidebarCollapsed', 'true');
            document.querySelectorAll('.nav-text, .admin-info, .logo-text').forEach(el => {
                if (el) el.style.display = 'none';
            });
            document.querySelectorAll('.nav-item').forEach(item => {
                const text = item.querySelector('.nav-text')?.innerText;
                if (text) {
                    item.classList.add('tooltip');
                    item.setAttribute('data-tooltip', text);
                }
            });
            if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-chevron-right text-xl"></i>';
        } else {
            sidebar.classList.add('sidebar-expanded');
            sidebar.classList.remove('sidebar-collapsed');
            mainContent.style.marginLeft = '280px';
            localStorage.setItem('adminSidebarCollapsed', 'false');
            document.querySelectorAll('.nav-text, .admin-info, .logo-text').forEach(el => {
                if (el) el.style.display = '';
            });
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('tooltip');
                item.removeAttribute('data-tooltip');
            });
            if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-chevron-left text-xl"></i>';
        }
    }
    
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileOverlay = document.getElementById('mobileOverlay');
    if (mobileMenuBtn && mobileOverlay) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.add('mobile-open');
            mobileOverlay.classList.remove('hidden');
        });
        mobileOverlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            mobileOverlay.classList.add('hidden');
        });
    }
}

function setupDropdowns() {
    const btn = document.getElementById('adminMenuBtn');
    const dropdown = document.getElementById('adminDropdown');
    if (!btn || !dropdown) return;
    
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    });
    
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== btn) {
            dropdown.classList.add('hidden');
        }
    });
}

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in ${type === 'success' ? 'bg-green-500 text-white' : type === 'error' ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

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
    setupTabs();
    setupEditModal();
    setupSuspendButton();
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
    .animate-fade-in { animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: loading 1.5s infinite; }
    @keyframes loading { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .status-active { background: #d1fae5; color: #059669; }
    .status-inactive { background: #fee2e2; color: #dc2626; }
    .status-suspended { background: #fef3c7; color: #d97706; }
`;
document.head.appendChild(style);