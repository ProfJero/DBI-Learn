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
    orderBy,
    limit,
    addDoc,
    updateDoc,
    Timestamp,
    onAuthStateChanged
} from '../firebase-config.js';

let currentUser = null;
let enrolledCourses = [];
let allCourses = [];
let courseModulesCache = {};
let bannerUrlCache = new Map();

// Helper function to extract Google Drive File ID
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

// Convert Google Drive URL to working image URL
function getGoogleDriveImageUrl(url) {
    if (!url) return null;
    
    const fileId = extractGoogleDriveFileId(url);
    
    if (fileId) {
        // Try multiple endpoints - thumbnail is most reliable
        return {
            thumbnail: `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`,
            direct: `https://lh3.googleusercontent.com/d/${fileId}`,
            download: `https://drive.google.com/uc?export=download&id=${fileId}`,
            view: `https://drive.google.com/uc?export=view&id=${fileId}`,
            fileId: fileId
        };
    }
    
    // If it's already a direct image URL, return as is
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        return { direct: url };
    }
    
    return null;
}

// Test if an image URL works
async function testImageUrl(url) {
    if (!url) return false;
    
    return new Promise((resolve) => {
        const img = new Image();
        let timeout = setTimeout(() => {
            img.src = '';
            resolve(false);
        }, 5000);
        
        img.onload = () => {
            clearTimeout(timeout);
            resolve(true);
        };
        img.onerror = () => {
            clearTimeout(timeout);
            resolve(false);
        };
        img.src = url;
    });
}

// Get best working image URL with caching
async function getBestImageUrl(rawUrl) {
    if (!rawUrl) return null;
    
    // Check cache
    if (bannerUrlCache.has(rawUrl)) {
        return bannerUrlCache.get(rawUrl);
    }
    
    const urls = getGoogleDriveImageUrl(rawUrl);
    
    if (!urls) {
        bannerUrlCache.set(rawUrl, null);
        return null;
    }
    
    // Try endpoints in order of reliability
    const endpoints = [
        urls.thumbnail,
        urls.direct,
        urls.download,
        urls.view
    ].filter(url => url);
    
    for (const endpoint of endpoints) {
        const works = await testImageUrl(endpoint);
        if (works) {
            bannerUrlCache.set(rawUrl, endpoint);
            return endpoint;
        }
    }
    
    bannerUrlCache.set(rawUrl, null);
    return null;
}

// Get course banner (first module's banner or fallback)
async function getCourseBanner(courseId) {
    try {
        // Check cache first
        if (courseModulesCache[courseId] && courseModulesCache[courseId].banner) {
            return courseModulesCache[courseId].banner;
        }
        
        // Fetch modules for the course
        const modulesRef = collection(db, 'courses', courseId, 'modules');
        const modulesSnapshot = await getDocs(modulesRef);
        
        const modules = [];
        modulesSnapshot.forEach(doc => {
            const moduleData = { id: doc.id, ...doc.data() };
            modules.push(moduleData);
        });
        
        // Sort by order
        modules.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        // Find first module with a banner
        let bannerUrl = null;
        for (const module of modules) {
            if (module.bannerUrl) {
                bannerUrl = await getBestImageUrl(module.bannerUrl);
                if (bannerUrl) break;
            }
        }
        
        // Also check course thumbnail if no module banner found
        if (!bannerUrl) {
            const courseDoc = await getDoc(doc(db, 'courses', courseId));
            if (courseDoc.exists()) {
                const course = courseDoc.data();
                if (course.thumbnail || course.bannerThumbnail) {
                    bannerUrl = await getBestImageUrl(course.thumbnail || course.bannerThumbnail);
                }
            }
        }
        
        // Cache the result
        courseModulesCache[courseId] = {
            modules: modules,
            banner: bannerUrl
        };
        
        return bannerUrl;
        
    } catch (error) {
        console.error('Error loading course modules for banner:', error);
        return null;
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../login.html';
    } else {
        currentUser = user;
        await loadUserData(user.uid);
        await loadEnrolledCourses(user.uid);
        await loadAllCourses();
        await loadNotifications(user.uid);
    }
});

