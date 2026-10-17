import { 
    auth, 
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut,
    db,
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    updateDoc,
    limit  // IMPORTANT: Add limit here
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const rememberCheckbox = document.getElementById('remember');
    const forgotPasswordLink = document.getElementById('forgotPassword');
    const loginButton = document.getElementById('loginButton');
    const buttonText = document.getElementById('buttonText');
    const buttonSpinner = document.getElementById('buttonSpinner');
    const loginError = document.getElementById('loginError');
    const loginSuccess = document.getElementById('loginSuccess');
    
    // DBI Brand Colors
    const dbiColors = {
        blue: '#1e88e5',
        green: '#00c853',
        darkGreen: '#009e42',
        black: '#000000'
    };
    
    // Password toggle elements
    const togglePassword = document.getElementById('togglePassword');
    const eyeIcon = document.getElementById('eyeIcon');
    const eyeOffIcon = document.getElementById('eyeOffIcon');
    
    // Smooth scroll to element
    function scrollToElement(element, offset = 100) {
        if (element && !element.classList.contains('hidden')) {
            const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
            window.scrollTo({
                top: elementPosition - offset,
                behavior: 'smooth'
            });
        }
    }
    
    // Show error with auto-scroll
    function showErrorWithScroll(message) {
        loginError.textContent = message;
        loginError.classList.remove('hidden');
        scrollToElement(loginError);
        
        setTimeout(() => {
            loginError.classList.add('hidden');
        }, 5000);
    }
    
    // Show success with auto-scroll
    function showSuccessWithScroll(message) {
        loginSuccess.textContent = message;
        loginSuccess.classList.remove('hidden');
        scrollToElement(loginSuccess);
        
        setTimeout(() => {
            loginSuccess.classList.add('hidden');
        }, 3000);
    }
    
    // Set loading state
    function setLoading(isLoading) {
        loginButton.disabled = isLoading;
        if (isLoading) {
            buttonText.textContent = 'Logging in...';
            buttonSpinner.classList.remove('hidden');
        } else {
            buttonText.textContent = 'Login to DBI Learning';
            buttonSpinner.classList.add('hidden');
        }
    }
    
    // Password visibility toggle
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            if (eyeIcon && eyeOffIcon) {
                eyeIcon.classList.toggle('hidden');
                eyeOffIcon.classList.toggle('hidden');
            }
        });
    }
    
    // Helper function to lookup email by username
    async function getEmailByUsername(username) {
        try {
            console.log('Looking up username:', username.toLowerCase());
            
            // Create query with limit(1) to satisfy security rules
            const usersRef = collection(db, 'users');
            const q = query(
                usersRef, 
                where('usernameLower', '==', username.toLowerCase()),
                limit(1)  // Now limit is properly imported
            );
            
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                const userData = userDoc.data();
                console.log('✅ Found user document for username:', username);
                return {
                    email: userData.email,
                    userId: userDoc.id,
                    userData: userData
                };
            } else {
                console.log('❌ No user found with username:', username);
                return null;
            }
        } catch (error) {
            console.error('Error looking up username:', error);
            
            // Provide specific error messages based on error type
            if (error.code === 'permission-denied') {
                throw new Error('Unable to lookup username due to security restrictions. Please use your email address to login.');
            } else if (error.code === 'failed-precondition') {
                throw new Error('Query constraints not met. Please use your email address to login.');
            } else {
                throw new Error('Error looking up username. Please try using your email address.');
            }
        }
    }
    
    // Handle login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const usernameOrEmail = usernameInput.value.trim();
            const password = passwordInput.value;
            const remember = rememberCheckbox.checked;
            
            if (!usernameOrEmail || !password) {
                showErrorWithScroll('Please fill in all fields');
                if (!usernameOrEmail) usernameInput.focus();
                else passwordInput.focus();
                return;
            }
            
            setLoading(true);
            
            try {
                let userEmail = usernameOrEmail;
                let userDocData = null;
                let userDocId = null;
                
                console.log('=== LOGIN ATTEMPT ===');
                console.log('Input provided:', usernameOrEmail);
                
                // Check if input is username (doesn't contain @) and get email
                if (!usernameOrEmail.includes('@')) {
                    console.log('Username detected. Attempting to find associated email...');
                    
                    const lookupResult = await getEmailByUsername(usernameOrEmail);
                    
                    if (!lookupResult) {
                        showErrorWithScroll(`Username "${usernameOrEmail}" not found. Please check the username or use your email address.`);
                        setLoading(false);
                        return;
                    }
                    
                    userEmail = lookupResult.email;
                    userDocData = lookupResult.userData;
                    userDocId = lookupResult.userId;
                    console.log('✅ Found email for username:', userEmail);
                }
                
                console.log('Attempting Firebase Auth sign in with email:', userEmail);
                
                // FIRST: Authenticate with Firebase Auth
                const userCredential = await signInWithEmailAndPassword(auth, userEmail, password);
                const user = userCredential.user;
                console.log('✅ Firebase Auth sign in successful:', user.email);
                
                // NOW that user is authenticated, we can query Firestore for complete user data
                console.log('Fetching user data from Firestore...');
                
                // If we didn't get user data from username lookup, fetch it now
                if (!userDocData) {
                    try {
                        // Try to get user document by userId (now we have the authenticated user)
                        const userDocRef = doc(db, 'users', user.uid);
                        const userDocSnap = await getDoc(userDocRef);
                        
                        if (userDocSnap.exists()) {
                            userDocData = userDocSnap.data();
                            userDocId = user.uid;
                            console.log('✅ User document found by UID:', {
                                id: userDocId,
                                username: userDocData.username,
                                email: userDocData.email,
                                role: userDocData.role,
                                status: userDocData.status
                            });
                        } else {
                            // Try to find by email as fallback
                            console.log('No user document found by UID, trying by email...');
                            const usersRef = collection(db, 'users');
                            const q = query(usersRef, where('email', '==', user.email.toLowerCase()));
                            const querySnapshot = await getDocs(q);
                            
                            if (!querySnapshot.empty) {
                                const userDoc = querySnapshot.docs[0];
                                userDocData = userDoc.data();
                                userDocId = userDoc.id;
                                console.log('✅ User document found by email:', {
                                    id: userDocId,
                                    username: userDocData.username,
                                    email: userDocData.email,
                                    role: userDocData.role,
                                    status: userDocData.status
                                });
                            } else {
                                console.warn('⚠️ No user document found in Firestore for this user');
                            }
                        }
                    } catch (firestoreError) {
                        console.error('❌ Error fetching user data:', firestoreError);
                        // Continue without user data - will use auth only
                    }
                }
                
                // Check if account is active (if we have user document)
                if (userDocData && userDocData.status !== 'active') {
                    console.error('❌ Account is not active. Status:', userDocData.status);
                    // Sign out since account is not active
                    await signOut(auth);
                    showErrorWithScroll('This account is not active. Please contact support.');
                    setLoading(false);
                    return;
                }
                
                // Update last login if we have user document
                if (userDocId) {
                    try {
                        await updateDoc(doc(db, 'users', userDocId), {
                            lastLogin: new Date().toISOString(),
                            lastLoginTimestamp: new Date()
                        });
                        console.log('✅ Last login updated successfully');
                    } catch (updateError) {
                        console.warn('⚠️ Failed to update last login:', updateError);
                    }
                }
                
                // Determine user role and redirect
                let userRole = 'student';
                let redirectUrl = 'student/dashboard.html';
                
                if (userDocData && userDocData.role) {
                    userRole = userDocData.role.toLowerCase();
                    console.log('🎯 User role detected:', userRole);
                    
                    const adminRoles = ['admin', 'super_admin', 'superadmin', 'administrator'];
                    
                    if (adminRoles.includes(userRole)) {
                        redirectUrl = 'admin/dashboard.html';
                        console.log('✅ Admin user detected - redirecting to admin dashboard');
                    } 
                    else if (userRole === 'instructor') {
                        if (userDocData.status === 'pending') {
                            console.log('⚠️ Instructor account pending approval');
                            await signOut(auth);
                            showSuccessWithScroll('Your instructor account is pending approval. You will be notified once approved.');
                            setLoading(false);
                            return;
                        }
                        redirectUrl = 'admin/dashboard.html';
                        console.log('✅ Instructor user detected - redirecting to admin dashboard');
                    } 
                    else if (userRole === 'student') {
                        redirectUrl = 'student/dashboard.html';
                        console.log('✅ Student user detected - redirecting to student dashboard');
                    }
                    else {
                        console.warn('⚠️ Unknown role:', userRole, 'defaulting to student');
                        redirectUrl = 'student/dashboard.html';
                    }
                } else {
                    console.log('No role found, defaulting to student');
                    redirectUrl = 'student/dashboard.html';
                }
                
                // Store session data
                localStorage.setItem('userRole', userRole);
                localStorage.setItem('userId', user.uid);
                localStorage.setItem('userEmail', user.email);
                
                if (userDocData) {
                    if (userDocData.username) localStorage.setItem('username', userDocData.username);
                    if (userDocData.fullName) localStorage.setItem('userDisplayName', userDocData.fullName);
                    else localStorage.setItem('userDisplayName', userDocData.username || user.email.split('@')[0]);
                    localStorage.setItem('organization', userDocData.organization || 'Digital Bridge Initiative');
                } else {
                    localStorage.setItem('userDisplayName', user.email.split('@')[0]);
                    localStorage.setItem('organization', 'Digital Bridge Initiative');
                }
                
                if (remember) {
                    localStorage.setItem('rememberedUsername', usernameOrEmail);
                } else {
                    localStorage.removeItem('rememberedUsername');
                }
                
                // Show welcome message
                const welcomeName = userDocData?.fullName || userDocData?.username || user.email.split('@')[0];
                showSuccessWithScroll(`Welcome back, ${welcomeName}! Redirecting to ${userRole} dashboard...`);
                
                console.log('=== REDIRECT SUMMARY ===');
                console.log('User Role:', userRole);
                console.log('Redirect URL:', redirectUrl);
                console.log('========================');
                
                // Redirect after short delay
                setTimeout(() => {
                    window.location.href = redirectUrl;
                }, 1000);
                
            } catch (error) {
                console.error('=== LOGIN ERROR ===');
                console.error('Error code:', error.code);
                console.error('Error message:', error.message);
                
                let errorMessage = 'Login failed. Please check your credentials.';
                
                switch (error.code) {
                    case 'auth/user-not-found':
                        errorMessage = 'No account found with this email address. Please sign up first.';
                        break;
                    case 'auth/wrong-password':
                        errorMessage = 'Incorrect password. Please try again or click "Forgot Password".';
                        break;
                    case 'auth/invalid-credential':
                        errorMessage = 'Invalid email or password. Please check your credentials.';
                        break;
                    case 'auth/too-many-requests':
                        errorMessage = 'Too many failed attempts. Please try again later or reset your password.';
                        break;
                    case 'auth/user-disabled':
                        errorMessage = 'This account has been disabled. Please contact DBI support.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'Please enter a valid email address.';
                        break;
                    case 'auth/network-request-failed':
                        errorMessage = 'Network error. Please check your internet connection.';
                        break;
                    default:
                        errorMessage = `Login failed: ${error.message || 'Please try again or contact support.'}`;
                }
                
                showErrorWithScroll(errorMessage);
                
                loginForm.classList.add('animate-shake');
                setTimeout(() => {
                    loginForm.classList.remove('animate-shake');
                }, 500);
                
            } finally {
                setLoading(false);
            }
        });
    }
    
    // Handle forgot password
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const usernameOrEmail = usernameInput.value.trim();
            
            if (!usernameOrEmail) {
                showErrorWithScroll('Please enter your email address or username');
                usernameInput.focus();
                return;
            }
            
            // Save original text and disable link
            const originalText = forgotPasswordLink.innerHTML;
            forgotPasswordLink.innerHTML = '<span class="flex items-center"><svg class="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Sending...</span>';
            forgotPasswordLink.style.pointerEvents = 'none';
            
            try {
                let email = usernameOrEmail;
                
                // If input is not an email, try to find by username in Firestore
                if (!usernameOrEmail.includes('@')) {
                    try {
                        console.log('Password reset - searching for username:', usernameOrEmail.toLowerCase());
                        
                        // Create query with limit(1) to satisfy security rules
                        const usersRef = collection(db, 'users');
                        const q = query(
                            usersRef, 
                            where('usernameLower', '==', usernameOrEmail.toLowerCase()),
                            limit(1)  // Now limit is properly imported
                        );
                        const querySnapshot = await getDocs(q);
                        
                        if (!querySnapshot.empty) {
                            email = querySnapshot.docs[0].data().email;
                            console.log('✅ Found email for username:', email);
                        } else {
                            showErrorWithScroll('Unable to find account with this username. Please check and try again.');
                            forgotPasswordLink.innerHTML = originalText;
                            forgotPasswordLink.style.pointerEvents = 'auto';
                            return;
                        }
                    } catch (firestoreError) {
                        console.error('Firestore lookup failed:', firestoreError);
                        
                        let errorMessage = 'Unable to verify username. ';
                        if (firestoreError.code === 'permission-denied') {
                            errorMessage += 'Please use your email address instead.';
                        } else if (firestoreError.code === 'failed-precondition') {
                            errorMessage += 'Please use your email address to reset your password.';
                        } else {
                            errorMessage += 'Please contact DBI support.';
                        }
                        
                        showErrorWithScroll(errorMessage);
                        forgotPasswordLink.innerHTML = originalText;
                        forgotPasswordLink.style.pointerEvents = 'auto';
                        return;
                    }
                }
                
                if (email && email.includes('@')) {
                    await sendPasswordResetEmail(auth, email);
                    console.log('Password reset email sent to:', email);
                    showSuccessWithScroll(`Password reset link sent to ${email}. Check your inbox and follow the instructions.`);
                    usernameInput.value = '';
                } else {
                    showErrorWithScroll('Invalid email address. Please enter a valid email.');
                }
                
            } catch (error) {
                console.error('Password reset error:', error);
                let errorMessage = 'Failed to send reset email. Please try again.';
                
                if (error.code === 'auth/user-not-found') {
                    errorMessage = 'No account found with this email address.';
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage = 'Invalid email address format.';
                } else if (error.code === 'auth/too-many-requests') {
                    errorMessage = 'Too many requests. Please try again later.';
                }
                
                showErrorWithScroll(errorMessage);
            } finally {
                forgotPasswordLink.innerHTML = originalText;
                forgotPasswordLink.style.pointerEvents = 'auto';
            }
        });
    }
    
    // Load remembered username
    const rememberedUsername = localStorage.getItem('rememberedUsername');
    if (rememberedUsername && usernameInput) {
        usernameInput.value = rememberedUsername;
        if (rememberCheckbox) {
            rememberCheckbox.checked = true;
        }
        // Optionally focus on password field
        if (passwordInput) {
            passwordInput.focus();
        }
        console.log('Loaded remembered username:', rememberedUsername);
    }
    
    // Check if user is already logged in
    const currentUser = auth.currentUser;
    if (currentUser && window.location.pathname.includes('login.html')) {
        console.log('User already logged in:', currentUser.email);
        // Redirect to appropriate dashboard if already logged in
        const userRole = localStorage.getItem('userRole') || 'student';
        console.log('Stored user role:', userRole);
        
        const redirectMap = {
            'admin': 'admin/dashboard.html',
            'super_admin': 'admin/dashboard.html',
            'superadmin': 'admin/dashboard.html',
            'administrator': 'admin/dashboard.html',
            'instructor': 'admin/dashboard.html',
            'student': 'student/dashboard.html'
        };
        
        const redirectUrl = redirectMap[userRole] || 'student/dashboard.html';
        console.log('Redirecting already logged-in user to:', redirectUrl);
        
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 500);
    }
    
    // Add DBI branding to console
    console.log('%c Digital Bridge Initiative ', 'background: #1e88e5; color: white; font-size: 14px; padding: 4px 8px; border-radius: 4px;');
    console.log('%c Bridging the digital divide through education ', 'color: #00c853; font-size: 12px;');
    console.log('Login page loaded - Ready for authentication');
});