import { 
    auth, signOut, db, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
    collection, query, where, onAuthStateChanged
} from '../firebase-config.js';

let currentAdmin = null;
let allQuizzes = [];
let filteredQuizzes = [];
let courses = [];
let currentPage = 1;
const itemsPerPage = 9;
let currentStatus = 'all';
let searchTerm = '';
let currentQuestions = [];

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '../../login.html'; return; }
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && (userDoc.data().role === 'admin' || userDoc.data().role === 'super_admin')) {
        currentAdmin = user;
        await loadAdminData(user.uid);
        await loadCourses();
        await loadQuizzes();
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

// Load courses for dropdown
async function loadCourses() {
    const coursesRef = collection(db, 'courses');
    const snapshot = await getDocs(coursesRef);
    courses = [];
    snapshot.forEach(doc => courses.push({ id: doc.id, ...doc.data() }));
    
    const select = document.getElementById('quizCourse');
    select.innerHTML = '<option value="">Select course</option>' + 
        courses.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
}

// Load quizzes
async function loadQuizzes() {
    const quizzesRef = collection(db, 'quizzes');
    const snapshot = await getDocs(quizzesRef);
    allQuizzes = [];
    let totalQuestions = 0;
    let totalAttempts = 0;
    
    for (const doc of snapshot.docs) {
        const quiz = { id: doc.id, ...doc.data() };
        allQuizzes.push(quiz);
        totalQuestions += (quiz.questions?.length || 0);
        
        // Get attempt count
        const attemptsRef = collection(db, 'quizAttempts');
        const q = query(attemptsRef, where('quizId', '==', quiz.id));
        const attemptsSnap = await getDocs(q);
        quiz.attemptCount = attemptsSnap.size;
        totalAttempts += attemptsSnap.size;
    }
    
    allQuizzes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Update stats
    const published = allQuizzes.filter(q => q.status === 'published').length;
    document.getElementById('totalQuizzes').textContent = allQuizzes.length;
    document.getElementById('publishedQuizzes').textContent = published;
    document.getElementById('totalQuestions').textContent = totalQuestions;
    document.getElementById('avgAttempts').textContent = allQuizzes.length ? Math.round(totalAttempts / allQuizzes.length) : 0;
    
    applyFilters();
}

// Apply filters
function applyFilters() {
    filteredQuizzes = [...allQuizzes];
    if (currentStatus !== 'all') {
        filteredQuizzes = filteredQuizzes.filter(q => q.status === currentStatus);
    }
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredQuizzes = filteredQuizzes.filter(q => 
            q.title?.toLowerCase().includes(term) ||
            q.description?.toLowerCase().includes(term)
        );
    }
    updatePagination();
    displayQuizzes();
}

