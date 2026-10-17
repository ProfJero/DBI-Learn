import { 
    auth, signOut, db, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc,
    collection, query, where, orderBy, onAuthStateChanged
} from '../firebase-config.js';

let currentAdmin = null;
let allCourses = [];
let filteredCourses = [];
let currentPage = 1;
const itemsPerPage = 9;
let currentStatus = 'all';
let currentDepartment = 'all';
let searchTerm = '';
let instructors = [];
let departments = [];

const defaultDepartments = [
    { id: 'software-dev', name: 'Software Development', icon: 'fa-code', color: 'blue' },
    { id: 'graphics-multimedia', name: 'Graphics & Multimedia', icon: 'fa-paint-brush', color: 'purple' },
    { id: 'data-analysis', name: 'Data Analysis', icon: 'fa-chart-line', color: 'green' },
    { id: 'ai-robotics', name: 'AI & Robotics', icon: 'fa-robot', color: 'orange' }
];

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

// Convert Google Drive URL to direct image URL with multiple fallbacks
function convertGoogleDriveUrl(url) {
    if (!url || url.trim() === '') return null;
    
    const fileId = extractGoogleDriveFileId(url);
    
    if (fileId) {
        // Return an object with multiple URL options
        return {
            thumbnail: `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`,
            download: `https://drive.google.com/uc?export=download&id=${fileId}`,
            view: `https://drive.google.com/uc?export=view&id=${fileId}`,
            direct: `https://lh3.googleusercontent.com/d/${fileId}`,
            fileId: fileId,
            original: url
        };
    }
    
    return { original: url };
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
const imageUrlCache = new Map();

async function getBestImageUrl(rawUrl) {
    if (!rawUrl) return null;
    
    // Check cache first
    if (imageUrlCache.has(rawUrl)) {
        return imageUrlCache.get(rawUrl);
    }
    
    const urls = convertGoogleDriveUrl(rawUrl);
    
    // If not a Google Drive URL, test and return
    if (!urls.fileId && urls.original) {
        const works = await testImageUrl(rawUrl);
        const result = works ? rawUrl : null;
        imageUrlCache.set(rawUrl, result);
        return result;
    }
    
    // Try different endpoints in order of reliability
    const endpoints = [
        urls.thumbnail,
        urls.direct,
        urls.download,
        urls.view
    ].filter(url => url);
    
    for (const endpoint of endpoints) {
        const works = await testImageUrl(endpoint);
        if (works) {
            imageUrlCache.set(rawUrl, endpoint);
            return endpoint;
        }
    }
    
    imageUrlCache.set(rawUrl, null);
    return null;
}

// Show thumbnail preview
async function showThumbnailPreview(url) {
    const container = document.getElementById('thumbnailPreviewContainer');
    if (!container) return;
    
    if (!url || url.trim() === '') {
        container.innerHTML = '';
        return;
    }
    
    // Show loading
    container.innerHTML = `
        <div class="flex items-center gap-2 text-gray-500 text-xs mt-2 p-2 bg-gray-50 rounded-lg">
            <div class="loading-spinner-small"></div>
            <span>Testing image accessibility...</span>
        </div>
    `;
    
    const workingUrl = await getBestImageUrl(url);
    
    if (workingUrl) {
        container.innerHTML = `
            <div class="thumbnail-preview mt-2">
                <div class="relative inline-block">
                    <img src="${workingUrl}" 
                         alt="Thumbnail preview" 
                         class="max-w-[200px] max-h-[120px] rounded-lg border border-gray-200 object-cover"
                         onerror="this.onerror=null; this.parentElement.parentElement.innerHTML='<div class=\'text-red-500 text-xs mt-2 p-2 bg-red-50 rounded-lg\'><i class=\'fas fa-exclamation-triangle mr-1\'></i> Image failed to load. Please check the file is shared properly.</div>'">
                    <button type="button" 
                            onclick="clearThumbnailPreview()" 
                            class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <p class="text-xs text-green-600 mt-1">
                    <i class="fas fa-check-circle"></i> Image is accessible
                </p>
            </div>
        `;
    } else {
        const fileId = extractGoogleDriveFileId(url);
        container.innerHTML = `
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                <div class="flex items-start gap-2">
                    <i class="fas fa-exclamation-triangle text-yellow-600 mt-0.5"></i>
                    <div class="text-sm">
                        <p class="font-medium text-yellow-800">⚠️ Image cannot be displayed</p>
                        <p class="text-xs text-yellow-700 mt-1">Please ensure:</p>
                        <ul class="text-xs text-yellow-700 ml-4 list-disc mt-1">
                            <li>The file is shared with "Anyone with the link"</li>
                            <li>Permission is set to "Viewer" (not just "Commenter")</li>
                            <li>The file still exists and wasn't moved</li>
                        </ul>
                        ${fileId ? `
                            <div class="mt-2 p-2 bg-white rounded border border-gray-200">
                                <p class="text-xs font-mono text-gray-600">File ID: ${fileId}</p>
                                <p class="text-xs text-gray-500 mt-1">Try this URL instead:</p>
                                <code class="text-xs text-blue-600 break-all">https://lh3.googleusercontent.com/d/${fileId}</code>
                            </div>
                        ` : ''}
                        <div class="mt-2">
                            <button type="button" onclick="retryThumbnailPreview()" 
                                    class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded hover:bg-yellow-200">
                                <i class="fas fa-sync-alt mr-1"></i> Retry
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// Retry function
window.retryThumbnailPreview = function() {
    const input = document.getElementById('courseThumbnail');
    if (input && input.value) {
        showThumbnailPreview(input.value);
    }
};

// Clear preview
window.clearThumbnailPreview = function() {
    const container = document.getElementById('thumbnailPreviewContainer');
    const input = document.getElementById('courseThumbnail');
    if (container) container.innerHTML = '';
    if (input) input.value = '';
    if (window.event) window.event.stopPropagation();
};

// Helper Functions
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    
    toast.className = `mb-2 px-4 py-3 rounded-lg shadow-lg animate-fade-in ${bgColor} text-white min-w-[250px] z-50`;
    toast.style.animation = 'slideInRight 0.3s ease';
    toast.innerHTML = `
        <div class="flex items-center gap-2">
            <i class="fas ${icon}"></i>
            <span class="text-sm">${escapeHtml(message)}</span>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../login.html';
        return;
    }
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && (userDoc.data().role === 'admin' || userDoc.data().role === 'super_admin')) {
        currentAdmin = user;
        await loadAdminData(user.uid);
        await loadInstructors();
        await loadDepartments();
        await loadCourses();
        await loadNotifications(user.uid);
    } else {
        window.location.href = '../../student/dashboard.html';
    }
});

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

