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
    updateDoc,
    arrayUnion,
    arrayRemove,
    increment
} from '../firebase-config.js';

let currentUser = null;
let resources = [];
let userDownloads = [];
let userFavorites = [];

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../login.html';
    } else {
        currentUser = user;
        await loadUserData(user.uid);
        await loadResources();
        await loadUserPreferences(user.uid);
        await loadNotifications(user.uid);
    }
});

// Load user data
async function loadUserData(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            const userNameEl = document.getElementById('userName');
            const userRoleEl = document.getElementById('userRole');
            if (userNameEl) userNameEl.textContent = userData.fullName || 'Student';
            if (userRoleEl) userRoleEl.textContent = userData.role || 'Student';
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Load resources
async function loadResources() {
    try {
        const resourcesRef = collection(db, 'resources');
        const q = query(resourcesRef, where('status', '==', 'published'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        resources = [];
        snapshot.forEach(doc => {
            resources.push({ id: doc.id, ...doc.data() });
        });
        
        displayResources();
        
    } catch (error) {
        console.error('Error loading resources:', error);
        displayEmptyState();
    }
}

// Load user preferences
async function loadUserPreferences(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            userDownloads = userData.downloadedResources || [];
            userFavorites = userData.favoriteResources || [];
            
            const downloadCountEl = document.getElementById('downloadCount');
            const favoriteCountEl = document.getElementById('favoriteCount');
            if (downloadCountEl) downloadCountEl.textContent = userDownloads.length;
            if (favoriteCountEl) favoriteCountEl.textContent = userFavorites.length;
            
            const storageMB = (userDownloads.length * 5.2).toFixed(1);
            const storageUsedEl = document.getElementById('storageUsed');
            if (storageUsedEl) storageUsedEl.textContent = `${storageMB} MB`;
        }
    } catch (error) {
        console.error('Error loading user preferences:', error);
    }
}

// Display resources
function displayResources() {
    const gridContainer = document.getElementById('gridView');
    const listContainer = document.getElementById('listViewContainer');
    const emptyState = document.getElementById('emptyState');
    
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const activeCategory = document.querySelector('.category-filter.active')?.dataset.category || 'all';
    const sortBy = document.getElementById('sortBy')?.value || 'latest';
    
    let filtered = [...resources];
    
    if (activeCategory !== 'all') {
        filtered = filtered.filter(resource => resource.category === activeCategory);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(resource => 
            resource.title?.toLowerCase().includes(searchTerm) ||
            resource.description?.toLowerCase().includes(searchTerm) ||
            (resource.tags && resource.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
        );
    }
    
    if (sortBy === 'latest') {
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'popular') {
        filtered.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
    } else if (sortBy === 'title') {
        filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }
    
    if (filtered.length === 0) {
        if (gridContainer) gridContainer.classList.add('hidden');
        const listView = document.getElementById('listView');
        if (listView) listView.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    if (gridContainer) gridContainer.classList.remove('hidden');
    
    // Grid View
    if (gridContainer) {
        gridContainer.innerHTML = filtered.map(resource => {
            const platformIcon = getPlatformIcon(resource.url);
            const isExternal = resource.url?.startsWith('http') || resource.isExternal;
            
            return `
                <div class="resource-card bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition border border-gray-200">
                    <div class="relative h-32 ${getCategoryGradient(resource.category)} p-4">
                        <div class="flex justify-between items-start">
                            <div class="file-icon w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                <i class="fas ${getFileIcon(resource.fileType)} text-white text-2xl"></i>
                            </div>
                            <button onclick="event.stopPropagation(); window.toggleFavorite('${resource.id}')" 
                                    class="favorite-btn ${userFavorites.includes(resource.id) ? 'text-red-500' : 'text-white'} hover:scale-110 transition">
                                <i class="fas fa-heart text-xl"></i>
                            </button>
                        </div>
                        <div class="absolute bottom-4 left-4 right-4">
                            <div class="flex items-center justify-between">
                                <span class="text-white text-xs font-medium bg-black/30 px-2 py-1 rounded-full">
                                    <i class="fas ${platformIcon} mr-1"></i> ${getPlatformName(resource.url)}
                                </span>
                                <span class="text-white text-xs font-medium bg-black/30 px-2 py-1 rounded-full">
                                    ${formatFileSize(resource.fileSize)}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="p-4">
                        <h3 class="font-semibold text-gray-800 mb-1 line-clamp-1">${escapeHtml(resource.title)}</h3>
                        <p class="text-sm text-gray-600 line-clamp-2 mb-3">${escapeHtml(resource.description || 'No description available')}</p>
                        <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center space-x-2 text-xs text-gray-500">
                                <i class="fas fa-download"></i>
                                <span>${resource.downloads || 0}</span>
                                <i class="fas fa-eye ml-2"></i>
                                <span>${resource.views || 0}</span>
                            </div>
                            <span class="text-xs text-gray-400">${formatDate(resource.createdAt)}</span>
                        </div>
                        <div class="flex space-x-2">
                            <button onclick="window.previewResource('${resource.id}')" 
                                    class="flex-1 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition">
                                <i class="fas fa-eye mr-1"></i> Preview
                            </button>
                            <button onclick="window.accessResource('${resource.id}')" 
                                    class="flex-1 py-2 text-sm bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42] transition">
                                <i class="fas ${isExternal ? 'fa-external-link-alt' : 'fa-download'} mr-1"></i> 
                                ${isExternal ? 'Open Link' : 'Download'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // List View
    const listViewContainer = document.getElementById('listViewContainer');
    if (listViewContainer) {
        listViewContainer.innerHTML = filtered.map(resource => {
            const platformIcon = getPlatformIcon(resource.url);
            const isExternal = resource.url?.startsWith('http') || resource.isExternal;
            
            return `
                <div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                    <div class="flex items-center justify-between flex-wrap gap-4">
                        <div class="flex items-center space-x-4 flex-1">
                            <div class="w-12 h-12 ${getCategoryBg(resource.category)} rounded-lg flex items-center justify-center">
                                <i class="fas ${getFileIcon(resource.fileType)} text-white text-xl"></i>
                            </div>
                            <div class="flex-1">
                                <h3 class="font-semibold text-gray-800">${escapeHtml(resource.title)}</h3>
                                <p class="text-sm text-gray-600 line-clamp-1">${escapeHtml(resource.description || 'No description')}</p>
                                <div class="flex items-center space-x-3 mt-1 text-xs text-gray-500">
                                    <span><i class="fas ${platformIcon} mr-1"></i>${getPlatformName(resource.url)}</span>
                                    <span><i class="fas fa-download mr-1"></i>${resource.downloads || 0}</span>
                                    <span><i class="fas fa-eye mr-1"></i>${resource.views || 0}</span>
                                    <span>${formatFileSize(resource.fileSize)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button onclick="window.toggleFavorite('${resource.id}')" 
                                    class="favorite-btn ${userFavorites.includes(resource.id) ? 'text-red-500' : 'text-gray-400'} px-3 py-1 rounded-lg hover:bg-gray-100">
                                <i class="fas fa-heart"></i>
                            </button>
                            <button onclick="window.previewResource('${resource.id}')" 
                                    class="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button onclick="window.accessResource('${resource.id}')" 
                                    class="px-3 py-1 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42] transition">
                                <i class="fas ${isExternal ? 'fa-external-link-alt' : 'fa-download'} mr-1"></i> 
                                ${isExternal ? 'Open' : 'Download'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Access resource (handle external links and downloads)
window.accessResource = async (resourceId) => {
    const resource = resources.find(r => r.id === resourceId);
    if (!resource) return;
    
    const isExternal = resource.url?.startsWith('http') || resource.isExternal;
    
    try {
        const btn = event.target.closest('button');
        const originalText = btn?.innerHTML;
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Loading...';
            btn.disabled = true;
        }
        
        // Increment view count
        await incrementViews(resourceId);
        
        if (isExternal) {
            // For external links, open in new tab
            window.open(resource.url, '_blank');
            showToast('Opening external resource...', 'info');
        } else {
            // For file downloads, simulate download
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const link = document.createElement('a');
            link.href = resource.url || '#';
            link.download = resource.fileName || `${resource.title}.${resource.fileType}`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Update download count
            await incrementDownloads(resourceId);
            
            // Add to user downloads
            if (!userDownloads.includes(resourceId)) {
                const userRef = doc(db, 'users', currentUser.uid);
                await updateDoc(userRef, {
                    downloadedResources: arrayUnion(resourceId)
                });
                userDownloads.push(resourceId);
                const downloadCountEl = document.getElementById('downloadCount');
                if (downloadCountEl) downloadCountEl.textContent = userDownloads.length;
                
                const storageMB = (userDownloads.length * 5.2).toFixed(1);
                const storageUsedEl = document.getElementById('storageUsed');
                if (storageUsedEl) storageUsedEl.textContent = `${storageMB} MB`;
            }
            
            showToast('Download started!', 'success');
        }
        
        // Refresh display to update counts
        await loadResources();
        
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
        
    } catch (error) {
        console.error('Error accessing resource:', error);
        showToast('Failed to access resource. Please try again.', 'error');
        const btn = event.target.closest('button');
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
};

// Preview resource
window.previewResource = async (resourceId) => {
    const resource = resources.find(r => r.id === resourceId);
    if (!resource) return;
    
    const modal = document.getElementById('previewModal');
    const title = document.getElementById('previewTitle');
    const content = document.getElementById('previewContent');
    
    if (!modal || !title || !content) return;
    
    title.textContent = resource.title;
    
    // Increment view count
    await incrementViews(resourceId);
    
    const isExternal = resource.url?.startsWith('http') || resource.isExternal;
    const platform = getPlatformName(resource.url);
    const platformIcon = getPlatformIcon(resource.url);
    
    // Generate embed HTML based on resource type
    let embedHtml = '';
    if (resource.url?.includes('youtube.com/watch') || resource.url?.includes('youtu.be')) {
        // YouTube embed
        const videoId = resource.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
        if (videoId) {
            embedHtml = `
                <div class="video-embed rounded-lg overflow-hidden mb-4">
                    <iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>
                </div>
            `;
        }
    } else if (resource.url?.includes('drive.google.com')) {
        // Google Drive embed
        const fileId = resource.url.match(/\/d\/([^\/]+)/)?.[1];
        if (fileId) {
            embedHtml = `
                <div class="bg-gray-100 rounded-lg p-4 mb-4 text-center">
                    <i class="fab fa-google-drive text-4xl text-blue-500 mb-2"></i>
                    <p class="text-sm text-gray-600">Google Drive File</p>
                    <a href="${resource.url}" target="_blank" class="inline-block mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
                        <i class="fas fa-external-link-alt mr-2"></i> Open in Google Drive
                    </a>
                </div>
            `;
        }
    } else if (resource.url?.match(/\.(pdf)$/i)) {
        // PDF preview
        embedHtml = `
            <div class="bg-gray-100 rounded-lg p-4 mb-4">
                <iframe src="${resource.url}" class="w-full h-96 rounded-lg" frameborder="0"></iframe>
            </div>
        `;
    }
    
    content.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div class="flex items-center space-x-3">
                    <div class="w-12 h-12 ${getCategoryBg(resource.category)} rounded-lg flex items-center justify-center">
                        <i class="fas ${getFileIcon(resource.fileType)} text-white text-2xl"></i>
                    </div>
                    <div>
                        <h3 class="font-semibold text-gray-800">${escapeHtml(resource.title)}</h3>
                        <p class="text-sm text-gray-500">${formatFileSize(resource.fileSize)} • ${resource.fileType?.toUpperCase() || 'Resource'}</p>
                        <p class="text-xs text-gray-400 mt-1"><i class="fas ${platformIcon} mr-1"></i>${platform}</p>
                    </div>
                </div>
                <button onclick="window.accessResource('${resource.id}')" 
                        class="px-4 py-2 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42] transition">
                    <i class="fas ${isExternal ? 'fa-external-link-alt' : 'fa-download'} mr-2"></i> 
                    ${isExternal ? 'Open Resource' : 'Download'}
                </button>
            </div>
            
            ${embedHtml}
            
            <div class="prose max-w-none">
                <h4 class="font-semibold text-gray-800">Description</h4>
                <p class="text-gray-600">${escapeHtml(resource.description) || 'No description available.'}</p>
            </div>
            
            ${resource.tags && resource.tags.length > 0 ? `
                <div>
                    <h4 class="font-semibold text-gray-800 mb-2">Tags</h4>
                    <div class="flex flex-wrap gap-2">
                        ${resource.tags.map(tag => `
                            <span class="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">${escapeHtml(tag)}</span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div class="border-t border-gray-200 pt-4">
                <h4 class="font-semibold text-gray-800 mb-2">Resource Details</h4>
                <div class="grid grid-cols-2 gap-2 text-sm">
                    <div class="text-gray-500">Category:</div>
                    <div class="text-gray-700 capitalize">${resource.category}</div>
                    <div class="text-gray-500">Platform:</div>
                    <div class="text-gray-700">${platform}</div>
                    <div class="text-gray-500">File Type:</div>
                    <div class="text-gray-700">${resource.fileType?.toUpperCase() || 'External Link'}</div>
                    <div class="text-gray-500">Accesses:</div>
                    <div class="text-gray-700">${resource.downloads || 0}</div>
                    <div class="text-gray-500">Views:</div>
                    <div class="text-gray-700">${resource.views || 0}</div>
                    <div class="text-gray-500">Added:</div>
                    <div class="text-gray-700">${formatDate(resource.createdAt)}</div>
                </div>
            </div>
            
            <div class="bg-blue-50 rounded-lg p-4">
                <div class="flex items-start space-x-3">
                    <i class="fas fa-info-circle text-blue-500 mt-1"></i>
                    <div class="text-sm text-blue-800">
                        <p class="font-medium">Resource Information</p>
                        <p>${isExternal ? 'This is an external resource. Click the button above to access it in a new tab.' : 'This resource is available for download. Click the download button to save it to your device.'}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
};

// Toggle favorite
window.toggleFavorite = async (resourceId) => {
    const isFavorite = userFavorites.includes(resourceId);
    const userRef = doc(db, 'users', currentUser.uid);
    
    try {
        if (isFavorite) {
            await updateDoc(userRef, {
                favoriteResources: arrayRemove(resourceId)
            });
            userFavorites = userFavorites.filter(id => id !== resourceId);
            showToast('Removed from favorites', 'info');
        } else {
            await updateDoc(userRef, {
                favoriteResources: arrayUnion(resourceId)
            });
            userFavorites.push(resourceId);
            showToast('Added to favorites', 'success');
        }
        
        const favoriteCountEl = document.getElementById('favoriteCount');
        if (favoriteCountEl) favoriteCountEl.textContent = userFavorites.length;
        
        displayResources();
        
    } catch (error) {
        console.error('Error toggling favorite:', error);
        showToast('Failed to update favorites', 'error');
    }
};

// Increment download count
async function incrementDownloads(resourceId) {
    try {
        const resourceRef = doc(db, 'resources', resourceId);
        await updateDoc(resourceRef, {
            downloads: increment(1)
        });
    } catch (error) {
        console.error('Error incrementing downloads:', error);
    }
}

// Increment view count
async function incrementViews(resourceId) {
    try {
        const resourceRef = doc(db, 'resources', resourceId);
        await updateDoc(resourceRef, {
            views: increment(1)
        });
    } catch (error) {
        console.error('Error incrementing views:', error);
    }
}

// Get platform icon
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
    if (!url) return 'External Link';
    if (url.includes('drive.google.com')) return 'Google Drive';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
    if (url.includes('vimeo.com')) return 'Vimeo';
    if (url.includes('dropbox.com')) return 'Dropbox';
    if (url.includes('github.com')) return 'GitHub';
    if (url.includes('docs.google.com')) return 'Google Docs';
    return 'External Link';
}

// Get category gradient
function getCategoryGradient(category) {
    const gradients = {
        documents: 'bg-gradient-to-r from-blue-500 to-blue-600',
        videos: 'bg-gradient-to-r from-red-500 to-red-600',
        code: 'bg-gradient-to-r from-purple-500 to-purple-600',
        tools: 'bg-gradient-to-r from-orange-500 to-orange-600',
        ebooks: 'bg-gradient-to-r from-green-500 to-green-600',
        external: 'bg-gradient-to-r from-gray-500 to-gray-600'
    };
    return gradients[category] || 'bg-gradient-to-r from-gray-500 to-gray-600';
}

// Get category background
function getCategoryBg(category) {
    const backgrounds = {
        documents: 'bg-blue-500',
        videos: 'bg-red-500',
        code: 'bg-purple-500',
        tools: 'bg-orange-500',
        ebooks: 'bg-green-500',
        external: 'bg-gray-500'
    };
    return backgrounds[category] || 'bg-gray-500';
}

// Get file icon
function getFileIcon(fileType) {
    const icons = {
        pdf: 'fa-file-pdf',
        doc: 'fa-file-word',
        docx: 'fa-file-word',
        xls: 'fa-file-excel',
        xlsx: 'fa-file-excel',
        ppt: 'fa-file-powerpoint',
        pptx: 'fa-file-powerpoint',
        mp4: 'fa-file-video',
        mov: 'fa-file-video',
        zip: 'fa-file-archive',
        rar: 'fa-file-archive',
        js: 'fa-file-code',
        html: 'fa-file-code',
        css: 'fa-file-code',
        py: 'fa-file-code',
        java: 'fa-file-code',
        txt: 'fa-file-alt',
        external: 'fa-link'
    };
    return icons[fileType] || 'fa-file';
}

// Format file size
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

// Format date
function formatDate(date) {
    if (!date) return 'Unknown';
    const d = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString();
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

// Category filter setup
function setupCategoryFilters() {
    const filterBtns = document.querySelectorAll('.category-filter');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active', 'bg-[#1e88e5]', 'text-white'));
            filterBtns.forEach(b => b.classList.add('bg-gray-100', 'text-gray-700'));
            btn.classList.add('active', 'bg-[#1e88e5]', 'text-white');
            btn.classList.remove('bg-gray-100', 'text-gray-700');
            displayResources();
        });
    });
}

// Sort setup
function setupSort() {
    const sortSelect = document.getElementById('sortBy');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            displayResources();
        });
    }
}

// View toggle setup
function setupViewToggle() {
    const gridViewBtn = document.getElementById('gridViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    const gridView = document.getElementById('gridView');
    const listView = document.getElementById('listView');
    
    if (!gridViewBtn || !listViewBtn || !gridView || !listView) return;
    
    gridViewBtn.addEventListener('click', () => {
        gridView.classList.remove('hidden');
        listView.classList.add('hidden');
        gridViewBtn.classList.add('bg-[#1e88e5]', 'text-white');
        gridViewBtn.classList.remove('bg-gray-100', 'text-gray-600');
        listViewBtn.classList.remove('bg-[#1e88e5]', 'text-white');
        listViewBtn.classList.add('bg-gray-100', 'text-gray-600');
    });
    
    listViewBtn.addEventListener('click', () => {
        gridView.classList.add('hidden');
        listView.classList.remove('hidden');
        listViewBtn.classList.add('bg-[#1e88e5]', 'text-white');
        listViewBtn.classList.remove('bg-gray-100', 'text-gray-600');
        gridViewBtn.classList.remove('bg-[#1e88e5]', 'text-white');
        gridViewBtn.classList.add('bg-gray-100', 'text-gray-600');
    });
}

// Display empty state
function displayEmptyState() {
    const gridView = document.getElementById('gridView');
    const listView = document.getElementById('listView');
    const emptyState = document.getElementById('emptyState');
    
    if (gridView) gridView.classList.add('hidden');
    if (listView) listView.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
}

// Toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in ${
        type === 'success' ? 'bg-green-500 text-white' : 
        type === 'error' ? 'bg-red-500 text-white' : 
        'bg-blue-500 text-white'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
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

// Modal setup
function setupModal() {
    const closePreviewBtn = document.getElementById('closePreviewBtn');
    const previewModal = document.getElementById('previewModal');
    
    if (closePreviewBtn) {
        closePreviewBtn.addEventListener('click', () => {
            if (previewModal) previewModal.classList.add('hidden');
        });
    }
    
    if (previewModal) {
        previewModal.addEventListener('click', (e) => {
            if (e.target === previewModal) {
                previewModal.classList.add('hidden');
            }
        });
    }
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupCategoryFilters();
    setupSort();
    setupViewToggle();
    setupModal();
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            displayResources();
        });
    }
    
    // Logout handlers
    const logoutBtns = document.querySelectorAll('#logoutBtn, #sidebarLogoutBtn, #logoutDropdown');
    logoutBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                logout();
            });
        }
    });
});

// Make functions available globally
window.previewResource = previewResource;
window.accessResource = accessResource;
window.toggleFavorite = toggleFavorite;

// Add animation style
const style = document.createElement('style');
style.textContent = `
    @keyframes fade-in {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    .animate-fade-in {
        animation: fade-in 0.3s ease;
    }
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