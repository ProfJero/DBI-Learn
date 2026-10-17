import { 
    auth, signOut, db, doc, getDoc, getDocs, collection, query, where, 
    onAuthStateChanged, updateDoc, addDoc, arrayUnion, deleteDoc, limit, orderBy, collectionGroup
} from '../firebase-config.js';

// ========== GLOBAL VARIABLES ==========
let currentUser = null;
let courseId = null;
let courseData = null;
let enrollmentData = null;
let modules = [];
let currentModuleIndex = 0;
let currentLessonIndex = 0;
let completedLessons = [];
let quizAttempts = [];
let courseResources = [];

// Cache for processed content
const processedContentCache = new Map();

// ========== HELPER FUNCTIONS ==========
function extractGoogleDriveFileId(url) {
    if (!url || typeof url !== 'string') return null;
    
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,
        /id=([a-zA-Z0-9_-]+)/,
        /uc\?.*id=([a-zA-Z0-9_-]+)/,
        /\/d\/([a-zA-Z0-9_-]+)/,
        /^([a-zA-Z0-9_-]{25,})$/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

function getGoogleDriveImageUrl(url) {
    if (!url) return null;
    const fileId = extractGoogleDriveFileId(url);
    if (fileId) {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
    }
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        return url;
    }
    return null;
}

function getGoogleDriveViewUrl(url) {
    if (!url) return '#';
    const fileId = extractGoogleDriveFileId(url);
    if (fileId) {
        return `https://drive.google.com/file/d/${fileId}/view`;
    }
    return url;
}

// OPTIMIZED: With caching
function processLessonContent(html) {
    if (!html) return '';
    
    // Check cache
    if (processedContentCache.has(html)) {
        return processedContentCache.get(html);
    }
    
    let processed = html;
    
    // Process image URLs from Google Drive
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    processed = processed.replace(imgRegex, (match, src) => {
        const newSrc = getGoogleDriveImageUrl(src) || src;
        return match.replace(src, newSrc);
    });
    
    // Add responsive image classes
    processed = processed.replace(/<img/gi, '<img class="max-w-full h-auto rounded-lg shadow-md my-4"');
    
    // Ensure lists have proper styling
    processed = processed.replace(/<ul/g, '<ul class="list-disc ml-6 mb-4"');
    processed = processed.replace(/<ol/g, '<ol class="list-decimal ml-6 mb-4"');
    processed = processed.replace(/<li/g, '<li class="mb-1"');
    
    // Add table styling
    processed = processed.replace(/<table/g, '<table class="min-w-full border-collapse border border-gray-300 my-4"');
    processed = processed.replace(/<th/g, '<th class="border border-gray-300 px-4 py-2 bg-gray-100 font-semibold"');
    processed = processed.replace(/<td/g, '<td class="border border-gray-300 px-4 py-2"');
    
    // Add blockquote styling
    processed = processed.replace(/<blockquote/g, '<blockquote class="border-l-4 border-[#1e88e5] pl-4 py-2 my-4 italic text-gray-600"');
    
    // Add code block styling
    processed = processed.replace(/<pre/g, '<pre class="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto my-4"');
    processed = processed.replace(/<code/g, '<code class="font-mono text-sm"');
    
    // Store in cache
    processedContentCache.set(html, processed);
    return processed;
}

// Simple loading indicator (not modal)
let loadingIndicator = null;

