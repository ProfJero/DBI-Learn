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
    addDoc,
    updateDoc,
    orderBy,
    limit
} from '../firebase-config.js';

let currentUser = null;
let availableQuizzes = [];
let completedQuizzes = [];
let quizAttempts = [];
let currentQuiz = null;
let currentAnswers = {};
let timerInterval = null;

// Chart instances
let performanceChart = null;
let categoryChart = null;
let scoreDistributionChart = null;

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../login.html';
    } else {
        currentUser = user;
        await loadUserData(user.uid);
        await loadQuizzes(user.uid);
        await loadQuizAttempts(user.uid);
        await loadNotifications(user.uid);
    }
});

// Load user data
async function loadUserData(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            document.getElementById('userName').textContent = userData.fullName || 'Student';
            document.getElementById('userRole').textContent = userData.role || 'Student';
            
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

// Load quizzes
async function loadQuizzes(userId) {
    try {
        const quizzesRef = collection(db, 'quizzes');
        const q = query(quizzesRef, where('status', '==', 'published'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        availableQuizzes = [];
        snapshot.forEach(doc => {
            availableQuizzes.push({ id: doc.id, ...doc.data() });
        });
        
        // Get completed quiz IDs from attempts
        const attemptsRef = collection(db, 'quizAttempts');
        const attemptsQuery = query(attemptsRef, where('studentId', '==', userId), where('status', '==', 'completed'));
        const attemptsSnapshot = await getDocs(attemptsQuery);
        
        const completedQuizIds = new Set();
        attemptsSnapshot.forEach(doc => {
            const attempt = doc.data();
            completedQuizIds.add(attempt.quizId);
        });
        
        completedQuizzes = availableQuizzes.filter(quiz => completedQuizIds.has(quiz.id));
        
        updateStats();
        updateAchievementLevel();
        displayAvailableQuizzes();
        displayCompletedQuizzes();
        
    } catch (error) {
        console.error('Error loading quizzes:', error);
        displayFallbackQuizzes();
    }
}

// Load quiz attempts
async function loadQuizAttempts(userId) {
    try {
        const attemptsRef = collection(db, 'quizAttempts');
        const q = query(attemptsRef, where('studentId', '==', userId), orderBy('completedAt', 'desc'));
        const snapshot = await getDocs(q);
        
        quizAttempts = [];
        snapshot.forEach(doc => {
            quizAttempts.push({ id: doc.id, ...doc.data() });
        });
        
        // Update all analytics
        updateOverallStats();
        updateCharts();
        updateInsights();
        displayRecentActivity();
        
    } catch (error) {
        console.error('Error loading quiz attempts:', error);
    }
}

// Update main stats
function updateStats() {
    const totalQuizzes = availableQuizzes.length;
    const completedCount = completedQuizzes.length;
    const scores = quizAttempts.map(attempt => attempt.score || 0);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
    
    document.getElementById('totalQuizzes').textContent = totalQuizzes;
    document.getElementById('completedQuizzes').textContent = completedCount;
    document.getElementById('avgScore').textContent = `${avgScore}%`;
    document.getElementById('bestScore').textContent = `${bestScore}%`;
}

// Update overall stats for overview tab
function updateOverallStats() {
    const scores = quizAttempts.map(attempt => attempt.score || 0);
    const overallScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    
    // Update overall score circle
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (overallScore / 100) * circumference;
    const ring = document.getElementById('overallScoreRing');
    if (ring) {
        ring.style.strokeDashoffset = offset;
    }
    document.getElementById('overallScoreValue').textContent = `${overallScore}%`;
    
    // Calculate completion rate
    const totalQuizzes = availableQuizzes.length;
    const completedCount = completedQuizzes.length;
    const completionRate = totalQuizzes > 0 ? Math.round((completedCount / totalQuizzes) * 100) : 0;
    document.getElementById('quizCompletionRate').textContent = `${completionRate}%`;
    
    // Calculate streak (simplified - consecutive days with quiz attempts)
    if (quizAttempts.length > 0) {
        const dates = quizAttempts.map(a => new Date(a.completedAt).toDateString());
        const uniqueDates = [...new Set(dates)];
        let streak = 1;
        let currentDate = new Date();
        for (let i = uniqueDates.length - 1; i >= 0; i--) {
            const attemptDate = new Date(uniqueDates[i]);
            const diffDays = Math.floor((currentDate - attemptDate) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) {
                streak = 1;
            } else if (diffDays === 1) {
                streak++;
                currentDate = attemptDate;
            } else {
                break;
            }
        }
        document.getElementById('currentStreak').textContent = streak;
    } else {
        document.getElementById('currentStreak').textContent = '0';
    }
}

// Update achievement level
function updateAchievementLevel() {
    const scores = quizAttempts.map(attempt => attempt.score || 0);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const completedCount = completedQuizzes.length;
    
    let level = '';
    let icon = '';
    let message = '';
    let progress = 0;
    let nextMilestone = '';
    
    if (completedCount === 0) {
        level = 'Starting Out';
        icon = '🌟';
        message = 'Complete your first quiz to begin your journey!';
        progress = 0;
        nextMilestone = 'Complete 1 quiz to reach Explorer';
    } else if (avgScore < 60) {
        level = 'Explorer';
        icon = '🧭';
        message = `${Math.round(60 - avgScore)}% more to reach Bronze!`;
        progress = (avgScore / 60) * 100;
        nextMilestone = 'Next: Bronze (60% average score)';
    } else if (avgScore < 70) {
        level = 'Bronze';
        icon = '🥉';
        message = `Great start! ${Math.round(70 - avgScore)}% to Silver!`;
        progress = ((avgScore - 60) / 10) * 100;
        nextMilestone = 'Next: Silver (70% average score)';
    } else if (avgScore < 80) {
        level = 'Silver';
        icon = '🥈';
        message = `Excellent progress! ${Math.round(80 - avgScore)}% to Gold!`;
        progress = ((avgScore - 70) / 10) * 100;
        nextMilestone = 'Next: Gold (80% average score)';
    } else if (avgScore < 90) {
        level = 'Gold';
        icon = '🥇';
        message = `Outstanding! ${Math.round(90 - avgScore)}% to Platinum!`;
        progress = ((avgScore - 80) / 10) * 100;
        nextMilestone = 'Next: Platinum (90% average score)';
    } else {
        level = 'Platinum';
        icon = '🏆';
        message = 'Exceptional! You\'re among the top performers!';
        progress = 100;
        nextMilestone = '🏆 Master Level Achieved!';
    }
    
    document.getElementById('achievementLevel').textContent = level;
    document.getElementById('achievementIcon').textContent = icon;
    document.getElementById('achievementMessage').textContent = message;
    document.getElementById('achievementProgress').style.width = `${Math.min(progress, 100)}%`;
    document.getElementById('nextMilestone').textContent = nextMilestone;
}

// Display available quizzes
function displayAvailableQuizzes() {
    const container = document.getElementById('availableQuizzesGrid');
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    
    let filtered = availableQuizzes.filter(quiz => 
        quiz.title.toLowerCase().includes(searchTerm) ||
        (quiz.category || '').toLowerCase().includes(searchTerm)
    );
    
    const completedIds = new Set(completedQuizzes.map(q => q.id));
    filtered = filtered.filter(quiz => !completedIds.has(quiz.id));
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-3 text-center py-12">
                <i class="fas fa-check-circle text-5xl text-green-300 mb-3"></i>
                <p class="text-gray-500">All caught up! No quizzes available.</p>
                <p class="text-sm text-gray-400 mt-1">Check back later for new challenges</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(quiz => `
        <div class="quiz-card bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition cursor-pointer" onclick="window.startQuiz('${quiz.id}')">
            <div class="h-32 bg-gradient-to-r from-[#1e88e5] to-[#00c853] p-4 text-white">
                <div class="flex justify-between items-start">
                    <i class="fas fa-question-circle text-3xl opacity-50"></i>
                    <span class="text-xs bg-white/20 px-2 py-1 rounded-full">${quiz.questions?.length || 0} questions</span>
                </div>
            </div>
            <div class="p-5">
                <h3 class="font-semibold text-gray-800 mb-2">${escapeHtml(quiz.title)}</h3>
                <p class="text-sm text-gray-600 mb-3">${escapeHtml(quiz.description || 'Test your knowledge')}</p>
                <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-500">
                        <i class="fas fa-clock mr-1"></i> ${quiz.timeLimit || 15} min
                    </span>
                    <span class="text-[#1e88e5] font-medium">Start Quiz →</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Display completed quizzes
function displayCompletedQuizzes() {
    const container = document.getElementById('completedQuizzesGrid');
    
    if (completedQuizzes.length === 0) {
        container.innerHTML = `
            <div class="col-span-3 text-center py-12">
                <i class="fas fa-book-open text-5xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No completed quizzes yet</p>
                <p class="text-sm text-gray-400 mt-1">Take your first quiz to see results here</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = completedQuizzes.map(quiz => {
        const attempt = quizAttempts.find(a => a.quizId === quiz.id);
        const score = attempt?.score || 0;
        const passed = score >= (quiz.passingScore || 70);
        
        return `
            <div class="quiz-card bg-white rounded-xl shadow-sm overflow-hidden">
                <div class="h-32 ${passed ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-orange-500 to-orange-600'} p-4 text-white">
                    <div class="flex justify-between items-start">
                        <i class="fas ${passed ? 'fa-trophy' : 'fa-chart-line'} text-3xl opacity-50"></i>
                        <span class="text-xs bg-white/20 px-2 py-1 rounded-full">Score: ${score}%</span>
                    </div>
                </div>
                <div class="p-5">
                    <h3 class="font-semibold text-gray-800 mb-2">${escapeHtml(quiz.title)}</h3>
                    <div class="flex items-center justify-between mb-3">
                        <div class="score-circle relative">
                            <svg width="60" height="60" viewBox="0 0 60 60">
                                <circle cx="30" cy="30" r="26" fill="none" stroke="#e5e7eb" stroke-width="3"/>
                                <circle cx="30" cy="30" r="26" fill="none" stroke="${passed ? '#00c853' : '#f59e0b'}" stroke-width="3" 
                                        stroke-dasharray="163.36" stroke-dashoffset="${163.36 - (score / 100) * 163.36}" stroke-linecap="round"/>
                            </svg>
                            <div class="absolute inset-0 flex items-center justify-center">
                                <span class="text-sm font-bold">${score}%</span>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-sm ${passed ? 'text-green-600' : 'text-orange-600'} font-medium">
                                ${passed ? 'Passed!' : 'Failed'}
                            </p>
                            <p class="text-xs text-gray-500 mt-1">
                                ${new Date(attempt?.completedAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                    <button onclick="window.viewQuizResults('${quiz.id}')" class="w-full py-2 border border-[#1e88e5] text-[#1e88e5] rounded-lg hover:bg-[#1e88e5] hover:text-white transition">
                        View Details
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Display recent activity
function displayRecentActivity() {
    const tbody = document.getElementById('recentActivityTable');
    
    if (quizAttempts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">No quiz attempts yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = quizAttempts.slice(0, 10).map(attempt => {
        const quiz = availableQuizzes.find(q => q.id === attempt.quizId);
        const passed = attempt.score >= (quiz?.passingScore || 70);
        
        return `
            <tr class="border-b border-gray-100">
                <td class="py-3 font-medium">${escapeHtml(quiz?.title || 'Unknown Quiz')}</td>
                <td class="py-3 text-sm text-gray-500">${new Date(attempt.completedAt).toLocaleDateString()}</td>
                <td class="py-3">
                    <span class="font-semibold ${passed ? 'text-green-600' : 'text-orange-600'}">${attempt.score}%</span>
                </td>
                <td class="py-3 text-sm text-gray-500">${attempt.timeSpent || 'N/A'}</td>
                <td class="py-3">
                    <span class="px-2 py-1 text-xs rounded-full ${passed ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}">
                        ${passed ? 'Passed' : 'Failed'}
                    </span>
                </td>
                <td class="py-3">
                    <button onclick="window.viewQuizResults('${attempt.quizId}')" class="text-[#1e88e5] hover:text-[#009e42]">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
             </tr>
        `;
    }).join('');
}

// Update charts
function updateCharts() {
    if (quizAttempts.length === 0) return;
    
    // Performance chart (scores over time)
    const ctx1 = document.getElementById('performanceChart')?.getContext('2d');
    if (ctx1) {
        const labels = quizAttempts.map(a => new Date(a.completedAt).toLocaleDateString());
        const scores = quizAttempts.map(a => a.score);
        
        if (performanceChart) performanceChart.destroy();
        performanceChart = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: labels.reverse(),
                datasets: [{
                    label: 'Quiz Score (%)',
                    data: scores.reverse(),
                    borderColor: '#1e88e5',
                    backgroundColor: 'rgba(30, 136, 229, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: { display: true, text: 'Score (%)' }
                    }
                }
            }
        });
    }
    
    // Category chart
    const ctx2 = document.getElementById('categoryChart')?.getContext('2d');
    if (ctx2) {
        const categories = {};
        quizAttempts.forEach(attempt => {
            const quiz = availableQuizzes.find(q => q.id === attempt.quizId);
            const category = quiz?.category || 'General';
            if (!categories[category]) {
                categories[category] = { total: 0, count: 0 };
            }
            categories[category].total += attempt.score;
            categories[category].count++;
        });
        
        const labels = Object.keys(categories);
        const avgScores = labels.map(cat => Math.round(categories[cat].total / categories[cat].count));
        
        if (categoryChart) categoryChart.destroy();
        categoryChart = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Average Score (%)',
                    data: avgScores,
                    backgroundColor: '#00c853',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: { display: true, text: 'Score (%)' }
                    }
                }
            }
        });
    }
    
    // Score distribution chart
    const ctx3 = document.getElementById('scoreDistributionChart')?.getContext('2d');
    if (ctx3) {
        const distribution = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 };
        quizAttempts.forEach(attempt => {
            const score = attempt.score;
            if (score <= 20) distribution['0-20']++;
            else if (score <= 40) distribution['21-40']++;
            else if (score <= 60) distribution['41-60']++;
            else if (score <= 80) distribution['61-80']++;
            else distribution['81-100']++;
        });
        
        if (scoreDistributionChart) scoreDistributionChart.destroy();
        scoreDistributionChart = new Chart(ctx3, {
            type: 'doughnut',
            data: {
                labels: Object.keys(distribution),
                datasets: [{
                    data: Object.values(distribution),
                    backgroundColor: ['#ef4444', '#f59e0b', '#fbbf24', '#34d399', '#10b981'],
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
}

// Update insights
function updateInsights() {
    const container = document.getElementById('insightsContainer');
    if (!container) return;
    
    const scores = quizAttempts.map(a => a.score);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const passedCount = quizAttempts.filter(a => a.passed).length;
    const passRate = quizAttempts.length > 0 ? Math.round((passedCount / quizAttempts.length) * 100) : 0;
    const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const worstScore = scores.length > 0 ? Math.min(...scores) : 0;
    
    let insightMessage = '';
    if (passRate >= 80) {
        insightMessage = 'Excellent! You\'re consistently performing well. Keep up the great work! 🎯';
    } else if (passRate >= 60) {
        insightMessage = 'Good progress! Focus on reviewing incorrect answers to improve further. 📚';
    } else if (passRate >= 40) {
        insightMessage = 'Keep going! Consider reviewing course materials before attempting quizzes. 💪';
    } else {
        insightMessage = 'Every quiz is a learning opportunity. Review your answers and try again! 🌟';
    }
    
    container.innerHTML = `
        <div class="p-3 bg-blue-50 rounded-lg">
            <i class="fas fa-chart-line text-blue-500 mr-2"></i>
            <span class="text-sm font-medium">Overall Pass Rate: ${passRate}%</span>
        </div>
        <div class="p-3 bg-green-50 rounded-lg">
            <i class="fas fa-trophy text-green-500 mr-2"></i>
            <span class="text-sm font-medium">Best Score: ${bestScore}%</span>
        </div>
        <div class="p-3 bg-orange-50 rounded-lg">
            <i class="fas fa-chart-line text-orange-500 mr-2"></i>
            <span class="text-sm font-medium">Areas to Improve: ${worstScore < 70 ? 'Keep practicing!' : 'Looking good!'}</span>
        </div>
        <div class="p-3 bg-purple-50 rounded-lg">
            <i class="fas fa-lightbulb text-purple-500 mr-2"></i>
            <span class="text-sm">💡 Insight: ${insightMessage}</span>
        </div>
    `;
}

// Start quiz
async function startQuiz(quizId) {
    const quiz = availableQuizzes.find(q => q.id === quizId);
    if (!quiz) return;
    
    currentQuiz = quiz;
    currentAnswers = {};
    
    // Check if there's an in-progress attempt
    const existingAttempt = quizAttempts.find(a => a.quizId === quizId && a.status === 'in_progress');
    
    if (existingAttempt) {
        currentAnswers = existingAttempt.answers || {};
    }
    
    document.getElementById('quizModalTitle').textContent = quiz.title;
    document.getElementById('quizModalCourse').textContent = quiz.courseTitle || 'Knowledge Check';
    
    renderQuizQuestions(quiz);
    document.getElementById('quizModal').classList.remove('hidden');
    
    if (quiz.timeLimit) {
        startTimer(quiz.timeLimit * 60);
    }
}

// Render quiz questions
function renderQuizQuestions(quiz) {
    const container = document.getElementById('quizContent');
    
    container.innerHTML = `
        <div class="space-y-6">
            ${quiz.questions.map((question, idx) => `
                <div class="border border-gray-200 rounded-lg p-5">
                    <div class="flex items-start justify-between mb-3">
                        <h3 class="font-semibold text-gray-800">
                            ${idx + 1}. ${escapeHtml(question.text)}
                        </h3>
                        <span class="text-xs text-gray-500">${question.points || 1} point(s)</span>
                    </div>
                    <div class="space-y-3 mt-3">
                        ${question.options.map((option, optIdx) => `
                            <div class="quiz-option p-3 border border-gray-200 rounded-lg cursor-pointer transition"
                                 onclick="window.selectAnswer(${idx}, ${optIdx})"
                                 data-question="${idx}" data-option="${optIdx}">
                                <div class="flex items-center space-x-3">
                                    <div class="w-5 h-5 rounded-full border-2 ${currentAnswers[idx] === optIdx ? 'border-[#1e88e5] bg-[#1e88e5]' : 'border-gray-300'} flex items-center justify-center">
                                        ${currentAnswers[idx] === optIdx ? '<div class="w-2 h-2 bg-white rounded-full"></div>' : ''}
                                    </div>
                                    <span class="text-gray-700">${escapeHtml(option)}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
            
            <div class="flex justify-between items-center pt-4">
                <div id="timerDisplay" class="text-lg font-mono ${quiz.timeLimit ? '' : 'hidden'}">
                    <i class="fas fa-hourglass-half text-gray-500 mr-2"></i>
                    <span id="timer">${formatTime(quiz.timeLimit * 60)}</span>
                </div>
                <button id="submitQuizBtn" class="px-6 py-2 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42] transition">
                    Submit Quiz
                </button>
            </div>
        </div>
    `;
    
    // Highlight selected answers
    Object.keys(currentAnswers).forEach(qIdx => {
        const option = currentAnswers[qIdx];
        const element = document.querySelector(`[data-question="${qIdx}"][data-option="${option}"]`);
        if (element) {
            element.classList.add('selected');
        }
    });
    
    document.getElementById('submitQuizBtn').onclick = () => submitQuiz();
}

// Select answer
window.selectAnswer = (questionIdx, optionIdx) => {
    currentAnswers[questionIdx] = optionIdx;
    
    // Update UI
    document.querySelectorAll(`[data-question="${questionIdx}"]`).forEach(el => {
        el.classList.remove('selected');
        const radio = el.querySelector('.w-5.h-5');
        if (radio) {
            radio.classList.remove('border-[#1e88e5]', 'bg-[#1e88e5]');
            radio.classList.add('border-gray-300');
            radio.innerHTML = '';
        }
    });
    
    const selectedEl = document.querySelector(`[data-question="${questionIdx}"][data-option="${optionIdx}"]`);
    selectedEl.classList.add('selected');
    const radio = selectedEl.querySelector('.w-5.h-5');
    if (radio) {
        radio.classList.remove('border-gray-300');
        radio.classList.add('border-[#1e88e5]', 'bg-[#1e88e5]');
        radio.innerHTML = '<div class="w-2 h-2 bg-white rounded-full"></div>';
    }
};

// Start timer
function startTimer(seconds) {
    if (timerInterval) clearInterval(timerInterval);
    
    let timeLeft = seconds;
    const timerElement = document.getElementById('timer');
    const timerDisplay = document.getElementById('timerDisplay');
    
    if (timerDisplay) timerDisplay.classList.remove('hidden');
    
    timerInterval = setInterval(() => {
        timeLeft--;
        if (timerElement) {
            timerElement.textContent = formatTime(timeLeft);
        }
        
        if (timeLeft === 60) {
            timerDisplay.classList.add('timer-warning', 'text-red-500');
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            submitQuiz();
        }
    }, 1000);
}

// Format time
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Submit quiz
async function submitQuiz() {
    clearInterval(timerInterval);
    
    let correctAnswers = 0;
    let totalPoints = 0;
    
    currentQuiz.questions.forEach((question, idx) => {
        const points = question.points || 1;
        totalPoints += points;
        if (currentAnswers[idx] === question.correctAnswer) {
            correctAnswers += points;
        }
    });
    
    const score = Math.round((correctAnswers / totalPoints) * 100);
    const passed = score >= (currentQuiz.passingScore || 70);
    
    try {
        const attemptData = {
            studentId: currentUser.uid,
            quizId: currentQuiz.id,
            quizTitle: currentQuiz.title,
            answers: currentAnswers,
            score: score,
            totalPoints: totalPoints,
            correctPoints: correctAnswers,
            status: 'completed',
            passed: passed,
            completedAt: new Date().toISOString(),
            timeSpent: timerInterval ? formatTime(parseInt(document.getElementById('timer')?.textContent?.split(':')[0]) * 60 + parseInt(document.getElementById('timer')?.textContent?.split(':')[1])) : 'N/A'
        };
        
        const existingAttempt = quizAttempts.find(a => a.quizId === currentQuiz.id && a.status === 'in_progress');
        
        if (existingAttempt) {
            await updateDoc(doc(db, 'quizAttempts', existingAttempt.id), attemptData);
        } else {
            await addDoc(collection(db, 'quizAttempts'), attemptData);
        }
        
        // Show detailed results
        showDetailedResults(score, passed, currentQuiz, currentAnswers);
        
        document.getElementById('quizModal').classList.add('hidden');
        
        await loadQuizAttempts(currentUser.uid);
        await loadQuizzes(currentUser.uid);
        
        if (passed) {
            startConfetti();
        }
        
    } catch (error) {
        console.error('Error submitting quiz:', error);
        alert('Failed to submit quiz. Please try again.');
    }
}

// Show detailed results
function showDetailedResults(score, passed, quiz, answers) {
    const modal = document.getElementById('resultModal');
    const iconDiv = document.getElementById('resultIcon');
    const title = document.getElementById('resultTitle');
    const message = document.getElementById('resultMessage');
    const detailedDiv = document.getElementById('detailedResults');
    
    if (passed) {
        iconDiv.innerHTML = '<i class="fas fa-trophy text-green-500 text-6xl"></i>';
        title.textContent = 'Congratulations! 🎉';
        title.className = 'text-2xl font-bold mb-2 text-green-600';
        message.innerHTML = `You scored ${score}%! You passed the quiz.<br>Keep up the great work!`;
    } else {
        iconDiv.innerHTML = '<i class="fas fa-chart-line text-orange-500 text-6xl"></i>';
        title.textContent = 'Keep Learning! 📚';
        title.className = 'text-2xl font-bold mb-2 text-orange-600';
        message.innerHTML = `You scored ${score}%. Don't worry, review the material and try again.<br>You need ${quiz.passingScore || 70}% to pass.`;
    }
    
    // Detailed answers
    detailedDiv.innerHTML = `
        <h4 class="font-semibold text-gray-800 mb-3">Question Review</h4>
        ${quiz.questions.map((q, idx) => {
            const userAnswer = answers[idx];
            const isCorrect = userAnswer === q.correctAnswer;
            return `
                <div class="border border-gray-200 rounded-lg p-3 mb-3">
                    <p class="font-medium text-gray-800 mb-2">${idx + 1}. ${escapeHtml(q.text)}</p>
                    <p class="text-sm">Your answer: <span class="${isCorrect ? 'text-green-600' : 'text-red-600'} font-medium">${q.options[userAnswer] || 'Not answered'}</span></p>
                    ${!isCorrect ? `<p class="text-sm text-green-600">Correct answer: ${q.options[q.correctAnswer]}</p>` : ''}
                    <p class="text-xs text-gray-500 mt-1">${isCorrect ? '✓ Correct' : '✗ Incorrect'} (${q.points || 1} point${(q.points || 1) > 1 ? 's' : ''})</p>
                </div>
            `;
        }).join('')}
    `;
    
    // Set retake button
    const retakeBtn = document.getElementById('retakeQuizBtn');
    if (retakeBtn) {
        retakeBtn.onclick = () => {
            modal.classList.add('hidden');
            startQuiz(quiz.id);
        };
    }
    
    modal.classList.remove('hidden');
}

// View quiz results
window.viewQuizResults = (quizId) => {
    const attempt = quizAttempts.find(a => a.quizId === quizId);
    const quiz = availableQuizzes.find(q => q.id === quizId);
    
    if (!attempt || !quiz) return;
    
    showDetailedResults(attempt.score, attempt.passed, quiz, attempt.answers);
};

// Start confetti animation
function startConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const particles = [];
    const colors = ['#1e88e5', '#00c853', '#ffd700', '#ff6b6b', '#ff9f4a'];
    
    for (let i = 0; i < 150; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 8 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            speed: Math.random() * 5 + 3,
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 10
        });
    }
    
    let animationId;
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let active = false;
        for (let p of particles) {
            p.y += p.speed;
            p.rotation += p.rotationSpeed;
            
            if (p.y < canvas.height) {
                active = true;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation * Math.PI / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
                ctx.restore();
            }
        }
        
        if (active) {
            animationId = requestAnimationFrame(animate);
        } else {
            cancelAnimationFrame(animationId);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    
    animate();
    
    setTimeout(() => {
        cancelAnimationFrame(animationId);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 5000);
}

// Display fallback quizzes
function displayFallbackQuizzes() {
    const container = document.getElementById('availableQuizzesGrid');
    container.innerHTML = `
        <div class="col-span-3 text-center py-12">
            <i class="fas fa-question-circle text-5xl text-gray-300 mb-3"></i>
            <p class="text-gray-500">No quizzes available at the moment</p>
            <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42] transition">
                Refresh
            </button>
        </div>
    `;
}

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

// Tab switching
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = {
        'overview': document.getElementById('overviewTab'),
        'available': document.getElementById('availableTab'),
        'completed': document.getElementById('completedTab'),
        'statistics': document.getElementById('statisticsTab')
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
            
            if (tabId === 'statistics' && quizAttempts.length > 0) {
                setTimeout(() => updateCharts(), 100);
            }
        });
    });
}

// Sidebar setup
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
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    
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

// Modal close handlers
function setupModals() {
    const closeQuizModal = document.getElementById('closeQuizModal');
    const closeResultModal = document.getElementById('closeResultModal');
    const quizModal = document.getElementById('quizModal');
    const resultModal = document.getElementById('resultModal');
    
    if (closeQuizModal) {
        closeQuizModal.addEventListener('click', () => {
            quizModal.classList.add('hidden');
            if (timerInterval) clearInterval(timerInterval);
        });
    }
    
    if (closeResultModal) {
        closeResultModal.addEventListener('click', () => {
            resultModal.classList.add('hidden');
        });
    }
    
    quizModal?.addEventListener('click', (e) => {
        if (e.target === quizModal) {
            quizModal.classList.add('hidden');
            if (timerInterval) clearInterval(timerInterval);
        }
    });
    
    resultModal?.addEventListener('click', (e) => {
        if (e.target === resultModal) {
            resultModal.classList.add('hidden');
        }
    });
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

// Logout function
async function logout() {
    try {
        await signOut(auth);
        window.location.href = '../../login.html';
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

// Global functions
window.startQuiz = startQuiz;
window.selectAnswer = window.selectAnswer;
window.viewQuizResults = window.viewQuizResults;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupSidebar();
    setupDropdowns();
    setupModals();
    
    const logoutBtns = document.querySelectorAll('#logoutBtn, #logoutDropdown');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    });
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            displayAvailableQuizzes();
        });
    }
});