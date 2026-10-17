import { 
    auth, signOut, db, collection, addDoc, getDocs, query, orderBy, limit,
    onAuthStateChanged, doc, getDoc, where, Timestamp
} from '../firebase-config.js';

let currentAdmin = null;
let currentPreviewData = null;

// Signature images paths
const SIGNATURES = {
    executiveDirector: '../images/signatures/executive-director.png',
    softwareDevelopment: '../images/signatures/head-software.png',
    graphicsMultimedia: '../images/signatures/head-graphics.png',
    dataAnalysis: '../images/signatures/head-data.png',
    digitalMarketing: '../images/signatures/head-marketing.png',
    cybersecurity: '../images/signatures/head-cyber.png',
    networkCloud: '../images/signatures/head-network.png',
    digitalSkills: '../images/signatures/head-digital.png'
};

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../login.html';
        return;
    }
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && (userDoc.data().role === 'admin' || userDoc.data().role === 'super_admin')) {
        currentAdmin = user;
        await loadAdminData(user.uid);
        await loadRecentCertificates();
        await loadNotifications(user.uid);
        setDefaultDate();
        setupEventListeners();
        setupModeToggle();
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

// Set default date to today
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('issueDate').value = today;
}

// Generate unique certificate ID
function generateCertificateId() {
    const prefix = 'DBI';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${timestamp}-${random}`;
}

// Get form data
function getFormData() {
    const certType = document.querySelector('input[name="certType"]:checked').value;
    let certificateId = document.getElementById('certificateId').value.trim();
    
    if (!certificateId) {
        certificateId = generateCertificateId();
        document.getElementById('certificateId').value = certificateId;
    }
    
    return {
        certificateId: certificateId,
        certType: certType,
        studentName: document.getElementById('studentName').value.trim(),
        studentEmail: document.getElementById('studentEmail').value.trim(),
        courseTitle: document.getElementById('courseTitle').value.trim(),
        department: document.getElementById('department').value,
        score: parseInt(document.getElementById('score').value) || 85,
        issueDate: document.getElementById('issueDate').value,
        achievementDesc: document.getElementById('achievementDesc').value,
        eventName: document.getElementById('eventName').value,
        eventDate: document.getElementById('eventDate').value,
        eventDuration: document.getElementById('eventDuration').value,
        issuedBy: currentAdmin?.uid || 'admin',
        issuedAt: new Date().toISOString()
    };
}

// Get achievement level
function getAchievementLevel(score) {
    if (score >= 90) {
        return { name: 'Platinum', icon: '🏆', bgGradient: 'linear-gradient(135deg, #6b7280, #4b5563)', color: '#6b7280' };
    } else if (score >= 80) {
        return { name: 'Gold', icon: '🥇', bgGradient: 'linear-gradient(135deg, #fbbf24, #d97706)', color: '#fbbf24' };
    } else if (score >= 70) {
        return { name: 'Silver', icon: '🥈', bgGradient: 'linear-gradient(135deg, #94a3b8, #64748b)', color: '#94a3b8' };
    } else if (score >= 60) {
        return { name: 'Bronze', icon: '🥉', bgGradient: 'linear-gradient(135deg, #cd7f32, #b87333)', color: '#cd7f32' };
    } else {
        return { name: 'Achiever', icon: '🌟', bgGradient: 'linear-gradient(135deg, #1e88e5, #00c853)', color: '#1e88e5' };
    }
}

// Get department head
function getDepartmentHead(department) {
    const heads = {
        'Software Development': { name: 'Benjamin Amoako', title: 'Head of Software Development', department: 'DigitalCore' },
        'Graphics & Multimedia': { name: 'Abel Eduah', title: 'Head of Graphics & Multimedia', department: 'Creative Impact' },
        'Data Analysis': { name: 'Godsway Arhin', title: 'Head of Data Analysis', department: 'Next Gen DATA-LAB' }
    };
    return heads[department] || { name: 'Benjamin Amoako', title: 'Head of Department', department: 'DigitalBridge Academy' };
}

// Get signature image
function getSignatureImage(department) {
    const signatureMap = {
        'Software Development': SIGNATURES.softwareDevelopment,
        'Graphics & Multimedia': SIGNATURES.graphicsMultimedia,
        'Data Analysis': SIGNATURES.dataAnalysis,
        'Digital Marketing': SIGNATURES.digitalMarketing,
        'Cybersecurity': SIGNATURES.cybersecurity,
        'Network & Cloud': SIGNATURES.networkCloud,
        'Digital Skills': SIGNATURES.digitalSkills
    };
    return signatureMap[department] || SIGNATURES.digitalSkills;
}



// Generate certificate HTML
function generateCertificateHTML(data) {
    const level = getAchievementLevel(data.score);
    const departmentHead = getDepartmentHead(data.department);
    const issueDate = new Date(data.issueDate);
    const formattedDate = issueDate.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    
    let certTitle = 'Certificate of Completion';
    let certSubtitle = 'for successfully completing';
    let specialText = '';
    
    if (data.certType === 'achievement') {
        certTitle = 'Certificate of Achievement';
        certSubtitle = 'in recognition of';
        if (data.achievementDesc) {
            specialText = `<div class="text-center mt-3">
                <span class="inline-block px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">
                    🏆 ${escapeHtml(data.achievementDesc)}
                </span>
            </div>`;
        }
    } else if (data.certType === 'participation') {
        certTitle = 'Certificate of Participation';
        certSubtitle = 'for active participation in';
        if (data.eventName) {
            specialText = `<div class="text-center mt-3">
                <span class="inline-block px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                    📅 ${escapeHtml(data.eventName)}${data.eventDate ? ' • ' + data.eventDate : ''}
                </span>
            </div>`;
        }
    }
    
    const verificationUrl = `https://dbi-learn.pages.dev/verify-certificate?id=${data.certificateId}`;
    const qrContainerId = `qrContainer_${Date.now()}`;
    
    return `
        <div class="certificate-container" style="background: white; width: 100%; max-width: 800px; margin: 0 auto; font-family: 'Inter', sans-serif; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
            <div style="position: relative; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);">
                <div style="position: absolute; top: 15px; left: 15px; right: 15px; bottom: 15px; border: 2px solid #1e88e5; border-radius: 12px; pointer-events: none;"></div>
                <div style="position: absolute; top: 20px; left: 20px; right: 20px; bottom: 20px; border: 1px solid #00c853; border-radius: 8px; pointer-events: none;"></div>
                
                <div style="position: absolute; top: 25px; left: 25px;">
                    <div style="width: 40px; height: 40px; border-top: 3px solid #1e88e5; border-left: 3px solid #1e88e5;"></div>
                </div>
                <div style="position: absolute; top: 25px; right: 25px;">
                    <div style="width: 40px; height: 40px; border-top: 3px solid #00c853; border-right: 3px solid #00c853;"></div>
                </div>
                <div style="position: absolute; bottom: 25px; left: 25px;">
                    <div style="width: 40px; height: 40px; border-bottom: 3px solid #00c853; border-left: 3px solid #00c853;"></div>
                </div>
                <div style="position: absolute; bottom: 25px; right: 25px;">
                    <div style="width: 40px; height: 40px; border-bottom: 3px solid #1e88e5; border-right: 3px solid #1e88e5;"></div>
                </div>
                
                <div style="padding: 50px 40px 40px 40px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="../images/digital-bridge-initiative-logo.png" alt="DBI Logo" style="height: 60px; width: auto; margin: 0 auto;">
                        <p style="color: #6b7280; font-size: 12px; margin-top: 8px;">Bridging the Digital Divide Through Excellence</p>
                        <div style="width: 80px; height: 2px; background: linear-gradient(90deg, #1e88e5, #00c853); margin: 10px auto 0;"></div>
                    </div>
                    
                    <div style="text-align: center; margin: 20px 0;">
                        <h2 style="color: #6b7280; font-size: 24px; font-weight: 300; margin: 0;">${certTitle}</h2>
                        <h1 style="color: #1e88e5; font-size: 42px; font-weight: 700; margin: 5px 0 0; letter-spacing: 2px;">
                            ${data.certType === 'completion' ? 'Completion' : data.certType === 'achievement' ? 'Achievement' : 'Participation'}
                        </h1>
                    </div>
                    
                    <div style="text-align: center; margin: 15px 0;">
                        <div style="display: inline-flex; align-items: center; padding: 8px 24px;
                            <span style="font-size: 20px; margin-right: 8px;">${level.icon}</span>
                            <span style="font-weight: 600;">${level.name} Level Achievement</span>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin: 25px 0 20px;">
                        <p style="color: #6b7280; font-size: 16px; margin: 0;">This certificate is proudly presented to</p>
                        <h3 style="color: #00335f; font-size: 28px; font-weight: 700; margin: 10px 0 0; border-bottom: 2px solid #00c853; display: inline-block; padding-bottom: 5px;">
                            ${escapeHtml(data.studentName)}
                        </h3>
                    </div>
                    
                    <div style="text-align: center; margin: 20px 0;">
                        <p style="color: #6b7280; font-size: 14px;">${certSubtitle}</p>
                        <h4 style="color: #1e88e5; font-size: 20px; font-weight: 600; margin: 8px 0 10px;">${escapeHtml(data.courseTitle)}</h4>
                        <div style="display: inline-block; padding: 4px 16px; background: #f3f4f6; border-radius: 20px;">
                            <span style="color: #00335f; font-size: 12px;">${data.department} Track</span>
                        </div>
                    </div>
                    
                    ${specialText}
                    
                    ${data.certType === 'completion' ? `
                        <div style="text-align: center; margin: 15px auto;">
                            <div style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; background: #f8fafc; border-radius: 30px;">
                                <span style="color: #6b7280; font-size: 12px;">Final Score:</span>
                                <span style="font-weight: 700; color: #1e88e5; font-size: 18px;">${data.score}%</span>
                                <span style="color: #6b7280; font-size: 11px;">(Passing: 70%)</span>
                            </div>
                        </div>
                    ` : ''}
                    
                    <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
                        <div style="text-align: center; flex: 1;">
                            <div style="margin-bottom: 5px; min-height: 60px;">
                                <img src="${SIGNATURES.executiveDirector}" 
                                     alt="Executive Director Signature" 
                                     style="height: 50px; width: auto; margin: 0 auto; object-fit: contain;"
                                     onerror="this.style.display='none'">
                                <div style="width: 120px; height: 1px; background: #6b7280; margin: 5px auto;"></div>
                                <div style="color: #6b7280; font-size: 10px;">Digitally Signed</div>
                            </div>
                            <p style="font-weight: 600; color: #00335f; font-size: 12px;">Benjamin Amoako</p>
                            <p style="color: #1e88e5; font-size: 10px;">Executive Director</p>
                            <p style="color: #6b7280; font-size: 9px;">Digital Bridge Initiative</p>
                        </div>
                        
                        <div style="text-align: center; flex: 1;">
                            <div id="${qrContainerId}" style="width: 80px; height: 80px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid #1e88e5; overflow: hidden;"></div>
                            <p style="color: #6b7280; font-size: 9px; margin-top: 8px;">Scan to Verify</p>
                            <p style="color: #6b7280; font-size: 9px; font-family: monospace;">ID: ${data.certificateId.slice(0, 20)}</p>
                        </div>
                        
                        <div style="text-align: center; flex: 1;">
                            <div style="margin-bottom: 5px; min-height: 60px;">
                                <img src="${getSignatureImage(data.department)}" 
                                     alt="${departmentHead.title} Signature" 
                                     style="height: 50px; width: auto; margin: 0 auto; object-fit: contain;"
                                     onerror="this.style.display='none'">
                                <div style="width: 120px; height: 1px; background: #6b7280; margin: 5px auto;"></div>
                                <div style="color: #6b7280; font-size: 10px;">Digitally Signed</div>
                            </div>
                            <p style="font-weight: 600; color: #00335f; font-size: 12px;">${departmentHead.name}</p>
                            <p style="color: #1e88e5; font-size: 10px;">${departmentHead.title}</p>
                            <p style="color: #6b7280; font-size: 9px;">${departmentHead.department}</p>
                        </div>
                    </div>
                    
                    <div style="margin-top: 25px; text-align: center;">
                        <div style="display: inline-flex; align-items: center; gap: 8px;">
                            <i class="fas fa-certificate" style="color: #1e88e5; font-size: 12px;"></i>
                            <span style="color: #6b7280; font-size: 10px;">Digitally Verified Certificate</span>
                            <i class="fas fa-shield-alt" style="color: #00c853; font-size: 12px;"></i>
                        </div>
                        <p style="color: #d1d5db; font-size: 8px; margin-top: 10px;">Issued: ${formattedDate}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Generate QR code
async function generateQRCode(text, containerId) {
    try {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        if (typeof QRCode === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        if (typeof QRCode !== 'undefined') {
            new QRCode(container, {
                text: text,
                width: 80,
                height: 80,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    } catch (error) {
        console.error('QR generation error:', error);
    }
}

// Download certificate as PDF
async function downloadCertificateAsPDF(certificateData) {
    const btn = event?.target?.closest('button');
    const originalText = btn?.innerHTML || 'Download';
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Generating PDF...';
        btn.disabled = true;
    }
    
    try {
        const container = document.createElement('div');
        container.innerHTML = generateCertificateHTML(certificateData);
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '-9999px';
        container.style.backgroundColor = 'white';
        container.style.width = '800px';
        document.body.appendChild(container);
        
        // Find QR container and generate QR code
        const qrDiv = container.querySelector('[id*="qrContainer_"]');
        if (qrDiv) {
            const verificationUrl = `https://dbi-learn.pages.dev/verify-certificate?id=${certificateData.certificateId}`;
            qrDiv.innerHTML = '';
            
            if (typeof QRCode === 'undefined') {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }
            
            if (typeof QRCode !== 'undefined') {
                new QRCode(qrDiv, {
                    text: verificationUrl,
                    width: 80,
                    height: 80,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const canvas = await html2canvas(container, {
            scale: 3,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true
        });
        
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        const pdfWidth = 210;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${certificateData.courseTitle.replace(/[^a-z0-9]/gi, '_')}_${certificateData.studentName.replace(/\s/g, '_')}_Certificate.pdf`);
        
        document.body.removeChild(container);
        showToast('Certificate downloaded successfully!', 'success');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        showToast('Failed to generate PDF. Please try again.', 'error');
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

// Preview certificate
async function previewCertificate() {
    const formData = getFormData();
    if (!formData.studentName || !formData.courseTitle) {
        showToast('Please fill in student name and course/event title', 'error');
        return;
    }
    
    currentPreviewData = formData;
    const previewHtml = generateCertificateHTML(formData);
    document.getElementById('previewContainer').innerHTML = previewHtml;
    
    setTimeout(() => {
        const qrContainer = document.getElementById('previewContainer').querySelector('[id^="qrContainer_"]');
        if (qrContainer) {
            const verificationUrl = `https://dbi-learn.pages.dev/verify-certificate?id=${formData.certificateId}`;
            generateQRCode(verificationUrl, qrContainer.id);
        }
    }, 100);
}