// Load user data
async function loadUserData(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            const userNameElement = document.getElementById('userName');
            const userRoleElement = document.getElementById('userRole');
            if (userNameElement) userNameElement.textContent = userData.fullName || 'Student';
            if (userRoleElement) userRoleElement.textContent = userData.role || 'Student';
            
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

// Convert hours to minutes for display
function formatDuration(hours) {
    if (!hours) return '0 mins';
    const minutes = Math.round(hours * 60);
    if (minutes < 60) {
        return `${minutes} mins`;
    }
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

// Load enrolled courses
async function loadEnrolledCourses(userId) {
    try {
        const enrollmentsRef = collection(db, 'enrollments');
        const q = query(enrollmentsRef, where('studentId', '==', userId));
        const snapshot = await getDocs(q);
        
        enrolledCourses = [];
        for (const enrollmentDoc of snapshot.docs) {
            const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() };
            
            const courseRef = doc(db, 'courses', enrollment.courseId);
            const courseDoc = await getDoc(courseRef);
            if (courseDoc.exists()) {
                enrollment.course = { id: courseDoc.id, ...courseDoc.data() };
                // Pre-fetch banner
                enrollment.bannerUrl = await getCourseBanner(enrollment.courseId);
                enrolledCourses.push(enrollment);
            }
        }
        
        const courseCountElement = document.getElementById('courseCount');
        if (courseCountElement) courseCountElement.textContent = enrolledCourses.length;
        
        displayMyCourses('all');
        
    } catch (error) {
        console.error('Error loading enrolled courses:', error);
        displayMyCourses('all', true);
    }
}

// Get button text based on course progress
function getCourseButtonText(enrollment) {
    if (enrollment.status === 'completed') {
        return 'View Certificate';
    }
    if (enrollment.progress === 0 || !enrollment.progress) {
        return 'Start Course →';
    }
    return 'Continue Learning →';
}

// Display my courses with banners
async function displayMyCourses(filter, showError = false) {
    const container = document.getElementById('myCoursesGrid');
    
    if (!container) return;
    
    if (showError) {
        container.innerHTML = `
            <div class="col-span-3 text-center py-12">
                <i class="fas fa-exclamation-circle text-5xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">Unable to load courses. Please try again.</p>
                <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42] transition">
                    Retry
                </button>
            </div>
        `;
        return;
    }
    
    let filteredCourses = [...enrolledCourses];
    
    if (filter !== 'all') {
        filteredCourses = filteredCourses.filter(course => course.status === filter);
    }
    
    const sortBy = document.getElementById('sortBy')?.value || 'recent';
    if (sortBy === 'progress') {
        filteredCourses.sort((a, b) => (b.progress || 0) - (a.progress || 0));
    } else if (sortBy === 'title') {
        filteredCourses.sort((a, b) => (a.course?.title || '').localeCompare(b.course?.title || ''));
    }
    
    if (filteredCourses.length === 0) {
        container.innerHTML = `
            <div class="col-span-3 text-center py-12">
                <i class="fas fa-book-open text-5xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No enrolled courses found</p>
                <a href="#" class="text-[#1e88e5] mt-2 inline-block" onclick="window.switchToCoursesTab()">Browse all courses →</a>
            </div>
        `;
        return;
    }
    
    // Build course cards
    const courseCards = [];
    for (const enrollment of filteredCourses) {
        const bannerUrl = enrollment.bannerUrl;
        const courseTitle = enrollment.course?.title || 'Untitled Course';
        const courseCategory = enrollment.course?.category || 'General';
        const courseDuration = enrollment.course?.duration || 0;
        const courseDescription = enrollment.course?.shortDescription || 'No description available';
        const progress = enrollment.progress || 0;
        const isCompleted = enrollment.status === 'completed';
        
        courseCards.push(`
            <div class="course-card bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition">
                <div class="relative h-40 overflow-hidden cursor-pointer" onclick="window.viewCourse('${enrollment.courseId}')">
                    ${bannerUrl ? `
                        <img src="${bannerUrl}" 
                             alt="${escapeHtml(courseTitle)}" 
                             class="w-full h-full object-cover"
                             onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100%25\' height=\'100%25\'%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'%233b82f6\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'white\' font-size=\'14\'%3E${escapeHtml(courseTitle.substring(0, 20))}%3C/text%3E%3C/svg%3E'">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                    ` : `
                        <div class="w-full h-full bg-gradient-to-r from-[#1e88e5] to-[#00c853] flex items-center justify-center">
                            <i class="fas ${getCourseIcon(courseCategory)} text-white text-5xl opacity-50"></i>
                        </div>
                    `}
                    ${isCompleted ? `
                        <div class="absolute top-3 right-3 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                            <i class="fas fa-check-circle mr-1"></i> Completed
                        </div>
                    ` : ''}
                </div>
                <div class="p-5">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs text-[#1e88e5] font-medium">${escapeHtml(courseCategory)}</span>
                        <span class="time-badge">
                            <i class="far fa-clock mr-1"></i>${formatDuration(courseDuration)}
                        </span>
                    </div>
                    <h3 class="font-semibold text-gray-800 mb-2 line-clamp-1">${escapeHtml(courseTitle)}</h3>
                    <p class="text-sm text-gray-600 line-clamp-2 mb-3">${escapeHtml(courseDescription)}</p>
                    
                    <div class="mb-3">
                        <div class="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Progress</span>
                            <span>${progress}%</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-[#1e88e5] rounded-full h-2 transition-all" style="width: ${progress}%"></div>
                        </div>
                    </div>
                    
                    <button onclick="window.openCourseModal('${enrollment.courseId}', '${escapeHtml(courseTitle)}', '${enrollment.status}', ${progress})" 
                            class="w-full mt-2 py-2 ${isCompleted ? 'bg-green-600 hover:bg-green-700' : 'bg-[#1e88e5] hover:bg-[#0d6db7]'} text-white rounded-lg transition course-action-btn">
                        ${getCourseButtonText(enrollment)}
                    </button>
                </div>
            </div>
        `);
    }
    
    container.innerHTML = courseCards.join('');
}

// Load all available courses
async function loadAllCourses() {
    try {
        const coursesRef = collection(db, 'courses');
        const q = query(coursesRef, where('status', '==', 'published'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        allCourses = [];
        for (const docSnap of snapshot.docs) {
            const course = { id: docSnap.id, ...docSnap.data() };
            // Pre-fetch banner for each course
            course.bannerUrl = await getCourseBanner(course.id);
            allCourses.push(course);
        }
        
        populateCategoryFilters();
        displayAllCourses();
        
    } catch (error) {
        console.error('Error loading all courses:', error);
        displayAllCourses(true);
    }
}

// Populate category filters
function populateCategoryFilters() {
    const categories = new Set();
    allCourses.forEach(course => {
        if (course.category) categories.add(course.category);
    });
    
    const container = document.getElementById('categoryFilters');
    if (!container) return;
    
    const categoriesList = Array.from(categories).sort();
    
    container.innerHTML = `
        <button class="category-filter active px-4 py-2 rounded-lg text-sm font-medium transition" data-category="all">
            All
        </button>
        ${categoriesList.map(category => `
            <button class="category-filter px-4 py-2 rounded-lg text-sm font-medium transition bg-gray-100 text-gray-700 hover:bg-gray-200" data-category="${escapeHtml(category)}">
                ${escapeHtml(category)}
            </button>
        `).join('')}
    `;
    
    document.querySelectorAll('.category-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-filter').forEach(b => b.classList.remove('active', 'bg-[#1e88e5]', 'text-white'));
            btn.classList.add('active', 'bg-[#1e88e5]', 'text-white');
            displayAllCourses();
        });
    });
}