function showLoading(show) {
    if (show && !loadingIndicator) {
        loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'fixed top-4 right-4 z-50';
        loadingIndicator.innerHTML = `
            <div class="bg-[#1e88e5] text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
                <i class="fas fa-spinner fa-spin"></i>
                <span class="text-sm">Loading...</span>
            </div>
        `;
        document.body.appendChild(loadingIndicator);
        setTimeout(() => {
            if (loadingIndicator) loadingIndicator.style.opacity = '0';
        }, 5000);
    } else if (!show && loadingIndicator) {
        loadingIndicator.remove();
        loadingIndicator = null;
    }
}

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in ${
        type === 'success' ? 'bg-green-500 text-white' : 
        type === 'error' ? 'bg-red-500 text-white' : 
        type === 'warning' ? 'bg-yellow-500 text-white' : 
        'bg-gray-800 text-white'
    }`;
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

function getLessonIcon(type) {
    const icons = {
        video: 'fa-play-circle',
        text: 'fa-file-alt',
        code: 'fa-code',
        quiz: 'fa-question-circle'
    };
    return icons[type] || 'fa-book';
}

// ========== FIREBASE DATA LOADING (OPTIMIZED) ==========

// Get course ID from URL
const urlParams = new URLSearchParams(window.location.search);
courseId = urlParams.get('id');

// Check authentication and load data
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../login.html';
        return;
    }
    
    currentUser = user;
    
    try {
        // Load everything in parallel
        await Promise.all([
            loadUserData(user.uid),
            loadCourseData(),
            loadEnrollmentData(user.uid),
            loadQuizAttempts(user.uid),
            loadCourseResources(),
            loadNotifications(user.uid)
        ]);
        
        // Then load modules
        await loadModulesOptimized();
        
    } catch (error) {
        console.error('Error loading initial data:', error);
        showToast('Failed to load course content', 'error');
    }
});

async function loadUserData(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const userNameEl = document.getElementById('userName');
            const userRoleEl = document.getElementById('userRole');
            if (userNameEl) userNameEl.textContent = userData.fullName || 'Student';
            if (userRoleEl) userRoleEl.textContent = userData.role || 'Student';
            
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

async function loadCourseData() {
    try {
        const courseDoc = await getDoc(doc(db, 'courses', courseId));
        if (!courseDoc.exists()) {
            showToast('Course not found', 'error');
            setTimeout(() => window.location.href = 'courses.html', 2000);
            return;
        }
        
        courseData = { id: courseDoc.id, ...courseDoc.data() };
        const courseTitleEl = document.getElementById('courseTitle');
        if (courseTitleEl) courseTitleEl.textContent = courseData.title || 'Course';
    } catch (error) {
        console.error('Error loading course:', error);
        showToast('Failed to load course', 'error');
    }
}

async function loadCourseResources() {
    try {
        const resourcesRef = collection(db, 'courses', courseId, 'resources');
        const snapshot = await getDocs(resourcesRef);
        courseResources = [];
        snapshot.forEach(doc => {
            courseResources.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('Error loading course resources:', error);
        courseResources = [];
    }
}

// OPTIMIZED: Main module loading function
async function loadModulesOptimized() {
    try {
        showLoading(true);
        
        // Step 1: Load modules metadata only
        const modulesRef = collection(db, 'courses', courseId, 'modules');
        const modulesSnapshot = await getDocs(modulesRef);
        
        if (modulesSnapshot.empty) {
            showNoContentMessage();
            showLoading(false);
            return;
        }
        
        // Step 2: Load all lessons in parallel
        const modulePromises = modulesSnapshot.docs.map(async (moduleDoc) => {
            const lessonsRef = collection(db, 'courses', courseId, 'modules', moduleDoc.id, 'lessons');
            const lessonsSnapshot = await getDocs(lessonsRef);
            
            // Only load essential lesson data first
            const lessons = lessonsSnapshot.docs.map(doc => ({
                id: doc.id,
                title: doc.data().title || 'Untitled',
                type: doc.data().type || 'text',
                duration: doc.data().duration || 5,
                order: doc.data().order || 0,
                description: doc.data().description || '',
                // Don't load heavy content yet
                contentLoaded: false,
                content: null,
                imageLinks: [],
                bannerUrl: null,
                likesCount: 0,
                userLiked: false,
                comments: []
            }));
            
            lessons.sort((a, b) => (a.order || 0) - (b.order || 0));
            
            return {
                id: moduleDoc.id,
                title: moduleDoc.data().title || 'Module',
                order: moduleDoc.data().order || 0,
                quizRequired: moduleDoc.data().quizRequired || false,
                passMark: moduleDoc.data().passMark || 70,
                lessons: lessons
            };
        });
        
        modules = await Promise.all(modulePromises);
        modules.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        // Step 3: Load enrollment data and update progress
        if (enrollmentData && enrollmentData.completedLessons) {
            completedLessons = enrollmentData.completedLessons;
        }
        
        // Update UI counters
        updateLessonCounters();
        
        // Step 4: Render modules list
        renderModulesList();
        updateProgress();
        
        // Step 5: Load first lesson content (important - this shows the content)
        const firstIncomplete = findFirstIncompleteLesson();
        if (firstIncomplete) {
            // Load the first lesson content fully
            await loadLessonContent(firstIncomplete.moduleIndex, firstIncomplete.lessonIndex);
            // Display it
            displayLesson(firstIncomplete.moduleIndex, firstIncomplete.lessonIndex);
        } else if (modules.length > 0 && modules[0].lessons.length > 0) {
            // Load first lesson content
            await loadLessonContent(0, 0);
            // Display it
            displayLesson(0, 0);
        }
        
        showLoading(false);
        
    } catch (error) {
        console.error('Error loading modules:', error);
        showToast('Failed to load course content', 'error');
        showLoading(false);
    }
}

// Load full lesson content only when needed
async function loadLessonContent(moduleIdx, lessonIdx) {
    const module = modules[moduleIdx];
    const lesson = module.lessons[lessonIdx];
    
    if (!lesson) return;
    
    // Check if content is already loaded
    if (!lesson.contentLoaded) {
        try {
            const lessonDoc = await getDoc(doc(db, 'courses', courseId, 'modules', module.id, 'lessons', lesson.id));
            if (lessonDoc.exists()) {
                const fullData = lessonDoc.data();
                
                // Merge full data into lesson
                lesson.content = fullData.content || {};
                lesson.imageLinks = fullData.imageLinks || [];
                lesson.bannerUrl = fullData.bannerUrl || null;
                lesson.contentLoaded = true;
                
                // Load likes for this lesson
                await loadLessonLikes(module.id, lesson.id, lesson);
                
                // Load comments for this lesson (paginated)
                await loadLessonComments(module.id, lesson.id, lesson, 20);
            }
        } catch (error) {
            console.error('Error loading lesson content:', error);
            showToast('Failed to load lesson content', 'error');
        }
    }
}

async function loadLessonLikes(moduleId, lessonId, lesson) {
    try {
        const likesRef = collection(db, 'courses', courseId, 'modules', moduleId, 'lessons', lessonId, 'likes');
        const likesSnapshot = await getDocs(likesRef);
        lesson.likesCount = likesSnapshot.size;
        
        // Check if user liked
        const userLikeQuery = query(likesRef, where('userId', '==', currentUser.uid));
        const userLikeSnapshot = await getDocs(userLikeQuery);
        lesson.userLiked = !userLikeSnapshot.empty;
        
        updateLikeButton(lesson);
    } catch (e) {
        console.error('Error loading likes:', e);
        lesson.likesCount = 0;
        lesson.userLiked = false;
    }
}

// OPTIMIZED: Paginated comments
async function loadLessonComments(moduleId, lessonId, lesson, limitCount = 20) {
    try {
        const commentsRef = collection(db, 'courses', courseId, 'modules', moduleId, 'lessons', lessonId, 'comments');
        const q = query(commentsRef, orderBy('createdAt', 'desc'), limit(limitCount));
        const commentsSnapshot = await getDocs(q);
        
        lesson.comments = [];
        commentsSnapshot.forEach(commentDoc => {
            lesson.comments.push({ id: commentDoc.id, ...commentDoc.data() });
        });
        
        displayComments(lesson);
    } catch (e) {
        console.error('Error loading comments:', e);
        lesson.comments = [];
    }
}

function updateLessonCounters() {
    const totalLessons = modules.reduce((sum, module) => sum + module.lessons.length, 0);
    const totalLessonsEl = document.getElementById('totalLessons');
    const estimatedTimeEl = document.getElementById('estimatedTime');
    
    if (totalLessonsEl) totalLessonsEl.textContent = totalLessons;
    if (estimatedTimeEl) estimatedTimeEl.textContent = `${Math.ceil(totalLessons * 0.2)} hours`;
}

function showNoContentMessage() {
    const container = document.getElementById('modulesList');
    if (container) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-folder-open text-3xl text-gray-300 mb-2"></i>
                <p class="text-gray-500">No course content available yet.</p>
            </div>
        `;
    }
    
    // Also show message in main content area
    const lessonDescriptionEl = document.getElementById('lessonDescription');
    if (lessonDescriptionEl) {
        lessonDescriptionEl.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-book-open text-5xl text-gray-300 mb-4"></i>
                <h3 class="text-xl font-semibold text-gray-700 mb-2">No Content Available</h3>
                <p class="text-gray-500">This course doesn't have any content yet.</p>
            </div>
        `;
    }
}

function findFirstIncompleteLesson() {
    for (let mIdx = 0; mIdx < modules.length; mIdx++) {
        for (let lIdx = 0; lIdx < modules[mIdx].lessons.length; lIdx++) {
            const lesson = modules[mIdx].lessons[lIdx];
            const isCompleted = completedLessons.includes(lesson.id);
            const isQuizPassed = lesson.type === 'quiz' ? isQuizPassedById(lesson.id) : false;
            const isAccessible = isLessonAccessible(mIdx, lIdx);
            
            if (!isCompleted && !isQuizPassed && isAccessible) {
                return { moduleIndex: mIdx, lessonIndex: lIdx };
            }
        }
    }
    return null;
}

function isQuizPassedById(lessonId) {
    const attempt = quizAttempts.find(a => a.lessonId === lessonId);
    return attempt && attempt.passed === true;
}

function isQuizPassed(lessonId) {
    const attempt = quizAttempts.find(a => a.lessonId === lessonId);
    return attempt && attempt.passed === true;
}

async function loadEnrollmentData(userId) {
    try {
        const enrollmentsRef = collection(db, 'enrollments');
        const q = query(enrollmentsRef, where('studentId', '==', userId), where('courseId', '==', courseId));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            enrollmentData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
            completedLessons = enrollmentData.completedLessons || [];
        } else {
            await createEnrollment();
        }
    } catch (error) {
        console.error('Error loading enrollment:', error);
        enrollmentData = { id: 'local', completedLessons: [], progress: 0 };
    }
}

async function createEnrollment() {
    try {
        const enrollmentDataObj = {
            studentId: currentUser.uid,
            courseId: courseId,
            courseTitle: courseData?.title || 'Course',
            status: 'active',
            progress: 0,
            completedLessons: [],
            enrolledAt: new Date().toISOString(),
            lastAccessed: new Date().toISOString()
        };
        
        const enrollmentsRef = collection(db, 'enrollments');
        const docRef = await addDoc(enrollmentsRef, enrollmentDataObj);
        enrollmentData = { id: docRef.id, ...enrollmentDataObj };
        
    } catch (error) {
        console.error('Error creating enrollment:', error);
        enrollmentData = { id: 'local', completedLessons: [], progress: 0 };
    }
}

async function loadQuizAttempts(userId) {
    try {
        const attemptsRef = collection(db, 'courses', courseId, 'quizAttempts');
        const q = query(attemptsRef, where('userId', '==', userId));
        const snapshot = await getDocs(q);
        
        quizAttempts = [];
        snapshot.forEach(doc => {
            quizAttempts.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('Error loading quiz attempts:', error);
        quizAttempts = [];
    }
}

// OPTIMIZED: Debounced progress update
let progressUpdateTimeout = null;
async function updateProgress() {
    const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
    const completed = completedLessons.length;
    const percent = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
    
    const progressPercent = document.getElementById('progressPercent');
    const progressBar = document.getElementById('progressBar');
    const completedLessonsEl = document.getElementById('completedLessons');
    
    if (progressPercent) progressPercent.textContent = `${percent}%`;
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (completedLessonsEl) completedLessonsEl.textContent = completed;
    
    // Debounce Firestore update
    if (progressUpdateTimeout) clearTimeout(progressUpdateTimeout);
    progressUpdateTimeout = setTimeout(async () => {
        if (enrollmentData && enrollmentData.id !== 'local') {
            try {
                await updateDoc(doc(db, 'enrollments', enrollmentData.id), {
                    progress: percent,
                    completedLessons: completedLessons,
                    lastAccessed: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error updating progress:', error);
            }
        }
    }, 1000);
}

function isLessonAccessible(moduleIdx, lessonIdx) {
    const module = modules[moduleIdx];
    const lesson = module.lessons[lessonIdx];
    
    if (completedLessons.includes(lesson.id)) return true;
    if (lesson.type === 'quiz' && isQuizPassed(lesson.id)) return true;
    if (moduleIdx === 0 && lessonIdx === 0) return true;
    
    let prevModuleIdx = moduleIdx;
    let prevLessonIdx = lessonIdx - 1;
    
    if (prevLessonIdx < 0) {
        prevModuleIdx = moduleIdx - 1;
        if (prevModuleIdx < 0) return true;
        prevLessonIdx = modules[prevModuleIdx].lessons.length - 1;
    }
    
    const prevLesson = modules[prevModuleIdx].lessons[prevLessonIdx];
    
    if (prevLesson.type === 'quiz') {
        return isQuizPassed(prevLesson.id);
    }
    
    return completedLessons.includes(prevLesson.id);
}

// ========== UI RENDERING ==========

function renderModulesList() {
    const container = document.getElementById('modulesList');
    if (!container) return;
    
    if (!modules || modules.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-folder-open text-3xl text-gray-300 mb-2"></i>
                <p class="text-gray-500">No course content available yet.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = modules.map((module, mIdx) => {
        const moduleLessons = module.lessons;
        const allLessonsCompleted = moduleLessons.every(lesson => 
            lesson.type === 'quiz' ? isQuizPassed(lesson.id) : completedLessons.includes(lesson.id)
        );
        
        return `
            <div class="border border-gray-200 rounded-lg overflow-hidden mb-4">
                <div class="bg-gray-50 px-4 py-3 font-semibold text-gray-800 flex justify-between items-center">
                    <span>${escapeHtml(module.title)}</span>
                    ${module.quizRequired ? 
                        `<span class="text-xs px-2 py-1 ${allLessonsCompleted ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'} rounded-full">
                            <i class="fas ${allLessonsCompleted ? 'fa-check-circle' : 'fa-question-circle'} mr-1"></i>
                            ${allLessonsCompleted ? 'Module Passed' : `Quiz Required (${module.passMark || 70}% to pass)`}
                        </span>` : 
                        allLessonsCompleted ? 
                        '<span class="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full"><i class="fas fa-check-circle mr-1"></i> Completed</span>' : ''
                    }
                </div>
                <div class="divide-y divide-gray-100">
                    ${module.lessons.map((lesson, lIdx) => {
                        const isCompleted = completedLessons.includes(lesson.id);
                        const quizPassed = lesson.type === 'quiz' ? isQuizPassed(lesson.id) : false;
                        const isLocked = !isLessonAccessible(mIdx, lIdx) && !isCompleted && !quizPassed;
                        
                        let statusIcon = '';
                        let statusClass = '';
                        
                        if (isCompleted || (lesson.type === 'quiz' && quizPassed)) {
                            statusIcon = '<i class="fas fa-check-circle text-green-500"></i>';
                            statusClass = 'text-green-500';
                        } else if (isLocked) {
                            statusIcon = '<i class="fas fa-lock text-gray-400"></i>';
                            statusClass = 'text-gray-400';
                        } else {
                            statusIcon = '<i class="fas fa-play-circle text-[#1e88e5]"></i>';
                            statusClass = 'text-[#1e88e5]';
                        }
                        
                        const clickable = !isLocked;
                        
                        return `
                            <div class="lesson-item px-4 py-3 flex items-center justify-between ${clickable ? 'cursor-pointer hover:bg-gray-50' : 'opacity-60 cursor-not-allowed'}"
                                 onclick="${clickable ? `window.loadAndDisplayLesson(${mIdx}, ${lIdx})` : ''}">
                                <div class="flex items-center space-x-3">
                                    <i class="fas ${getLessonIcon(lesson.type)} ${statusClass} w-5"></i>
                                    <div>
                                        <p class="text-sm font-medium text-gray-800">${escapeHtml(lesson.title)}</p>
                                        <p class="text-xs text-gray-500">${lesson.duration || 'N/A'} min • ${lesson.type}</p>
                                    </div>
                                </div>
                                <div>${statusIcon}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// Main function to load and display lesson
window.loadAndDisplayLesson = async (moduleIdx, lessonIdx) => {
    const lesson = modules[moduleIdx]?.lessons[lessonIdx];
    if (!lesson) return;
    
    if (!isLessonAccessible(moduleIdx, lessonIdx)) {
        showToast('Complete the previous lesson first', 'warning');
        return;
    }
    
    if (lesson.type === 'quiz' && isQuizPassed(lesson.id)) {
        showToast('You have already passed this quiz!', 'success');
        return;
    }
    
    currentModuleIndex = moduleIdx;
    currentLessonIndex = lessonIdx;
    
    // Clear any existing intervals
    if (window.videoCheckInterval) clearInterval(window.videoCheckInterval);
    if (window.currentCompleteTimer) clearTimeout(window.currentCompleteTimer);
    
    // Load content if not loaded
    if (!lesson.contentLoaded) {
        showLoading(true);
        await loadLessonContent(moduleIdx, lessonIdx);
        showLoading(false);
    }
    
    // Display the lesson
    displayLesson(moduleIdx, lessonIdx);
    
    updateActiveLessonState();
    updateNavigationButtons();
    
    // Update last accessed
    if (enrollmentData && enrollmentData.id !== 'local') {
        try {
            await updateDoc(doc(db, 'enrollments', enrollmentData.id), {
                lastAccessed: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error updating last accessed:', error);
        }
    }
};

function displayLesson(moduleIdx, lessonIdx) {
    const lesson = modules[moduleIdx].lessons[lessonIdx];
    
    // Update title
    const lessonTitleEl = document.getElementById('lessonTitle');
    if (lessonTitleEl) lessonTitleEl.textContent = lesson.title;
    
    // Update like button
    updateLikeButton(lesson);
    
    // Display comments
    displayComments(lesson);
    
    // Display resources
    loadLessonResources(lesson.id);
    
    // Display image links
    displayImageLinks(lesson.imageLinks);
    
    // Display lesson content based on type
    const lessonDescriptionEl = document.getElementById('lessonDescription');
    if (lessonDescriptionEl) {
        let descriptionHtml = '';
        
        // Add facilitator notes
        if (lesson.description && lesson.description.trim()) {
            descriptionHtml += `<div class="facilitator-notes bg-blue-50 border-l-4 border-[#1e88e5] p-4 rounded-r-lg mb-6">
                <h4 class="font-semibold text-[#1e88e5] mb-2"><i class="fas fa-chalkboard-teacher mr-2"></i>Facilitator Notes</h4>
                <div class="prose max-w-none">${processLessonContent(lesson.description)}</div>
            </div>`;
        }
        
        // Add main content based on lesson type
        if (lesson.type === 'video') {
            if (lesson.content?.lessonContent) {
                descriptionHtml += `<div class="lesson-main-content prose max-w-none">${processLessonContent(lesson.content.lessonContent)}</div>`;
            }
        } else if (lesson.type === 'text') {
            if (lesson.content?.html) {
                descriptionHtml += `<div class="lesson-main-content prose max-w-none">${processLessonContent(lesson.content.html)}</div>`;
            }
        } else if (lesson.type === 'code') {
            if (lesson.content?.additionalContent) {
                descriptionHtml += `<div class="lesson-main-content prose max-w-none">${processLessonContent(lesson.content.additionalContent)}</div>`;
            }
        }
        
        // If no content, show a message
        if (!descriptionHtml) {
            descriptionHtml = '<p class="text-gray-500">No additional content available for this lesson.</p>';
        }
        
        lessonDescriptionEl.innerHTML = descriptionHtml;
    }
    
    // Display media based on type
    if (lesson.type === 'video') {
        displayVideoLesson(lesson);
    } else if (lesson.type === 'text') {
        displayTextLesson(lesson);
    } else if (lesson.type === 'code') {
        displayCodeLesson(lesson);
    } else if (lesson.type === 'quiz') {
        displayQuizLesson(lesson);
    }
}

function updateActiveLessonState() {
    document.querySelectorAll('.lesson-item').forEach(item => item.classList.remove('active'));
    const lessonItems = document.querySelectorAll('.lesson-item');
    let itemIndex = 0;
    
    for (let mIdx = 0; mIdx < modules.length; mIdx++) {
        for (let lIdx = 0; lIdx < modules[mIdx].lessons.length; lIdx++) {
            if (mIdx === currentModuleIndex && lIdx === currentLessonIndex) {
                if (lessonItems[itemIndex]) {
                    lessonItems[itemIndex].classList.add('active');
                }
            }
            itemIndex++;
        }
    }
}

function updateLikeButton(lesson) {
    const likeBtn = document.getElementById('likeBtn');
    const likeCountSpan = document.getElementById('likeCount');
    
    if (!likeBtn || !likeCountSpan) return;
    
    const count = lesson.likesCount || 0;
    const userLiked = lesson.userLiked || false;
    
    likeCountSpan.textContent = count;
    
    if (userLiked) {
        likeBtn.classList.add('liked');
        const icon = likeBtn.querySelector('i');
        if (icon) {
            icon.classList.remove('far');
            icon.classList.add('fas');
        }
    } else {
        likeBtn.classList.remove('liked');
        const icon = likeBtn.querySelector('i');
        if (icon) {
            icon.classList.remove('fas');
            icon.classList.add('far');
        }
    }
}

function displayImageLinks(imageLinks) {
    const section = document.getElementById('imageLinksSection');
    const container = document.getElementById('imageLinksList');
    
    if (!section || !container) return;
    
    if (!imageLinks || imageLinks.length === 0) {
        section.classList.add('hidden');
        return;
    }
    
    section.classList.remove('hidden');
    container.innerHTML = imageLinks.map(link => `
        <div class="image-reference flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-sm transition">
            <i class="fas fa-image text-2xl text-[#1e88e5]"></i>
            <div class="flex-1">
                <p class="text-sm font-medium text-gray-700">${escapeHtml(link.description)}</p>
                <a href="${getGoogleDriveViewUrl(link.url)}" target="_blank" class="text-xs text-[#1e88e5] hover:underline inline-flex items-center">
                    <i class="fas fa-external-link-alt mr-1"></i> Click to view
                </a>
            </div>
        </div>
    `).join('');
}

function displayComments(lesson) {
    const container = document.getElementById('commentsList');
    if (!container) return;
    
    const comments = lesson.comments || [];
    
    if (comments.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">No comments yet. Be the first to comment!</p>';
        return;
    }
    
    container.innerHTML = comments.map(comment => `
        <div class="comment-item flex space-x-3 p-3 border-b border-gray-100">
            <img src="https://ui-avatars.com/api/?background=1e88e5&color=fff&size=32&name=${encodeURIComponent(comment.userName)}" 
                 class="w-8 h-8 rounded-full">
            <div class="flex-1">
                <div class="flex items-center justify-between mb-1">
                    <p class="font-medium text-gray-800 text-sm">${escapeHtml(comment.userName)}</p>
                    <span class="text-xs text-gray-400">${comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : 'Just now'}</span>
                </div>
                <p class="text-gray-600 text-sm">${escapeHtml(comment.text)}</p>
            </div>
            ${comment.userId === currentUser?.uid ? `
                <button onclick="window.deleteComment('${comment.id}')" class="text-red-400 hover:text-red-600">
                    <i class="fas fa-trash-alt text-sm"></i>
                </button>
            ` : ''}
        </div>
    `).join('');
}

function loadLessonResources(lessonId) {
    const container = document.getElementById('lessonResources');
    if (!container) return;
    
    const lessonResources = courseResources.filter(r => r.lessonId === lessonId || !r.lessonId);
    
    if (lessonResources.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">No additional resources available for this lesson.</p>';
        return;
    }
    
    container.innerHTML = lessonResources.map(res => `
        <div class="resource-card flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
            <div class="flex items-center space-x-3 flex-1">
                <i class="fas ${getResourceIcon(res.type)} text-2xl ${getResourceIconColor(res.type)}"></i>
                <div class="flex-1">
                    <p class="text-sm font-medium text-gray-800">${escapeHtml(res.title)}</p>
                    ${res.description ? `<p class="text-xs text-gray-500">${escapeHtml(res.description)}</p>` : ''}
                    <p class="text-xs text-gray-400 mt-1">${res.type.toUpperCase()} • ${res.fileSize || 'N/A'}</p>
                </div>
            </div>
            <a href="${res.url}" target="_blank" class="text-[#1e88e5] hover:underline text-sm ml-3">
                <i class="fas fa-external-link-alt mr-1"></i> View
            </a>
        </div>
    `).join('');
}

function getResourceIcon(type) {
    const icons = {
        pdf: 'fa-file-pdf',
        doc: 'fa-file-word',
        video: 'fa-file-video',
        zip: 'fa-file-archive',
        link: 'fa-link',
        image: 'fa-file-image',
        presentation: 'fa-chalkboard-teacher',
        other: 'fa-file'
    };
    return icons[type] || 'fa-file';
}

function getResourceIconColor(type) {
    const colors = {
        pdf: 'text-red-500',
        doc: 'text-blue-500',
        video: 'text-purple-500',
        link: 'text-green-500',
        zip: 'text-yellow-500',
        image: 'text-pink-500',
        presentation: 'text-orange-500',
        other: 'text-gray-500'
    };
    return colors[type] || 'text-gray-500';
}

// ========== VIDEO LESSON ==========
function displayVideoLesson(lesson) {
    const videoUrl = lesson.content?.originalUrl || lesson.content?.embedUrl;
    const container = document.getElementById('lessonMediaContainer');
    
    if (!container) return;
    
    if (!videoUrl) {
        container.innerHTML = `
            <div class="bg-gray-900 aspect-video flex items-center justify-center">
                <div class="text-center">
                    <i class="fas fa-video-slash text-6xl text-gray-600 mb-3"></i>
                    <p class="text-gray-400">Video URL not available</p>
                </div>
            </div>
        `;
        return;
    }
    
    let embedUrl = videoUrl;
    const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
    const isGoogleDrive = videoUrl.includes('drive.google.com');
    
    if (isYouTube) {
        const videoId = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
        if (videoId) {
            embedUrl = `https://www.youtube.com/embed/${videoId}?controls=1&modestbranding=1&rel=0&enablejsapi=1`;
        }
    } else if (isGoogleDrive) {
        const fileId = videoUrl.match(/\/d\/([^\/]+)/)?.[1];
        if (fileId) {
            embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
        }
    }
    
    container.innerHTML = `
        <iframe 
            id="videoFrame"
            src="${embedUrl}"
            class="w-full aspect-video"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen>
        </iframe>
        <div class="bg-gray-800 text-white text-center py-2 text-sm">
            <i class="fas fa-info-circle mr-2"></i> Please watch the video completely to mark as complete.
        </div>
    `;
    
    trackVideoProgress(lesson);
}

function trackVideoProgress(lesson) {
    let watchTime = 0;
    const videoDuration = lesson.content?.duration || 10;
    
    if (window.videoCheckInterval) clearInterval(window.videoCheckInterval);
    
    window.videoCheckInterval = setInterval(() => {
        watchTime += 10;
        
        if (watchTime >= videoDuration * 60 * 0.9) {
            if (!completedLessons.includes(lesson.id)) {
                autoCompleteLesson(lesson);
            }
            clearInterval(window.videoCheckInterval);
        }
    }, 10000);
}

// ========== TEXT LESSON ==========
function displayTextLesson(lesson) {
    const container = document.getElementById('lessonMediaContainer');
    const bannerUrl = lesson.bannerUrl ? getGoogleDriveImageUrl(lesson.bannerUrl) : null;
    
    if (container) {
        if (bannerUrl) {
            container.innerHTML = `
                <div class="relative">
                    <img src="${bannerUrl}" alt="Lesson Banner" class="w-full object-cover max-h-80">
                    <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                        <p class="text-white text-sm">${escapeHtml(lesson.title)}</p>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="bg-gradient-to-br from-gray-50 to-gray-100 aspect-video flex items-center justify-center">
                    <div class="text-center">
                        <i class="fas fa-file-alt text-6xl text-gray-400 mb-3"></i>
                        <p class="text-gray-500">Text Lesson</p>
                        <p class="text-xs text-gray-400 mt-2">Reading time: ${lesson.duration || 5} minutes</p>
                    </div>
                </div>
            `;
        }
    }
    
    if (!completedLessons.includes(lesson.id)) {
        const readingTime = (lesson.duration || 5) * 60 * 1000;
        if (window.currentCompleteTimer) clearTimeout(window.currentCompleteTimer);
        window.currentCompleteTimer = setTimeout(() => {
            autoCompleteLesson(lesson);
        }, Math.min(readingTime, 300000));
    }
}

// ========== CODE LESSON ==========
let monacoEditor = null;
let monacoLoading = false;
let monacoLoaded = false;

function displayCodeLesson(lesson) {
    const container = document.getElementById('lessonMediaContainer');
    const content = lesson.content;
    const language = content?.language || 'javascript';
    const initialCode = content?.code || '// Write your code here\nconsole.log("Hello, World!");';
    
    if (container) {
        container.innerHTML = `
            <div class="code-editor-container">
                <div class="code-editor-header">
                    <div class="flex items-center space-x-3">
                        <i class="fas fa-code text-gray-400"></i>
                        <span class="code-editor-language">${language.toUpperCase()}</span>
                    </div>
                    <div class="flex space-x-2">
                        <button id="resetCodeBtn" class="px-3 py-1 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-500 transition">
                            <i class="fas fa-undo-alt mr-1"></i> Reset
                        </button>
                        <button id="runCodeBtn" class="run-code-btn px-3 py-1 text-white rounded-lg text-sm transition">
                            <i class="fas fa-play mr-1"></i> Run Code
                        </button>
                    </div>
                </div>
                <div class="code-tabs">
                    <div class="code-tab active" data-tab="editor">📝 Code Editor</div>
                    <div class="code-tab" data-tab="preview">👁️ Preview</div>
                    <div class="code-tab" data-tab="console">📟 Console</div>
                </div>
                <div id="codeEditorPanel" class="code-panel active">
                    <div id="codeEditor" style="height: 400px; width: 100%;"></div>
                </div>
                <div id="previewPanel" class="code-panel">
                    <div class="code-preview">
                        <iframe id="previewFrame" class="preview-frame"></iframe>
                    </div>
                </div>
                <div id="consolePanel" class="code-panel">
                    <div class="p-3 bg-gray-800 border-t border-gray-700">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-gray-400"><i class="fas fa-terminal mr-1"></i> Console Output</span>
                            <button id="clearOutputBtn" class="text-xs text-gray-400 hover:text-white transition">
                                <i class="fas fa-trash-alt mr-1"></i> Clear
                            </button>
                        </div>
                        <div id="codeOutput" class="code-output">
                            <span class="text-gray-400">Click "Run Code" to see the output...</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        initMonacoEditor(language, initialCode);
    }
    
    if (!completedLessons.includes(lesson.id)) {
        const practiceTime = (lesson.duration || 10) * 60 * 1000;
        if (window.currentCompleteTimer) clearTimeout(window.currentCompleteTimer);
        window.currentCompleteTimer = setTimeout(() => {
            autoCompleteLesson(lesson);
        }, Math.min(practiceTime, 600000));
    }
}

function initMonacoEditor(language, initialCode) {
    const container = document.getElementById('codeEditor');
    if (!container) return;
    
    if (monacoEditor && monacoEditor.setValue) {
        monacoEditor.setValue(initialCode);
        monacoEditor.initialValue = initialCode;
        return;
    }
    
    container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 450px; background: #1e1e1e; color: #fff;"><i class="fas fa-spinner fa-spin mr-2"></i> Loading editor...</div>';
    
    const languageMap = {
        'javascript': 'javascript',
        'html': 'html',
        'css': 'css',
        'python': 'python',
        'typescript': 'typescript',
        'xml': 'xml'
    };
    const monacoLanguage = languageMap[language] || 'html';
    
    if (typeof monaco !== 'undefined' && monaco.editor) {
        createMonacoEditorInstance(container, monacoLanguage, initialCode, language);
        return;
    }
    
    if (monacoLoading) {
        const checkInterval = setInterval(() => {
            if (monacoLoaded && typeof monaco !== 'undefined' && monaco.editor) {
                clearInterval(checkInterval);
                createMonacoEditorInstance(container, monacoLanguage, initialCode, language);
            }
        }, 100);
        return;
    }
    
    monacoLoading = true;
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js';
    script.onload = () => {
        if (typeof require !== 'undefined' && require.config) {
            require.config({ 
                paths: { 
                    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' 
                } 
            });
            require(['vs/editor/editor.main'], () => {
                monacoLoaded = true;
                monacoLoading = false;
                createMonacoEditorInstance(container, monacoLanguage, initialCode, language);
            });
        } else {
            const vsScript = document.createElement('script');
            vsScript.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/editor/editor.main.js';
            vsScript.onload = () => {
                monacoLoaded = true;
                monacoLoading = false;
                createMonacoEditorInstance(container, monacoLanguage, initialCode, language);
            };
            document.head.appendChild(vsScript);
        }
    };
    script.onerror = () => {
        console.error('Failed to load Monaco Editor');
        monacoLoading = false;
        container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 450px; background: #1e1e1e; color: #f00;"><i class="fas fa-exclamation-triangle mr-2"></i> Failed to load editor. Please refresh the page.</div>';
    };
    document.head.appendChild(script);
}

function createMonacoEditorInstance(container, monacoLanguage, initialCode, language) {
    container.innerHTML = '';
    
    monacoEditor = monaco.editor.create(container, {
        value: initialCode,
        language: monacoLanguage,
        theme: 'vs-dark',
        fontSize: 14,
        fontFamily: 'Consolas, "Courier New", monospace',
        lineNumbers: 'on',
        roundedSelection: true,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        minimap: { enabled: false },
        wordWrap: 'on',
        formatOnPaste: true,
        formatOnType: true,
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        autoIndent: 'full',
        suggestOnTriggerCharacters: true,
        quickSuggestions: { other: true, comments: false, strings: false },
        parameterHints: { enabled: true },
        acceptSuggestionOnEnter: 'on',
        snippetSuggestions: 'top',
        tabCompletion: 'on'
    });
    
    monacoEditor.initialValue = initialCode;
    
    setupMonacoButtons(language);
    setupMonacoTabs();
    
    try {
        monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            const runBtn = document.getElementById('runCodeBtn');
            if (runBtn) runBtn.click();
        });
    } catch(e) {}
    
    const previewFrame = document.getElementById('previewFrame');
    if (previewFrame) {
        const blankDoc = '<html><body style="background: white; display: flex; align-items: center; justify-content: center; font-family: sans-serif; color: #666; height: 100vh; margin: 0;"><p>Preview will appear here after running code</p></body></html>';
        const blob = new Blob([blankDoc], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        previewFrame.src = blobUrl;
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    }
}

function setupMonacoButtons(language) {
    const resetBtn = document.getElementById('resetCodeBtn');
    if (resetBtn) {
        const newResetBtn = resetBtn.cloneNode(true);
        resetBtn.parentNode.replaceChild(newResetBtn, resetBtn);
        
        newResetBtn.addEventListener('click', () => {
            if (monacoEditor && monacoEditor.setValue) {
                monacoEditor.setValue(monacoEditor.initialValue || '');
            }
            const outputDiv = document.getElementById('codeOutput');
            if (outputDiv) {
                outputDiv.innerHTML = '<span class="text-gray-400">Code reset. Click "Run Code" to see the output...</span>';
                outputDiv.classList.remove('error');
            }
            const previewFrame = document.getElementById('previewFrame');
            if (previewFrame) {
                const blankDoc = '<html><body style="background: white; display: flex; align-items: center; justify-content: center; font-family: sans-serif; color: #666; height: 100vh; margin: 0;"><p>Preview will appear here after running code</p></body></html>';
                const blob = new Blob([blankDoc], { type: 'text/html' });
                const blobUrl = URL.createObjectURL(blob);
                previewFrame.src = blobUrl;
                setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
            }
        });
    }
    
    const runBtn = document.getElementById('runCodeBtn');
    if (runBtn) {
        const newRunBtn = runBtn.cloneNode(true);
        runBtn.parentNode.replaceChild(newRunBtn, runBtn);
        
        newRunBtn.addEventListener('click', () => {
            const code = monacoEditor && monacoEditor.getValue ? monacoEditor.getValue() : '';
            const outputDiv = document.getElementById('codeOutput');
            const previewFrame = document.getElementById('previewFrame');
            runCodeWithPreview(code, language, outputDiv, previewFrame);
        });
    }
    
    const clearBtn = document.getElementById('clearOutputBtn');
    if (clearBtn) {
        const newClearBtn = clearBtn.cloneNode(true);
        clearBtn.parentNode.replaceChild(newClearBtn, clearBtn);
        const outputDiv = document.getElementById('codeOutput');
        
        newClearBtn.addEventListener('click', () => {
            if (outputDiv) {
                outputDiv.innerHTML = '<span class="text-gray-400">Output cleared. Click "Run Code" to see the output...</span>';
                outputDiv.classList.remove('error');
            }
        });
    }
}

function setupMonacoTabs() {
    const tabs = document.querySelectorAll('.code-tab');
    const panels = {
        editor: document.getElementById('codeEditorPanel'),
        preview: document.getElementById('previewPanel'),
        console: document.getElementById('consolePanel')
    };
    
    tabs.forEach(tab => {
        const newTab = tab.cloneNode(true);
        if (tab.parentNode) {
            tab.parentNode.replaceChild(newTab, tab);
        }
        
        newTab.addEventListener('click', () => {
            const tabId = newTab.dataset.tab;
            document.querySelectorAll('.code-tab').forEach(t => t.classList.remove('active'));
            newTab.classList.add('active');
            
            Object.keys(panels).forEach(key => {
                if (panels[key]) panels[key].classList.remove('active');
            });
            
            if (panels[tabId]) panels[tabId].classList.add('active');
            
            if (tabId === 'editor' && monacoEditor && monacoEditor.layout) {
                setTimeout(() => {
                    monacoEditor.layout();
                    monacoEditor.focus();
                }, 100);
            }
        });
    });
}

function runCodeWithPreview(code, language, outputDiv, previewFrame) {
    outputDiv.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Running code...';
    outputDiv.classList.remove('error');
    
    setTimeout(() => {
        try {
            if (language === 'javascript') {
                const trimmedCode = code.trim();
                if (trimmedCode.startsWith('<') || trimmedCode.includes('<html') || trimmedCode.includes('<body') || trimmedCode.includes('<div')) {
                    const fullHtml = `<!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <style>
                            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 20px; padding: 0; line-height: 1.6; }
                            * { box-sizing: border-box; }
                        </style>
                    </head>
                    <body>
                        ${code}
                    </body>
                    </html>`;
                    
                    if (previewFrame) {
                        if (previewFrame.src && previewFrame.src.startsWith('blob:')) {
                            URL.revokeObjectURL(previewFrame.src);
                        }
                        const blob = new Blob([fullHtml], { type: 'text/html' });
                        const blobUrl = URL.createObjectURL(blob);
                        previewFrame.src = blobUrl;
                        outputDiv.innerHTML = '<span class="text-green-400">✅ HTML/CSS code rendered in Preview tab.</span>';
                        previewFrame.onload = () => {
                            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                        };
                    }
                } else {
                    let logs = [];
                    const originalConsoleLog = console.log;
                    const originalConsoleError = console.error;
                    
                    console.log = (...args) => {
                        logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
                        originalConsoleLog(...args);
                    };
                    console.error = (...args) => {
                        logs.push('ERROR: ' + args.map(arg => String(arg)).join(' '));
                        originalConsoleError(...args);
                    };
                    
                    try {
                        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                        const evalFunction = new AsyncFunction(code);
                        const evalResult = evalFunction();
                        
                        if (evalResult && typeof evalResult.then === 'function') {
                            evalResult.then(result => {
                                if (result !== undefined && logs.length === 0) {
                                    logs.push(String(result));
                                }
                                displayConsoleOutput(logs, outputDiv);
                            }).catch(err => {
                                logs.push(`Promise Error: ${err.message}`);
                                displayConsoleOutput(logs, outputDiv);
                                outputDiv.classList.add('error');
                            });
                        } else {
                            if (evalResult !== undefined && logs.length === 0) {
                                logs.push(String(evalResult));
                            }
                            displayConsoleOutput(logs, outputDiv);
                        }
                    } catch (e) {
                        logs.push(`Error: ${e.message}`);
                        displayConsoleOutput(logs, outputDiv);
                        outputDiv.classList.add('error');
                    } finally {
                        console.log = originalConsoleLog;
                        console.error = originalConsoleError;
                    }
                }
            } else if (language === 'html') {
                const fullHtml = `<!DOCTYPE html>
                <html>
                <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                <body>${code}</body>
                </html>`;
                
                if (previewFrame) {
                    if (previewFrame.src && previewFrame.src.startsWith('blob:')) {
                        URL.revokeObjectURL(previewFrame.src);
                    }
                    const blob = new Blob([fullHtml], { type: 'text/html' });
                    const blobUrl = URL.createObjectURL(blob);
                    previewFrame.src = blobUrl;
                    outputDiv.innerHTML = '<span class="text-green-400">✅ HTML code rendered in Preview tab.</span>';
                    previewFrame.onload = () => {
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                    };
                }
            } else {
                outputDiv.innerHTML = `<pre class="whitespace-pre-wrap font-mono text-sm">📝 ${language.toUpperCase()} code:\n\n${code}</pre>`;
            }
        } catch (error) {
            outputDiv.innerHTML = `<pre class="whitespace-pre-wrap font-mono text-sm text-red-400">Error: ${escapeHtml(error.message)}</pre>`;
            outputDiv.classList.add('error');
        }
    }, 100);
}

function displayConsoleOutput(logs, outputDiv) {
    if (logs.length === 0) {
        outputDiv.innerHTML = '<span class="text-gray-400">Code executed successfully (no console output)</span>';
    } else {
        outputDiv.innerHTML = `<pre class="whitespace-pre-wrap font-mono text-sm">${escapeHtml(logs.join('\n'))}</pre>`;
    }
}

// ========== QUIZ LESSON ==========
async function displayQuizLesson(lesson) {
    if (isQuizPassed(lesson.id)) {
        showToast('You have already passed this quiz!', 'success');
        await autoCompleteLesson(lesson);
        return;
    }
    
    const modal = document.getElementById('quizModal');
    const title = document.getElementById('quizTitle');
    const content = document.getElementById('quizContent');
    
    if (!modal || !title || !content) return;
    
    title.textContent = lesson.content?.title || lesson.title;
    const questions = lesson.content?.questions || [];
    const quizImageLinks = lesson.content?.imageLinks || [];
    
    if (questions.length === 0) {
        content.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-exclamation-circle text-4xl text-orange-500 mb-3"></i>
                <p class="text-gray-600">No questions available for this quiz.</p>
                <button onclick="document.getElementById('quizModal').classList.add('hidden')" 
                        class="mt-4 px-4 py-2 bg-[#1e88e5] text-white rounded-lg">
                    Close
                </button>
            </div>
        `;
        modal.classList.remove('hidden');
        return;
    }
    
    let currentQuestion = 0;
    let answers = {};
    let shortAnswerValues = {};
    
    function renderQuestion() {
        const q = questions[currentQuestion];
        const module = modules[currentModuleIndex];
        const passMark = module.passMark || 70;
        
        let optionsHtml = '';
        
        if (q.type === 'multiple_choice') {
            optionsHtml = `
                <div class="space-y-3" id="quizOptions">
                    ${q.options && q.options.length > 0 ? q.options.map((opt, idx) => `
                        <div class="quiz-option p-3 border border-gray-200 rounded-lg cursor-pointer transition ${answers[currentQuestion] === idx ? 'selected bg-blue-50 border-blue-500' : ''}"
                             data-qidx="${currentQuestion}" data-oidx="${idx}">
                            <div class="flex items-center space-x-3">
                                <div class="w-5 h-5 rounded-full border-2 ${answers[currentQuestion] === idx ? 'border-[#1e88e5] bg-[#1e88e5]' : 'border-gray-300'} flex items-center justify-center">
                                    ${answers[currentQuestion] === idx ? '<div class="w-2 h-2 bg-white rounded-full"></div>' : ''}
                                </div>
                                <span class="text-gray-700">${escapeHtml(opt)}</span>
                            </div>
                        </div>
                    `).join('') : '<p class="text-red-500">No options available for this question</p>'}
                </div>
            `;
        } else if (q.type === 'true_false') {
            optionsHtml = `
                <div class="space-y-3" id="quizOptions">
                    <div class="quiz-option p-3 border border-gray-200 rounded-lg cursor-pointer transition ${answers[currentQuestion] === true ? 'selected bg-blue-50 border-blue-500' : ''}"
                         data-qidx="${currentQuestion}" data-value="true">
                        <div class="flex items-center space-x-3">
                            <div class="w-5 h-5 rounded-full border-2 ${answers[currentQuestion] === true ? 'border-[#1e88e5] bg-[#1e88e5]' : 'border-gray-300'} flex items-center justify-center">
                                ${answers[currentQuestion] === true ? '<div class="w-2 h-2 bg-white rounded-full"></div>' : ''}
                            </div>
                            <span class="text-gray-700">True</span>
                        </div>
                    </div>
                    <div class="quiz-option p-3 border border-gray-200 rounded-lg cursor-pointer transition ${answers[currentQuestion] === false ? 'selected bg-blue-50 border-blue-500' : ''}"
                         data-qidx="${currentQuestion}" data-value="false">
                        <div class="flex items-center space-x-3">
                            <div class="w-5 h-5 rounded-full border-2 ${answers[currentQuestion] === false ? 'border-[#1e88e5] bg-[#1e88e5]' : 'border-gray-300'} flex items-center justify-center">
                                ${answers[currentQuestion] === false ? '<div class="w-2 h-2 bg-white rounded-full"></div>' : ''}
                            </div>
                            <span class="text-gray-700">False</span>
                        </div>
                    </div>
                </div>
            `;
        } else if (q.type === 'short_answer') {
            optionsHtml = `
                <div class="mt-2">
                    <textarea id="shortAnswer_${currentQuestion}" 
                              placeholder="Type your answer here..." 
                              rows="3"
                              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none short-answer-input">${shortAnswerValues[currentQuestion] || ''}</textarea>
                    <p class="text-xs text-gray-500 mt-1">Write a concise answer based on what you've learned.</p>
                </div>
            `;
        }
        
        content.innerHTML = `
            <div class="mb-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-gray-800">Question ${currentQuestion + 1} of ${questions.length}</h3>
                    <span class="text-sm text-gray-500">Pass mark: ${passMark}%</span>
                </div>
                ${quizImageLinks && quizImageLinks.length > 0 ? `
                    <div class="mb-4 p-3 bg-gray-50 rounded-lg">
                        <p class="text-sm font-medium text-gray-700 mb-2">Reference Images:</p>
                        <div class="flex flex-wrap gap-2">
                            ${quizImageLinks.map(link => `
                                <a href="${getGoogleDriveViewUrl(link.url)}" target="_blank" 
                                   class="inline-flex items-center px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm text-[#1e88e5] hover:bg-gray-50">
                                    <i class="fas fa-image mr-1"></i> ${escapeHtml(link.description)}
                                </a>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                <p class="text-gray-800 font-medium mb-4">${escapeHtml(q.text)}</p>
                
                ${optionsHtml}
            </div>
            <div class="flex justify-between mt-6 pt-4 border-t border-gray-200">
                <button id="prevQuestion" class="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition ${currentQuestion === 0 ? 'opacity-50 cursor-not-allowed' : ''}" 
                        ${currentQuestion === 0 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left mr-2"></i> Previous
                </button>
                <button id="nextQuestion" class="px-4 py-2 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42] transition">
                    ${currentQuestion === questions.length - 1 ? 'Submit Quiz' : 'Next'} <i class="fas fa-chevron-right ml-2"></i>
                </button>
            </div>
        `;
        
        if (q.type !== 'short_answer') {
            const options = document.querySelectorAll('.quiz-option');
            options.forEach(option => {
                option.addEventListener('click', (e) => {
                    const qIdx = parseInt(option.dataset.qidx);
                    let value;
                    if (option.dataset.oidx !== undefined) {
                        value = parseInt(option.dataset.oidx);
                    } else {
                        value = option.dataset.value === 'true';
                    }
                    answers[qIdx] = value;
                    renderQuestion();
                });
            });
        } else {
            const textarea = document.getElementById(`shortAnswer_${currentQuestion}`);
            if (textarea) {
                textarea.addEventListener('input', (e) => {
                    shortAnswerValues[currentQuestion] = e.target.value;
                });
            }
        }
        
        const prevBtn = document.getElementById('prevQuestion');
        const nextBtn = document.getElementById('nextQuestion');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentQuestion > 0) {
                    currentQuestion--;
                    renderQuestion();
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (q.type !== 'short_answer' && answers[currentQuestion] === undefined) {
                    showToast('Please select an answer', 'error');
                    return;
                }
                
                if (currentQuestion === questions.length - 1) {
                    if (q.type === 'short_answer') {
                        const textarea = document.getElementById(`shortAnswer_${currentQuestion}`);
                        if (textarea) {
                            shortAnswerValues[currentQuestion] = textarea.value;
                        }
                    }
                    submitQuiz(questions, answers, shortAnswerValues, lesson);
                } else {
                    currentQuestion++;
                    renderQuestion();
                }
            });
        }
    }
    
    renderQuestion();
    modal.classList.remove('hidden');
}

