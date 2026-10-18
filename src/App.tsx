import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import {
  Award,
  BarChart3,
  BookOpen,
  Compass,
  Download,
  FileCheck2,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessagesSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  Trophy,
  UserPlus,
  Users,
  Library,
} from 'lucide-react';
import { RedirectIfSignedIn, RequireAuth, RequireRole } from './auth/guards';
import { useAuth } from './auth/AuthProvider';
import { FullPageSpinner } from './components/ui';
import { PublicLayout } from './components/layout/PublicLayout';
import { Shell, type NavGroup } from './components/layout/Shell';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './lib/supabase';
import { isAdminRole } from './lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;
const p = <T extends Record<string, unknown>>(f: () => Promise<T>, name: keyof T) =>
  lazy(() => f().then((m) => ({ default: m[name] as AnyComponent })));

// Public
const Home = p(() => import('./pages/public/Home'), 'Home');
const PublicCatalog = p(() => import('./pages/public/Catalog'), 'PublicCatalog');
const CourseDetail = p(() => import('./pages/public/CourseDetail'), 'CourseDetail');
const Verify = p(() => import('./pages/public/Verify'), 'Verify');
const About = p(() => import('./pages/public/About'), 'About');
const Teach = p(() => import('./pages/public/Teach'), 'Teach');
const Login = p(() => import('./pages/public/Auth'), 'Login');
const Signup = p(() => import('./pages/public/Auth'), 'Signup');
const ForgotPassword = p(() => import('./pages/public/Auth'), 'ForgotPassword');
const ResetPassword = p(() => import('./pages/public/Auth'), 'ResetPassword');
const NotFound = p(() => import('./pages/public/NotFound'), 'NotFound');
const Suspended = p(() => import('./pages/public/NotFound'), 'Suspended');

// Learner
const Dashboard = p(() => import('./pages/app/Dashboard'), 'Dashboard');
const AppCatalog = p(() => import('./pages/public/Catalog'), 'AppCatalog');
const MyCourses = p(() => import('./pages/app/MyCourses'), 'MyCourses');
const Player = p(() => import('./pages/app/Player'), 'Player');
const Certificates = p(() => import('./pages/app/Certificates'), 'Certificates');
const CertificatePage = p(() => import('./pages/app/Certificates'), 'CertificatePage');
const Achievements = p(() => import('./pages/app/Achievements'), 'Achievements');
const Discussions = p(() => import('./pages/app/Discussions'), 'Discussions');
const Thread = p(() => import('./pages/app/Discussions'), 'Thread');
const Downloads = p(() => import('./pages/app/Downloads'), 'Downloads');
const Announcements = p(() => import('./pages/app/Announcements'), 'Announcements');
const Support = p(() => import('./pages/app/Support'), 'Support');
const Ticket = p(() => import('./pages/app/Support'), 'Ticket');
const Profile = p(() => import('./pages/app/Profile'), 'Profile');
const SettingsPage = p(() => import('./pages/app/Settings'), 'SettingsPage');
const Resources = p(() => import('./pages/app/Resources'), 'Resources');

// Studio
const Overview = p(() => import('./pages/studio/Overview'), 'Overview');
const StudioCourses = p(() => import('./pages/studio/Courses'), 'StudioCourses');
const CourseEditor = p(() => import('./pages/studio/CourseEditor'), 'CourseEditor');
const Learners = p(() => import('./pages/studio/People'), 'Learners');
const LearnerDetail = p(() => import('./pages/studio/People'), 'LearnerDetail');
const Staff = p(() => import('./pages/studio/People'), 'Staff');
const Applications = p(() => import('./pages/studio/People'), 'Applications');
const StudioCertificates = p(() => import('./pages/studio/Certificates'), 'StudioCertificates');
const Reports = p(() => import('./pages/studio/Reports'), 'Reports');
const StudioAnnouncements = p(() => import('./pages/studio/Announcements'), 'StudioAnnouncements');
const SupportInbox = p(() => import('./pages/studio/SupportInbox'), 'SupportInbox');
const StudioTicket = p(() => import('./pages/studio/SupportInbox'), 'StudioTicket');
const Inquiries = p(() => import('./pages/studio/SupportInbox'), 'Inquiries');
const PlatformSettings = p(() => import('./pages/studio/PlatformSettings'), 'PlatformSettings');
const AuditLog = p(() => import('./pages/studio/PlatformSettings'), 'AuditLog');
const StudioResources = p(() => import('./pages/studio/Resources'), 'StudioResources');

