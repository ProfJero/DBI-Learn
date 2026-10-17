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
let enrolledCourses = [];
let allCourses = [];
let completedCourses = [];
let modules = [];
let userProgress = {};

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../login.html';
    } else {
        currentUser = user;
        await loadUserData(user.uid);
        await loadAllCourses();
        await loadEnrolledCourses(user.uid);
        await loadCourseModules();
        await loadUserProgress(user.uid);
        await generateLearningPath();
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

// Load all courses from Firestore
async function loadAllCourses() {
    try {
        const coursesRef = collection(db, 'courses');
        const snapshot = await getDocs(coursesRef);
        
        allCourses = [];
        snapshot.forEach(doc => {
            allCourses.push({ id: doc.id, ...doc.data() });
        });
        
        console.log('Loaded courses:', allCourses.length);
    } catch (error) {
        console.error('Error loading courses:', error);
    }
}

// Load enrolled courses with real progress
async function loadEnrolledCourses(userId) {
    try {
        const enrollmentsRef = collection(db, 'enrollments');
        const q = query(enrollmentsRef, where('studentId', '==', userId));
        const snapshot = await getDocs(q);
        
        enrolledCourses = [];
        for (const docSnapshot of snapshot.docs) {
            const enrollment = { id: docSnapshot.id, ...docSnapshot.data() };
            
            // Get course details
            const courseDoc = await getDoc(doc(db, 'courses', enrollment.courseId));
            if (courseDoc.exists()) {
                enrollment.course = { id: courseDoc.id, ...courseDoc.data() };
                enrolledCourses.push(enrollment);
                
                // Track completed courses
                if (enrollment.status === 'completed' || enrollment.progress === 100) {
                    completedCourses.push(enrollment.courseId);
                }
            }
        }
        
        document.getElementById('courseCount').textContent = enrolledCourses.length;
        console.log('Enrolled courses:', enrolledCourses.length);
        
    } catch (error) {
        console.error('Error loading enrolled courses:', error);
    }
}

// Load course modules and lessons
async function loadCourseModules() {
    try {
        for (const enrollment of enrolledCourses) {
            const modulesRef = collection(db, 'courses', enrollment.courseId, 'modules');
            const snapshot = await getDocs(modulesRef);
            
            const courseModules = [];
            for (const moduleDoc of snapshot.docs) {
                const moduleData = { id: moduleDoc.id, ...moduleDoc.data() };
                
                // Load lessons for this module
                const lessonsRef = collection(db, 'courses', enrollment.courseId, 'modules', moduleDoc.id, 'lessons');
                const lessonsSnapshot = await getDocs(lessonsRef);
                
                moduleData.lessons = [];
                lessonsSnapshot.forEach(lessonDoc => {
                    moduleData.lessons.push({ id: lessonDoc.id, ...lessonDoc.data() });
                });
                
                courseModules.push(moduleData);
            }
            
            modules[enrollment.courseId] = courseModules;
        }
    } catch (error) {
        console.error('Error loading modules:', error);
    }
}

// Load user progress from Firestore
async function loadUserProgress(userId) {
    try {
        // Get completed lessons from enrollments
        for (const enrollment of enrolledCourses) {
            if (enrollment.completedLessons) {
                userProgress[enrollment.courseId] = {
                    completedLessons: enrollment.completedLessons,
                    progress: enrollment.progress || 0
                };
            } else {
                userProgress[enrollment.courseId] = {
                    completedLessons: [],
                    progress: 0
                };
            }
        }
    } catch (error) {
        console.error('Error loading user progress:', error);
    }
}

// Generate personalized learning path based on enrolled courses
async function generateLearningPath() {
    const learningPath = [];
    
    // Group enrolled courses by category
    const coursesByCategory = {};
    
    for (const enrollment of enrolledCourses) {
        const course = enrollment.course;
        if (course && course.category) {
            if (!coursesByCategory[course.category]) {
                coursesByCategory[course.category] = [];
            }
            coursesByCategory[course.category].push({
                id: course.id,
                title: course.title,
                duration: course.duration,
                level: course.level || 'Beginner',
                progress: enrollment.progress || 0,
                status: enrollment.status || 'active'
            });
        }
    }
    
    // Define learning paths based on categories
    const categoryPaths = {
        'Software Development': {
            title: 'Software Development Track',
            description: 'Master programming and software development skills',
            icon: 'fa-code',
            order: 1,
            courses: []
        },
        'Graphics & Multimedia': {
            title: 'Graphics & Multimedia Track',
            description: 'Learn design, video editing, and creative skills',
            icon: 'fa-paint-brush',
            order: 2,
            courses: []
        },
        'Data Analysis': {
            title: 'Data Analysis Track',
            description: 'Become proficient in data analytics and visualization',
            icon: 'fa-chart-line',
            order: 3,
            courses: []
        },
        'Web Development': {
            title: 'Web Development Track',
            description: 'Build modern websites and web applications',
            icon: 'fa-globe',
            order: 1,
            courses: []
        },
        'Digital Marketing': {
            title: 'Digital Marketing Track',
            description: 'Master online marketing and social media',
            icon: 'fa-bullhorn',
            order: 4,
            courses: []
        },
        'Cybersecurity': {
            title: 'Cybersecurity Track',
            description: 'Learn to protect systems and networks',
            icon: 'fa-shield-alt',
            order: 5,
            courses: []
        }
    };
    
    // Populate category paths with actual enrolled courses
    for (const [category, courses] of Object.entries(coursesByCategory)) {
        if (categoryPaths[category]) {
            categoryPaths[category].courses = courses;
            learningPath.push(categoryPaths[category]);
        } else if (courses.length > 0) {
            // Create custom path for uncategorized courses
            learningPath.push({
                title: `${category} Track`,
                description: `Complete your ${category} courses to advance your skills`,
                icon: 'fa-graduation-cap',
                order: 10,
                courses: courses
            });
        }
    }
    
    // Sort paths by order
    learningPath.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Add Fundamentals path if no courses or as foundation
    const hasFundamentals = learningPath.some(p => p.title.includes('Fundamentals'));
    if (!hasFundamentals && enrolledCourses.length > 0) {
        const fundamentalCourses = enrolledCourses
            .filter(e => e.course?.level === 'Beginner' || e.course?.level === 'Fundamentals')
            .slice(0, 3)
            .map(e => ({
                id: e.course.id,
                title: e.course.title,
                duration: e.course.duration,
                level: e.course.level,
                progress: e.progress || 0,
                status: e.status
            }));
        
        if (fundamentalCourses.length > 0) {
            learningPath.unshift({
                title: 'Digital Fundamentals',
                description: 'Build a strong foundation in digital literacy',
                icon: 'fa-laptop-code',
                order: 0,
                courses: fundamentalCourses
            });
        }
    }
    
    // Calculate path progress
    for (const path of learningPath) {
        let totalProgress = 0;
        let completedCount = 0;
        
        for (const course of path.courses) {
            totalProgress += course.progress || 0;
            if (course.progress === 100 || course.status === 'completed') {
                completedCount++;
            }
        }
        
        path.progress = path.courses.length > 0 ? Math.round(totalProgress / path.courses.length) : 0;
        path.completedCount = completedCount;
        path.totalCourses = path.courses.length;
        
        // Determine status
        if (path.progress === 100) {
            path.status = 'completed';
        } else if (path.progress > 0) {
            path.status = 'in-progress';
        } else {
            path.status = 'locked';
        }
    }
    
    // Display the learning path
    displayLearningPath(learningPath);
    
    // Update overall progress
    updateOverallProgress(learningPath);
    
    // Display milestones
    displayMilestones(learningPath);
    
    // Display recommendations
    displayRecommendations(learningPath);
}

// Display learning path
function displayLearningPath(learningPath) {
    const timelineContainer = document.getElementById('learningTimeline');
    
    if (learningPath.length === 0) {
        timelineContainer.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-road text-5xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No learning path available yet</p>
                <p class="text-sm text-gray-400 mt-1">Enroll in courses to start your learning journey</p>
                <a href="courses.html" class="mt-4 inline-block px-4 py-2 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42] transition">
                    Browse Courses
                </a>
            </div>
        `;
        return;
    }
    
    timelineContainer.innerHTML = learningPath.map((path, index) => `
        <div class="timeline-item ${path.status === 'completed' ? 'completed' : (path.status === 'in-progress' ? 'current' : '')}">
            <div class="timeline-dot"></div>
            <div class="bg-white border border-gray-200 rounded-lg p-5 ml-4 hover:shadow-md transition">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-3 mb-3">
                            <div class="w-12 h-12 ${path.status === 'completed' ? 'bg-green-100' : (path.status === 'in-progress' ? 'bg-blue-100' : 'bg-gray-100')} rounded-lg flex items-center justify-center">
                                <i class="fas ${path.icon} ${path.status === 'completed' ? 'text-green-600' : (path.status === 'in-progress' ? 'text-[#1e88e5]' : 'text-gray-400')} text-xl"></i>
                            </div>
                            <div>
                                <h3 class="font-semibold text-gray-800">${path.title}</h3>
                                <p class="text-sm text-gray-600">${path.description}</p>
                                <p class="text-xs text-gray-500 mt-1">${path.completedCount}/${path.totalCourses} courses completed</p>
                            </div>
                        </div>
                        
                        <!-- Courses List -->
                        <div class="mt-3 space-y-2">
                            ${path.courses.map(course => `
                                <div class="flex items-center justify-between text-sm">
                                    <div class="flex items-center space-x-2 flex-1">
                                        <i class="fas ${course.progress === 100 ? 'fa-check-circle text-[#00c853]' : (path.status === 'locked' ? 'fa-lock text-gray-400' : 'fa-circle text-gray-300')} text-xs"></i>
                                        <span class="${course.progress === 100 ? 'text-gray-500 line-through' : (path.status === 'locked' ? 'text-gray-400' : 'text-gray-700')}">
                                            ${course.title}
                                        </span>
                                        <span class="text-xs text-gray-400 ml-2">${course.level || 'Beginner'}</span>
                                    </div>
                                    <div class="flex items-center space-x-3">
                                        <span class="text-xs text-gray-500">${course.duration || 'N/A'}</span>
                                        ${course.progress > 0 && course.progress < 100 ? `
                                            <span class="text-xs text-[#1e88e5]">${course.progress}%</span>
                                        ` : ''}
                                        ${path.status === 'in-progress' && course.progress < 100 ? `
                                            <button onclick="window.continueCourse('${course.id}')" 
                                                    class="px-3 py-1 bg-[#1e88e5] text-white rounded-lg text-xs hover:bg-[#009e42] transition">
                                                Continue
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        
                        <!-- Progress Bar -->
                        ${path.status !== 'locked' ? `
                            <div class="mt-3">
                                <div class="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>Track Progress</span>
                                    <span>${path.progress}%</span>
                                </div>
                                <div class="w-full bg-gray-200 rounded-full h-2">
                                    <div class="bg-[#1e88e5] rounded-full h-2 transition-all" style="width: ${path.progress}%"></div>
                                </div>
                            </div>
                        ` : `
                            <div class="mt-3 text-center">
                                <span class="text-xs text-gray-400">
                                    <i class="fas fa-lock mr-1"></i> Complete previous tracks to unlock
                                </span>
                            </div>
                        `}
                    </div>
                    
                    ${path.status === 'completed' ? `
                        <div class="ml-4 px-4 py-2 bg-green-100 text-green-600 rounded-lg text-sm whitespace-nowrap">
                            <i class="fas fa-check-circle mr-1"></i> Track Complete
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// Update overall progress
function updateOverallProgress(learningPath) {
    let totalCourses = 0;
    let completedCoursesCount = 0;
    let totalProgress = 0;
    
    for (const path of learningPath) {
        for (const course of path.courses) {
            totalCourses++;
            if (course.progress === 100) {
                completedCoursesCount++;
            }
            totalProgress += course.progress || 0;
        }
    }
    
    const overallProgress = totalCourses > 0 ? Math.round(totalProgress / totalCourses) : 0;
    
    // Update progress circle
    const circle = document.getElementById('progressCircle');
    if (circle) {
        const radius = 54;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (overallProgress / 100) * circumference;
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = offset;
    }
    
    document.getElementById('overallProgressPercent').textContent = overallProgress;
    document.getElementById('completedCoursesCount').textContent = completedCoursesCount;
    document.getElementById('totalCoursesCount').textContent = totalCourses;
}

// Display milestones
function displayMilestones(learningPath) {
    // Find current milestone (first incomplete or in-progress path)
    let currentMilestone = null;
    let nextMilestone = null;
    let foundCurrent = false;
    
    for (let i = 0; i < learningPath.length; i++) {
        const path = learningPath[i];
        if (path.status === 'in-progress') {
            currentMilestone = path;
            foundCurrent = true;
            if (i + 1 < learningPath.length) {
                nextMilestone = learningPath[i + 1];
            }
            break;
        }
    }
    
    if (!currentMilestone && learningPath.length > 0) {
        // Check if any path is locked
        for (let i = 0; i < learningPath.length; i++) {
            if (learningPath[i].status === 'locked') {
                currentMilestone = learningPath[i - 1] || learningPath[i];
                nextMilestone = learningPath[i];
                break;
            }
        }
    }
    
    // If all completed, set last as current
    if (!currentMilestone && learningPath.length > 0) {
        currentMilestone = learningPath[learningPath.length - 1];
        nextMilestone = null;
    }
    
    // Display current milestone
    const currentContainer = document.getElementById('currentMilestone');
    if (currentMilestone) {
        const nextCourse = currentMilestone.courses.find(c => c.progress < 100);
        currentContainer.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="w-12 h-12 ${currentMilestone.status === 'completed' ? 'bg-green-100' : 'bg-blue-100'} rounded-lg flex items-center justify-center">
                    <i class="fas ${currentMilestone.icon} ${currentMilestone.status === 'completed' ? 'text-green-600' : 'text-[#1e88e5]'} text-2xl"></i>
                </div>
                <div class="flex-1">
                    <h4 class="font-semibold text-gray-800">${currentMilestone.title}</h4>
                    <p class="text-sm text-gray-600">${currentMilestone.description}</p>
                    ${currentMilestone.status === 'in-progress' ? `
                        <div class="mt-2">
                            <div class="flex justify-between text-xs text-gray-500 mb-1">
                                <span>Progress</span>
                                <span>${currentMilestone.progress}%</span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-2">
                                <div class="bg-[#1e88e5] rounded-full h-2" style="width: ${currentMilestone.progress}%"></div>
                            </div>
                            ${nextCourse ? `
                                <p class="text-xs text-[#1e88e5] mt-2">
                                    <i class="fas fa-arrow-right mr-1"></i> Next: ${nextCourse.title}
                                </p>
                            ` : ''}
                        </div>
                    ` : currentMilestone.status === 'completed' ? `
                        <p class="text-xs text-green-600 mt-1"><i class="fas fa-check-circle mr-1"></i> Track Completed!</p>
                    ` : `
                        <p class="text-xs text-gray-500 mt-1"><i class="fas fa-lock mr-1"></i> Locked</p>
                    `}
                </div>
            </div>
        `;
    } else {
        currentContainer.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-trophy text-3xl text-yellow-500 mb-2"></i>
                <p class="text-gray-600">Congratulations! You've completed all tracks!</p>
                <a href="courses.html" class="mt-2 inline-block text-sm text-[#1e88e5] hover:underline">Explore more courses →</a>
            </div>
        `;
    }
    
    // Display next milestone
    const nextContainer = document.getElementById('nextMilestone');
    if (nextMilestone) {
        const firstCourse = nextMilestone.courses[0];
        nextContainer.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <i class="fas ${nextMilestone.icon} text-gray-400 text-2xl"></i>
                </div>
                <div class="flex-1">
                    <h4 class="font-semibold text-gray-800">${nextMilestone.title}</h4>
                    <p class="text-sm text-gray-600">${nextMilestone.description}</p>
                    <p class="text-xs text-gray-500 mt-1">
                        <i class="fas fa-clock mr-1"></i> ${nextMilestone.courses.length} courses to complete
                    </p>
                    ${firstCourse ? `
                        <p class="text-xs text-gray-400 mt-1">Starts with: ${firstCourse.title}</p>
                    ` : ''}
                </div>
            </div>
        `;
    } else if (currentMilestone && currentMilestone.status !== 'completed') {
        nextContainer.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-flag-checkered text-3xl text-[#1e88e5] mb-2"></i>
                <p class="text-gray-600">Complete ${currentMilestone.title} to finish</p>
                <p class="text-xs text-gray-500 mt-1">You're almost there!</p>
            </div>
        `;
    } else {
        nextContainer.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-star text-3xl text-yellow-500 mb-2"></i>
                <p class="text-gray-600">You've mastered all tracks!</p>
                <p class="text-xs text-gray-500 mt-1">Check back for new content</p>
            </div>
        `;
    }
}

// Display recommendations
function displayRecommendations(learningPath) {
    const container = document.getElementById('recommendations');
    
    // Find incomplete courses from in-progress paths
    const recommendedCourses = [];
    
    for (const path of learningPath) {
        if (path.status === 'in-progress') {
            const incompleteCourses = path.courses.filter(c => c.progress < 100);
            recommendedCourses.push(...incompleteCourses.slice(0, 2));
        }
    }
    
    // If no in-progress courses, suggest next path's first course
    if (recommendedCourses.length === 0) {
        for (const path of learningPath) {
            if (path.status === 'locked' && path.courses.length > 0) {
                recommendedCourses.push(path.courses[0]);
                break;
            }
        }
    }
    
    if (recommendedCourses.length === 0) {
        container.innerHTML = `
            <div class="col-span-3 text-center py-8">
                <i class="fas fa-check-circle text-4xl text-[#00c853] mb-3"></i>
                <p class="text-gray-600">Great job! You're up to date with your learning</p>
                <a href="courses.html" class="mt-2 inline-block text-sm text-[#1e88e5] hover:underline">Explore new courses →</a>
            </div>
        `;
        return;
    }
    
    container.innerHTML = recommendedCourses.slice(0, 3).map(course => `
        <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer" onclick="window.continueCourse('${course.id}')">
            <div class="flex items-start justify-between mb-2">
                <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <i class="fas fa-book-open text-[#1e88e5]"></i>
                </div>
                <span class="text-xs text-gray-500">${course.duration || 'N/A'}</span>
            </div>
            <h4 class="font-semibold text-gray-800 mb-1">${course.title}</h4>
            <p class="text-sm text-gray-600 mb-2">Level: ${course.level || 'Beginner'}</p>
            ${course.progress > 0 ? `
                <div class="mb-2">
                    <div class="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Progress</span>
                        <span>${course.progress}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-1.5">
                        <div class="bg-[#1e88e5] rounded-full h-1.5" style="width: ${course.progress}%"></div>
                    </div>
                </div>
            ` : ''}
            <div class="flex items-center justify-between mt-2">
                <span class="text-xs text-[#1e88e5]">Recommended next</span>
                <i class="fas fa-arrow-right text-[#1e88e5]"></i>
            </div>
        </div>
    `).join('');
}

// Continue course
window.continueCourse = (courseId) => {
    window.location.href = `course-view.html?id=${courseId}`;
};

// Render skill tree
function renderSkillTree() {
    const container = document.getElementById('skillTreeContainer');
    
    if (enrolledCourses.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-project-diagram text-5xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No courses enrolled yet</p>
                <a href="courses.html" class="mt-4 inline-block px-4 py-2 bg-[#1e88e5] text-white rounded-lg hover:bg-[#009e42] transition">
                    Browse Courses
                </a>
            </div>
        `;
        return;
    }
    
    const skillTreeHtml = `
        <div class="skill-tree p-4">
            <div class="flex justify-center mb-8">
                <div class="text-center">
                    <div class="w-24 h-24 bg-gradient-to-r from-[#1e88e5] to-[#00c853] rounded-full flex items-center justify-center mx-auto mb-3">
                        <i class="fas fa-user-graduate text-white text-3xl"></i>
                    </div>
                    <p class="font-semibold text-gray-800">${document.getElementById('userName')?.textContent || 'Student'}</p>
                    <p class="text-sm text-gray-500">Learning Journey</p>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${enrolledCourses.map(enrollment => {
                    const course = enrollment.course;
                    const progress = enrollment.progress || 0;
                    const statusClass = progress === 100 ? 'bg-green-50 border-green-200' : 
                                      (progress > 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50');
                    const statusIcon = progress === 100 ? 'fa-check-circle text-green-600' : 
                                     (progress > 0 ? 'fa-play-circle text-[#1e88e5]' : 'fa-circle text-gray-400');
                    
                    return `
                        <div class="skill-node border rounded-lg p-4 ${statusClass} cursor-pointer hover:shadow-md transition" onclick="window.continueCourse('${course.id}')">
                            <div class="flex items-center space-x-3 mb-3">
                                <div class="w-10 h-10 ${progress === 100 ? 'bg-green-200' : (progress > 0 ? 'bg-blue-200' : 'bg-gray-200')} rounded-lg flex items-center justify-center">
                                    <i class="fas fa-book-open ${progress === 100 ? 'text-green-600' : (progress > 0 ? 'text-[#1e88e5]' : 'text-gray-500')}"></i>
                                </div>
                                <div class="flex-1">
                                    <h4 class="font-semibold text-gray-800">${course.title}</h4>
                                    <p class="text-xs text-gray-500">${course.category || 'General'} • ${course.level || 'Beginner'}</p>
                                </div>
                                <i class="fas ${statusIcon} text-xl"></i>
                            </div>
                            <div>
                                <div class="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>Progress</span>
                                    <span>${progress}%</span>
                                </div>
                                <div class="w-full bg-gray-200 rounded-full h-2">
                                    <div class="bg-[#1e88e5] rounded-full h-2 transition-all" style="width: ${progress}%"></div>
                                </div>
                            </div>
                            ${progress === 100 ? `
                                <div class="mt-2 text-center">
                                    <span class="text-xs text-green-600"><i class="fas fa-certificate mr-1"></i> Certificate Earned</span>
                                </div>
                            ` : progress > 0 ? `
                                <div class="mt-2 text-center">
                                    <span class="text-xs text-[#1e88e5]">Continue Learning →</span>
                                </div>
                            ` : `
                                <div class="mt-2 text-center">
                                    <span class="text-xs text-gray-400">Not Started</span>
                                </div>
                            `}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = skillTreeHtml;
}

// Setup view toggle
function setupViewToggle() {
    const timelineViewBtn = document.getElementById('timelineViewBtn');
    const skillTreeViewBtn = document.getElementById('skillTreeViewBtn');
    const timelineView = document.getElementById('timelineView');
    const skillTreeView = document.getElementById('skillTreeView');
    
    if (!timelineViewBtn || !skillTreeViewBtn) return;
    
    timelineViewBtn.addEventListener('click', () => {
        timelineView.classList.remove('hidden');
        skillTreeView.classList.add('hidden');
        timelineViewBtn.classList.add('bg-[#1e88e5]', 'text-white');
        timelineViewBtn.classList.remove('bg-gray-100', 'text-gray-600');
        skillTreeViewBtn.classList.remove('bg-[#1e88e5]', 'text-white');
        skillTreeViewBtn.classList.add('bg-gray-100', 'text-gray-600');
    });
    
    skillTreeViewBtn.addEventListener('click', () => {
        timelineView.classList.add('hidden');
        skillTreeView.classList.remove('hidden');
        skillTreeViewBtn.classList.add('bg-[#1e88e5]', 'text-white');
        skillTreeViewBtn.classList.remove('bg-gray-100', 'text-gray-600');
        timelineViewBtn.classList.remove('bg-[#1e88e5]', 'text-white');
        timelineViewBtn.classList.add('bg-gray-100', 'text-gray-600');
        
        renderSkillTree();
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

// Logout
async function logout() {
    try {
        await signOut(auth);
        window.location.href = '../../login.html';
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupViewToggle();
    setupSidebar();
    setupDropdowns();
    
    const logoutBtns = document.querySelectorAll('#logoutBtn, #logoutDropdown');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    });
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const timelineItems = document.querySelectorAll('.timeline-item');
            
            timelineItems.forEach(item => {
                const title = item.querySelector('h3')?.innerText.toLowerCase() || '';
                const description = item.querySelector('p')?.innerText.toLowerCase() || '';
                
                if (title.includes(searchTerm) || description.includes(searchTerm)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }
});

// Global functions
window.continueCourse = continueCourse;