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
    addDoc,
    updateDoc,
    deleteDoc,
    onAuthStateChanged,
    orderBy,
    limit,
    startAfter,
    increment,
    arrayUnion,
    arrayRemove,
    Timestamp
} from '../firebase-config.js';

let currentUser = null;
let discussions = [];
let lastDoc = null;
let isLoading = false;
let hasMore = true;
let currentDiscussion = null;
let userStats = {
    totalDiscussions: 0,
    userPosts: 0,
    helpfulAnswers: 0
};
let isAdmin = false;

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../login.html';
        return;
    }
    currentUser = user;
    try {
        await loadUserData(user.uid);
        await checkAdminStatus(user.uid);
        await loadDiscussions();
        await loadUserStats(user.uid);
        await loadNotifications(user.uid);
    } catch (error) {
        console.error('Error initializing page:', error);
        showToast('Failed to load discussions', 'error');
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

// Check if user is admin
async function checkAdminStatus(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const role = userDoc.data().role;
            isAdmin = role === 'admin' || role === 'super_admin';
        }
    } catch (error) {
        console.error('Error checking admin status:', error);
    }
}

// Load user stats
async function loadUserStats(userId) {
    try {
        const discussionsRef = collection(db, 'discussions');
        const q = query(discussionsRef, where('authorId', '==', userId));
        const snapshot = await getDocs(q);
        userStats.userPosts = snapshot.size;
        
        // Count helpful answers
        let helpfulCount = 0;
        for (const discussionDoc of snapshot.docs) {
            try {
                const commentsRef = collection(db, 'discussions', discussionDoc.id, 'comments');
                const commentsSnapshot = await getDocs(query(commentsRef, where('isAnswer', '==', true)));
                helpfulCount += commentsSnapshot.size;
            } catch (e) {
                // No comments collection yet
            }
        }
        userStats.helpfulAnswers = helpfulCount;
        
        const userPostsEl = document.getElementById('userPosts');
        const helpfulAnswersEl = document.getElementById('helpfulAnswers');
        if (userPostsEl) userPostsEl.textContent = userStats.userPosts;
        if (helpfulAnswersEl) helpfulAnswersEl.textContent = userStats.helpfulAnswers;
        
    } catch (error) {
        console.error('Error loading user stats:', error);
        // Don't show error to user, just use defaults
    }
}