// Display quizzes
function displayQuizzes() {
    const container = document.getElementById('quizzesGrid');
    const start = (currentPage - 1) * itemsPerPage;
    const pageQuizzes = filteredQuizzes.slice(start, start + itemsPerPage);
    
    if (pageQuizzes.length === 0) {
        container.innerHTML = `<div class="col-span-3 text-center py-12"><i class="fas fa-question-circle text-4xl text-gray-300 mb-3"></i><p class="text-gray-500">No quizzes found</p></div>`;
        return;
    }
    
    container.innerHTML = pageQuizzes.map(quiz => {
        const course = courses.find(c => c.id === quiz.courseId);
        return `
            <div class="quiz-card bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition">
                <div class="h-24 bg-gradient-to-r from-[#1e88e5] to-[#00c853] p-4">
                    <div class="flex justify-between items-start">
                        <i class="fas fa-question-circle text-white text-3xl opacity-50"></i>
                        <span class="status-${quiz.status} text-xs px-2 py-1 rounded-full capitalize">${quiz.status}</span>
                    </div>
                </div>
                <div class="p-4">
                    <h3 class="font-semibold text-gray-800 mb-1">${quiz.title}</h3>
                    <p class="text-xs text-gray-500 mb-2">${course?.title || 'No course'}</p>
                    <p class="text-sm text-gray-600 line-clamp-2 mb-3">${quiz.description || 'No description'}</p>
                    <div class="flex items-center justify-between text-xs text-gray-500 mb-3">
                        <span><i class="fas fa-clock mr-1"></i>${quiz.timeLimit || 15} min</span>
                        <span><i class="fas fa-star mr-1"></i>${quiz.passingScore || 70}% to pass</span>
                        <span><i class="fas fa-list mr-1"></i>${quiz.questions?.length || 0} Qs</span>
                    </div>
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-xs text-gray-500"><i class="fas fa-users mr-1"></i>${quiz.attemptCount || 0} attempts</span>
                        <span class="text-xs text-gray-500">${new Date(quiz.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="window.editQuiz('${quiz.id}')" class="flex-1 py-2 text-sm border border-[#1e88e5] text-[#1e88e5] rounded-lg hover:bg-[#1e88e5] hover:text-white transition">
                            <i class="fas fa-edit mr-1"></i> Edit
                        </button>
                        <button onclick="window.deleteQuiz('${quiz.id}', '${quiz.title}')" class="flex-1 py-2 text-sm border border-red-500 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition">
                            <i class="fas fa-trash mr-1"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Update pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredQuizzes.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, filteredQuizzes.length);
    document.getElementById('paginationInfo').textContent = `Showing ${start}-${end} of ${filteredQuizzes.length} quizzes`;
    document.getElementById('currentPage').textContent = `Page ${currentPage}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages || totalPages === 0;
}

// Render questions in modal
function renderQuestions() {
    const container = document.getElementById('questionsContainer');
    if (currentQuestions.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                <i class="fas fa-plus-circle text-3xl text-gray-300 mb-2"></i>
                <p class="text-gray-500">No questions added yet</p>
                <p class="text-xs text-gray-400">Click "Add Question" to create quiz questions</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = currentQuestions.map((q, idx) => `
        <div class="question-card border border-gray-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
                <h4 class="font-medium text-gray-800">Question ${idx + 1}</h4>
                <button type="button" onclick="window.removeQuestion(${idx})" class="text-red-500 hover:text-red-700">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="mb-3">
                <input type="text" placeholder="Question text" value="${escapeHtml(q.text)}" 
                       onchange="window.updateQuestion(${idx}, 'text', this.value)"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none">
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                ${['A', 'B', 'C', 'D'].map((letter, optIdx) => `
                    <div class="flex items-center space-x-2">
                        <span class="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium">${letter}</span>
                        <input type="text" placeholder="Option ${letter}" value="${escapeHtml(q.options[optIdx] || '')}"
                               onchange="window.updateQuestion(${idx}, 'options', this.value, ${optIdx})"
                               class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none">
                    </div>
                `).join('')}
            </div>
            <div class="flex items-center space-x-4">
                <label class="text-sm text-gray-600">Correct Answer:</label>
                <div class="flex space-x-3">
                    ${['A', 'B', 'C', 'D'].map((letter, optIdx) => `
                        <label class="flex items-center space-x-1 cursor-pointer">
                            <input type="radio" name="correct_${idx}" value="${optIdx}" 
                                   ${q.correctAnswer === optIdx ? 'checked' : ''}
                                   onchange="window.updateQuestion(${idx}, 'correctAnswer', ${optIdx})"
                                   class="w-4 h-4 text-[#1e88e5]">
                            <span class="text-sm">${letter}</span>
                        </label>
                    `).join('')}
                </div>
                <div class="flex-1"></div>
                <div>
                    <input type="number" placeholder="Points" value="${q.points || 1}" 
                           onchange="window.updateQuestion(${idx}, 'points', parseInt(this.value))"
                           class="w-20 px-2 py-1 border border-gray-300 rounded-lg text-center">
                </div>
            </div>
        </div>
    `).join('');
}

// Escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Question management functions
window.addQuestion = () => {
    currentQuestions.push({
        text: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        points: 1
    });
    renderQuestions();
};

window.removeQuestion = (index) => {
    currentQuestions.splice(index, 1);
    renderQuestions();
};

window.updateQuestion = (index, field, value, subIndex) => {
    if (field === 'options') {
        currentQuestions[index].options[subIndex] = value;
    } else {
        currentQuestions[index][field] = value;
    }
};

// Setup quiz modal
function setupQuizModal() {
    const modal = document.getElementById('quizModal');
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelModalBtn');
    const addQuestionBtn = document.getElementById('addQuestionBtn');
    const form = document.getElementById('quizForm');
    
    document.getElementById('addQuizBtn').addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = 'Create New Quiz';
        form.reset();
        currentQuestions = [];
        renderQuestions();
        document.getElementById('quizId').value = '';
        modal.classList.remove('hidden');
    });
    
    addQuestionBtn.addEventListener('click', () => window.addQuestion());
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const quizData = {
            title: document.getElementById('quizTitle').value.trim(),
            courseId: document.getElementById('quizCourse').value,
            description: document.getElementById('quizDescription').value.trim(),
            timeLimit: parseInt(document.getElementById('quizTimeLimit').value) || 15,
            passingScore: parseInt(document.getElementById('quizPassingScore').value) || 70,
            status: document.getElementById('quizStatus').value,
            questions: currentQuestions.filter(q => q.text.trim() && q.options.some(opt => opt.trim())),
            updatedAt: new Date().toISOString(),
            updatedBy: currentAdmin.uid
        };
        
        if (!quizData.title || !quizData.courseId) {
            alert('Please fill in all required fields');
            return;
        }
        
        if (quizData.questions.length === 0) {
            alert('Please add at least one question');
            return;
        }
        
        const quizId = document.getElementById('quizId').value;
        try {
            if (quizId) {
                await updateDoc(doc(db, 'quizzes', quizId), quizData);
                showToast('Quiz updated successfully', 'success');
            } else {
                quizData.createdAt = new Date().toISOString();
                quizData.createdBy = currentAdmin.uid;
                await addDoc(collection(db, 'quizzes'), quizData);
                showToast('Quiz created successfully', 'success');
            }
            modal.classList.add('hidden');
            await loadQuizzes();
        } catch (error) {
            console.error('Error saving quiz:', error);
            showToast('Failed to save quiz', 'error');
        }
    });
}

