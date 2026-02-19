import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSubdomain } from './hooks/useSubdomain';
import AdminLoginPage from './pages/admin/auth/AdminLoginPage';
import SuperAdminPage from './pages/admin/SuperAdminPage';
import AdminGuard from './components/auth/AdminGuard';
import AuthPage from './pages/auth/AuthPage';
import NewAuthPortal from './pages/auth/NewAuthPortal'; // Ensure this is Clean UI
import UserHubPage from './pages/UserHubPage';
import StandAloneBadgePage from './pages/StandAloneBadgePage';
import BadgePrepPage from './pages/BadgePrepPage';
import ConferenceLoader from './components/conference/ConferenceLoader';
import ConferencePreviewLoader from './components/conference/ConferencePreviewLoader';
import RegistrationPage from './pages/RegistrationPage';
import RegistrationSuccessPage from './pages/RegistrationSuccessPage';
import RegistrationFailPage from './pages/RegistrationFailPage';
import AbstractSubmissionPage from './pages/AbstractSubmissionPage';
import ProgramPage from './pages/ProgramPage';
import PaymentSuccessHandler from './components/payment/PaymentSuccessHandler';
import AccountRecoveryPage from './pages/auth/AccountRecoveryPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import NotFoundPage from './pages/NotFoundPage';
// import ManualAdminWrapper from './components/admin/ManualAdminWrapper';

import SocietyDashboardPage from './pages/admin/SocietyDashboardPage';
import InfraPage from './pages/admin/InfraPage';
import IdentityPage from './pages/admin/IdentityPage';
import TemplatesPage from './pages/admin/TemplatesPage';
import MemberManagerPage from './pages/admin/MemberManagerPage';
import MembershipFeeSettingsPage from './pages/admin/MembershipFeeSettingsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import SocietyContentManagementPage from './pages/admin/SocietyContentManagementPage';
import DashboardPage from './pages/admin/DashboardPage';
import ConferenceSettingsPage from './pages/admin/ConferenceSettingsPage';
import RegistrationSettingsPage from './pages/admin/RegistrationSettingsPage';
import AttendanceSettingsPage from './pages/admin/AttendanceSettingsPage';
import StatisticsPage from './pages/admin/StatisticsPage';
import AttendanceLivePage from './pages/admin/AttendanceLivePage';
import InfodeskPage from './pages/admin/conf/InfodeskPage';
import GatePage from './pages/admin/conf/GatePage';
import AgendaManager from './pages/admin/AgendaManager';
import SponsorManager from './pages/admin/SponsorManager';
import RegistrationListPage from './pages/admin/RegistrationListPage';
import RegistrationDetailPage from './pages/admin/RegistrationDetailPage';
import PageEditor from './pages/admin/PageEditor';
import BadgeEditorPage from './pages/admin/BadgeEditorPage';
import BadgeManagementPage from './pages/admin/BadgeManagementPage';
import AdminRefundPage from './pages/admin/AdminRefundPage';
import AbstractManagerPage from './pages/admin/AbstractManagerPage';
import ExternalAttendeePage from './pages/admin/ExternalAttendeePage';
import { OptionsManagementPage } from './pages/admin/OptionsManagementPage';
import { NoticesManager } from './pages/admin/notices/NoticesManager';
import SocietyLoginPage from './pages/SocietyLoginPage';
import MembershipPaymentPage from './pages/MembershipPaymentPage';
import MembershipPaymentLayout from './layouts/MembershipPaymentLayout';
import { ConferenceMyPageRedirect } from '@/components/common/ConferenceMyPageRedirect';
import { Toaster } from 'react-hot-toast';
import { GlobalErrorBoundary } from './components/common/GlobalErrorBoundary';

import LandingPage from './pages/LandingPage';
import SocietyLandingPage from './pages/SocietyLandingPage';
import VendorDashboard from './pages/vendor/VendorDashboard';

import SecurityPolicyManager from './components/admin/SecurityPolicyManager';

// New Layouts
import SuperLayout from './layouts/SuperLayout';
import SocietyLayout from './layouts/SocietyLayout';
import ConfLayout from './layouts/ConfLayout';
import VendorLayout from './layouts/VendorLayout';