// Display all courses with banners
function displayAllCourses(showError = false) {
    const container = document.getElementById('allCoursesGrid');
    if (!container) return;
    
    const searchTerm = document.getElementById('allCoursesSearch')?.value.toLowerCase() || '';
    const activeCategory = document.querySelector('.category-filter.active')?.dataset.category || 'all';
    const sortBy = document.getElementById('allCoursesSort')?.value || 'popular';
    
    if (showError) {
        container.innerHTML = `
            <div class="col-span-3 text-center py-12">
                <i class="fas fa-exclamation-circle text-5xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">Unable to load courses. Please try again.</p>
                <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42] transition">
                    Retry
                </button>
            </div>
        `;
        return;
    }
    
    let filteredCourses = [...allCourses];
    
    if (activeCategory !== 'all') {
        filteredCourses = filteredCourses.filter(course => course.category === activeCategory);
    }
    
    if (searchTerm) {
        filteredCourses = filteredCourses.filter(course => 
            course.title?.toLowerCase().includes(searchTerm) ||
            course.description?.toLowerCase().includes(searchTerm) ||
            course.category?.toLowerCase().includes(searchTerm)
        );
    }
    
    if (sortBy === 'popular') {
        filteredCourses.sort((a, b) => (b.enrolledStudents || 0) - (a.enrolledStudents || 0));
    } else if (sortBy === 'title') {
        filteredCourses.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }
    
    if (filteredCourses.length === 0) {
        container.innerHTML = `
            <div class="col-span-3 text-center py-12">
                <i class="fas fa-search text-5xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No courses found</p>
                <p class="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
            </div>
        `;
        return;
    }
    
    const enrolledCourseIds = new Set(enrolledCourses.map(e => e.courseId));
    
    container.innerHTML = filteredCourses.map(course => `
        <div class="course-card bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition">
            <div class="relative h-40 overflow-hidden cursor-pointer" onclick="window.viewCourse('${course.id}')">
                ${course.bannerUrl ? `
                    <img src="${course.bannerUrl}" 
                         alt="${escapeHtml(course.title || 'Course Banner')}" 
                         class="w-full h-full object-cover"
                         onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100%25\' height=\'100%25\'%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'%233b82f6\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'white\' font-size=\'14\'%3E${escapeHtml((course.title || 'Course').substring(0, 20))}%3C/text%3E%3C/svg%3E'">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                ` : `
                    <div class="w-full h-full bg-gradient-to-r from-[#1e88e5] to-[#00c853] flex items-center justify-center">
                        <i class="fas ${getCourseIcon(course.category)} text-white text-5xl opacity-50"></i>
                    </div>
                `}
                ${course.featured ? `
                    <div class="absolute top-3 left-3 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                        <i class="fas fa-star mr-1"></i> Featured
                    </div>
                ` : ''}
            </div>
            <div class="p-5">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs text-[#1e88e5] font-medium">${escapeHtml(course.category || 'General')}</span>
                    <span class="time-badge">
                        <i class="far fa-clock mr-1"></i>${formatDuration(course.duration)}
                    </span>
                </div>
                <h3 class="font-semibold text-gray-800 mb-2 line-clamp-1">${escapeHtml(course.title || 'Untitled Course')}</h3>
                <p class="text-sm text-gray-600 line-clamp-2 mb-3">${escapeHtml(course.shortDescription || 'No description available')}</p>
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-1">
                        <i class="fas fa-star text-yellow-400 text-sm"></i>
                        <span class="text-sm font-medium">${course.rating || '4.5'}</span>
                        <span class="text-xs text-gray-500">(${course.reviewCount || '0'} reviews)</span>
                    </div>
                    <div class="flex items-center space-x-1">
                        <i class="fas fa-users text-gray-400 text-sm"></i>
                        <span class="text-xs text-gray-500">${course.enrolledStudents || '0'} enrolled</span>
                    </div>
                </div>
                <button onclick="window.enrollInCourse('${course.id}')" 
                        class="w-full py-2 ${enrolledCourseIds.has(course.id) ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-[#1e88e5] text-white hover:bg-[#009e42]'} rounded-lg transition"
                        ${enrolledCourseIds.has(course.id) ? 'disabled' : ''}>
                    ${enrolledCourseIds.has(course.id) ? 'Already Enrolled' : 'Enroll Now →'}
                </button>
            </div>
        </div>
    `).join('');
}