// Load discussions
async function loadDiscussions(reset = true) {
    if (isLoading) return;
    isLoading = true;
    
    if (reset) {
        discussions = [];
        lastDoc = null;
        hasMore = true;
        const gridContainer = document.getElementById('discussionsGrid');
        if (gridContainer) {
            gridContainer.innerHTML = '<div class="skeleton h-32 rounded-xl"></div><div class="skeleton h-32 rounded-xl"></div>';
        }
    }
    
    try {
        const activeFilter = document.querySelector('.filter-btn.active');
        const filter = activeFilter?.dataset.filter || 'all';
        const sortSelect = document.getElementById('sortBy');
        const sortBy = sortSelect?.value || 'latest';
        
        let q;
        const discussionsRef = collection(db, 'discussions');
        
        // Build query based on filters and sorting
        if (filter === 'my-posts') {
            q = query(discussionsRef, where('authorId', '==', currentUser.uid), orderBy('createdAt', 'desc'), limit(10));
        } else if (sortBy === 'most-replies') {
            q = query(discussionsRef, orderBy('replyCount', 'desc'), limit(10));
        } else if (sortBy === 'most-liked') {
            q = query(discussionsRef, orderBy('likes', 'desc'), limit(10));
        } else {
            q = query(discussionsRef, orderBy('createdAt', 'desc'), limit(10));
        }
        
        // Pagination
        if (!reset && hasMore && lastDoc) {
            q = query(discussionsRef, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(10));
        }
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty && reset) {
            const gridContainer = document.getElementById('discussionsGrid');
            if (gridContainer) {
                gridContainer.innerHTML = `
                    <div class="text-center py-12 bg-white rounded-xl">
                        <i class="fas fa-comments text-5xl text-gray-300 mb-3"></i>
                        <p class="text-gray-500">No discussions yet</p>
                        <p class="text-sm text-gray-400 mt-1">Be the first to start a discussion!</p>
                        <button onclick="document.getElementById('createDiscussionBtn')?.click()" 
                                class="mt-4 px-4 py-2 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42] transition">
                            Start a Discussion
                        </button>
                    </div>
                `;
            }
            isLoading = false;
            return;
        }
        
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        hasMore = snapshot.docs.length === 10;
        
        const newDiscussions = [];
        for (const docSnapshot of snapshot.docs) {
            const discussion = { id: docSnapshot.id, ...docSnapshot.data() };
            
            // Get author details
            if (discussion.authorId) {
                try {
                    const authorDoc = await getDoc(doc(db, 'users', discussion.authorId));
                    if (authorDoc.exists()) {
                        discussion.author = authorDoc.data();
                    } else {
                        discussion.author = { fullName: 'Deleted User' };
                    }
                } catch (e) {
                    discussion.author = { fullName: 'Unknown User' };
                }
            }
            
            discussion.userLiked = discussion.likedBy?.includes(currentUser.uid) || false;
            newDiscussions.push(discussion);
        }
        
        if (reset) {
            discussions = newDiscussions;
        } else {
            discussions = [...discussions, ...newDiscussions];
        }
        
        displayDiscussions();
        updateStats();
        
        // Show/hide load more button
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        if (loadMoreContainer) {
            if (hasMore && !reset) {
                loadMoreContainer.classList.remove('hidden');
            } else {
                loadMoreContainer.classList.add('hidden');
            }
        }
        
    } catch (error) {
        console.error('Error loading discussions:', error);
        const gridContainer = document.getElementById('discussionsGrid');
        if (gridContainer) {
            if (error.code === 'permission-denied') {
                gridContainer.innerHTML = `
                    <div class="text-center py-12 bg-white rounded-xl">
                        <i class="fas fa-lock text-5xl text-gray-300 mb-3"></i>
                        <p class="text-gray-500">Unable to load discussions</p>
                        <p class="text-sm text-gray-400 mt-1">Please make sure you're logged in properly</p>
                        <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42] transition">
                            Refresh
                        </button>
                    </div>
                `;
            } else {
                gridContainer.innerHTML = `
                    <div class="text-center py-12 bg-white rounded-xl">
                        <i class="fas fa-exclamation-circle text-5xl text-red-300 mb-3"></i>
                        <p class="text-gray-500">Failed to load discussions: ${error.message}</p>
                        <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42] transition">
                            Try Again
                        </button>
                    </div>
                `;
            }
        }
    } finally {
        isLoading = false;
    }
}

// Update statistics
function updateStats() {
    const total = discussions.length;
    const today = new Date().toDateString();
    const activeToday = discussions.filter(d => {
        if (!d.createdAt) return false;
        const date = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
        return date.toDateString() === today;
    }).length;
    
    const totalDiscussionsEl = document.getElementById('totalDiscussions');
    const activeTodayEl = document.getElementById('activeToday');
    if (totalDiscussionsEl) totalDiscussionsEl.textContent = total;
    if (activeTodayEl) activeTodayEl.textContent = activeToday;
}

