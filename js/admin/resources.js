import { 
    auth, signOut, db, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
    collection, query, where, onAuthStateChanged
} from '../firebase-config.js';

let currentAdmin = null;
let allResources = [];
let filteredResources = [];
let courses = [];
let currentPage = 1;
const itemsPerPage = 9;
let currentStatus = 'all';
let currentCategory = 'all';
let searchTerm = '';
let selectedFile = null;
let currentUrlType = 'external'; // 'external' or 'file'

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '../../login.html'; return; }
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && (userDoc.data().role === 'admin' || userDoc.data().role === 'super_admin')) {
        currentAdmin = user;
        await loadAdminData(user.uid);
        await loadCourses();
        await loadResources();
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
        const adminNameEl = document.getElementById('adminName');
        const adminRoleEl = document.getElementById('adminRole');
        if (adminNameEl) adminNameEl.textContent = data.fullName || 'Administrator';
        if (adminRoleEl) adminRoleEl.textContent = data.role === 'super_admin' ? 'Super Administrator' : 'Administrator';
        const avatarUrl = `https://ui-avatars.com/api/?background=1e88e5&color=fff&bold=true&size=40&name=${encodeURIComponent(data.fullName || 'Admin')}`;
        const adminAvatar = document.getElementById('adminAvatar');
        const dropdownAvatar = document.getElementById('dropdownAvatar');
        if (adminAvatar) adminAvatar.src = avatarUrl;
        if (dropdownAvatar) dropdownAvatar.src = avatarUrl;
    }
}