// Get icon based on course category
function getCourseIcon(category) {
    const icons = {
        'Web Development': 'fa-code',
        'Data Science': 'fa-chart-line',
        'Data Analysis': 'fa-chart-bar',
        'Graphics': 'fa-paint-brush',
        'Graphics & Multimedia': 'fa-paint-brush',
        'Software Development': 'fa-code',
        'Coding': 'fa-code',
        'General IT': 'fa-laptop-code',
        'Design': 'fa-paint-brush',
        'Mobile Development': 'fa-mobile-alt',
        'Business': 'fa-briefcase',
        'Marketing': 'fa-chart-line',
        'AI & Robotics': 'fa-robot',
        'Artificial Intelligence': 'fa-microchip'
    };
    return icons[category] || 'fa-book';
}

// Load notifications
async function loadNotifications(userId) {
    try {
        const notificationsRef = collection(db, 'notifications');
        const q = query(notificationsRef, where('userId', '==', userId), where('read', '==', false));
        const snapshot = await getDocs(q);
        const notificationCount = document.getElementById('notificationCount');
        if (notificationCount) notificationCount.textContent = snapshot.size;
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// Tab switching
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = {
        'all-courses': document.getElementById('allCoursesTab'),
        'my-courses': document.getElementById('myCoursesTab')
    };
    const pageTitle = document.getElementById('pageTitle');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            
            tabs.forEach(t => {
                t.classList.remove('active', 'text-[#1e88e5]', 'border-b-2', 'border-[#1e88e5]');
                t.classList.add('text-gray-500');
            });
            tab.classList.add('active', 'text-[#1e88e5]', 'border-b-2', 'border-[#1e88e5]');
            tab.classList.remove('text-gray-500');
            
            if (pageTitle) pageTitle.textContent = tabId === 'all-courses' ? 'Courses' : 'My Courses';
            
            if (tabContents['all-courses']) tabContents['all-courses'].classList.add('hidden');
            if (tabContents['my-courses']) tabContents['my-courses'].classList.add('hidden');
            if (tabContents[tabId]) tabContents[tabId].classList.remove('hidden');
            
            if (tabId === 'all-courses' && allCourses.length === 0) {
                loadAllCourses();
            }
        });
    });
}