// Show certificate in modal
function showCertificateInModal(certificateData) {
    const modal = document.getElementById('certificateModal');
    const content = document.getElementById('modalCertificateContent');
    content.innerHTML = generateCertificateHTML(certificateData);
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        const qrContainer = document.getElementById('modalCertificateContent').querySelector('[id^="qrContainer_"]');
        if (qrContainer) {
            const verificationUrl = `https://dbi-learn.pages.dev/verify-certificate?id=${certificateData.certificateId}`;
            generateQRCode(verificationUrl, qrContainer.id);
        }
    }, 100);
}

// Save certificate to database
async function saveCertificate(formData) {
    // Check if student exists, if not create a basic user record
    const usersRef = collection(db, 'users');
    const userQuery = query(usersRef, where('email', '==', formData.studentEmail));
    const userSnapshot = await getDocs(userQuery);
    
    let studentId = null;
    if (userSnapshot.empty) {
        const newStudent = {
            fullName: formData.studentName,
            email: formData.studentEmail,
            role: 'student',
            createdAt: Timestamp.now(),
            createdManually: true
        };
        const newStudentDoc = await addDoc(collection(db, 'users'), newStudent);
        studentId = newStudentDoc.id;
    } else {
        studentId = userSnapshot.docs[0].id;
    }
    
    // Save certificate
    const certificateData = {
        certificateId: formData.certificateId,
        certType: formData.certType,
        studentId: studentId,
        studentName: formData.studentName,
        studentEmail: formData.studentEmail,
        courseTitle: formData.courseTitle,
        courseId: null,
        department: formData.department,
        score: formData.score,
        passMark: 70,
        issuedAt: new Date(formData.issueDate).toISOString(),
        createdAt: Timestamp.now(),
        issuedBy: formData.issuedBy,
        manuallyCreated: true,
        achievementDesc: formData.achievementDesc || null,
        eventName: formData.eventName || null,
        eventDate: formData.eventDate || null,
        eventDuration: formData.eventDuration || null,
        verificationUrl: `https://dbi-learn.pages.dev/verify-certificate?id=${formData.certificateId}`
    };
    
    await addDoc(collection(db, 'certificates'), certificateData);
    return certificateData;
}