async function loadDepartments() {
    try {
        const deptsRef = collection(db, 'departments');
        const snapshot = await getDocs(deptsRef);
        
        if (snapshot.empty) {
            departments = [...defaultDepartments];
            for (const dept of defaultDepartments) {
                await setDoc(doc(db, 'departments', dept.id), dept);
            }
        } else {
            departments = [];
            snapshot.forEach(doc => {
                departments.push({ id: doc.id, ...doc.data() });
            });
        }
        
        renderDepartmentFilters();
        updateDepartmentSelect();
        
    } catch (error) {
        console.error('Error loading departments:', error);
        departments = [...defaultDepartments];
        renderDepartmentFilters();
        updateDepartmentSelect();
    }
}

function updateDepartmentSelect() {
    const select = document.getElementById('courseCategory');
    if (select) {
        select.innerHTML = '<option value="">Select department</option>' + 
            departments.map(dept => `<option value="${escapeHtml(dept.name)}">${escapeHtml(dept.name)}</option>`).join('');
    }
}

function renderDepartmentFilters() {
    const container = document.getElementById('departmentFilters');
    if (!container) return;
    
    container.innerHTML = departments.map(dept => `
        <button class="dept-filter px-3 py-1 rounded-lg text-sm font-medium transition bg-gray-100 text-gray-700 hover:bg-gray-200" 
                data-dept="${dept.id}">
            <i class="fas ${dept.icon} mr-1"></i> ${escapeHtml(dept.name)}
        </button>
    `).join('');
    
    document.querySelectorAll('.dept-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.dept-filter').forEach(b => {
                b.classList.remove('bg-[#1e88e5]', 'text-white');
                b.classList.add('bg-gray-100', 'text-gray-700');
            });
            btn.classList.add('bg-[#1e88e5]', 'text-white');
            btn.classList.remove('bg-gray-100', 'text-gray-700');
            
            currentDepartment = btn.dataset.dept;
            currentPage = 1;
            applyFilters();
        });
    });
}