// Setup sidebar navigation
function setupSidebarNavigation() {
    const myCoursesNav = document.getElementById('myCoursesNav');
    if (myCoursesNav) {
        myCoursesNav.addEventListener('click', (e) => {
            e.preventDefault();
            const myCoursesTab = document.querySelector('[data-tab="my-courses"]');
            if (myCoursesTab) {
                myCoursesTab.click();
            }
        });
    }
}

// Setup filters
function setupFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter;
            displayMyCourses(filter);
        });
    });
    
    const sortBy = document.getElementById('sortBy');
    if (sortBy) {
        sortBy.addEventListener('change', () => {
            const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
            displayMyCourses(activeFilter);
        });
    }
    
    const allCoursesSearch = document.getElementById('allCoursesSearch');
    if (allCoursesSearch) {
        allCoursesSearch.addEventListener('input', () => {
            displayAllCourses();
        });
    }
    
    const allCoursesSort = document.getElementById('allCoursesSort');
    if (allCoursesSort) {
        allCoursesSort.addEventListener('change', () => {
            displayAllCourses();
        });
    }
}

// Setup course action modal
let currentModalCourseId = null;

function setupCourseModal() {
    const modal = document.getElementById('courseActionModal');
    const closeBtn = document.getElementById('closeModalBtn');
    const reviseBtn = document.getElementById('modalReviseBtn');
    const certificateBtn = document.getElementById('modalCertificateBtn');
    
    if (!modal) return;
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }
    
    if (reviseBtn) {
        reviseBtn.addEventListener('click', () => {
            if (currentModalCourseId) {
                modal.classList.remove('active');
                window.viewCourse(currentModalCourseId);
            }
        });
    }
    
    if (certificateBtn) {
        certificateBtn.addEventListener('click', () => {
            if (currentModalCourseId) {
                modal.classList.remove('active');
                window.viewCertificate(currentModalCourseId);
            }
        });
    }
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
}