// Load courses for dropdown
async function loadCourses() {
    try {
        const coursesRef = collection(db, 'courses');
        const snapshot = await getDocs(coursesRef);
        courses = [];
        snapshot.forEach(doc => courses.push({ id: doc.id, title: doc.data().title }));
        
        const select = document.getElementById('resourceCourse');
        if (select) {
            select.innerHTML = '<option value="">No course association</option>' + 
                courses.map(c => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading courses:', error);
        courses = [];
    }
}

// Load resources
async function loadResources() {
    try {
        const resourcesRef = collection(db, 'resources');
        const snapshot = await getDocs(resourcesRef);
        allResources = [];
        let totalDownloads = 0;
        let totalSize = 0;
        let externalCount = 0;
        
        snapshot.forEach(doc => {
            const resource = { id: doc.id, ...doc.data() };
            allResources.push(resource);
            totalDownloads += (resource.downloads || 0);
            totalSize += (resource.fileSize || 0);
            if (resource.isExternal || (resource.url && resource.url.startsWith('http'))) {
                externalCount++;
            }
        });
        
        allResources.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Update stats - check if elements exist before setting
        const totalResourcesEl = document.getElementById('totalResources');
        const publishedResourcesEl = document.getElementById('publishedResources');
        const totalDownloadsEl = document.getElementById('totalDownloads');
        const storageUsedEl = document.getElementById('storageUsed');
        const externalLinksEl = document.getElementById('externalLinks');
        
        const published = allResources.filter(r => r.status === 'published').length;
        
        if (totalResourcesEl) totalResourcesEl.textContent = allResources.length;
        if (publishedResourcesEl) publishedResourcesEl.textContent = published;
        if (totalDownloadsEl) totalDownloadsEl.textContent = totalDownloads;
        if (storageUsedEl) storageUsedEl.textContent = `${Math.round(totalSize)} MB`;
        if (externalLinksEl) externalLinksEl.textContent = externalCount;
        
        applyFilters();
        
    } catch (error) {
        console.error('Error loading resources:', error);
        showToast('Failed to load resources', 'error');
    }
}

// Apply filters
function applyFilters() {
    filteredResources = [...allResources];
    if (currentStatus !== 'all') {
        filteredResources = filteredResources.filter(r => r.status === currentStatus);
    }
    if (currentCategory !== 'all') {
        filteredResources = filteredResources.filter(r => r.category === currentCategory);
    }
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredResources = filteredResources.filter(r => 
            r.title?.toLowerCase().includes(term) ||
            r.description?.toLowerCase().includes(term) ||
            (r.tags && r.tags.some(tag => tag.toLowerCase().includes(term)))
        );
    }
    updatePagination();
    displayResources();
}

// Display resources
function displayResources() {
    const container = document.getElementById('resourcesGrid');
    if (!container) return;
    
    const start = (currentPage - 1) * itemsPerPage;
    const pageResources = filteredResources.slice(start, start + itemsPerPage);
    
    if (pageResources.length === 0) {
        container.innerHTML = `<div class="col-span-3 text-center py-12"><i class="fas fa-folder-open text-4xl text-gray-300 mb-3"></i><p class="text-gray-500">No resources found</p></div>`;
        return;
    }
    
    container.innerHTML = pageResources.map(resource => {
        const course = courses.find(c => c.id === resource.courseId);
        const platformIcon = getPlatformIcon(resource.url);
        const isExternal = resource.url?.startsWith('http') || resource.isExternal;
        
        return `
            <div class="resource-card bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition">
                <div class="h-24 bg-gradient-to-r from-[#1e88e5] to-[#00c853] p-4">
                    <div class="flex justify-between items-start">
                        <i class="fas ${getFileIcon(resource.fileType)} text-white text-3xl opacity-50"></i>
                        <span class="status-${resource.status} text-xs px-2 py-1 rounded-full capitalize">${resource.status}</span>
                    </div>
                </div>
                <div class="p-4">
                    <h3 class="font-semibold text-gray-800 mb-1">${escapeHtml(resource.title)}</h3>
                    <p class="text-xs text-gray-500 mb-2">${course?.title || 'General Resource'}</p>
                    <p class="text-sm text-gray-600 line-clamp-2 mb-3">${escapeHtml(resource.description || 'No description')}</p>
                    <div class="flex items-center justify-between text-xs text-gray-500 mb-3">
                        <span><i class="fas ${getCategoryIcon(resource.category)} mr-1"></i>${resource.category}</span>
                        <span><i class="fas ${platformIcon} mr-1"></i>${getPlatformName(resource.url)}</span>
                        ${resource.fileSize ? `<span><i class="fas fa-database mr-1"></i>${resource.fileSize} MB</span>` : ''}
                    </div>
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-xs text-gray-500"><i class="fas fa-download mr-1"></i>${resource.downloads || 0} accesses</span>
                        <span class="text-xs text-gray-500">${resource.views || 0} views</span>
                    </div>
                    <div class="flex flex-wrap gap-1 mb-3">
                        ${resource.tags?.slice(0, 3).map(tag => 
                            `<span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">${escapeHtml(tag)}</span>`
                        ).join('') || '<span class="text-xs text-gray-400">No tags</span>'}
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="window.editResource('${resource.id}')" class="flex-1 py-2 text-sm border border-[#1e88e5] text-[#1e88e5] rounded-lg hover:bg-[#1e88e5] hover:text-white transition">
                            <i class="fas fa-edit mr-1"></i> Edit
                        </button>
                        <button onclick="window.deleteResource('${resource.id}', '${escapeHtml(resource.title)}')" class="flex-1 py-2 text-sm border border-red-500 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition">
                            <i class="fas fa-trash mr-1"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Get platform icon based on URL
function getPlatformIcon(url) {
    if (!url) return 'fa-link';
    if (url.includes('drive.google.com')) return 'fab fa-google-drive';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'fab fa-youtube';
    if (url.includes('vimeo.com')) return 'fab fa-vimeo';
    if (url.includes('dropbox.com')) return 'fab fa-dropbox';
    if (url.includes('github.com')) return 'fab fa-github';
    if (url.includes('docs.google.com')) return 'fab fa-google';
    return 'fa-link';
}

// Get platform name
function getPlatformName(url) {
    if (!url) return 'Link';
    if (url.includes('drive.google.com')) return 'Google Drive';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
    if (url.includes('vimeo.com')) return 'Vimeo';
    if (url.includes('dropbox.com')) return 'Dropbox';
    if (url.includes('github.com')) return 'GitHub';
    if (url.includes('docs.google.com')) return 'Google Docs';
    return 'External Link';
}

// Get file icon
function getFileIcon(fileType) {
    const icons = {
        pdf: 'fa-file-pdf',
        doc: 'fa-file-word',
        docx: 'fa-file-word',
        mp4: 'fa-file-video',
        mov: 'fa-file-video',
        zip: 'fa-file-archive',
        js: 'fa-file-code',
        html: 'fa-file-code',
        py: 'fa-file-code',
        external: 'fa-link'
    };
    return icons[fileType] || 'fa-file-alt';
}

// Get category icon
function getCategoryIcon(category) {
    const icons = {
        documents: 'fa-file-alt',
        videos: 'fa-video',
        code: 'fa-code',
        tools: 'fa-tools',
        ebooks: 'fa-book',
        external: 'fa-link'
    };
    return icons[category] || 'fa-folder';
}

// Update pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredResources.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, filteredResources.length);
    
    const paginationInfo = document.getElementById('paginationInfo');
    const currentPageEl = document.getElementById('currentPage');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (paginationInfo) paginationInfo.textContent = `Showing ${start}-${end} of ${filteredResources.length} resources`;
    if (currentPageEl) currentPageEl.textContent = `Page ${currentPage}`;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

// Test URL and detect platform
function testUrl(url) {
    const previewDiv = document.getElementById('urlPreview');
    const previewText = document.getElementById('urlPreviewText');
    const platformSpan = document.getElementById('urlPlatform');
    
    if (!previewDiv || !previewText || !platformSpan) return false;
    
    if (!url) {
        previewDiv.classList.add('hidden');
        return false;
    }
    
    let platform = '';
    let isValid = false;
    
    if (url.includes('drive.google.com')) {
        platform = 'Google Drive - File will open in Google Drive viewer';
        isValid = true;
    } else if (url.includes('youtube.com/watch') || url.includes('youtu.be')) {
        platform = 'YouTube - Video will play in embedded player';
        isValid = true;
    } else if (url.includes('vimeo.com')) {
        platform = 'Vimeo - Video will play in embedded player';
        isValid = true;
    } else if (url.match(/\.(pdf|doc|docx|ppt|pptx|xls|xlsx)$/i)) {
        platform = 'Document - Will open in browser viewer';
        isValid = true;
    } else if (url.match(/\.(mp4|mov|webm)$/i)) {
        platform = 'Video File - Will play in browser player';
        isValid = true;
    } else if (url.startsWith('http://') || url.startsWith('https://')) {
        platform = 'External Link - Will open in new tab';
        isValid = true;
    } else {
        platform = 'Invalid URL format';
        isValid = false;
    }
    
    previewText.textContent = url;
    platformSpan.textContent = platform;
    platformSpan.className = `text-xs mt-1 ${isValid ? 'text-green-600' : 'text-red-600'}`;
    previewDiv.classList.remove('hidden');
    
    return isValid;
}

// Setup URL type toggle
function setupUrlTypeToggle() {
    const externalBtn = document.getElementById('externalUrlBtn');
    const fileBtn = document.getElementById('fileUploadBtn');
    const externalSection = document.getElementById('externalUrlSection');
    const fileSection = document.getElementById('fileUploadSection');
    
    if (!externalBtn || !fileBtn || !externalSection || !fileSection) return;
    
    externalBtn.addEventListener('click', () => {
        currentUrlType = 'external';
        externalBtn.classList.add('active', 'bg-[#1e88e5]', 'text-white', 'border-[#1e88e5]');
        externalBtn.classList.remove('bg-gray-100', 'text-gray-700', 'border-gray-300');
        fileBtn.classList.remove('active', 'bg-[#1e88e5]', 'text-white', 'border-[#1e88e5]');
        fileBtn.classList.add('bg-gray-100', 'text-gray-700', 'border-gray-300');
        externalSection.classList.remove('hidden');
        fileSection.classList.add('hidden');
    });
    
    fileBtn.addEventListener('click', () => {
        currentUrlType = 'file';
        fileBtn.classList.add('active', 'bg-[#1e88e5]', 'text-white', 'border-[#1e88e5]');
        fileBtn.classList.remove('bg-gray-100', 'text-gray-700', 'border-gray-300');
        externalBtn.classList.remove('active', 'bg-[#1e88e5]', 'text-white', 'border-[#1e88e5]');
        externalBtn.classList.add('bg-gray-100', 'text-gray-700', 'border-gray-300');
        fileSection.classList.remove('hidden');
        externalSection.classList.add('hidden');
    });
}

// Setup platform quick links
function setupPlatformLinks() {
    document.querySelectorAll('.platform-icon').forEach(icon => {
        icon.addEventListener('click', () => {
            const platform = icon.dataset.platform;
            const urlInput = document.getElementById('resourceUrl');
            if (!urlInput) return;
            
            let exampleUrl = '';
            
            switch(platform) {
                case 'google-drive':
                    exampleUrl = 'https://drive.google.com/file/d/FILE_ID/view';
                    break;
                case 'youtube':
                    exampleUrl = 'https://www.youtube.com/watch?v=VIDEO_ID';
                    break;
                case 'vimeo':
                    exampleUrl = 'https://vimeo.com/VIDEO_ID';
                    break;
                case 'dropbox':
                    exampleUrl = 'https://www.dropbox.com/s/FILE_ID/filename.pdf?dl=0';
                    break;
                case 'github':
                    exampleUrl = 'https://github.com/username/repo';
                    break;
            }
            
            if (exampleUrl) {
                urlInput.value = exampleUrl;
                testUrl(exampleUrl);
            }
        });
    });
}

// Setup file upload
function setupFileUpload() {
    const dragArea = document.getElementById('dragArea');
    const fileInput = document.getElementById('resourceFile');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSizeSpan = document.getElementById('fileSize');
    const removeFileBtn = document.getElementById('removeFileBtn');
    
    if (!dragArea || !fileInput) return;
    
    dragArea.addEventListener('click', () => fileInput.click());
    
    dragArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dragArea.classList.add('drag-over');
    });
    
    dragArea.addEventListener('dragleave', () => {
        dragArea.classList.remove('drag-over');
    });
    
    dragArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dragArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFile(files[0]);
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
    });
    
    function handleFile(file) {
        selectedFile = file;
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        if (fileName) fileName.textContent = file.name;
        if (fileSizeSpan) fileSizeSpan.textContent = `${sizeMB} MB`;
        
        const resourceSize = document.getElementById('resourceSize');
        if (resourceSize) resourceSize.value = sizeMB;
        
        // Determine file type and set category
        const ext = file.name.split('.').pop().toLowerCase();
        const fileTypes = {
            pdf: 'documents', doc: 'documents', docx: 'documents',
            mp4: 'videos', mov: 'videos',
            js: 'code', html: 'code', py: 'code', css: 'code',
            zip: 'tools'
        };
        
        if (fileTypes[ext]) {
            const categorySelect = document.getElementById('resourceCategory');
            if (categorySelect) categorySelect.value = fileTypes[ext];
        }
        
        // Create a fake URL (for demo since storage is disabled)
        const fakeUrl = URL.createObjectURL(file);
        const uploadedFileUrl = document.getElementById('uploadedFileUrl');
        const resourceUrl = document.getElementById('resourceUrl');
        if (uploadedFileUrl) uploadedFileUrl.value = fakeUrl;
        if (resourceUrl) resourceUrl.value = fakeUrl;
        
        if (fileInfo) fileInfo.classList.remove('hidden');
        if (dragArea) dragArea.classList.add('hidden');
    }
    
    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', () => {
            selectedFile = null;
            fileInput.value = '';
            if (fileInfo) fileInfo.classList.add('hidden');
            if (dragArea) dragArea.classList.remove('hidden');
            const uploadedFileUrl = document.getElementById('uploadedFileUrl');
            const resourceUrl = document.getElementById('resourceUrl');
            const resourceSize = document.getElementById('resourceSize');
            if (uploadedFileUrl) uploadedFileUrl.value = '';
            if (resourceUrl) resourceUrl.value = '';
            if (resourceSize) resourceSize.value = '';
        });
    }
}