// Display discussions
function displayDiscussions() {
    const container = document.getElementById('discussionsGrid');
    if (!container) return;
    
    const searchInput = document.getElementById('searchInput');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    const searchTerm = (searchInput?.value.toLowerCase() || mobileSearchInput?.value.toLowerCase() || '');
    const activeFilter = document.querySelector('.filter-btn.active');
    const filter = activeFilter?.dataset.filter || 'all';
    
    let filtered = [...discussions];
    
    // Apply search filter
    if (searchTerm) {
        filtered = filtered.filter(discussion => {
            const titleMatch = discussion.title?.toLowerCase().includes(searchTerm) || false;
            const contentMatch = stripHtml(discussion.content).toLowerCase().includes(searchTerm) || false;
            return titleMatch || contentMatch;
        });
    }
    
    // Apply filter
    if (filter === 'hot') {
        filtered = filtered.filter(d => (d.likes || 0) > 5 || (d.replyCount || 0) > 3);
    } else if (filter === 'unanswered') {
        filtered = filtered.filter(d => (d.replyCount || 0) === 0);
    } else if (filter === 'my-posts') {
        filtered = filtered.filter(d => d.authorId === currentUser.uid);
    } else if (filter === 'solved') {
        filtered = filtered.filter(d => d.hasAnswer === true);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 bg-white rounded-xl">
                <i class="fas fa-comments text-5xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No discussions found</p>
                <p class="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(discussion => `
        <div class="discussion-card bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition cursor-pointer" onclick="window.viewDiscussion('${discussion.id}')">
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <div class="flex items-center space-x-2 mb-2 flex-wrap gap-2">
                        ${discussion.pinned ? '<span class="bg-purple-600 text-white text-xs px-2 py-1 rounded-full"><i class="fas fa-thumbtack mr-1"></i>Pinned</span>' : ''}
                        ${discussion.hasAnswer ? '<span class="bg-green-500 text-white text-xs px-2 py-1 rounded-full"><i class="fas fa-check-circle mr-1"></i>Solved</span>' : ''}
                        ${(discussion.likes || 0) > 10 ? '<span class="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs px-2 py-1 rounded-full"><i class="fas fa-fire mr-1"></i>Hot</span>' : ''}
                        <span class="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded-full">${escapeHtml(discussion.category || 'General')}</span>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">${escapeHtml(discussion.title)}</h3>
                    <p class="text-gray-600 text-sm line-clamp-2 mb-3">${stripHtml(discussion.content).substring(0, 150)}</p>
                    <div class="flex items-center space-x-4 text-sm text-gray-500">
                        <div class="flex items-center space-x-1">
                            <img src="https://ui-avatars.com/api/?background=1e88e5&color=fff&size=24&name=${encodeURIComponent(discussion.author?.fullName || 'User')}" 
                                 class="w-6 h-6 rounded-full">
                            <span>${escapeHtml(discussion.author?.fullName || 'Anonymous')}</span>
                        </div>
                        <div><i class="far fa-clock mr-1"></i>${formatTime(discussion.createdAt)}</div>
                        <div><i class="far fa-comment mr-1"></i>${discussion.replyCount || 0}</div>
                        <div><i class="far fa-heart mr-1"></i>${discussion.likes || 0}</div>
                    </div>
                </div>
                <div class="ml-4">
                    <button onclick="event.stopPropagation(); window.likeDiscussion('${discussion.id}')" 
                            class="reaction-btn ${discussion.userLiked ? 'active' : ''} px-3 py-1 rounded-lg hover:bg-gray-100">
                        <i class="fas fa-heart"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Strip HTML from content
function stripHtml(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

// Format time
function formatTime(timestamp) {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (weeks < 4) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
}

// View discussion detail
window.viewDiscussion = async (discussionId) => {
    const discussion = discussions.find(d => d.id === discussionId);
    if (!discussion) return;
    
    currentDiscussion = discussion;
    
    const modal = document.getElementById('discussionDetailModal');
    const title = document.getElementById('detailTitle');
    const content = document.getElementById('detailContent');
    
    if (!modal || !title || !content) return;
    
    title.textContent = discussion.title;
    
    // Load comments/replies
    const comments = await loadComments(discussionId);
    
    content.innerHTML = `
        <div class="mb-6 pb-6 border-b border-gray-200">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center space-x-3">
                    <img src="https://ui-avatars.com/api/?background=1e88e5&color=fff&size=40&name=${encodeURIComponent(discussion.author?.fullName || 'User')}" 
                         class="w-10 h-10 rounded-full">
                    <div>
                        <p class="font-semibold text-gray-800">${escapeHtml(discussion.author?.fullName || 'Anonymous')}</p>
                        <p class="text-xs text-gray-500">${formatTime(discussion.createdAt)}</p>
                        ${discussion.category ? `<p class="text-xs text-gray-400 mt-1">Category: ${escapeHtml(discussion.category)}</p>` : ''}
                    </div>
                </div>
                <div class="flex space-x-2">
                    <button onclick="window.likeDiscussion('${discussion.id}')" 
                            class="reaction-btn ${discussion.userLiked ? 'active' : ''} px-3 py-1 rounded-lg hover:bg-gray-100">
                        <i class="fas fa-heart"></i> <span id="likeCount">${discussion.likes || 0}</span>
                    </button>
                    ${(discussion.authorId === currentUser.uid || isAdmin) ? `
                        <button onclick="window.deleteDiscussion('${discussion.id}')" 
                                class="px-3 py-1 text-red-600 rounded-lg hover:bg-red-50">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="prose max-w-none">
                ${discussion.content}
            </div>
        </div>
        
        <div class="mb-6">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-800">Replies (${comments.length})</h3>
                ${!discussion.hasAnswer && comments.length > 0 && discussion.authorId === currentUser.uid ? `
                    <button onclick="window.markAsSolved('${discussion.id}')" 
                            class="text-sm bg-green-500 text-white px-3 py-1 rounded-lg hover:bg-green-600 transition">
                        <i class="fas fa-check-circle mr-1"></i> Mark as Solved
                    </button>
                ` : ''}
            </div>
            <div id="commentsList" class="space-y-4">
                ${comments.length === 0 ? '<p class="text-center text-gray-500 py-4">No replies yet. Be the first to reply!</p>' : 
                    comments.map(comment => `
                    <div class="comment-item border border-gray-100 rounded-lg p-4 ${comment.isAnswer ? 'bg-green-50 border-green-200' : ''}" id="comment-${comment.id}">
                        <div class="flex items-start justify-between">
                            <div class="flex items-center space-x-3 mb-2">
                                <img src="https://ui-avatars.com/api/?background=1e88e5&color=fff&size=32&name=${encodeURIComponent(comment.author?.fullName || 'User')}" 
                                     class="w-8 h-8 rounded-full">
                                <div>
                                    <p class="font-medium text-gray-800">${escapeHtml(comment.author?.fullName || 'Anonymous')}</p>
                                    <p class="text-xs text-gray-500">${formatTime(comment.createdAt)}</p>
                                </div>
                                ${comment.isAnswer ? '<span class="ml-2 text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full"><i class="fas fa-check-circle mr-1"></i>Accepted Answer</span>' : ''}
                            </div>
                            ${(comment.authorId === currentUser.uid || isAdmin) ? `
                                <button onclick="window.deleteComment('${discussion.id}', '${comment.id}')" 
                                        class="text-red-500 hover:text-red-700 text-sm">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            ` : ''}
                        </div>
                        <div class="text-gray-700 text-sm mt-2">${escapeHtml(comment.content)}</div>
                        <div class="mt-3 flex space-x-4">
                            <button onclick="window.likeComment('${discussion.id}', '${comment.id}')" 
                                    class="reaction-btn text-sm ${comment.userLiked ? 'active' : ''} text-gray-500 hover:text-[#1e88e5]">
                                <i class="far fa-heart"></i> <span id="comment-like-${comment.id}">${comment.likes || 0}</span>
                            </button>
                            ${!discussion.hasAnswer && discussion.authorId === currentUser.uid && comment.authorId !== currentUser.uid ? `
                                <button onclick="window.acceptAnswer('${discussion.id}', '${comment.id}')" 
                                        class="text-sm text-green-500 hover:text-green-700">
                                    <i class="fas fa-check-circle"></i> Accept as Answer
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="border-t border-gray-200 pt-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4">Add a Reply</h3>
            <textarea id="replyContent" rows="4" 
                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none"
                      placeholder="Write your reply..."></textarea>
            <div class="mt-3 flex justify-end">
                <button onclick="window.submitComment('${discussion.id}')" 
                        class="px-4 py-2 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42] transition">
                    Post Reply
                </button>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
};

// Load comments for a discussion
async function loadComments(discussionId) {
    try {
        const commentsRef = collection(db, 'discussions', discussionId, 'comments');
        const q = query(commentsRef, orderBy('createdAt', 'asc'));
        const snapshot = await getDocs(q);
        
        const comments = [];
        for (const docSnapshot of snapshot.docs) {
            const comment = { id: docSnapshot.id, ...docSnapshot.data() };
            
            // Get author details
            try {
                const authorDoc = await getDoc(doc(db, 'users', comment.authorId));
                if (authorDoc.exists()) {
                    comment.author = authorDoc.data();
                } else {
                    comment.author = { fullName: 'Deleted User' };
                }
            } catch (e) {
                comment.author = { fullName: 'Unknown User' };
            }
            
            comment.userLiked = comment.likedBy?.includes(currentUser.uid) || false;
            comments.push(comment);
        }
        
        return comments;
    } catch (error) {
        console.error('Error loading comments:', error);
        return [];
    }
}

// Submit comment
window.submitComment = async (discussionId) => {
    const replyContent = document.getElementById('replyContent')?.value.trim();
    if (!replyContent) {
        showToast('Please enter a reply', 'error');
        return;
    }
    
    try {
        const commentsRef = collection(db, 'discussions', discussionId, 'comments');
        await addDoc(commentsRef, {
            content: replyContent,
            authorId: currentUser.uid,
            authorName: document.getElementById('userName')?.textContent || 'Student',
            createdAt: new Date().toISOString(),
            likes: 0,
            likedBy: [],
            isAnswer: false
        });
        
        // Update reply count
        const discussionRef = doc(db, 'discussions', discussionId);
        await updateDoc(discussionRef, {
            replyCount: increment(1),
            lastReplyAt: new Date().toISOString()
        });
        
        // Clear input
        const replyTextarea = document.getElementById('replyContent');
        if (replyTextarea) replyTextarea.value = '';
        
        // Refresh the view
        await viewDiscussion(discussionId);
        await loadDiscussions(true);
        
        showToast('Reply posted successfully!', 'success');
        
    } catch (error) {
        console.error('Error submitting comment:', error);
        showToast('Failed to post reply. Please try again.', 'error');
    }
};

// Like a discussion
window.likeDiscussion = async (discussionId) => {
    const discussion = discussions.find(d => d.id === discussionId);
    if (!discussion) return;
    
    try {
        const discussionRef = doc(db, 'discussions', discussionId);
        
        if (discussion.userLiked) {
            await updateDoc(discussionRef, {
                likes: increment(-1),
                likedBy: arrayRemove(currentUser.uid)
            });
            discussion.userLiked = false;
            discussion.likes = (discussion.likes || 1) - 1;
        } else {
            await updateDoc(discussionRef, {
                likes: increment(1),
                likedBy: arrayUnion(currentUser.uid)
            });
            discussion.userLiked = true;
            discussion.likes = (discussion.likes || 0) + 1;
        }
        
        // Update display
        displayDiscussions();
        
        // Update detail view if open
        if (currentDiscussion && currentDiscussion.id === discussionId) {
            const likeCountSpan = document.getElementById('likeCount');
            if (likeCountSpan) {
                likeCountSpan.textContent = discussion.likes;
            }
        }
        
    } catch (error) {
        console.error('Error liking discussion:', error);
    }
};

// Like a comment
window.likeComment = async (discussionId, commentId) => {
    try {
        const commentRef = doc(db, 'discussions', discussionId, 'comments', commentId);
        const commentDoc = await getDoc(commentRef);
        
        if (commentDoc.exists()) {
            const comment = commentDoc.data();
            const userLiked = comment.likedBy?.includes(currentUser.uid) || false;
            const newLikes = userLiked ? (comment.likes || 1) - 1 : (comment.likes || 0) + 1;
            const likedBy = userLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid);
            
            await updateDoc(commentRef, {
                likes: newLikes,
                likedBy: likedBy
            });
            
            // Update like count in UI
            const likeSpan = document.getElementById(`comment-like-${commentId}`);
            if (likeSpan) {
                likeSpan.textContent = newLikes;
            }
        }
        
    } catch (error) {
        console.error('Error liking comment:', error);
    }
};

// Accept answer
window.acceptAnswer = async (discussionId, commentId) => {
    if (!confirm('Mark this as the accepted answer?')) return;
    
    try {
        const discussionRef = doc(db, 'discussions', discussionId);
        const commentRef = doc(db, 'discussions', discussionId, 'comments', commentId);
        
        // Update comment as answer
        await updateDoc(commentRef, { isAnswer: true });
        
        // Update discussion as solved
        await updateDoc(discussionRef, { hasAnswer: true });
        
        // Refresh the view
        await viewDiscussion(discussionId);
        await loadDiscussions(true);
        
        showToast('Answer accepted!', 'success');
        
    } catch (error) {
        console.error('Error accepting answer:', error);
        showToast('Failed to mark answer', 'error');
    }
};

// Mark as solved
window.markAsSolved = async (discussionId) => {
    try {
        const discussionRef = doc(db, 'discussions', discussionId);
        await updateDoc(discussionRef, { hasAnswer: true });
        
        await viewDiscussion(discussionId);
        await loadDiscussions(true);
        
        showToast('Discussion marked as solved!', 'success');
        
    } catch (error) {
        console.error('Error marking as solved:', error);
        showToast('Failed to mark as solved', 'error');
    }
};

// Delete discussion
window.deleteDiscussion = async (discussionId) => {
    if (!confirm('Are you sure you want to delete this discussion? This action cannot be undone.')) return;
    
    try {
        await deleteDoc(doc(db, 'discussions', discussionId));
        await loadDiscussions(true);
        
        // Close modal if open
        const modal = document.getElementById('discussionDetailModal');
        if (modal) modal.classList.add('hidden');
        
        showToast('Discussion deleted successfully', 'success');
        
    } catch (error) {
        console.error('Error deleting discussion:', error);
        showToast('Failed to delete discussion. Please try again.', 'error');
    }
};

// Delete comment
window.deleteComment = async (discussionId, commentId) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    
    try {
        await deleteDoc(doc(db, 'discussions', discussionId, 'comments', commentId));
        
        // Update reply count
        const discussionRef = doc(db, 'discussions', discussionId);
        await updateDoc(discussionRef, {
            replyCount: increment(-1)
        });
        
        await viewDiscussion(discussionId);
        await loadDiscussions(true);
        
        showToast('Comment deleted', 'success');
        
    } catch (error) {
        console.error('Error deleting comment:', error);
        showToast('Failed to delete comment', 'error');
    }
};

// Create new discussion
function setupCreateDiscussion() {
    const createBtn = document.getElementById('createDiscussionBtn');
    const modal = document.getElementById('discussionModal');
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelModalBtn');
    const form = document.getElementById('discussionForm');
    
    if (!createBtn || !modal) return;
    
    createBtn.addEventListener('click', () => {
        const modalTitle = document.getElementById('modalTitle');
        const discussionTitle = document.getElementById('discussionTitle');
        const discussionCategory = document.getElementById('discussionCategory');
        const editorContent = document.getElementById('editorContent');
        
        if (modalTitle) modalTitle.textContent = 'Create New Discussion';
        if (discussionTitle) discussionTitle.value = '';
        if (discussionCategory) discussionCategory.value = '';
        if (editorContent) editorContent.innerHTML = '';
        if (form) form.reset();
        modal.classList.remove('hidden');
    });
    
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    if (cancelBtn) cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const title = document.getElementById('discussionTitle')?.value.trim();
            const category = document.getElementById('discussionCategory')?.value;
            const content = document.getElementById('editorContent')?.innerHTML;
            
            if (!title || !category || !content) {
                showToast('Please fill in all fields', 'error');
                return;
            }
            
            try {
                const discussionsRef = collection(db, 'discussions');
                
                await addDoc(discussionsRef, {
                    title: title,
                    category: category,
                    content: content,
                    authorId: currentUser.uid,
                    createdAt: new Date().toISOString(),
                    likes: 0,
                    replyCount: 0,
                    likedBy: [],
                    hasAnswer: false
                });
                
                modal.classList.add('hidden');
                await loadDiscussions(true);
                showToast('Discussion posted successfully!', 'success');
                
            } catch (error) {
                console.error('Error creating discussion:', error);
                if (error.code === 'permission-denied') {
                    showToast('You don\'t have permission to create discussions', 'error');
                } else {
                    showToast('Failed to create discussion. Please try again.', 'error');
                }
            }
        });
    }
}

