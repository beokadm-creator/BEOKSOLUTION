import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSubdomain } from './hooks/useSubdomain';
import AdminLoginPage from './pages/admin/auth/AdminLoginPage';
import AdminGuard from './components/auth/AdminGuard';
import AuthPage from './pages/auth/AuthPage';
import NewAuthPortal from './pages/auth/NewAuthPortal';
import ConferenceLoader from './components/conference/ConferenceLoader';
import ConferencePreviewLoader from './components/conference/ConferencePreviewLoader';
import PaymentSuccessHandler from './components/payment/PaymentSuccessHandler';
import AccountRecoveryPage from './pages/auth/AccountRecoveryPage';
import NotFoundPage from './pages/NotFoundPage';
import SocietyLoginPage from './pages/SocietyLoginPage';
import MembershipPaymentLayout from './layouts/MembershipPaymentLayout';
import { ConferenceMyPageRedirect } from '@/components/common/ConferenceMyPageRedirect';
import { Toaster } from 'react-hot-toast';
import { GlobalErrorBoundary } from './components/common/GlobalErrorBoundary';
import { FeatureFlagProvider } from './contexts/FeatureFlagContext';
import LoadingSpinner from './components/common/LoadingSpinner';

// Layouts (static — needed before routes render)
import SuperLayout from './layouts/SuperLayout';
import SocietyLayout from './layouts/SocietyLayout';
import ConfLayout from './layouts/ConfLayout';
import VendorLayout from './layouts/VendorLayout';
import VendorPortalLayout from './layouts/VendorPortalLayout';

// Lazy-loaded admin pages
const SuperAdminPage = React.lazy(() => import('./pages/admin/SuperAdminPage'));
const SecurityPolicyManager = React.lazy(() => import('./components/admin/SecurityPolicyManager'));
const GlobalExpertManagerPage = React.lazy(() => import('./pages/admin/GlobalExpertManagerPage'));
const SocietyDashboardPage = React.lazy(() => import('./pages/admin/SocietyDashboardPage'));
const InfraPage = React.lazy(() => import('./pages/admin/InfraPage'));
const IdentityPage = React.lazy(() => import('./pages/admin/IdentityPage'));
const TemplatesPage = React.lazy(() => import('./pages/admin/TemplatesPage'));
const MemberManagerPage = React.lazy(() => import('./pages/admin/MemberManagerPage'));
const MembershipFeeSettingsPage = React.lazy(() => import('./pages/admin/MembershipFeeSettingsPage'));
const AdminUsersPage = React.lazy(() => import('./pages/admin/AdminUsersPage'));
const SocietyContentManagementPage = React.lazy(() => import('./pages/admin/SocietyContentManagementPage'));
const DashboardPage = React.lazy(() => import('./pages/admin/DashboardPage'));
const ConferenceSettingsPage = React.lazy(() => import('./pages/admin/ConferenceSettingsPage'));
const RegistrationSettingsPage = React.lazy(() => import('./pages/admin/RegistrationSettingsPage'));
const AttendanceSettingsPage = React.lazy(() => import('./pages/admin/AttendanceSettingsPage'));
const StatisticsPage = React.lazy(() => import('./pages/admin/StatisticsPage'));
const AttendanceLivePage = React.lazy(() => import('./pages/admin/AttendanceLivePage'));
const InfodeskPage = React.lazy(() => import('./pages/admin/conf/InfodeskPage'));
const GatePage = React.lazy(() => import('./pages/admin/conf/GatePage'));
const StampTourDrawPage = React.lazy(() => import('./pages/admin/conf/StampTourDrawPage'));
const AgendaManager = React.lazy(() => import('./pages/admin/AgendaManager'));
const SponsorManager = React.lazy(() => import('./pages/admin/SponsorManager'));
const ModeratorLinksPage = React.lazy(() => import('./pages/admin/ModeratorLinksPage'));
const RegistrationListPage = React.lazy(() => import('./pages/admin/RegistrationListPage'));
const RegistrationDetailPage = React.lazy(() => import('./pages/admin/RegistrationDetailPage'));
const PageEditor = React.lazy(() => import('./pages/admin/PageEditor'));
const BadgeEditorPage = React.lazy(() => import('./pages/admin/BadgeEditorPage'));
const BadgeManagementPage = React.lazy(() => import('./pages/admin/BadgeManagementPage'));
const AdminRefundPage = React.lazy(() => import('./pages/admin/AdminRefundPage'));
const AbstractManagerPage = React.lazy(() => import('./pages/admin/AbstractManagerPage'));
const ExternalAttendeePage = React.lazy(() => import('./pages/admin/ExternalAttendeePage'));
const CertificateManagementPage = React.lazy(() => import('./pages/admin/CertificateManagementPage'));
const NoticesManager = React.lazy(() => import('./pages/admin/notices/NoticesManager').then(m => ({ default: m.NoticesManager })));
const OptionsManagementPage = React.lazy(() => import('./pages/admin/OptionsManagementPage').then(m => ({ default: m.OptionsManagementPage })));