// Setup resource modal
function setupResourceModal() {
    const modal = document.getElementById('resourceModal');
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelModalBtn');
    const testUrlBtn = document.getElementById('testUrlBtn');
    const form = document.getElementById('resourceForm');
    const addResourceBtn = document.getElementById('addResourceBtn');
    
    if (addResourceBtn) {
        addResourceBtn.addEventListener('click', () => {
            if (!modal) return;
            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle) modalTitle.textContent = 'Add New Resource';
            if (form) form.reset();
            const resourceId = document.getElementById('resourceId');
            if (resourceId) resourceId.value = '';
            const dragArea = document.getElementById('dragArea');
            const fileInfo = document.getElementById('fileInfo');
            const externalSection = document.getElementById('externalUrlSection');
            const fileSection = document.getElementById('fileUploadSection');
            const urlPreview = document.getElementById('urlPreview');
            
            if (dragArea) dragArea.classList.remove('hidden');
            if (fileInfo) fileInfo.classList.add('hidden');
            if (externalSection) externalSection.classList.remove('hidden');
            if (fileSection) fileSection.classList.add('hidden');
            if (urlPreview) urlPreview.classList.add('hidden');
            
            const externalBtn = document.getElementById('externalUrlBtn');
            if (externalBtn) externalBtn.click();
            
            modal.classList.remove('hidden');
        });
    }
    
    if (testUrlBtn) {
        testUrlBtn.addEventListener('click', () => {
            const urlInput = document.getElementById('resourceUrl');
            if (urlInput) testUrl(urlInput.value);
        });
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modal) modal.classList.add('hidden');
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (modal) modal.classList.add('hidden');
        });
    }
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const tagsInput = document.getElementById('resourceTags');
            const tags = tagsInput ? tagsInput.value.split(',')
                .map(tag => tag.trim())
                .filter(tag => tag) : [];
            
            const resourceUrl = document.getElementById('resourceUrl')?.value || '';
            const resourceTitle = document.getElementById('resourceTitle')?.value.trim();
            const resourceCategory = document.getElementById('resourceCategory')?.value;
            
            if (!resourceTitle || !resourceCategory || !resourceUrl) {
                showToast('Please fill in all required fields', 'error');
                return;
            }
            
            const resourceData = {
                title: resourceTitle,
                category: resourceCategory,
                description: document.getElementById('resourceDescription')?.value.trim() || '',
                fileType: currentUrlType === 'file' && selectedFile ? selectedFile.name.split('.').pop().toLowerCase() : 'external',
                fileSize: parseFloat(document.getElementById('resourceSize')?.value) || 0,
                url: resourceUrl,
                tags: tags,
                courseId: document.getElementById('resourceCourse')?.value || null,
                status: document.getElementById('resourceStatus')?.value || 'draft',
                isExternal: currentUrlType === 'external' || resourceUrl.startsWith('http'),
                platform: getPlatformName(resourceUrl),
                updatedAt: new Date().toISOString(),
                updatedBy: currentAdmin.uid
            };
            
            const resourceId = document.getElementById('resourceId')?.value;
            try {
                if (resourceId) {
                    await updateDoc(doc(db, 'resources', resourceId), resourceData);
                    showToast('Resource updated successfully', 'success');
                } else {
                    resourceData.createdAt = new Date().toISOString();
                    resourceData.createdBy = currentAdmin.uid;
                    resourceData.downloads = 0;
                    resourceData.views = 0;
                    await addDoc(collection(db, 'resources'), resourceData);
                    showToast('Resource created successfully', 'success');
                }
                if (modal) modal.classList.add('hidden');
                await loadResources();
            } catch (error) {
                console.error('Error saving resource:', error);
                showToast('Failed to save resource', 'error');
            }
        });
    }
}