// Open course action modal
window.openCourseModal = (courseId, courseTitle, status, progress) => {
    const modal = document.getElementById('courseActionModal');
    const modalCourseTitle = document.getElementById('modalCourseTitle');
    const modalCourseStatus = document.getElementById('modalCourseStatus');
    
    if (!modal) return;
    
    currentModalCourseId = courseId;
    if (modalCourseTitle) modalCourseTitle.textContent = courseTitle;
    
    if (modalCourseStatus) {
        if (status === 'completed') {
            modalCourseStatus.textContent = 'Congratulations! You have completed this course.';
            modalCourseStatus.className = 'text-green-600 mt-1';
        } else {
            modalCourseStatus.textContent = `Progress: ${progress || 0}% complete`;
            modalCourseStatus.className = 'text-gray-500 mt-1';
        }
    }
    
    modal.classList.add('active');
};

// View certificate
window.viewCertificate = async (courseId) => {
    const enrollment = enrolledCourses.find(e => e.courseId === courseId);
    
    if (!enrollment || enrollment.status !== 'completed') {
        alert('Certificate is only available after completing the course!');
        return;
    }
    
    window.location.href = `certificates.html?courseId=${courseId}`;
};

// Sidebar setup
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    let isCollapsed = false;
    
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState === 'true') {
        toggleSidebar(true);
    }
    
    function toggleSidebar(collapse) {
        if (!sidebar || !mainContent) return;
        
        isCollapsed = collapse;
        
        if (isCollapsed) {
            sidebar.classList.remove('sidebar-expanded');
            sidebar.classList.add('sidebar-collapsed');
            mainContent.style.marginLeft = '80px';
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
            sidebar.classList.remove('sidebar-collapsed');
            sidebar.classList.add('sidebar-expanded');
            mainContent.style.marginLeft = '280px';
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
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            if (sidebar) sidebar.classList.add('mobile-open');
            if (mobileOverlay) mobileOverlay.classList.remove('hidden');
        });
    }
    
    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', () => {
            if (sidebar) sidebar.classList.remove('mobile-open');
            mobileOverlay.classList.add('hidden');
        });
    }
}

// Dropdown setup
function setupDropdowns() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    
    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('hidden');
        });
    }
    
    document.addEventListener('click', (e) => {
        if (userDropdown && userMenuBtn && !userDropdown.contains(e.target) && e.target !== userMenuBtn) {
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

// Global functions
window.viewCourse = (courseId) => {
    window.location.href = `course-view.html?id=${courseId}`;
};

window.switchToCoursesTab = () => {
    const coursesTab = document.querySelector('[data-tab="all-courses"]');
    if (coursesTab) {
        coursesTab.click();
    }
};

window.enrollInCourse = async (courseId) => {
    if (!currentUser) return;
    
    try {
        const enrollmentsRef = collection(db, 'enrollments');
        const q = query(enrollmentsRef, where('studentId', '==', currentUser.uid), where('courseId', '==', courseId));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            alert('You are already enrolled in this course!');
            return;
        }
        
        const courseRef = doc(db, 'courses', courseId);
        const courseDoc = await getDoc(courseRef);
        if (!courseDoc.exists()) {
            alert('Course not found');
            return;
        }
        
        const course = courseDoc.data();
        
        await addDoc(collection(db, 'enrollments'), {
            studentId: currentUser.uid,
            courseId: courseId,
            courseTitle: course.title,
            status: 'active',
            progress: 0,
            enrolledAt: new Date().toISOString(),
            lastAccessed: new Date().toISOString()
        });
        
        alert('Successfully enrolled in the course!');
        
        await loadEnrolledCourses(currentUser.uid);
        await loadAllCourses();
        
        const myCoursesTab = document.querySelector('[data-tab="my-courses"]');
        if (myCoursesTab) {
            myCoursesTab.click();
        }
        
    } catch (error) {
        console.error('Error enrolling in course:', error);
        alert('Failed to enroll. Please try again.');
    }
};

// Add CSS for line-clamp
const style = document.createElement('style');
style.textContent = `
    .line-clamp-1 {
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
`;
document.head.appendChild(style);

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupSidebarNavigation();
    setupFilters();
    setupSidebar();
    setupDropdowns();
    setupCourseModal();
    
    const logoutBtns = document.querySelectorAll('#logoutBtn, #logoutDropdown');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    });
});