function setupAddDepartmentModal() {
    const addDeptBtn = document.getElementById('addDepartmentBtn');
    if (!addDeptBtn) return;
    
    addDeptBtn.addEventListener('click', async () => {
        const name = prompt('Enter department name:', '');
        if (!name) return;
        
        const icon = prompt('Enter FontAwesome icon class (e.g., fa-code, fa-paint-brush):', 'fa-folder');
        const color = prompt('Enter color theme (blue, green, purple, orange):', 'blue');
        
        const deptId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        
        const newDept = {
            id: deptId,
            name: name,
            icon: icon || 'fa-folder',
            color: color || 'blue',
            createdAt: new Date().toISOString()
        };
        
        try {
            await setDoc(doc(db, 'departments', deptId), newDept);
            departments.push(newDept);
            renderDepartmentFilters();
            updateDepartmentSelect();
            showToast(`Department "${name}" added successfully`, 'success');
        } catch (error) {
            console.error('Error adding department:', error);
            showToast('Failed to add department', 'error');
        }
    });
}

async function loadInstructors() {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', 'instructor'), where('status', '==', 'active'));
        const snapshot = await getDocs(q);
        instructors = [];
        snapshot.forEach(doc => instructors.push({ id: doc.id, ...doc.data() }));
        
        const select = document.getElementById('courseInstructor');
        if (select) {
            select.innerHTML = '<option value="">Select instructor</option>' + 
                instructors.map(i => `<option value="${i.id}">${escapeHtml(i.fullName)} (${escapeHtml(i.email)})</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading instructors:', error);
    }
}

async function loadCourses() {
    try {
        const coursesRef = collection(db, 'courses');
        const snapshot = await getDocs(coursesRef);
        allCourses = [];
        
        for (const docSnap of snapshot.docs) {
            const course = { id: docSnap.id, ...docSnap.data() };
            const rawThumbnail = course.thumbnail || course.bannerThumbnail || null;
            course.originalThumbnail = rawThumbnail;
            
            // Try to get working URL asynchronously
            if (rawThumbnail) {
                const workingUrl = await getBestImageUrl(rawThumbnail);
                course.thumbnailUrl = workingUrl;
            } else {
                course.thumbnailUrl = null;
            }
            
            allCourses.push(course);
        }
        
        allCourses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        applyFilters();
        
    } catch (error) {
        console.error('Error loading courses:', error);
        showToast('Failed to load courses', 'error');
    }
}

function applyFilters() {
    filteredCourses = [...allCourses];
    
    if (currentStatus !== 'all') {
        filteredCourses = filteredCourses.filter(c => c.status === currentStatus);
    }
    
    if (currentDepartment !== 'all') {
        const dept = departments.find(d => d.id === currentDepartment);
        if (dept) {
            filteredCourses = filteredCourses.filter(c => c.department === dept.name || c.department === currentDepartment);
        }
    }
    
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredCourses = filteredCourses.filter(c => 
            c.title?.toLowerCase().includes(term) || 
            c.description?.toLowerCase().includes(term) ||
            c.department?.toLowerCase().includes(term)
        );
    }
    
    updatePagination();
    displayCourses();
}

function displayCourses() {
    const container = document.getElementById('coursesGrid');
    const start = (currentPage - 1) * itemsPerPage;
    const pageCourses = filteredCourses.slice(start, start + itemsPerPage);
    
    if (pageCourses.length === 0) {
        container.innerHTML = `<div class="col-span-3 text-center py-12"><i class="fas fa-book text-4xl text-gray-300 mb-3"></i><p class="text-gray-500">No courses found</p></div>`;
        return;
    }
    
    container.innerHTML = pageCourses.map(course => {
        const dept = departments.find(d => d.name === course.department || d.id === course.department);
        const deptIcon = dept?.icon || 'fa-book';
        
        const statusColors = {
            'published': 'bg-green-500',
            'draft': 'bg-yellow-500',
            'archived': 'bg-gray-500'
        };
        const statusColor = statusColors[course.status] || 'bg-gray-500';
        
        const thumbnailHtml = course.thumbnailUrl ? 
            `<img src="${course.thumbnailUrl}" 
                  alt="${escapeHtml(course.title)}" 
                  class="w-full h-full object-cover"
                  onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100%25\' height=\'100%25\'%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'%23f3f4f6\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%239ca3af\' font-size=\'14\'%3ENo image%3C/text%3E%3C/svg%3E';">` :
            `<div class="w-full h-full bg-gradient-to-r from-[#1e88e5] to-[#00c853] flex items-center justify-center">
                <i class="fas ${deptIcon} text-white text-5xl opacity-50"></i>
            </div>`;
        
        return `
            <div class="course-card bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition">
                <div class="relative h-40 overflow-hidden cursor-pointer group" onclick="window.manageCourseContent('${course.id}')">
                    ${thumbnailHtml}
                    <div class="absolute inset-0 bg-black opacity-0 group-hover:opacity-40 transition"></div>
                    <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        <i class="fas fa-eye text-white text-2xl"></i>
                    </div>
                    <span class="absolute top-2 right-2 ${statusColor} text-white text-xs px-2 py-1 rounded-full shadow">
                        ${course.status}
                    </span>
                </div>
                <div class="p-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs text-[#1e88e5] font-medium">${escapeHtml(course.department || course.category || 'General')}</span>
                        <span class="text-xs text-gray-500"><i class="far fa-clock mr-1"></i>${course.duration || 0} hrs</span>
                    </div>
                    <h3 class="font-semibold text-gray-800 mb-1 line-clamp-1">${escapeHtml(course.title)}</h3>
                    <p class="text-sm text-gray-600 line-clamp-2 mb-3">${escapeHtml(course.shortDescription || 'No description')}</p>
                    <div class="flex items-center justify-between mb-3 text-xs text-gray-500">
                        <span><i class="fas fa-users mr-1"></i>${course.enrolledStudents || 0} enrolled</span>
                        <span><i class="fas fa-chalkboard-teacher mr-1"></i>${getInstructorName(course.instructorId)}</span>
                    </div>
                    <div class="grid grid-cols-3 gap-2">
                        <button onclick="window.manageCourseContent('${course.id}')" 
                                class="col-span-1 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition">
                            <i class="fas fa-layer-group mr-1"></i> Content
                        </button>
                        <button onclick="window.editCourse('${course.id}')" 
                                class="col-span-1 py-2 text-sm border border-[#1e88e5] text-[#1e88e5] rounded-lg hover:bg-[#1e88e5] hover:text-white transition">
                            <i class="fas fa-edit mr-1"></i> Edit
                        </button>
                        <button onclick="window.deleteCourse('${course.id}', '${escapeHtml(course.title)}')" 
                                class="col-span-1 py-2 text-sm border border-red-500 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition">
                            <i class="fas fa-trash mr-1"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.manageCourseContent = (courseId) => {
    window.location.href = `course-content.html?id=${courseId}`;
};

function getInstructorName(instructorId) {
    if (!instructorId) return 'Admin';
    const instructor = instructors.find(i => i.id === instructorId);
    return instructor ? instructor.fullName?.split(' ')[0] || 'Instructor' : 'Admin';
}

function updatePagination() {
    const totalPages = Math.ceil(filteredCourses.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, filteredCourses.length);
    const paginationInfo = document.getElementById('paginationInfo');
    const currentPageEl = document.getElementById('currentPage');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (paginationInfo) paginationInfo.textContent = `Showing ${start}-${end} of ${filteredCourses.length} courses`;
    if (currentPageEl) currentPageEl.textContent = `Page ${currentPage}`;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

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
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            currentPage = 1;
            applyFilters();
        });
    }
}

function setupPagination() {
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => { 
            if (currentPage > 1) { 
                currentPage--; 
                displayCourses(); 
                updatePagination(); 
            } 
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => { 
            if (currentPage < Math.ceil(filteredCourses.length / itemsPerPage)) { 
                currentPage++; 
                displayCourses(); 
                updatePagination(); 
            } 
        });
    }
}

function setupRichTextEditor() {
    const editor = document.getElementById('editorContent');
    if (!editor) return;
    
    document.querySelectorAll('[data-command]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const command = btn.dataset.command;
            document.execCommand(command, false, null);
            editor.focus();
        });
    });
    
    document.querySelectorAll('[data-list]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const listType = btn.dataset.list;
            if (listType === 'unordered') {
                document.execCommand('insertUnorderedList', false, null);
            } else if (listType === 'ordered') {
                document.execCommand('insertOrderedList', false, null);
            }
            editor.focus();
        });
    });
    
    document.querySelector('[data-link="insert"]')?.addEventListener('click', (e) => {
        e.preventDefault();
        const url = prompt('Enter URL:', 'https://');
        if (url) {
            document.execCommand('createLink', false, url);
            editor.focus();
        }
    });
}

function setupCourseModal() {
    const modal = document.getElementById('courseModal');
    const closeBtn = document.getElementById('closeModalBtn');
    const form = document.getElementById('courseForm');
    const thumbnailInput = document.getElementById('courseThumbnail');
    
    if (thumbnailInput) {
        let debounceTimer;
        thumbnailInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                showThumbnailPreview(e.target.value);
            }, 500);
        });
    }
    
    const addCourseBtn = document.getElementById('addCourseBtn');
    if (addCourseBtn) {
        addCourseBtn.addEventListener('click', () => {
            document.getElementById('modalTitle').textContent = 'Add New Course';
            form.reset();
            const editorContent = document.getElementById('editorContent');
            if (editorContent) editorContent.innerHTML = '';
            document.getElementById('courseId').value = '';
            clearThumbnailPreview();
            modal.classList.remove('hidden');
        });
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            clearThumbnailPreview();
        });
    }
    
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
            clearThumbnailPreview();
        }
    });
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const saveBtn = document.getElementById('saveCourseBtn');
            const originalText = saveBtn.innerHTML;
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<div class="loading-spinner"></div> Saving...';
            
            try {
                const description = document.getElementById('editorContent').innerHTML;
                document.getElementById('courseDescription').value = description;
                
                const selectedDept = document.getElementById('courseCategory').value;
                const dept = departments.find(d => d.name === selectedDept);
                
                const rawThumbnailUrl = document.getElementById('courseThumbnail').value.trim();
                const thumbnailUrl = rawThumbnailUrl || null;
                
                const courseData = {
                    title: document.getElementById('courseTitle').value.trim(),
                    category: selectedDept,
                    department: selectedDept,
                    departmentId: dept?.id || null,
                    shortDescription: document.getElementById('courseShortDesc').value.trim(),
                    description: description,
                    duration: parseInt(document.getElementById('courseDuration').value) || 0,
                    level: document.getElementById('courseLevel').value,
                    status: document.getElementById('courseStatus').value,
                    thumbnail: thumbnailUrl,
                    bannerThumbnail: thumbnailUrl,
                    instructorId: document.getElementById('courseInstructor').value || null,
                    updatedAt: new Date().toISOString(),
                    updatedBy: currentAdmin.uid
                };
                
                const courseId = document.getElementById('courseId').value;
                
                if (courseId) {
                    await updateDoc(doc(db, 'courses', courseId), courseData);
                    showToast('Course updated successfully', 'success');
                } else {
                    courseData.createdAt = new Date().toISOString();
                    courseData.createdBy = currentAdmin.uid;
                    courseData.enrolledStudents = 0;
                    await addDoc(collection(db, 'courses'), courseData);
                    showToast('Course created successfully', 'success');
                }
                
                modal.classList.add('hidden');
                clearThumbnailPreview();
                await loadCourses();
                
            } catch (error) {
                console.error('Error saving course:', error);
                showToast(error.message || 'Failed to save course', 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalText;
            }
        });
    }
}

window.editCourse = async (courseId) => {
    const course = allCourses.find(c => c.id === courseId);
    if (!course) return;
    
    document.getElementById('modalTitle').textContent = 'Edit Course';
    document.getElementById('courseId').value = course.id;
    document.getElementById('courseTitle').value = course.title || '';
    document.getElementById('courseCategory').value = course.department || course.category || '';
    document.getElementById('courseShortDesc').value = course.shortDescription || '';
    document.getElementById('editorContent').innerHTML = course.description || '';
    document.getElementById('courseDuration').value = course.duration || '';
    document.getElementById('courseLevel').value = course.level || 'Beginner';
    document.getElementById('courseStatus').value = course.status || 'draft';
    document.getElementById('courseInstructor').value = course.instructorId || '';
    
    const existingThumbnail = course.thumbnail || course.bannerThumbnail || '';
    const thumbnailInput = document.getElementById('courseThumbnail');
    if (thumbnailInput) thumbnailInput.value = existingThumbnail;
    
    if (existingThumbnail) {
        await showThumbnailPreview(existingThumbnail);
    } else {
        clearThumbnailPreview();
    }
    
    document.getElementById('courseModal').classList.remove('hidden');
};

window.deleteCourse = async (courseId, courseTitle) => {
    const modal = document.getElementById('deleteModal');
    const deleteCourseTitle = document.getElementById('deleteCourseTitle');
    if (deleteCourseTitle) deleteCourseTitle.textContent = `Course: ${courseTitle}`;
    modal.classList.remove('hidden');
    
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    
    const handleConfirm = async () => {
        try {
            await deleteDoc(doc(db, 'courses', courseId));
            showToast('Course deleted successfully', 'success');
            modal.classList.add('hidden');
            await loadCourses();
        } catch (error) {
            console.error('Error deleting course:', error);
            showToast('Failed to delete course', 'error');
        }
        cleanup();
    };
    
    const cleanup = () => {
        if (confirmBtn) confirmBtn.removeEventListener('click', handleConfirm);
        if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
    };
    
    const handleCancel = () => {
        modal.classList.add('hidden');
        cleanup();
    };
    
    if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
    if (cancelBtn) {
        cancelBtn.addEventListener('click', handleCancel);
    }
};

document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => {
    document.getElementById('deleteModal').classList.add('hidden');
});

async function loadNotifications(userId) {
    try {
        const snapshot = await getDocs(query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false)));
        const notificationCount = document.getElementById('notificationCount');
        if (notificationCount) notificationCount.textContent = snapshot.size;
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    let isCollapsed = localStorage.getItem('adminSidebarCollapsed') === 'true';
    
    function applySidebarState(collapse) {
        isCollapsed = collapse;
        if (collapse) {
            sidebar.classList.add('sidebar-collapsed');
            sidebar.classList.remove('sidebar-expanded');
            mainContent.style.marginLeft = '80px';
            localStorage.setItem('adminSidebarCollapsed', 'true');
            document.querySelectorAll('.nav-text, .admin-info').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.nav-item').forEach(item => {
                const text = item.querySelector('.nav-text')?.innerText;
                if (text) {
                    item.classList.add('tooltip');
                    item.setAttribute('data-tooltip', text);
                }
            });
        } else {
            sidebar.classList.add('sidebar-expanded');
            sidebar.classList.remove('sidebar-collapsed');
            mainContent.style.marginLeft = '280px';
            localStorage.setItem('adminSidebarCollapsed', 'false');
            document.querySelectorAll('.nav-text, .admin-info').forEach(el => el.style.display = '');
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('tooltip');
                item.removeAttribute('data-tooltip');
            });
        }
    }
    
    applySidebarState(isCollapsed);
    
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

function setupDropdowns() {
    const btn = document.getElementById('adminMenuBtn');
    const dropdown = document.getElementById('adminDropdown');
    if (btn) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dropdown) dropdown.classList.toggle('hidden');
        });
    }
    document.addEventListener('click', (e) => {
        if (dropdown && !dropdown.contains(e.target) && e.target !== btn) {
            dropdown.classList.add('hidden');
        }
    });
}

async function logout() {
    await signOut(auth);
    window.location.href = '../../login.html';
}

// Add styles
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideInRight {
        from { opacity: 0; transform: translateX(100px); }
        to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideOutRight {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100px); }
    }
    .animate-fade-in { animation: fadeIn 0.3s ease; }
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
    .loading-spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,.3);
        border-radius: 50%;
        border-top-color: white;
        animation: spin 0.8s ease-in-out infinite;
        margin-right: 8px;
    }
    .loading-spinner-small {
        display: inline-block;
        width: 12px;
        height: 12px;
        border: 2px solid #d1d5db;
        border-radius: 50%;
        border-top-color: #1e88e5;
        animation: spin 0.6s ease-in-out infinite;
    }
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    .tooltip { position: relative; }
    .tooltip:hover::after {
        content: attr(data-tooltip);
        position: absolute;
        left: 70px;
        top: 50%;
        transform: translateY(-50%);
        background: #1f2937;
        color: white;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 12px;
        white-space: nowrap;
        z-index: 50;
        pointer-events: none;
    }
`;
document.head.appendChild(style);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupFilters();
    setupPagination();
    setupCourseModal();
    setupAddDepartmentModal();
    setupRichTextEditor();
    setupSidebar();
    setupDropdowns();
    document.querySelectorAll('#logoutBtn, #logoutDropdown').forEach(btn => {
        if (btn) btn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    });
});