// Load recent certificates
async function loadRecentCertificates() {
    try {
        const certificatesRef = collection(db, 'certificates');
        const q = query(certificatesRef, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        
        const container = document.getElementById('recentList');
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="p-6 text-center text-gray-500">
                    <i class="fas fa-certificate text-3xl mb-2 opacity-50"></i>
                    <p>No certificates generated yet</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const cert = doc.data();
            const date = cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString() : 'N/A';
            const typeIcon = cert.certType === 'achievement' ? '🏆' : cert.certType === 'participation' ? '🤝' : '🎓';
            
            container.innerHTML += `
                <div class="p-4 hover:bg-gray-50 transition">
                    <div class="flex items-center justify-between">
                        <div class="flex-1 cursor-pointer" onclick="window.viewCertificateDetails('${cert.certificateId}', ${JSON.stringify(cert).replace(/"/g, '&quot;')})">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="text-lg">${typeIcon}</span>
                                <p class="font-medium text-gray-800">${escapeHtml(cert.studentName)}</p>
                            </div>
                            <p class="text-sm text-gray-600 truncate">${escapeHtml(cert.courseTitle)}</p>
                            <p class="text-xs text-gray-400 font-mono mt-1">${cert.certificateId}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-xs text-gray-500">${date}</p>
                            <button onclick="window.downloadCertificateFromData(${JSON.stringify(cert).replace(/"/g, '&quot;')})" class="text-green-500 text-xs mt-1 hover:text-green-700">
                                <i class="fas fa-download"></i> PDF
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
    } catch (error) {
        console.error('Error loading recent certificates:', error);
        document.getElementById('recentList').innerHTML = `
            <div class="p-6 text-center text-red-500">
                <i class="fas fa-exclamation-circle"></i>
                <p>Failed to load recent certificates</p>
            </div>
        `;
    }
}

// Load notifications
async function loadNotifications(userId) {
    try {
        const notificationsRef = collection(db, 'notifications');
        const q = query(notificationsRef, where('userId', '==', userId), where('read', '==', false));
        const snapshot = await getDocs(q);
        const countElement = document.getElementById('notificationCount');
        if (countElement) countElement.textContent = snapshot.size;
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
        type === 'success' ? 'bg-green-500 text-white' : 
        type === 'error' ? 'bg-red-500 text-white' : 
        'bg-gray-800 text-white'
    }`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Copy to clipboard
window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Certificate ID copied!', 'success');
};

// Download certificate from data
window.downloadCertificateFromData = async (certData) => {
    await downloadCertificateAsPDF(certData);
};

// View certificate details
window.viewCertificateDetails = (certId, certData) => {
    showCertificateInModal(certData);
};

// Certificate type toggle for single mode
function setupCertTypeToggle() {
    const certTypeRadios = document.querySelectorAll('input[name="certType"]');
    const achievementDetails = document.getElementById('achievementDetails');
    const participationDetails = document.getElementById('participationDetails');
    const courseTitleInput = document.getElementById('courseTitle');
    
    certTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            achievementDetails.classList.add('hidden');
            participationDetails.classList.add('hidden');
            
            if (e.target.value === 'achievement') {
                achievementDetails.classList.remove('hidden');
                courseTitleInput.placeholder = 'e.g., Outstanding Performance Award';
            } else if (e.target.value === 'participation') {
                participationDetails.classList.remove('hidden');
                courseTitleInput.placeholder = 'e.g., Digital Marketing Workshop';
            } else {
                courseTitleInput.placeholder = 'e.g., Full Stack Web Development';
            }
        });
    });
}

