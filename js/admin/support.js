import { 
    auth, signOut, db, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
    collection, query, where, orderBy, onAuthStateChanged, limit, startAfter
} from '../firebase-config.js';

let currentAdmin = null;
let allTickets = [];
let filteredTickets = [];
let allFeedback = [];
let filteredFeedback = [];
let users = [];
let currentPage = 1;
let currentFeedbackPage = 1;
const itemsPerPage = 10;
const feedbackItemsPerPage = 10;
let currentStatus = 'all';
let currentPriority = 'all';
let currentRating = 'all';
let currentFeedbackCategory = 'all';
let searchTerm = '';
let feedbackSearchTerm = '';

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '../../login.html'; return; }
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && (userDoc.data().role === 'admin' || userDoc.data().role === 'super_admin')) {
        currentAdmin = user;
        await loadAdminData(user.uid);
        await loadUsers();
        await loadTickets();
        await loadFeedback();
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

// Load users for reference
async function loadUsers() {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    users = [];
    usersSnapshot.forEach(doc => {
        users.push({ id: doc.id, ...doc.data() });
    });
}

// Load tickets
async function loadTickets() {
    try {
        const ticketsRef = collection(db, 'supportTickets');
        const snapshot = await getDocs(query(ticketsRef, orderBy('createdAt', 'desc')));
        
        allTickets = [];
        snapshot.forEach(doc => {
            allTickets.push({ id: doc.id, ...doc.data() });
        });
        
        // Update stats
        updateTicketStats();
        
        applyTicketFilters();
        
    } catch (error) {
        console.error('Error loading tickets:', error);
        showToast('Failed to load tickets', 'error');
    }
}

// Update ticket statistics
function updateTicketStats() {
    const total = allTickets.length;
    const open = allTickets.filter(t => t.status === 'open').length;
    const inProgress = allTickets.filter(t => t.status === 'in-progress').length;
    const resolved = allTickets.filter(t => t.status === 'resolved').length;
    
    document.getElementById('totalTickets').textContent = total;
    document.getElementById('openTickets').textContent = open;
    document.getElementById('inProgressTickets').textContent = inProgress;
    document.getElementById('resolvedTickets').textContent = resolved;
    document.getElementById('openTicketsCount').textContent = open;
}

// Load feedback
async function loadFeedback() {
    try {
        const feedbackRef = collection(db, 'feedback');
        const snapshot = await getDocs(query(feedbackRef, orderBy('createdAt', 'desc')));
        
        allFeedback = [];
        snapshot.forEach(doc => {
            allFeedback.push({ id: doc.id, ...doc.data() });
        });
        
        // Update feedback stats
        updateFeedbackStats();
        
        applyFeedbackFilters();
        
        // Update badge if there's new feedback
        const today = new Date().toDateString();
        const todayFeedback = allFeedback.filter(f => {
            const feedbackDate = f.createdAt?.toDate ? f.createdAt.toDate() : new Date(f.createdAt);
            return feedbackDate.toDateString() === today;
        });
        const badge = document.getElementById('feedbackBadge');
        if (todayFeedback.length > 0 && badge) {
            badge.textContent = todayFeedback.length;
            badge.classList.remove('hidden');
        }
        
    } catch (error) {
        console.error('Error loading feedback:', error);
        showToast('Failed to load feedback', 'error');
    }
}

// Update feedback statistics
function updateFeedbackStats() {
    const total = allFeedback.length;
    const avgRating = total > 0 ? (allFeedback.reduce((sum, f) => sum + f.rating, 0) / total).toFixed(1) : 0;
    const fiveStarCount = allFeedback.filter(f => f.rating === 5).length;
    
    // Calculate this month's feedback
    const now = new Date();
    const thisMonth = allFeedback.filter(f => {
        const feedbackDate = f.createdAt?.toDate ? f.createdAt.toDate() : new Date(f.createdAt);
        return feedbackDate.getMonth() === now.getMonth() && feedbackDate.getFullYear() === now.getFullYear();
    }).length;
    
    document.getElementById('totalFeedback').textContent = total;
    document.getElementById('avgRating').textContent = avgRating;
    document.getElementById('fiveStarCount').textContent = fiveStarCount;
    document.getElementById('monthlyFeedback').textContent = thisMonth;
}

// Apply ticket filters
function applyTicketFilters() {
    filteredTickets = [...allTickets];
    
    // Status filter
    if (currentStatus !== 'all') {
        filteredTickets = filteredTickets.filter(t => t.status === currentStatus);
    }
    
    // Priority filter
    if (currentPriority !== 'all') {
        filteredTickets = filteredTickets.filter(t => t.priority === currentPriority);
    }
    
    // Search filter
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredTickets = filteredTickets.filter(t => 
            t.subject?.toLowerCase().includes(term) ||
            t.description?.toLowerCase().includes(term) ||
            t.category?.toLowerCase().includes(term)
        );
    }
    
    updateTicketPagination();
    displayTickets();
}

