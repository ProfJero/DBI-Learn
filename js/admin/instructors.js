import { 
    auth, signOut, db, doc, getDoc, getDocs, updateDoc, deleteDoc,
    collection, query, where, onAuthStateChanged
} from '../firebase-config.js';

let currentAdmin = null;
let allInstructors = [];
let filteredInstructors = [];
let currentPage = 1;
const itemsPerPage = 9;
let currentStatus = 'all';
let searchTerm = '';

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '../../login.html'; return; }
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && (userDoc.data().role === 'admin' || userDoc.data().role === 'super_admin')) {
        currentAdmin = user;
        await loadAdminData(user.uid);
        await loadInstructors();
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

// Load instructors
async function loadInstructors() {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', 'instructor'));
    const snapshot = await getDocs(q);
    
    allInstructors = [];
    snapshot.forEach(doc => {
        allInstructors.push({ id: doc.id, ...doc.data() });
    });
    
    // Load course counts for each instructor
    for (let instructor of allInstructors) {
        const coursesRef = collection(db, 'courses');
        const qCourses = query(coursesRef, where('instructorId', '==', instructor.id));
        const coursesSnap = await getDocs(qCourses);
        instructor.courseCount = coursesSnap.size;
        
        // Get total student enrollments
        let totalEnrollments = 0;
        for (const course of coursesSnap.docs) {
            const enrollmentsRef = collection(db, 'enrollments');
            const qEnroll = query(enrollmentsRef, where('courseId', '==', course.id));
            const enrollSnap = await getDocs(qEnroll);
            totalEnrollments += enrollSnap.size;
        }
        instructor.totalStudents = totalEnrollments;
    }
    
    // Sort by join date (newest first)
    allInstructors.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Update stats
    updateStats();
    
    applyFilters();
}

// Update statistics
function updateStats() {
    const total = allInstructors.length;
    const active = allInstructors.filter(i => i.status === 'active').length;
    const pending = allInstructors.filter(i => i.status === 'pending').length;
    const totalCourses = allInstructors.reduce((sum, i) => sum + (i.courseCount || 0), 0);
    
    document.getElementById('totalInstructors').textContent = total;
    document.getElementById('activeInstructors').textContent = active;
    document.getElementById('pendingInstructors').textContent = pending;
    document.getElementById('totalCoursesByInstructors').textContent = totalCourses;
    document.getElementById('pendingCount').textContent = pending;
}

// Apply filters
function applyFilters() {
    filteredInstructors = [...allInstructors];
    if (currentStatus !== 'all') {
        filteredInstructors = filteredInstructors.filter(i => i.status === currentStatus);
    }
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredInstructors = filteredInstructors.filter(i => 
            i.fullName?.toLowerCase().includes(term) ||
            i.email?.toLowerCase().includes(term) ||
            i.username?.toLowerCase().includes(term)
        );
    }
    updatePagination();
    displayInstructors();
}

// Display instructors
function displayInstructors() {
    const container = document.getElementById('instructorsGrid');
    const start = (currentPage - 1) * itemsPerPage;
    const pageInstructors = filteredInstructors.slice(start, start + itemsPerPage);
    
    if (pageInstructors.length === 0) {
        container.innerHTML = `<div class="col-span-3 text-center py-12"><i class="fas fa-chalkboard-teacher text-4xl text-gray-300 mb-3"></i><p class="text-gray-500">No instructors found</p></div>`;
        return;
    }
    
    container.innerHTML = pageInstructors.map(instructor => `
        <div class="instructor-card bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition">
            <div class="relative h-24 bg-gradient-to-r from-[#1e88e5] to-[#00c853] flex items-center justify-center">
                <div class="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
                    <img src="https://ui-avatars.com/api/?background=fff&color=1e88e5&bold=true&size=80&name=${encodeURIComponent(instructor.fullName || 'Instructor')}" 
                         class="w-24 h-24 rounded-full border-4 border-white shadow-lg">
                </div>
                <span class="absolute top-2 right-2 status-${instructor.status || 'pending'} text-xs px-2 py-1 rounded-full capitalize">${instructor.status || 'pending'}</span>
            </div>
            <div class="pt-14 pb-4 px-4 text-center">
                <h3 class="font-semibold text-gray-800">${instructor.fullName || 'Unnamed'}</h3>
                <p class="text-xs text-gray-500 mb-2">@${instructor.username || 'username'}</p>
                <p class="text-sm text-gray-600 mb-3">${instructor.email || 'No email'}</p>
                <div class="flex items-center justify-center space-x-4 mb-3 text-sm">
                    <div class="text-center">
                        <p class="font-bold text-gray-800">${instructor.courseCount || 0}</p>
                        <p class="text-xs text-gray-500">Courses</p>
                    </div>
                    <div class="w-px h-8 bg-gray-200"></div>
                    <div class="text-center">
                        <p class="font-bold text-gray-800">${instructor.totalStudents || 0}</p>
                        <p class="text-xs text-gray-500">Students</p>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2 justify-center mb-3">
                    ${instructor.interests?.slice(0, 3).map(interest => 
                        `<span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">${interest}</span>`
                    ).join('') || '<span class="text-xs text-gray-400">No interests</span>'}
                </div>
                <div class="flex space-x-2">
                    <button onclick="window.viewInstructor('${instructor.id}')" class="flex-1 py-2 text-sm border border-[#1e88e5] text-[#1e88e5] rounded-lg hover:bg-[#1e88e5] hover:text-white transition">
                        <i class="fas fa-eye mr-1"></i> View
                    </button>
                    ${instructor.status === 'pending' ? `
                        <button onclick="window.approveInstructor('${instructor.id}')" class="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
                            <i class="fas fa-check"></i>
                        </button>
                        <button onclick="window.rejectInstructor('${instructor.id}')" class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : `
                        <button onclick="window.toggleStatus('${instructor.id}', '${instructor.status}')" class="flex-1 py-2 text-sm border border-orange-500 text-orange-500 rounded-lg hover:bg-orange-500 hover:text-white transition">
                            <i class="fas ${instructor.status === 'active' ? 'fa-ban' : 'fa-play'} mr-1"></i> ${instructor.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                        <button onclick="window.deleteInstructor('${instructor.id}', '${instructor.fullName}')" class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
                            <i class="fas fa-trash"></i>
                        </button>
                    `}
                </div>
            </div>
        </div>
    `).join('');
}

