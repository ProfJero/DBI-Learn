export type Role = 'super_admin' | 'admin' | 'instructor' | 'student';
export type CourseStatus = 'draft' | 'review' | 'published' | 'archived';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type QuestionKind = 'single' | 'multiple' | 'true_false' | 'short';
export type QuizKind = 'module' | 'final' | 'practice';

export interface Profile {
  id: string;
  full_name: string;
  username: string | null;
  role: Role;
  status: 'active' | 'suspended';
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  xp: number;
  streak: number;
  longest_streak: number;
  last_active_date: string | null;
  daily_goal_minutes: number;
  created_at: string;
}

export interface ProfilePrivate {
  id: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  school: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  must_change_password: boolean;
}

export interface Signatory {
  name: string;
  title: string;
  signature_url?: string | null;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  signatory: Signatory | null;
  position: number;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category_id: string | null;
  level: Level;
  language: string;
  cover_url: string | null;
  accent: string | null;
  instructor_id: string | null;
  status: CourseStatus;
  outcomes: string[];
  requirements: string[];
  tags: string[];
  pass_mark: number;
  certificate_enabled: boolean;
  sequential: boolean;
  featured: boolean;
  estimated_hours: number | null;
  enrollment_count: number;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  category?: Pick<Category, 'id' | 'name' | 'slug' | 'color' | 'icon'> | null;
  instructor?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'headline'> | null;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  summary: string | null;
  position: number;
}

export interface Lesson {
  id: string;
  course_id: string;
  module_id: string;
  title: string;
  kind: 'article' | 'video' | 'exercise';
  content: string;
  video_url: string | null;
  duration_minutes: number;
  position: number;
  is_preview: boolean;
  attachments: { title: string; url: string }[];
}

export interface Quiz {
  id: string;
  course_id: string;
  module_id: string | null;
  title: string;
  description: string | null;
  kind: QuizKind;
  time_limit_minutes: number | null;
  pass_mark: number;
  max_attempts: number | null;
  shuffle_questions: boolean;
  show_answers: boolean;
  position: number;
  status: 'draft' | 'published';
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  quiz_id: string;
  kind: QuestionKind;
  prompt: string;
  options: QuestionOption[];
  points: number;
  position: number;
}

export interface QuestionKey {
  question_id: string;
  answer: string[];
  explanation: string | null;
}

export interface QuestionResult {
  question_id: string;
  correct: boolean;
  points: number;
  earned: number;
  given: string[];
  answer: string[] | null;
  explanation: string | null;
}

export interface QuizAttempt {
  id: string;
  client_id: string;
  quiz_id: string;
  course_id: string;
  user_id: string;
  answers: Record<string, string[]>;
  results: QuestionResult[];
  score: number;
  max_score: number;
  percent: number;
  passed: boolean;
  started_at: string | null;
  submitted_at: string;
  submitted_offline: boolean;
}

export interface Enrollment {
  user_id: string;
  course_id: string;
  status: 'active' | 'completed';
  progress: number;
  last_lesson_id: string | null;
  enrolled_at: string;
  last_activity_at: string;
  completed_at: string | null;
}

export interface Certificate {
  id: string;
  serial: string;
  user_id: string | null;
  recipient_name: string;
  recipient_email: string | null;
  course_id: string | null;
  course_title: string;
  category_name: string | null;
  kind: 'completion' | 'distinction' | 'participation' | 'achievement';
  grade: number | null;
  hours: number | null;
  description: string | null;
  signatories: Signatory[];
  status: 'valid' | 'revoked';
  revoked_reason: string | null;
  issued_at: string;
  course_slug?: string | null;
}

export interface Badge {
  code: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  position: number;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/** Everything needed to study a course with no connection. */
export interface CoursePackage {
  course: Course;
  modules: Module[];
  lessons: Lesson[];
  quizzes: Quiz[];
  questions: Question[];
  practiceKeys: QuestionKey[];
  downloadedAt: string;
  version: string;
}

export interface ProgressResult {
  progress: number;
  completed: boolean;
  certificate_serial: string | null;
  xp_awarded?: number;
}