// Lazy-loaded user pages
const RegistrationPage = React.lazy(() => import('./pages/RegistrationPage'));
const RegistrationSuccessPage = React.lazy(() => import('./pages/RegistrationSuccessPage'));
const RegistrationFailPage = React.lazy(() => import('./pages/RegistrationFailPage'));
const AbstractSubmissionPage = React.lazy(() => import('./pages/AbstractSubmissionPage'));
const ProgramPage = React.lazy(() => import('./pages/ProgramPage'));
const TermsPage = React.lazy(() => import('./pages/TermsPage'));
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage'));
const UserHubPage = React.lazy(() => import('./pages/UserHubPage'));
const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const SocietyLandingPage = React.lazy(() => import('./pages/SocietyLandingPage'));
const StandAloneBadgePage = React.lazy(() => import('./pages/StandAloneBadgePage'));
const BadgePrepPage = React.lazy(() => import('./pages/BadgePrepPage'));
const ModeratorLivePage = React.lazy(() => import('./pages/ModeratorLivePage'));
const MembershipPaymentPage = React.lazy(() => import('./pages/MembershipPaymentPage'));

// Lazy-loaded vendor pages
const VendorDashboard = React.lazy(() => import('./pages/vendor/VendorDashboard'));
const VendorIntroPage = React.lazy(() => import('./pages/conference/VendorIntroPage'));
const VendorLoginPage = React.lazy(() => import('./pages/vendor/VendorLoginPage'));
const VendorDashboardPage = React.lazy(() => import('./pages/vendor/VendorDashboardPage'));
const VendorScannerPage = React.lazy(() => import('./pages/vendor/VendorScannerPage'));
const VendorScannerIntroPage = React.lazy(() => import('./pages/vendor/VendorScannerIntroPage'));
const VendorSettingsPage = React.lazy(() => import('./pages/vendor/VendorSettingsPage'));
const VendorStaffPage = React.lazy(() => import('./pages/vendor/VendorStaffPage'));
const PartnerNotificationSettingsPage = React.lazy(() => import('./pages/vendor/PartnerNotificationSettingsPage'));
const VendorAuditLogsPage = React.lazy(() => import('./pages/vendor/VendorAuditLogsPage'));

/** Shorthand Suspense wrapper with LoadingSpinner fallback */
const LS = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
);

