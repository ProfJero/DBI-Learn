import { 
    auth, signOut, db, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
    collection, query, where, onAuthStateChanged, orderBy, limit
} from '../firebase-config.js';

let currentAdmin = null;
let allQuizAttempts = [];
let allCertificates = [];
let allStudents = [];
let allCourses = [];
let allQuizzes = [];

// Pagination variables
let resultsCurrentPage = 1;
let certCurrentPage = 1;
let studentCurrentPage = 1;
const itemsPerPage = 10;

// Chart instances
let quizPerformanceChart = null;
let courseEnrollmentChart = null;

// Signature images paths - matching student version
const SIGNATURES = {
    executiveDirector: '../images/signatures/executive-director.png',
    softwareDevelopment: '../images/signatures/head-software.png',
    graphicsMultimedia: '../images/signatures/head-graphics.png',
    dataAnalysis: '../images/signatures/head-data.png',
    digitalMarketing: '../images/signatures/head-marketing.png',
    cybersecurity: '../images/signatures/head-cyber.png',
    networkCloud: '../images/signatures/head-network.png',
    digitalSkills: '../images/signatures/head-digital.png'
};

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '../../login.html'; return; }
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && (userDoc.data().role === 'admin' || userDoc.data().role === 'super_admin')) {
        currentAdmin = user;
        await loadAdminData(user.uid);
        await loadAllData();
        await loadNotifications(user.uid);
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

// Load all data
async function loadAllData() {
    try {
        await Promise.all([
            loadStudents(),
            loadCourses(),
            loadQuizzes(),
            loadQuizAttempts(),
            loadCertificates()
        ]);
        
        updateStats();
        updateCharts();
        displayRecentAttempts();
        displayQuizResults();
        displayCertificates();
        displayStudents();
        populateFilters();
        
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Failed to load analytics data', 'error');
    }
}

// Load students
async function loadStudents() {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', 'student'));
    const snapshot = await getDocs(q);
    allStudents = [];
    snapshot.forEach(doc => {
        allStudents.push({ id: doc.id, ...doc.data() });
    });
}

// Load courses
async function loadCourses() {
    const coursesRef = collection(db, 'courses');
    const snapshot = await getDocs(coursesRef);
    allCourses = [];
    snapshot.forEach(doc => {
        allCourses.push({ id: doc.id, ...doc.data() });
    });
}

// Load quizzes
async function loadQuizzes() {
    const quizzesRef = collection(db, 'quizzes');
    const snapshot = await getDocs(quizzesRef);
    allQuizzes = [];
    snapshot.forEach(doc => {
        allQuizzes.push({ id: doc.id, ...doc.data() });
    });
}

// Load quiz attempts from all courses
async function loadQuizAttempts() {
    allQuizAttempts = [];
    
    for (const course of allCourses) {
        try {
            const attemptsRef = collection(db, 'courses', course.id, 'quizAttempts');
            const snapshot = await getDocs(attemptsRef);
            snapshot.forEach(doc => {
                const attempt = { id: doc.id, ...doc.data(), courseId: course.id, courseTitle: course.title };
                allQuizAttempts.push(attempt);
            });
        } catch (error) {
            console.log(`No quiz attempts for course: ${course.title}`);
        }
    }
    
    try {
        const standaloneAttemptsRef = collection(db, 'quizAttempts');
        const standaloneSnapshot = await getDocs(standaloneAttemptsRef);
        standaloneSnapshot.forEach(doc => {
            const attempt = { id: doc.id, ...doc.data() };
            const course = allCourses.find(c => c.id === attempt.courseId);
            if (course) {
                attempt.courseTitle = course.title;
            }
            allQuizAttempts.push(attempt);
        });
    } catch (error) {
        console.log('No standalone quiz attempts');
    }
    
    allQuizAttempts.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
}

// Load certificates
async function loadCertificates() {
    const certificatesRef = collection(db, 'certificates');
    const snapshot = await getDocs(certificatesRef);
    allCertificates = [];
    snapshot.forEach(doc => {
        allCertificates.push({ id: doc.id, ...doc.data() });
    });
    allCertificates.sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
}

// Update statistics
function updateStats() {
    document.getElementById('totalStudents').textContent = allStudents.length;
    document.getElementById('totalCourses').textContent = allCourses.length;
    document.getElementById('totalAttempts').textContent = allQuizAttempts.length;
    document.getElementById('totalCertificates').textContent = allCertificates.length;
}

// Update charts
function updateCharts() {
    const passedCount = allQuizAttempts.filter(a => a.passed === true).length;
    const failedCount = allQuizAttempts.filter(a => a.passed === false).length;
    
    const quizCtx = document.getElementById('quizPerformanceChart')?.getContext('2d');
    if (quizCtx) {
        if (quizPerformanceChart) quizPerformanceChart.destroy();
        quizPerformanceChart = new Chart(quizCtx, {
            type: 'doughnut',
            data: {
                labels: ['Passed', 'Failed'],
                datasets: [{
                    data: [passedCount, failedCount],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }
    
    const courseEnrollmentData = allCourses.slice(0, 5).map(c => c.enrolledStudents || 0);
    const courseLabels = allCourses.slice(0, 5).map(c => c.title?.substring(0, 20) || 'Unknown');
    
    const courseCtx = document.getElementById('courseEnrollmentChart')?.getContext('2d');
    if (courseCtx) {
        if (courseEnrollmentChart) courseEnrollmentChart.destroy();
        courseEnrollmentChart = new Chart(courseCtx, {
            type: 'bar',
            data: {
                labels: courseLabels,
                datasets: [{
                    label: 'Enrolled Students',
                    data: courseEnrollmentData,
                    backgroundColor: '#1e88e5',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

// Display recent attempts
function displayRecentAttempts() {
    const tbody = document.getElementById('recentAttemptsTable');
    const recentAttempts = allQuizAttempts.slice(0, 10);
    
    if (recentAttempts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-500">No quiz attempts yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = recentAttempts.map(attempt => {
        const student = allStudents.find(s => s.id === attempt.userId);
        const quiz = allQuizzes.find(q => q.id === attempt.quizId);
        const statusClass = attempt.passed ? 'status-passed' : 'status-failed';
        const statusText = attempt.passed ? 'Passed' : 'Failed';
        
        return `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="px-4 py-3 text-sm text-gray-800">${escapeHtml(student?.fullName || 'Unknown')}</td>
                <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(quiz?.title || attempt.quizTitle || 'Unknown Quiz')}</td>
                <td class="px-4 py-3 text-sm font-medium">${attempt.score || 0}%</td>
                <td class="px-4 py-3"><span class="px-2 py-1 rounded-full text-xs ${statusClass}">${statusText}</span></td>
                <td class="px-4 py-3 text-sm text-gray-500">${new Date(attempt.completedAt).toLocaleDateString()}</td>
                    </tr>
        `;
    }).join('');
}

// Populate filter dropdowns
function populateFilters() {
    const courseFilter = document.getElementById('filterCourse');
    const quizFilter = document.getElementById('filterQuiz');
    const progressCourseFilter = document.getElementById('progressCourseFilter');
    
    courseFilter.innerHTML = '<option value="">All Courses</option>' + 
        allCourses.map(c => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('');
    
    quizFilter.innerHTML = '<option value="">All Quizzes</option>' + 
        allQuizzes.map(q => `<option value="${q.id}">${escapeHtml(q.title)}</option>`).join('');
    
    progressCourseFilter.innerHTML = '<option value="">All Courses</option>' + 
        allCourses.map(c => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('');
}

// Display quiz results with filters
function displayQuizResults() {
    const courseId = document.getElementById('filterCourse')?.value;
    const quizId = document.getElementById('filterQuiz')?.value;
    const status = document.getElementById('filterStatus')?.value;
    
    let filtered = [...allQuizAttempts];
    
    if (courseId) {
        filtered = filtered.filter(a => a.courseId === courseId);
    }
    if (quizId) {
        filtered = filtered.filter(a => a.quizId === quizId);
    }
    if (status === 'passed') {
        filtered = filtered.filter(a => a.passed === true);
    } else if (status === 'failed') {
        filtered = filtered.filter(a => a.passed === false);
    }
    
    const start = (resultsCurrentPage - 1) * itemsPerPage;
    const pageResults = filtered.slice(start, start + itemsPerPage);
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    
    const tbody = document.getElementById('quizResultsTable');
    
    if (pageResults.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500">No quiz results found</td></tr>';
    } else {
        tbody.innerHTML = pageResults.map(attempt => {
            const student = allStudents.find(s => s.id === attempt.userId);
            const course = allCourses.find(c => c.id === attempt.courseId);
            const quiz = allQuizzes.find(q => q.id === attempt.quizId);
            const statusClass = attempt.passed ? 'status-passed' : 'status-failed';
            const statusText = attempt.passed ? 'Passed' : 'Failed';
            
            return `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="px-4 py-3 text-sm text-gray-800">${escapeHtml(student?.fullName || 'Unknown')}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(course?.title || attempt.courseTitle || 'Unknown')}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(quiz?.title || attempt.quizTitle || 'Unknown Quiz')}</td>
                    <td class="px-4 py-3 text-sm font-medium">${attempt.score || 0}%</td>
                    <td class="px-4 py-3"><span class="px-2 py-1 rounded-full text-xs ${statusClass}">${statusText}</span></td>
                    <td class="px-4 py-3 text-sm text-gray-500">${new Date(attempt.completedAt).toLocaleDateString()}</td>
                    <td class="px-4 py-3">
                        <button onclick="window.viewAttemptDetails('${attempt.id}')" class="text-[#1e88e5] hover:text-[#009e42]">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    document.getElementById('resultsPaginationInfo').textContent = `Showing ${start + 1}-${Math.min(start + itemsPerPage, filtered.length)} of ${filtered.length} results`;
    document.getElementById('resultsCurrentPage').textContent = `Page ${resultsCurrentPage}`;
    document.getElementById('resultsPrevPage').disabled = resultsCurrentPage === 1;
    document.getElementById('resultsNextPage').disabled = resultsCurrentPage === totalPages || totalPages === 0;
}

// Display certificates table
function displayCertificates() {
    const start = (certCurrentPage - 1) * itemsPerPage;
    const pageCerts = allCertificates.slice(start, start + itemsPerPage);
    const totalPages = Math.ceil(allCertificates.length / itemsPerPage);
    
    const tbody = document.getElementById('certificatesTable');
    
    if (pageCerts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-500">No certificates issued yet</td></tr>';
    } else {
        tbody.innerHTML = pageCerts.map(cert => {
            const student = allStudents.find(s => s.id === cert.studentId);
            const course = allCourses.find(c => c.id === cert.courseId);
            
            return `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="px-4 py-3 text-sm text-gray-800">${escapeHtml(student?.fullName || cert.studentName || 'Unknown')}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(course?.title || cert.courseTitle || 'Unknown')}</td>
                    <td class="px-4 py-3 text-sm font-mono text-xs">${cert.certificateId}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${new Date(cert.issuedAt).toLocaleDateString()}</td>
                    <td class="px-4 py-3">
                        <button onclick="window.viewCertificate('${cert.id}')" class="text-[#1e88e5] hover:text-[#009e42] mr-2" title="View Certificate">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="window.downloadCertificate('${cert.id}')" class="text-green-500 hover:text-green-700" title="Download Certificate">
                            <i class="fas fa-download"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    document.getElementById('certPaginationInfo').textContent = `Showing ${start + 1}-${Math.min(start + itemsPerPage, allCertificates.length)} of ${allCertificates.length} certificates`;
    document.getElementById('certCurrentPage').textContent = `Page ${certCurrentPage}`;
    document.getElementById('certPrevPage').disabled = certCurrentPage === 1;
    document.getElementById('certNextPage').disabled = certCurrentPage === totalPages || totalPages === 0;
}

// Display students with progress
function displayStudents() {
    const searchTerm = document.getElementById('studentSearch')?.value.toLowerCase() || '';
    const courseFilter = document.getElementById('progressCourseFilter')?.value;
    
    let filtered = [...allStudents];
    
    if (searchTerm) {
        filtered = filtered.filter(s => 
            s.fullName?.toLowerCase().includes(searchTerm) ||
            s.email?.toLowerCase().includes(searchTerm)
        );
    }
    
    const start = (studentCurrentPage - 1) * itemsPerPage;
    const pageStudents = filtered.slice(start, start + itemsPerPage);
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    
    const container = document.getElementById('studentsGrid');
    
    if (pageStudents.length === 0) {
        container.innerHTML = '<div class="col-span-3 text-center py-12 text-gray-500">No students found</div>';
    } else {
        container.innerHTML = pageStudents.map(student => {
            const studentAttempts = allQuizAttempts.filter(a => a.userId === student.id);
            const passedQuizzes = studentAttempts.filter(a => a.passed).length;
            const avgScore = studentAttempts.length > 0 
                ? Math.round(studentAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / studentAttempts.length)
                : 0;
            
            return `
                <div class="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition">
                    <div class="flex items-center space-x-3 mb-4">
                        <img src="https://ui-avatars.com/api/?background=1e88e5&color=fff&size=48&name=${encodeURIComponent(student.fullName || 'Student')}" 
                             class="w-12 h-12 rounded-full">
                        <div>
                            <h3 class="font-semibold text-gray-800">${escapeHtml(student.fullName || 'Unknown')}</h3>
                            <p class="text-xs text-gray-500">${escapeHtml(student.email || 'No email')}</p>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-500">Quiz Attempts:</span>
                            <span class="font-medium">${studentAttempts.length}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-500">Passed Quizzes:</span>
                            <span class="font-medium text-green-600">${passedQuizzes}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-500">Avg. Score:</span>
                            <span class="font-medium">${avgScore}%</span>
                        </div>
                        <div class="mt-3">
                            <button onclick="window.viewStudentDetails('${student.id}')" 
                                    class="w-full py-2 text-sm bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42] transition">
                                <i class="fas fa-chart-line mr-1"></i> View Progress
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    document.getElementById('studentPaginationInfo').textContent = `Showing ${start + 1}-${Math.min(start + itemsPerPage, filtered.length)} of ${filtered.length} students`;
    document.getElementById('studentCurrentPage').textContent = `Page ${studentCurrentPage}`;
    document.getElementById('studentPrevPage').disabled = studentCurrentPage === 1;
    document.getElementById('studentNextPage').disabled = studentCurrentPage === totalPages || totalPages === 0;
}

// View student details
window.viewStudentDetails = async (studentId) => {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;
    
    const studentAttempts = allQuizAttempts.filter(a => a.userId === studentId);
    const passedAttempts = studentAttempts.filter(a => a.passed);
    const certificates = allCertificates.filter(c => c.studentId === studentId);
    
    const modal = document.getElementById('studentModal');
    const title = document.getElementById('studentModalTitle');
    const content = document.getElementById('studentModalContent');
    
    title.textContent = `${student.fullName || 'Student'} - Progress Report`;
    
    content.innerHTML = `
        <div class="space-y-6">
            <!-- Student Info -->
            <div class="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <img src="https://ui-avatars.com/api/?background=1e88e5&color=fff&size=64&name=${encodeURIComponent(student.fullName || 'Student')}" 
                     class="w-16 h-16 rounded-full">
                <div>
                    <h3 class="text-lg font-semibold text-gray-800">${escapeHtml(student.fullName || 'Unknown')}</h3>
                    <p class="text-sm text-gray-500">${escapeHtml(student.email || 'No email')}</p>
                    <p class="text-sm text-gray-500">Joined: ${student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'N/A'}</p>
                </div>
            </div>
            
            <!-- Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-blue-50 rounded-lg p-4 text-center">
                    <p class="text-2xl font-bold text-blue-600">${studentAttempts.length}</p>
                    <p class="text-sm text-gray-600">Quiz Attempts</p>
                </div>
                <div class="bg-green-50 rounded-lg p-4 text-center">
                    <p class="text-2xl font-bold text-green-600">${passedAttempts.length}</p>
                    <p class="text-sm text-gray-600">Passed Quizzes</p>
                </div>
                <div class="bg-orange-50 rounded-lg p-4 text-center">
                    <p class="text-2xl font-bold text-orange-600">${certificates.length}</p>
                    <p class="text-sm text-gray-600">Certificates Earned</p>
                </div>
            </div>
            
            <!-- Quiz Attempts -->
            <div>
                <h4 class="font-semibold text-gray-800 mb-3">Quiz History</h4>
                <div class="space-y-2 max-h-96 overflow-y-auto">
                    ${studentAttempts.length === 0 ? 
                        '<p class="text-gray-500 text-center py-4">No quiz attempts yet</p>' :
                        studentAttempts.map(attempt => {
                            const quiz = allQuizzes.find(q => q.id === attempt.quizId);
                            const statusClass = attempt.passed ? 'text-green-600' : 'text-red-600';
                            return `
                                <div class="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                                    <div class="flex justify-between items-start">
                                        <div>
                                            <p class="font-medium text-gray-800">${escapeHtml(quiz?.title || attempt.quizTitle || 'Unknown Quiz')}</p>
                                            <p class="text-xs text-gray-500">${new Date(attempt.completedAt).toLocaleString()}</p>
                                        </div>
                                        <div class="text-right">
                                            <p class="font-bold ${statusClass}">${attempt.score || 0}%</p>
                                            <p class="text-xs ${statusClass}">${attempt.passed ? 'Passed' : 'Failed'}</p>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')
                    }
                </div>
            </div>
            
            <!-- Certificates -->
            ${certificates.length > 0 ? `
                <div>
                    <h4 class="font-semibold text-gray-800 mb-3">Certificates Earned</h4>
                    <div class="space-y-2">
                        ${certificates.map(cert => `
                            <div class="border border-gray-200 rounded-lg p-3 flex justify-between items-center">
                                <div>
                                    <p class="font-medium text-gray-800">${escapeHtml(cert.courseTitle || 'Course')}</p>
                                    <p class="text-xs text-gray-500">Certificate ID: ${cert.certificateId}</p>
                                </div>
                                <button onclick="window.viewCertificate('${cert.id}')" class="text-[#1e88e5] hover:text-[#009e42]">
                                    <i class="fas fa-eye mr-1"></i> View
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    modal.classList.remove('hidden');
};

// View attempt details
window.viewAttemptDetails = (attemptId) => {
    const attempt = allQuizAttempts.find(a => a.id === attemptId);
    if (!attempt) return;
    
    const student = allStudents.find(s => s.id === attempt.userId);
    const quiz = allQuizzes.find(q => q.id === attempt.quizId);
    
    const modal = document.getElementById('studentModal');
    const title = document.getElementById('studentModalTitle');
    const content = document.getElementById('studentModalContent');
    
    title.textContent = `Quiz Results: ${quiz?.title || attempt.quizTitle || 'Quiz'}`;
    
    content.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                    <p class="text-sm text-gray-500">Student</p>
                    <p class="font-medium">${escapeHtml(student?.fullName || 'Unknown')}</p>
                </div>
                <div class="text-right">
                    <p class="text-sm text-gray-500">Date</p>
                    <p class="font-medium">${new Date(attempt.completedAt).toLocaleString()}</p>
                </div>
            </div>
            
            <div class="text-center p-6 ${attempt.passed ? 'bg-green-50' : 'bg-red-50'} rounded-lg">
                <p class="text-4xl font-bold ${attempt.passed ? 'text-green-600' : 'text-red-600'}">${attempt.score || 0}%</p>
                <p class="text-sm mt-2">${attempt.correctAnswers || 0} out of ${attempt.totalQuestions || 0} correct</p>
                <p class="text-sm mt-1">Passing Score: ${attempt.passMark || 70}%</p>
                <span class="inline-block mt-3 px-3 py-1 rounded-full text-sm ${attempt.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                    ${attempt.passed ? 'Passed' : 'Failed'}
                </span>
            </div>
            
            ${attempt.answers ? `
                <div>
                    <h4 class="font-semibold text-gray-800 mb-3">Answers</h4>
                    <div class="space-y-3 max-h-96 overflow-y-auto">
                        ${quiz?.questions?.map((q, idx) => {
                            const userAnswer = attempt.answers[idx];
                            const isCorrect = userAnswer === q.correct;
                            return `
                                <div class="border border-gray-200 rounded-lg p-3">
                                    <p class="font-medium text-gray-800 mb-2">${idx + 1}. ${escapeHtml(q.text)}</p>
                                    <div class="ml-4">
                                        <p class="text-sm">Your answer: <span class="${isCorrect ? 'text-green-600' : 'text-red-600'} font-medium">${q.options[userAnswer] || 'Not answered'}</span></p>
                                        ${!isCorrect ? `<p class="text-sm text-green-600">Correct answer: ${q.options[q.correct]}</p>` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('') || '<p class="text-gray-500">Detailed answers not available</p>'}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    modal.classList.remove('hidden');
};

// Get achievement level (matching student version)
function getAchievementLevel(score) {
    if (score >= 90) {
        return { name: 'Platinum', icon: '🏆', color: '#6b7280', bgGradient: 'linear-gradient(135deg, #6b7280, #4b5563)', borderColor: '#6b7280' };
    } else if (score >= 80) {
        return { name: 'Gold', icon: '🥇', color: '#fbbf24', bgGradient: 'linear-gradient(135deg, #fbbf24, #d97706)', borderColor: '#fbbf24' };
    } else if (score >= 70) {
        return { name: 'Silver', icon: '🥈', color: '#94a3b8', bgGradient: 'linear-gradient(135deg, #94a3b8, #64748b)', borderColor: '#94a3b8' };
    } else if (score >= 60) {
        return { name: 'Bronze', icon: '🥉', color: '#cd7f32', bgGradient: 'linear-gradient(135deg, #cd7f32, #b87333)', borderColor: '#cd7f32' };
    } else {
        return { name: 'Achiever', icon: '🌟', color: '#1e88e5', bgGradient: 'linear-gradient(135deg, #1e88e5, #00c853)', borderColor: '#1e88e5' };
    }
}

// Determine department from course title
function determineDepartment(courseTitle) {
    const title = courseTitle.toLowerCase();
    if (title.includes('software') || title.includes('programming') || title.includes('development') || 
        title.includes('java') || title.includes('python') || title.includes('web') || title.includes('full stack')) {
        return 'Software Development';
    } else if (title.includes('graphic') || title.includes('design') || title.includes('multimedia') || 
               title.includes('ui/ux') || title.includes('animation')) {
        return 'Graphics & Multimedia';
    } else if (title.includes('data') || title.includes('analytics') || title.includes('machine learning') || 
               title.includes('ai') || title.includes('database') || title.includes('sql') || title.includes('big data')) {
        return 'Data Analysis';
    } else if (title.includes('digital marketing') || title.includes('social media') || title.includes('seo')) {
        return 'Digital Marketing';
    } else if (title.includes('cyber') || title.includes('security') || title.includes('ethical hacking')) {
        return 'Cybersecurity';
    } else if (title.includes('network') || title.includes('cloud') || title.includes('devops')) {
        return 'Network & Cloud';
    }
    return 'Digital Skills';
}

// Get department head information
function getDepartmentHead(department) {
    const departmentHeads = {
        'Software Development': {
            name: 'Benjamin Amoako',
            title: 'Head of Software Development',
            department: 'DigitalCore'
        },
        'Graphics & Multimedia': {
            name: 'Abel Eduah',
            title: 'Head of Graphics & Multimedia',
            department: 'Creative Impact'
        },
        'Data Analysis': {
            name: 'Godsway Arhin',
            title: 'Head of Data Analysis',
            department: 'Next Gen DATA-LAB'
        }
    };
    return departmentHeads[department] || {
        name: 'Benjamin Amoako',
        title: 'Head of Department',
        department: 'DigitalBridge Academy'
    };
}

// Get signature image based on department
function getSignatureImage(department) {
    const signatureMap = {
        'Software Development': SIGNATURES.softwareDevelopment,
        'Graphics & Multimedia': SIGNATURES.graphicsMultimedia,
        'Data Analysis': SIGNATURES.dataAnalysis,
        'Digital Marketing': SIGNATURES.digitalMarketing,
        'Cybersecurity': SIGNATURES.cybersecurity,
        'Network & Cloud': SIGNATURES.networkCloud,
        'Digital Skills': SIGNATURES.digitalSkills
    };
    return signatureMap[department] || SIGNATURES.digitalSkills;
}

// Generate certificate HTML (matching student design exactly) - FIXED URL
function generateCertificateHTML(certificate, student, course) {
    const score = certificate.score || 75;
    const level = getAchievementLevel(score);
    const department = certificate.department || determineDepartment(certificate.courseTitle);
    const departmentHead = getDepartmentHead(department);
    
    const issueDate = certificate.issuedAt ? new Date(certificate.issuedAt) : new Date();
    const formattedDate = issueDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const studentName = student?.fullName || certificate.studentName || 'Student';
    // FIXED URL - Changed from dbi-learning.com to dbi-learn.pages.dev
    const verificationUrl = `https://dbi-learn.pages.dev/verify-certificate?id=${certificate.certificateId}`;
    const qrContainerId = `qrContainer_${Date.now()}`;
    
    return `
        <div class="certificate-container" style="background: white; width: 100%; max-width: 800px; margin: 0 auto; font-family: 'Inter', sans-serif; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
            <div style="position: relative; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);">
                <!-- Outer decorative border -->
                <div style="position: absolute; top: 15px; left: 15px; right: 15px; bottom: 15px; border: 2px solid #1e88e5; border-radius: 12px; pointer-events: none;"></div>
                <div style="position: absolute; top: 20px; left: 20px; right: 20px; bottom: 20px; border: 1px solid #00c853; border-radius: 8px; pointer-events: none;"></div>
                
                <!-- Corner decorations -->
                <div style="position: absolute; top: 25px; left: 25px;">
                    <div style="width: 40px; height: 40px; border-top: 3px solid #1e88e5; border-left: 3px solid #1e88e5;"></div>
                </div>
                <div style="position: absolute; top: 25px; right: 25px;">
                    <div style="width: 40px; height: 40px; border-top: 3px solid #00c853; border-right: 3px solid #00c853;"></div>
                </div>
                <div style="position: absolute; bottom: 25px; left: 25px;">
                    <div style="width: 40px; height: 40px; border-bottom: 3px solid #00c853; border-left: 3px solid #00c853;"></div>
                </div>
                <div style="position: absolute; bottom: 25px; right: 25px;">
                    <div style="width: 40px; height: 40px; border-bottom: 3px solid #1e88e5; border-right: 3px solid #1e88e5;"></div>
                </div>
                
                <!-- Content -->
                <div style="padding: 50px 40px 40px 40px;">
                    <!-- Logo -->
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="../images/digital-bridge-initiative-logo.png" alt="DBI Logo" style="height: 60px; width: auto; margin: 0 auto;">
                        <p style="color: #6b7280; font-size: 12px; margin-top: 8px;">Bridging the Digital Divide Through Excellence</p>
                        <div style="width: 80px; height: 2px; background: linear-gradient(90deg, #1e88e5, #00c853); margin: 10px auto 0;"></div>
                    </div>
                    
                    <!-- Certificate Title -->
                    <div style="text-align: center; margin: 20px 0;">
                        <h2 style="color: #6b7280; font-size: 24px; font-weight: 300; margin: 0;">Certificate of</h2>
                        <h1 style="color: #1e88e5; font-size: 48px; font-weight: 700; margin: 5px 0 0; letter-spacing: 2px;">Completion</h1>
                    </div>
                    
                    <!-- Achievement Badge -->
                    <div style="text-align: center; margin: 15px 0;">
                        <div style="display: inline-flex; align-items: center; padding: 8px 24px; background: ${level.bgGradient}; color: white; border-radius: 50px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                            <span style="font-size: 20px; margin-right: 8px;">${level.icon}</span>
                            <span style="font-weight: 600;">${level.name} Level Achievement</span>
                        </div>
                    </div>
                    
                    <!-- Recipient -->
                    <div style="text-align: center; margin: 25px 0 20px;">
                        <p style="color: #6b7280; font-size: 16px; margin: 0;">This certificate is proudly presented to</p>
                        <h3 style="color: #00335f; font-size: 28px; font-weight: 700; margin: 10px 0 0; border-bottom: 2px solid #00c853; display: inline-block; padding-bottom: 5px;">
                            ${escapeHtml(studentName)}
                        </h3>
                    </div>
                    
                    <!-- Course -->
                    <div style="text-align: center; margin: 20px 0;">
                        <p style="color: #6b7280; font-size: 14px;">for successfully completing</p>
                        <h4 style="color: #1e88e5; font-size: 20px; font-weight: 600; margin: 8px 0 10px;">${escapeHtml(certificate.courseTitle)}</h4>
                        <div style="display: inline-block; padding: 4px 16px; background: #f3f4f6; border-radius: 20px;">
                            <span style="color: #00335f; font-size: 12px;">${department} Track</span>
                        </div>
                    </div>
                    
                    <!-- ================ Score Display =============
                    <div style="text-align: center; margin: 15px auto;">
                        <div style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; background: #f8fafc; border-radius: 30px;">
                            <span style="color: #6b7280; font-size: 12px;">Final Score:</span>
                            <span style="font-weight: 700; color: #1e88e5; font-size: 18px;">${score}%</span>
                            <span style="color: #6b7280; font-size: 11px;">(Passing: ${certificate.passMark || 70}%)</span>
                        </div>
                    </div>
                    -- >
                    
                    <!-- Description -->
                    <div style="text-align: center; margin: 20px auto; max-width: 500px;">
                        <p style="color: #9ca3af; font-size: 12px; font-style: italic; line-height: 1.5;">
                            This certificate acknowledges the exceptional dedication, technical proficiency, 
                            and successful completion of all course requirements with demonstrated excellence 
                            in the field of digital technology.
                        </p>
                    </div>
                    
                    <!-- Signatures and QR -->
                    <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
                        <!-- Executive Director Signature -->
                        <div style="text-align: center; flex: 1;">
                            <div style="margin-bottom: 5px; min-height: 60px;">
                                <img src="${SIGNATURES.executiveDirector}" 
                                     alt="Executive Director Signature" 
                                     style="height: 50px; width: auto; margin: 0 auto; object-fit: contain;"
                                     onerror="this.style.display='none'">
                                <div style="width: 120px; height: 1px; background: #6b7280; margin: 5px auto;"></div>
                                <div style="color: #6b7280; font-size: 10px;">Digitally Signed</div>
                            </div>
                            <p style="font-weight: 600; color: #00335f; font-size: 12px; margin: 5px 0 2px;">Benjamin Amoako</p>
                            <p style="color: #1e88e5; font-size: 10px; margin: 0;">Executive Director</p>
                            <p style="color: #6b7280; font-size: 9px; margin: 0;">Digital Bridge Initiative</p>
                        </div>
                        
                        <!-- QR Code -->
                        <div style="text-align: center; flex: 1;">
                            <div id="${qrContainerId}" style="width: 80px; height: 80px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid #1e88e5; overflow: hidden;"></div>
                            <p style="color: #6b7280; font-size: 9px; margin-top: 8px; font-family: monospace;">ID: ${certificate.certificateId.slice(0, 30)}</p>
                            <p style="color: #6b7280; font-size: 9px;">Issued: ${formattedDate}</p>
                            <button onclick="window.copyVerificationLink('${verificationUrl}')" 
                                    style="color: #1e88e5; font-size: 9px; background: none; border: none; cursor: pointer; margin-top: 4px;">
                                <i class="fas fa-link"></i> Verify
                            </button>
                        </div>
                        
                        <!-- Department Head Signature -->
                        <div style="text-align: center; flex: 1;">
                            <div style="margin-bottom: 5px; min-height: 60px;">
                                <img src="${getSignatureImage(department)}" 
                                     alt="${departmentHead.title} Signature" 
                                     style="height: 50px; width: auto; margin: 0 auto; object-fit: contain;"
                                     onerror="this.style.display='none'">
                                <div style="width: 120px; height: 1px; background: #6b7280; margin: 5px auto;"></div>
                                <div style="color: #6b7280; font-size: 10px;">Digitally Signed</div>
                            </div>
                            <p style="font-weight: 600; color: #00335f; font-size: 12px; margin: 5px 0 2px;">${departmentHead.name}</p>
                            <p style="color: #1e88e5; font-size: 10px; margin: 0;">${departmentHead.title}</p>
                            <p style="color: #6b7280; font-size: 9px; margin: 0;">${departmentHead.department}</p>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div style="margin-top: 25px; text-align: center;">
                        <div style="display: inline-flex; align-items: center; gap: 8px;">
                            <i class="fas fa-certificate" style="color: #1e88e5; font-size: 12px;"></i>
                            <span style="color: #6b7280; font-size: 10px;">Digitally Verified Certificate</span>
                            <i class="fas fa-shield-alt" style="color: #00c853; font-size: 12px;"></i>
                        </div>
                        <p style="color: #d1d5db; font-size: 8px; margin-top: 10px;">This certificate is issued by Digital Bridge Initiative - Empowering the Next Generation of Digital Leaders</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Generate QR code for certificate
async function generateQRCode(text, containerId) {
    try {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        if (typeof QRCode === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        if (typeof QRCode !== 'undefined') {
            new QRCode(container, {
                text: text,
                width: 80,
                height: 80,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        } else {
            container.innerHTML = `<div style="width:80px;height:80px;display:flex;align-items:center;justify-content:center;background:#f0f0f0;font-size:10px;">QR</div>`;
        }
    } catch (error) {
        console.error('QR Code generation failed:', error);
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `<div style="width:80px;height:80px;display:flex;align-items:center;justify-content:center;background:#f0f0f0;font-size:10px;">QR</div>`;
        }
    }
}

// View certificate - FIXED URL
window.viewCertificate = async (certificateId) => {
    const certificate = allCertificates.find(c => c.id === certificateId);
    if (!certificate) return;
    
    const student = allStudents.find(s => s.id === certificate.studentId);
    const course = allCourses.find(c => c.id === certificate.courseId);
    
    const modal = document.getElementById('studentModal');
    const title = document.getElementById('studentModalTitle');
    const content = document.getElementById('studentModalContent');
    
    title.textContent = `Certificate: ${certificate.courseTitle || 'Course Certificate'}`;
    
    content.innerHTML = generateCertificateHTML(certificate, student, course);
    modal.classList.remove('hidden');
    
    // Generate QR code after content is loaded - FIXED URL
    setTimeout(() => {
        const qrContainer = content.querySelector('[id*="qrContainer_"]');
        if (qrContainer) {
            const verificationUrl = `https://dbi-learn.pages.dev/verify-certificate?id=${certificate.certificateId}`;
            generateQRCode(verificationUrl, qrContainer.id);
        }
    }, 200);
};

// Download certificate - FIXED URL
window.downloadCertificate = async (certificateId) => {
    const certificate = allCertificates.find(c => c.id === certificateId);
    if (!certificate) return;
    
    const student = allStudents.find(s => s.id === certificate.studentId);
    const course = allCourses.find(c => c.id === certificate.courseId);
    
    const btn = event.target.closest('button');
    const originalText = btn?.innerHTML || 'Download';
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Generating...';
        btn.disabled = true;
    }
    
    try {
        const container = document.createElement('div');
        container.innerHTML = generateCertificateHTML(certificate, student, course);
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '-9999px';
        container.style.backgroundColor = 'white';
        container.style.width = '800px';
        document.body.appendChild(container);
        
        // Find QR container and generate QR code - FIXED URL
        const qrDiv = container.querySelector('[id*="qrContainer_"]');
        if (qrDiv) {
            const verificationUrl = `https://dbi-learn.pages.dev/verify-certificate?id=${certificate.certificateId}`;
            qrDiv.innerHTML = '';
            
            if (typeof QRCode === 'undefined') {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }
            
            if (typeof QRCode !== 'undefined') {
                new QRCode(qrDiv, {
                    text: verificationUrl,
                    width: 80,
                    height: 80,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (typeof html2canvas === 'undefined') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
        }
        
        if (typeof jspdf === 'undefined') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const canvas = await html2canvas(container, {
            scale: 3,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true
        });
        
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        const pdfWidth = 210;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${certificate.courseTitle.replace(/[^a-z0-9]/gi, '_')}_Certificate.pdf`);
        
        document.body.removeChild(container);
        showToast('Certificate downloaded successfully!', 'success');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        showToast('Failed to generate PDF. Please try again.', 'error');
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
};

// Load script helper
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Copy verification link
window.copyVerificationLink = async (url) => {
    try {
        await navigator.clipboard.writeText(url);
        showToast('Verification link copied!', 'success');
    } catch (error) {
        console.error('Failed to copy:', error);
        showToast('Failed to copy link', 'error');
    }
};

// Export results
document.getElementById('exportResultsBtn')?.addEventListener('click', () => {
    const courseId = document.getElementById('filterCourse')?.value;
    const quizId = document.getElementById('filterQuiz')?.value;
    const status = document.getElementById('filterStatus')?.value;
    
    let filtered = [...allQuizAttempts];
    
    if (courseId) filtered = filtered.filter(a => a.courseId === courseId);
    if (quizId) filtered = filtered.filter(a => a.quizId === quizId);
    if (status === 'passed') filtered = filtered.filter(a => a.passed === true);
    else if (status === 'failed') filtered = filtered.filter(a => a.passed === false);
    
    const csv = [
        ['Student', 'Course', 'Quiz', 'Score', 'Status', 'Date'],
        ...filtered.map(a => {
            const student = allStudents.find(s => s.id === a.userId);
            const course = allCourses.find(c => c.id === a.courseId);
            const quiz = allQuizzes.find(q => q.id === a.quizId);
            return [
                student?.fullName || 'Unknown',
                course?.title || a.courseTitle || 'Unknown',
                quiz?.title || a.quizTitle || 'Unknown',
                `${a.score || 0}%`,
                a.passed ? 'Passed' : 'Failed',
                new Date(a.completedAt).toLocaleDateString()
            ];
        })
    ].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz_results_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Results exported successfully', 'success');
});

// Export certificates
document.getElementById('exportCertificatesBtn')?.addEventListener('click', () => {
    const csv = [
        ['Student', 'Course', 'Certificate ID', 'Issued Date', 'Score'],
        ...allCertificates.map(cert => {
            const student = allStudents.find(s => s.id === cert.studentId);
            return [
                student?.fullName || cert.studentName || 'Unknown',
                cert.courseTitle || 'Unknown',
                cert.certificateId,
                new Date(cert.issuedAt).toLocaleDateString(),
                `${cert.score || 0}%`
            ];
        })
    ].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certificates_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Certificates exported successfully', 'success');
});

// Filter event listeners
document.getElementById('filterCourse')?.addEventListener('change', () => {
    resultsCurrentPage = 1;
    displayQuizResults();
});

document.getElementById('filterQuiz')?.addEventListener('change', () => {
    resultsCurrentPage = 1;
    displayQuizResults();
});

document.getElementById('filterStatus')?.addEventListener('change', () => {
    resultsCurrentPage = 1;
    displayQuizResults();
});

document.getElementById('studentSearch')?.addEventListener('input', () => {
    studentCurrentPage = 1;
    displayStudents();
});

document.getElementById('progressCourseFilter')?.addEventListener('change', () => {
    studentCurrentPage = 1;
    displayStudents();
});

// Pagination buttons
document.getElementById('resultsPrevPage')?.addEventListener('click', () => {
    if (resultsCurrentPage > 1) { resultsCurrentPage--; displayQuizResults(); }
});
document.getElementById('resultsNextPage')?.addEventListener('click', () => {
    resultsCurrentPage++; displayQuizResults();
});
document.getElementById('certPrevPage')?.addEventListener('click', () => {
    if (certCurrentPage > 1) { certCurrentPage--; displayCertificates(); }
});
document.getElementById('certNextPage')?.addEventListener('click', () => {
    certCurrentPage++; displayCertificates();
});
document.getElementById('studentPrevPage')?.addEventListener('click', () => {
    if (studentCurrentPage > 1) { studentCurrentPage--; displayStudents(); }
});
document.getElementById('studentNextPage')?.addEventListener('click', () => {
    studentCurrentPage++; displayStudents();
});

// Tab switching
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = {
        'overview': document.getElementById('overviewTab'),
        'quiz-results': document.getElementById('quizResultsTab'),
        'certificates': document.getElementById('certificatesTab'),
        'student-progress': document.getElementById('studentProgressTab')
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
            
            if (tabId === 'overview') {
                setTimeout(() => updateCharts(), 100);
            }
        });
    });
}

// Close modal
document.getElementById('closeStudentModal')?.addEventListener('click', () => {
    document.getElementById('studentModal').classList.add('hidden');
});

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
    toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

async function logout() { await signOut(auth); window.location.href = '../../login.html'; }

document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupSidebar();
    setupDropdowns();
    document.querySelectorAll('#logoutBtn, #logoutDropdown').forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); logout(); }));
});

// Make functions available globally
window.viewStudentDetails = viewStudentDetails;
window.viewAttemptDetails = viewAttemptDetails;
window.viewCertificate = viewCertificate;
window.downloadCertificate = downloadCertificate;
window.copyVerificationLink = copyVerificationLink;

const style = document.createElement('style');
style.textContent = `.animate-fade-in { animation: fadeIn 0.3s ease; } @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }`;
document.head.appendChild(style);