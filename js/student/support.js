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
    onAuthStateChanged,
    orderBy,
    serverTimestamp
} from '../firebase-config.js';

let currentUser = null;
let faqs = [];
let tickets = [];
let feedbacks = [];

// FAQ Data
const faqData = {
    account: [
        {
            question: "How do I reset my password?",
            answer: "To reset your password, click on 'Forgot Password' on the login page. Enter your email address and we'll send you a password reset link. Follow the instructions in the email to create a new password."
        },
        {
            question: "How can I update my profile information?",
            answer: "Go to Settings > Profile Information. You can update your name, email, phone number, and other personal details there. Don't forget to save your changes."
        },
        {
            question: "Can I change my username?",
            answer: "Username changes are currently not supported. Please contact support if you have a specific reason to change your username."
        }
    ],
    courses: [
        {
            question: "How do I enroll in a course?",
            answer: "Browse the Courses page, select a course you're interested in, and click 'Enroll Now'. The course will be added to your My Courses section where you can start learning."
        },
        {
            question: "How is my course progress tracked?",
            answer: "Your progress is automatically tracked as you complete lessons and quizzes. You can view your progress on the course page and on your Learning Path dashboard."
        },
        {
            question: "What happens when I complete a course?",
            answer: "Upon completing a course, you'll receive a certificate of completion. The certificate will be available in your Certificates section and can be downloaded or shared."
        }
    ],
    technical: [
        {
            question: "The video won't load. What should I do?",
            answer: "Try refreshing the page, clearing your browser cache, or using a different browser. If the issue persists, check your internet connection or contact support."
        },
        {
            question: "My quiz results aren't saving",
            answer: "Ensure you have a stable internet connection. If the problem continues, try logging out and back in. Contact support if the issue persists."
        }
    ],
    certificates: [
        {
            question: "How do I download my certificate?",
            answer: "Go to the Certificates section, find your certificate, and click the download button. The certificate will be saved as a PDF file."
        },
        {
            question: "Can I share my certificate?",
            answer: "Yes! You can share your certificate on social media or copy the verification link to share with employers or on your LinkedIn profile."
        }
    ],
    payment: [
        {
            question: "Are the courses free?",
            answer: "Yes! All courses on DBI Learning are currently free. We're committed to making quality education accessible to everyone."
        },
        {
            question: "Will there be paid courses in the future?",
            answer: "We may introduce paid courses in the future, but we'll always maintain a selection of free courses for our community."
        }
    ]
};

// Combine all FAQs
Object.keys(faqData).forEach(category => {
    faqData[category].forEach(faq => {
        faqs.push({ ...faq, category });
    });
});

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../login.html';
    } else {
        currentUser = user;
        await loadUserData(user.uid);
        await loadTickets(user.uid);
        await loadFeedback(user.uid);
        await loadNotifications(user.uid);
        displayFAQs();
    }
});

// Load user data
async function loadUserData(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            document.getElementById('userName').textContent = userData.fullName || 'Student';
            document.getElementById('userRole').textContent = userData.role || 'Student';
            
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

// Display FAQs
function displayFAQs() {
    const container = document.getElementById('faqContainer');
    const activeCategory = document.querySelector('.faq-cat-btn.active')?.dataset.cat || 'all';
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    
    let filtered = [...faqs];
    
    // Apply category filter
    if (activeCategory !== 'all') {
        filtered = filtered.filter(faq => faq.category === activeCategory);
    }
    
    // Apply search filter
    if (searchTerm) {
        filtered = filtered.filter(faq => 
            faq.question.toLowerCase().includes(searchTerm) ||
            faq.answer.toLowerCase().includes(searchTerm)
        );
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-question-circle text-5xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No FAQs found</p>
                <p class="text-sm text-gray-400 mt-1">Try adjusting your search or category</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map((faq, index) => `
        <div class="faq-item border-b border-gray-200 last:border-0" data-category="${faq.category}">
            <div class="faq-question flex items-center justify-between py-4 px-2 hover:bg-gray-50 transition">
                <div class="flex-1 pr-4">
                    <h3 class="font-medium text-gray-800">${faq.question}</h3>
                </div>
                <i class="fas fa-chevron-down faq-icon text-gray-400 transition-transform duration-300"></i>
            </div>
            <div class="faq-answer px-2 pb-4">
                <p class="text-gray-600 text-sm leading-relaxed">${faq.answer}</p>
            </div>
        </div>
    `).join('');
    
    // Add click handlers for FAQ items
    document.querySelectorAll('.faq-item').forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            item.classList.toggle('active');
        });
    });
}

