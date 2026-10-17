import { 
    auth, signOut, db, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
    collection, query, where, onAuthStateChanged, runTransaction
} from '../firebase-config.js';

let currentAdmin = null;
let currentCourseId = null;
let currentCourseData = null;
let modules = [];
let resources = [];
let quizzes = [];

// Quiz questions storage for the modal
let quizQuestions = [];
// Image links storage
let imageLinks = [];
let quizImageLinks = [];

// Track currently active editor
let currentActiveEditor = null;

// Get course ID from URL
const urlParams = new URLSearchParams(window.location.search);
const urlCourseId = urlParams.get('id');

// Helper function to extract Google Drive File ID
function extractGoogleDriveFileId(url) {
    if (!url || typeof url !== 'string') return null;
    
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,
        /id=([a-zA-Z0-9_-]+)/,
        /uc\?.*id=([a-zA-Z0-9_-]+)/,
        /\/d\/([a-zA-Z0-9_-]+)/,
        /^([a-zA-Z0-9_-]{25,})$/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

// Helper function to get Google Drive direct image URL for display
function getGoogleDriveImageUrl(url) {
    if (!url) return null;
    
    const fileId = extractGoogleDriveFileId(url);
    
    if (fileId) {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
    
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        return url;
    }
    
    return null;
}

// Focus on the active editor
function focusEditor(editorId) {
    const editor = document.getElementById(editorId);
    if (editor) {
        editor.focus();
        currentActiveEditor = editorId;
    }
}

// Insert Inline Image into Rich Text Editor
window.insertInlineImage = () => {
    if (!currentActiveEditor) {
        alert('Please click inside the editor first to activate it.');
        return;
    }
    
    const description = prompt('Enter image description/alt text:', 'Lesson image');
    if (!description) return;
    
    const url = prompt('Enter Google Drive image URL:', 'https://drive.google.com/file/d/FILE_ID/view');
    if (!url) return;
    
    const imageUrl = getGoogleDriveImageUrl(url);
    if (!imageUrl) {
        alert('Invalid Google Drive URL. Please make sure the link is correct.');
        return;
    }
    
    const editor = document.getElementById(currentActiveEditor);
    if (editor) {
        editor.focus();
        
        const containerId = 'img_' + Date.now();
        
        const html = `
            <div id="${containerId}" class="lesson-image my-4" contenteditable="false">
                <img src="${imageUrl}" alt="${escapeHtml(description)}" class="rounded-lg shadow-md max-w-full h-auto" style="max-height: 400px; object-fit: contain;">
                <p class="text-sm text-gray-500 mt-2 text-center italic">${escapeHtml(description)}</p>
            </div>
            <div class="clear-both"></div>
            <br>
        `;
        
        document.execCommand('insertHTML', false, html);
        
        const range = document.createRange();
        const selection = window.getSelection();
        const lastElement = editor.lastChild;
        if (lastElement) {
            range.setStartAfter(lastElement);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        editor.focus();
    }
};

// Insert Bulleted List
window.insertBulletedList = () => {
    if (!currentActiveEditor) {
        alert('Please click inside the editor first to add a list.');
        return;
    }
    const editor = document.getElementById(currentActiveEditor);
    if (editor) {
        editor.focus();
        document.execCommand('insertUnorderedList', false, null);
    }
};

// Insert Numbered List
window.insertNumberedList = () => {
    if (!currentActiveEditor) {
        alert('Please click inside the editor first to add a list.');
        return;
    }
    const editor = document.getElementById(currentActiveEditor);
    if (editor) {
        editor.focus();
        document.execCommand('insertOrderedList', false, null);
    }
};

// Insert Link
window.insertLink = () => {
    if (!currentActiveEditor) {
        alert('Please click inside the editor first to insert a link.');
        return;
    }
    const editor = document.getElementById(currentActiveEditor);
    if (editor) {
        editor.focus();
        const url = prompt('Enter URL:', 'https://');
        if (url) {
            document.execCommand('createLink', false, url);
        }
    }
};

// Format text
window.formatText = (command) => {
    if (!currentActiveEditor) {
        alert('Please click inside the editor first to format text.');
        return;
    }
    const editor = document.getElementById(currentActiveEditor);
    if (editor) {
        editor.focus();
        document.execCommand(command, false, null);
    }
};

// ========== BULK QUIZ UPLOAD FUNCTIONS ==========

// Show bulk upload modal
window.showBulkUploadModal = () => {
    // Check if modal already exists
    const existingModal = document.getElementById('bulkUploadModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'bulkUploadModal';
    modal.className = 'fixed inset-0 z-50 hidden';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"></div>
        <div class="relative min-h-screen flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden modal">
                <div class="p-6 border-b border-gray-200 flex items-center justify-between">
                    <h2 class="text-xl font-semibold text-gray-800">
                        <i class="fas fa-upload text-[#1e88e5] mr-2"></i>
                        Bulk Upload Quiz Questions
                    </h2>
                    <button onclick="document.getElementById('bulkUploadModal').remove()" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div class="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                    <div class="mb-6">
                        <h3 class="font-semibold text-gray-800 mb-3">Instructions:</h3>
                        <ul class="list-disc list-inside text-sm text-gray-600 space-y-1">
                            <li>Upload a CSV or JSON file containing your quiz questions</li>
                            <li><strong>CSV Format:</strong> question_text, type, options, correct_answer, explanation</li>
                            <li><strong>For Multiple Choice:</strong> options should be pipe-separated (e.g., "Option A|Option B|Option C|Option D")</li>
                            <li><strong>For True/False:</strong> set type to "true_false", correct_answer to "true" or "false"</li>
                            <li><strong>For Short Answer:</strong> set type to "short_answer", correct_answer is the expected answer</li>
                            <li><strong>JSON Format:</strong> Array of question objects</li>
                        </ul>
                    </div>
                    
                    <div class="mb-6">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Upload CSV or JSON File</label>
                        <div id="bulkDragDropArea" class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-[#1e88e5] transition">
                            <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-3"></i>
                            <p class="text-gray-600 mb-2">Click to upload or drag and drop</p>
                            <p class="text-xs text-gray-500">CSV or JSON files (Max 10MB)</p>
                            <input type="file" id="bulkFileInput" class="hidden" accept=".csv,.json">
                        </div>
                        <div id="bulkFilePreview" class="hidden mt-3 p-3 bg-gray-50 rounded-lg">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center space-x-3">
                                    <i class="fas fa-file text-2xl text-[#1e88e5]"></i>
                                    <div>
                                        <p id="bulkFileName" class="text-sm font-medium text-gray-700"></p>
                                        <p id="bulkFileSize" class="text-xs text-gray-500"></p>
                                    </div>
                                </div>
                                <button type="button" id="removeBulkFileBtn" class="text-red-500 hover:text-red-700">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mb-6">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Or Paste JSON Directly</label>
                        <textarea id="bulkJsonInput" rows="8" class="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-[#1e88e5] outline-none" 
                            placeholder='[
  {
    "type": "multiple_choice",
    "text": "What is JavaScript?",
    "options": ["Programming language", "Coffee brand", "Database", "Framework"],
    "correct": 0,
    "explanation": "JavaScript is a programming language used for web development"
  }
]'></textarea>
                        <p class="text-xs text-gray-500 mt-1">Paste JSON array of questions. Click "Preview" to validate before uploading.</p>
                    </div>
                    
                    <div class="flex space-x-3">
                        <button onclick="previewBulkQuestions()" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
                            <i class="fas fa-eye mr-2"></i> Preview Questions
                        </button>
                        <button onclick="confirmBulkUpload()" class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
                            <i class="fas fa-check-circle mr-2"></i> Add to Quiz
                        </button>
                        <button onclick="document.getElementById('bulkUploadModal').remove()" class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition">
                            Cancel
                        </button>
                    </div>
                    
                    <div id="bulkPreviewContainer" class="mt-6 hidden">
                        <h3 class="font-semibold text-gray-800 mb-3">Preview Questions:</h3>
                        <div id="bulkPreviewList" class="max-h-96 overflow-y-auto space-y-2"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    
    // Setup drag and drop for bulk upload
    const dragDropArea = document.getElementById('bulkDragDropArea');
    const fileInput = document.getElementById('bulkFileInput');
    const removeBtn = document.getElementById('removeBulkFileBtn');
    let selectedFile = null;
    
    if (dragDropArea) {
        dragDropArea.addEventListener('click', () => fileInput.click());
        
        dragDropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dragDropArea.classList.add('border-[#1e88e5]', 'bg-blue-50');
        });
        
        dragDropArea.addEventListener('dragleave', () => {
            dragDropArea.classList.remove('border-[#1e88e5]', 'bg-blue-50');
        });
        
        dragDropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dragDropArea.classList.remove('border-[#1e88e5]', 'bg-blue-50');
            const files = e.dataTransfer.files;
            if (files.length > 0) handleBulkFileSelect(files[0]);
        });
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleBulkFileSelect(e.target.files[0]);
        });
    }
    
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            selectedFile = null;
            fileInput.value = '';
            const filePreview = document.getElementById('bulkFilePreview');
            if (filePreview) filePreview.classList.add('hidden');
            if (dragDropArea) dragDropArea.classList.remove('hidden');
        });
    }
    
    function handleBulkFileSelect(file) {
        selectedFile = file;
        if (file.size > 10 * 1024 * 1024) {
            showToast('File size exceeds 10MB limit', 'error');
            return;
        }
        const fileNameEl = document.getElementById('bulkFileName');
        const fileSizeEl = document.getElementById('bulkFileSize');
        const filePreview = document.getElementById('bulkFilePreview');
        
        if (fileNameEl) fileNameEl.textContent = file.name;
        if (fileSizeEl) fileSizeEl.textContent = formatFileSize(file.size);
        if (filePreview) filePreview.classList.remove('hidden');
        if (dragDropArea) dragDropArea.classList.add('hidden');
        
        // Parse file
        parseBulkFile(file);
    }
    
    function parseBulkFile(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                if (extension === 'json') {
                    const questions = JSON.parse(e.target.result);
                    validateAndStoreBulkQuestions(questions);
                } else if (extension === 'csv') {
                    const questions = parseCSV(e.target.result);
                    validateAndStoreBulkQuestions(questions);
                }
            } catch (error) {
                showToast('Error parsing file: ' + error.message, 'error');
            }
        };
        
        if (extension === 'csv') {
            reader.readAsText(file);
        } else if (extension === 'json') {
            reader.readAsText(file);
        }
    }
    
    function parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const questions = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            // Parse CSV line respecting quotes
            const values = [];
            let inQuotes = false;
            let currentValue = '';
            
            for (let j = 0; j < lines[i].length; j++) {
                const char = lines[i][j];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(currentValue);
                    currentValue = '';
                } else {
                    currentValue += char;
                }
            }
            values.push(currentValue);
            
            // Remove quotes from values
            const cleanedValues = values.map(v => v.replace(/^"|"$/g, '').trim());
            
            const question = {};
            headers.forEach((header, index) => {
                question[header] = cleanedValues[index] || '';
            });
            
            // Convert to standard format
            const standardQuestion = {
                type: question.type || 'multiple_choice',
                text: question.question_text || question.text || '',
                explanation: question.explanation || ''
            };
            
            if (standardQuestion.type === 'multiple_choice') {
                standardQuestion.options = question.options ? question.options.split('|') : ['', '', '', ''];
                standardQuestion.correct = parseInt(question.correct_answer) || 0;
            } else if (standardQuestion.type === 'true_false') {
                standardQuestion.correct = question.correct_answer === 'true';
            } else if (standardQuestion.type === 'short_answer') {
                standardQuestion.correctAnswer = question.correct_answer || '';
                standardQuestion.caseSensitive = question.case_sensitive === 'true';
            }
            
            questions.push(standardQuestion);
        }
        
        return questions;
    }
    
    window.previewBulkQuestions = () => {
        const jsonInput = document.getElementById('bulkJsonInput');
        if (jsonInput && jsonInput.value.trim()) {
            try {
                const questions = JSON.parse(jsonInput.value);
                validateAndStoreBulkQuestions(questions);
            } catch (error) {
                showToast('Invalid JSON format: ' + error.message, 'error');
            }
        } else if (window.bulkQuestions) {
            displayBulkPreview(window.bulkQuestions);
        } else {
            showToast('Please upload a file or paste JSON first', 'warning');
        }
    };
    
    let bulkQuestions = [];
    
    function validateAndStoreBulkQuestions(questions) {
        if (!Array.isArray(questions)) {
            showToast('Questions must be an array', 'error');
            return;
        }
        
        bulkQuestions = questions.filter(q => {
            if (!q.text || !q.type) {
                console.warn('Skipping invalid question:', q);
                return false;
            }
            return true;
        });
        
        if (bulkQuestions.length === 0) {
            showToast('No valid questions found', 'error');
            return;
        }
        
        displayBulkPreview(bulkQuestions);
        showToast(`${bulkQuestions.length} questions loaded successfully`, 'success');
    }
    
    function displayBulkPreview(questions) {
        const container = document.getElementById('bulkPreviewContainer');
        const list = document.getElementById('bulkPreviewList');
        
        if (!container || !list) return;
        
        list.innerHTML = questions.map((q, idx) => `
            <div class="border rounded-lg p-3 bg-gray-50">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-2 mb-2">
                            <span class="text-xs font-medium px-2 py-1 rounded-full ${getTypeBadgeClass(q.type)}">
                                ${q.type.replace('_', ' ').toUpperCase()}
                            </span>
                            <span class="text-xs text-gray-500">Question ${idx + 1}</span>
                        </div>
                        <p class="text-sm font-medium text-gray-800 mb-2">${escapeHtml(q.text)}</p>
                        ${q.options ? `<p class="text-xs text-gray-600">Options: ${q.options.join(' | ')}</p>` : ''}
                        <p class="text-xs text-green-600 mt-1">✓ Correct: ${q.type === 'multiple_choice' ? `Option ${String.fromCharCode(65 + (q.correct || 0))}` : q.correct === true ? 'True' : q.correct === false ? 'False' : q.correctAnswer || 'N/A'}</p>
                        ${q.explanation ? `<p class="text-xs text-gray-500 mt-1">📝 ${escapeHtml(q.explanation)}</p>` : ''}
                    </div>
                    <button onclick="removeBulkQuestion(${idx})" class="text-red-500 hover:text-red-700 ml-2">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        container.classList.remove('hidden');
        
        window.removeBulkQuestion = (index) => {
            bulkQuestions.splice(index, 1);
            displayBulkPreview(bulkQuestions);
        };
    }
    
    function getTypeBadgeClass(type) {
        switch(type) {
            case 'multiple_choice': return 'bg-blue-100 text-blue-700';
            case 'true_false': return 'bg-green-100 text-green-700';
            case 'short_answer': return 'bg-purple-100 text-purple-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    }
    
    window.confirmBulkUpload = () => {
        if (!bulkQuestions || bulkQuestions.length === 0) {
            const jsonInput = document.getElementById('bulkJsonInput');
            if (jsonInput && jsonInput.value.trim()) {
                try {
                    bulkQuestions = JSON.parse(jsonInput.value);
                } catch (error) {
                    showToast('Invalid JSON format', 'error');
                    return;
                }
            } else {
                showToast('No questions to upload', 'warning');
                return;
            }
        }
        
        // Add each question to quizQuestions
        bulkQuestions.forEach(q => {
            const newQuestion = {
                id: Date.now() + Math.random() + Math.random(),
                ...q
            };
            
            // Ensure options array for multiple choice
            if (newQuestion.type === 'multiple_choice' && (!newQuestion.options || newQuestion.options.length === 0)) {
                newQuestion.options = ['', '', '', ''];
            }
            
            quizQuestions.push(newQuestion);
        });
        
        // Refresh the quiz questions display
        refreshQuizQuestionsDisplay();
        
        // Close modal
        const modal = document.getElementById('bulkUploadModal');
        if (modal) modal.remove();
        
        showToast(`${bulkQuestions.length} questions added successfully!`, 'success');
    };
    
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    function refreshQuizQuestionsDisplay() {
        const container = document.getElementById('quizQuestionsContainer');
        if (!container) return;
        
        container.innerHTML = '';
        quizQuestions.forEach((q, idx) => {
            let questionHtml = '';
            if (q.type === 'multiple_choice') {
                const options = q.options || ['', '', '', ''];
                questionHtml = `
                    <div class="quiz-question-card border rounded-lg p-4 bg-white" id="question_${q.id}">
                        <div class="flex justify-between items-center mb-3">
                            <h4 class="font-medium text-gray-800">Multiple Choice Question ${idx + 1}</h4>
                            <button type="button" onclick="removeQuizQuestion(${q.id})" class="text-red-500 hover:text-red-700">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="mb-3">
                            <input type="text" placeholder="Question text" value="${escapeHtml(q.text)}" onchange="updateQuizQuestion(${q.id}, 'text', this.value)"
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none">
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            ${['A', 'B', 'C', 'D'].map((letter, optIdx) => `
                                <div class="quiz-option flex items-center space-x-2">
                                    <span class="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm">${letter}</span>
                                    <input type="text" placeholder="Option ${letter}" value="${escapeHtml(options[optIdx] || '')}" onchange="updateQuizQuestion(${q.id}, 'option', this.value, ${optIdx})"
                                           class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none">
                                </div>
                            `).join('')}
                        </div>
                        <div class="flex items-center space-x-4">
                            <span class="text-sm text-gray-600">Correct Answer:</span>
                            <div class="flex space-x-3">
                                ${['A', 'B', 'C', 'D'].map((letter, optIdx) => `
                                    <label class="flex items-center space-x-1 cursor-pointer">
                                        <input type="radio" name="correct_${q.id}" value="${optIdx}" ${(q.correct === optIdx) ? 'checked' : ''} onchange="updateQuizQuestion(${q.id}, 'correct', ${optIdx})"
                                               class="w-4 h-4 text-[#1e88e5]">
                                        <span class="text-sm">${letter}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        ${q.explanation ? `<p class="text-xs text-gray-500 mt-2">📝 ${escapeHtml(q.explanation)}</p>` : ''}
                    </div>
                `;
            } else if (q.type === 'true_false') {
                questionHtml = `
                    <div class="quiz-question-card border rounded-lg p-4 bg-white" id="question_${q.id}">
                        <div class="flex justify-between items-center mb-3">
                            <h4 class="font-medium text-gray-800">True/False Question ${idx + 1}</h4>
                            <button type="button" onclick="removeQuizQuestion(${q.id})" class="text-red-500 hover:text-red-700">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="mb-3">
                            <input type="text" placeholder="Statement" value="${escapeHtml(q.text)}" onchange="updateQuizQuestion(${q.id}, 'text', this.value)"
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none">
                        </div>
                        <div class="flex items-center space-x-4">
                            <span class="text-sm text-gray-600">Correct Answer:</span>
                            <div class="flex space-x-3">
                                <label class="flex items-center space-x-1 cursor-pointer">
                                    <input type="radio" name="correct_tf_${q.id}" value="true" ${q.correct === true ? 'checked' : ''} onchange="updateQuizQuestion(${q.id}, 'correct', true)"
                                           class="w-4 h-4 text-[#1e88e5]">
                                    <span class="text-sm">True</span>
                                </label>
                                <label class="flex items-center space-x-1 cursor-pointer">
                                    <input type="radio" name="correct_tf_${q.id}" value="false" ${q.correct === false ? 'checked' : ''} onchange="updateQuizQuestion(${q.id}, 'correct', false)"
                                           class="w-4 h-4 text-[#1e88e5]">
                                    <span class="text-sm">False</span>
                                </label>
                            </div>
                        </div>
                        ${q.explanation ? `<p class="text-xs text-gray-500 mt-2">📝 ${escapeHtml(q.explanation)}</p>` : ''}
                    </div>
                `;
            } else if (q.type === 'short_answer') {
                questionHtml = `
                    <div class="quiz-question-card border rounded-lg p-4 bg-white" id="question_${q.id}">
                        <div class="flex justify-between items-center mb-3">
                            <h4 class="font-medium text-gray-800">Short Answer Question ${idx + 1}</h4>
                            <button type="button" onclick="removeQuizQuestion(${q.id})" class="text-red-500 hover:text-red-700">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="mb-3">
                            <input type="text" placeholder="Question text" value="${escapeHtml(q.text)}" onchange="updateQuizQuestion(${q.id}, 'text', this.value)"
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none">
                        </div>
                        <div class="mb-3">
                            <label class="block text-sm text-gray-600 mb-1">Expected Answer (for grading reference)</label>
                            <textarea placeholder="Expected answer or keywords to look for..." onchange="updateQuizQuestion(${q.id}, 'correctAnswer', this.value)"
                                      rows="2" class="short-answer-input w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none">${escapeHtml(q.correctAnswer || '')}</textarea>
                        </div>
                        <div class="flex items-center space-x-4">
                            <label class="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" ${q.caseSensitive ? 'checked' : ''} onchange="updateQuizQuestion(${q.id}, 'caseSensitive', this.checked)"
                                       class="w-4 h-4 text-[#1e88e5]">
                                <span class="text-sm text-gray-600">Case sensitive matching</span>
                            </label>
                        </div>
                        ${q.explanation ? `<p class="text-xs text-gray-500 mt-2">📝 ${escapeHtml(q.explanation)}</p>` : ''}
                    </div>
                `;
            }
            container.insertAdjacentHTML('beforeend', questionHtml);
        });
    }
};