async function submitQuiz(questions, answers, shortAnswers, lesson) {
    let correctCount = 0;
    
    questions.forEach((q, idx) => {
        if (q.type === 'multiple_choice' || q.type === 'true_false') {
            if (answers[idx] === q.correct) {
                correctCount++;
            }
        } else if (q.type === 'short_answer') {
            const userAnswer = (shortAnswers[idx] || '').trim().toLowerCase();
            const correctAnswer = (q.correctAnswer || '').trim().toLowerCase();
            
            if (q.caseSensitive) {
                if (userAnswer === correctAnswer) correctCount++;
            } else {
                if (userAnswer === correctAnswer) correctCount++;
            }
        }
    });
    
    const percentage = Math.round((correctCount / questions.length) * 100);
    const module = modules[currentModuleIndex];
    const passMark = module.passMark || 70;
    const passed = percentage >= passMark;
    
    try {
        const attemptData = {
            userId: currentUser.uid,
            courseId: courseId,
            moduleId: module.id,
            lessonId: lesson.id,
            quizTitle: lesson.content?.title || lesson.title,
            score: percentage,
            totalQuestions: questions.length,
            correctAnswers: correctCount,
            answers: answers,
            shortAnswers: shortAnswers,
            passed: passed,
            completedAt: new Date().toISOString()
        };
        
        const attemptsRef = collection(db, 'courses', courseId, 'quizAttempts');
        await addDoc(attemptsRef, attemptData);
        quizAttempts.push(attemptData);
        
        if (passed) {
            await autoCompleteLesson(lesson);
        }
        
    } catch (error) {
        console.error('Error saving quiz attempt:', error);
    }
    
    const modal = document.getElementById('quizModal');
    const content = document.getElementById('quizContent');
    
    if (!content) return;
    
    content.innerHTML = `
        <div class="text-center py-8">
            <div class="w-20 h-20 mx-auto mb-4 ${passed ? 'bg-green-100' : 'bg-orange-100'} rounded-full flex items-center justify-center">
                <i class="fas ${passed ? 'fa-trophy' : 'fa-chart-line'} text-4xl ${passed ? 'text-green-500' : 'text-orange-500'}"></i>
            </div>
            <h3 class="text-2xl font-bold text-gray-800 mb-2">${passed ? 'Congratulations!' : 'Keep Learning!'}</h3>
            <p class="text-gray-600 mb-4">You scored ${percentage}% (${correctCount}/${questions.length} correct)</p>
            <p class="text-sm text-gray-500 mb-2">Required pass mark: ${passMark}%</p>
            <p class="text-sm ${passed ? 'text-green-600' : 'text-orange-600'} mb-6">
                ${passed ? 'You have passed the quiz! You can now proceed to the next lesson.' : 'Review the material and try again to pass the module.'}
            </p>
            <div class="flex justify-center space-x-3">
                ${!passed ? `
                    <button id="retakeQuiz" class="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition">
                        <i class="fas fa-redo mr-2"></i> Retake Quiz
                    </button>
                ` : ''}
                <button id="closeQuizResult" class="px-6 py-2 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42] transition">
                    ${passed ? 'Continue' : 'Close'}
                </button>
            </div>
        </div>
    `;
    
    const closeBtn = document.getElementById('closeQuizResult');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modal) modal.classList.add('hidden');
        });
    }
    
    if (!passed) {
        const retakeBtn = document.getElementById('retakeQuiz');
        if (retakeBtn) {
            retakeBtn.addEventListener('click', () => {
                if (modal) modal.classList.add('hidden');
                displayQuizLesson(lesson);
            });
        }
    }
}