// Load tickets
async function loadTickets(userId) {
    try {
        const ticketsRef = collection(db, 'supportTickets');
        const q = query(ticketsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        tickets = [];
        snapshot.forEach(doc => {
            tickets.push({ id: doc.id, ...doc.data() });
        });
        
        displayTickets();
        
    } catch (error) {
        console.error('Error loading tickets:', error);
        displayTickets(true);
    }
}

// Display tickets
function displayTickets(showError = false) {
    const container = document.getElementById('ticketsContainer');
    
    if (showError) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-exclamation-circle text-5xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">Unable to load tickets</p>
                <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-[#1e88e5] text-white rounded-lg">Retry</button>
            </div>
        `;
        return;
    }
    
    if (tickets.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-ticket-alt text-5xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No support tickets yet</p>
                <p class="text-sm text-gray-400 mt-1">Create a ticket and we'll help you out</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = tickets.map(ticket => `
        <div class="ticket-card bg-white border border-gray-200 rounded-lg p-4 mb-4 cursor-pointer" onclick="window.viewTicket('${ticket.id}')">
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <div class="flex items-center space-x-3 mb-2">
                        <h3 class="font-semibold text-gray-800">${ticket.subject}</h3>
                        <span class="status-${ticket.status || 'open'} px-2 py-1 text-xs rounded-full">
                            ${ticket.status || 'Open'}
                        </span>
                        <span class="priority-${ticket.priority} px-2 py-1 text-xs rounded-full">
                            ${ticket.priority || 'Medium'}
                        </span>
                    </div>
                    <p class="text-sm text-gray-600 mb-2">${ticket.description?.substring(0, 100)}${ticket.description?.length > 100 ? '...' : ''}</p>
                    <div class="flex items-center space-x-4 text-xs text-gray-500">
                        <span><i class="far fa-clock mr-1"></i>${formatDate(ticket.createdAt)}</span>
                        <span><i class="far fa-comment mr-1"></i>${ticket.replies?.length || 0} replies</span>
                        <span><i class="fas fa-tag mr-1"></i>${ticket.category}</span>
                    </div>
                </div>
                <div class="ml-4">
                    <i class="fas fa-chevron-right text-gray-400"></i>
                </div>
            </div>
        </div>
    `).join('');
}

// View ticket details
window.viewTicket = async (ticketId) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;
    
    const modal = document.getElementById('ticketDetailModal');
    const title = document.getElementById('ticketDetailTitle');
    const content = document.getElementById('ticketDetailContent');
    
    title.textContent = ticket.subject;
    
    content.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <div class="flex space-x-2">
                    <span class="status-${ticket.status || 'open'} px-2 py-1 text-xs rounded-full">
                        ${ticket.status || 'Open'}
                    </span>
                    <span class="priority-${ticket.priority} px-2 py-1 text-xs rounded-full">
                        ${ticket.priority || 'Medium'}
                    </span>
                </div>
                <span class="text-sm text-gray-500">Created: ${formatDate(ticket.createdAt)}</span>
            </div>
            
            <div class="bg-gray-50 rounded-lg p-4">
                <p class="text-gray-700">${ticket.description}</p>
                ${ticket.attachments ? `
                    <div class="mt-3">
                        <p class="text-sm font-medium text-gray-600 mb-2">Attachments:</p>
                        <div class="flex space-x-2">
                            ${ticket.attachments.map(att => `
                                <a href="#" class="text-[#1e88e5] text-sm hover:underline">
                                    <i class="fas fa-paperclip mr-1"></i> ${att.name}
                                </a>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
            
            ${ticket.replies && ticket.replies.length > 0 ? `
                <div>
                    <h4 class="font-semibold text-gray-800 mb-3">Replies (${ticket.replies.length})</h4>
                    <div class="space-y-3">
                        ${ticket.replies.map(reply => `
                            <div class="border-l-4 border-[#1e88e5] pl-4">
                                <div class="flex items-center space-x-2 mb-1">
                                    <span class="font-medium text-gray-800">${reply.authorName}</span>
                                    <span class="text-xs text-gray-500">${formatDate(reply.createdAt)}</span>
                                </div>
                                <p class="text-gray-600 text-sm">${reply.message}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div class="border-t border-gray-200 pt-4">
                <h4 class="font-semibold text-gray-800 mb-3">Add a Reply</h4>
                <textarea id="replyMessage" rows="3" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] focus:border-[#1e88e5] outline-none"
                          placeholder="Write your reply..."></textarea>
                <div class="mt-3 flex justify-end">
                    <button onclick="window.submitReply('${ticket.id}')" 
                            class="px-4 py-2 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42] transition">
                        Send Reply
                    </button>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
};

// Submit reply
window.submitReply = async (ticketId) => {
    const message = document.getElementById('replyMessage')?.value.trim();
    if (!message) {
        alert('Please enter a reply message');
        return;
    }
    
    try {
        const ticketRef = doc(db, 'supportTickets', ticketId);
        const ticket = tickets.find(t => t.id === ticketId);
        
        const reply = {
            message: message,
            authorId: currentUser.uid,
            authorName: document.getElementById('userName').textContent,
            createdAt: new Date().toISOString()
        };
        
        const updatedReplies = [...(ticket.replies || []), reply];
        
        await updateDoc(ticketRef, {
            replies: updatedReplies,
            updatedAt: new Date().toISOString(),
            status: ticket.status === 'resolved' ? 'reopened' : ticket.status
        });
        
        // Reload tickets
        await loadTickets(currentUser.uid);
        
        // Close modal and show success
        document.getElementById('ticketDetailModal').classList.add('hidden');
        showToast('Reply sent successfully!', 'success');
        
    } catch (error) {
        console.error('Error submitting reply:', error);
        alert('Failed to send reply. Please try again.');
    }
};

// Create new ticket
function setupTicketModal() {
    const newTicketBtns = document.querySelectorAll('#newTicketBtn, #newTicketBtn2');
    const modal = document.getElementById('ticketModal');
    const closeBtn = document.getElementById('closeTicketModal');
    const form = document.getElementById('ticketForm');
    
    newTicketBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            form.reset();
            modal.classList.remove('hidden');
        });
    });
    
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const subject = document.getElementById('ticketSubject').value.trim();
        const category = document.getElementById('ticketCategory').value;
        const priority = document.getElementById('ticketPriority').value;
        const description = document.getElementById('ticketDescription').value.trim();
        
        if (!subject || !category || !priority || !description) {
            alert('Please fill in all fields');
            return;
        }
        
        try {
            const ticketsRef = collection(db, 'supportTickets');
            await addDoc(ticketsRef, {
                userId: currentUser.uid,
                subject: subject,
                category: category,
                priority: priority,
                description: description,
                status: 'open',
                replies: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            
            modal.classList.add('hidden');
            await loadTickets(currentUser.uid);
            
            // Switch to tickets tab
            document.querySelector('[data-tab="tickets"]').click();
            showToast('Ticket created successfully!', 'success');
            
        } catch (error) {
            console.error('Error creating ticket:', error);
            alert('Failed to create ticket. Please try again.');
        }
    });
}

// Load feedback
async function loadFeedback(userId) {
    try {
        const feedbackRef = collection(db, 'feedback');
        const q = query(feedbackRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
        // Remove the limit(5) from the query
        const snapshot = await getDocs(q);
        
        feedbacks = [];
        snapshot.forEach(doc => {
            feedbacks.push({ id: doc.id, ...doc.data() });
        });
        
        // Limit to 5 most recent in display
        displayRecentFeedback();
        
    } catch (error) {
        console.error('Error loading feedback:', error);
    }
}

// Display recent feedback
function displayRecentFeedback() {
    const container = document.getElementById('recentFeedback');
    
    if (feedbacks.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-star text-4xl text-gray-300 mb-2"></i>
                <p class="text-gray-500">No feedback submitted yet</p>
                <p class="text-sm text-gray-400">Share your experience with us!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = feedbacks.map(feedback => `
        <div class="border border-gray-200 rounded-lg p-4 mb-3">
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center space-x-1">
                    ${Array(5).fill().map((_, i) => `
                        <i class="fas fa-star ${i < feedback.rating ? 'text-yellow-400' : 'text-gray-300'} text-sm"></i>
                    `).join('')}
                </div>
                <span class="text-xs text-gray-500">${formatDate(feedback.createdAt)}</span>
            </div>
            <p class="text-sm text-gray-700">${feedback.message}</p>
            <span class="text-xs text-gray-400 mt-2 inline-block">${feedback.category}</span>
        </div>
    `).join('');
}

// Submit feedback
function setupFeedbackForm() {
    const form = document.getElementById('feedbackForm');
    const stars = document.querySelectorAll('.rating-star');
    let selectedRating = 0;
    
    stars.forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.rating);
            stars.forEach(s => s.classList.remove('active'));
            for (let i = 0; i < selectedRating; i++) {
                stars[i].classList.add('active');
            }
            document.getElementById('feedbackRating').value = selectedRating;
        });
    });
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rating = document.getElementById('feedbackRating').value;
        const category = document.getElementById('feedbackCategory').value;
        const message = document.getElementById('feedbackMessage').value.trim();
        
        if (!rating || !category || !message) {
            alert('Please fill in all fields');
            return;
        }
        
        try {
            const feedbackRef = collection(db, 'feedback');
            await addDoc(feedbackRef, {
                userId: currentUser.uid,
                userName: document.getElementById('userName').textContent,
                rating: parseInt(rating),
                category: category,
                message: message,
                createdAt: new Date().toISOString()
            });
            
            form.reset();
            stars.forEach(s => s.classList.remove('active'));
            document.getElementById('feedbackRating').value = '';
            
            await loadFeedback(currentUser.uid);
            showToast('Thank you for your feedback!', 'success');
            
        } catch (error) {
            console.error('Error submitting feedback:', error);
            alert('Failed to submit feedback. Please try again.');
        }
    });
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

// FAQ category filter
function setupFaqCategories() {
    const catBtns = document.querySelectorAll('.faq-cat-btn');
    
    catBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            catBtns.forEach(b => b.classList.remove('active', 'bg-gray-100'));
            btn.classList.add('active', 'bg-gray-100');
            displayFAQs();
        });
    });
    
    // Set default active
    if (catBtns.length) {
        catBtns[0].classList.add('active', 'bg-gray-100');
    }
}

// Scroll to FAQ section
window.scrollToFaq = (category) => {
    // Switch to FAQ tab
    document.querySelector('[data-tab="faq"]').click();
    
    // Activate category
    const catBtn = document.querySelector(`.faq-cat-btn[data-cat="${category}"]`);
    if (catBtn) {
        catBtn.click();
    }
    
    // Scroll to FAQ section
    document.getElementById('faqTab').scrollIntoView({ behavior: 'smooth' });
};

// Tab switching
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = {
        'faq': document.getElementById('faqTab'),
        'tickets': document.getElementById('ticketsTab'),
        'feedback': document.getElementById('feedbackTab')
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
            
            Object.values(tabContents).forEach(content => content.classList.add('hidden'));
            tabContents[tabId].classList.remove('hidden');
        });
    });
}

// Load notifications
async function loadNotifications(userId) {
    try {
        const notificationsRef = collection(db, 'notifications');
        const q = query(notificationsRef, where('userId', '==', userId), where('read', '==', false));
        const snapshot = await getDocs(q);
        document.getElementById('notificationCount').textContent = snapshot.size;
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
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

// Sidebar toggle functionality
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    const mainContent = document.getElementById('mainContent');
    let isCollapsed = false;
    
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState === 'true') {
        toggleSidebar(true);
    }
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            toggleSidebar(!isCollapsed);
        });
    }
    
    function toggleSidebar(collapse) {
        isCollapsed = collapse;
        
        if (isCollapsed) {
            sidebar.classList.remove('sidebar-expanded');
            sidebar.classList.add('sidebar-collapsed');
            mainContent.style.marginLeft = '80px';
            localStorage.setItem('sidebarCollapsed', 'true');
            
            document.querySelectorAll('.nav-text, .user-info, .logo-text').forEach(el => {
                el.style.display = 'none';
            });
            
            document.querySelectorAll('.nav-item').forEach(item => {
                const text = item.querySelector('.nav-text')?.innerText;
                if (text) {
                    item.classList.add('tooltip');
                    item.setAttribute('data-tooltip', text);
                }
            });
            
            toggleBtn.innerHTML = '<i class="fas fa-chevron-right text-xl"></i>';
        } else {
            sidebar.classList.remove('sidebar-collapsed');
            sidebar.classList.add('sidebar-expanded');
            mainContent.style.marginLeft = '280px';
            localStorage.setItem('sidebarCollapsed', 'false');
            
            document.querySelectorAll('.nav-text, .user-info, .logo-text').forEach(el => {
                el.style.display = '';
            });
            
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('tooltip');
                item.removeAttribute('data-tooltip');
            });
            
            toggleBtn.innerHTML = '<i class="fas fa-chevron-left text-xl"></i>';
        }
    }
    
    // Mobile menu
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

// Dropdown setup
function setupDropdowns() {
    const notificationBtn = document.getElementById('notificationBtn');
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    
    if (notificationBtn) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (userDropdown) userDropdown.classList.add('hidden');
        });
    }
    
    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown?.classList.toggle('hidden');
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
    const closeTicketDetail = document.getElementById('closeTicketDetail');
    const ticketDetailModal = document.getElementById('ticketDetailModal');
    
    if (closeTicketDetail) {
        closeTicketDetail.addEventListener('click', () => {
            ticketDetailModal.classList.add('hidden');
        });
    }
    
    ticketDetailModal?.addEventListener('click', (e) => {
        if (e.target === ticketDetailModal) {
            ticketDetailModal.classList.add('hidden');
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

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupFaqCategories();
    setupTicketModal();
    setupFeedbackForm();
    setupSidebar();
    setupDropdowns();
    setupModals();
    
    // Logout handlers
    const logoutBtns = document.querySelectorAll('#logoutBtn, #logoutDropdown');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    });
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            displayFAQs();
        });
    }
});

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
`;
document.head.appendChild(style);