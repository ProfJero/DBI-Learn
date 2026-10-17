import { 
    auth, 
    createUserWithEmailAndPassword,
    db, 
    doc, 
    setDoc,
    serverTimestamp,
    collection,
    query,
    where,
    getDocs
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('adminSetupForm');
    const createBtn = document.getElementById('createAdminBtn');
    const resetBtn = document.getElementById('resetBtn');
    const btnText = document.getElementById('btnText');
    const btnSpinner = document.getElementById('btnSpinner');
    const statusDiv = document.getElementById('setupStatus');
    const statusMessage = document.getElementById('statusMessage');
    
    // Form elements
    const fullNameInput = document.getElementById('fullName');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const positionInput = document.getElementById('position');
    const departmentInput = document.getElementById('department');
    const locationInput = document.getElementById('location');
    const securityQuestionSelect = document.getElementById('securityQuestion');
    const securityAnswerInput = document.getElementById('securityAnswer');
    const confirmSecurityCheckbox = document.getElementById('confirmSecurity');
    const confirmSetupCheckbox = document.getElementById('confirmSetup');
    
    // Admin type selection
    let selectedAdminType = 'super_admin';
    const superAdminCard = document.getElementById('superAdminCard');
    const adminCard = document.getElementById('adminCard');
    const superAdminRadio = document.getElementById('superAdmin');
    const adminRadio = document.getElementById('admin');
    
    // Password strength meter
    const strengthMeter = document.getElementById('strengthMeter');
    const strengthText = document.getElementById('strengthText');
    const passwordMatchError = document.getElementById('passwordMatchError');
    
    // Handle admin type selection
    function handleAdminTypeSelection(type) {
        selectedAdminType = type;
        if (type === 'super_admin') {
            superAdminRadio.checked = true;
            superAdminCard.classList.add('border-dbi-blue', 'bg-blue-50');
            adminCard.classList.remove('border-dbi-blue', 'bg-blue-50');
        } else {
            adminRadio.checked = true;
            adminCard.classList.add('border-dbi-blue', 'bg-blue-50');
            superAdminCard.classList.remove('border-dbi-blue', 'bg-blue-50');
        }
    }
    
    superAdminCard.addEventListener('click', () => handleAdminTypeSelection('super_admin'));
    adminCard.addEventListener('click', () => handleAdminTypeSelection('admin'));
    superAdminRadio.addEventListener('change', () => handleAdminTypeSelection('super_admin'));
    adminRadio.addEventListener('change', () => handleAdminTypeSelection('admin'));
    
    // Password strength checker
    function checkPasswordStrength(password) {
        let strength = 0;
        let feedback = '';
        
        if (password.length >= 8) strength++;
        if (password.match(/[a-z]+/)) strength++;
        if (password.match(/[A-Z]+/)) strength++;
        if (password.match(/[0-9]+/)) strength++;
        if (password.match(/[$@#&!]+/)) strength++;
        
        switch(strength) {
            case 0:
            case 1:
                feedback = 'Very Weak';
                strengthMeter.className = 'strength-meter strength-1 rounded-full';
                break;
            case 2:
                feedback = 'Weak';
                strengthMeter.className = 'strength-meter strength-2 rounded-full';
                break;
            case 3:
                feedback = 'Good';
                strengthMeter.className = 'strength-meter strength-3 rounded-full';
                break;
            case 4:
                feedback = 'Strong';
                strengthMeter.className = 'strength-meter strength-4 rounded-full';
                break;
            case 5:
                feedback = 'Very Strong';
                strengthMeter.className = 'strength-meter strength-4 rounded-full';
                break;
        }
        
        strengthText.textContent = `Password strength: ${feedback}`;
        return strength;
    }
    
    passwordInput.addEventListener('input', (e) => {
        checkPasswordStrength(e.target.value);
        validatePasswordMatch();
    });
    
    confirmPasswordInput.addEventListener('input', validatePasswordMatch);
    
    function validatePasswordMatch() {
        if (confirmPasswordInput.value) {
            if (passwordInput.value !== confirmPasswordInput.value) {
                passwordMatchError.classList.remove('hidden');
                confirmPasswordInput.classList.add('border-red-500');
                return false;
            } else {
                passwordMatchError.classList.add('hidden');
                confirmPasswordInput.classList.remove('border-red-500');
                return true;
            }
        }
        return true;
    }
    
    // Check if admin already exists
    async function checkExistingAdmins() {
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('role', 'in', ['admin', 'super_admin']));
            const querySnapshot = await getDocs(q);
            return !querySnapshot.empty;
        } catch (error) {
            console.error('Error checking existing admins:', error);
            return false;
        }
    }
    
    // Validate username uniqueness
    async function isUsernameUnique(username) {
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('usernameLower', '==', username.toLowerCase()));
            const querySnapshot = await getDocs(q);
            return querySnapshot.empty;
        } catch (error) {
            console.error('Error checking username:', error);
            return true;
        }
    }
    
    // Validate email uniqueness
    async function isEmailUnique(email) {
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', email.toLowerCase()));
            const querySnapshot = await getDocs(q);
            return querySnapshot.empty;
        } catch (error) {
            console.error('Error checking email:', error);
            return true;
        }
    }
    
    // Show status message
    function showStatus(message, type = 'info') {
        statusDiv.classList.remove('hidden');
        const colors = {
            success: 'bg-green-100 border-green-400 text-green-700',
            error: 'bg-red-100 border-red-400 text-red-700',
            info: 'bg-blue-100 border-blue-400 text-blue-700',
            warning: 'bg-yellow-100 border-yellow-400 text-yellow-700'
        };
        statusMessage.className = colors[type] + ' rounded-lg p-4';
        statusMessage.innerHTML = message;
        
        // Auto-hide after 5 seconds for success
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.classList.add('hidden');
            }, 5000);
        }
    }
    
    // Create admin account
    async function createAdminAccount(event) {
        event.preventDefault();
        
        // Validate required fields
        if (!fullNameInput.value.trim()) {
            showStatus('Please enter full name', 'error');
            fullNameInput.focus();
            return;
        }
        
        if (!usernameInput.value.trim()) {
            showStatus('Please enter username', 'error');
            usernameInput.focus();
            return;
        }
        
        if (usernameInput.value.length < 3) {
            showStatus('Username must be at least 3 characters long', 'error');
            usernameInput.focus();
            return;
        }
        
        if (!emailInput.value.trim()) {
            showStatus('Please enter email address', 'error');
            emailInput.focus();
            return;
        }
        
        if (!isValidEmail(emailInput.value)) {
            showStatus('Please enter a valid email address', 'error');
            emailInput.focus();
            return;
        }
        
        if (!passwordInput.value) {
            showStatus('Please enter password', 'error');
            passwordInput.focus();
            return;
        }
        
        if (passwordInput.value.length < 6) {
            showStatus('Password must be at least 6 characters long', 'error');
            passwordInput.focus();
            return;
        }
        
        if (!validatePasswordMatch()) {
            showStatus('Passwords do not match', 'error');
            confirmPasswordInput.focus();
            return;
        }
        
        if (!confirmSecurityCheckbox.checked) {
            showStatus('Please confirm that you understand the administrative privileges', 'error');
            confirmSecurityCheckbox.focus();
            return;
        }
        
        if (!confirmSetupCheckbox.checked) {
            showStatus('Please confirm that you will secure this setup page', 'error');
            confirmSetupCheckbox.focus();
            return;
        }
        
        // Check if username is unique
        const usernameUnique = await isUsernameUnique(usernameInput.value);
        if (!usernameUnique) {
            showStatus('Username already taken. Please choose another username.', 'error');
            usernameInput.focus();
            return;
        }
        
        // Check if email is unique
        const emailUnique = await isEmailUnique(emailInput.value);
        if (!emailUnique) {
            showStatus('Email already registered. Please use another email address.', 'error');
            emailInput.focus();
            return;
        }
        
        // Set loading state
        createBtn.disabled = true;
        btnText.textContent = 'Creating Admin Account...';
        btnSpinner.classList.remove('hidden');
        
        try {
            // Create user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(
                auth, 
                emailInput.value, 
                passwordInput.value
            );
            const user = userCredential.user;
            
            // Prepare admin data for Firestore
            const adminData = {
                userId: user.uid,
                fullName: fullNameInput.value.trim(),
                username: usernameInput.value.trim(),
                usernameLower: usernameInput.value.trim().toLowerCase(),
                email: emailInput.value.trim().toLowerCase(),
                phone: phoneInput.value.trim() || null,
                role: selectedAdminType,
                status: 'active',
                position: positionInput.value.trim() || null,
                department: departmentInput.value.trim() || null,
                location: locationInput.value.trim() || null,
                securityQuestion: securityQuestionSelect.value || null,
                securityAnswer: securityAnswerInput.value ? 
                    btoa(securityAnswerInput.value.toLowerCase().trim()) : null, // Basic encoding
                school: 'Digital Bridge Initiative',
                grade: 'Professional',
                gender: 'Prefer not to say',
                profileComplete: true,
                interests: ['Administration', 'Platform Management'],
                experience: 'Advanced',
                referral: 'System Setup',
                goals: 'Manage and oversee Digital Bridge Initiative learning platform',
                createdAt: serverTimestamp(),
                lastLogin: null,
                lastLoginTimestamp: null,
                organization: 'Digital Bridge Initiative',
                isEmailVerified: false,
                twoFactorEnabled: false,
                terms: true,
                consent: true
            };
            
            // Save to Firestore
            await setDoc(doc(db, 'users', user.uid), adminData);
            
            // Success message
            showStatus(`
                ✅ <strong>Administrator Account Created Successfully!</strong><br><br>
                <strong>Account Details:</strong><br>
                • Name: ${fullNameInput.value}<br>
                • Username: ${usernameInput.value}<br>
                • Email: ${emailInput.value}<br>
                • Role: ${selectedAdminType === 'super_admin' ? 'Super Administrator' : 'Administrator'}<br><br>
                ⚠️ <strong>Important:</strong> Please save these credentials securely. 
                You can now <a href="login.html" class="underline font-bold">login to the admin dashboard</a>.
            `, 'success');
            
            // Reset form
            form.reset();
            
            // Optionally redirect after a few seconds
            setTimeout(() => {
                if (confirm('Admin account created successfully! Would you like to login now?')) {
                    window.location.href = 'login.html';
                }
            }, 2000);
            
        } catch (error) {
            console.error('Error creating admin account:', error);
            
            let errorMessage = 'Failed to create admin account. ';
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage += 'Email already in use.';
                    break;
                case 'auth/invalid-email':
                    errorMessage += 'Invalid email address.';
                    break;
                case 'auth/weak-password':
                    errorMessage += 'Password is too weak.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage += 'Email/password accounts are not enabled in Firebase.';
                    break;
                default:
                    errorMessage += error.message;
            }
            
            showStatus(errorMessage, 'error');
        } finally {
            createBtn.disabled = false;
            btnText.textContent = 'Create Administrator Account';
            btnSpinner.classList.add('hidden');
        }
    }
    
    // Helper function to validate email
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    // Reset form
    function resetForm() {
        form.reset();
        selectedAdminType = 'super_admin';
        handleAdminTypeSelection('super_admin');
        strengthMeter.className = 'strength-meter strength-0 rounded-full';
        strengthText.textContent = '';
        passwordMatchError.classList.add('hidden');
        confirmPasswordInput.classList.remove('border-red-500');
        statusDiv.classList.add('hidden');
    }
    
    // Event listeners
    form.addEventListener('submit', createAdminAccount);
    resetBtn.addEventListener('click', resetForm);
    
    // Check if any admin already exists (warning)
    checkExistingAdmins().then(hasAdmin => {
        if (hasAdmin) {
            showStatus(
                '⚠️ <strong>Warning:</strong> Admin accounts already exist in the system. ' +
                'Creating another admin account is allowed, but ensure you\'re following proper security protocols.',
                'warning'
            );
        }
    });
    
    // Add console warning for development
    console.log('%c⚠️ ADMIN SETUP PAGE ACTIVE ⚠️', 'background: #ff0000; color: #ffffff; font-size: 16px; padding: 4px 8px; border-radius: 4px;');
    console.log('%cRemember to remove or secure this page after creating admin accounts!', 'color: #ff6600; font-size: 12px;');
});