// Mode toggle between single and bulk
function setupModeToggle() {
    const modeBtns = document.querySelectorAll('.mode-btn');
    const singleMode = document.getElementById('singleMode');
    const bulkMode = document.getElementById('bulkMode');
    
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            
            modeBtns.forEach(b => {
                b.classList.remove('active', 'text-[#1e88e5]', 'border-b-2', 'border-[#1e88e5]');
                b.classList.add('text-gray-500');
            });
            btn.classList.add('active', 'text-[#1e88e5]', 'border-b-2', 'border-[#1e88e5]');
            btn.classList.remove('text-gray-500');
            
            if (mode === 'single') {
                singleMode.classList.remove('hidden');
                bulkMode.classList.add('hidden');
            } else {
                singleMode.classList.add('hidden');
                bulkMode.classList.remove('hidden');
            }
        });
    });
}

// Bulk generation functions
function setupBulkGeneration() {
    const uploadBtn = document.getElementById('uploadCsvBtn');
    const csvFile = document.getElementById('csvFile');
    const generateBulkBtn = document.getElementById('generateBulkBtn');
    const downloadTemplateBtn = document.getElementById('downloadCsvTemplateBtn');
    
    uploadBtn.addEventListener('click', () => {
        csvFile.click();
    });
    
    csvFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            parseCSV(file);
        }
    });
    
    downloadTemplateBtn.addEventListener('click', () => {
        downloadCSVTemplate();
    });
    
    generateBulkBtn.addEventListener('click', () => {
        generateBulkCertificates();
    });
}