// Edit resource
window.editResource = async (resourceId) => {
    const resource = allResources.find(r => r.id === resourceId);
    if (!resource) return;
    
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = 'Edit Resource';
    
    const resourceIdEl = document.getElementById('resourceId');
    const titleEl = document.getElementById('resourceTitle');
    const categoryEl = document.getElementById('resourceCategory');
    const descEl = document.getElementById('resourceDescription');
    const tagsEl = document.getElementById('resourceTags');
    const sizeEl = document.getElementById('resourceSize');
    const statusEl = document.getElementById('resourceStatus');
    const courseEl = document.getElementById('resourceCourse');
    const urlEl = document.getElementById('resourceUrl');
    
    if (resourceIdEl) resourceIdEl.value = resource.id;
    if (titleEl) titleEl.value = resource.title || '';
    if (categoryEl) categoryEl.value = resource.category || '';
    if (descEl) descEl.value = resource.description || '';
    if (tagsEl) tagsEl.value = (resource.tags || []).join(', ');
    if (sizeEl) sizeEl.value = resource.fileSize || '';
    if (statusEl) statusEl.value = resource.status || 'draft';
    if (courseEl) courseEl.value = resource.courseId || '';
    if (urlEl) urlEl.value = resource.url || '';
    
    // Determine if it's external or file
    if (resource.url && (resource.url.startsWith('http') || resource.isExternal)) {
        const externalBtn = document.getElementById('externalUrlBtn');
        if (externalBtn) externalBtn.click();
        testUrl(resource.url);
    } else {
        const fileBtn = document.getElementById('fileUploadBtn');
        if (fileBtn) fileBtn.click();
        if (resource.url) {
            const dragArea = document.getElementById('dragArea');
            const fileInfo = document.getElementById('fileInfo');
            const fileName = document.getElementById('fileName');
            const fileSizeSpan = document.getElementById('fileSize');
            if (dragArea) dragArea.classList.add('hidden');
            if (fileInfo) fileInfo.classList.remove('hidden');
            if (fileName) fileName.textContent = resource.url.split('/').pop() || 'Existing file';
            if (fileSizeSpan) fileSizeSpan.textContent = `${resource.fileSize || 0} MB`;
        }
    }
    
    const modal = document.getElementById('resourceModal');
    if (modal) modal.classList.remove('hidden');
};

