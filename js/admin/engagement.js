import { 
    auth, signOut, db, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
    collection, query, where, orderBy, onAuthStateChanged, limit, startAfter
} from '../firebase-config.js';

let currentAdmin = null;
let allComments = [];
let allLikes = [];
let allCourses = [];
let users = [];

// Pagination
let commentsCurrentPage = 1;
const commentsPerPage = 10;

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '../../login.html'; return; }
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && (userDoc.data().role === 'admin' || userDoc.data().role === 'super_admin')) {
        currentAdmin = user;
        await loadAdminData(user.uid);
        await loadUsers();
        await loadCourses();
        await loadAllComments();
        await loadAllLikes();
        await loadNotifications(user.uid);
        setupTabs();
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

// Load users
async function loadUsers() {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    users = [];
    usersSnapshot.forEach(doc => {
        users.push({ id: doc.id, ...doc.data() });
    });
}

// Load courses
async function loadCourses() {
    const coursesSnapshot = await getDocs(collection(db, 'courses'));
    allCourses = [];
    coursesSnapshot.forEach(doc => {
        allCourses.push({ id: doc.id, ...doc.data() });
    });
    
    // Populate course filter
    const courseFilter = document.getElementById('commentCourseFilter');
    if (courseFilter) {
        courseFilter.innerHTML = '<option value="">All Courses</option>' + 
            allCourses.map(c => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('');
        courseFilter.addEventListener('change', () => {
            commentsCurrentPage = 1;
            displayComments();
        });
    }
}

// Load all comments from all courses
async function loadAllComments() {
    try {
        allComments = [];
        
        for (const course of allCourses) {
            try {
                // Get modules for this course
                const modulesRef = collection(db, 'courses', course.id, 'modules');
                const modulesSnapshot = await getDocs(modulesRef);
                
                for (const moduleDoc of modulesSnapshot.docs) {
                    // Get lessons for this module
                    const lessonsRef = collection(db, 'courses', course.id, 'modules', moduleDoc.id, 'lessons');
                    const lessonsSnapshot = await getDocs(lessonsRef);
                    
                    for (const lessonDoc of lessonsSnapshot.docs) {
                        // Get comments for this lesson
                        const commentsRef = collection(db, 'courses', course.id, 'modules', moduleDoc.id, 'lessons', lessonDoc.id, 'comments');
                        const commentsSnapshot = await getDocs(commentsRef);
                        
                        commentsSnapshot.forEach(commentDoc => {
                            const comment = { 
                                id: commentDoc.id, 
                                ...commentDoc.data(),
                                courseId: course.id,
                                courseTitle: course.title,
                                moduleId: moduleDoc.id,
                                moduleTitle: moduleDoc.data().title,
                                lessonId: lessonDoc.id,
                                lessonTitle: lessonDoc.data().title
                            };
                            allComments.push(comment);
                        });
                    }
                }
            } catch (error) {
                console.log(`No comments for course: ${course.title}`);
            }
        }
        
        // Sort by date (newest first)
        allComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        updateStats();
        displayComments();
        
    } catch (error) {
        console.error('Error loading comments:', error);
        showToast('Failed to load comments', 'error');
    }
}

// Load all likes from all courses
async function loadAllLikes() {
    try {
        allLikes = [];
        
        for (const course of allCourses) {
            try {
                const modulesRef = collection(db, 'courses', course.id, 'modules');
                const modulesSnapshot = await getDocs(modulesRef);
                
                for (const moduleDoc of modulesSnapshot.docs) {
                    const lessonsRef = collection(db, 'courses', course.id, 'modules', moduleDoc.id, 'lessons');
                    const lessonsSnapshot = await getDocs(lessonsRef);
                    
                    for (const lessonDoc of lessonsSnapshot.docs) {
                        const likesRef = collection(db, 'courses', course.id, 'modules', moduleDoc.id, 'lessons', lessonDoc.id, 'likes');
                        const likesSnapshot = await getDocs(likesRef);
                        
                        likesSnapshot.forEach(likeDoc => {
                            const like = { 
                                id: likeDoc.id, 
                                ...likeDoc.data(),
                                courseId: course.id,
                                courseTitle: course.title,
                                moduleId: moduleDoc.id,
                                moduleTitle: moduleDoc.data().title,
                                lessonId: lessonDoc.id,
                                lessonTitle: lessonDoc.data().title
                            };
                            allLikes.push(like);
                        });
                    }
                }
            } catch (error) {
                console.log(`No likes for course: ${course.title}`);
            }
        }
        
        displayLikes();
        
    } catch (error) {
        console.error('Error loading likes:', error);
    }
}

// Update statistics
function updateStats() {
    const totalComments = allComments.length;
    const totalLikes = allLikes.length;
    
    // Calculate active discussions (lessons with 5+ comments)
    const lessonCommentCount = {};
    allComments.forEach(comment => {
        const key = `${comment.courseId}_${comment.lessonId}`;
        lessonCommentCount[key] = (lessonCommentCount[key] || 0) + 1;
    });
    const activeDiscussions = Object.values(lessonCommentCount).filter(count => count >= 5).length;
    
    // Pending replies (comments without admin replies)
    const commentsWithoutAdminReply = allComments.filter(comment => {
        return !comment.adminReply && !comment.replies?.some(r => r.authorId === currentAdmin.uid);
    }).length;
    
    document.getElementById('totalComments').textContent = totalComments;
    document.getElementById('totalLikes').textContent = totalLikes;
    document.getElementById('activeDiscussions').textContent = activeDiscussions;
    document.getElementById('pendingReplies').textContent = commentsWithoutAdminReply;
    document.getElementById('pendingRepliesCount').textContent = commentsWithoutAdminReply;
}

// Display comments
function displayComments() {
    const container = document.getElementById('commentsList');
    const searchTerm = document.getElementById('commentSearch')?.value.toLowerCase() || '';
    const courseFilter = document.getElementById('commentCourseFilter')?.value || '';
    
    let filtered = [...allComments];
    
    if (searchTerm) {
        filtered = filtered.filter(c => 
            c.text?.toLowerCase().includes(searchTerm) ||
            getUserName(c.userId)?.toLowerCase().includes(searchTerm)
        );
    }
    
    if (courseFilter) {
        filtered = filtered.filter(c => c.courseId === courseFilter);
    }
    
    const start = (commentsCurrentPage - 1) * commentsPerPage;
    const pageComments = filtered.slice(start, start + commentsPerPage);
    const totalPages = Math.ceil(filtered.length / commentsPerPage);
    
    if (pageComments.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 bg-white rounded-xl">
                <i class="fas fa-comment-slash text-5xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No comments found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = pageComments.map(comment => {
        const user = users.find(u => u.id === comment.userId);
        const hasAdminReply = comment.adminReply || comment.replies?.some(r => r.authorId === currentAdmin.uid);
        
        return `
            <div class="comment-card bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-3 mb-3">
                            <img src="https://ui-avatars.com/api/?background=1e88e5&color=fff&size=32&name=${encodeURIComponent(user?.fullName || 'User')}" class="w-8 h-8 rounded-full">
                            <div>
                                <p class="font-semibold text-gray-800">${escapeHtml(user?.fullName || 'Unknown User')}</p>
                                <p class="text-xs text-gray-500">${formatDate(comment.createdAt)}</p>
                            </div>
                        </div>
                        <p class="text-gray-700 mb-3">${escapeHtml(comment.text)}</p>
                        <div class="flex items-center space-x-3 text-xs text-gray-500">
                            <span><i class="fas fa-book mr-1"></i>${escapeHtml(comment.courseTitle)}</span>
                            <span><i class="fas fa-layer-group mr-1"></i>${escapeHtml(comment.moduleTitle)}</span>
                            <span><i class="fas fa-video mr-1"></i>${escapeHtml(comment.lessonTitle)}</span>
                        </div>
                        ${hasAdminReply ? `
                            <div class="mt-3 p-3 bg-green-50 rounded-lg">
                                <p class="text-xs text-green-600 font-medium mb-1">
                                    <i class="fas fa-check-circle mr-1"></i> Admin Response:
                                </p>
                                <p class="text-sm text-gray-700">${escapeHtml(comment.adminReply || comment.replies?.find(r => r.authorId === currentAdmin.uid)?.message)}</p>
                            </div>
                        ` : ''}
                    </div>
                    <div class="ml-4">
                        ${!hasAdminReply ? `
                            <button onclick="window.replyToComment('${comment.id}', '${comment.courseId}', '${comment.moduleId}', '${comment.lessonId}')" 
                                    class="px-3 py-1 bg-[#1e88e5] text-white rounded-lg text-sm hover:bg-[#009e42] transition">
                                <i class="fas fa-reply mr-1"></i> Reply
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Update pagination
    document.getElementById('commentsPaginationInfo').textContent = `Showing ${start + 1}-${Math.min(start + commentsPerPage, filtered.length)} of ${filtered.length} comments`;
    document.getElementById('commentsCurrentPage').textContent = `Page ${commentsCurrentPage}`;
    document.getElementById('commentsPrevPage').disabled = commentsCurrentPage === 1;
    document.getElementById('commentsNextPage').disabled = commentsCurrentPage === totalPages || totalPages === 0;
}

// Display likes
function displayLikes() {
    const tbody = document.getElementById('likesTable');
    
    // Group likes by lesson
    const lessonLikes = {};
    allLikes.forEach(like => {
        const key = `${like.courseId}_${like.lessonId}`;
        if (!lessonLikes[key]) {
            lessonLikes[key] = {
                courseTitle: like.courseTitle,
                lessonTitle: like.lessonTitle,
                likes: 0,
                courseId: like.courseId,
                lessonId: like.lessonId
            };
        }
        lessonLikes[key].likes++;
    });
    
    const sortedLessons = Object.values(lessonLikes).sort((a, b) => b.likes - a.likes);
    
    if (sortedLessons.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-500">No likes data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = sortedLessons.map(lesson => `
        <tr class="border-b border-gray-100 hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-600">Lesson</td>
            <td class="px-4 py-3 font-medium text-gray-800">${escapeHtml(lesson.lessonTitle)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(lesson.courseTitle)}</td>
            <td class="px-4 py-3">
                <span class="inline-flex items-center px-2 py-1 bg-red-100 text-red-600 rounded-full text-sm">
                    <i class="fas fa-heart mr-1"></i> ${lesson.likes}
                </span>
             </td>
            <td class="px-4 py-3">
                <button onclick="window.viewLessonLikes('${lesson.courseId}', '${lesson.lessonId}')" 
                        class="text-[#1e88e5] hover:text-[#009e42] text-sm">
                    <i class="fas fa-eye mr-1"></i> View Details
                </button>
             </td>
         </tr>
    `).join('');
}

// View lesson likes details
window.viewLessonLikes = (courseId, lessonId) => {
    const lessonLikes = allLikes.filter(l => l.courseId === courseId && l.lessonId === lessonId);
    const course = allCourses.find(c => c.id === courseId);
    const lesson = lessonLikes[0];
    
    const modal = document.getElementById('replyModal');
    const originalCommentDiv = document.getElementById('originalComment');
    
    modal.querySelector('h2').innerHTML = `<i class="fas fa-heart text-[#1e88e5] mr-2"></i> Likes for ${lesson?.lessonTitle || 'Lesson'}`;
    
    originalCommentDiv.innerHTML = `
        <div class="space-y-3 max-h-96 overflow-y-auto">
            <p class="text-sm text-gray-600 mb-2">Students who liked this lesson:</p>
            ${lessonLikes.map(like => {
                const user = users.find(u => u.id === like.userId);
                return `
                    <div class="flex items-center space-x-3 p-2 bg-white rounded-lg border border-gray-200">
                        <img src="https://ui-avatars.com/api/?background=1e88e5&color=fff&size=32&name=${encodeURIComponent(user?.fullName || 'User')}" class="w-8 h-8 rounded-full">
                        <div>
                            <p class="font-medium text-gray-800">${escapeHtml(user?.fullName || 'Unknown User')}</p>
                            <p class="text-xs text-gray-500">${formatDate(like.createdAt)}</p>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    document.getElementById('replyText').style.display = 'none';
    document.querySelector('#replyModal .flex.justify-end').style.display = 'none';
    
    modal.classList.remove('hidden');
};

// Reply to comment
window.replyToComment = (commentId, courseId, moduleId, lessonId) => {
    const comment = allComments.find(c => c.id === commentId);
    if (!comment) return;
    
    const user = users.find(u => u.id === comment.userId);
    const modal = document.getElementById('replyModal');
    const originalCommentDiv = document.getElementById('originalComment');
    const replyText = document.getElementById('replyText');
    const submitBtn = document.getElementById('submitReplyBtn');
    const cancelBtn = document.getElementById('cancelReplyBtn');
    
    originalCommentDiv.innerHTML = `
        <div class="flex items-start space-x-3">
            <img src="https://ui-avatars.com/api/?background=1e88e5&color=fff&size=32&name=${encodeURIComponent(user?.fullName || 'User')}" class="w-8 h-8 rounded-full">
            <div class="flex-1">
                <p class="font-medium text-gray-800">${escapeHtml(user?.fullName || 'Unknown User')}</p>
                <p class="text-xs text-gray-500 mb-2">${formatDate(comment.createdAt)}</p>
                <p class="text-gray-700">${escapeHtml(comment.text)}</p>
                <div class="mt-2 text-xs text-gray-500">
                    <span>Course: ${escapeHtml(comment.courseTitle)}</span> • 
                    <span>Module: ${escapeHtml(comment.moduleTitle)}</span> • 
                    <span>Lesson: ${escapeHtml(comment.lessonTitle)}</span>
                </div>
            </div>
        </div>
    `;
    
    replyText.value = '';
    replyText.style.display = 'block';
    document.querySelector('#replyModal .flex.justify-end').style.display = 'flex';
    
    const handleSubmit = async () => {
        const replyMessage = replyText.value.trim();
        if (!replyMessage) {
            showToast('Please enter a reply', 'error');
            return;
        }
        
        try {
            const replyData = {
                message: replyMessage,
                authorId: currentAdmin.uid,
                authorName: document.getElementById('adminName').textContent,
                createdAt: new Date().toISOString(),
                isAdmin: true
            };
            
            // Update the comment with admin reply
            const commentRef = doc(db, 'courses', courseId, 'modules', moduleId, 'lessons', lessonId, 'comments', commentId);
            await updateDoc(commentRef, {
                adminReply: replyMessage,
                adminReplyAt: new Date().toISOString(),
                adminRepliedBy: currentAdmin.uid,
                replies: arrayUnion(replyData)
            });
            
            // Update local data
            comment.adminReply = replyMessage;
            if (!comment.replies) comment.replies = [];
            comment.replies.push(replyData);
            
            showToast('Reply sent successfully', 'success');
            modal.classList.add('hidden');
            
            // Refresh display
            updateStats();
            displayComments();
            
        } catch (error) {
            console.error('Error sending reply:', error);
            showToast('Failed to send reply', 'error');
        }
        
        cleanup();
    };
    
    const cleanup = () => {
        submitBtn.removeEventListener('click', handleSubmit);
        cancelBtn.removeEventListener('click', cleanup);
        document.getElementById('closeReplyModal').removeEventListener('click', cleanup);
    };
    
    submitBtn.addEventListener('click', handleSubmit);
    cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('closeReplyModal').addEventListener('click', () => modal.classList.add('hidden'));
    
    modal.classList.remove('hidden');
};

// Display active discussions
function displayActiveDiscussions() {
    const container = document.getElementById('discussionsList');
    
    // Group comments by lesson
    const lessonComments = {};
    allComments.forEach(comment => {
        const key = `${comment.courseId}_${comment.lessonId}`;
        if (!lessonComments[key]) {
            lessonComments[key] = {
                courseId: comment.courseId,
                courseTitle: comment.courseTitle,
                lessonId: comment.lessonId,
                lessonTitle: comment.lessonTitle,
                comments: [],
                lastActivity: comment.createdAt
            };
        }
        lessonComments[key].comments.push(comment);
        if (new Date(comment.createdAt) > new Date(lessonComments[key].lastActivity)) {
            lessonComments[key].lastActivity = comment.createdAt;
        }
    });
    
    // Filter active discussions (5+ comments) and sort by last activity
    const activeDiscussions = Object.values(lessonComments)
        .filter(d => d.comments.length >= 5)
        .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
    
    if (activeDiscussions.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 bg-white rounded-xl">
                <i class="fas fa-comments text-5xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No active discussions at the moment</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = activeDiscussions.map(discussion => `
        <div class="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition">
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <h3 class="font-semibold text-gray-800 mb-2">${escapeHtml(discussion.lessonTitle)}</h3>
                    <p class="text-sm text-gray-600 mb-2">Course: ${escapeHtml(discussion.courseTitle)}</p>
                    <div class="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                        <span><i class="fas fa-comment mr-1"></i> ${discussion.comments.length} comments</span>
                        <span><i class="fas fa-clock mr-1"></i> Last activity: ${formatDate(discussion.lastActivity)}</span>
                    </div>
                    <div class="space-y-2 mt-3 max-h-48 overflow-y-auto">
                        ${discussion.comments.slice(0, 3).map(comment => {
                            const user = users.find(u => u.id === comment.userId);
                            return `
                                <div class="bg-gray-50 rounded-lg p-3">
                                    <div class="flex items-center space-x-2 mb-1">
                                        <img src="https://ui-avatars.com/api/?background=1e88e5&color=fff&size=20&name=${encodeURIComponent(user?.fullName || 'User')}" class="w-5 h-5 rounded-full">
                                        <span class="text-xs font-medium text-gray-800">${escapeHtml(user?.fullName || 'Unknown')}</span>
                                        <span class="text-xs text-gray-400">${formatDate(comment.createdAt)}</span>
                                    </div>
                                    <p class="text-sm text-gray-600">${escapeHtml(comment.text)}</p>
                                </div>
                            `;
                        }).join('')}
                        ${discussion.comments.length > 3 ? `<p class="text-xs text-[#1e88e5] mt-1">+${discussion.comments.length - 3} more comments...</p>` : ''}
                    </div>
                </div>
                <div class="ml-4">
                    <button onclick="window.viewDiscussion('${discussion.courseId}', '${discussion.lessonId}')" 
                            class="px-3 py-1 bg-[#1e88e5] text-white rounded-lg text-sm hover:bg-[#009e42] transition">
                        <i class="fas fa-eye mr-1"></i> View All
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// View full discussion
window.viewDiscussion = (courseId, lessonId) => {
    const discussionComments = allComments.filter(c => c.courseId === courseId && c.lessonId === lessonId);
    const course = allCourses.find(c => c.id === courseId);
    const lesson = discussionComments[0];
    
    const modal = document.getElementById('replyModal');
    const originalCommentDiv = document.getElementById('originalComment');
    
    modal.querySelector('h2').innerHTML = `<i class="fas fa-comments text-[#1e88e5] mr-2"></i> Discussion: ${lesson?.lessonTitle || 'Lesson'}`;
    
    originalCommentDiv.innerHTML = `
        <div class="space-y-3 max-h-96 overflow-y-auto">
            <p class="text-sm text-gray-600 mb-2">All comments (${discussionComments.length}):</p>
            ${discussionComments.map(comment => {
                const user = users.find(u => u.id === comment.userId);
                const hasAdminReply = comment.adminReply || comment.replies?.some(r => r.authorId === currentAdmin.uid);
                return `
                    <div class="border border-gray-200 rounded-lg p-3">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center space-x-2">
                                <img src="https://ui-avatars.com/api/?background=1e88e5&color=fff&size=24&name=${encodeURIComponent(user?.fullName || 'User')}" class="w-6 h-6 rounded-full">
                                <span class="font-medium text-sm text-gray-800">${escapeHtml(user?.fullName || 'Unknown')}</span>
                                <span class="text-xs text-gray-400">${formatDate(comment.createdAt)}</span>
                            </div>
                            ${!hasAdminReply ? `
                                <button onclick="window.replyToComment('${comment.id}', '${comment.courseId}', '${comment.moduleId}', '${comment.lessonId}')" 
                                        class="text-xs text-[#1e88e5] hover:underline">
                                    <i class="fas fa-reply mr-1"></i> Reply
                                </button>
                            ` : ''}
                        </div>
                        <p class="text-sm text-gray-700">${escapeHtml(comment.text)}</p>
                        ${hasAdminReply ? `
                            <div class="mt-2 p-2 bg-green-50 rounded-lg">
                                <p class="text-xs text-green-600 font-medium">
                                    <i class="fas fa-check-circle mr-1"></i> Admin Response:
                                </p>
                                <p class="text-sm text-gray-700">${escapeHtml(comment.adminReply || comment.replies?.find(r => r.authorId === currentAdmin.uid)?.message)}</p>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    document.getElementById('replyText').style.display = 'none';
    document.querySelector('#replyModal .flex.justify-end').style.display = 'none';
    
    modal.classList.remove('hidden');
};

// Get user name by ID
function getUserName(userId) {
    const user = users.find(u => u.id === userId);
    return user?.fullName || 'Unknown User';
}

// Format date
function formatDate(date) {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const diff = now - d;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 24) return `${hours} hours ago`;
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString();
}

// Export comments
document.getElementById('exportCommentsBtn')?.addEventListener('click', () => {
    const searchTerm = document.getElementById('commentSearch')?.value.toLowerCase() || '';
    const courseFilter = document.getElementById('commentCourseFilter')?.value || '';
    
    let filtered = [...allComments];
    
    if (searchTerm) {
        filtered = filtered.filter(c => 
            c.text?.toLowerCase().includes(searchTerm) ||
            getUserName(c.userId)?.toLowerCase().includes(searchTerm)
        );
    }
    
    if (courseFilter) {
        filtered = filtered.filter(c => c.courseId === courseFilter);
    }
    
    const csv = [
        ['Student', 'Course', 'Module', 'Lesson', 'Comment', 'Date', 'Admin Reply'],
        ...filtered.map(comment => {
            const user = users.find(u => u.id === comment.userId);
            return [
                user?.fullName || 'Unknown',
                comment.courseTitle,
                comment.moduleTitle,
                comment.lessonTitle,
                comment.text,
                new Date(comment.createdAt).toLocaleString(),
                comment.adminReply || ''
            ];
        })
    ].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comments_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Comments exported successfully', 'success');
});

// Setup tabs
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = {
        'comments': document.getElementById('commentsTab'),
        'likes': document.getElementById('likesTab'),
        'discussions': document.getElementById('discussionsTab')
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
            
            if (tabId === 'discussions') {
                displayActiveDiscussions();
            }
        });
    });
}

// Search input
document.getElementById('commentSearch')?.addEventListener('input', () => {
    commentsCurrentPage = 1;
    displayComments();
});

// Pagination
document.getElementById('commentsPrevPage')?.addEventListener('click', () => {
    if (commentsCurrentPage > 1) {
        commentsCurrentPage--;
        displayComments();
    }
});

document.getElementById('commentsNextPage')?.addEventListener('click', () => {
    commentsCurrentPage++;
    displayComments();
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
    setupSidebar();
    setupDropdowns();
    document.querySelectorAll('#logoutBtn, #logoutDropdown').forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); logout(); }));
});

// Make functions available globally
window.replyToComment = replyToComment;
window.viewLessonLikes = viewLessonLikes;
window.viewDiscussion = viewDiscussion;

const style = document.createElement('style');
style.textContent = `.animate-fade-in { animation: fadeIn 0.3s ease; } @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`;
document.head.appendChild(style);