// Setup filters
function setupFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const sortSelect = document.getElementById('sortBy');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active', 'bg-[#1e88e5]', 'text-white'));
            filterBtns.forEach(b => b.classList.add('bg-gray-100', 'text-gray-700'));
            btn.classList.add('active', 'bg-[#1e88e5]', 'text-white');
            btn.classList.remove('bg-gray-100', 'text-gray-700');
            loadDiscussions(true);
        });
    });
    
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            loadDiscussions(true);
        });
    }
}

// Setup load more
function setupLoadMore() {
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            loadDiscussions(false);
        });
    }
}

// Rich text editor functions
window.formatText = (command) => {
    document.execCommand(command, false, null);
};

window.insertCode = () => {
    const code = prompt('Enter your code snippet:');
    if (code) {
        document.execCommand('insertHTML', false, `<pre><code class="bg-gray-100 p-2 rounded">${escapeHtml(code)}</code></pre>`);
    }
};

window.insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
        document.execCommand('createLink', false, url);
    }
};

window.insertImage = () => {
    const url = prompt('Enter image URL:');
    if (url) {
        document.execCommand('insertHTML', false, `<img src="${url}" alt="Image" class="max-w-full rounded-lg my-2">`);
    }
};

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

// Toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in ${
        type === 'success' ? 'bg-green-500 text-white' : 
        type === 'error' ? 'bg-red-500 text-white' : 
        'bg-gray-800 text-white'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Sidebar setup
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    const mainContent = document.getElementById('mainContent');
    let isCollapsed = false;
    
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState === 'true') toggleSidebar(true);
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => toggleSidebar(!isCollapsed));
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
            
            if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-chevron-right text-xl"></i>';
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
            
            if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-chevron-left text-xl"></i>';
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
        if (userDropdown && !userDropdown.contains(e.target) && e.target !== userMenuBtn) {
            userDropdown.classList.add('hidden');
        }
    });
}