const studentNav: NavGroup[] = [
  {
    items: [
      { to: '/app', label: 'Home', icon: LayoutDashboard, end: true, mobile: true },
      { to: '/app/catalog', label: 'Explore', icon: Compass, mobile: true },
      { to: '/app/courses', label: 'My learning', icon: BookOpen, mobile: true },
      { to: '/app/downloads', label: 'Downloads', icon: Download, mobile: true },
      { to: '/app/achievements', label: 'Achievements', icon: Trophy, mobile: true },
    ],
  },
  {
    title: 'Community',
    items: [
      { to: '/app/discussions', label: 'Discussions', icon: MessagesSquare },
      { to: '/app/announcements', label: 'Announcements', icon: Megaphone },
      { to: '/app/resources', label: 'Resource library', icon: Library },
    ],
  },
  {
    title: 'Account',
    items: [
      { to: '/app/certificates', label: 'Certificates', icon: Award },
      { to: '/app/support', label: 'Help & support', icon: LifeBuoy },
      { to: '/app/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function StudioShell() {
  const { profile } = useAuth();
  const admin = isAdminRole(profile?.role);
  const { data: counts } = useQuery({
    queryKey: ['studio-counts'],
    enabled: admin,
    refetchInterval: 120_000,
    queryFn: async () => {
      const [t, a] = await Promise.all([
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('instructor_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      return { tickets: t.count ?? 0, applications: a.count ?? 0 };
    },
  });
  const groups: NavGroup[] = [
    {
      items: [
        { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/admin/courses', label: 'Courses', icon: BookOpen },
        { to: '/admin/learners', label: 'Learners', icon: GraduationCap },
        { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
        { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
        { to: '/admin/resources', label: 'Resources', icon: Library },
      ],
    },
    ...(admin
      ? [
          {
            title: 'Administration',
            items: [
              { to: '/admin/staff', label: 'Admins & instructors', icon: Users },
              { to: '/admin/applications', label: 'Instructor applications', icon: UserPlus, badge: counts?.applications },
              { to: '/admin/certificates', label: 'Certificates', icon: FileCheck2 },
              { to: '/admin/support', label: 'Support inbox', icon: LifeBuoy, badge: counts?.tickets },
              { to: '/admin/inquiries', label: 'Contact messages', icon: Inbox },
              { to: '/admin/settings', label: 'Platform settings', icon: ShieldCheck },
              { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
            ],
          },
        ]
      : []),
  ];
  return <Shell groups={groups} mode="studio" />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="courses" element={<PublicCatalog />} />
          <Route path="courses/:slug" element={<CourseDetail />} />
          <Route path="verify" element={<Verify />} />
          <Route path="verify/:serial" element={<Verify />} />
          <Route path="about" element={<About />} />
          <Route path="teach" element={<Teach />} />
          <Route path="suspended" element={<Suspended />} />
        </Route>
        <Route path="login" element={<RedirectIfSignedIn><Login /></RedirectIfSignedIn>} />
        <Route path="signup" element={<RedirectIfSignedIn><Signup /></RedirectIfSignedIn>} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />

        <Route element={<RequireAuth />}>
          <Route path="app/learn/:slug/*" element={<Player />} />
          <Route path="app" element={<Shell groups={studentNav} mode="student" />}>
            <Route index element={<Dashboard />} />
            <Route path="catalog" element={<AppCatalog />} />
            <Route path="catalog/:slug" element={<CourseDetail inApp />} />
            <Route path="courses" element={<MyCourses />} />
            <Route path="certificates" element={<Certificates />} />
            <Route path="certificates/:serial" element={<CertificatePage />} />
            <Route path="achievements" element={<Achievements />} />
            <Route path="discussions" element={<Discussions />} />
            <Route path="discussions/:id" element={<Thread />} />
            <Route path="downloads" element={<Downloads />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="resources" element={<Resources />} />
            <Route path="support" element={<Support />} />
            <Route path="support/:id" element={<Ticket />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route element={<RequireRole roles={['super_admin', 'admin', 'instructor']} />}>
            <Route path="admin" element={<StudioShell />}>
              <Route index element={<Overview />} />
              <Route path="courses" element={<StudioCourses />} />
              <Route path="courses/:id" element={<CourseEditor />} />
              <Route path="learners" element={<Learners />} />
              <Route path="learners/:id" element={<LearnerDetail />} />
              <Route path="reports" element={<Reports />} />
              <Route path="announcements" element={<StudioAnnouncements />} />
              <Route path="resources" element={<StudioResources />} />
              <Route element={<RequireRole roles={['super_admin', 'admin']} />}>
                <Route path="staff" element={<Staff />} />
                <Route path="applications" element={<Applications />} />
                <Route path="certificates" element={<StudioCertificates />} />
                <Route path="support" element={<SupportInbox />} />
                <Route path="support/:id" element={<StudioTicket />} />
                <Route path="inquiries" element={<Inquiries />} />
                <Route path="settings" element={<PlatformSettings />} />
                <Route path="audit" element={<AuditLog />} />
              </Route>
            </Route>
          </Route>
        </Route>
        <Route element={<PublicLayout />}>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