let csvData = [];

function parseCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        csvData = [];
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = lines[i].split(',');
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] ? values[index].trim() : '';
                });
                if (row.name) {
                    csvData.push({
                        name: row.name,
                        email: row.email || '',
                        score: row.score ? parseInt(row.score) : parseInt(document.getElementById('bulkScore').value)
                    });
                }
            }
        }
        
        displayCSVPreview();
    };
    reader.readAsText(file);
}

function displayCSVPreview() {
    const previewDiv = document.getElementById('csvPreview');
    const tbody = document.querySelector('#csvPreviewTable tbody');
    
    tbody.innerHTML = '';
    csvData.forEach(row => {
        tbody.innerHTML += `
            <tr>
                <td class="px-2 py-1">${escapeHtml(row.name)}</td>
                <td class="px-2 py-1">${escapeHtml(row.email)}</td>
                <td class="px-2 py-1">${row.score || 85}%</td>
            </tr>
        `;
    });
    
    previewDiv.classList.remove('hidden');
    showToast(`Loaded ${csvData.length} students from CSV`, 'success');
}

function downloadCSVTemplate() {
    const template = `Name,Email,Score\nJohn Doe,john@example.com,85\nJane Smith,jane@example.com,92`;
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'certificate_template.csv';
    a.click();
    URL.revokeObjectURL(url);
}