// Delete resource
window.deleteResource = async (resourceId, resourceTitle) => {
    const modal = document.getElementById('deleteModal');
    const deleteTitleEl = document.getElementById('deleteResourceTitle');
    if (deleteTitleEl) deleteTitleEl.textContent = `Resource: ${resourceTitle}`;
    if (modal) modal.classList.remove('hidden');
    
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    
    const handleConfirm = async () => {
        try {
            await deleteDoc(doc(db, 'resources', resourceId));
            showToast('Resource deleted successfully', 'success');
            if (modal) modal.classList.add('hidden');
            await loadResources();
        } catch (error) {
            console.error('Error deleting resource:', error);
            showToast('Failed to delete resource', 'error');
        }
        cleanup();
    };
    
    const cleanup = () => {
        if (confirmBtn) confirmBtn.removeEventListener('click', handleConfirm);
        if (cancelBtn) cancelBtn.removeEventListener('click', cleanup);
    };
    
    if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
    if (cancelBtn) cancelBtn.addEventListener('click', cleanup);
};

// Close delete modal
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
        const modal = document.getElementById('deleteModal');
        if (modal) modal.classList.add('hidden');
    });
}

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
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            currentPage = 1;
            applyFilters();
        });
    }
    
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
            currentCategory = e.target.value;
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
                displayResources(); 
                updatePagination(); 
            } 
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => { 
            if (currentPage < Math.ceil(filteredResources.length / itemsPerPage)) { 
                currentPage++; 
                displayResources(); 
                updatePagination(); 
            } 
        });
    }
}