// ========== END BULK UPLOAD FUNCTIONS ==========

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
        await loadCoursesList();
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
        document.getElementById('adminRole').textContent = 'Content Manager';
        const avatarUrl = `https://ui-avatars.com/api/?background=1e88e5&color=fff&bold=true&size=40&name=${encodeURIComponent(data.fullName || 'Admin')}`;
        document.getElementById('adminAvatar').src = avatarUrl;
        document.getElementById('dropdownAvatar').src = avatarUrl;
    }
}

// Load courses for selector
async function loadCoursesList() {
    try {
        const coursesRef = collection(db, 'courses');
        const snapshot = await getDocs(coursesRef);
        const selector = document.getElementById('courseSelector');
        
        selector.innerHTML = '<option value="">-- Select a course to manage content --</option>';
        snapshot.forEach(doc => {
            const course = doc.data();
            selector.innerHTML += `<option value="${doc.id}" ${urlCourseId === doc.id ? 'selected' : ''}>${escapeHtml(course.title)} (${course.status || 'draft'})</option>`;
        });
        
        if (urlCourseId) {
            currentCourseId = urlCourseId;
            await loadCourseData();
            document.getElementById('courseInfoCard').classList.remove('hidden');
            document.getElementById('contentTabs').classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error loading courses:', error);
        showToast('Failed to load courses', 'error');
    }
}

// Course selector change handler
document.getElementById('courseSelector').addEventListener('change', async (e) => {
    currentCourseId = e.target.value;
    if (currentCourseId) {
        await loadCourseData();
        document.getElementById('courseInfoCard').classList.remove('hidden');
        document.getElementById('contentTabs').classList.remove('hidden');
    } else {
        document.getElementById('courseInfoCard').classList.add('hidden');
        document.getElementById('contentTabs').classList.add('hidden');
    }
});

// Load course data
async function loadCourseData() {
    try {
        const courseDoc = await getDoc(doc(db, 'courses', currentCourseId));
        if (courseDoc.exists()) {
            currentCourseData = { id: courseDoc.id, ...courseDoc.data() };
            
            document.getElementById('selectedCourseTitle').textContent = currentCourseData.title;
            document.getElementById('selectedCourseDesc').textContent = currentCourseData.shortDescription || 'No description';
            document.getElementById('selectedCourseStatus').textContent = currentCourseData.status || 'draft';
            document.getElementById('selectedCourseLevel').textContent = currentCourseData.level || 'Beginner';
            
            await loadModules();
            await loadResources();
            await loadQuizzes();
        }
    } catch (error) {
        console.error('Error loading course:', error);
        showToast('Failed to load course data', 'error');
    }
}

// Load modules with enhanced structure
async function loadModules() {
    const container = document.getElementById('modulesContainer');
    container.innerHTML = `
        <div class="text-center py-12">
            <i class="fas fa-spinner fa-spin text-3xl text-[#1e88e5] mb-3"></i>
            <p class="text-gray-500">Loading modules...</p>
        </div>
    `;
    
    try {
        const courseDoc = await getDoc(doc(db, 'courses', currentCourseId));
        if (!courseDoc.exists()) {
            container.innerHTML = `
                <div class="text-center py-12 bg-red-50 rounded-xl">
                    <i class="fas fa-exclamation-circle text-4xl text-red-400 mb-3"></i>
                    <p class="text-red-600">Course not found. Please select a valid course.</p>
                </div>
            `;
            return;
        }
        
        const modulesRef = collection(db, 'courses', currentCourseId, 'modules');
        const snapshot = await getDocs(modulesRef);
        
        modules = [];
        for (const docSnapshot of snapshot.docs) {
            const moduleData = { id: docSnapshot.id, ...docSnapshot.data() };
            
            try {
                const lessonsRef = collection(db, 'courses', currentCourseId, 'modules', docSnapshot.id, 'lessons');
                const lessonsSnapshot = await getDocs(lessonsRef);
                moduleData.lessons = [];
                lessonsSnapshot.forEach(lessonDoc => {
                    moduleData.lessons.push({ id: lessonDoc.id, ...lessonDoc.data() });
                });
                moduleData.lessons.sort((a, b) => (a.order || 0) - (b.order || 0));
            } catch (lessonError) {
                console.warn('Error loading lessons for module:', lessonError);
                moduleData.lessons = [];
            }
            
            modules.push(moduleData);
        }
        
        modules.sort((a, b) => (a.order || 0) - (b.order || 0));
        displayModules();
        
    } catch (error) {
        console.error('Error loading modules:', error);
        let errorMessage = 'Unable to load modules. ';
        if (error.code === 'permission-denied') {
            errorMessage += 'You don\'t have permission to access this course content.';
        } else if (error.code === 'not-found') {
            errorMessage += 'The course or modules collection was not found.';
        } else {
            errorMessage += error.message;
        }
        
        container.innerHTML = `
            <div class="text-center py-12 bg-red-50 rounded-xl">
                <i class="fas fa-lock text-4xl text-red-400 mb-3"></i>
                <p class="text-red-600 font-medium mb-2">Permission Error</p>
                <p class="text-red-500 text-sm mb-4">${errorMessage}</p>
                <div class="flex justify-center space-x-3">
                    <button onclick="location.reload()" class="px-4 py-2 bg-[#1e88e5] text-white rounded-lg">
                        <i class="fas fa-refresh mr-2"></i> Reload Page
                    </button>
                </div>
            </div>
        `;
    }
}

// Display modules with enhanced quiz display and banner
function displayModules() {
    const container = document.getElementById('modulesContainer');
    
    if (!modules || modules.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 bg-gray-50 rounded-xl">
                <i class="fas fa-folder-open text-4xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No modules yet. Click "Add Module" to get started.</p>
                <button onclick="document.getElementById('addModuleBtn').click()" 
                        class="mt-4 px-4 py-2 bg-[#1e88e5] text-white rounded-lg">
                    <i class="fas fa-plus mr-2"></i> Create First Module
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = modules.map((module, idx) => {
        const bannerHtml = module.bannerUrl ? `
            <div class="h-32 overflow-hidden">
                <img src="${module.bannerUrl}" alt="${escapeHtml(module.title)}" class="w-full h-32 object-cover">
            </div>
        ` : '';
        
        return `
            <div class="module-card bg-white border border-gray-200 rounded-xl overflow-hidden">
                ${bannerHtml}
                <div class="bg-gray-50 px-5 py-3 flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <span class="text-gray-400 text-sm">Module ${idx + 1}</span>
                        <h3 class="font-semibold text-gray-800">${escapeHtml(module.title)}</h3>
                        ${module.quizRequired ? 
                            `<span class="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                <i class="fas fa-check-circle mr-1"></i> Quiz Required (${module.passMark || 70}% to pass)
                            </span>` : 
                            `<span class="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                <i class="fas fa-ban mr-1"></i> No Quiz Required
                            </span>`
                        }
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="window.toggleQuizRequirement('${module.id}')" 
                                class="text-purple-500 hover:text-purple-700 transition" title="Toggle Quiz Requirement">
                            <i class="fas fa-question-circle text-xl"></i>
                        </button>
                        <button onclick="window.addLesson('${module.id}')" class="text-[#1e88e5] hover:text-[#009e42] transition" title="Add Lesson">
                            <i class="fas fa-plus-circle text-xl"></i>
                        </button>
                        <button onclick="window.editModule('${module.id}')" class="text-blue-500 hover:text-blue-700 transition" title="Edit Module">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="window.deleteModule('${module.id}')" class="text-red-500 hover:text-red-700 transition" title="Delete Module">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="p-5">
                    <div class="text-gray-600 text-sm mb-4 module-description-preview">
                        ${module.description ? processDescriptionPreview(module.description) : 'No description'}
                    </div>
                    <div class="space-y-2">
                        ${module.lessons && module.lessons.length > 0 ? 
                            module.lessons.map(lesson => `
                                <div class="lesson-card bg-gray-50 rounded-lg p-3 hover:shadow-sm transition">
                                    <div class="flex items-start justify-between">
                                        <div class="flex items-start space-x-3 flex-1">
                                            <i class="fas ${getLessonIcon(lesson.type)} text-gray-400 mt-1"></i>
                                            <div class="flex-1">
                                                <div class="flex items-center justify-between flex-wrap gap-2">
                                                    <p class="font-medium text-gray-800">${escapeHtml(lesson.title)}</p>
                                                    <p class="text-xs text-gray-500">
                                                        ${lesson.type.charAt(0).toUpperCase() + lesson.type.slice(1)} • 
                                                        ${lesson.duration || 'N/A'} min
                                                    </p>
                                                </div>
                                                ${lesson.description ? `
                                                    <div class="text-xs text-gray-500 mt-1 line-clamp-2 lesson-description-preview">
                                                        ${processDescriptionPreview(lesson.description)}
                                                    </div>
                                                ` : ''}
                                                ${lesson.bannerUrl ? `<p class="text-xs text-green-600 mt-1"><i class="fas fa-image mr-1"></i> Has banner image</p>` : ''}
                                                ${lesson.type === 'video' && lesson.content?.originalUrl ? 
                                                    `<p class="text-xs text-[#1e88e5] mt-1"><i class="fas fa-video mr-1"></i> <a href="${lesson.content.originalUrl}" target="_blank" class="hover:underline">View Video</a></p>` : ''}
                                                ${lesson.type === 'quiz' && lesson.content?.questions ? 
                                                    `<p class="text-xs text-gray-500 mt-1"><i class="fas fa-question-circle mr-1"></i> ${lesson.content.questions.length} questions</p>` : ''}
                                                ${lesson.imageLinks && lesson.imageLinks.length > 0 ? 
                                                    `<p class="text-xs text-gray-500 mt-1"><i class="fas fa-image mr-1"></i> ${lesson.imageLinks.length} reference image(s)</p>` : ''}
                                            </div>
                                        </div>
                                        <div class="flex space-x-2 ml-2">
                                            <button onclick="window.editLesson('${module.id}', '${lesson.id}')" class="text-blue-500 hover:text-blue-700">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button onclick="window.deleteLesson('${module.id}', '${lesson.id}')" class="text-red-500 hover:text-red-700">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `).join('') 
                        : '<p class="text-gray-400 text-sm text-center py-4">No lessons yet. Click + to add lessons.</p>'}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Helper function to process description preview
function processDescriptionPreview(html) {
    if (!html) return '';
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    let text = tempDiv.textContent || tempDiv.innerText || '';
    if (text.length > 150) {
        text = text.substring(0, 150) + '...';
    }
    return escapeHtml(text);
}

// Toggle quiz requirement for module
window.toggleQuizRequirement = async (moduleId) => {
    const module = modules.find(m => m.id === moduleId);
    if (!module) return;
    
    const newRequirement = !module.quizRequired;
    const passMark = newRequirement ? 70 : null;
    
    try {
        await updateDoc(doc(db, 'courses', currentCourseId, 'modules', moduleId), {
            quizRequired: newRequirement,
            passMark: passMark,
            updatedAt: new Date().toISOString()
        });
        
        showToast(`Quiz requirement ${newRequirement ? 'enabled' : 'disabled'} for this module`, 'success');
        await loadModules();
    } catch (error) {
        console.error('Error updating quiz requirement:', error);
        showToast('Failed to update quiz requirement', 'error');
    }
};

// Setup module banner image handling
function setupModuleBannerHandler() {
    const bannerUploadArea = document.getElementById('bannerUploadArea');
    const bannerPreview = document.getElementById('bannerPreview');
    const bannerPreviewImg = document.getElementById('bannerPreviewImg');
    const removeBannerBtn = document.getElementById('removeBannerBtn');
    const moduleBannerUrl = document.getElementById('moduleBannerUrl');
    
    if (!bannerUploadArea) return;
    
    bannerUploadArea.addEventListener('click', () => {
        const url = prompt('Enter Google Drive image URL:\n\nExample: https://drive.google.com/file/d/FILE_ID/view');
        if (url && url.trim()) {
            const embedUrl = getGoogleDriveImageUrl(url);
            if (embedUrl) {
                moduleBannerUrl.value = embedUrl;
                bannerPreviewImg.src = embedUrl;
                bannerPreview.classList.remove('hidden');
                bannerUploadArea.classList.add('hidden');
                showToast('Module banner image added successfully!', 'success');
            } else {
                showToast('Invalid Google Drive URL. Please enter a valid link.', 'error');
            }
        }
    });
    
    if (removeBannerBtn) {
        removeBannerBtn.addEventListener('click', () => {
            moduleBannerUrl.value = '';
            bannerPreview.classList.add('hidden');
            bannerUploadArea.classList.remove('hidden');
            showToast('Module banner image removed', 'info');
        });
    }
}

// Setup lesson banner image handling
function setupLessonBannerHandler() {
    const bannerUploadArea = document.getElementById('lessonBannerUploadArea');
    const bannerPreview = document.getElementById('lessonBannerPreview');
    const bannerPreviewImg = document.getElementById('lessonBannerPreviewImg');
    const removeBannerBtn = document.getElementById('removeLessonBannerBtn');
    const lessonBannerUrl = document.getElementById('lessonBannerUrl');
    
    if (!bannerUploadArea) return;
    
    bannerUploadArea.addEventListener('click', () => {
        const url = prompt('Enter Google Drive image URL:\n\nExample: https://drive.google.com/file/d/FILE_ID/view');
        if (url && url.trim()) {
            const embedUrl = getGoogleDriveImageUrl(url);
            if (embedUrl) {
                lessonBannerUrl.value = embedUrl;
                bannerPreviewImg.src = embedUrl;
                bannerPreview.classList.remove('hidden');
                bannerUploadArea.classList.add('hidden');
                showToast('Lesson banner image added successfully!', 'success');
            } else {
                showToast('Invalid Google Drive URL. Please enter a valid link.', 'error');
            }
        }
    });
    
    if (removeBannerBtn) {
        removeBannerBtn.addEventListener('click', () => {
            lessonBannerUrl.value = '';
            bannerPreview.classList.add('hidden');
            bannerUploadArea.classList.remove('hidden');
            showToast('Lesson banner image removed', 'info');
        });
    }
}

// Setup Module Modal
function setupModuleModal() {
    const modal = document.getElementById('moduleModal');
    const closeBtn = document.getElementById('closeModuleModal');
    const cancelBtn = document.getElementById('cancelModuleModal');
    const form = document.getElementById('moduleForm');
    
    const quizRequiredCheckbox = document.getElementById('quizRequiredCheckbox');
    const passMarkContainer = document.getElementById('passMarkContainer');
    
    if (quizRequiredCheckbox) {
        quizRequiredCheckbox.addEventListener('change', (e) => {
            if (passMarkContainer) {
                passMarkContainer.style.opacity = e.target.checked ? '1' : '0.5';
            }
            const passMarkInput = document.getElementById('passMarkInput');
            if (passMarkInput) passMarkInput.disabled = !e.target.checked;
        });
    }
    
    document.getElementById('addModuleBtn').addEventListener('click', () => {
        if (!currentCourseId) {
            showToast('Please select a course first', 'error');
            return;
        }
        document.getElementById('moduleModalTitle').textContent = 'Add New Module';
        form.reset();
        document.getElementById('moduleId').value = '';
        
        const moduleBannerUrl = document.getElementById('moduleBannerUrl');
        if (moduleBannerUrl) moduleBannerUrl.value = '';
        const bannerPreview = document.getElementById('bannerPreview');
        const bannerUploadArea = document.getElementById('bannerUploadArea');
        if (bannerPreview) bannerPreview.classList.add('hidden');
        if (bannerUploadArea) bannerUploadArea.classList.remove('hidden');
        
        if (quizRequiredCheckbox) quizRequiredCheckbox.checked = true;
        if (passMarkContainer) passMarkContainer.style.opacity = '1';
        const passMarkInput = document.getElementById('passMarkInput');
        if (passMarkInput) {
            passMarkInput.value = 70;
            passMarkInput.disabled = false;
        }
        modal.classList.remove('hidden');
    });
    
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const quizRequired = quizRequiredCheckbox ? quizRequiredCheckbox.checked : false;
        const passMark = quizRequired && document.getElementById('passMarkInput') ? parseInt(document.getElementById('passMarkInput').value) : null;
        const bannerUrl = document.getElementById('moduleBannerUrl')?.value || null;
        
        const moduleData = {
            title: document.getElementById('moduleTitle').value.trim(),
            description: document.getElementById('moduleDescription').value.trim(),
            order: parseInt(document.getElementById('moduleOrder').value) || 1,
            quizRequired: quizRequired,
            passMark: passMark,
            bannerUrl: bannerUrl,
            updatedAt: new Date().toISOString()
        };
        
        const moduleId = document.getElementById('moduleId').value;
        
        try {
            const modulesRef = collection(db, 'courses', currentCourseId, 'modules');
            if (moduleId) {
                await updateDoc(doc(modulesRef, moduleId), moduleData);
                showToast('Module updated successfully', 'success');
            } else {
                moduleData.createdAt = new Date().toISOString();
                await addDoc(modulesRef, moduleData);
                showToast('Module created successfully', 'success');
            }
            modal.classList.add('hidden');
            await loadModules();
        } catch (error) {
            console.error('Error saving module:', error);
            showToast('Failed to save module', 'error');
        }
    });
}

// Setup Rich Text Editor for a specific editor
function setupRichTextEditor(editorId) {
    const editor = document.getElementById(editorId);
    if (!editor) return;
    
    editor.addEventListener('focus', () => {
        currentActiveEditor = editorId;
    });
    
    editor.addEventListener('click', () => {
        currentActiveEditor = editorId;
    });
}

// Setup all rich text editors
function setupAllRichTextEditors() {
    setupRichTextEditor('lessonDescriptionEditor');
    setupRichTextEditor('videoLessonContent');
    setupRichTextEditor('textEditor');
    setupRichTextEditor('codeAdditionalContent');
}

// Setup Lesson Modal
function setupLessonModal() {
    const modal = document.getElementById('lessonModal');
    const closeBtn = document.getElementById('closeLessonModal');
    const cancelBtn = document.getElementById('cancelLessonModal');
    const form = document.getElementById('lessonForm');
    
    setupAllRichTextEditors();
    
    const videoUrlField = document.getElementById('videoUrl');
    if (videoUrlField && !videoUrlField.parentNode.querySelector('.video-help-text')) {
        const videoHelpText = document.createElement('p');
        videoHelpText.className = 'text-xs text-gray-500 mt-1 video-help-text';
        videoHelpText.innerHTML = 'Supports: YouTube (youtube.com/watch?v=...), YouTube Shorts, Google Drive (drive.google.com/file/d/.../view), Vimeo, or direct video URL';
        videoUrlField.parentNode.appendChild(videoHelpText);
    }
    
    // Add bulk upload button to quiz content section - FIXED SELECTOR
    const quizContentDiv = document.getElementById('quizContent');
    if (quizContentDiv) {
        const existingBulkBtn = document.getElementById('bulkUploadBtn');
        if (!existingBulkBtn) {
            // Find the Questions label and insert button after it
            const questionsContainer = document.getElementById('quizQuestionsContainer');
            if (questionsContainer && questionsContainer.parentNode) {
                // Find the parent div that contains the Questions label
                const parentDiv = questionsContainer.parentNode;
                const labelElement = parentDiv.querySelector('label');
                
                const bulkBtnContainer = document.createElement('div');
                bulkBtnContainer.className = 'mb-4';
                bulkBtnContainer.innerHTML = `
                    <button type="button" onclick="showBulkUploadModal()" class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition">
                        <i class="fas fa-upload mr-2"></i> Bulk Upload Questions (CSV/JSON)
                    </button>
                    <span class="text-xs text-gray-500 ml-3">Import 20+ questions at once from CSV or JSON file</span>
                `;
                
                // Insert after the label
                if (labelElement && labelElement.nextSibling) {
                    parentDiv.insertBefore(bulkBtnContainer, labelElement.nextSibling);
                } else if (labelElement) {
                    parentDiv.insertBefore(bulkBtnContainer, labelElement.nextSibling);
                } else {
                    parentDiv.insertBefore(bulkBtnContainer, questionsContainer);
                }
            }
        }
    }
    
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        resetLessonForm();
        currentActiveEditor = null;
    });
    cancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        resetLessonForm();
        currentActiveEditor = null;
    });
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const moduleId = document.getElementById('currentModuleId').value;
        const lessonId = document.getElementById('lessonId').value;
        const lessonType = document.getElementById('lessonType').value;
        const lessonDescription = document.getElementById('lessonDescriptionEditor').innerHTML;
        const lessonBannerUrl = document.getElementById('lessonBannerUrl').value || null;
        
        let content = {};
        
        if (lessonType === 'video') {
            let videoUrl = document.getElementById('videoUrl').value.trim();
            const embedUrl = getEmbedUrl(videoUrl);
            const videoLessonContentHtml = document.getElementById('videoLessonContent').innerHTML;
            
            content = {
                type: 'video',
                originalUrl: videoUrl,
                embedUrl: embedUrl,
                duration: parseInt(document.getElementById('videoDuration').value) || 0,
                lessonContent: videoLessonContentHtml
            };
        } else if (lessonType === 'text') {
            const html = document.getElementById('textEditor').innerHTML;
            content = {
                type: 'text',
                html: html,
                plainText: html.replace(/<[^>]*>/g, '')
            };
        } else if (lessonType === 'code') {
            const additionalContent = document.getElementById('codeAdditionalContent').innerHTML;
            content = {
                type: 'code',
                language: document.getElementById('codeLanguage').value,
                code: document.getElementById('codeSnippet').value,
                explanation: document.getElementById('codeExplanation').value,
                additionalContent: additionalContent
            };
        } else if (lessonType === 'quiz') {
            const quizTitle = document.getElementById('quizTitle').value.trim();
            const quizDescriptionText = document.getElementById('quizDescription').value.trim();
            const timeLimit = parseInt(document.getElementById('quizTimeLimit').value) || null;
            const passMark = parseInt(document.getElementById('quizPassMark').value) || 70;
            
            content = {
                type: 'quiz',
                title: quizTitle,
                description: quizDescriptionText,
                questions: quizQuestions,
                imageLinks: quizImageLinks,
                timeLimit: timeLimit,
                passMark: passMark
            };
        }
        
        const lessonData = {
            title: document.getElementById('lessonTitle').value.trim(),
            description: lessonDescription,
            type: lessonType,
            content: content,
            bannerUrl: lessonBannerUrl,
            imageLinks: imageLinks,
            order: parseInt(document.getElementById('lessonOrder').value) || 1,
            duration: parseInt(document.getElementById('lessonDuration').value) || 0,
            updatedAt: new Date().toISOString()
        };
        
        try {
            const lessonsRef = collection(db, 'courses', currentCourseId, 'modules', moduleId, 'lessons');
            if (lessonId) {
                await updateDoc(doc(lessonsRef, lessonId), lessonData);
                showToast('Lesson updated successfully', 'success');
            } else {
                lessonData.createdAt = new Date().toISOString();
                await addDoc(lessonsRef, lessonData);
                showToast('Lesson created successfully', 'success');
            }
            modal.classList.add('hidden');
            resetLessonForm();
            await loadModules();
        } catch (error) {
            console.error('Error saving lesson:', error);
            showToast('Failed to save lesson: ' + error.message, 'error');
        }
    });
}

// Reset lesson form
function resetLessonForm() {
    quizQuestions = [];
    quizImageLinks = [];
    imageLinks = [];
    currentActiveEditor = null;
    
    const lessonBannerUrl = document.getElementById('lessonBannerUrl');
    if (lessonBannerUrl) lessonBannerUrl.value = '';
    const bannerPreview = document.getElementById('lessonBannerPreview');
    const bannerUploadArea = document.getElementById('lessonBannerUploadArea');
    if (bannerPreview) bannerPreview.classList.add('hidden');
    if (bannerUploadArea) bannerUploadArea.classList.remove('hidden');
    
    const lessonDescriptionEditor = document.getElementById('lessonDescriptionEditor');
    if (lessonDescriptionEditor) lessonDescriptionEditor.innerHTML = '';
    
    const quizContainer = document.getElementById('quizQuestionsContainer');
    if (quizContainer) quizContainer.innerHTML = '';
    
    const quizImageContainer = document.getElementById('quizImageLinksContainer');
    if (quizImageContainer) {
        quizImageContainer.innerHTML = `
            <div class="flex items-center space-x-2">
                <input type="text" placeholder="Image description (e.g., Zigzag line diagram)" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" id="quizImageDesc_0">
                <input type="url" placeholder="Google Drive Image URL" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" id="quizImageUrl_0">
                <button type="button" onclick="addQuizImageLink()" class="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
        `;
    }
    
    const imageContainer = document.getElementById('imageLinksContainer');
    if (imageContainer) {
        imageContainer.innerHTML = `
            <div class="flex items-center space-x-2">
                <input type="text" placeholder="Image description (e.g., Zigzag line diagram)" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" id="imageDesc_0">
                <input type="url" placeholder="Google Drive Image URL" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" id="imageUrl_0">
                <button type="button" onclick="addImageLink()" class="px-3 py-2 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42]">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
        `;
    }
    
    const videoLessonContent = document.getElementById('videoLessonContent');
    if (videoLessonContent) videoLessonContent.innerHTML = '';
    
    const codeAdditionalContent = document.getElementById('codeAdditionalContent');
    if (codeAdditionalContent) codeAdditionalContent.innerHTML = '';
    
    const quizTitle = document.getElementById('quizTitle');
    if (quizTitle) quizTitle.value = '';
    const quizDescription = document.getElementById('quizDescription');
    if (quizDescription) quizDescription.value = '';
    const quizTimeLimit = document.getElementById('quizTimeLimit');
    if (quizTimeLimit) quizTimeLimit.value = '30';
    const quizPassMark = document.getElementById('quizPassMark');
    if (quizPassMark) quizPassMark.value = '70';
    const videoUrl = document.getElementById('videoUrl');
    if (videoUrl) videoUrl.value = '';
    const videoDuration = document.getElementById('videoDuration');
    if (videoDuration) videoDuration.value = '';
    const textEditor = document.getElementById('textEditor');
    if (textEditor) textEditor.innerHTML = '';
    const codeSnippet = document.getElementById('codeSnippet');
    if (codeSnippet) codeSnippet.value = '';
    const codeExplanation = document.getElementById('codeExplanation');
    if (codeExplanation) codeExplanation.value = '';
}

// Image Links Management
window.addImageLink = () => {
    const container = document.getElementById('imageLinksContainer');
    const index = imageLinks.length;
    
    imageLinks.push({ description: '', url: '' });
    
    const newRow = document.createElement('div');
    newRow.className = 'flex items-center space-x-2';
    newRow.id = `imageRow_${index}`;
    newRow.innerHTML = `
        <input type="text" placeholder="Image description (e.g., Zigzag line diagram)" 
               class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" 
               id="imageDesc_${index}" 
               onchange="updateImageLink(${index}, 'description', this.value)">
        <input type="url" placeholder="Google Drive Image URL" 
               class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" 
               id="imageUrl_${index}"
               onchange="updateImageLink(${index}, 'url', this.value)">
        <button type="button" onclick="removeImageLink(${index})" class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
            <i class="fas fa-trash"></i>
        </button>
    `;
    
    container.appendChild(newRow);
};

window.updateImageLink = (index, field, value) => {
    if (!imageLinks[index]) {
        imageLinks[index] = { description: '', url: '' };
    }
    imageLinks[index][field] = value;
};

window.removeImageLink = (index) => {
    imageLinks.splice(index, 1);
    const container = document.getElementById('imageLinksContainer');
    container.innerHTML = '';
    
    imageLinks.forEach((link, i) => {
        const newRow = document.createElement('div');
        newRow.className = 'flex items-center space-x-2';
        newRow.id = `imageRow_${i}`;
        newRow.innerHTML = `
            <input type="text" placeholder="Image description (e.g., Zigzag line diagram)" 
                   value="${escapeHtml(link.description)}"
                   class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" 
                   id="imageDesc_${i}" 
                   onchange="updateImageLink(${i}, 'description', this.value)">
            <input type="url" placeholder="Google Drive Image URL" 
                   value="${escapeHtml(link.url)}"
                   class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" 
                   id="imageUrl_${i}"
                   onchange="updateImageLink(${i}, 'url', this.value)">
            <button type="button" onclick="removeImageLink(${i})" class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
                <i class="fas fa-trash"></i>
            </button>
        `;
        container.appendChild(newRow);
    });
    
    const newRow = document.createElement('div');
    newRow.className = 'flex items-center space-x-2';
    newRow.innerHTML = `
        <input type="text" placeholder="Image description (e.g., Zigzag line diagram)" 
               class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" 
               id="imageDesc_${imageLinks.length}" 
               onchange="updateImageLink(${imageLinks.length}, 'description', this.value)">
        <input type="url" placeholder="Google Drive Image URL" 
               class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" 
               id="imageUrl_${imageLinks.length}"
               onchange="updateImageLink(${imageLinks.length}, 'url', this.value)">
        <button type="button" onclick="addImageLink()" class="px-3 py-2 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42]">
            <i class="fas fa-plus"></i>
        </button>
    `;
    container.appendChild(newRow);
};

// Quiz Image Links Management
window.addQuizImageLink = () => {
    const container = document.getElementById('quizImageLinksContainer');
    const index = quizImageLinks.length;
    
    quizImageLinks.push({ description: '', url: '' });
    
    const newRow = document.createElement('div');
    newRow.className = 'flex items-center space-x-2';
    newRow.id = `quizImageRow_${index}`;
    newRow.innerHTML = `
        <input type="text" placeholder="Image description (e.g., Zigzag line diagram)" 
               class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" 
               id="quizImageDesc_${index}" 
               onchange="updateQuizImageLink(${index}, 'description', this.value)">
        <input type="url" placeholder="Google Drive Image URL" 
               class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" 
               id="quizImageUrl_${index}"
               onchange="updateQuizImageLink(${index}, 'url', this.value)">
        <button type="button" onclick="removeQuizImageLink(${index})" class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
            <i class="fas fa-trash"></i>
        </button>
    `;
    
    container.appendChild(newRow);
};

window.updateQuizImageLink = (index, field, value) => {
    if (!quizImageLinks[index]) {
        quizImageLinks[index] = { description: '', url: '' };
    }
    quizImageLinks[index][field] = value;
};

window.removeQuizImageLink = (index) => {
    quizImageLinks.splice(index, 1);
    const container = document.getElementById('quizImageLinksContainer');
    container.innerHTML = '';
    
    quizImageLinks.forEach((link, i) => {
        const newRow = document.createElement('div');
        newRow.className = 'flex items-center space-x-2';
        newRow.id = `quizImageRow_${i}`;
        newRow.innerHTML = `
            <input type="text" placeholder="Image description" value="${escapeHtml(link.description)}"
                   class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" 
                   id="quizImageDesc_${i}" 
                   onchange="updateQuizImageLink(${i}, 'description', this.value)">
            <input type="url" placeholder="Google Drive Image URL" value="${escapeHtml(link.url)}"
                   class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" 
                   id="quizImageUrl_${i}"
                   onchange="updateQuizImageLink(${i}, 'url', this.value)">
            <button type="button" onclick="removeQuizImageLink(${i})" class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
                <i class="fas fa-trash"></i>
            </button>
        `;
        container.appendChild(newRow);
    });
    
    const newRow = document.createElement('div');
    newRow.className = 'flex items-center space-x-2';
    newRow.innerHTML = `
        <input type="text" placeholder="Image description" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" id="quizImageDesc_${quizImageLinks.length}">
        <input type="url" placeholder="Google Drive Image URL" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" id="quizImageUrl_${quizImageLinks.length}">
        <button type="button" onclick="addQuizImageLink()" class="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
            <i class="fas fa-plus"></i>
        </button>
    `;
    container.appendChild(newRow);
};

function getEmbedUrl(url) {
    if (!url) return '';
    
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch) {
        return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }
    
    const shortsRegex = /youtube\.com\/shorts\/([^&\n?#]+)/;
    const shortsMatch = url.match(shortsRegex);
    if (shortsMatch) {
        return `https://www.youtube.com/embed/${shortsMatch[1]}`;
    }
    
    const driveRegex = /drive\.google\.com\/file\/d\/([^\/]+)/;
    const driveMatch = url.match(driveRegex);
    if (driveMatch) {
        return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }
    
    const vimeoRegex = /vimeo\.com\/(\d+)/;
    const vimeoMatch = url.match(vimeoRegex);
    if (vimeoMatch) {
        return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    
    return url;
}

function getLessonIcon(type) {
    const icons = {
        video: 'fa-video',
        text: 'fa-file-alt',
        code: 'fa-code',
        quiz: 'fa-question-circle'
    };
    return icons[type] || 'fa-book';
}

// Add Quiz Question
window.addQuizQuestion = (type) => {
    const container = document.getElementById('quizQuestionsContainer');
    const questionId = Date.now() + Math.random();
    
    let questionHtml = '';
    
    if (type === 'multiple_choice') {
        quizQuestions.push({ id: questionId, type: 'multiple_choice', text: '', options: ['', '', '', ''], correct: 0 });
        questionHtml = `
            <div class="quiz-question-card border rounded-lg p-4 bg-white" id="question_${questionId}">
                <div class="flex justify-between items-center mb-3">
                    <h4 class="font-medium text-gray-800">Multiple Choice Question ${quizQuestions.length}</h4>
                    <button type="button" onclick="removeQuizQuestion(${questionId})" class="text-red-500 hover:text-red-700">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="mb-3">
                    <input type="text" placeholder="Question text" onchange="updateQuizQuestion(${questionId}, 'text', this.value)"
                           class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none">
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    ${['A', 'B', 'C', 'D'].map((letter, idx) => `
                        <div class="quiz-option flex items-center space-x-2">
                            <span class="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm">${letter}</span>
                            <input type="text" placeholder="Option ${letter}" onchange="updateQuizQuestion(${questionId}, 'option', this.value, ${idx})"
                                   class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none">
                        </div>
                    `).join('')}
                </div>
                <div class="flex items-center space-x-4">
                    <span class="text-sm text-gray-600">Correct Answer:</span>
                    <div class="flex space-x-3">
                        ${['A', 'B', 'C', 'D'].map((letter, idx) => `
                            <label class="flex items-center space-x-1 cursor-pointer">
                                <input type="radio" name="correct_${questionId}" value="${idx}" onchange="updateQuizQuestion(${questionId}, 'correct', ${idx})"
                                       class="w-4 h-4 text-[#1e88e5]">
                                <span class="text-sm">${letter}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'true_false') {
        quizQuestions.push({ id: questionId, type: 'true_false', text: '', correct: true });
        questionHtml = `
            <div class="quiz-question-card border rounded-lg p-4 bg-white" id="question_${questionId}">
                <div class="flex justify-between items-center mb-3">
                    <h4 class="font-medium text-gray-800">True/False Question ${quizQuestions.length}</h4>
                    <button type="button" onclick="removeQuizQuestion(${questionId})" class="text-red-500 hover:text-red-700">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="mb-3">
                    <input type="text" placeholder="Statement (e.g., 'The sky is blue')" onchange="updateQuizQuestion(${questionId}, 'text', this.value)"
                           class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none">
                </div>
                <div class="flex items-center space-x-4">
                    <span class="text-sm text-gray-600">Correct Answer:</span>
                    <div class="flex space-x-3">
                        <label class="flex items-center space-x-1 cursor-pointer">
                            <input type="radio" name="correct_tf_${questionId}" value="true" onchange="updateQuizQuestion(${questionId}, 'correct', true)"
                                   class="w-4 h-4 text-[#1e88e5]">
                            <span class="text-sm">True</span>
                        </label>
                        <label class="flex items-center space-x-1 cursor-pointer">
                            <input type="radio" name="correct_tf_${questionId}" value="false" onchange="updateQuizQuestion(${questionId}, 'correct', false)"
                                   class="w-4 h-4 text-[#1e88e5]">
                            <span class="text-sm">False</span>
                        </label>
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'short_answer') {
        quizQuestions.push({ id: questionId, type: 'short_answer', text: '', correctAnswer: '', caseSensitive: false });
        questionHtml = `
            <div class="quiz-question-card border rounded-lg p-4 bg-white" id="question_${questionId}">
                <div class="flex justify-between items-center mb-3">
                    <h4 class="font-medium text-gray-800">Short Answer Question ${quizQuestions.length}</h4>
                    <button type="button" onclick="removeQuizQuestion(${questionId})" class="text-red-500 hover:text-red-700">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="mb-3">
                    <input type="text" placeholder="Question text" onchange="updateQuizQuestion(${questionId}, 'text', this.value)"
                           class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none">
                </div>
                <div class="mb-3">
                    <label class="block text-sm text-gray-600 mb-1">Expected Answer (for grading reference)</label>
                    <textarea placeholder="Expected answer or keywords to look for..." onchange="updateQuizQuestion(${questionId}, 'correctAnswer', this.value)"
                              rows="2" class="short-answer-input w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none"></textarea>
                </div>
                <div class="flex items-center space-x-4">
                    <label class="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" onchange="updateQuizQuestion(${questionId}, 'caseSensitive', this.checked)"
                               class="w-4 h-4 text-[#1e88e5]">
                        <span class="text-sm text-gray-600">Case sensitive matching</span>
                    </label>
                </div>
                <p class="text-xs text-gray-500 mt-2">Note: Short answer questions are manually graded or can be auto-graded with keyword matching.</p>
            </div>
        `;
    }
    
    container.insertAdjacentHTML('beforeend', questionHtml);
};

// Remove quiz question
window.removeQuizQuestion = (questionId) => {
    quizQuestions = quizQuestions.filter(q => q.id !== questionId);
    const element = document.getElementById(`question_${questionId}`);
    if (element) element.remove();
    
    const container = document.getElementById('quizQuestionsContainer');
    const questionCards = container.querySelectorAll('.quiz-question-card');
    questionCards.forEach((card, index) => {
        const titleElement = card.querySelector('h4');
        if (titleElement) {
            const currentType = titleElement.textContent.includes('Multiple Choice') ? 'Multiple Choice' :
                               titleElement.textContent.includes('True/False') ? 'True/False' : 'Short Answer';
            titleElement.textContent = `${currentType} Question ${index + 1}`;
        }
    });
};

// Update quiz question
window.updateQuizQuestion = (questionId, field, value, subIndex) => {
    const question = quizQuestions.find(q => q.id === questionId);
    if (question) {
        if (field === 'text') question.text = value;
        else if (field === 'option') question.options[subIndex] = value;
        else if (field === 'correct') question.correct = value;
        else if (field === 'correctAnswer') question.correctAnswer = value;
        else if (field === 'caseSensitive') question.caseSensitive = value;
    }
};

// Setup Resource Modal
function setupResourceModal() {
    const modal = document.getElementById('resourceModal');
    const closeBtn = document.getElementById('closeResourceModal');
    const cancelBtn = document.getElementById('cancelResourceModal');
    const form = document.getElementById('resourceForm');
    const dragDropArea = document.getElementById('dragDropArea');
    const fileInput = document.getElementById('resourceFile');
    const removeFileBtn = document.getElementById('removeFileBtn');
    let selectedFile = null;
    
    const typeCards = document.querySelectorAll('.resource-type-card');
    typeCards.forEach(card => {
        card.addEventListener('click', () => {
            typeCards.forEach(c => {
                c.classList.remove('selected', 'border-[#1e88e5]', 'bg-blue-50');
                c.classList.add('border-gray-200');
            });
            card.classList.add('selected', 'border-[#1e88e5]', 'bg-blue-50');
            card.classList.remove('border-gray-200');
            
            const resourceType = card.dataset.type;
            document.getElementById('resourceType').value = resourceType;
            updateResourceSections(resourceType);
            updateResourceIconPreview(resourceType);
        });
    });
    
    if (typeCards[0]) typeCards[0].click();
    
    dragDropArea.addEventListener('click', () => fileInput.click());
    
    dragDropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dragDropArea.classList.add('drag-over');
    });
    
    dragDropArea.addEventListener('dragleave', () => {
        dragDropArea.classList.remove('drag-over');
    });
    
    dragDropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dragDropArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFileSelect(files[0]);
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
    });
    
    removeFileBtn.addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        document.getElementById('filePreview').classList.add('hidden');
        dragDropArea.classList.remove('hidden');
    });
    
    function handleFileSelect(file) {
        selectedFile = file;
        if (file.size > 100 * 1024 * 1024) {
            showToast('File size exceeds 100MB limit', 'error');
            return;
        }
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileSize').textContent = formatFileSize(file.size);
        document.getElementById('filePreview').classList.remove('hidden');
        dragDropArea.classList.add('hidden');
        
        const extension = file.name.split('.').pop().toLowerCase();
        const typeMap = {
            'pdf': 'pdf', 'doc': 'doc', 'docx': 'doc', 'mp4': 'video',
            'mov': 'video', 'avi': 'video', 'zip': 'zip', 'rar': 'zip',
            'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image',
            'ppt': 'presentation', 'pptx': 'presentation'
        };
        const detectedType = typeMap[extension] || 'other';
        typeCards.forEach(card => {
            if (card.dataset.type === detectedType) card.click();
        });
    }
    
    function updateResourceSections(type) {
        const fileUploadSection = document.getElementById('fileUploadSection');
        const urlSection = document.getElementById('urlSection');
        const driveSection = document.getElementById('driveSection');
        
        fileUploadSection.classList.remove('hidden');
        urlSection.classList.add('hidden');
        driveSection.classList.add('hidden');
        
        if (type === 'link') {
            fileUploadSection.classList.add('hidden');
            urlSection.classList.remove('hidden');
        } else if (type === 'video' && !selectedFile) {
            fileUploadSection.classList.remove('hidden');
            urlSection.classList.remove('hidden');
        }
    }
    
    function updateResourceIconPreview(type) {
        const iconElement = document.getElementById('resourceIconPreview');
        const previewText = document.getElementById('resourcePreviewText');
        const iconMap = {
            'pdf': { icon: 'fa-file-pdf', color: 'text-red-500', text: 'PDF Document' },
            'doc': { icon: 'fa-file-word', color: 'text-blue-500', text: 'Word Document' },
            'video': { icon: 'fa-file-video', color: 'text-purple-500', text: 'Video File' },
            'link': { icon: 'fa-link', color: 'text-green-500', text: 'External Link' },
            'zip': { icon: 'fa-file-archive', color: 'text-yellow-500', text: 'Archive File' },
            'image': { icon: 'fa-file-image', color: 'text-pink-500', text: 'Image File' },
            'presentation': { icon: 'fa-chalkboard-teacher', color: 'text-orange-500', text: 'Presentation' },
            'other': { icon: 'fa-file', color: 'text-gray-500', text: 'Other File' }
        };
        const mapping = iconMap[type] || iconMap.other;
        iconElement.className = `fas ${mapping.icon} text-3xl ${mapping.color}`;
        previewText.textContent = mapping.text;
    }
    
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    document.getElementById('addResourceBtn').addEventListener('click', () => {
        if (!currentCourseId) {
            showToast('Please select a course first', 'error');
            return;
        }
        form.reset();
        selectedFile = null;
        document.getElementById('resourceTitle').value = '';
        document.getElementById('resourceDescription').value = '';
        document.getElementById('resourceUrl').value = '';
        document.getElementById('driveLink').value = '';
        document.getElementById('filePreview').classList.add('hidden');
        dragDropArea.classList.remove('hidden');
        fileInput.value = '';
        
        typeCards.forEach(card => {
            card.classList.remove('selected', 'border-[#1e88e5]', 'bg-blue-50');
            card.classList.add('border-gray-200');
        });
        if (typeCards[0]) typeCards[0].click();
        modal.classList.remove('hidden');
    });
    
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const resourceType = document.getElementById('resourceType').value;
        const title = document.getElementById('resourceTitle').value.trim();
        const description = document.getElementById('resourceDescription').value.trim();
        
        if (!title) {
            showToast('Please enter a resource title', 'error');
            return;
        }
        
        let resourceUrl = '';
        
        if (resourceType === 'link') {
            resourceUrl = document.getElementById('resourceUrl').value.trim();
            if (!resourceUrl) {
                showToast('Please enter a URL', 'error');
                return;
            }
        } else if (resourceType === 'video') {
            if (selectedFile) {
                resourceUrl = URL.createObjectURL(selectedFile);
                showToast('Note: File upload to storage would happen here. For demo, using local URL.', 'info');
            } else {
                resourceUrl = document.getElementById('videoUrl')?.value || document.getElementById('driveLink')?.value;
                if (!resourceUrl) {
                    showToast('Please upload a video file or provide a video URL', 'error');
                    return;
                }
            }
        } else {
            if (!selectedFile) {
                showToast('Please select a file to upload', 'error');
                return;
            }
            resourceUrl = URL.createObjectURL(selectedFile);
            showToast('Note: File upload to storage would happen here. For demo, using local URL.', 'info');
        }
        
        const resourceData = {
            title: title,
            description: description || '',
            type: resourceType,
            url: resourceUrl,
            fileSize: selectedFile ? formatFileSize(selectedFile.size) : 'N/A',
            fileName: selectedFile ? selectedFile.name : '',
            downloads: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        try {
            const resourcesRef = collection(db, 'courses', currentCourseId, 'resources');
            await addDoc(resourcesRef, resourceData);
            showToast('Resource added successfully!', 'success');
            modal.classList.add('hidden');
            await loadResources();
        } catch (error) {
            console.error('Error adding resource:', error);
            showToast('Failed to add resource: ' + error.message, 'error');
        }
    });
}

// Load resources
async function loadResources() {
    try {
        const resourcesRef = collection(db, 'courses', currentCourseId, 'resources');
        const snapshot = await getDocs(resourcesRef);
        resources = [];
        snapshot.forEach(doc => {
            resources.push({ id: doc.id, ...doc.data() });
        });
        displayResources();
    } catch (error) {
        console.error('Error loading resources:', error);
        document.getElementById('resourcesContainer').innerHTML = `
            <div class="text-center py-12 bg-red-50 rounded-xl">
                <i class="fas fa-lock text-4xl text-red-400 mb-3"></i>
                <p class="text-red-600">Unable to load resources: ${error.message}</p>
                <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-[#1e88e5] text-white rounded-lg">Retry</button>
            </div>
        `;
    }
}

// Display resources
function displayResources() {
    const container = document.getElementById('resourcesContainer');
    
    if (resources.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 bg-gray-50 rounded-xl">
                <i class="fas fa-download text-4xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No resources yet. Click "Add Resource" to upload materials.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = resources.map(resource => `
        <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-sm transition">
            <div class="flex items-center space-x-4 flex-1">
                <i class="fas ${getResourceIcon(resource.type)} text-2xl ${getResourceIconColor(resource.type)}"></i>
                <div class="flex-1">
                    <h3 class="font-medium text-gray-800">${escapeHtml(resource.title)}</h3>
                    ${resource.description ? `<p class="text-sm text-gray-500">${escapeHtml(resource.description)}</p>` : ''}
                    <div class="flex items-center space-x-3 mt-1">
                        <span class="text-xs text-gray-400 capitalize">${resource.type}</span>
                        <span class="text-xs text-gray-400">•</span>
                        <span class="text-xs text-gray-400">${resource.fileSize || 'N/A'}</span>
                        <span class="text-xs text-gray-400">•</span>
                        <span class="text-xs text-gray-400"><i class="fas fa-download mr-1"></i>${resource.downloads || 0} downloads</span>
                    </div>
                </div>
            </div>
            <div class="flex space-x-2">
                <a href="${resource.url}" target="_blank" class="text-[#1e88e5] hover:text-[#009e42] transition p-2 hover:bg-gray-100 rounded-lg">
                    <i class="fas fa-external-link-alt"></i>
                </a>
                <button onclick="window.deleteResource('${resource.id}')" class="text-red-500 hover:text-red-700 transition p-2 hover:bg-gray-100 rounded-lg">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function getResourceIconColor(type) {
    const colors = {
        pdf: 'text-red-500',
        doc: 'text-blue-500',
        video: 'text-purple-500',
        link: 'text-green-500',
        zip: 'text-yellow-500',
        image: 'text-pink-500',
        presentation: 'text-orange-500',
        other: 'text-gray-500'
    };
    return colors[type] || 'text-gray-500';
}

function getResourceIcon(type) {
    const icons = {
        pdf: 'fa-file-pdf',
        doc: 'fa-file-word',
        video: 'fa-file-video',
        link: 'fa-link',
        zip: 'fa-file-archive',
        image: 'fa-file-image',
        presentation: 'fa-chalkboard-teacher',
        other: 'fa-file'
    };
    return icons[type] || 'fa-file';
}

// Delete resource
window.deleteResource = async (resourceId) => {
    if (!confirm('Delete this resource? This action cannot be undone.')) return;
    try {
        await deleteDoc(doc(db, 'courses', currentCourseId, 'resources', resourceId));
        showToast('Resource deleted successfully', 'success');
        await loadResources();
    } catch (error) {
        console.error('Error deleting resource:', error);
        showToast('Failed to delete resource: ' + error.message, 'error');
    }
};

// Load quizzes
async function loadQuizzes() {
    const container = document.getElementById('quizzesContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="text-center py-12">
            <i class="fas fa-spinner fa-spin text-3xl text-[#1e88e5] mb-3"></i>
            <p class="text-gray-500">Loading quizzes...</p>
        </div>
    `;
    
    try {
        const quizzesRef = collection(db, 'courses', currentCourseId, 'quizzes');
        const snapshot = await getDocs(quizzesRef);
        quizzes = [];
        snapshot.forEach(doc => {
            quizzes.push({ id: doc.id, ...doc.data() });
        });
        displayQuizzes();
    } catch (error) {
        console.error('Error loading quizzes:', error);
        container.innerHTML = `
            <div class="text-center py-12 bg-gray-50 rounded-xl">
                <i class="fas fa-question-circle text-4xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">Quiz feature coming soon. Create quizzes within modules for now.</p>
                <p class="text-xs text-gray-400 mt-2">Note: Make sure Firebase security rules are configured properly</p>
            </div>
        `;
    }
}

// Display quizzes
function displayQuizzes() {
    const container = document.getElementById('quizzesContainer');
    if (!container) return;
    
    if (quizzes.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 bg-gray-50 rounded-xl">
                <i class="fas fa-question-circle text-4xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No quizzes created yet. Create quizzes within modules or as standalone assessments.</p>
                <button onclick="createNewQuiz()" class="mt-4 px-4 py-2 bg-[#1e88e5] text-white rounded-lg">
                    <i class="fas fa-plus mr-2"></i> Create Quiz
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = quizzes.map(quiz => `
        <div class="border border-gray-200 rounded-xl p-5 hover:shadow-sm transition">
            <div class="flex items-center justify-between mb-3">
                <h3 class="font-semibold text-gray-800">${escapeHtml(quiz.title)}</h3>
                <div class="flex space-x-2">
                    <button onclick="editQuiz('${quiz.id}')" class="text-blue-500 hover:text-blue-700">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteQuiz('${quiz.id}')" class="text-red-500 hover:text-red-700">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <p class="text-gray-600 text-sm mb-2">${escapeHtml(quiz.description || 'No description')}</p>
            <div class="flex space-x-4 text-sm text-gray-500">
                <span><i class="fas fa-question-circle mr-1"></i> ${quiz.questions?.length || 0} questions</span>
                <span><i class="fas fa-clock mr-1"></i> ${quiz.duration || 0} minutes</span>
                <span><i class="fas fa-chart-line mr-1"></i> Pass mark: ${quiz.passMark || 70}%</span>
            </div>
        </div>
    `).join('');
}

// Create new quiz
window.createNewQuiz = () => {
    showToast('Quiz creation feature coming soon', 'info');
};

// Add Lesson
window.addLesson = (moduleId) => {
    document.getElementById('currentModuleId').value = moduleId;
    document.getElementById('lessonModalTitle').textContent = 'Add New Lesson';
    document.getElementById('lessonForm').reset();
    document.getElementById('lessonId').value = '';
    document.getElementById('lessonType').value = 'video';
    
    const lessonDescriptionEditor = document.getElementById('lessonDescriptionEditor');
    if (lessonDescriptionEditor) lessonDescriptionEditor.innerHTML = '';
    
    document.getElementById('videoContent').classList.remove('hidden');
    document.getElementById('textContent').classList.add('hidden');
    document.getElementById('codeContent').classList.add('hidden');
    document.getElementById('quizContent').classList.add('hidden');
    
    const lessonBannerUrl = document.getElementById('lessonBannerUrl');
    if (lessonBannerUrl) lessonBannerUrl.value = '';
    const bannerPreview = document.getElementById('lessonBannerPreview');
    const bannerUploadArea = document.getElementById('lessonBannerUploadArea');
    if (bannerPreview) bannerPreview.classList.add('hidden');
    if (bannerUploadArea) bannerUploadArea.classList.remove('hidden');
    
    resetLessonForm();
    
    currentActiveEditor = 'lessonDescriptionEditor';
    
    document.getElementById('lessonModal').classList.remove('hidden');
};

// Edit lesson
window.editLesson = async (moduleId, lessonId) => {
    const module = modules.find(m => m.id === moduleId);
    const lesson = module?.lessons?.find(l => l.id === lessonId);
    if (!lesson) return;
    
    document.getElementById('currentModuleId').value = moduleId;
    document.getElementById('lessonId').value = lessonId;
    document.getElementById('lessonModalTitle').textContent = 'Edit Lesson';
    document.getElementById('lessonTitle').value = lesson.title || '';
    
    const lessonDescriptionEditor = document.getElementById('lessonDescriptionEditor');
    if (lessonDescriptionEditor && lesson.description) {
        lessonDescriptionEditor.innerHTML = lesson.description;
    }
    
    document.getElementById('lessonType').value = lesson.type || 'video';
    document.getElementById('lessonOrder').value = lesson.order || 1;
    document.getElementById('lessonDuration').value = lesson.duration || '';
    
    const lessonBannerUrl = lesson.bannerUrl || null;
    const lessonBannerUrlField = document.getElementById('lessonBannerUrl');
    const bannerUploadArea = document.getElementById('lessonBannerUploadArea');
    const bannerPreview = document.getElementById('lessonBannerPreview');
    const bannerPreviewImg = document.getElementById('lessonBannerPreviewImg');
    
    if (lessonBannerUrl && lessonBannerUrlField) {
        lessonBannerUrlField.value = lessonBannerUrl;
        bannerPreviewImg.src = lessonBannerUrl;
        bannerPreview.classList.remove('hidden');
        bannerUploadArea.classList.add('hidden');
    } else {
        if (lessonBannerUrlField) lessonBannerUrlField.value = '';
        if (bannerPreview) bannerPreview.classList.add('hidden');
        if (bannerUploadArea) bannerUploadArea.classList.remove('hidden');
    }
    
    selectLessonType(lesson.type);
    
    if (lesson.type === 'video') {
        document.getElementById('videoUrl').value = lesson.content?.originalUrl || lesson.content?.embedUrl || '';
        document.getElementById('videoDuration').value = lesson.content?.duration || '';
        const videoLessonContent = document.getElementById('videoLessonContent');
        if (videoLessonContent && lesson.content?.lessonContent) {
            videoLessonContent.innerHTML = lesson.content.lessonContent;
        } else if (videoLessonContent) {
            videoLessonContent.innerHTML = '';
        }
        currentActiveEditor = 'videoLessonContent';
    } else if (lesson.type === 'text') {
        document.getElementById('textEditor').innerHTML = lesson.content?.html || '';
        currentActiveEditor = 'textEditor';
    } else if (lesson.type === 'code') {
        document.getElementById('codeLanguage').value = lesson.content?.language || 'javascript';
        document.getElementById('codeSnippet').value = lesson.content?.code || '';
        document.getElementById('codeExplanation').value = lesson.content?.explanation || '';
        const codeAdditionalContent = document.getElementById('codeAdditionalContent');
        if (codeAdditionalContent && lesson.content?.additionalContent) {
            codeAdditionalContent.innerHTML = lesson.content.additionalContent;
        } else if (codeAdditionalContent) {
            codeAdditionalContent.innerHTML = '';
        }
        currentActiveEditor = 'codeAdditionalContent';
    } else if (lesson.type === 'quiz') {
        document.getElementById('quizTitle').value = lesson.content?.title || '';
        document.getElementById('quizDescription').value = lesson.content?.description || '';
        document.getElementById('quizTimeLimit').value = lesson.content?.timeLimit || 30;
        document.getElementById('quizPassMark').value = lesson.content?.passMark || 70;
        
        quizQuestions = lesson.content?.questions || [];
        const container = document.getElementById('quizQuestionsContainer');
        container.innerHTML = '';
        
        quizQuestions.forEach((q, idx) => {
            let questionHtml = '';
            if (q.type === 'multiple_choice') {
                questionHtml = `
                    <div class="quiz-question-card border rounded-lg p-4 bg-white" id="question_${q.id}">
                        <div class="flex justify-between items-center mb-3">
                            <h4 class="font-medium text-gray-800">Multiple Choice Question ${idx + 1}</h4>
                            <button type="button" onclick="removeQuizQuestion(${q.id})" class="text-red-500 hover:text-red-700">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="mb-3">
                            <input type="text" placeholder="Question text" value="${escapeHtml(q.text)}" onchange="updateQuizQuestion(${q.id}, 'text', this.value)"
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none">
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            ${['A', 'B', 'C', 'D'].map((letter, idx2) => `
                                <div class="quiz-option flex items-center space-x-2">
                                    <span class="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm">${letter}</span>
                                    <input type="text" placeholder="Option ${letter}" value="${escapeHtml(q.options[idx2] || '')}" onchange="updateQuizQuestion(${q.id}, 'option', this.value, ${idx2})"
                                           class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none">
                                </div>
                            `).join('')}
                        </div>
                        <div class="flex items-center space-x-4">
                            <span class="text-sm text-gray-600">Correct Answer:</span>
                            <div class="flex space-x-3">
                                ${['A', 'B', 'C', 'D'].map((letter, idx2) => `
                                    <label class="flex items-center space-x-1 cursor-pointer">
                                        <input type="radio" name="correct_${q.id}" value="${idx2}" ${q.correct === idx2 ? 'checked' : ''} onchange="updateQuizQuestion(${q.id}, 'correct', ${idx2})"
                                               class="w-4 h-4 text-[#1e88e5]">
                                        <span class="text-sm">${letter}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        ${q.explanation ? `<p class="text-xs text-gray-500 mt-2">📝 ${escapeHtml(q.explanation)}</p>` : ''}
                    </div>
                `;
            } else if (q.type === 'true_false') {
                questionHtml = `
                    <div class="quiz-question-card border rounded-lg p-4 bg-white" id="question_${q.id}">
                        <div class="flex justify-between items-center mb-3">
                            <h4 class="font-medium text-gray-800">True/False Question ${idx + 1}</h4>
                            <button type="button" onclick="removeQuizQuestion(${q.id})" class="text-red-500 hover:text-red-700">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="mb-3">
                            <input type="text" placeholder="Statement" value="${escapeHtml(q.text)}" onchange="updateQuizQuestion(${q.id}, 'text', this.value)"
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none">
                        </div>
                        <div class="flex items-center space-x-4">
                            <span class="text-sm text-gray-600">Correct Answer:</span>
                            <div class="flex space-x-3">
                                <label class="flex items-center space-x-1 cursor-pointer">
                                    <input type="radio" name="correct_tf_${q.id}" value="true" ${q.correct === true ? 'checked' : ''} onchange="updateQuizQuestion(${q.id}, 'correct', true)"
                                           class="w-4 h-4 text-[#1e88e5]">
                                    <span class="text-sm">True</span>
                                </label>
                                <label class="flex items-center space-x-1 cursor-pointer">
                                    <input type="radio" name="correct_tf_${q.id}" value="false" ${q.correct === false ? 'checked' : ''} onchange="updateQuizQuestion(${q.id}, 'correct', false)"
                                           class="w-4 h-4 text-[#1e88e5]">
                                    <span class="text-sm">False</span>
                                </label>
                            </div>
                        </div>
                        ${q.explanation ? `<p class="text-xs text-gray-500 mt-2">📝 ${escapeHtml(q.explanation)}</p>` : ''}
                    </div>
                `;
            } else if (q.type === 'short_answer') {
                questionHtml = `
                    <div class="quiz-question-card border rounded-lg p-4 bg-white" id="question_${q.id}">
                        <div class="flex justify-between items-center mb-3">
                            <h4 class="font-medium text-gray-800">Short Answer Question ${idx + 1}</h4>
                            <button type="button" onclick="removeQuizQuestion(${q.id})" class="text-red-500 hover:text-red-700">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="mb-3">
                            <input type="text" placeholder="Question text" value="${escapeHtml(q.text)}" onchange="updateQuizQuestion(${q.id}, 'text', this.value)"
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none">
                        </div>
                        <div class="mb-3">
                            <label class="block text-sm text-gray-600 mb-1">Expected Answer (for grading reference)</label>
                            <textarea placeholder="Expected answer or keywords to look for..." onchange="updateQuizQuestion(${q.id}, 'correctAnswer', this.value)"
                                      rows="2" class="short-answer-input w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none">${escapeHtml(q.correctAnswer || '')}</textarea>
                        </div>
                        <div class="flex items-center space-x-4">
                            <label class="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" ${q.caseSensitive ? 'checked' : ''} onchange="updateQuizQuestion(${q.id}, 'caseSensitive', this.checked)"
                                       class="w-4 h-4 text-[#1e88e5]">
                                <span class="text-sm text-gray-600">Case sensitive matching</span>
                            </label>
                        </div>
                        ${q.explanation ? `<p class="text-xs text-gray-500 mt-2">📝 ${escapeHtml(q.explanation)}</p>` : ''}
                    </div>
                `;
            }
            container.insertAdjacentHTML('beforeend', questionHtml);
        });
        
        if (lesson.content?.imageLinks && lesson.content.imageLinks.length > 0) {
            quizImageLinks = [...lesson.content.imageLinks];
            const quizImageContainer = document.getElementById('quizImageLinksContainer');
            quizImageContainer.innerHTML = '';
            quizImageLinks.forEach((link, i) => {
                const newRow = document.createElement('div');
                newRow.className = 'flex items-center space-x-2';
                newRow.id = `quizImageRow_${i}`;
                newRow.innerHTML = `
                    <input type="text" placeholder="Image description" value="${escapeHtml(link.description)}"
                           class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" 
                           id="quizImageDesc_${i}" 
                           onchange="updateQuizImageLink(${i}, 'description', this.value)">
                    <input type="url" placeholder="Google Drive Image URL" value="${escapeHtml(link.url)}"
                           class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" 
                           id="quizImageUrl_${i}"
                           onchange="updateQuizImageLink(${i}, 'url', this.value)">
                    <button type="button" onclick="removeQuizImageLink(${i})" class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
                quizImageContainer.appendChild(newRow);
            });
            const newRow = document.createElement('div');
            newRow.className = 'flex items-center space-x-2';
            newRow.innerHTML = `
                <input type="text" placeholder="Image description" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" id="quizImageDesc_${quizImageLinks.length}">
                <input type="url" placeholder="Google Drive Image URL" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" id="quizImageUrl_${quizImageLinks.length}">
                <button type="button" onclick="addQuizImageLink()" class="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                    <i class="fas fa-plus"></i>
                </button>
            `;
            quizImageContainer.appendChild(newRow);
        }
    }
    
    if (lesson.imageLinks && lesson.imageLinks.length > 0) {
        imageLinks = [...lesson.imageLinks];
        const container = document.getElementById('imageLinksContainer');
        container.innerHTML = '';
        imageLinks.forEach((link, i) => {
            const newRow = document.createElement('div');
            newRow.className = 'flex items-center space-x-2';
            newRow.id = `imageRow_${i}`;
            newRow.innerHTML = `
                <input type="text" placeholder="Image description" value="${escapeHtml(link.description)}"
                       class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" 
                       id="imageDesc_${i}" 
                       onchange="updateImageLink(${i}, 'description', this.value)">
                <input type="url" placeholder="Google Drive Image URL" value="${escapeHtml(link.url)}"
                       class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" 
                       id="imageUrl_${i}"
                       onchange="updateImageLink(${i}, 'url', this.value)">
                <button type="button" onclick="removeImageLink(${i})" class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            container.appendChild(newRow);
        });
        const newRow = document.createElement('div');
        newRow.className = 'flex items-center space-x-2';
        newRow.innerHTML = `
            <input type="text" placeholder="Image description" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" id="imageDesc_${imageLinks.length}">
            <input type="url" placeholder="Google Drive Image URL" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e88e5] outline-none" id="imageUrl_${imageLinks.length}">
            <button type="button" onclick="addImageLink()" class="px-3 py-2 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42]">
                <i class="fas fa-plus"></i>
            </button>
        `;
        container.appendChild(newRow);
    }
    
    document.getElementById('lessonModal').classList.remove('hidden');
};

// Delete lesson
window.deleteLesson = async (moduleId, lessonId) => {
    if (!confirm('Are you sure you want to delete this lesson?')) return;
    try {
        await deleteDoc(doc(db, 'courses', currentCourseId, 'modules', moduleId, 'lessons', lessonId));
        showToast('Lesson deleted successfully', 'success');
        await loadModules();
    } catch (error) {
        console.error('Error deleting lesson:', error);
        showToast('Failed to delete lesson', 'error');
    }
};

// Edit module with banner loading
window.editModule = async (moduleId) => {
    const module = modules.find(m => m.id === moduleId);
    if (!module) return;
    
    document.getElementById('moduleModalTitle').textContent = 'Edit Module';
    document.getElementById('moduleId').value = module.id;
    document.getElementById('moduleTitle').value = module.title || '';
    document.getElementById('moduleDescription').value = module.description || '';
    document.getElementById('moduleOrder').value = module.order || 1;
    
    const bannerUrl = module.bannerUrl || null;
    const moduleBannerUrl = document.getElementById('moduleBannerUrl');
    const bannerUploadArea = document.getElementById('bannerUploadArea');
    const bannerPreview = document.getElementById('bannerPreview');
    const bannerPreviewImg = document.getElementById('bannerPreviewImg');
    
    if (bannerUrl && moduleBannerUrl) {
        moduleBannerUrl.value = bannerUrl;
        bannerPreviewImg.src = bannerUrl;
        bannerPreview.classList.remove('hidden');
        bannerUploadArea.classList.add('hidden');
    } else {
        if (moduleBannerUrl) moduleBannerUrl.value = '';
        if (bannerPreview) bannerPreview.classList.add('hidden');
        if (bannerUploadArea) bannerUploadArea.classList.remove('hidden');
    }
    
    const quizRequiredCheckbox = document.getElementById('quizRequiredCheckbox');
    const passMarkInput = document.getElementById('passMarkInput');
    const passMarkContainer = document.getElementById('passMarkContainer');
    
    if (quizRequiredCheckbox) {
        quizRequiredCheckbox.checked = module.quizRequired || false;
    }
    if (passMarkInput) {
        passMarkInput.value = module.passMark || 70;
        passMarkInput.disabled = !module.quizRequired;
    }
    if (passMarkContainer) {
        passMarkContainer.style.opacity = module.quizRequired ? '1' : '0.5';
    }
    
    document.getElementById('moduleModal').classList.remove('hidden');
};

// Delete module
window.deleteModule = async (moduleId) => {
    if (!confirm('Are you sure you want to delete this module and all its lessons?')) return;
    try {
        await deleteDoc(doc(db, 'courses', currentCourseId, 'modules', moduleId));
        showToast('Module deleted successfully', 'success');
        await loadModules();
    } catch (error) {
        console.error('Error deleting module:', error);
        showToast('Failed to delete module', 'error');
    }
};

// Select lesson type
window.selectLessonType = (type) => {
    document.getElementById('lessonType').value = type;
    document.getElementById('videoContent').classList.add('hidden');
    document.getElementById('textContent').classList.add('hidden');
    document.getElementById('codeContent').classList.add('hidden');
    document.getElementById('quizContent').classList.add('hidden');
    
    const contentDiv = document.getElementById(`${type}Content`);
    if (contentDiv) contentDiv.classList.remove('hidden');
    
    if (type === 'video') {
        currentActiveEditor = 'videoLessonContent';
    } else if (type === 'text') {
        currentActiveEditor = 'textEditor';
    } else if (type === 'code') {
        currentActiveEditor = 'codeAdditionalContent';
    } else {
        currentActiveEditor = 'lessonDescriptionEditor';
    }
    
    const badges = document.querySelectorAll('.lesson-type-badge');
    badges.forEach(badge => {
        badge.classList.remove('active', 'bg-[#1e88e5]', 'text-white', 'border-[#1e88e5]');
        badge.classList.add('border-gray-300', 'text-gray-700');
        if (badge.getAttribute('data-type') === type) {
            badge.classList.add('active', 'bg-[#1e88e5]', 'text-white', 'border-[#1e88e5]');
            badge.classList.remove('border-gray-300', 'text-gray-700');
        }
    });
};

// Preview course
document.getElementById('previewCourseBtn').addEventListener('click', () => {
    if (currentCourseId) {
        window.open(`../student/course-view.html?id=${currentCourseId}`, '_blank');
    }
});

// View course in admin
document.getElementById('viewCourseBtn').addEventListener('click', () => {
    if (currentCourseId) {
        window.location.href = `courses.html?edit=${currentCourseId}`;
    }
});

// Tab switching
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = {
        'modules': document.getElementById('modulesTab'),
        'resources': document.getElementById('resourcesTab'),
        'quizzes': document.getElementById('quizzesTab')
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
            
            Object.values(tabContents).forEach(content => {
                if (content) content.classList.add('hidden');
            });
            if (tabContents[tabId]) tabContents[tabId].classList.remove('hidden');
        });
    });
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

// Sidebar setup
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    const mainContent = document.getElementById('mainContent');
    let isCollapsed = localStorage.getItem('adminSidebarCollapsed') === 'true';
    if (isCollapsed) toggleSidebar(true);
    toggleBtn?.addEventListener('click', () => toggleSidebar(!isCollapsed));
    function toggleSidebar(collapse) {
        isCollapsed = collapse;
        if (collapse) {
            sidebar.classList.add('sidebar-collapsed'); sidebar.classList.remove('sidebar-expanded');
            mainContent.style.marginLeft = '80px';
            localStorage.setItem('adminSidebarCollapsed', 'true');
            document.querySelectorAll('.nav-text, .admin-info, .logo-text').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.nav-item').forEach(item => {
                const text = item.querySelector('.nav-text')?.innerText;
                if (text) { item.classList.add('tooltip'); item.setAttribute('data-tooltip', text); }
            });
            if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-chevron-right text-xl"></i>';
        } else {
            sidebar.classList.add('sidebar-expanded'); sidebar.classList.remove('sidebar-collapsed');
            mainContent.style.marginLeft = '280px';
            localStorage.setItem('adminSidebarCollapsed', 'false');
            document.querySelectorAll('.nav-text, .admin-info, .logo-text').forEach(el => el.style.display = '');
            document.querySelectorAll('.nav-item').forEach(item => { item.classList.remove('tooltip'); item.removeAttribute('data-tooltip'); });
            if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-chevron-left text-xl"></i>';
        }
    }
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileOverlay = document.getElementById('mobileOverlay');
    mobileMenuBtn?.addEventListener('click', () => { sidebar.classList.add('mobile-open'); mobileOverlay.classList.remove('hidden'); });
    mobileOverlay?.addEventListener('click', () => { sidebar.classList.remove('mobile-open'); mobileOverlay.classList.add('hidden'); });
}

function setupDropdowns() {
    const btn = document.getElementById('adminMenuBtn');
    const dropdown = document.getElementById('adminDropdown');
    btn?.addEventListener('click', (e) => { e.stopPropagation(); dropdown?.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => { if (dropdown && !dropdown.contains(e.target) && e.target !== btn) dropdown.classList.add('hidden'); });
}

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in ${type === 'success' ? 'bg-green-500 text-white' : type === 'error' ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function logout() { 
    await signOut(auth); 
    window.location.href = '../../login.html'; 
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    setupModuleModal();
    setupLessonModal();
    setupResourceModal();
    setupModuleBannerHandler();
    setupLessonBannerHandler();
    setupTabs();
    setupSidebar();
    setupDropdowns();
    
    const logoutBtns = document.querySelectorAll('#logoutBtn, #logoutDropdown');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    });
});

