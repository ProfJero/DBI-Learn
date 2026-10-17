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
import { showError, showSuccess, isValidEmail, isValidPassword } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('adminSignupForm');
    const submitBtn = document.getElementById('submitBtn');
    const buttonText = document.getElementById('buttonText');
    const buttonSpinner = document.getElementById('buttonSpinner');
    const signupError = document.getElementById('signupError');
    const signupSuccess = document.getElementById('signupSuccess');
    
    // Role selection elements
    const adminOption = document.getElementById('adminOption');
    const instructorOption = document.getElementById('instructorOption');
    const adminPermissions = document.getElementById('adminPermissions');
    const roleRadios = document.querySelectorAll('input[name="role"]');
    
    // Password elements
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');
    const togglePassword = document.getElementById('togglePassword');
    const toggleConfirm = document.getElementById('toggleConfirmPassword');
    
    // Username elements
    const usernameInput = document.getElementById('username');
    const suggestionsContainer = document.getElementById('usernameSuggestions');
    const suggestionsList = document.getElementById('suggestionsList');
    
    // Store username availability status
    let isUsernameAvailable = true;
    
    // Show/hide admin permissions based on role
    roleRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'admin') {
                adminOption.classList.add('border-purple-500', 'bg-purple-50');
                instructorOption.classList.remove('border-pink-500', 'bg-pink-50');
                adminPermissions.classList.remove('hidden');
            } else {
                instructorOption.classList.add('border-pink-500', 'bg-pink-50');
                adminOption.classList.remove('border-purple-500', 'bg-purple-50');
                adminPermissions.classList.add('hidden');
            }
        });
    });
    
    // Password visibility toggle
    if (togglePassword && password) {
        togglePassword.addEventListener('click', () => {
            const type = password.type === 'password' ? 'text' : 'password';
            password.type = type;
            togglePassword.querySelector('svg').innerHTML = type === 'password' 
                ? '<path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>'
                : '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
        });
    }
    
    if (toggleConfirm && confirmPassword) {
        toggleConfirm.addEventListener('click', () => {
            const type = confirmPassword.type === 'password' ? 'text' : 'password';
            confirmPassword.type = type;
            toggleConfirm.querySelector('svg').innerHTML = type === 'password'
                ? '<path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>'
                : '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
        });
    }
    
    // Password match validation
    function validatePasswordMatch() {
        if (!confirmPassword.value) {
            confirmPassword.classList.remove('border-red-500', 'border-green-500');
            confirmPassword.classList.add('border-gray-300');
            return;
        }
        
        if (password.value === confirmPassword.value) {
            confirmPassword.classList.remove('border-red-500');
            confirmPassword.classList.add('border-green-500', 'border-2');
        } else {
            confirmPassword.classList.remove('border-green-500');
            confirmPassword.classList.add('border-red-500', 'border-2');
        }
    }
    
    if (password && confirmPassword) {
        password.addEventListener('input', validatePasswordMatch);
        confirmPassword.addEventListener('input', validatePasswordMatch);
    }
    
    // Check username availability
    async function checkUsernameAvailability(username) {
        try {
            if (!username || username.length < 3) return true;
            
            const usernameLower = username.toLowerCase();
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('usernameLower', '==', usernameLower));
            const querySnapshot = await getDocs(q);
            
            return querySnapshot.empty;
        } catch (error) {
            console.error('Error checking username:', error);
            return true;
        }
    }
    
    // Username suggestions
    if (usernameInput) {
        usernameInput.addEventListener('input', debounce(async (e) => {
            const value = e.target.value.trim();
            
            if (value.length >= 3) {
                const available = await checkUsernameAvailability(value);
                isUsernameAvailable = available;
                
                // Visual feedback
                if (available) {
                    usernameInput.classList.remove('border-red-500');
                    usernameInput.classList.add('border-green-500', 'border-2');
                } else {
                    usernameInput.classList.remove('border-green-500');
                    usernameInput.classList.add('border-red-500', 'border-2');
                }
                
                // Generate suggestions
                const suggestions = [];
                for (let i = 1; i <= 3; i++) {
                    suggestions.push(`${value}${Math.floor(Math.random() * 1000)}`);
                }
                displayUsernameSuggestions(suggestions);
            } else {
                usernameInput.classList.remove('border-red-500', 'border-green-500');
                usernameInput.classList.add('border-gray-300');
                suggestionsContainer.classList.add('hidden');
            }
        }, 500));
    }
    
    function displayUsernameSuggestions(suggestions) {
        suggestionsList.innerHTML = '';
        suggestions.forEach(suggestion => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = suggestion;
            btn.className = 'px-3 py-1 text-sm rounded-full border transition-all duration-200 hover:scale-105 border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-white';
            btn.onclick = () => {
                usernameInput.value = suggestion;
                usernameInput.dispatchEvent(new Event('input'));
                suggestionsContainer.classList.add('hidden');
            };
            suggestionsList.appendChild(btn);
        });
        suggestionsContainer.classList.remove('hidden');
    }
    
    // Validate form
    function validateForm() {
        const fullName = document.getElementById('fullName').value.trim();
        const username = usernameInput.value.trim();
        const email = document.getElementById('email').value.trim();
        const passwordVal = password.value;
        const confirmVal = confirmPassword.value;
        const role = document.querySelector('input[name="role"]:checked');
        const terms = document.getElementById('terms').checked;
        
        if (!fullName) {
            showError('Please enter full name');
            return false;
        }
        if (!username || username.length < 3) {
            showError('Username must be at least 3 characters');
            return false;
        }
        if (!email || !isValidEmail(email)) {
            showError('Please enter a valid email');
            return false;
        }
        if (!passwordVal || !isValidPassword(passwordVal)) {
            showError('Password must be at least 6 characters');
            return false;
        }
        if (passwordVal !== confirmVal) {
            showError('Passwords do not match');
            return false;
        }
        if (!role) {
            showError('Please select an account type');
            return false;
        }
        if (!terms) {
            showError('Please confirm the terms');
            return false;
        }
        if (!isUsernameAvailable) {
            showError('Username is already taken');
            return false;
        }
        
        return true;
    }
    
    function showError(message) {
        signupError.textContent = message;
        signupError.classList.remove('hidden');
        setTimeout(() => signupError.classList.add('hidden'), 5000);
    }
    
    function showSuccess(message) {
        signupSuccess.textContent = message;
        signupSuccess.classList.remove('hidden');
        setTimeout(() => signupSuccess.classList.add('hidden'), 3000);
    }
    
    function setLoading(isLoading) {
        submitBtn.disabled = isLoading;
        if (isLoading) {
            buttonText.textContent = 'Creating...';
            buttonSpinner.classList.remove('hidden');
        } else {
            buttonText.textContent = 'Create Account';
            buttonSpinner.classList.add('hidden');
        }
    }
    
    // Save admin/instructor to Firestore
    async function saveAdminToFirestore(userId, userData) {
        try {
            const userRef = doc(db, 'users', userId);
            
            // Base user data
            const userDoc = {
                userId: userId,
                fullName: userData.fullName,
                username: userData.username,
                usernameLower: userData.username.toLowerCase(),
                email: userData.email,
                phone: userData.phone || null,
                role: userData.role,
                status: 'active',
                department: userData.department || null,
                experience: userData.experience || null,
                bio: userData.bio || null,
                permissions: userData.permissions || [],
                createdAt: serverTimestamp(),
                lastLogin: null,
                createdBy: auth.currentUser?.uid || 'system',
                profileComplete: true
            };
            
            await setDoc(userRef, userDoc);
            
            // If admin, also add to admins collection
            if (userData.role === 'admin') {
                const adminRef = doc(db, 'admins', userId);
                await setDoc(adminRef, {
                    userId: userId,
                    fullName: userData.fullName,
                    email: userData.email,
                    role: 'admin',
                    permissions: userData.permissions || [],
                    createdAt: serverTimestamp(),
                    createdBy: auth.currentUser?.uid || 'system'
                });
            }
            
            // If instructor, add to instructors collection
            if (userData.role === 'instructor') {
                const instructorRef = doc(db, 'instructors', userId);
                await setDoc(instructorRef, {
                    userId: userId,
                    fullName: userData.fullName,
                    email: userData.email,
                    department: userData.department || null,
                    experience: userData.experience || null,
                    bio: userData.bio || null,
                    status: 'active',
                    createdAt: serverTimestamp(),
                    createdBy: auth.currentUser?.uid || 'system'
                });
            }
            
            return true;
        } catch (error) {
            console.error('Error saving to Firestore:', error);
            throw error;
        }
    }
    
    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!validateForm()) return;
        
        setLoading(true);
        
        // Collect form data
        const formData = new FormData(form);
        const userData = {
            fullName: formData.get('fullName'),
            username: formData.get('username'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            password: formData.get('password'),
            role: formData.get('role'),
            department: formData.get('department'),
            experience: formData.get('experience'),
            bio: formData.get('bio'),
            permissions: formData.getAll('permission'),
            terms: formData.get('terms') === 'on'
        };
        
        try {
            // Create user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
            const user = userCredential.user;
            
            // Update profile
            await updateProfile(user, {
                displayName: userData.fullName
            });
            
            // Save to Firestore
            await saveAdminToFirestore(user.uid, userData);
            
            showSuccess(`${userData.role === 'admin' ? 'Admin' : 'Instructor'} account created successfully!`);
            
            // Clear form
            form.reset();
            
            // Optional: Redirect to admin dashboard after 2 seconds
            setTimeout(() => {
                window.location.href = 'admin/dashboard.html';
            }, 2000);
            
        } catch (error) {
            console.error('Signup error:', error);
            
            let errorMessage = 'Failed to create account.';
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'Email already in use.';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak.';
            }
            
            showError(errorMessage);
        } finally {
            setLoading(false);
        }
    });
    
    // Debounce utility
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
});