// ========== PROGRESS & COMPLETION ==========
async function autoCompleteLesson(lesson) {
    if (completedLessons.includes(lesson.id)) return;
    
    if (lesson.type === 'quiz' && !isQuizPassed(lesson.id)) {
        return;
    }
    
    completedLessons.push(lesson.id);
    await updateProgress();
    renderModulesList();
    
    showToast('Lesson completed!', 'success');
    
    const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
    if (completedLessons.length === totalLessons) {
        showToast('🎉 Congratulations! You have completed the course!', 'success');
        await generateCertificate();
    }
}

async function generateCertificate() {
    try {
        const certificateData = {
            studentId: currentUser.uid,
            studentName: document.getElementById('userName')?.textContent || 'Student',
            courseId: courseId,
            courseTitle: courseData.title,
            score: Math.round((completedLessons.length / modules.reduce((sum, m) => sum + m.lessons.length, 0)) * 100),
            description: `Successfully completed the ${courseData.title} course with dedication and excellence.`,
            certificateId: `DBI-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
            issuedAt: new Date().toISOString(),
            status: 'issued'
        };
        
        const certificatesRef = collection(db, 'certificates');
        await addDoc(certificatesRef, certificateData);
        
        if (enrollmentData && enrollmentData.id !== 'local') {
            await updateDoc(doc(db, 'enrollments', enrollmentData.id), {
                status: 'completed',
                completedAt: new Date().toISOString(),
                certificateIssued: true
            });
        }
        
        showToast('Certificate generated! View it in your certificates section.', 'success');
        
    } catch (error) {
        console.error('Error generating certificate:', error);
    }
}

// ========== USER INTERACTIONS ==========
window.postComment = async () => {
    const input = document.getElementById('commentInput');
    const lesson = modules[currentModuleIndex]?.lessons[currentLessonIndex];
    
    if (!input || !lesson) return;
    
    const text = input.value.trim();
    if (!text) {
        showToast('Please enter a comment', 'warning');
        return;
    }
    
    const commentData = {
        userId: currentUser.uid,
        userName: document.getElementById('userName')?.textContent || 'Student',
        text: text,
        createdAt: new Date().toISOString()
    };
    
    try {
        const commentsRef = collection(db, 'courses', courseId, 'modules', modules[currentModuleIndex].id, 'lessons', lesson.id, 'comments');
        const docRef = await addDoc(commentsRef, commentData);
        commentData.id = docRef.id;
        
        if (!lesson.comments) lesson.comments = [];
        lesson.comments.unshift(commentData);
        
        displayComments(lesson);
        input.value = '';
        showToast('Comment posted!', 'success');
        
    } catch (error) {
        console.error('Error posting comment:', error);
        showToast('Failed to post comment', 'error');
    }
};

window.deleteComment = async (commentId) => {
    const lesson = modules[currentModuleIndex]?.lessons[currentLessonIndex];
    if (!lesson) return;
    
    try {
        await deleteDoc(doc(db, 'courses', courseId, 'modules', modules[currentModuleIndex].id, 'lessons', lesson.id, 'comments', commentId));
        
        lesson.comments = lesson.comments.filter(c => c.id !== commentId);
        displayComments(lesson);
        showToast('Comment deleted', 'success');
        
    } catch (error) {
        console.error('Error deleting comment:', error);
        showToast('Failed to delete comment', 'error');
    }
};

window.likeLesson = async () => {
    const lesson = modules[currentModuleIndex]?.lessons[currentLessonIndex];
    if (!lesson) return;
    
    const moduleId = modules[currentModuleIndex].id;
    const lessonId = lesson.id;
    
    if (lesson.userLiked) {
        try {
            const likesRef = collection(db, 'courses', courseId, 'modules', moduleId, 'lessons', lessonId, 'likes');
            const q = query(likesRef, where('userId', '==', currentUser.uid));
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                await deleteDoc(snapshot.docs[0].ref);
            }
            
            lesson.likesCount--;
            lesson.userLiked = false;
            updateLikeButton(lesson);
            
        } catch (error) {
            console.error('Error unliking:', error);
            showToast('Failed to unlike', 'error');
        }
    } else {
        try {
            const likesRef = collection(db, 'courses', courseId, 'modules', moduleId, 'lessons', lessonId, 'likes');
            await addDoc(likesRef, {
                userId: currentUser.uid,
                userName: document.getElementById('userName')?.textContent || 'Student',
                createdAt: new Date().toISOString()
            });
            
            lesson.likesCount++;
            lesson.userLiked = true;
            updateLikeButton(lesson);
            
        } catch (error) {
            console.error('Error liking:', error);
            showToast('Failed to like', 'error');
        }
    }
};

// ========== NAVIGATION ==========
function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevLessonBtn');
    const nextBtn = document.getElementById('nextLessonBtn');
    
    const hasPrev = currentModuleIndex > 0 || currentLessonIndex > 0;
    const hasNext = currentModuleIndex < modules.length - 1 || 
                    currentLessonIndex < modules[currentModuleIndex].lessons.length - 1;
    
    if (prevBtn) prevBtn.disabled = !hasPrev;
    if (nextBtn) nextBtn.disabled = !hasNext;
}

// Event listeners
document.getElementById('prevLessonBtn')?.addEventListener('click', () => {
    if (window.currentCompleteTimer) clearTimeout(window.currentCompleteTimer);
    if (window.videoCheckInterval) clearInterval(window.videoCheckInterval);
    
    if (currentLessonIndex > 0) {
        loadAndDisplayLesson(currentModuleIndex, currentLessonIndex - 1);
    } else if (currentModuleIndex > 0) {
        const prevModule = modules[currentModuleIndex - 1];
        loadAndDisplayLesson(currentModuleIndex - 1, prevModule.lessons.length - 1);
    }
});

document.getElementById('nextLessonBtn')?.addEventListener('click', async () => {
    if (window.currentCompleteTimer) clearTimeout(window.currentCompleteTimer);
    if (window.videoCheckInterval) clearInterval(window.videoCheckInterval);
    
    const currentModule = modules[currentModuleIndex];
    const currentLesson = currentModule.lessons[currentLessonIndex];
    
    if (currentLesson.type === 'quiz') {
        if (!isQuizPassed(currentLesson.id)) {
            showToast('You must pass the quiz before proceeding', 'warning');
            return;
        }
    } else if (!completedLessons.includes(currentLesson.id)) {
        showToast('Complete this lesson first', 'warning');
        return;
    }
    
    const isLastLessonInModule = currentLessonIndex === currentModule.lessons.length - 1;
    if (isLastLessonInModule && currentModule.quizRequired) {
        const quizLesson = currentModule.lessons.find(l => l.type === 'quiz');
        if (quizLesson && !isQuizPassed(quizLesson.id)) {
            showToast('You must pass the module quiz before proceeding to the next module', 'warning');
            return;
        }
    }
    
    if (currentLessonIndex < currentModule.lessons.length - 1) {
        loadAndDisplayLesson(currentModuleIndex, currentLessonIndex + 1);
    } else if (currentModuleIndex < modules.length - 1) {
        loadAndDisplayLesson(currentModuleIndex + 1, 0);
    }
});

document.getElementById('markCompleteBtn')?.addEventListener('click', async () => {
    const currentModule = modules[currentModuleIndex];
    const currentLesson = currentModule?.lessons[currentLessonIndex];
    
    if (!currentLesson) return;
    
    if (currentLesson.type === 'quiz') {
        showToast('Complete the quiz to mark it as complete', 'warning');
        return;
    }
    
    await autoCompleteLesson(currentLesson);
});

document.getElementById('likeBtn')?.addEventListener('click', () => {
    window.likeLesson();
});

document.getElementById('postCommentBtn')?.addEventListener('click', () => {
    window.postComment();
});

document.getElementById('closeQuizModal')?.addEventListener('click', () => {
    document.getElementById('quizModal').classList.add('hidden');
});

// ========== NOTIFICATIONS ==========
async function loadNotifications(userId) {
    try {
        const notificationsRef = collection(db, 'notifications');
        const q = query(notificationsRef, where('userId', '==', userId), where('read', '==', false));
        const snapshot = await getDocs(q);
        const countEl = document.getElementById('notificationCount');
        if (countEl) countEl.textContent = snapshot.size;
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// ========== UI SETUP ==========
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    let isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    
    function toggleSidebar(collapse) {
        isCollapsed = collapse;
        if (collapse) {
            if (sidebar) {
                sidebar.classList.add('sidebar-collapsed');
                sidebar.classList.remove('sidebar-expanded');
            }
            if (mainContent) mainContent.style.marginLeft = '80px';
            localStorage.setItem('sidebarCollapsed', 'true');
            document.querySelectorAll('.nav-text, .user-info, .logo-text').forEach(el => {
                if (el) el.style.display = 'none';
            });
            document.querySelectorAll('.nav-item').forEach(item => {
                const text = item.querySelector('.nav-text')?.innerText;
                if (text) {
                    item.classList.add('tooltip');
                    item.setAttribute('data-tooltip', text);
                }
            });
        } else {
            if (sidebar) {
                sidebar.classList.add('sidebar-expanded');
                sidebar.classList.remove('sidebar-collapsed');
            }
            if (mainContent) mainContent.style.marginLeft = '280px';
            localStorage.setItem('sidebarCollapsed', 'false');
            document.querySelectorAll('.nav-text, .user-info, .logo-text').forEach(el => {
                if (el) el.style.display = '';
            });
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('tooltip');
                item.removeAttribute('data-tooltip');
            });
        }
    }
    
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileOverlay = document.getElementById('mobileOverlay');
    if (mobileMenuBtn && mobileOverlay) {
        mobileMenuBtn.addEventListener('click', () => {
            if (sidebar) sidebar.classList.add('mobile-open');
            mobileOverlay.classList.remove('hidden');
        });
        mobileOverlay.addEventListener('click', () => {
            if (sidebar) sidebar.classList.remove('mobile-open');
            mobileOverlay.classList.add('hidden');
        });
    }
    
    toggleSidebar(isCollapsed);
}

function setupDropdowns() {
    const btn = document.getElementById('userMenuBtn');
    const dropdown = document.getElementById('userDropdown');
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

async function logout() { 
    await signOut(auth); 
    window.location.href = '../../login.html'; 
}

// Share functionality
document.getElementById('shareBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('shareModal');
    if (modal) modal.classList.remove('hidden');
});

document.getElementById('closeShareModal')?.addEventListener('click', () => {
    const modal = document.getElementById('shareModal');
    if (modal) modal.classList.add('hidden');
});

document.querySelectorAll('.share-option')?.forEach(option => {
    option.addEventListener('click', async () => {
        const platform = option.dataset.platform;
        const lesson = modules[currentModuleIndex]?.lessons[currentLessonIndex];
        const url = encodeURIComponent(window.location.href);
        const title = encodeURIComponent(`${courseData?.title || 'Course'} - ${lesson?.title || 'Lesson'}`);
        
        let shareUrl = '';
        
        switch (platform) {
            case 'whatsapp':
                shareUrl = `https://wa.me/?text=${title}%20${url}`;
                break;
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?text=${title}&url=${url}`;
                break;
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
                break;
            case 'linkedin':
                shareUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${url}&title=${title}`;
                break;
            case 'copy':
                await navigator.clipboard.writeText(window.location.href);
                showToast('Link copied to clipboard!', 'success');
                document.getElementById('shareModal').classList.add('hidden');
                return;
        }
        
        if (shareUrl) {
            window.open(shareUrl, '_blank', 'noopener,noreferrer');
        }
        
        const modal = document.getElementById('shareModal');
        if (modal) modal.classList.add('hidden');
    });
});

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
    setupSidebar();
    setupDropdowns();
    document.querySelectorAll('#logoutBtn, #logoutDropdown').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    });
});