async function generateBulkCertificates() {
    if (csvData.length === 0) {
        showToast('Please upload a CSV file first', 'error');
        return;
    }
    
    const certType = document.querySelector('input[name="bulkCertType"]:checked').value;
    const courseTitle = document.getElementById('bulkCourseTitle').value;
    const department = document.getElementById('bulkDepartment').value;
    const defaultScore = parseInt(document.getElementById('bulkScore').value);
    const issueDate = document.getElementById('issueDate').value;
    
    if (!courseTitle) {
        showToast('Please enter course/event title', 'error');
        return;
    }
    
    const progressDiv = document.getElementById('bulkProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const resultsDiv = document.getElementById('bulkResults');
    
    progressDiv.classList.remove('hidden');
    resultsDiv.innerHTML = '';
    
    let successCount = 0;
    let failCount = 0;
    const results = [];
    
    for (let i = 0; i < csvData.length; i++) {
        const student = csvData[i];
        const progress = ((i + 1) / csvData.length) * 100;
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${i + 1}/${csvData.length}`;
        
        try {
            const certificateId = generateCertificateId();
            const formData = {
                certificateId: certificateId,
                certType: certType,
                studentName: student.name,
                studentEmail: student.email || `${student.name.toLowerCase().replace(/\s/g, '')}@example.com`,
                courseTitle: courseTitle,
                department: department,
                score: student.score || defaultScore,
                issueDate: issueDate,
                achievementDesc: '',
                eventName: '',
                eventDate: '',
                eventDuration: '',
                issuedBy: currentAdmin.uid,
                issuedAt: new Date().toISOString()
            };
            
            await saveCertificate(formData);
            successCount++;
            results.push({ ...formData, success: true });
            
            // Add result to display
            resultsDiv.innerHTML += `
                <div class="p-3 border-b hover:bg-gray-50">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="font-medium text-sm">${escapeHtml(student.name)}</p>
                            <p class="text-xs text-gray-500 font-mono">${certificateId}</p>
                        </div>
                        <span class="text-green-500 text-sm"><i class="fas fa-check-circle"></i> Generated</span>
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.error(`Failed for ${student.name}:`, error);
            failCount++;
            results.push({ ...student, success: false, error: error.message });
            
            resultsDiv.innerHTML += `
                <div class="p-3 border-b hover:bg-gray-50">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="font-medium text-sm">${escapeHtml(student.name)}</p>
                            <p class="text-xs text-red-500">${error.message}</p>
                        </div>
                        <span class="text-red-500 text-sm"><i class="fas fa-times-circle"></i> Failed</span>
                    </div>
                </div>
            `;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    progressDiv.classList.add('hidden');
    showToast(`Completed! ${successCount} successful, ${failCount} failed`, successCount > 0 ? 'success' : 'error');
    await loadRecentCertificates();
}

// Setup all event listeners
function setupEventListeners() {
    // Generate ID button
    document.getElementById('generateIdBtn').addEventListener('click', () => {
        document.getElementById('certificateId').value = generateCertificateId();
        showToast('Certificate ID generated!', 'success');
    });
    
    // Preview button
    document.getElementById('previewBtn').addEventListener('click', previewCertificate);
    
    // Download preview button
    document.getElementById('downloadPreviewBtn').addEventListener('click', async () => {
        if (currentPreviewData) {
            await downloadCertificateAsPDF(currentPreviewData);
        } else {
            showToast('Please preview the certificate first', 'error');
        }
    });
    
    // Download from viewer button
    document.getElementById('downloadPreviewFromViewerBtn').addEventListener('click', async () => {
        if (currentPreviewData) {
            await downloadCertificateAsPDF(currentPreviewData);
        } else {
            showToast('Please preview the certificate first', 'error');
        }
    });
    
    // Refresh recent button
    document.getElementById('refreshRecentBtn').addEventListener('click', () => {
        loadRecentCertificates();
        showToast('Refreshed!', 'success');
    });
    
    // Modal buttons
    document.getElementById('closeModalBtn').addEventListener('click', () => {
        document.getElementById('certificateModal').classList.add('hidden');
    });
    
    document.getElementById('modalDownloadBtn').addEventListener('click', async () => {
        const modalContent = document.getElementById('modalCertificateContent');
        const certData = currentPreviewData;
        if (certData) {
            await downloadCertificateAsPDF(certData);
        }
    });
    
    document.getElementById('modalPrintBtn').addEventListener('click', () => {
        const modalContent = document.getElementById('modalCertificateContent');
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Certificate</title>
                <style>
                    @media print {
                        body { margin: 0; padding: 0; }
                        @page { size: A4; margin: 0; }
                    }
                    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                </style>
            </head>
            <body>${modalContent.innerHTML}</body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    });
    
    // Form submission
    document.getElementById('certificateForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = getFormData();
        
        if (!formData.studentName || !formData.courseTitle || !formData.studentEmail) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';
        submitBtn.disabled = true;
        
        try {
            // Check if certificate with same ID already exists
            const certificatesRef = collection(db, 'certificates');
            const q = query(certificatesRef, where('certificateId', '==', formData.certificateId));
            const existingSnapshot = await getDocs(q);
            
            if (!existingSnapshot.empty) {
                showToast('Certificate ID already exists. Please generate a new ID.', 'error');
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                return;
            }
            
            await saveCertificate(formData);
            showToast(`Certificate generated successfully! ID: ${formData.certificateId}`, 'success');
            
            // Reset form (keep certificate ID)
            document.getElementById('studentName').value = '';
            document.getElementById('studentEmail').value = '';
            document.getElementById('courseTitle').value = '';
            document.getElementById('achievementDesc').value = '';
            document.getElementById('eventName').value = '';
            document.getElementById('eventDate').value = '';
            document.getElementById('eventDuration').value = '';
            document.getElementById('score').value = '85';
            document.getElementById('certificateId').value = generateCertificateId();
            
            await loadRecentCertificates();
            await previewCertificate();
            
        } catch (error) {
            console.error('Error saving certificate:', error);
            showToast('Failed to save certificate: ' + error.message, 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
    
    // Certificate type toggle
    setupCertTypeToggle();
    
    // Bulk generation setup
    setupBulkGeneration();
    
    // Sidebar setup
    setupSidebar();
    setupDropdowns();
    
    // Logout
    document.querySelectorAll('#logoutBtn, #logoutDropdown').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            await logout();
        });
    });
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
            document.querySelectorAll('.nav-text, .admin-info, .logo-text').forEach(el => {
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
            sidebar.classList.add('sidebar-expanded');
            sidebar.classList.remove('sidebar-collapsed');
            mainContent.style.marginLeft = '280px';
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
            sidebar.classList.add('mobile-open');
            mobileOverlay.classList.remove('hidden');
        });
        mobileOverlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            mobileOverlay.classList.add('hidden');
        });
    }
}

// Dropdown setup
function setupDropdowns() {
    const btn = document.getElementById('adminMenuBtn');
    const dropdown = document.getElementById('adminDropdown');
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

// Logout
async function logout() {
    try {
        await signOut(auth);
        window.location.href = '../../login.html';
    } catch (error) {
        console.error('Error logging out:', error);
    }
}