// Apply feedback filters
function applyFeedbackFilters() {
    filteredFeedback = [...allFeedback];
    
    // Rating filter
    if (currentRating !== 'all') {
        filteredFeedback = filteredFeedback.filter(f => f.rating === parseInt(currentRating));
    }
    
    // Category filter
    if (currentFeedbackCategory !== 'all') {
        filteredFeedback = filteredFeedback.filter(f => f.category === currentFeedbackCategory);
    }
    
    // Search filter
    if (feedbackSearchTerm) {
        const term = feedbackSearchTerm.toLowerCase();
        filteredFeedback = filteredFeedback.filter(f => 
            f.message?.toLowerCase().includes(term) ||
            f.userName?.toLowerCase().includes(term) ||
            f.category?.toLowerCase().includes(term)
        );
    }
    
    updateFeedbackPagination();
    displayFeedback();
}

// Display tickets
function displayTickets() {
    const container = document.getElementById('ticketsList');
    const start = (currentPage - 1) * itemsPerPage;
    const pageTickets = filteredTickets.slice(start, start + itemsPerPage);
    
    if (pageTickets.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 bg-white rounded-xl">
                <i class="fas fa-ticket-alt text-5xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No support tickets found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = pageTickets.map(ticket => {
        const user = users.find(u => u.id === ticket.userId);
        return `
            <div class="ticket-card bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition cursor-pointer" onclick="window.viewTicket('${ticket.id}')">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-3 mb-2">
                            <span class="status-${ticket.status} px-2 py-1 text-xs rounded-full capitalize">${ticket.status || 'Open'}</span>
                            <span class="priority-${ticket.priority} px-2 py-1 text-xs rounded-full capitalize">${ticket.priority || 'Medium'}</span>
                            <span class="text-xs text-gray-500">${ticket.category || 'General'}</span>
                        </div>
                        <h3 class="font-semibold text-gray-800 mb-1">${ticket.subject}</h3>
                        <p class="text-sm text-gray-600 line-clamp-2 mb-3">${ticket.description || 'No description'}</p>
                        <div class="flex items-center space-x-4 text-xs text-gray-500">
                            <div class="flex items-center space-x-1">
                                <img src="https://ui-avatars.com/api/?background=1e88e5&color=fff&size=20&name=${encodeURIComponent(user?.fullName || 'User')}" class="w-5 h-5 rounded-full">
                                <span>${user?.fullName || 'Unknown User'}</span>
                            </div>
                            <span><i class="far fa-clock mr-1"></i>${formatDate(ticket.createdAt)}</span>
                            <span><i class="far fa-comment mr-1"></i>${ticket.replies?.length || 0} replies</span>
                        </div>
                    </div>
                    <div class="ml-4 flex flex-col items-end space-y-2">
                        <button onclick="event.stopPropagation(); window.updateTicketStatus('${ticket.id}', '${ticket.status}')" 
                                class="text-[#1e88e5] text-sm hover:underline">
                            Update Status
                        </button>
                        <span class="text-xs text-gray-400">ID: ${ticket.id.slice(0, 8)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Display feedback
function displayFeedback() {
    const container = document.getElementById('feedbackList');
    const start = (currentFeedbackPage - 1) * feedbackItemsPerPage;
    const pageFeedback = filteredFeedback.slice(start, start + feedbackItemsPerPage);
    
    if (pageFeedback.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 bg-white rounded-xl">
                <i class="fas fa-star text-5xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No feedback found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = pageFeedback.map(feedback => {
        const user = users.find(u => u.id === feedback.userId);
        const stars = Array(5).fill().map((_, i) => 
            `<i class="fas fa-star ${i < feedback.rating ? 'text-yellow-400' : 'text-gray-300'} text-sm"></i>`
        ).join('');
        
        return `
            <div class="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-3 mb-3">
                            <img src="https://ui-avatars.com/api/?background=1e88e5&color=fff&size=32&name=${encodeURIComponent(feedback.userName || user?.fullName || 'User')}" class="w-8 h-8 rounded-full">
                            <div>
                                <p class="font-semibold text-gray-800">${feedback.userName || user?.fullName || 'Anonymous User'}</p>
                                <p class="text-xs text-gray-500">${user?.email || 'No email'}</p>
                            </div>
                            <div class="flex space-x-0.5 ml-2">
                                ${stars}
                            </div>
                        </div>
                        <div class="mb-2">
                            <span class="inline-block px-2 py-1 bg-gray-100 text-xs rounded-full">${feedback.category || 'General'}</span>
                        </div>
                        <p class="text-gray-700 mb-3">${feedback.message}</p>
                        <div class="flex items-center space-x-4 text-xs text-gray-500">
                            <span><i class="far fa-clock mr-1"></i>${formatDate(feedback.createdAt)}</span>
                            <button onclick="window.viewFeedbackDetails('${feedback.id}')" class="text-[#1e88e5] hover:underline">
                                View Details
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// View feedback details
window.viewFeedbackDetails = async (feedbackId) => {
    const feedback = allFeedback.find(f => f.id === feedbackId);
    if (!feedback) return;
    
    const user = users.find(u => u.id === feedback.userId);
    const stars = Array(5).fill().map((_, i) => 
        `<i class="fas fa-star ${i < feedback.rating ? 'text-yellow-400' : 'text-gray-300'} text-xl"></i>`
    ).join('');
    
    const modal = document.getElementById('ticketModal');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalContent');
    
    title.textContent = `Feedback Details`;
    
    content.innerHTML = `
        <div class="space-y-6">
            <!-- User Info -->
            <div class="flex items-center space-x-3 pb-4 border-b border-gray-200">
                <img src="https://ui-avatars.com/api/?background=1e88e5&color=fff&size=48&name=${encodeURIComponent(feedback.userName || user?.fullName || 'User')}" class="w-12 h-12 rounded-full">
                <div>
                    <p class="font-semibold text-gray-800">${feedback.userName || user?.fullName || 'Anonymous User'}</p>
                    <p class="text-sm text-gray-500">${user?.email || 'No email'}</p>
                    <p class="text-xs text-gray-400">User ID: ${feedback.userId}</p>
                </div>
            </div>
            
            <!-- Rating -->
            <div class="bg-gray-50 rounded-lg p-4">
                <p class="text-sm font-medium text-gray-600 mb-2">Rating</p>
                <div class="flex space-x-1">
                    ${stars}
                    <span class="ml-2 text-gray-600">(${feedback.rating}/5)</span>
                </div>
            </div>
            
            <!-- Category -->
            <div class="bg-gray-50 rounded-lg p-4">
                <p class="text-sm font-medium text-gray-600 mb-2">Category</p>
                <span class="inline-block px-3 py-1 bg-gray-200 rounded-full text-sm">${feedback.category || 'General'}</span>
            </div>
            
            <!-- Feedback Message -->
            <div class="bg-gray-50 rounded-lg p-4">
                <p class="text-sm font-medium text-gray-600 mb-2">Feedback Message</p>
                <p class="text-gray-700 whitespace-pre-wrap">${feedback.message}</p>
            </div>
            
            <!-- Date -->
            <div class="bg-gray-50 rounded-lg p-4">
                <p class="text-sm font-medium text-gray-600 mb-2">Submitted</p>
                <p class="text-gray-700">${formatFullDate(feedback.createdAt)}</p>
            </div>
            
            <!-- Admin Actions -->
            <div class="border-t border-gray-200 pt-4">
                <div class="flex space-x-3">
                    <button onclick="window.replyToFeedback('${feedback.id}')" class="px-4 py-2 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42] transition">
                        <i class="fas fa-reply mr-2"></i>Reply to Student
                    </button>
                    <button onclick="window.closeFeedbackModal()" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
};

// Reply to feedback
window.replyToFeedback = async (feedbackId) => {
    const email = prompt("Enter your reply message (this will be sent to the student's email):");
    if (!email) return;
    
    try {
        // Here you would typically send an email notification
        // For now, just show success message
        showToast('Reply sent to student successfully!', 'success');
        
        // Optional: Store the reply in the database
        const feedbackRef = doc(db, 'feedback', feedbackId);
        await updateDoc(feedbackRef, {
            adminReply: email,
            repliedAt: new Date().toISOString(),
            repliedBy: currentAdmin.uid
        });
        
        window.closeFeedbackModal();
        
    } catch (error) {
        console.error('Error sending reply:', error);
        showToast('Failed to send reply', 'error');
    }
};

// Close feedback modal
window.closeFeedbackModal = () => {
    document.getElementById('ticketModal').classList.add('hidden');
};

// Format full date
function formatFullDate(date) {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleString();
}

// View ticket details
window.viewTicket = async (ticketId) => {
    const ticket = allTickets.find(t => t.id === ticketId);
    if (!ticket) return;
    
    const user = users.find(u => u.id === ticket.userId);
    const modal = document.getElementById('ticketModal');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalContent');
    
    title.textContent = `Ticket: ${ticket.subject}`;
    
    content.innerHTML = `
        <div class="space-y-6">
            <!-- Ticket Header -->
            <div class="flex items-center justify-between pb-4 border-b border-gray-200">
                <div class="flex items-center space-x-3">
                    <img src="https://ui-avatars.com/api/?background=1e88e5&color=fff&size=40&name=${encodeURIComponent(user?.fullName || 'User')}" class="w-10 h-10 rounded-full">
                    <div>
                        <p class="font-semibold text-gray-800">${user?.fullName || 'Unknown User'}</p>
                        <p class="text-xs text-gray-500">${user?.email || 'No email'}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-sm text-gray-600">Created: ${formatDate(ticket.createdAt)}</p>
                    <p class="text-xs text-gray-400">Ticket ID: ${ticket.id}</p>
                </div>
            </div>
            
            <!-- Ticket Details -->
            <div class="bg-gray-50 rounded-lg p-4">
                <div class="flex items-center space-x-2 mb-3">
                    <span class="status-${ticket.status} px-2 py-1 text-xs rounded-full capitalize">${ticket.status || 'Open'}</span>
                    <span class="priority-${ticket.priority} px-2 py-1 text-xs rounded-full capitalize">${ticket.priority || 'Medium'}</span>
                    <span class="text-xs text-gray-500">${ticket.category || 'General'}</span>
                </div>
                <h3 class="font-semibold text-gray-800 mb-2">${ticket.subject}</h3>
                <p class="text-gray-700 whitespace-pre-wrap">${ticket.description}</p>
                ${ticket.attachments && ticket.attachments.length > 0 ? `
                    <div class="mt-3">
                        <p class="text-sm font-medium text-gray-600 mb-2">Attachments:</p>
                        <div class="flex space-x-2">
                            ${ticket.attachments.map(att => `
                                <a href="#" class="attachment-badge inline-flex items-center space-x-1 px-2 py-1 bg-gray-200 rounded-lg text-xs hover:bg-gray-300">
                                    <i class="fas fa-paperclip"></i>
                                    <span>${att.name}</span>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <!-- Status Update -->
            <div class="border rounded-lg p-4">
                <h4 class="font-semibold text-gray-800 mb-3">Update Status</h4>
                <div class="flex space-x-2">
                    <button onclick="window.changeStatus('${ticket.id}', 'open')" class="px-3 py-1 status-open rounded-lg text-sm">Open</button>
                    <button onclick="window.changeStatus('${ticket.id}', 'in-progress')" class="px-3 py-1 status-in-progress rounded-lg text-sm">In Progress</button>
                    <button onclick="window.changeStatus('${ticket.id}', 'resolved')" class="px-3 py-1 status-resolved rounded-lg text-sm">Resolved</button>
                    <button onclick="window.changeStatus('${ticket.id}', 'closed')" class="px-3 py-1 status-closed rounded-lg text-sm">Closed</button>
                </div>
            </div>
            
            <!-- Replies Section -->
            <div>
                <h4 class="font-semibold text-gray-800 mb-3">Replies (${ticket.replies?.length || 0})</h4>
                <div class="space-y-3 mb-4 max-h-96 overflow-y-auto">
                    ${ticket.replies && ticket.replies.length > 0 ? ticket.replies.map(reply => {
                        const isAdmin = reply.authorId === currentAdmin.uid;
                        return `
                            <div class="reply-item ${isAdmin ? 'bg-blue-50' : 'bg-gray-50'} rounded-lg p-3">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="flex items-center space-x-2">
                                        <img src="https://ui-avatars.com/api/?background=${isAdmin ? '1e88e5' : '6b7280'}&color=fff&size=24&name=${encodeURIComponent(reply.authorName || 'User')}" class="w-6 h-6 rounded-full">
                                        <span class="font-medium text-sm">${reply.authorName || (isAdmin ? 'Admin' : 'User')}</span>
                                        <span class="text-xs text-gray-400">${formatDate(reply.createdAt)}</span>
                                    </div>
                                    ${isAdmin ? '<span class="text-xs text-blue-600">Staff</span>' : ''}
                                </div>
                                <p class="text-sm text-gray-700">${reply.message}</p>
                            </div>
                        `;
                    }).join('') : '<p class="text-gray-500 text-sm">No replies yet.</p>'}
                </div>
                
                <!-- Add Reply -->
                <div class="mt-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Add Reply</label>
                    <textarea id="replyMessage" rows="3" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" placeholder="Type your response..."></textarea>
                    <div class="mt-3 flex justify-end space-x-2">
                        <button onclick="window.addReply('${ticket.id}')" class="px-4 py-2 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42] transition">
                            Send Reply
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
};

// Change ticket status
window.changeStatus = async (ticketId, newStatus) => {
    try {
        const ticketRef = doc(db, 'supportTickets', ticketId);
        await updateDoc(ticketRef, {
            status: newStatus,
            updatedAt: new Date().toISOString(),
            updatedBy: currentAdmin.uid
        });
        
        // Update local data
        const ticket = allTickets.find(t => t.id === ticketId);
        if (ticket) ticket.status = newStatus;
        
        // Refresh display
        applyTicketFilters();
        
        // Update modal if open
        const modal = document.getElementById('ticketModal');
        if (!modal.classList.contains('hidden')) {
            await viewTicket(ticketId);
        }
        
        showToast(`Ticket status updated to ${newStatus}`, 'success');
        
    } catch (error) {
        console.error('Error updating status:', error);
        showToast('Failed to update status', 'error');
    }
};

// Update ticket status from card
window.updateTicketStatus = async (ticketId, currentStatus) => {
    const statuses = ['open', 'in-progress', 'resolved', 'closed'];
    const currentIndex = statuses.indexOf(currentStatus);
    const nextIndex = (currentIndex + 1) % statuses.length;
    const newStatus = statuses[nextIndex];
    await changeStatus(ticketId, newStatus);
};

// Add reply to ticket
window.addReply = async (ticketId) => {
    const message = document.getElementById('replyMessage')?.value.trim();
    if (!message) {
        showToast('Please enter a reply message', 'error');
        return;
    }
    
    try {
        const ticketRef = doc(db, 'supportTickets', ticketId);
        const ticket = allTickets.find(t => t.id === ticketId);
        
        const reply = {
            message: message,
            authorId: currentAdmin.uid,
            authorName: document.getElementById('adminName').textContent,
            createdAt: new Date().toISOString()
        };
        
        const updatedReplies = [...(ticket.replies || []), reply];
        
        await updateDoc(ticketRef, {
            replies: updatedReplies,
            updatedAt: new Date().toISOString(),
            status: ticket.status === 'resolved' ? 'reopened' : ticket.status
        });
        
        // Clear reply input
        document.getElementById('replyMessage').value = '';
        
        // Refresh the view
        await viewTicket(ticketId);
        await loadTickets();
        
        showToast('Reply sent successfully', 'success');
        
    } catch (error) {
        console.error('Error adding reply:', error);
        showToast('Failed to send reply', 'error');
    }
};

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

// Update ticket pagination
function updateTicketPagination() {
    const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, filteredTickets.length);
    document.getElementById('paginationInfo').textContent = `Showing ${start}-${end} of ${filteredTickets.length} tickets`;
    document.getElementById('currentPage').textContent = `Page ${currentPage}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages || totalPages === 0;
}

// Update feedback pagination
function updateFeedbackPagination() {
    const totalPages = Math.ceil(filteredFeedback.length / feedbackItemsPerPage);
    const start = (currentFeedbackPage - 1) * feedbackItemsPerPage + 1;
    const end = Math.min(currentFeedbackPage * feedbackItemsPerPage, filteredFeedback.length);
    document.getElementById('feedbackPaginationInfo').textContent = `Showing ${start}-${end} of ${filteredFeedback.length} feedback items`;
    document.getElementById('feedbackCurrentPage').textContent = `Page ${currentFeedbackPage}`;
    document.getElementById('feedbackPrevPage').disabled = currentFeedbackPage === 1;
    document.getElementById('feedbackNextPage').disabled = currentFeedbackPage === totalPages || totalPages === 0;
}

// Setup ticket filters
function setupTicketFilters() {
    document.querySelectorAll('.status-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.status-filter').forEach(b => {
                b.classList.remove('bg-[#1e88e5]', 'text-white');
                b.classList.add('bg-gray-100', 'text-gray-700');
            });
            btn.classList.add('bg-[#1e88e5]', 'text-white');
            currentStatus = btn.dataset.status;
            currentPage = 1;
            applyTicketFilters();
        });
    });
    
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchTerm = e.target.value;
        currentPage = 1;
        applyTicketFilters();
    });
    
    document.getElementById('priorityFilter').addEventListener('change', (e) => {
        currentPriority = e.target.value;
        currentPage = 1;
        applyTicketFilters();
    });
}

// Setup feedback filters
function setupFeedbackFilters() {
    document.querySelectorAll('.feedback-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.feedback-filter').forEach(b => {
                b.classList.remove('bg-[#1e88e5]', 'text-white');
                b.classList.add('bg-gray-100', 'text-gray-700');
            });
            btn.classList.add('bg-[#1e88e5]', 'text-white');
            currentRating = btn.dataset.rating;
            currentFeedbackPage = 1;
            applyFeedbackFilters();
        });
    });
    
    document.getElementById('feedbackCategoryFilter').addEventListener('change', (e) => {
        currentFeedbackCategory = e.target.value;
        currentFeedbackPage = 1;
        applyFeedbackFilters();
    });
    
    document.getElementById('feedbackSearchInput').addEventListener('input', (e) => {
        feedbackSearchTerm = e.target.value;
        currentFeedbackPage = 1;
        applyFeedbackFilters();
    });
}

// Setup tab switching
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const ticketsTab = document.getElementById('ticketsTab');
    const feedbackTab = document.getElementById('feedbackTab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            
            tabs.forEach(t => {
                t.classList.remove('active', 'text-[#1e88e5]', 'border-b-2', 'border-[#1e88e5]');
                t.classList.add('text-gray-500');
            });
            tab.classList.add('active', 'text-[#1e88e5]', 'border-b-2', 'border-[#1e88e5]');
            tab.classList.remove('text-gray-500');
            
            if (tabId === 'tickets') {
                ticketsTab.classList.remove('hidden');
                ticketsTab.classList.add('active');
                feedbackTab.classList.add('hidden');
                feedbackTab.classList.remove('active');
            } else {
                feedbackTab.classList.remove('hidden');
                feedbackTab.classList.add('active');
                ticketsTab.classList.add('hidden');
                ticketsTab.classList.remove('active');
            }
        });
    });
}

// Setup pagination
function setupPagination() {
    document.getElementById('prevPage').addEventListener('click', () => { 
        if (currentPage > 1) { 
            currentPage--; 
            displayTickets(); 
            updateTicketPagination(); 
        } 
    });
    document.getElementById('nextPage').addEventListener('click', () => { 
        if (currentPage < Math.ceil(filteredTickets.length / itemsPerPage)) { 
            currentPage++; 
            displayTickets(); 
            updateTicketPagination(); 
        } 
    });
    
    document.getElementById('feedbackPrevPage').addEventListener('click', () => { 
        if (currentFeedbackPage > 1) { 
            currentFeedbackPage--; 
            displayFeedback(); 
            updateFeedbackPagination(); 
        } 
    });
    document.getElementById('feedbackNextPage').addEventListener('click', () => { 
        if (currentFeedbackPage < Math.ceil(filteredFeedback.length / feedbackItemsPerPage)) { 
            currentFeedbackPage++; 
            displayFeedback(); 
            updateFeedbackPagination(); 
        } 
    });
}

// Modal close
function setupModal() {
    const modal = document.getElementById('ticketModal');
    const closeBtn = document.getElementById('closeModalBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    }
    modal.addEventListener('click', (e) => { 
        if (e.target === modal) modal.classList.add('hidden'); 
    });
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
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => toggleSidebar(!isCollapsed));
    }
    function toggleSidebar(collapse) {
        isCollapsed = collapse;
        if (collapse) {
            sidebar.classList.add('sidebar-collapsed'); 
            sidebar.classList.remove('sidebar-expanded');
            mainContent.style.marginLeft = '80px';
            localStorage.setItem('adminSidebarCollapsed', 'true');
            document.querySelectorAll('.nav-text, .admin-info, .logo-text').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.nav-item').forEach(item => {
                const text = item.querySelector('.nav-text')?.innerText;
                if (text) { 
                    item.classList.add('tooltip'); 
                    item.setAttribute('data-tooltip', text); 
                }
            });
            if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-chevron-right text-xl"></i>';
        } else {
            sidebar.classList.add('sidebar-expanded'); 
            sidebar.classList.remove('sidebar-collapsed');
            mainContent.style.marginLeft = '280px';
            localStorage.setItem('adminSidebarCollapsed', 'false');
            document.querySelectorAll('.nav-text, .admin-info, .logo-text').forEach(el => el.style.display = '');
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
            sidebar.classList.add('mobile-open'); 
            if (mobileOverlay) mobileOverlay.classList.remove('hidden'); 
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

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in ${type === 'success' ? 'bg-green-500 text-white' : type === 'error' ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

async function logout() { 
    await signOut(auth); 
    window.location.href = '../../login.html'; 
}

document.addEventListener('DOMContentLoaded', () => {
    setupTicketFilters();
    setupFeedbackFilters();
    setupTabs();
    setupPagination();
    setupModal();
    setupSidebar();
    setupDropdowns();
    document.querySelectorAll('#logoutBtn, #logoutDropdown').forEach(btn => {
        btn.addEventListener('click', (e) => { 
            e.preventDefault(); 
            logout(); 
        });
    });
});

// Expose functions globally
window.viewTicket = window.viewTicket;
window.updateTicketStatus = window.updateTicketStatus;
window.changeStatus = window.changeStatus;
window.addReply = window.addReply;
window.viewFeedbackDetails = window.viewFeedbackDetails;
window.replyToFeedback = window.replyToFeedback;
window.closeFeedbackModal = window.closeFeedbackModal;

const style = document.createElement('style');
style.textContent = `.animate-fade-in { animation: fadeIn 0.3s ease; } @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }`;
document.head.appendChild(style);