const App: React.FC = () => {
  const { subdomain } = useSubdomain();
  const hostname = window.location.hostname;

  // DEV 환경: URL 파라미터 또는 경로로 어드민 모드 지원
  const params = new URLSearchParams(window.location.search);
  const isAdminMode = params.get('admin') === 'true' || window.location.pathname.startsWith('/admin');

  // DEV 환경: ?society=xxx 파라미터로 학회 접근 지원
  const societyParam = params.get('society');

  // 0. ADMIN DOMAIN (또는 DEV 환경에서 ?admin=true 또는 /admin 경로) - 최우선 체크
  // 🚨 [Fix] subdomain이 있는 경우(/admin 붙인 경우)는 학회 어드민으로 간주하게 로직 보강
  const isSuperAdminHost = hostname.includes('admin.eregi') || hostname.startsWith('admin.');

  if (isSuperAdminHost || isAdminMode) {
    // 🚨 [Fix] useSubdomain이 null을 반환하더라도(예: www 등으로 인해), 
    // 관리자 모드에서는 호스트네임에서 학회 ID를 추출하여 리다이렉트를 방지해야 함.
    // 이 로직은 오직 Admin 라우팅 내부에서만 동작하므로 일반 사용자에게는 영향 없음.
    let effectiveSubdomain = subdomain;
    if (!effectiveSubdomain && !hostname.includes('localhost') && !hostname.includes('admin.eregi')) {
      const parts = hostname.split('.');
      // www 제거 후 첫 번째 파트 확인
      const cleanParts = parts[0] === 'www' ? parts.slice(1) : parts;

      if (cleanParts.length >= 3) {
        const first = cleanParts[0];
        if (first !== 'eregi' && first !== 'admin' && first !== 'web') {
          effectiveSubdomain = first;
        }
      }
    }

    const activeSocietyId = params.get('society') || sessionStorage.getItem('societyId') || effectiveSubdomain;

    return (
      <GlobalErrorBoundary>
        <FeatureFlagProvider>
          <Router>
            <div className="App font-sans text-slate-900">
              <Toaster
                position="top-center"
                toastOptions={{
                  duration: 3000,
                  style: { borderRadius: '0.75rem', padding: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
                  success: {
                    style: { background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', fontWeight: 'bold' },
                    iconTheme: { primary: '#059669', secondary: '#ecfdf5' }
                  },
                  error: {
                    style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', fontWeight: 'bold' },
                    iconTheme: { primary: '#dc2626', secondary: '#fef2f2' }
                  }
                }}
              />
              <Routes>
                <Route path="/login" element={activeSocietyId ? <SocietyLoginPage /> : <AdminLoginPage />} />
                <Route path="/admin/login" element={activeSocietyId ? <SocietyLoginPage /> : <AdminLoginPage />} />

                <Route element={<AdminGuard />}>
                  {/* 루트 경로 리다이렉트 - society 파라미터 또는 서브도메인에 따라 분기 */}
                  <Route path="/" element={<Navigate to={activeSocietyId ? "/admin/society" : "/super"} replace />} />

                  {/* L0: Super Layout */}
                  <Route element={<SuperLayout />}>
                    <Route path="/super" element={<LS><SuperAdminPage /></LS>} />
                    <Route path="/super/security" element={<LS><SecurityPolicyManager /></LS>} />
                    <Route path="/super/experts" element={<LS><GlobalExpertManagerPage /></LS>} />
                  </Route>

                  {/* L1: Society Layout (DEV 환경에서 society 파라미터 사용) */}
                  <Route path="/admin/society" element={<SocietyLayout />}>
                    <Route index element={<LS><SocietyDashboardPage /></LS>} />
                    <Route path="content" element={<LS><SocietyContentManagementPage /></LS>} />
                    <Route path="infra" element={<LS><InfraPage /></LS>} />
                    <Route path="identity" element={<LS><IdentityPage /></LS>} />
                    <Route path="templates" element={<LS><TemplatesPage /></LS>} />
                    <Route path="members" element={<LS><MemberManagerPage /></LS>} />
                    <Route path="membership-fees" element={<LS><MembershipFeeSettingsPage /></LS>} />
                    <Route path="users" element={<LS><AdminUsersPage /></LS>} />
                  </Route>

                  <Route path="/admin/society/:sid" element={<SocietyLayout />}>
                    <Route index element={<LS><SocietyDashboardPage /></LS>} />
                    <Route path="content" element={<LS><SocietyContentManagementPage /></LS>} />
                    <Route path="infra" element={<LS><InfraPage /></LS>} />
                    <Route path="identity" element={<LS><IdentityPage /></LS>} />
                    <Route path="templates" element={<LS><TemplatesPage /></LS>} />
                    <Route path="members" element={<LS><MemberManagerPage /></LS>} />
                    <Route path="membership-fees" element={<LS><MembershipFeeSettingsPage /></LS>} />
                    <Route path="users" element={<LS><AdminUsersPage /></LS>} />
                  </Route>

                  {/* L2: Conference Layout (DEV 환경에서 society 파라미터로 학회 결정) */}
                  <Route path="/admin/conf/:cid" element={<ConfLayout />}>
                    <Route index element={<LS><DashboardPage /></LS>} />
                    <Route path="settings" element={<LS><ConferenceSettingsPage /></LS>} />
                    <Route path="settings/registration" element={<LS><RegistrationSettingsPage /></LS>} />
                    <Route path="settings/options" element={<LS><OptionsManagementPage /></LS>} />
                    <Route path="options" element={<LS><OptionsManagementPage /></LS>} />
                    <Route path="attendance-settings" element={<LS><AttendanceSettingsPage /></LS>} />
                    <Route path="statistics" element={<LS><StatisticsPage /></LS>} />
                    <Route path="registrations" element={<LS><RegistrationListPage /></LS>} />
                    <Route path="registrations/:regId" element={<LS><RegistrationDetailPage /></LS>} />
                    <Route path="abstracts" element={<LS><AbstractManagerPage /></LS>} />
                    <Route path="notices" element={<LS><NoticesManager /></LS>} />
                    <Route path="agenda" element={<LS><AgendaManager /></LS>} />
                    <Route path="sponsors" element={<LS><SponsorManager /></LS>} />
                    <Route path="moderator-links" element={<LS><ModeratorLinksPage /></LS>} />
                    <Route path="moderator" element={<Navigate to="moderator-links" replace />} />
                    <Route path="page-editor" element={<LS><PageEditor /></LS>} />
                    <Route path="badge-editor" element={<LS><BadgeEditorPage /></LS>} />
                    <Route path="badge-management" element={<LS><BadgeManagementPage /></LS>} />
                    <Route path="refund" element={<LS><AdminRefundPage /></LS>} />
                    <Route path="external-attendees" element={<LS><ExternalAttendeePage /></LS>} />
                    <Route path="attendance-live" element={<LS><AttendanceLivePage /></LS>} />
                    <Route path="attendance-live/zone/:zoneId" element={<LS><AttendanceLivePage /></LS>} />
                    <Route path="certificates" element={<LS><CertificateManagementPage /></LS>} />
                  </Route>
                  <Route path="/admin/conf/:cid/gate" element={<LS><GatePage /></LS>} />
                  <Route path="/admin/conf/:cid/gate/zone/:zoneId" element={<LS><GatePage /></LS>} />
                  <Route path="/admin/conf/:cid/infodesk" element={<LS><InfodeskPage /></LS>} />
                  <Route path="/admin/conf/:cid/stamp-tour-draw" element={<LS><StampTourDrawPage /></LS>} />
                  <Route path="*" element={<Navigate to={activeSocietyId ? `/admin/society` : "/super"} />} />
                </Route>
                <Route path="*" element={<Navigate to="/login" />} />
              </Routes>
            </div>
          </Router>
        </FeatureFlagProvider>
      </GlobalErrorBoundary>
    );
  }

  // 1. SOCIETY SUBDOMAIN 또는 DEV 환경에서 ?society 파라미터로 학회 접근
  // subdomain이 있으면 → 학회 도메인 (kadd.eregi.co.kr)
  // ?society=xxx 파라미터가 있으면 → DEV 환경 학회 접근
  if (subdomain || societyParam) {
    return (
      <GlobalErrorBoundary>
        <FeatureFlagProvider>
          <Router>
            <div className="App font-sans text-slate-900">
              <Toaster
                position="top-center"
                toastOptions={{
                  duration: 3000,
                  style: { borderRadius: '0.75rem', padding: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
                  success: {
                    style: { background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', fontWeight: 'bold' },
                    iconTheme: { primary: '#059669', secondary: '#ecfdf5' }
                  },
                  error: {
                    style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', fontWeight: 'bold' },
                    iconTheme: { primary: '#dc2626', secondary: '#fef2f2' }
                  }
                }}
              />
              <Routes>
                {/* --- PRIORITY 0: SOCIETY ADMIN (Must be before /:slug catch-all) --- */}
                <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
                <Route path="/admin/login" element={<SocietyLoginPage />} />
                <Route element={<AdminGuard />}>
                  {/* L1: Society Layout (Subdomain Optimized) */}
                  <Route path="/admin/society" element={<SocietyLayout />}>
                    <Route index element={<LS><SocietyDashboardPage /></LS>} />
                    <Route path="content" element={<LS><SocietyContentManagementPage /></LS>} />
                    <Route path="infra" element={<LS><InfraPage /></LS>} />
                    <Route path="identity" element={<LS><IdentityPage /></LS>} />
                    <Route path="templates" element={<LS><TemplatesPage /></LS>} />
                    <Route path="members" element={<LS><MemberManagerPage /></LS>} />
                    <Route path="membership-fees" element={<LS><MembershipFeeSettingsPage /></LS>} />
                    <Route path="users" element={<LS><AdminUsersPage /></LS>} />
                  </Route>

                  {/* L1: Society Layout */}
                  <Route path="/admin/society/:sid" element={<SocietyLayout />}>
                    <Route index element={<LS><SocietyDashboardPage /></LS>} />
                    <Route path="content" element={<LS><SocietyContentManagementPage /></LS>} />
                    <Route path="infra" element={<LS><InfraPage /></LS>} />
                    <Route path="identity" element={<LS><IdentityPage /></LS>} />
                    <Route path="templates" element={<LS><TemplatesPage /></LS>} />
                    <Route path="members" element={<LS><MemberManagerPage /></LS>} />
                    <Route path="membership-fees" element={<LS><MembershipFeeSettingsPage /></LS>} />
                    <Route path="users" element={<LS><AdminUsersPage /></LS>} />
                  </Route>

                  {/* L2: Conference Layout */}
                  <Route path="/admin/conf/:cid" element={<ConfLayout />}>
                    <Route index element={<LS><DashboardPage /></LS>} />
                    <Route path="settings" element={<LS><ConferenceSettingsPage /></LS>} />
                    <Route path="settings/registration" element={<LS><RegistrationSettingsPage /></LS>} />
                    <Route path="settings/options" element={<LS><OptionsManagementPage /></LS>} />
                    <Route path="attendance-settings" element={<LS><AttendanceSettingsPage /></LS>} />
                    <Route path="statistics" element={<LS><StatisticsPage /></LS>} />
                    <Route path="registrations" element={<LS><RegistrationListPage /></LS>} />
                    <Route path="options" element={<LS><OptionsManagementPage /></LS>} />
                    <Route path="registrations/:regId" element={<LS><RegistrationDetailPage /></LS>} />
                    <Route path="abstracts" element={<LS><AbstractManagerPage /></LS>} />
                    <Route path="notices" element={<LS><NoticesManager /></LS>} />
                    <Route path="agenda" element={<LS><AgendaManager /></LS>} />
                    <Route path="sponsors" element={<LS><SponsorManager /></LS>} />
                    <Route path="moderator-links" element={<LS><ModeratorLinksPage /></LS>} />
                    <Route path="moderator" element={<Navigate to="moderator-links" replace />} />
                    <Route path="page-editor" element={<LS><PageEditor /></LS>} />
                    <Route path="badge-editor" element={<LS><BadgeEditorPage /></LS>} />
                    <Route path="badge-management" element={<LS><BadgeManagementPage /></LS>} />
                    <Route path="refund" element={<LS><AdminRefundPage /></LS>} />
                    <Route path="external-attendees" element={<LS><ExternalAttendeePage /></LS>} />
                    <Route path="attendance-live" element={<LS><AttendanceLivePage /></LS>} />
                    <Route path="attendance-live/zone/:zoneId" element={<LS><AttendanceLivePage /></LS>} />
                    <Route path="certificates" element={<LS><CertificateManagementPage /></LS>} />
                  </Route>

                  <Route path="/admin/conf/:cid/gate" element={<LS><GatePage /></LS>} />
                  <Route path="/admin/conf/:cid/gate/zone/:zoneId" element={<LS><GatePage /></LS>} />
                  <Route path="/admin/conf/:cid/infodesk" element={<LS><InfodeskPage /></LS>} />
                  <Route path="/admin/conf/:cid/stamp-tour-draw" element={<LS><StampTourDrawPage /></LS>} />

                  {/* L3: Vendor Layout */}
                  <Route path="/admin/vendor/:vid" element={<VendorLayout />}>
                    <Route index element={<LS><VendorDashboard /></LS>} />
                  </Route>
                </Route>

                {/* --- PRIORITY 1: GLOBAL AUTH --- */}
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/portal" element={<NewAuthPortal />} />
                <Route path="/auth/recovery" element={<AccountRecoveryPage />} />

                {/* --- PRIORITY 2: MYPAGE (Hub) --- */}
                <Route path="/mypage" element={<LS><UserHubPage /></LS>} />
                <Route path="/mypage/membership" element={
                  <MembershipPaymentLayout>
                    <LS><MembershipPaymentPage /></LS>
                  </MembershipPaymentLayout>
                } />

                {/* --- PRIORITY 3: BADGE --- */}
                <Route path="/:slug/badge" element={<LS><StandAloneBadgePage /></LS>} />
                <Route path="/:slug/badge-prep/:token" element={<LS><BadgePrepPage /></LS>} />
                <Route path="/:slug/moderator/:token" element={<LS><ModeratorLivePage /></LS>} />

                {/* --- PRIORITY 4: CONFERENCE-SPECIFIC ROUTES --- */}
                <Route path="/:slug/mypage" element={<ConferenceMyPageRedirect />} />
                <Route path="/:slug/mypage/*" element={<ConferenceMyPageRedirect />} />
                <Route path="/:slug/auth" element={<NewAuthPortal />} />
                <Route path="/:slug/register" element={<LS><RegistrationPage /></LS>} />
                <Route path="/:slug/register/success" element={<LS><RegistrationSuccessPage /></LS>} />
                <Route path="/:slug/register/fail" element={<LS><RegistrationFailPage /></LS>} />
                <Route path="/:slug/register/fail" element={<LS><RegistrationFailPage /></LS>} />
                <Route path="/:slug/abstracts" element={<LS><AbstractSubmissionPage /></LS>} />
                <Route path="/:slug/program" element={<LS><ProgramPage /></LS>} />
                <Route path="/:slug/agenda" element={<LS><ProgramPage /></LS>} />
                <Route path="/:slug/terms" element={<LS><TermsPage /></LS>} />
                <Route path="/:slug/privacy" element={<LS><PrivacyPage /></LS>} />
                <Route path="/payment/success" element={<PaymentSuccessHandler />} />
                <Route path="/:slug/vendors/:vid" element={<LS><VendorIntroPage /></LS>} />

                {/* --- PRIORITY 5: CONFERENCE LANDING (/2026spring, etc.) --- */}
                {/* Preview route must come before general slug route */}
                <Route path="/:slug/preview" element={<ConferencePreviewLoader />} />
                <Route path="/conference/:slug" element={<ConferenceLoader />} />
                <Route path="/conf/:slug" element={<ConferenceLoader />} />
                <Route path="/:slug" element={<ConferenceLoader />} />

                {/* --- PRIORITY 6: SOCIETY LANDING (ROOT) --- */}
                <Route path="/" element={<LS><SocietyLandingPage /></LS>} />
              </Routes>
            </div>
          </Router>
        </FeatureFlagProvider>
      </GlobalErrorBoundary>
    );
  }

  // 2. USER DOMAIN (Main & Society)
  return (
    <GlobalErrorBoundary>
      <FeatureFlagProvider>
        <Router>
          <div className="App font-sans text-slate-900">
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 3000,
                style: { borderRadius: '0.75rem', padding: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
                success: {
                  style: { background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', fontWeight: 'bold' },
                  iconTheme: { primary: '#059669', secondary: '#ecfdf5' }
                },
                error: {
                  style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', fontWeight: 'bold' },
                  iconTheme: { primary: '#dc2626', secondary: '#fef2f2' }
                }
              }}
            />
            <Routes>
              {/* --- PRIORITY 0: SUPER ADMIN (Global Match) --- */}
              <Route element={<AdminGuard />}>
                <Route element={<SuperLayout />}>
                  <Route path="/super" element={<LS><SuperAdminPage /></LS>} />
                  <Route path="/super/security" element={<LS><SecurityPolicyManager /></LS>} />
                  <Route path="/super/experts" element={<LS><GlobalExpertManagerPage /></LS>} />
                </Route>
              </Route>

              {/* --- PRIORITY 0.5: VENDOR PORTAL (L3) --- */}
              <Route path="/partner/login" element={<LS><VendorLoginPage /></LS>} />
              <Route path="/partner" element={<VendorPortalLayout />}>
                <Route index element={<LS><VendorDashboardPage /></LS>} />
                <Route path=":vendorId">
                  <Route index element={<LS><VendorDashboardPage /></LS>} />
                  <Route path="scanner">
                    <Route index element={<LS><VendorScannerIntroPage /></LS>} />
                    <Route path="camera" element={<LS><VendorScannerPage mode="camera" /></LS>} />
                    <Route path="external" element={<LS><VendorScannerPage mode="external" /></LS>} />
                  </Route>
                  <Route path="profile" element={<LS><VendorSettingsPage /></LS>} />
                  <Route path="staff" element={<LS><VendorStaffPage /></LS>} />
                   <Route path="notification" element={<LS><PartnerNotificationSettingsPage /></LS>} />
                   <Route path="audit-logs" element={<LS><VendorAuditLogsPage /></LS>} />
                 </Route>
              </Route>

              {/* --- PRIORITY 1: GLOBAL AUTH --- */}
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/portal" element={<NewAuthPortal />} />
              <Route path="/auth/recovery" element={<AccountRecoveryPage />} />

              {/* --- PRIORITY 2: MYPAGE (Hub) --- */}
              <Route path="/mypage" element={<LS><UserHubPage /></LS>} />
              <Route path="/mypage/membership" element={<LS><MembershipPaymentPage /></LS>} />

              {/* PAYMENT SUCCESS */}
              <Route path="/payment/success" element={<PaymentSuccessHandler />} />

              {/* TERMS & PRIVACY */}
              <Route path="/terms" element={<LS><TermsPage /></LS>} />
              <Route path="/privacy" element={<LS><PrivacyPage /></LS>} />

              {/* --- PRIORITY 3: BADGE (Specific Route FIRST) --- */}
              <Route path="/:slug/badge" element={<LS><StandAloneBadgePage /></LS>} />
              <Route path="/:slug/badge-prep/:token" element={<LS><BadgePrepPage /></LS>} />
              <Route path="/:slug/moderator/:token" element={<LS><ModeratorLivePage /></LS>} />

              {/* [Fix-Step 416-Dev] Smart Redirect for Conference MyPage */}
              <Route path="/:slug/mypage" element={<ConferenceMyPageRedirect />} />
              <Route path="/:slug/mypage/*" element={<ConferenceMyPageRedirect />} />

              {/* --- PRIORITY 4: SUB-AUTH --- */}
              <Route path="/:slug/auth" element={<NewAuthPortal />} />

              {/* --- PRIORITY 5: REGISTER --- */}
              <Route path="/:slug/register" element={<LS><RegistrationPage /></LS>} />
              <Route path="/:slug/register/success" element={<LS><RegistrationSuccessPage /></LS>} />

              {/* --- FALLBACK CONFERENCE ROUTES (Abstracts, Program) --- */}
              <Route path="/:slug/abstracts" element={<LS><AbstractSubmissionPage /></LS>} />
              <Route path="/:slug/program" element={<LS><ProgramPage /></LS>} />
              <Route path="/:slug/agenda" element={<LS><ProgramPage /></LS>} />
              <Route path="/:slug/vendors/:vid" element={<LS><VendorIntroPage /></LS>} />

              {/* --- PRIORITY 6: CONFERENCE LANDING (/2026spring, etc.) --- */}
              {/* Preview route must come before general slug route */}
              <Route path="/:slug/preview" element={<ConferencePreviewLoader />} />
              <Route path="/conference/:slug" element={<ConferenceLoader />} />
              <Route path="/conf/:slug" element={<ConferenceLoader />} />
              <Route path="/:slug" element={<ConferenceLoader />} />

              {/* --- FALLBACK --- */}
              <Route path="/" element={<LS><LandingPage /></LS>} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </div>
        </Router>
      </FeatureFlagProvider>
    </GlobalErrorBoundary>
  );
};

export default App;