const App: React.FC = () => {
  const { subdomain } = useSubdomain();
  const hostname = window.location.hostname;

  // 0. SOCIETY SUBDOMAIN (kadd.eregi.co.kr/ or kadd.eregi.co.kr/{slug})
  if (subdomain === 'kadd' || subdomain === 'kap') {
    return (
      <GlobalErrorBoundary>
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
                  <Route index element={<SocietyDashboardPage />} />
                  <Route path="content" element={<SocietyContentManagementPage />} />
                  <Route path="infra" element={<InfraPage />} />
                  <Route path="identity" element={<IdentityPage />} />
                  <Route path="templates" element={<TemplatesPage />} />
                  <Route path="members" element={<MemberManagerPage />} />
                  <Route path="membership-fees" element={<MembershipFeeSettingsPage />} />
                  <Route path="users" element={<AdminUsersPage />} />
                </Route>

                {/* L1: Society Layout */}
                <Route path="/admin/society/:sid" element={<SocietyLayout />}>
                  <Route index element={<SocietyDashboardPage />} />
                  <Route path="content" element={<SocietyContentManagementPage />} />
                  <Route path="infra" element={<InfraPage />} />
                  <Route path="identity" element={<IdentityPage />} />
                  <Route path="templates" element={<TemplatesPage />} />
                  <Route path="members" element={<MemberManagerPage />} />
                  <Route path="membership-fees" element={<MembershipFeeSettingsPage />} />
                  <Route path="users" element={<AdminUsersPage />} />
                </Route>

                {/* L2: Conference Layout */}
                <Route path="/admin/conf/:cid" element={<ConfLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="settings" element={<ConferenceSettingsPage />} />
                  <Route path="settings/registration" element={<RegistrationSettingsPage />} />
                  <Route path="settings/options" element={<OptionsManagementPage />} />
                  <Route path="attendance-settings" element={<AttendanceSettingsPage />} />
                  <Route path="statistics" element={<StatisticsPage />} />
                  <Route path="registrations" element={<RegistrationListPage />} />
                  <Route path="registrations/:regId" element={<RegistrationDetailPage />} />
                  <Route path="abstracts" element={<AbstractManagerPage />} />
                  <Route path="notices" element={<NoticesManager />} />
                  <Route path="agenda" element={<AgendaManager />} />
                  <Route path="sponsors" element={<SponsorManager />} />
                  <Route path="page-editor" element={<PageEditor />} />
                  <Route path="badge-editor" element={<BadgeEditorPage />} />
                  <Route path="badge-management" element={<BadgeManagementPage />} />
                  <Route path="refund" element={<AdminRefundPage />} />
                  <Route path="external-attendees" element={<ExternalAttendeePage />} />
                  {/* Attendance Routes */}
                  <Route path="attendance-live" element={<AttendanceLivePage />} />
                  <Route path="attendance-live/zone/:zoneId" element={<AttendanceLivePage />} />
                  {/* Attendance/Kiosk Routes (No Admin Guard - Device Access) */}
                  <Route path="gate" element={<GatePage />} />
                  <Route path="gate/zone/:zoneId" element={<GatePage />} />
                  <Route path="infodesk" element={<InfodeskPage />} />
                </Route>

                {/* L3: Vendor Layout */}
                <Route path="/admin/vendor/:vid" element={<VendorLayout />}>
                  <Route index element={<VendorDashboard />} />
                </Route>
              </Route>

              {/* --- PRIORITY 1: GLOBAL AUTH --- */}
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/portal" element={<NewAuthPortal />} />
              <Route path="/auth/recovery" element={<AccountRecoveryPage />} />

              {/* --- PRIORITY 2: MYPAGE (Hub) --- */}
              <Route path="/mypage" element={<UserHubPage />} />
              <Route path="/mypage/membership" element={
                <MembershipPaymentLayout>
                  <MembershipPaymentPage />
                </MembershipPaymentLayout>
              } />

              {/* --- PRIORITY 3: BADGE --- */}
              <Route path="/:slug/badge" element={<StandAloneBadgePage />} />
              <Route path="/:slug/badge-prep/:token" element={<BadgePrepPage />} />

              {/* --- PRIORITY 4: CONFERENCE-SPECIFIC ROUTES --- */}
              <Route path="/:slug/mypage" element={<ConferenceMyPageRedirect />} />
              <Route path="/:slug/mypage/*" element={<ConferenceMyPageRedirect />} />
              <Route path="/:slug/auth" element={<NewAuthPortal />} />
              <Route path="/:slug/register" element={<RegistrationPage />} />
              <Route path="/:slug/register/success" element={<RegistrationSuccessPage />} />
              <Route path="/:slug/register/fail" element={<RegistrationFailPage />} />
              <Route path="/:slug/register/fail" element={<RegistrationFailPage />} />
              <Route path="/:slug/abstracts" element={<AbstractSubmissionPage />} />
              <Route path="/:slug/program" element={<ProgramPage />} />
              <Route path="/:slug/agenda" element={<ProgramPage />} />
              <Route path="/:slug/terms" element={<TermsPage />} />
              <Route path="/:slug/privacy" element={<PrivacyPage />} />
              <Route path="/payment/success" element={<PaymentSuccessHandler />} />

              {/* --- PRIORITY 5: CONFERENCE LANDING (/2026spring, etc.) --- */}
              {/* Preview route must come before general slug route */}
              <Route path="/:slug/preview" element={<ConferencePreviewLoader />} />
              <Route path="/conference/:slug" element={<ConferenceLoader />} />
              <Route path="/conf/:slug" element={<ConferenceLoader />} />
              <Route path="/:slug" element={<ConferenceLoader />} />

              {/* --- PRIORITY 6: SOCIETY LANDING (ROOT) --- */}
              <Route path="/" element={<SocietyLandingPage />} />
            </Routes>
          </div>
        </Router>
      </GlobalErrorBoundary>
    );
  }

  // 1. ADMIN DOMAIN
  if (hostname.includes('admin.eregi') || hostname.startsWith('admin.')) {
    return (
      <GlobalErrorBoundary>
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
              <Route path="/login" element={<AdminLoginPage />} />
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route element={<AdminGuard />}>
                {/* L0: Super Layout */}
                <Route element={<SuperLayout />}>
                  <Route path="/super" element={<SuperAdminPage />} />
                  <Route path="/super/security" element={<SecurityPolicyManager />} />
                </Route>
                <Route path="*" element={<Navigate to="/super" />} />
              </Route>
              <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
          </div>
        </Router>
      </GlobalErrorBoundary>
    );
  }

  // 2. USER DOMAIN (Main & Society)
  return (
    <GlobalErrorBoundary>
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
                <Route path="/super" element={<SuperAdminPage />} />
                <Route path="/super/security" element={<SecurityPolicyManager />} />
              </Route>
            </Route>

            {/* --- PRIORITY 1: GLOBAL AUTH --- */}
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/portal" element={<NewAuthPortal />} />
            <Route path="/auth/recovery" element={<AccountRecoveryPage />} />

            {/* --- PRIORITY 2: MYPAGE (Hub) --- */}
            <Route path="/mypage" element={<UserHubPage />} />
            <Route path="/mypage/membership" element={<MembershipPaymentPage />} />

            {/* PAYMENT SUCCESS */}
            <Route path="/payment/success" element={<PaymentSuccessHandler />} />

            {/* TERMS & PRIVACY */}
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />

            {/* --- PRIORITY 3: BADGE (Specific Route FIRST) --- */}
            <Route path="/:slug/badge" element={<StandAloneBadgePage />} />
            <Route path="/:slug/badge-prep/:token" element={<BadgePrepPage />} />

            {/* [Fix-Step 416-Dev] Smart Redirect for Conference MyPage */}
            <Route path="/:slug/mypage" element={<ConferenceMyPageRedirect />} />
            <Route path="/:slug/mypage/*" element={<ConferenceMyPageRedirect />} />

            {/* --- PRIORITY 4: SUB-AUTH --- */}
            <Route path="/:slug/auth" element={<NewAuthPortal />} />

            {/* --- PRIORITY 5: REGISTER --- */}
            <Route path="/:slug/register" element={<RegistrationPage />} />
            <Route path="/:slug/register/success" element={<RegistrationSuccessPage />} />

            {/* --- FALLBACK CONFERENCE ROUTES (Abstracts, Program) --- */}
            <Route path="/:slug/abstracts" element={<AbstractSubmissionPage />} />
            <Route path="/:slug/program" element={<ProgramPage />} />
            <Route path="/:slug/agenda" element={<ProgramPage />} />

            {/* --- PRIORITY 6: CONFERENCE LANDING (/2026spring, etc.) --- */}
            {/* Preview route must come before general slug route */}
            <Route path="/:slug/preview" element={<ConferencePreviewLoader />} />
            <Route path="/conference/:slug" element={<ConferenceLoader />} />
            <Route path="/conf/:slug" element={<ConferenceLoader />} />
            <Route path="/:slug" element={<ConferenceLoader />} />

            {/* --- FALLBACK --- */}
            <Route path="/" element={<LandingPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </Router>
    </GlobalErrorBoundary>
  );
};

export default App;