// Expose functions to window
window.loadAndDisplayLesson = loadAndDisplayLesson;
window.likeLesson = likeLesson;
window.postComment = postComment;
window.deleteComment = deleteComment;

// Add CSS styles
const lessonStyle = document.createElement('style');
lessonStyle.textContent = `
    .animate-fade-in { animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    
    .lesson-content {
        line-height: 1.6;
    }
    .lesson-content h1 {
        font-size: 1.875rem;
        font-weight: 700;
        margin-top: 2rem;
        margin-bottom: 1rem;
        color: #1f2937;
    }
    .lesson-content h2 {
        font-size: 1.5rem;
        font-weight: 600;
        margin-top: 1.75rem;
        margin-bottom: 0.875rem;
        color: #1f2937;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid #e5e7eb;
    }
    .lesson-content h3 {
        font-size: 1.25rem;
        font-weight: 600;
        margin-top: 1.5rem;
        margin-bottom: 0.75rem;
        color: #374151;
    }
    .lesson-content p {
        margin-bottom: 1rem;
        color: #4b5563;
    }
    .lesson-content ul, .lesson-content ol {
        margin-left: 1.75rem;
        margin-bottom: 1rem;
    }
    .lesson-content ul { list-style-type: disc; }
    .lesson-content ol { list-style-type: decimal; }
    .lesson-content li { margin-bottom: 0.25rem; }
    .lesson-content blockquote {
        border-left: 4px solid #1e88e5;
        padding-left: 1rem;
        margin: 1rem 0;
        font-style: italic;
        color: #6b7280;
    }
    .lesson-content pre {
        background: #1f2937;
        color: #e5e7eb;
        padding: 1rem;
        border-radius: 0.5rem;
        overflow-x: auto;
        margin: 1rem 0;
        font-family: 'Fira Code', monospace;
        font-size: 0.875rem;
    }
    .lesson-content code {
        background: #1f2937;
        padding: 0.2rem 0.4rem;
        border-radius: 0.25rem;
        font-size: 0.875rem;
        font-family: 'Fira Code', monospace;
        color: #e5e7eb;
    }
    .lesson-content a {
        color: #1e88e5;
        text-decoration: underline;
    }
    .lesson-content table {
        border-collapse: collapse;
        width: 100%;
        margin: 1rem 0;
    }
    .lesson-content th, .lesson-content td {
        border: 1px solid #d1d5db;
        padding: 0.5rem 0.75rem;
        text-align: left;
    }
    .lesson-content th {
        background: #f3f4f6;
        font-weight: 600;
    }
    .lesson-content img {
        max-width: 100%;
        height: auto;
        border-radius: 0.5rem;
        margin: 1rem 0;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .facilitator-notes {
        background: #eff6ff;
        border-left: 4px solid #1e88e5;
    }
    .quiz-option.selected {
        background: #eff6ff;
        border-color: #3b82f6;
    }
    .code-editor-container {
        border: 1px solid #e5e7eb;
        border-radius: 0.75rem;
        overflow: hidden;
        background: #1e1e1e;
    }
    .code-editor-header {
        background: #2d2d2d;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid #3e3e3e;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    .code-editor-language {
        background: #3e3e3e;
        color: #fff;
        padding: 0.25rem 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        font-family: monospace;
    }
    .run-code-btn {
        background: #10b981;
        transition: all 0.2s ease;
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        font-weight: 500;
    }
    .run-code-btn:hover {
        background: #059669;
        transform: translateY(-1px);
    }
    .code-tabs {
        display: flex;
        background: #2d2d2d;
        border-bottom: 1px solid #3e3e3e;
    }
    .code-tab {
        padding: 0.5rem 1rem;
        color: #9ca3af;
        cursor: pointer;
        font-size: 0.875rem;
        transition: all 0.2s ease;
        border-bottom: 2px solid transparent;
    }
    .code-tab:hover { color: #e5e7eb; }
    .code-tab.active {
        color: #10b981;
        border-bottom-color: #10b981;
    }
    .code-panel { display: none; }
    .code-panel.active { display: block; }
    .code-preview {
        background: white;
        min-height: 400px;
        border: 1px solid #e5e7eb;
    }
    .preview-frame {
        width: 100%;
        min-height: 400px;
        border: none;
        background: white;
    }
    .code-output {
        background: #0f172a;
        border-radius: 0.5rem;
        padding: 1rem;
        font-family: 'Fira Code', monospace;
        font-size: 13px;
        color: #e2e8f0;
        overflow-x: auto;
        max-height: 300px;
        overflow-y: auto;
        white-space: pre-wrap;
    }
    .code-output.error {
        background: #7f1a1a;
        color: #fecaca;
    }
`;
document.head.appendChild(lessonStyle);