// Modal close handlers
function setupModals() {
    const closeDetailModal = document.getElementById('closeDetailModalBtn');
    const detailModal = document.getElementById('discussionDetailModal');
    
    if (closeDetailModal) {
        closeDetailModal.addEventListener('click', () => {
            if (detailModal) detailModal.classList.add('hidden');
        });
    }
    
    if (detailModal) {
        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) {
                detailModal.classList.add('hidden');
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

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    setupCreateDiscussion();
    setupFilters();
    setupLoadMore();
    setupSidebar();
    setupDropdowns();
    setupModals();
    
    // Logout handlers
    const logoutBtns = document.querySelectorAll('#logoutBtn, #logoutDropdown');
    logoutBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                logout();
            });
        }
    });
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            displayDiscussions();
        });
    }
    
    if (mobileSearchInput) {
        mobileSearchInput.addEventListener('input', () => {
            displayDiscussions();
        });
    }
});

// Make functions available globally
window.viewDiscussion = viewDiscussion;
window.likeDiscussion = likeDiscussion;
window.likeComment = likeComment;
window.submitComment = submitComment;
window.acceptAnswer = acceptAnswer;
window.markAsSolved = markAsSolved;
window.deleteDiscussion = deleteDiscussion;
window.deleteComment = deleteComment;

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
    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    .reaction-btn.active {
        color: #ef4444;
    }
`;
document.head.appendChild(style);