// Make functions available globally
window.addLesson = addLesson;
window.editLesson = editLesson;
window.deleteLesson = deleteLesson;
window.editModule = editModule;
window.deleteModule = deleteModule;
window.selectLessonType = selectLessonType;
window.addQuizQuestion = addQuizQuestion;
window.removeQuizQuestion = removeQuizQuestion;
window.updateQuizQuestion = updateQuizQuestion;
window.deleteResource = deleteResource;
window.toggleQuizRequirement = toggleQuizRequirement;
window.createNewQuiz = createNewQuiz;
window.addImageLink = addImageLink;
window.updateImageLink = updateImageLink;
window.removeImageLink = removeImageLink;
window.addQuizImageLink = addQuizImageLink;
window.updateQuizImageLink = updateQuizImageLink;
window.removeQuizImageLink = removeQuizImageLink;
window.insertInlineImage = insertInlineImage;
window.insertBulletedList = insertBulletedList;
window.insertNumberedList = insertNumberedList;
window.insertLink = insertLink;
window.formatText = formatText;
window.showBulkUploadModal = showBulkUploadModal;

const style = document.createElement('style');
style.textContent = `
    .animate-fade-in { animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    /* Rich text editor list styles */
    .editor-content ul, .editor-content ol {
        margin-left: 1.5rem !important;
        margin-bottom: 0.75rem !important;
        padding-left: 0.5rem !important;
    }
    .editor-content ul li {
        list-style-type: disc !important;
        margin-bottom: 0.25rem !important;
    }
    .editor-content ul ul li {
        list-style-type: circle !important;
    }
    .editor-content ul ul ul li {
        list-style-type: square !important;
    }
    .editor-content ol li {
        list-style-type: decimal !important;
        margin-bottom: 0.25rem !important;
    }
    .editor-content ol ol li {
        list-style-type: lower-alpha !important;
    }
    .editor-content ol ol ol li {
        list-style-type: lower-roman !important;
    }
    .editor-content img {
        max-width: 100%;
        height: auto;
        border-radius: 0.5rem;
        margin: 1rem 0;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .lesson-image img {
        max-width: 100%;
        height: auto;
        border-radius: 0.5rem;
        margin: 1rem 0;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .lesson-image {
        margin-bottom: 1rem;
    }
    .clear-both {
        clear: both;
    }
    /* Ensure lists display properly in contenteditable */
    [contenteditable="true"] ul, 
    [contenteditable="true"] ol {
        display: block;
        margin-block-start: 1em;
        margin-block-end: 1em;
        padding-inline-start: 40px;
    }
    [contenteditable="true"] li {
        display: list-item;
        text-align: -webkit-match-parent;
    }
    /* Bulk upload modal styles */
    #bulkUploadModal .modal {
        animation: slideIn 0.3s ease;
    }
    @keyframes slideIn {
        from { opacity: 0; transform: translateY(-50px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);