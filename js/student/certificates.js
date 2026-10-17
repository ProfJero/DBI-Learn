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
    orderBy
} from '../firebase-config.js';

let currentUser = null;
let certificates = [];
let currentCertificate = null;

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

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../login.html';
    } else {
        currentUser = user;
        await loadUserData(user.uid);
        await loadCertificates(user.uid);
        await loadUserPerformance(user.uid);
        await loadNotifications(user.uid);
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

// Load user performance data
async function loadUserPerformance(userId) {
    try {
        if (certificates.length > 0) {
            const avgScore = certificates.reduce((sum, c) => sum + (c.score || 75), 0) / certificates.length;
            updateAchievementMilestone(avgScore);
        }
    } catch (error) {
        console.error('Error loading performance:', error);
    }
}

// Load certificates
async function loadCertificates(userId) {
    try {
        const certificatesRef = collection(db, 'certificates');
        const q = query(certificatesRef, where('studentId', '==', userId), orderBy('issuedAt', 'desc'));
        const snapshot = await getDocs(q);
        
        certificates = [];
        snapshot.forEach(doc => {
            const certData = { id: doc.id, ...doc.data() };
            if (!certData.score) certData.score = 75;
            certificates.push(certData);
        });
        
        updateStats();
        displayCertificates();
        
        const avgScore = certificates.length > 0 
            ? certificates.reduce((sum, c) => sum + (c.score || 75), 0) / certificates.length 
            : 0;
        updateAchievementMilestone(avgScore);
        
    } catch (error) {
        console.error('Error loading certificates:', error);
        displayEmptyState();
    }
}

// Update statistics
function updateStats() {
    const total = certificates.length;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyCount = certificates.filter(cert => {
        const certDate = new Date(cert.issuedAt);
        return certDate.getMonth() === currentMonth && certDate.getFullYear() === currentYear;
    }).length;
    
    document.getElementById('totalCertificates').textContent = total;
    document.getElementById('monthlyCertificates').textContent = monthlyCount;
    
    const achievementPoints = certificates.reduce((sum, c) => sum + (c.score || 75), 0);
    document.getElementById('skillPoints').textContent = Math.round(achievementPoints);
}

// Determine achievement level based on score
function getAchievementLevel(score) {
    if (score >= 90) {
        return { name: 'Platinum', icon: '🏆', color: '#6b7280', bgGradient: 'linear-gradient(135deg, #6b7280, #4b5563)', borderColor: '#6b7280' };
    } else if (score >= 80) {
        return { name: 'Gold', icon: '🥇', color: '#fbbf24', bgGradient: 'linear-gradient(135deg, #fbbf24, #d97706)', borderColor: '#fbbf24' };
    } else if (score >= 70) {
        return { name: 'Silver', icon: '🥈', color: '#94a3b8', bgGradient: 'linear-gradient(135deg, #94a3b8, #64748b)', borderColor: '#94a3b8' };
    } else if (score >= 60) {
        return { name: 'Bronze', icon: '🥉', color: '#cd7f32', bgGradient: 'linear-gradient(135deg, #cd7f32, #b87333)', borderColor: '#cd7f32' };
    } else {
        return { name: 'Achiever', icon: '🌟', color: '#1e88e5', bgGradient: 'linear-gradient(135deg, #1e88e5, #00c853)', borderColor: '#1e88e5' };
    }
}

// Display certificates
function displayCertificates() {
    const gridContainer = document.getElementById('gridView');
    const listContainer = document.getElementById('listViewContainer');
    const emptyState = document.getElementById('emptyState');
    
    if (certificates.length === 0) {
        gridContainer.classList.add('hidden');
        document.getElementById('listView').classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    gridContainer.classList.remove('hidden');
    
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const filtered = certificates.filter(cert => 
        cert.courseTitle?.toLowerCase().includes(searchTerm) ||
        cert.certificateId?.toLowerCase().includes(searchTerm)
    );
    
    gridContainer.innerHTML = filtered.map(cert => {
        const level = getAchievementLevel(cert.score || 75);
        return `
            <div class="certificate-card bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition border border-gray-200" onclick="window.viewCertificate('${cert.id}')">
                <div class="relative h-32 p-4" style="background: ${level.bgGradient}">
                    <div class="flex justify-between items-start">
                        <span class="text-3xl">${level.icon}</span>
                        <span class="text-white text-xs bg-white/20 px-2 py-1 rounded-full">
                            ${new Date(cert.issuedAt).toLocaleDateString()}
                        </span>
                    </div>
                    <div class="absolute bottom-4 left-4 right-4">
                        <div class="text-white text-sm font-semibold truncate">${escapeHtml(cert.courseTitle)}</div>
                    </div>
                </div>
                <div class="p-4">
                    <div class="flex items-center justify-between mb-3">
                        <div>
                            <p class="text-xs text-gray-500">Certificate ID</p>
                            <p class="text-xs font-mono text-gray-600">${cert.certificateId?.slice(0, 12)}...</p>
                        </div>
                        <div class="text-right">
                            <p class="text-xs text-gray-500">Achievement</p>
                            <p class="text-sm font-semibold" style="color: ${level.color}">${level.name}</p>
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="event.stopPropagation(); window.downloadCertificate('${cert.id}')" 
                                class="flex-1 py-2 text-sm border border-[#1e88e5] text-[#1e88e5] rounded-lg hover:bg-[#1e88e5] hover:text-white transition">
                            <i class="fas fa-download mr-1"></i> Download
                        </button>
                        <button onclick="event.stopPropagation(); window.shareCertificate('${cert.id}')" 
                                class="flex-1 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition">
                            <i class="fas fa-share-alt mr-1"></i> Share
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    listContainer.innerHTML = filtered.map(cert => {
        const level = getAchievementLevel(cert.score || 75);
        return `
            <div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer" onclick="window.viewCertificate('${cert.id}')">
                <div class="flex items-center justify-between flex-wrap gap-4">
                    <div class="flex items-center space-x-4 flex-1">
                        <div class="w-12 h-12 rounded-lg flex items-center justify-center" style="background: ${level.bgGradient}">
                            <span class="text-xl">${level.icon}</span>
                        </div>
                        <div>
                            <h3 class="font-semibold text-gray-800">${escapeHtml(cert.courseTitle)}</h3>
                            <p class="text-xs text-gray-500 mt-1">Certificate ID: ${cert.certificateId}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <div class="text-right">
                            <p class="text-sm font-semibold" style="color: ${level.color}">${level.name}</p>
                            <p class="text-xs text-gray-500">${new Date(cert.issuedAt).toLocaleDateString()}</p>
                        </div>
                        <div class="flex space-x-2">
                            <button onclick="event.stopPropagation(); window.downloadCertificate('${cert.id}')" 
                                    class="px-3 py-1 text-sm border border-[#1e88e5] text-[#1e88e5] rounded-lg hover:bg-[#1e88e5] hover:text-white transition">
                                <i class="fas fa-download"></i>
                            </button>
                            <button onclick="event.stopPropagation(); window.shareCertificate('${cert.id}')" 
                                    class="px-3 py-1 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition">
                                <i class="fas fa-share-alt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// View certificate details
window.viewCertificate = async (certificateId) => {
    const certificate = certificates.find(c => c.id === certificateId);
    if (!certificate) return;
    
    currentCertificate = certificate;
    
    const previewContainer = document.getElementById('certificatePreview');
    const modal = document.getElementById('certificateModal');
    
    previewContainer.innerHTML = generateCertificateHTML(certificate);
    
    // Generate QR code after HTML is inserted
    const verificationUrl = `https://dbi-learn.pages.dev/verify-certificate?id=${certificate.certificateId}`;
    setTimeout(() => {
        generateQRCode(verificationUrl);
    }, 200);
    
    modal.classList.remove('hidden');
};

// Generate certificate HTML
function generateCertificateHTML(certificate) {
    const score = certificate.score || 75;
    const level = getAchievementLevel(score);
    const department = certificate.department || determineDepartment(certificate.courseTitle);
    const departmentHead = getDepartmentHead(department);
    
    const issueDate = certificate.issuedAt ? new Date(certificate.issuedAt) : new Date();
    const formattedDate = issueDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const studentName = certificate.studentName || currentUser?.displayName || 'Student';
    const verificationUrl = `https://dbi-learn.pages.dev/verify-certificate?id=${certificate.certificateId}`;
    
    // Generate unique ID for this QR code container
    const qrContainerId = `qrContainer_${Date.now()}`;
    
    return `
        <div class="certificate-container" style="background: white; width: 100%; max-width: 800px; margin: 0 auto; font-family: 'Inter', sans-serif; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
            <div style="position: relative; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);">
                <!-- Outer decorative border -->
                <div style="position: absolute; top: 15px; left: 15px; right: 15px; bottom: 15px; border: 2px solid #1e88e5; border-radius: 12px; pointer-events: none;"></div>
                <div style="position: absolute; top: 20px; left: 20px; right: 20px; bottom: 20px; border: 1px solid #00c853; border-radius: 8px; pointer-events: none;"></div>
                
                <!-- Corner decorations -->
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
                
                <!-- Content -->
                <div style="padding: 50px 40px 40px 40px;">
                    <!-- Logo -->
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="../images/digital-bridge-initiative-logo.png" alt="DBI Logo" style="height: 60px; width: auto; margin: 0 auto;">
                        <p style="color: #6b7280; font-size: 12px; margin-top: 8px;">Bridging the Digital Divide Through Excellence</p>
                        <div style="width: 80px; height: 2px; background: linear-gradient(90deg, #1e88e5, #00c853); margin: 10px auto 0;"></div>
                    </div>
                    
                    <!-- Certificate Title -->
                    <div style="text-align: center; margin: 20px 0;">
                        <h2 style="color: #6b7280; font-size: 24px; font-weight: 300; margin: 0;">Certificate of</h2>
                        <h1 style="color: #1e88e5; font-size: 48px; font-weight: 700; margin: 5px 0 0; letter-spacing: 2px;">Completion</h1>
                    </div>
                    
                    <!-- Achievement Badge -->
                    <div style="text-align: center; margin: 15px 0;">
                        <div style="display: inline-flex; align-items: center; padding: 8px 24px;  color: white; border-radius: 50px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                            <span style="font-size: 20px; margin-right: 8px;">${level.icon}</span>
                            <span style="font-weight: 600; color: #017ae4;">${level.name} Level Achievement</span>
                        </div>
                    </div>
                    
                    <!-- Recipient -->
                    <div style="text-align: center; margin: 25px 0 20px;">
                        <p style="color: #6b7280; font-size: 16px; margin: 0;">This certificate is proudly presented to</p>
                        <h3 style="color: #00335f; font-size: 28px; font-weight: 700; margin: 10px 0 0; border-bottom: 2px solid #00c853; display: inline-block; padding-bottom: 5px;">
                            ${escapeHtml(studentName)}
                        </h3>
                    </div>
                    
                    <!-- Course -->
                    <div style="text-align: center; margin: 20px 0;">
                        <p style="color: #6b7280; font-size: 14px;">for successfully completing</p>
                        <h4 style="color: #1e88e5; font-size: 20px; font-weight: 600; margin: 8px 0 10px;">${escapeHtml(certificate.courseTitle)}</h4>
                        <div style="display: inline-block; padding: 4px 16px; background: #f3f4f6; border-radius: 20px;">
                            <span style="color: #00335f; font-size: 12px;">${department} Track</span>
                        </div>
                    </div>
                    
                    <!-- Description -->
                    <div style="text-align: center; margin: 20px auto; max-width: 500px;">
                        <p style="color: #9ca3af; font-size: 12px; font-style: italic; line-height: 1.5;">
                            This certificate acknowledges the exceptional dedication, technical proficiency, 
                            and successful completion of all course requirements with demonstrated excellence 
                            in the field of digital technology.
                        </p>
                    </div>
                    
                    <!-- Signatures and QR - FIXED POSITIONING -->
                    <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
                        <!-- Executive Director Signature -->
                        <div style="text-align: center; flex: 1;">
                            <div style="margin-bottom: 5px; min-height: 60px;">
                                <img src="${SIGNATURES.executiveDirector}" 
                                     alt="Executive Director Signature" 
                                     style="height: 50px; width: auto; margin: 0 auto; object-fit: contain;"
                                     onerror="this.style.display='none'">
                                <div style="width: 120px; height: 1px; background: #6b7280; margin: 5px auto;"></div>
                                <div style="color: #6b7280; font-size: 10px;">Digitally Signed</div>
                            </div>
                            <p style="font-weight: 600; color: #00335f; font-size: 12px; margin: 5px 0 2px;">Benjamin Amoako</p>
                            <p style="color: #1e88e5; font-size: 10px; margin: 0;">Executive Director</p>
                            <p style="color: #6b7280; font-size: 9px; margin: 0;">Digital Bridge Initiative</p>
                        </div>
                        
                        <!-- QR Code - SIMPLIFIED -->
                        <div style="text-align: center; flex: 1;">
                            <div id="qrContainer_${Date.now()}" style="width: 80px; height: 80px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid #1e88e5; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                                <div style="width: 40px; height: 40px; border: 2px solid #1e88e5; border-radius: 4px;"></div>
                            </div>
                            <p style="color: #6b7280; font-size: 9px; margin-top: 8px; font-family: monospace;">${certificate.certificateId.slice(0, 30)}</p>
                            <p style="color: #6b7280; font-size: 9px;">Issued: ${formattedDate}</p>
                            <button onclick="window.copyVerificationLink('${verificationUrl}')" 
                                    style="color: #1e88e5; font-size: 9px; background: none; border: none; cursor: pointer; margin-top: 4px;">
                                <i class="fas fa-link"></i> Verify
                            </button>
                        </div>
                        
                        <!-- Department Head Signature -->
                        <div style="text-align: center; flex: 1;">
                            <div style="margin-bottom: 5px; min-height: 60px;">
                                <img src="${getSignatureImage(department)}" 
                                     alt="${departmentHead.title} Signature" 
                                     style="height: 50px; width: auto; margin: 0 auto; object-fit: contain;"
                                     onerror="this.style.display='none'">
                                <div style="width: 120px; height: 1px; background: #6b7280; margin: 5px auto;"></div>
                                <div style="color: #6b7280; font-size: 10px;">Digitally Signed</div>
                            </div>
                            <p style="font-weight: 600; color: #00335f; font-size: 12px; margin: 5px 0 2px;">${departmentHead.name}</p>
                            <p style="color: #1e88e5; font-size: 10px; margin: 0;">${departmentHead.title}</p>
                            <p style="color: #6b7280; font-size: 9px; margin: 0;">${departmentHead.department}</p>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div style="margin-top: 25px; text-align: center;">
                        <div style="display: inline-flex; align-items: center; gap: 8px;">
                            <i class="fas fa-certificate" style="color: #1e88e5; font-size: 12px;"></i>
                            <span style="color: #6b7280; font-size: 10px;">Digitally Verified Certificate</span>
                            <i class="fas fa-shield-alt" style="color: #00c853; font-size: 12px;"></i>
                        </div>
                        <p style="color: #d1d5db; font-size: 8px; margin-top: 10px;">This certificate is issued by Digital Bridge Initiative - Empowering the Next Generation of Digital Leaders</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Get signature image based on department
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

// Determine department from course title
function determineDepartment(courseTitle) {
    const title = courseTitle.toLowerCase();
    if (title.includes('software') || title.includes('programming') || title.includes('development') || 
        title.includes('java') || title.includes('python') || title.includes('web') || title.includes('full stack')) {
        return 'Software Development';
    } else if (title.includes('graphic') || title.includes('design') || title.includes('multimedia') || 
               title.includes('ui/ux') || title.includes('animation')) {
        return 'Graphics & Multimedia';
    } else if (title.includes('data') || title.includes('analytics') || title.includes('machine learning') || 
               title.includes('ai') || title.includes('database') || title.includes('sql') || title.includes('big data')) {
        return 'Data Analysis';
    } else if (title.includes('digital marketing') || title.includes('social media') || title.includes('seo')) {
        return 'Digital Marketing';
    } else if (title.includes('cyber') || title.includes('security') || title.includes('ethical hacking')) {
        return 'Cybersecurity';
    } else if (title.includes('network') || title.includes('cloud') || title.includes('devops')) {
        return 'Network & Cloud';
    }
    return 'Digital Skills';
}

// Get department head information
function getDepartmentHead(department) {
    const departmentHeads = {
        'Software Development': {
            name: 'Benjamin Amoako',
            title: 'Head of Software Development',
            department: 'DigitalCore'
        },
        'Graphics & Multimedia': {
            name: 'Abel Eduah',
            title: 'Head of Graphics & Multimedia',
            department: 'Creative Impact'
        },
        'Data Analysis': {
            name: 'Godsway Arhin',
            title: 'Head of Data Analysis',
            department: 'Next Gen DATA-LAB'
        }
    };
    return departmentHeads[department] || {
        name: 'Benjamin Amoako',
        title: 'Head of Department',
        department: 'DigitalBridge Academy'
    };
}

// Generate QR code - SIMPLIFIED FIXED VERSION
async function generateQRCode(text) {
    console.log('Generating QR code for:', text);
    
    try {
        // Wait a bit for the DOM to settle
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Find the QR container - simpler selector
        const previewContainer = document.getElementById('certificatePreview');
        if (!previewContainer) {
            console.error('Preview container not found');
            return;
        }
        
        // Look for any div with id starting with qrContainer
        const qrContainer = previewContainer.querySelector('div[id^="qrContainer_"]');
        if (!qrContainer) {
            console.error('QR container not found in preview');
            return;
        }
        
        console.log('Found QR container:', qrContainer.id);
        
        // Clear previous content
        qrContainer.innerHTML = '';
        
        // Make sure QR container has proper dimensions and visibility
        qrContainer.style.width = '80px';
        qrContainer.style.height = '80px';
        qrContainer.style.display = 'flex';
        qrContainer.style.alignItems = 'center';
        qrContainer.style.justifyContent = 'center';
        qrContainer.style.backgroundColor = 'white';
        qrContainer.style.overflow = 'hidden';
        
        // Load QRCode library dynamically if not available
        if (typeof QRCode === 'undefined') {
            console.log('Loading QRCode library...');
            await loadQRCodeLibrary();
        }
        
        // Generate QR code with explicit options
        if (typeof QRCode !== 'undefined') {
            // Clear container again
            qrContainer.innerHTML = '';
            
            // Create a new div inside for QR code to ensure proper rendering
            const qrInnerDiv = document.createElement('div');
            qrInnerDiv.id = 'qr_inner_' + Date.now();
            qrContainer.appendChild(qrInnerDiv);
            
            new QRCode(qrInnerDiv, {
                text: text,
                width: 80,
                height: 80,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
            
            console.log('QR Code generated successfully');
            
            // Verify QR code was created
            setTimeout(() => {
                if (qrInnerDiv.children.length === 0) {
                    console.warn('QR code may not have rendered properly');
                    qrContainer.innerHTML = createFallbackQR(text);
                }
            }, 100);
        } else {
            throw new Error('QRCode library not available');
        }
        
    } catch (error) {
        console.error('QR Code generation failed:', error);
        // Show fallback in the QR container
        const previewContainer = document.getElementById('certificatePreview');
        if (previewContainer) {
            const qrContainer = previewContainer.querySelector('div[id^="qrContainer_"]');
            if (qrContainer) {
                qrContainer.innerHTML = createFallbackQR(text);
            }
        }
    }
}

// Helper function to load QR code library
function loadQRCodeLibrary() {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (typeof QRCode !== 'undefined') {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
        script.onload = () => {
            console.log('QRCode library loaded');
            // Small delay to ensure library is ready
            setTimeout(resolve, 100);
        };
        script.onerror = () => {
            console.error('Failed to load QRCode library');
            reject(new Error('Failed to load QRCode library'));
        };
        document.head.appendChild(script);
    });
}

// Fallback QR code using canvas
function createFallbackQR(text) {
    return `
        <div style="width:80px;height:80px;display:flex;align-items:center;justify-content:center;background:#f0f0f0;border-radius:4px;cursor:pointer;" 
             onclick="window.open('https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=' + encodeURIComponent('${text}'), '_blank')">
            <i class="fas fa-qrcode" style="font-size:32px;color:#1e88e5;"></i>
        </div>
    `;
}

// Copy verification link
window.copyVerificationLink = async (url) => {
    try {
        await navigator.clipboard.writeText(url);
        showToast('Verification link copied!', 'success');
    } catch (error) {
        console.error('Failed to copy:', error);
        showToast('Failed to copy link', 'error');
    }
};

// Download certificate as PDF
window.downloadCertificate = async (certificateId) => {
    const certificate = certificates.find(c => c.id === certificateId);
    if (!certificate) return;
    
    const btn = event.target.closest('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Generating...';
    btn.disabled = true;
    
    try {
        const container = document.createElement('div');
        container.innerHTML = generateCertificateHTML(certificate);
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '-9999px';
        container.style.backgroundColor = 'white';
        container.style.width = '800px';
        document.body.appendChild(container);
        
        // Find the QR container in the temporary container and generate QR code
        const qrDiv = container.querySelector('div[id^="qrContainer_"]');
if (qrDiv) {
    const verificationUrl = `https://dbi-learn.pages.dev/verify-certificate?id=${certificate.certificateId}`;
    
    // Clear and generate QR code
    qrDiv.innerHTML = '';
    qrDiv.style.display = 'flex';
    qrDiv.style.alignItems = 'center';
    qrDiv.style.justifyContent = 'center';
    
    if (typeof QRCode === 'undefined') {
        await loadQRCodeLibrary();
    }
    
    if (typeof QRCode !== 'undefined') {
        const qrInnerDiv = document.createElement('div');
        qrDiv.appendChild(qrInnerDiv);
        new QRCode(qrInnerDiv, {
            text: verificationUrl,
            width: 80,
            height: 80,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    } else {
        qrDiv.innerHTML = createFallbackQR(verificationUrl);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
}
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (typeof html2canvas === 'undefined') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
        }
        
        if (typeof jspdf === 'undefined') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
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
        pdf.save(`${certificate.courseTitle.replace(/[^a-z0-9]/gi, '_')}_Certificate.pdf`);
        
        document.body.removeChild(container);
        showToast('Certificate downloaded successfully!', 'success');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        showToast('Failed to generate PDF. Please try again.', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// Load script helper
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Print certificate
document.getElementById('printCertificateBtn')?.addEventListener('click', () => {
    const certificateContent = document.getElementById('certificatePreview').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Digital Bridge Initiative - Certificate</title>
            <style>
                @media print {
                    body { margin: 0; padding: 0; }
                    @page { size: A4; margin: 0; }
                }
                * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; }
            </style>
        </head>
        <body>
            ${certificateContent}
            <script>
                window.onload = () => {
                    window.print();
                    setTimeout(() => window.close(), 500);
                };
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
});

// Download button in modal
document.getElementById('downloadCertificateBtn')?.addEventListener('click', async () => {
    if (currentCertificate) {
        await window.downloadCertificate(currentCertificate.id);
    }
});

// Share certificate
window.shareCertificate = (certificateId) => {
    const certificate = certificates.find(c => c.id === certificateId);
    if (!certificate) return;
    currentCertificate = certificate;
    document.getElementById('shareModal').classList.remove('hidden');
};

// Share handlers
document.getElementById('shareTwitter')?.addEventListener('click', () => {
    if (!currentCertificate) return;
    const text = `I've earned my ${currentCertificate.courseTitle} certificate from Digital Bridge Initiative! 🎓 #DBILearning`;
    const url = `https://dbi-learn.pages.dev/verify-certificate?id=${currentCertificate.certificateId}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    document.getElementById('shareModal').classList.add('hidden');
    showToast('Shared on Twitter!', 'success');
});

document.getElementById('shareLinkedIn')?.addEventListener('click', () => {
    if (!currentCertificate) return;
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://dbi-learn.pages.dev/verify-certificate?id=${currentCertificate.certificateId}`)}`;
    window.open(url, '_blank');
    document.getElementById('shareModal').classList.add('hidden');
    showToast('Shared on LinkedIn!', 'success');
});

document.getElementById('shareFacebook')?.addEventListener('click', () => {
    if (!currentCertificate) return;
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://dbi-learn.pages.dev/verify-certificate?id=${currentCertificate.certificateId}`)}`;
    window.open(url, '_blank');
    document.getElementById('shareModal').classList.add('hidden');
    showToast('Shared on Facebook!', 'success');
});

document.getElementById('copyLinkBtn')?.addEventListener('click', async () => {
    if (!currentCertificate) return;
    const link = `https://dbi-learn.pages.dev/verify-certificate?id=${currentCertificate.certificateId}`;
    await navigator.clipboard.writeText(link);
    document.getElementById('shareModal').classList.add('hidden');
    showToast('Verification link copied!', 'success');
});

// Update achievement milestone based on score
function updateAchievementMilestone(avgScore) {
    let message = '';
    let progress = 0;
    let target = 100;
    
    if (avgScore === 0) {
        message = 'Complete courses and score above 60% to earn achievements!';
        progress = 0;
    } else if (avgScore < 60) {
        message = `${Math.round(60 - avgScore)}% more to reach Bronze Level!`;
        progress = (avgScore / 60) * 100;
        target = 60;
    } else if (avgScore < 70) {
        message = `Great! ${Math.round(70 - avgScore)}% more to reach Silver Level!`;
        progress = ((avgScore - 60) / 10) * 100;
        target = 70;
    } else if (avgScore < 80) {
        message = `Excellent! ${Math.round(80 - avgScore)}% more to reach Gold Level!`;
        progress = ((avgScore - 70) / 10) * 100;
        target = 80;
    } else if (avgScore < 90) {
        message = `Outstanding! ${Math.round(90 - avgScore)}% more to reach Platinum Level!`;
        progress = ((avgScore - 80) / 10) * 100;
        target = 90;
    } else {
        message = `Exceptional! You've achieved Platinum Level with ${avgScore}% average score! 🏆`;
        progress = 100;
    }
    
    document.getElementById('achievementMessage').textContent = message;
    document.getElementById('milestoneProgress').textContent = `${Math.round(avgScore)}%/${target}%`;
    document.getElementById('milestoneBar').style.width = `${Math.min(progress, 100)}%`;
}

// Display empty state
function displayEmptyState() {
    document.getElementById('gridView').classList.add('hidden');
    document.getElementById('listView').classList.add('hidden');
    document.getElementById('emptyState').classList.remove('hidden');
}

// View toggle
function setupViewToggle() {
    const gridViewBtn = document.getElementById('gridViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    const gridView = document.getElementById('gridView');
    const listView = document.getElementById('listView');
    
    if (!gridViewBtn || !listViewBtn) return;
    
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
    let isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => toggleSidebar(!isCollapsed));
    }
    
    function toggleSidebar(collapse) {
        isCollapsed = collapse;
        if (collapse) {
            sidebar.classList.add('sidebar-collapsed');
            sidebar.classList.remove('sidebar-expanded');
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
            sidebar.classList.add('sidebar-expanded');
            sidebar.classList.remove('sidebar-collapsed');
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
    const btn = document.getElementById('userMenuBtn');
    const dropdown = document.getElementById('userDropdown');
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

// Modal setup
function setupModals() {
    const closeModalBtn = document.getElementById('closeModalBtn');
    const closeShareModal = document.getElementById('closeShareModal');
    const certificateModal = document.getElementById('certificateModal');
    const shareModal = document.getElementById('shareModal');
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => certificateModal.classList.add('hidden'));
    }
    if (closeShareModal) {
        closeShareModal.addEventListener('click', () => shareModal.classList.add('hidden'));
    }
    if (certificateModal) {
        certificateModal.addEventListener('click', (e) => {
            if (e.target === certificateModal) certificateModal.classList.add('hidden');
        });
    }
    if (shareModal) {
        shareModal.addEventListener('click', (e) => {
            if (e.target === shareModal) shareModal.classList.add('hidden');
        });
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
    setTimeout(() => toast.remove(), 3000);
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupViewToggle();
    setupSidebar();
    setupDropdowns();
    setupModals();
    
    const logoutBtns = document.querySelectorAll('#logoutBtn, #logoutDropdown');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    });
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => displayCertificates());
    }
});

// Add global functions for inline onclick handlers
window.viewCertificate = viewCertificate;
window.downloadCertificate = downloadCertificate;
window.shareCertificate = shareCertificate;
window.copyVerificationLink = copyVerificationLink;

const style = document.createElement('style');
style.textContent = `
    @keyframes fade-in {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in { animation: fade-in 0.3s ease; }
`;
document.head.appendChild(style);