// Edit quiz
window.editQuiz = async (quizId) => {
    const quiz = allQuizzes.find(q => q.id === quizId);
    if (!quiz) return;
    
    document.getElementById('modalTitle').textContent = 'Edit Quiz';
    document.getElementById('quizId').value = quiz.id;
    document.getElementById('quizTitle').value = quiz.title || '';
    document.getElementById('quizCourse').value = quiz.courseId || '';
    document.getElementById('quizDescription').value = quiz.description || '';
    document.getElementById('quizTimeLimit').value = quiz.timeLimit || 15;
    document.getElementById('quizPassingScore').value = quiz.passingScore || 70;
    document.getElementById('quizStatus').value = quiz.status || 'draft';
    currentQuestions = quiz.questions || [];
    renderQuestions();
    
    document.getElementById('quizModal').classList.remove('hidden');
};

// Delete quiz
window.deleteQuiz = async (quizId, quizTitle) => {
    const modal = document.getElementById('deleteModal');
    document.getElementById('deleteQuizTitle').textContent = `Quiz: ${quizTitle}`;
    modal.classList.remove('hidden');
    
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    
    const handleConfirm = async () => {
        try {
            await deleteDoc(doc(db, 'quizzes', quizId));
            showToast('Quiz deleted successfully', 'success');
            modal.classList.add('hidden');
            await loadQuizzes();
        } catch (error) {
            console.error('Error deleting quiz:', error);
            showToast('Failed to delete quiz', 'error');
        }
        cleanup();
    };
    
    const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', cleanup);
    };
    
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', cleanup);
};

document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => document.getElementById('deleteModal').classList.add('hidden'));

// Setup filters
function setupFilters() {
    document.querySelectorAll('.status-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.status-filter').forEach(b => {
                b.classList.remove('bg-[#1e88e5]', 'text-white');
                b.classList.add('bg-gray-100', 'text-gray-700');
            });
            btn.classList.add('bg-[#1e88e5]', 'text-white');
            currentStatus = btn.dataset.status;
            currentPage = 1;
            applyFilters();
        });
    });
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchTerm = e.target.value;
        currentPage = 1;
        applyFilters();
    });
}

function setupPagination() {
    document.getElementById('prevPage').addEventListener('click', () => { if (currentPage > 1) { currentPage--; displayQuizzes(); updatePagination(); } });
    document.getElementById('nextPage').addEventListener('click', () => { if (currentPage < Math.ceil(filteredQuizzes.length / itemsPerPage)) { currentPage++; displayQuizzes(); updatePagination(); } });
}

// Load notifications
async function loadNotifications(userId) {
    const snapshot = await getDocs(query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false)));
    document.getElementById('notificationCount').textContent = snapshot.size;
}

// Sidebar setup (same as previous pages)
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

async function logout() { await signOut(auth); window.location.href = '../../login.html'; }

document.addEventListener('DOMContentLoaded', () => {
    setupFilters(); setupPagination(); setupQuizModal(); setupSidebar(); setupDropdowns();
    document.querySelectorAll('#logoutBtn, #logoutDropdown').forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); logout(); }));
});

window.addQuestion = window.addQuestion;
window.removeQuestion = window.removeQuestion;
window.updateQuestion = window.updateQuestion;
window.editQuiz = window.editQuiz;
window.deleteQuiz = window.deleteQuiz;

const style = document.createElement('style');
style.textContent = `.animate-fade-in { animation: fadeIn 0.3s ease; } @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }`;
document.head.appendChild(style);