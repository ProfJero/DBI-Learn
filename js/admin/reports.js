import { 
    auth, signOut, db, doc, getDoc, getDocs, collection, query, where, 
    onAuthStateChanged, orderBy, limit, Timestamp
} from '../firebase-config.js';

let currentAdmin = null;
let usersData = [];
let coursesData = [];
let enrollmentsData = [];
let quizAttemptsData = [];
let resourcesData = [];
let certificatesData = [];
let discussionsData = [];

// Charts
let userGrowthChart, enrollmentChart, categoryChart, quizPerformanceChart;
let demographicsChart, activityHourChart, topCoursesChart, completionRatesChart;
let dailyActiveChart, featureUsageChart;

// Date range
let fromDate = null;
let toDate = null;

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '../../login.html'; return; }
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && (userDoc.data().role === 'admin' || userDoc.data().role === 'super_admin')) {
        currentAdmin = user;
        await loadAdminData(user.uid);
        await loadAllData();
        await loadNotifications(user.uid);
        setupDateRange();
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

// Load all data from Firestore
async function loadAllData() {
    try {
        // Load users
        const usersSnapshot = await getDocs(collection(db, 'users'));
        usersData = [];
        usersSnapshot.forEach(doc => usersData.push({ id: doc.id, ...doc.data() }));
        
        // Load courses
        const coursesSnapshot = await getDocs(collection(db, 'courses'));
        coursesData = [];
        coursesSnapshot.forEach(doc => coursesData.push({ id: doc.id, ...doc.data() }));
        
        // Load enrollments
        const enrollmentsSnapshot = await getDocs(collection(db, 'enrollments'));
        enrollmentsData = [];
        enrollmentsSnapshot.forEach(doc => enrollmentsData.push({ id: doc.id, ...doc.data() }));
        
        // Load quiz attempts (from both standalone and course-specific)
        quizAttemptsData = [];
        
        // Get standalone quiz attempts
        try {
            const quizAttemptsSnapshot = await getDocs(collection(db, 'quizAttempts'));
            quizAttemptsSnapshot.forEach(doc => quizAttemptsData.push({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.log('No standalone quiz attempts found');
        }
        
        // Get quiz attempts from courses
        for (const course of coursesData) {
            try {
                const courseAttemptsRef = collection(db, 'courses', course.id, 'quizAttempts');
                const attemptsSnapshot = await getDocs(courseAttemptsRef);
                attemptsSnapshot.forEach(doc => {
                    quizAttemptsData.push({ id: doc.id, ...doc.data(), courseId: course.id, courseTitle: course.title });
                });
            } catch (e) {
                // No quiz attempts for this course
            }
        }
        
        // Load resources
        const resourcesSnapshot = await getDocs(collection(db, 'resources'));
        resourcesData = [];
        resourcesSnapshot.forEach(doc => resourcesData.push({ id: doc.id, ...doc.data() }));
        
        // Load certificates
        try {
            const certificatesSnapshot = await getDocs(collection(db, 'certificates'));
            certificatesData = [];
            certificatesSnapshot.forEach(doc => certificatesData.push({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.log('No certificates found');
        }
        
        // Load discussions/comments
        discussionsData = [];
        for (const course of coursesData) {
            try {
                const discussionsRef = collection(db, 'courses', course.id, 'discussions');
                const discussionsSnapshot = await getDocs(discussionsRef);
                discussionsSnapshot.forEach(doc => {
                    discussionsData.push({ id: doc.id, ...doc.data(), courseId: course.id, courseTitle: course.title });
                });
            } catch (e) {
                // No discussions for this course
            }
        }
        
        // Update overview stats
        updateOverviewStats();
        
        // Initialize all charts with real data
        initCharts();
        
        // Load tables
        loadTopUsers();
        loadCourseDetails();
        loadActivityFeed();
        
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Failed to load analytics data', 'error');
    }
}

// Update overview statistics with ONLY real data (no assumptions)
function updateOverviewStats() {
    const students = usersData.filter(u => u.role === 'student');
    const activeStudents = students.filter(s => s.status === 'active').length;
    const completedEnrollments = enrollmentsData.filter(e => e.status === 'completed').length;
    const completionRate = enrollmentsData.length > 0 ? Math.round((completedEnrollments / enrollmentsData.length) * 100) : 0;
    
    const quizScores = quizAttemptsData.filter(q => q.score).map(q => q.score);
    const avgScore = quizScores.length > 0 ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : 0;
    
    // Calculate growth percentages (compare with previous period)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const currentMonthEnrollments = enrollmentsData.filter(e => {
        const date = e.enrolledAt ? new Date(e.enrolledAt) : null;
        return date && date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    }).length;
    
    const lastMonthEnrollments = enrollmentsData.filter(e => {
        const date = e.enrolledAt ? new Date(e.enrolledAt) : null;
        return date && date.getMonth() === currentMonth - 1 && date.getFullYear() === currentYear;
    }).length;
    
    const enrollmentGrowth = lastMonthEnrollments > 0 
        ? Math.round(((currentMonthEnrollments - lastMonthEnrollments) / lastMonthEnrollments) * 100)
        : (currentMonthEnrollments > 0 ? 100 : 0);
    
    // REMOVED: Revenue calculations (since no price data exists)
    // Instead, show total enrollments as a meaningful metric
    const totalEnrollments = enrollmentsData.length;
    
    const studentGrowth = students.length > 0 ? Math.round((activeStudents / students.length) * 100) : 0;
    
    // Calculate completion growth
    const lastMonthCompletions = enrollmentsData.filter(e => {
        const date = e.completedAt ? new Date(e.completedAt) : null;
        return date && date.getMonth() === currentMonth - 1 && date.getFullYear() === currentYear;
    }).length;
    const completionGrowth = lastMonthCompletions > 0 
        ? Math.round(((completedEnrollments - lastMonthCompletions) / lastMonthCompletions) * 100)
        : (completedEnrollments > 0 ? 100 : 0);
    
    // Calculate score improvement
    const lastMonthScores = quizAttemptsData.filter(q => {
        const date = q.completedAt ? new Date(q.completedAt) : null;
        return date && date.getMonth() === currentMonth - 1 && date.getFullYear() === currentYear;
    }).map(q => q.score);
    const lastMonthAvg = lastMonthScores.length > 0 ? lastMonthScores.reduce((a, b) => a + b, 0) / lastMonthScores.length : 0;
    const scoreGrowth = lastMonthAvg > 0 ? Math.round(((avgScore - lastMonthAvg) / lastMonthAvg) * 100) : (avgScore > 0 ? 100 : 0);
    
    // Update DOM - REMOVED revenue card and replaced with total enrollments
    const totalRevenueEl = document.getElementById('totalRevenue');
    if (totalRevenueEl) {
        totalRevenueEl.textContent = `${totalEnrollments}`;
        // Update the label from "Total Revenue" to "Total Enrollments"
        const revenueLabel = totalRevenueEl.closest('.report-card')?.querySelector('.text-gray-500');
        if (revenueLabel && revenueLabel.textContent === 'Total Revenue') {
            revenueLabel.textContent = 'Total Enrollments';
        }
    }
    
    const revenueGrowthEl = document.getElementById('revenueGrowth');
    if (revenueGrowthEl) {
        revenueGrowthEl.textContent = `${enrollmentGrowth > 0 ? '+' : ''}${enrollmentGrowth}%`;
        // Update the label text
        const growthSpan = revenueGrowthEl.nextElementSibling;
        if (growthSpan && growthSpan.textContent === 'vs last period') {
            growthSpan.textContent = 'vs last month';
        }
    }
    
    document.getElementById('activeStudents').textContent = activeStudents;
    document.getElementById('studentGrowth').textContent = `${studentGrowth > 0 ? '+' : ''}${studentGrowth}%`;
    document.getElementById('completionRate').textContent = `${completionRate}%`;
    document.getElementById('completionGrowth').textContent = `${completionGrowth > 0 ? '+' : ''}${completionGrowth}%`;
    document.getElementById('avgQuizScore').textContent = `${avgScore}%`;
    document.getElementById('scoreGrowth').textContent = `${scoreGrowth > 0 ? '+' : ''}${scoreGrowth}%`;
}

// Generate monthly data from real enrollments
function getMonthlyData() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const userData = new Array(12).fill(0);
    const enrollmentData = new Array(12).fill(0);
    
    usersData.forEach(user => {
        if (user.createdAt) {
            const date = new Date(user.createdAt);
            const month = date.getMonth();
            userData[month]++;
        }
    });
    
    enrollmentsData.forEach(enrollment => {
        if (enrollment.enrolledAt) {
            const date = new Date(enrollment.enrolledAt);
            const month = date.getMonth();
            enrollmentData[month]++;
        }
    });
    
    return { months, userData, enrollmentData };
}

// Get category distribution from real courses
function getCategoryDistribution() {
    const categories = {};
    coursesData.forEach(course => {
        const category = course.category || 'General';
        categories[category] = (categories[category] || 0) + 1;
    });
    
    // If no categories, return empty
    if (Object.keys(categories).length === 0) {
        return { labels: ['No Data'], data: [1] };
    }
    
    const labels = Object.keys(categories);
    const data = Object.values(categories);
    return { labels, data };
}

// Get quiz score distribution from real attempts
function getScoreDistribution() {
    const distribution = {
        '0-20%': 0,
        '21-40%': 0,
        '41-60%': 0,
        '61-80%': 0,
        '81-100%': 0
    };
    
    quizAttemptsData.forEach(attempt => {
        const score = attempt.score || 0;
        if (score <= 20) distribution['0-20%']++;
        else if (score <= 40) distribution['21-40%']++;
        else if (score <= 60) distribution['41-60%']++;
        else if (score <= 80) distribution['61-80%']++;
        else distribution['81-100%']++;
    });
    
    // If no quiz data, return placeholder
    if (quizAttemptsData.length === 0) {
        return { labels: ['No Quiz Data'], data: [1] };
    }
    
    return {
        labels: Object.keys(distribution),
        data: Object.values(distribution)
    };
}

// Get user demographics from real data if available
function getDemographics() {
    const ageGroups = { '18-24': 0, '25-34': 0, '35-44': 0, '45+': 0 };
    let hasAgeData = false;
    
    usersData.forEach(user => {
        if (user.birthDate) {
            hasAgeData = true;
            const age = new Date().getFullYear() - new Date(user.birthDate).getFullYear();
            if (age < 25) ageGroups['18-24']++;
            else if (age < 35) ageGroups['25-34']++;
            else if (age < 45) ageGroups['35-44']++;
            else ageGroups['45+']++;
        }
    });
    
    if (!hasAgeData) {
        return { labels: ['Age data not available'], data: [1] };
    }
    
    return {
        labels: Object.keys(ageGroups).filter(k => ageGroups[k] > 0),
        data: Object.values(ageGroups).filter(v => v > 0)
    };
}

// Get activity by hour from real data
function getActivityByHour() {
    const hourlyData = new Array(24).fill(0);
    
    // Use quiz attempts and enrollments as activity indicators
    const activities = [...quizAttemptsData, ...enrollmentsData];
    
    activities.forEach(activity => {
        const date = activity.completedAt || activity.enrolledAt || activity.createdAt;
        if (date) {
            const hour = new Date(date).getHours();
            hourlyData[hour]++;
        }
    });
    
    // If no activity data, show empty chart
    if (activities.length === 0) {
        return new Array(24).fill(0);
    }
    
    return hourlyData;
}

// Get daily active users from real data
function getDailyActiveUsers() {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dailyData = new Array(7).fill(0);
    
    // Use quiz attempts as activity
    quizAttemptsData.forEach(attempt => {
        if (attempt.completedAt) {
            const day = new Date(attempt.completedAt).getDay();
            const index = day === 0 ? 6 : day - 1;
            dailyData[index]++;
        }
    });
    
    return { days, dailyData };
}

// Get feature usage from real data
function getFeatureUsage() {
    const features = ['Courses', 'Quizzes', 'Resources', 'Discussions', 'Certificates'];
    const usage = [
        coursesData.length,
        quizAttemptsData.length,
        resourcesData.length,
        discussionsData.length,
        certificatesData.length
    ];
    
    // Normalize to percentages based on max
    const maxUsage = Math.max(...usage, 1);
    const percentages = usage.map(u => Math.round((u / maxUsage) * 100));
    
    return { features, usage: percentages };
}

// Initialize all charts with real data
function initCharts() {
    // User Growth Chart
    const { months, userData, enrollmentData } = getMonthlyData();
    
    const ctx1 = document.getElementById('userGrowthChart')?.getContext('2d');
    if (ctx1) {
        if (userGrowthChart) userGrowthChart.destroy();
        userGrowthChart = new Chart(ctx1, {
            type: 'line',
            data: { 
                labels: months, 
                datasets: [
                    { label: 'New Users', data: userData, borderColor: '#1e88e5', backgroundColor: 'rgba(30, 136, 229, 0.1)', tension: 0.4, fill: true },
                    { label: 'Enrollments', data: enrollmentData, borderColor: '#00c853', backgroundColor: 'rgba(0, 200, 83, 0.1)', tension: 0.4, fill: true }
                ] 
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }
        });
    }
    
    // Enrollment Chart
    const ctx2 = document.getElementById('enrollmentChart')?.getContext('2d');
    if (ctx2) {
        if (enrollmentChart) enrollmentChart.destroy();
        enrollmentChart = new Chart(ctx2, {
            type: 'bar', 
            data: { labels: months, datasets: [{ label: 'Enrollments', data: enrollmentData, backgroundColor: '#00c853', borderRadius: 8 }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    
    // Category Chart
    const { labels: catLabels, data: catData } = getCategoryDistribution();
    const ctx3 = document.getElementById('categoryChart')?.getContext('2d');
    if (ctx3 && catLabels.length > 0) {
        if (categoryChart) categoryChart.destroy();
        categoryChart = new Chart(ctx3, {
            type: 'doughnut', 
            data: { labels: catLabels, datasets: [{ data: catData, backgroundColor: ['#1e88e5', '#00c853', '#f59e0b', '#ef4444', '#8b5cf6', '#ec489a', '#14b8a6'] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    
    // Quiz Performance Chart
    const { labels: scoreLabels, data: scoreData } = getScoreDistribution();
    const ctx4 = document.getElementById('quizPerformanceChart')?.getContext('2d');
    if (ctx4 && scoreLabels.length > 0) {
        if (quizPerformanceChart) quizPerformanceChart.destroy();
        quizPerformanceChart = new Chart(ctx4, {
            type: 'bar', 
            data: { labels: scoreLabels, datasets: [{ label: 'Students', data: scoreData, backgroundColor: '#1e88e5' }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    
    // Demographics Chart
    const { labels: demoLabels, data: demoData } = getDemographics();
    const ctx5 = document.getElementById('demographicsChart')?.getContext('2d');
    if (ctx5 && demoLabels.length > 0 && demoLabels[0] !== 'Age data not available') {
        if (demographicsChart) demographicsChart.destroy();
        demographicsChart = new Chart(ctx5, {
            type: 'pie', 
            data: { labels: demoLabels, datasets: [{ data: demoData, backgroundColor: ['#1e88e5', '#00c853', '#f59e0b', '#ef4444'] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    } else if (ctx5) {
        // Show empty state
        if (demographicsChart) demographicsChart.destroy();
        demographicsChart = new Chart(ctx5, {
            type: 'pie',
            data: { labels: ['No Age Data'], datasets: [{ data: [1], backgroundColor: ['#e5e7eb'] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: () => 'No demographic data available' } } } }
        });
    }
    
    // Activity by Hour Chart
    const hours = Array.from({length: 24}, (_, i) => `${i}:00`);
    const activityData = getActivityByHour();
    const ctx6 = document.getElementById('activityHourChart')?.getContext('2d');
    if (ctx6) {
        if (activityHourChart) activityHourChart.destroy();
        activityHourChart = new Chart(ctx6, {
            type: 'line', 
            data: { labels: hours, datasets: [{ label: 'Activity Count', data: activityData, borderColor: '#1e88e5', fill: true, backgroundColor: 'rgba(30, 136, 229, 0.1)' }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    
    // Top Courses Chart
    const topCourses = coursesData.slice(0, 5).map(c => c.title?.substring(0, 15) || 'Course');
    const enrollCounts = coursesData.slice(0, 5).map(c => enrollmentsData.filter(e => e.courseId === c.id).length);
    const ctx7 = document.getElementById('topCoursesChart')?.getContext('2d');
    if (ctx7 && topCourses.length > 0) {
        if (topCoursesChart) topCoursesChart.destroy();
        topCoursesChart = new Chart(ctx7, {
            type: 'bar', 
            data: { labels: topCourses, datasets: [{ label: 'Enrollments', data: enrollCounts, backgroundColor: '#00c853' }] },
            options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' }
        });
    }
    
    // Completion Rates Chart
    const completionRates = coursesData.slice(0, 5).map(c => {
        const enrolls = enrollmentsData.filter(e => e.courseId === c.id);
        const completed = enrolls.filter(e => e.status === 'completed').length;
        return enrolls.length > 0 ? Math.round((completed / enrolls.length) * 100) : 0;
    });
    const ctx8 = document.getElementById('completionRatesChart')?.getContext('2d');
    if (ctx8 && topCourses.length > 0) {
        if (completionRatesChart) completionRatesChart.destroy();
        completionRatesChart = new Chart(ctx8, {
            type: 'bar', 
            data: { labels: topCourses, datasets: [{ label: 'Completion Rate (%)', data: completionRates, backgroundColor: '#1e88e5' }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { max: 100, title: { display: true, text: 'Completion Rate (%)' } } } }
        });
    }
    
    // Daily Active Users Chart
    const { days, dailyData } = getDailyActiveUsers();
    const ctx9 = document.getElementById('dailyActiveChart')?.getContext('2d');
    if (ctx9) {
        if (dailyActiveChart) dailyActiveChart.destroy();
        dailyActiveChart = new Chart(ctx9, {
            type: 'line', 
            data: { labels: days, datasets: [{ label: 'Quiz Attempts', data: dailyData, borderColor: '#00c853', fill: true, backgroundColor: 'rgba(0, 200, 83, 0.1)' }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    
    // Feature Usage Chart
    const { features, usage } = getFeatureUsage();
    const ctx10 = document.getElementById('featureUsageChart')?.getContext('2d');
    if (ctx10) {
        if (featureUsageChart) featureUsageChart.destroy();
        featureUsageChart = new Chart(ctx10, {
            type: 'radar', 
            data: { labels: features, datasets: [{ label: 'Usage (%)', data: usage, backgroundColor: 'rgba(30, 136, 229, 0.2)', borderColor: '#1e88e5' }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { r: { max: 100, ticks: { stepSize: 20 } } } }
        });
    }
}

// Load top users
async function loadTopUsers() {
    const tbody = document.getElementById('topUsersBody');
    const students = usersData.filter(u => u.role === 'student').slice(0, 10);
    
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">No user data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = students.map(student => {
        const userEnrollments = enrollmentsData.filter(e => e.studentId === student.id);
        const completed = userEnrollments.filter(e => e.status === 'completed').length;
        const userQuizzes = quizAttemptsData.filter(q => q.studentId === student.id);
        const avgScore = userQuizzes.length > 0 ? Math.round(userQuizzes.reduce((a, b) => a + (b.score || 0), 0) / userQuizzes.length) : 0;
        const hoursSpent = Math.round(userEnrollments.reduce((a, b) => a + ((b.progress || 0) / 100 * 20), 0));
        
        return `
            <tr class="border-b border-gray-100">
                <td class="py-3"><div class="flex items-center space-x-2"><img src="https://ui-avatars.com/api/?background=1e88e5&color=fff&size=32&name=${encodeURIComponent(student.fullName || 'User')}" class="w-8 h-8 rounded-full"><span>${escapeHtml(student.fullName || 'Anonymous')}</span></div></td>
                <td class="py-3">${userEnrollments.length}</td>
                <td class="py-3">${completed}</td>
                <td class="py-3">${avgScore}%</td>
                <td class="py-3">${hoursSpent}</td>
             </tr>
        `;
    }).join('');
}

// Load course details
async function loadCourseDetails() {
    const tbody = document.getElementById('courseDetailsBody');
    const topCoursesByEnrollment = coursesData.map(course => {
        const enrollments = enrollmentsData.filter(e => e.courseId === course.id);
        const completed = enrollments.filter(e => e.status === 'completed').length;
        return { ...course, enrollCount: enrollments.length, completionRate: enrollments.length > 0 ? Math.round((completed / enrollments.length) * 100) : 0 };
    }).sort((a, b) => b.enrollCount - a.enrollCount).slice(0, 10);
    
    if (topCoursesByEnrollment.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">No course data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = topCoursesByEnrollment.map(course => {
        const instructor = usersData.find(u => u.id === course.instructorId);
        return `
            <tr class="border-b border-gray-100">
                <td class="py-3 font-medium">${escapeHtml(course.title || 'Untitled')}</td>
                <td class="py-3">${course.enrollCount}</td>
                <td class="py-3"><div class="flex items-center space-x-2"><div class="w-16 bg-gray-200 rounded-full h-2"><div class="bg-[#1e88e5] rounded-full h-2" style="width: ${course.completionRate}%"></div></div><span>${course.completionRate}%</span></div></td>
                <td class="py-3">${course.rating || 'N/A'} ★</td>
                <td class="py-3">${instructor?.fullName?.split(' ')[0] || 'Admin'}</td>
             </tr>
        `;
    }).join('');
}

// Load activity feed
async function loadActivityFeed() {
    const container = document.getElementById('activityFeed');
    
    // Combine all activities
    const activities = [];
    
    usersData.slice(0, 20).forEach(user => {
        if (user.createdAt) {
            activities.push({ 
                type: 'user', 
                action: `${escapeHtml(user.fullName || 'A user')} joined the platform`, 
                date: user.createdAt, 
                icon: 'fa-user-plus', 
                color: 'blue' 
            });
        }
    });
    
    enrollmentsData.slice(0, 20).forEach(enrollment => {
        const course = coursesData.find(c => c.id === enrollment.courseId);
        const student = usersData.find(u => u.id === enrollment.studentId);
        if (enrollment.enrolledAt) {
            activities.push({ 
                type: 'enrollment', 
                action: `${escapeHtml(student?.fullName || 'A student')} enrolled in ${escapeHtml(course?.title || 'a course')}`, 
                date: enrollment.enrolledAt, 
                icon: 'fa-graduation-cap', 
                color: 'green' 
            });
        }
    });
    
    quizAttemptsData.filter(q => q.completedAt).slice(0, 20).forEach(quiz => {
        const student = usersData.find(u => u.id === quiz.studentId);
        activities.push({ 
            type: 'quiz', 
            action: `${escapeHtml(student?.fullName || 'A student')} completed quiz with ${quiz.score || 0}% score`, 
            date: quiz.completedAt, 
            icon: 'fa-question-circle', 
            color: 'orange' 
        });
    });
    
    certificatesData.slice(0, 20).forEach(cert => {
        const student = usersData.find(u => u.id === cert.studentId);
        if (cert.issuedAt) {
            activities.push({ 
                type: 'certificate', 
                action: `${escapeHtml(student?.fullName || 'A student')} earned certificate for ${escapeHtml(cert.courseTitle || 'course')}`, 
                date: cert.issuedAt, 
                icon: 'fa-certificate', 
                color: 'purple' 
            });
        }
    });
    
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentActivities = activities.slice(0, 15);
    
    if (recentActivities.length === 0) {
        container.innerHTML = '<div class="text-center py-8"><i class="fas fa-clock text-gray-300 text-3xl mb-2"></i><p class="text-gray-500">No recent activity</p></div>';
        return;
    }
    
    container.innerHTML = recentActivities.map(activity => `
        <div class="flex items-center space-x-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition">
            <div class="w-8 h-8 bg-${activity.color}-100 rounded-full flex items-center justify-center">
                <i class="fas ${activity.icon} text-${activity.color}-600 text-sm"></i>
            </div>
            <div class="flex-1">
                <p class="text-sm text-gray-800">${activity.action}</p>
                <p class="text-xs text-gray-500">${getTimeAgo(activity.date)}</p>
            </div>
        </div>
    `).join('');
}

// Get time ago
function getTimeAgo(date) {
    if (!date) return 'Just now';
    const d = date.toDate ? date.toDate() : new Date(date);
    const diff = new Date() - d;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return d.toLocaleDateString();
}

// Setup date range
function setupDateRange() {
    const fromInput = document.getElementById('fromDate');
    const toInput = document.getElementById('toDate');
    const applyBtn = document.getElementById('applyDateRange');
    const resetBtn = document.getElementById('resetDateRange');
    
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    fromInput.value = thirtyDaysAgo.toISOString().split('T')[0];
    toInput.value = today.toISOString().split('T')[0];
    
    applyBtn.addEventListener('click', () => {
        fromDate = fromInput.value ? new Date(fromInput.value) : null;
        toDate = toInput.value ? new Date(toInput.value) : null;
        refreshData();
    });
    
    resetBtn.addEventListener('click', () => {
        fromInput.value = '';
        toInput.value = '';
        fromDate = null;
        toDate = null;
        refreshData();
    });
}

// Refresh data based on date range
function refreshData() {
    // Filter data based on date range
    let filteredEnrollments = enrollmentsData;
    let filteredUsers = usersData;
    let filteredQuizzes = quizAttemptsData;
    
    if (fromDate) {
        filteredEnrollments = filteredEnrollments.filter(e => e.enrolledAt && new Date(e.enrolledAt) >= fromDate);
        filteredUsers = filteredUsers.filter(u => u.createdAt && new Date(u.createdAt) >= fromDate);
        filteredQuizzes = filteredQuizzes.filter(q => q.completedAt && new Date(q.completedAt) >= fromDate);
    }
    if (toDate) {
        filteredEnrollments = filteredEnrollments.filter(e => e.enrolledAt && new Date(e.enrolledAt) <= toDate);
        filteredUsers = filteredUsers.filter(u => u.createdAt && new Date(u.createdAt) <= toDate);
        filteredQuizzes = filteredQuizzes.filter(q => q.completedAt && new Date(q.completedAt) <= toDate);
    }
    
    // Update displays with filtered data
    updateOverviewStatsWithFilter(filteredUsers, filteredEnrollments, filteredQuizzes);
    showToast('Data refreshed for selected date range', 'success');
}

// Update stats with filtered data
function updateOverviewStatsWithFilter(filteredUsers, filteredEnrollments, filteredQuizzes) {
    const students = filteredUsers.filter(u => u.role === 'student');
    const activeStudents = students.filter(s => s.status === 'active').length;
    const completedEnrollments = filteredEnrollments.filter(e => e.status === 'completed').length;
    const completionRate = filteredEnrollments.length > 0 ? Math.round((completedEnrollments / filteredEnrollments.length) * 100) : 0;
    
    const quizScores = filteredQuizzes.filter(q => q.score).map(q => q.score);
    const avgScore = quizScores.length > 0 ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : 0;
    
    const totalEnrollments = filteredEnrollments.length;
    
    document.getElementById('activeStudents').textContent = activeStudents;
    document.getElementById('completionRate').textContent = `${completionRate}%`;
    document.getElementById('avgQuizScore').textContent = `${avgScore}%`;
    document.getElementById('totalRevenue').textContent = `${totalEnrollments}`;
}

// Tab switching
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = {
        'overview': document.getElementById('overviewTab'),
        'users': document.getElementById('usersTab'),
        'courses': document.getElementById('coursesTab'),
        'engagement': document.getElementById('engagementTab')
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
            
            Object.values(tabContents).forEach(content => content.classList.add('hidden'));
            if (tabContents[tabId]) tabContents[tabId].classList.remove('hidden');
        });
    });
}

// Export functions
document.getElementById('exportPDF')?.addEventListener('click', () => {
    showToast('PDF export coming soon!', 'info');
});

document.getElementById('exportExcel')?.addEventListener('click', () => {
    showToast('Excel export coming soon!', 'info');
});

document.getElementById('printReport')?.addEventListener('click', () => {
    window.print();
});

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

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function logout() { await signOut(auth); window.location.href = '../../login.html'; }

document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupSidebar();
    setupDropdowns();
    document.querySelectorAll('#logoutBtn, #logoutDropdown').forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); logout(); }));
});

const style = document.createElement('style');
style.textContent = `.animate-fade-in { animation: fadeIn 0.3s ease; } @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`;
document.head.appendChild(style);