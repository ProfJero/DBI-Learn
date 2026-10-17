// Auth state observer
import { auth } from './firebase-config.js';

// Check authentication state
export const checkAuthState = (callback) => {
    auth.onAuthStateChanged((user) => {
        callback(user);
    });
};

// Show error message
export const showError = (elementId, message) => {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
        
        // Hide after 3 seconds
        setTimeout(() => {
            errorElement.classList.add('hidden');
        }, 3000);
    }
};

// Show success message
export const showSuccess = (elementId, message) => {
    const successElement = document.getElementById(elementId);
    if (successElement) {
        successElement.textContent = message;
        successElement.classList.remove('hidden');
        
        // Hide after 3 seconds
        setTimeout(() => {
            successElement.classList.add('hidden');
        }, 3000);
    }
};

// Validate email
export const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Validate password (min 6 characters)
export const isValidPassword = (password) => {
    return password.length >= 6;
};