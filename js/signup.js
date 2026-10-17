import { 
    auth, 
    createUserWithEmailAndPassword,
    updateProfile 
} from './firebase-config.js';
import { 
    db, 
    doc, 
    setDoc, 
    collection,
    query,
    where,
    getDocs,
    serverTimestamp 
} from './firebase-config.js';

// Helper functions for validation
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPassword(password) {
    return password && password.length >= 6;
}

// Calculate age from date of birth
function calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

// Validate date of birth
function validateDateOfBirth(dateOfBirth) {
    if (!dateOfBirth) return false;
    
    const age = calculateAge(dateOfBirth);
    const minAge = 9; // Minimum age requirement
    const maxAge = 100; // Maximum reasonable age
    
    if (age < minAge) {
        return { valid: false, message: `You must be at least ${minAge} years old to join.` };
    }
    if (age > maxAge) {
        return { valid: false, message: `Please verify your date of birth.` };
    }
    return { valid: true, age: age };
}

// Multi-step form handling
document.addEventListener('DOMContentLoaded', () => {
    const steps = document.querySelectorAll('.step');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');
    const currentStepSpan = document.getElementById('currentStep');
    const stepNameSpan = document.getElementById('stepName');
    const progressBar = document.getElementById('progressBar');
    const signupForm = document.getElementById('signupForm');
    const signupError = document.getElementById('signupError');
    
    let currentStep = 1;
    const totalSteps = 6; // Updated to 6 steps
    
    // Store username availability status
    let isUsernameAvailable = true;
    let usernameCheckTimeout;
    
    // Step names for display
    const stepNames = {
        1: 'Basic Information',
        2: 'Account & Access',
        3: 'Learning Interests',
        4: 'Parent/Guardian Info',
        5: 'Additional Information',
        6: 'Review & Submit'
    };
    
    // Smooth scroll to element
    function scrollToElement(element, offset = 100) {
        if (element) {
            const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
            window.scrollTo({
                top: elementPosition - offset,
                behavior: 'smooth'
            });
        }
    }
    
    // Show error with auto-scroll
    function showErrorWithScroll(message) {
        signupError.textContent = message;
        signupError.classList.remove('hidden');
        scrollToElement(signupError);
        
        setTimeout(() => {
            signupError.classList.add('hidden');
        }, 5000);
    }
    
    // Show success with auto-scroll
    function showSuccessWithScroll(message) {
        const signupSuccess = document.getElementById('signupSuccess');
        signupSuccess.textContent = message;
        signupSuccess.classList.remove('hidden');
        scrollToElement(signupSuccess);
        
        setTimeout(() => {
            signupSuccess.classList.add('hidden');
        }, 3000);
    }
    
    // Update step display
    function updateStep() {
        steps.forEach((step, index) => {
            if (index + 1 === currentStep) {
                step.classList.remove('hidden');
                scrollToElement(document.querySelector('.bg-white'), 50);
            } else {
                step.classList.add('hidden');
            }
        });
        
        currentStepSpan.textContent = currentStep;
        stepNameSpan.textContent = stepNames[currentStep];
        
        const progress = (currentStep / totalSteps) * 100;
        progressBar.style.width = `${progress}%`;
        
        if (currentStep === 1) {
            prevBtn.classList.add('hidden');
        } else {
            prevBtn.classList.remove('hidden');
        }
        
        if (currentStep === totalSteps) {
            nextBtn.classList.add('hidden');
            submitBtn.classList.remove('hidden');
        } else {
            nextBtn.classList.remove('hidden');
            submitBtn.classList.add('hidden');
        }
    }
    
    // Validate current step
    function validateStep() {
        switch(currentStep) {
            case 1:
                const fullName = document.getElementById('fullName').value.trim();
                const dateOfBirth = document.getElementById('dateOfBirth').value;
                const username = document.getElementById('username').value.trim();
                const email = document.getElementById('email').value.trim();
                const genderSelected = document.querySelector('input[name="gender"]:checked');
                
                if (!fullName) {
                    showErrorWithScroll('Please enter your full name');
                    document.getElementById('fullName').focus();
                    return false;
                }
                
                if (!dateOfBirth) {
                    showErrorWithScroll('Please enter your date of birth');
                    document.getElementById('dateOfBirth').focus();
                    return false;
                }
                
                const dobValidation = validateDateOfBirth(dateOfBirth);
                if (!dobValidation.valid) {
                    const ageError = document.getElementById('ageError');
                    if (ageError) {
                        ageError.textContent = dobValidation.message;
                        ageError.classList.remove('hidden');
                    }
                    showErrorWithScroll(dobValidation.message);
                    document.getElementById('dateOfBirth').focus();
                    return false;
                }
                
                const ageError = document.getElementById('ageError');
                if (ageError) ageError.classList.add('hidden');
                
                if (!username) {
                    showErrorWithScroll('Please choose a username');
                    document.getElementById('username').focus();
                    return false;
                }
                if (username.length < 3) {
                    showErrorWithScroll('Username must be at least 3 characters long');
                    document.getElementById('username').focus();
                    return false;
                }
                if (!isUsernameAvailable) {
                    showErrorWithScroll('Username is already taken. Please choose another one.');
                    document.getElementById('username').focus();
                    return false;
                }
                if (!email) {
                    showErrorWithScroll('Email address is required');
                    document.getElementById('email').focus();
                    return false;
                }
                if (!isValidEmail(email)) {
                    showErrorWithScroll('Please enter a valid email address');
                    document.getElementById('email').focus();
                    return false;
                }
                if (!genderSelected) {
                    showErrorWithScroll('Please select your gender');
                    return false;
                }
                break;
                
            case 2:
                const password = document.getElementById('password').value;
                const confirmPassword = document.getElementById('confirmPassword').value;
                
                if (!password) {
                    showErrorWithScroll('Please enter a password');
                    document.getElementById('password').focus();
                    return false;
                }
                if (!isValidPassword(password)) {
                    showErrorWithScroll('Password must be at least 6 characters long');
                    document.getElementById('password').focus();
                    return false;
                }
                if (password !== confirmPassword) {
                    showErrorWithScroll('Passwords do not match');
                    document.getElementById('confirmPassword').focus();
                    return false;
                }
                break;
                
            case 3:
                const interests = document.querySelectorAll('input[name="interest"]:checked');
                if (interests.length === 0) {
                    showErrorWithScroll('Please select at least one area of interest');
                    document.getElementById('interestError').classList.remove('hidden');
                    return false;
                }
                document.getElementById('interestError').classList.add('hidden');
                break;
                
            case 4:
                const consent = document.getElementById('consent').checked;
                if (!consent) {
                    showErrorWithScroll('Please confirm that you have obtained parental consent');
                    document.getElementById('consent').focus();
                    return false;
                }
                break;
                
            case 5:
                const location = document.getElementById('location').value.trim();
                const experience = document.getElementById('experience').value;
                const referral = document.getElementById('referral').value;
                const terms = document.getElementById('terms').checked;
                
                if (!location) {
                    showErrorWithScroll('Please enter your location');
                    document.getElementById('location').focus();
                    return false;
                }
                if (!experience) {
                    showErrorWithScroll('Please select your experience level');
                    document.getElementById('experience').focus();
                    return false;
                }
                if (!referral) {
                    showErrorWithScroll('Please tell us how you heard about DBI');
                    document.getElementById('referral').focus();
                    return false;
                }
                if (!terms) {
                    showErrorWithScroll('Please accept the Terms of Service');
                    document.getElementById('terms').focus();
                    return false;
                }
                break;
        }
        
        return true;
    }
    
    // Check username availability
    async function checkUsernameAvailability(username) {
        try {
            if (!username || username.length < 2) {
                return true;
            }
            
            const usernameLower = username.toLowerCase();
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('usernameLower', '==', usernameLower));
            
            const queryPromise = getDocs(q);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 5000)
            );
            
            const querySnapshot = await Promise.race([queryPromise, timeoutPromise]);
            return querySnapshot.empty;
            
        } catch (error) {
            console.error('Error checking username availability:', error);
            return true;
        }
    }
    
    // Generate username suggestions
    function generateUsernameSuggestions(base) {
        const suggestions = [];
        const baseClean = base.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        for (let i = 1; i <= 3; i++) {
            const randomNum = Math.floor(Math.random() * 1000);
            suggestions.push(`${baseClean}${randomNum}`);
        }
        return suggestions;
    }
    
    // Save user data to Firestore
    async function saveUserToFirestore(userId, userData) {
        try {
            const userRef = doc(db, 'users', userId);
            
            await setDoc(userRef, {
                userId: userId,
                fullName: userData.fullName,
                dateOfBirth: userData.dateOfBirth,
                age: userData.age,
                username: userData.username,
                usernameLower: userData.username.toLowerCase(),
                email: userData.email,
                phone: userData.phone || null,
                school: userData.school || null,
                grade: userData.grade || null,
                gender: userData.gender || null,
                role: 'student',
                status: 'active',
                interests: userData.interests || [],
                guardianName: userData.guardianName || null,
                guardianPhone: userData.guardianPhone || null,
                guardianEmail: userData.guardianEmail || null,
                consent: userData.consent || false,
                location: userData.location || null,
                experience: userData.experience || null,
                referral: userData.referral || null,
                goals: userData.goals || null,
                terms: userData.terms || false,
                createdAt: serverTimestamp(),
                lastLogin: null,
                profileComplete: true,
                organization: 'Digital Bridge Initiative'
            });
            
            return true;
        } catch (error) {
            console.error('Error saving user to Firestore:', error);
            throw error;
        }
    }
    
    // Save step data to localStorage
    function saveStepData() {
        const formData = new FormData(signupForm);
        const data = {};
        formData.forEach((value, key) => {
            if (key === 'interest') {
                if (!data[key]) data[key] = [];
                data[key].push(value);
            } else {
                data[key] = value;
            }
        });
        localStorage.setItem('dbiSignupFormData', JSON.stringify(data));
    }
    
    // Load saved data
    function loadSavedData() {
        const saved = localStorage.getItem('dbiSignupFormData');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                Object.keys(data).forEach(key => {
                    const fields = document.querySelectorAll(`[name="${key}"]`);
                    
                    if (fields.length > 0) {
                        if (key === 'interest' && Array.isArray(data[key])) {
                            data[key].forEach(value => {
                                const checkbox = document.querySelector(`[name="${key}"][value="${value}"]`);
                                if (checkbox) checkbox.checked = true;
                            });
                        } else if (fields[0].type === 'radio') {
                            const radio = document.querySelector(`[name="${key}"][value="${data[key]}"]`);
                            if (radio) radio.checked = true;
                        } else {
                            fields[0].value = data[key] || '';
                        }
                    }
                });
            } catch (e) {
                console.error('Error loading saved data:', e);
            }
        }
    }
    
    // Next button click
    nextBtn.addEventListener('click', () => {
        if (validateStep()) {
            nextBtn.disabled = true;
            const originalText = nextBtn.textContent;
            nextBtn.innerHTML = '<svg class="animate-spin h-5 w-5 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
            
            setTimeout(() => {
                saveStepData();
                if (currentStep < totalSteps) {
                    currentStep++;
                    updateStep();
                }
                nextBtn.disabled = false;
                nextBtn.textContent = originalText;
            }, 300);
        }
    });
    
    // Previous button click
    prevBtn.addEventListener('click', () => {
        prevBtn.disabled = true;
        const originalText = prevBtn.textContent;
        prevBtn.innerHTML = '<svg class="animate-spin h-5 w-5 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
        
        setTimeout(() => {
            if (currentStep > 1) {
                currentStep--;
                updateStep();
            }
            prevBtn.disabled = false;
            prevBtn.textContent = originalText;
        }, 300);
    });
    
    // Password visibility toggle and validation
    function setupPasswordToggles() {
        const password = document.getElementById('password');
        const confirmPassword = document.getElementById('confirmPassword');
        const matchIcon = document.getElementById('passwordMatchIcon');
        const mismatchIcon = document.getElementById('passwordMismatchIcon');
        
        const togglePassword = document.getElementById('togglePassword');
        const toggleConfirm = document.getElementById('toggleConfirmPassword');
        
        if (togglePassword && password) {
            togglePassword.addEventListener('click', () => {
                const type = password.getAttribute('type') === 'password' ? 'text' : 'password';
                password.setAttribute('type', type);
            });
        }
        
        if (toggleConfirm && confirmPassword) {
            toggleConfirm.addEventListener('click', () => {
                const type = confirmPassword.getAttribute('type') === 'password' ? 'text' : 'password';
                confirmPassword.setAttribute('type', type);
            });
        }
        
        function validatePasswordMatch() {
            if (!confirmPassword.value) {
                confirmPassword.classList.remove('border-red-500', 'border-green-500');
                confirmPassword.classList.add('border-gray-300');
                if (matchIcon) matchIcon.classList.add('hidden');
                if (mismatchIcon) mismatchIcon.classList.add('hidden');
                return;
            }
            
            if (password.value === confirmPassword.value) {
                confirmPassword.classList.remove('border-red-500');
                confirmPassword.classList.add('border-green-500', 'border-2');
                if (matchIcon) matchIcon.classList.remove('hidden');
                if (mismatchIcon) mismatchIcon.classList.add('hidden');
            } else {
                confirmPassword.classList.remove('border-green-500');
                confirmPassword.classList.add('border-red-500', 'border-2');
                if (matchIcon) matchIcon.classList.add('hidden');
                if (mismatchIcon) mismatchIcon.classList.remove('hidden');
            }
        }
        
        if (password && confirmPassword) {
            password.addEventListener('input', validatePasswordMatch);
            confirmPassword.addEventListener('input', validatePasswordMatch);
        }
    }
    
    // Username validation
    const usernameInput = document.getElementById('username');
    const suggestionsContainer = document.getElementById('usernameSuggestions');
    const suggestionsList = document.getElementById('suggestionsList');
    
    function addUsernameValidationIcons() {
        if (usernameInput && !document.getElementById('usernameAvailableIcon')) {
            const parentDiv = usernameInput.parentElement;
            parentDiv.style.position = 'relative';
            
            const existingAvailable = document.getElementById('usernameAvailableIcon');
            const existingUnavailable = document.getElementById('usernameUnavailableIcon');
            if (existingAvailable) existingAvailable.remove();
            if (existingUnavailable) existingUnavailable.remove();
            
            const availableIcon = document.createElement('div');
            availableIcon.id = 'usernameAvailableIcon';
            availableIcon.className = 'absolute right-3 top-3 hidden';
            availableIcon.innerHTML = '<svg class="h-6 w-6 text-[#00c853]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            
            const unavailableIcon = document.createElement('div');
            unavailableIcon.id = 'usernameUnavailableIcon';
            unavailableIcon.className = 'absolute right-3 top-3 hidden';
            unavailableIcon.innerHTML = '<svg class="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            
            parentDiv.appendChild(availableIcon);
            parentDiv.appendChild(unavailableIcon);
        }
    }
    
    addUsernameValidationIcons();
    
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    usernameInput.addEventListener('input', debounce(async (e) => {
        const value = e.target.value.trim();
        const availableIcon = document.getElementById('usernameAvailableIcon');
        const unavailableIcon = document.getElementById('usernameUnavailableIcon');
        
        if (usernameCheckTimeout) {
            clearTimeout(usernameCheckTimeout);
        }
        
        suggestionsContainer.classList.add('hidden');
        
        if (value.length < 3) {
            usernameInput.classList.remove('border-red-500', 'border-green-500');
            usernameInput.classList.add('border-gray-300');
            if (availableIcon) availableIcon.classList.add('hidden');
            if (unavailableIcon) unavailableIcon.classList.add('hidden');
            isUsernameAvailable = true;
            return;
        }
        
        usernameInput.classList.remove('border-red-500', 'border-green-500');
        usernameInput.classList.add('border-gray-300');
        
        try {
            const available = await checkUsernameAvailability(value);
            isUsernameAvailable = available;
            
            if (available) {
                usernameInput.classList.remove('border-red-500');
                usernameInput.classList.add('border-green-500', 'border-2');
                if (availableIcon) availableIcon.classList.remove('hidden');
                if (unavailableIcon) unavailableIcon.classList.add('hidden');
            } else {
                usernameInput.classList.remove('border-green-500');
                usernameInput.classList.add('border-yellow-500', 'border-2');
                if (availableIcon) availableIcon.classList.add('hidden');
                if (unavailableIcon) unavailableIcon.classList.add('hidden');
                isUsernameAvailable = true;
            }
            
            const suggestions = generateUsernameSuggestions(value);
            displayUsernameSuggestions(suggestions);
            
        } catch (error) {
            console.error('Error in username validation:', error);
            usernameInput.classList.remove('border-red-500', 'border-green-500');
            usernameInput.classList.add('border-gray-300');
            if (availableIcon) availableIcon.classList.add('hidden');
            if (unavailableIcon) unavailableIcon.classList.add('hidden');
            isUsernameAvailable = true;
            
            const suggestions = generateUsernameSuggestions(value);
            displayUsernameSuggestions(suggestions);
        }
    }, 500));
    
    function displayUsernameSuggestions(suggestions) {
        if (!suggestions || suggestions.length === 0) {
            suggestionsContainer.classList.add('hidden');
            return;
        }
        
        suggestionsList.innerHTML = '';
        suggestions.forEach(suggestion => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = suggestion;
            btn.className = 'px-3 py-1 text-sm rounded-full border transition-all duration-200 hover:scale-105';
            btn.style.borderColor = '#1e88e5';
            btn.style.color = '#1e88e5';
            btn.onmouseover = () => {
                btn.style.backgroundColor = '#1e88e5';
                btn.style.color = 'white';
            };
            btn.onmouseout = () => {
                btn.style.backgroundColor = 'transparent';
                btn.style.color = '#1e88e5';
            };
            btn.onclick = () => {
                usernameInput.value = suggestion;
                usernameInput.dispatchEvent(new Event('input'));
                suggestionsContainer.classList.add('hidden');
            };
            suggestionsList.appendChild(btn);
        });
        suggestionsContainer.classList.remove('hidden');
    }
    
    // School suggestions
    const schoolInput = document.getElementById('school');
    const schoolDatalist = document.getElementById('schoolSuggestions');
    
    const sampleSchools = [
        'Bosomin D/A Basic School',
        'Accra Girls Senior High',
        'Presbyterian Boys Secondary',
        'Wesley Girls High School',
        'Mfantsipim School',
        'St. Augustine College',
        'Achimota School',
        'Holy Child School',
        'University of Ghana',
        'Kwame Nkrumah University of Science and Technology',
        'University of Cape Coast',
        'Ashesi University',
        'Central University',
        'Ghana Institute of Management and Public Administration (GIMPA)'
    ];
    
    if (schoolInput) {
        schoolInput.addEventListener('focus', () => {
            populateSchoolSuggestions(sampleSchools);
        });
        
        schoolInput.addEventListener('input', debounce(() => {
            const value = schoolInput.value.toLowerCase();
            const filtered = sampleSchools.filter(school => 
                school.toLowerCase().includes(value)
            );
            populateSchoolSuggestions(filtered);
        }, 200));
    }
    
    function populateSchoolSuggestions(schools) {
        if (schoolDatalist) {
            schoolDatalist.innerHTML = '';
            schools.forEach(school => {
                const option = document.createElement('option');
                option.value = school;
                schoolDatalist.appendChild(option);
            });
        }
    }
    
    // Handle form submission
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!validateStep()) {
            return;
        }
        
        const formData = new FormData(signupForm);
        const dateOfBirth = formData.get('dateOfBirth');
        const ageValidation = validateDateOfBirth(dateOfBirth);
        
        if (!ageValidation.valid) {
            showErrorWithScroll(ageValidation.message);
            return;
        }
        
        const userData = {
            fullName: formData.get('fullName') || '',
            dateOfBirth: dateOfBirth,
            age: ageValidation.age,
            username: formData.get('username') || '',
            email: formData.get('email') || '',
            phone: formData.get('phone') || '',
            school: formData.get('school') || '',
            grade: formData.get('grade') || '',
            gender: formData.get('gender') || '',
            password: formData.get('password') || '',
            role: 'student',
            interests: formData.getAll('interest') || [],
            guardianName: formData.get('guardianName') || '',
            guardianPhone: formData.get('guardianPhone') || '',
            guardianEmail: formData.get('guardianEmail') || '',
            consent: formData.get('consent') === 'on',
            location: formData.get('location') || '',
            experience: formData.get('experience') || '',
            referral: formData.get('referral') || '',
            goals: formData.get('goals') || '',
            terms: formData.get('terms') === 'on'
        };
        
        if (!userData.fullName || !userData.username || !userData.password) {
            showErrorWithScroll('Please fill in all required fields');
            return;
        }
        
        if (!userData.email) {
            showErrorWithScroll('Email is required for account creation');
            document.getElementById('email').focus();
            return;
        }
        
        if (!isValidEmail(userData.email)) {
            showErrorWithScroll('Please enter a valid email address');
            document.getElementById('email').focus();
            return;
        }
        
        if (!isUsernameAvailable) {
            showErrorWithScroll('Username is already taken. Please choose another one.');
            document.getElementById('username').focus();
            return;
        }
        
        submitBtn.disabled = true;
        const originalText = submitBtn.textContent;
        submitBtn.innerHTML = '<svg class="animate-spin h-5 w-5 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
        
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
            const user = userCredential.user;
            
            await updateProfile(user, {
                displayName: userData.fullName
            });
            
            await saveUserToFirestore(user.uid, userData);
            
            showSuccessWithScroll('🎉 Welcome to Digital Bridge Initiative! Your account has been created successfully. Redirecting to login...');
            
            localStorage.removeItem('dbiSignupFormData');
            
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            
        } catch (error) {
            console.error('Signup error:', error);
            
            let errorMessage = 'Signup failed. Please try again.';
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'An account with this email already exists. Please login instead.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'Email/password accounts are not enabled.';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Password is too weak. Please choose a stronger password.';
                    break;
                case 'permission-denied':
                    errorMessage = 'Database permission denied. Please contact DBI support.';
                    break;
                default:
                    if (error.message) {
                        errorMessage = error.message;
                    }
            }
            
            showErrorWithScroll(errorMessage);
            
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
    
    // Date of birth validation on input
    const dobInput = document.getElementById('dateOfBirth');
    if (dobInput) {
        dobInput.addEventListener('change', () => {
            const validation = validateDateOfBirth(dobInput.value);
            const ageError = document.getElementById('ageError');
            if (ageError) {
                if (!validation.valid) {
                    ageError.textContent = validation.message;
                    ageError.classList.remove('hidden');
                    dobInput.classList.add('border-red-500');
                } else {
                    ageError.classList.add('hidden');
                    dobInput.classList.remove('border-red-500');
                    dobInput.classList.add('border-green-500');
                    
                    // Show age in a tooltip or message
                    const ageMessage = document.createElement('div');
                    ageMessage.id = 'ageMessage';
                    ageMessage.className = 'text-xs text-green-600 mt-1';
                    ageMessage.textContent = `Age: ${validation.age} years`;
                    
                    const existingAgeMessage = document.getElementById('ageMessage');
                    if (existingAgeMessage) existingAgeMessage.remove();
                    dobInput.parentNode.appendChild(ageMessage);
                    
                    setTimeout(() => {
                        if (ageMessage) ageMessage.remove();
                    }, 3000);
                }
            }
        });
    }
    
    // Initialize
    loadSavedData();
    updateStep();
    setupPasswordToggles();
    
    // Set default date of birth max value
    if (dobInput) {
        const today = new Date();
        const minYear = today.getFullYear() - 9;
        const maxDate = `${minYear}-12-31`;
        dobInput.max = maxDate;
        
        const minDate = '1950-01-01';
        dobInput.min = minDate;
    }
    
    // Add DBI branding to console
    console.log('%c Digital Bridge Initiative ', 'background: #1e88e5; color: white; font-size: 14px; padding: 4px 8px; border-radius: 4px;');
    console.log('%c Bridging the digital divide through education ', 'color: #00c853; font-size: 12px;');
});