// View instructor details
window.viewInstructor = async (instructorId) => {
    const instructor = allInstructors.find(i => i.id === instructorId);
    if (!instructor) return;
    
    const modal = document.getElementById('instructorModal');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalContent');
    
    title.textContent = `${instructor.fullName || 'Instructor'} - Profile`;
    
    // Load instructor's courses
    const coursesRef = collection(db, 'courses');
    const q = query(coursesRef, where('instructorId', '==', instructorId));
    const coursesSnap = await getDocs(q);
    const courses = [];
    coursesSnap.forEach(doc => courses.push({ id: doc.id, ...doc.data() }));
    
    content.innerHTML = `
        <div class="flex items-center space-x-4 mb-6 pb-4 border-b border-gray-200">
            <img src="https://ui-avatars.com/api/?background=1e88e5&color=fff&bold=true&size=80&name=${encodeURIComponent(instructor.fullName || 'Instructor')}" 
                 class="w-20 h-20 rounded-full border-2 border-[#1e88e5]">
            <div>
                <h3 class="text-xl font-bold text-gray-800">${instructor.fullName || 'Unnamed'}</h3>
                <p class="text-gray-500">@${instructor.username || 'username'}</p>
                <p class="text-sm text-gray-600">${instructor.email || 'No email'}</p>
                <span class="status-${instructor.status || 'pending'} text-xs px-2 py-1 rounded-full capitalize mt-2 inline-block">${instructor.status || 'pending'}</span>
            </div>
        </div>
        
        <div class="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div class="text-center">
                <p class="text-2xl font-bold text-[#1e88e5]">${instructor.courseCount || 0}</p>
                <p class="text-xs text-gray-500">Courses Created</p>
            </div>
            <div class="text-center">
                <p class="text-2xl font-bold text-[#1e88e5]">${instructor.totalStudents || 0}</p>
                <p class="text-xs text-gray-500">Total Students</p>
            </div>
            <div class="text-center">
                <p class="text-2xl font-bold text-[#1e88e5]">${new Date(instructor.createdAt).toLocaleDateString()}</p>
                <p class="text-xs text-gray-500">Joined</p>
            </div>
        </div>
        
        <div class="mb-6">
            <h4 class="font-semibold text-gray-800 mb-2">About</h4>
            <p class="text-gray-600">${instructor.bio || 'No bio provided.'}</p>
        </div>
        
        <div class="mb-6">
            <h4 class="font-semibold text-gray-800 mb-2">Contact Information</h4>
            <div class="space-y-2">
                <div class="flex items-center space-x-2"><i class="fas fa-envelope text-gray-400 w-5"></i><span>${instructor.email || 'Not provided'}</span></div>
                <div class="flex items-center space-x-2"><i class="fas fa-phone text-gray-400 w-5"></i><span>${instructor.phone || 'Not provided'}</span></div>
                <div class="flex items-center space-x-2"><i class="fas fa-map-marker-alt text-gray-400 w-5"></i><span>${instructor.location || 'Not provided'}</span></div>
                <div class="flex items-center space-x-2"><i class="fas fa-graduation-cap text-gray-400 w-5"></i><span>${instructor.school || 'Not provided'}</span></div>
            </div>
        </div>
        
        <div class="mb-6">
            <h4 class="font-semibold text-gray-800 mb-2">Skills & Interests</h4>
            <div class="flex flex-wrap gap-2">
                ${instructor.interests?.map(interest => 
                    `<span class="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">${interest}</span>`
                ).join('') || '<span class="text-gray-500">No interests specified</span>'}
            </div>
        </div>
        
        <div>
            <h4 class="font-semibold text-gray-800 mb-3">Courses by ${instructor.fullName?.split(' ')[0]}</h4>
            <div class="space-y-2">
                ${courses.length === 0 ? '<p class="text-gray-500 text-sm">No courses created yet.</p>' : 
                    courses.map(course => `
                        <div class="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                            <div>
                                <p class="font-medium text-gray-800">${course.title}</p>
                                <p class="text-xs text-gray-500">${course.status || 'draft'} • ${course.enrolledStudents || 0} students</p>
                            </div>
                            <a href="courses.html?edit=${course.id}" class="text-[#1e88e5] text-sm hover:underline">View</a>
                        </div>
                    `).join('')
                }
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
};

// Approve instructor
window.approveInstructor = async (instructorId) => {
    if (!confirm('Approve this instructor application?')) return;
    try {
        const userRef = doc(db, 'users', instructorId);
        await updateDoc(userRef, {
            status: 'active',
            approvedAt: new Date().toISOString(),
            approvedBy: currentAdmin.uid
        });
        showToast('Instructor approved successfully', 'success');
        await loadInstructors();
    } catch (error) {
        console.error('Error approving instructor:', error);
        showToast('Failed to approve instructor', 'error');
    }
};

// Reject instructor
window.rejectInstructor = async (instructorId) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;
    if (!confirm('Reject this instructor application?')) return;
    try {
        const userRef = doc(db, 'users', instructorId);
        await updateDoc(userRef, {
            status: 'rejected',
            rejectionReason: reason,
            rejectedAt: new Date().toISOString(),
            rejectedBy: currentAdmin.uid
        });
        showToast('Instructor application rejected', 'info');
        await loadInstructors();
    } catch (error) {
        console.error('Error rejecting instructor:', error);
        showToast('Failed to reject instructor', 'error');
    }
};

// Toggle instructor status (activate/suspend)
window.toggleStatus = async (instructorId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const action = newStatus === 'active' ? 'activate' : 'suspend';
    if (!confirm(`Are you sure you want to ${action} this instructor?`)) return;
    try {
        const userRef = doc(db, 'users', instructorId);
        await updateDoc(userRef, {
            status: newStatus,
            statusUpdatedAt: new Date().toISOString(),
            statusUpdatedBy: currentAdmin.uid
        });
        showToast(`Instructor ${action}d successfully`, 'success');
        await loadInstructors();
    } catch (error) {
        console.error('Error toggling status:', error);
        showToast('Failed to update status', 'error');
    }
};

// Delete instructor
window.deleteInstructor = async (instructorId, instructorName) => {
    if (!confirm(`WARNING: This will permanently delete instructor "${instructorName}" and all their courses. This action cannot be undone. Are you absolutely sure?`)) return;
    try {
        // Delete all courses by this instructor first
        const coursesRef = collection(db, 'courses');
        const q = query(coursesRef, where('instructorId', '==', instructorId));
        const coursesSnap = await getDocs(q);
        for (const courseDoc of coursesSnap.docs) {
            await deleteDoc(doc(db, 'courses', courseDoc.id));
        }
        // Delete instructor user document
        await deleteDoc(doc(db, 'users', instructorId));
        showToast('Instructor deleted successfully', 'success');
        await loadInstructors();
    } catch (error) {
        console.error('Error deleting instructor:', error);
        showToast('Failed to delete instructor', 'error');
    }
};

// Update pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredInstructors.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, filteredInstructors.length);
    document.getElementById('paginationInfo').textContent = `Showing ${start}-${end} of ${filteredInstructors.length} instructors`;
    document.getElementById('currentPage').textContent = `Page ${currentPage}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages || totalPages === 0;
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
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchTerm = e.target.value;
        currentPage = 1;
        applyFilters();
    });
}

// Pagination
function setupPagination() {
    document.getElementById('prevPage').addEventListener('click', () => { if (currentPage > 1) { currentPage--; displayInstructors(); updatePagination(); } });
    document.getElementById('nextPage').addEventListener('click', () => { if (currentPage < Math.ceil(filteredInstructors.length / itemsPerPage)) { currentPage++; displayInstructors(); updatePagination(); } });
}

// Modal close
function setupModal() {
    const modal = document.getElementById('instructorModal');
    const closeBtn = document.getElementById('closeModalBtn');
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
}

// Load notifications
async function loadNotifications(userId) {
    const snapshot = await getDocs(query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false)));
    document.getElementById('notificationCount').textContent = snapshot.size;
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

async function logout() { await signOut(auth); window.location.href = '../../login.html'; }

document.addEventListener('DOMContentLoaded', () => {
    setupFilters(); setupPagination(); setupModal(); setupSidebar(); setupDropdowns();
    document.querySelectorAll('#logoutBtn, #logoutDropdown').forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); logout(); }));
});

const style = document.createElement('style');
style.textContent = `.animate-fade-in { animation: fadeIn 0.3s ease; } @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`;
document.head.appendChild(style);