// Load notifications
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

// Sidebar setup
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    const mainContent = document.getElementById('mainContent');
    let isCollapsed = localStorage.getItem('adminSidebarCollapsed') === 'true';
    if (isCollapsed) toggleSidebar(true);
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => toggleSidebar(!isCollapsed));
    }
    function toggleSidebar(collapse) {
        isCollapsed = collapse;
        if (collapse) {
            if (sidebar) sidebar.classList.add('sidebar-collapsed');
            if (sidebar) sidebar.classList.remove('sidebar-expanded');
            if (mainContent) mainContent.style.marginLeft = '80px';
            localStorage.setItem('adminSidebarCollapsed', 'true');
            document.querySelectorAll('.nav-text, .admin-info, .logo-text').forEach(el => {
                if (el) el.style.display = 'none';
            });
            document.querySelectorAll('.nav-item').forEach(item => {
                const text = item.querySelector('.nav-text')?.innerText;
                if (text) { item.classList.add('tooltip'); item.setAttribute('data-tooltip', text); }
            });
            if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-chevron-right text-xl"></i>';
        } else {
            if (sidebar) sidebar.classList.add('sidebar-expanded');
            if (sidebar) sidebar.classList.remove('sidebar-collapsed');
            if (mainContent) mainContent.style.marginLeft = '280px';
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
            if (sidebar) sidebar.classList.add('mobile-open');
            mobileOverlay.classList.remove('hidden');
        });
        mobileOverlay.addEventListener('click', () => {
            if (sidebar) sidebar.classList.remove('mobile-open');
            mobileOverlay.classList.add('hidden');
        });
    }
}

function setupDropdowns() {
    const btn = document.getElementById('adminMenuBtn');
    const dropdown = document.getElementById('adminDropdown');
    if (btn && dropdown) {
        btn.addEventListener('click', (e) => { e.stopPropagation(); dropdown.classList.toggle('hidden'); });
        document.addEventListener('click', (e) => { if (!dropdown.contains(e.target) && e.target !== btn) dropdown.classList.add('hidden'); });
    }
}

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in ${type === 'success' ? 'bg-green-500 text-white' : type === 'error' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}`;
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

async function logout() { 
    await signOut(auth); 
    window.location.href = '../../login.html'; 
}

document.addEventListener('DOMContentLoaded', () => {
    setupFilters(); 
    setupPagination(); 
    setupResourceModal(); 
    setupFileUpload(); 
    setupUrlTypeToggle();
    setupPlatformLinks();
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

// Make functions available globally
window.editResource = editResource;
window.deleteResource = deleteResource;

const style = document.createElement('style');
style.textContent = `.animate-fade-in { animation: fadeIn 0.3s ease; } @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; } .drag-over { border-color: #1e88e5; background: rgba(30, 136, 229, 0.05); }`;
document.head.appendChild(style);