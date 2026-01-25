import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLoginPage from './pages/admin/auth/AdminLoginPage';
import SuperAdminPage from './pages/admin/SuperAdminPage';
import AdminGuard from './components/auth/AdminGuard';
import NewAuthPortal from './pages/auth/NewAuthPortal'; // Ensure this is the Clean UI
import UserHubPage from './pages/UserHubPage';
import StandAloneBadgePage from './pages/StandAloneBadgePage';
import BadgePrepPage from './pages/BadgePrepPage';
import FinalConferenceHome from './pages/FinalConferenceHome';
import ConferenceLoader from './components/conference/ConferenceLoader';
import RegistrationPage from './pages/RegistrationPage';
import CheckStatusPage from './pages/CheckStatusPage';
import NonMemberHubPage from './pages/NonMemberHubPage';
import RegistrationSuccessPage from './pages/RegistrationSuccessPage';
import AbstractSubmissionPage from './pages/AbstractSubmissionPage';
import ProgramPage from './pages/ProgramPage';
import PaymentSuccessHandler from './components/payment/PaymentSuccessHandler';
import AccountRecoveryPage from './pages/auth/AccountRecoveryPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import NotFoundPage from './pages/NotFoundPage';
import SocietyLandingPage from './pages/SocietyLandingPage';
import PlatformHome from './pages/PlatformHome';
// import ManualAdminWrapper from './components/admin/ManualAdminWrapper';

import SocietyDashboardPage from './pages/admin/SocietyDashboardPage';
import InfraPage from './pages/admin/InfraPage';
import IdentityPage from './pages/admin/IdentityPage';
import TemplatesPage from './pages/admin/TemplatesPage';
import MemberManagerPage from './pages/admin/MemberManagerPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import DashboardPage from './pages/admin/DashboardPage';
import ConferenceSettingsPage from './pages/admin/ConferenceSettingsPage';
import RegistrationSettingsPage from './pages/admin/RegistrationSettingsPage';
import AttendanceSettingsPage from './pages/admin/AttendanceSettingsPage';
import StatisticsPage from './pages/admin/StatisticsPage';
import AttendanceLivePage from './pages/admin/AttendanceLivePage';
import InfodeskPage from './pages/admin/conf/InfodeskPage';
import GatePage from './pages/admin/conf/GatePage';
import AgendaManager from './pages/admin/AgendaManager';
import RegistrationListPage from './pages/admin/RegistrationListPage';
import RegistrationDetailPage from './pages/admin/RegistrationDetailPage';
import PageEditor from './pages/admin/PageEditor';
import BadgeEditorPage from './pages/admin/BadgeEditorPage';
import AdminRefundPage from './pages/admin/AdminRefundPage';
import AbstractManagerPage from './pages/admin/AbstractManagerPage';
import SocietyLoginPage from './pages/SocietyLoginPage';
import LoadingSpinner from './components/common/LoadingSpinner';
import { ConferenceMyPageRedirect } from '@/components/common/ConferenceMyPageRedirect';
import { Toaster } from 'react-hot-toast';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { GlobalErrorBoundary } from './components/common/GlobalErrorBoundary';

import LandingPage from './pages/LandingPage';
import VendorDashboard from './pages/vendor/VendorDashboard';

import SecurityPolicyManager from './components/admin/SecurityPolicyManager';

// New Layouts
import SuperLayout from './layouts/SuperLayout';
import SocietyLayout from './layouts/SocietyLayout';
import ConfLayout from './layouts/ConfLayout';
import VendorLayout from './layouts/VendorLayout';

import ConferenceWideTemplate from './templates/ConferenceWideTemplate';

// 🚀 [Helper] 도메인에 따라 DB ID를 결정하는 함수 
const getConferenceIdByDomain = () => { 
  const hostname = window.location.hostname; 

  // 1. KAP 도메인 접속 시 
  if (hostname.includes('kap.eregi')) { 
    return 'kap_2026Spring'; 
  } 
  
  // 2. KADD 도메인 접속 시 (기본값) 
  if (hostname.includes('kadd.eregi')) { 
    return 'kadd_2026spring'; 
  } 

  // 3. 로컬 개발환경(localhost) 또는 알 수 없는 도메인 
  // 개발 중에는 'kadd'를 기본으로 보여줌 
  return 'kadd_2026spring'; 
};

const App: React.FC = () => {
  // 🚀 [누락된 코드] 이 줄을 반드시 추가해야 합니다! 
  const targetSlug = getConferenceIdByDomain();
  const hostname = window.location.hostname;

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
            <Route path="/auth" element={<NewAuthPortal />} />
            <Route path="/portal" element={<NewAuthPortal />} />
            <Route path="/auth/recovery" element={<AccountRecoveryPage />} />

            {/* --- PRIORITY 2: MYPAGE (Hub) --- */}
            <Route path="/mypage" element={<UserHubPage />} />

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
            {/* [Fix-Step 314] Added Check Status Route */}
            <Route path="/:slug/check-status" element={<CheckStatusPage />} />
            {/* [v361] Non-Member Hub */}
            <Route path="/:slug/non-member/hub" element={<NonMemberHubPage />} />
            <Route path="/:slug/register/success" element={<RegistrationSuccessPage />} />

            {/* --- FALLBACK CONFERENCE ROUTES (Abstracts, Program) --- */}
            <Route path="/:slug/abstracts" element={<AbstractSubmissionPage />} />
            <Route path="/:slug/program" element={<ProgramPage />} />

            {/* SOCIETY ADMIN ROUTES (Refactored) */}
            <Route path="/admin/login" element={<SocietyLoginPage />} />
            <Route element={<AdminGuard />}>

              {/* L1: Society Layout (Subdomain Optimized) */}
              <Route path="/admin/society" element={<SocietyLayout />}>
                <Route index element={<SocietyDashboardPage />} />
                <Route path="infra" element={<InfraPage />} />
                <Route path="identity" element={<IdentityPage />} />
                <Route path="templates" element={<TemplatesPage />} />
                <Route path="members" element={<MemberManagerPage />} />
                <Route path="users" element={<AdminUsersPage />} />
              </Route>

              {/* L1: Society Layout */}
              <Route path="/admin/society/:sid" element={<SocietyLayout />}>
                <Route index element={<SocietyDashboardPage />} />
                <Route path="infra" element={<InfraPage />} />
                <Route path="identity" element={<IdentityPage />} />
                <Route path="templates" element={<TemplatesPage />} />
                <Route path="members" element={<MemberManagerPage />} />
                <Route path="users" element={<AdminUsersPage />} />
              </Route>

              {/* L2: Conference Layout */}
              <Route path="/admin/conf/:cid" element={<ConfLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="settings" element={<ConferenceSettingsPage />} />
                <Route path="settings/registration" element={<RegistrationSettingsPage />} />
                <Route path="attendance-settings" element={<AttendanceSettingsPage />} />
                <Route path="statistics" element={<StatisticsPage />} />
                <Route path="attendance-live" element={<AttendanceLivePage />} />

                {/* [V2] New Standardized Kiosk Routes */}
                <Route path="gate" element={<GatePage />} />
                <Route path="infodesk" element={<InfodeskPage />} />

                <Route path="agenda" element={<AgendaManager />} />
                <Route path="registrations" element={<RegistrationListPage />} />
                <Route path="registrations/:id" element={<RegistrationDetailPage />} />
                <Route path="pages" element={<PageEditor />} />
                <Route path="badge-editor" element={<BadgeEditorPage />} />
                <Route path="refunds" element={<AdminRefundPage />} />
                <Route path="abstracts" element={<AbstractManagerPage />} />
              </Route>

              {/* Legacy redirect for /admin/conference routes */}
              <Route path="/admin/conference/registrations/:id" element={<RegistrationDetailPage />} />

              {/* Legacy registration list redirect */}
              <Route path="/admin/conference/registrations" element={<RegistrationListPage />} />

              {/* L3: Vendor Layout */}
              <Route path="/admin/vendor/:vid" element={<VendorLayout />}>
                {/* <Route index element={<VendorDashboard />} /> */}
              </Route>

              {/* Legacy Redirects (Optional, for smooth transition) */}
              <Route path="/admin/society" element={<Navigate to="/admin/login" replace />} />

              {/* Ops Routes (Outside of Layouts?) */}
              <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
            </Route>

            {/* --- PRIORITY 6: CONFERENCE HOME (Dynamic Slug Handling) --- */}

            {/* Dynamic Routes: Template-based system */}
            <Route path="/conference/:slug" element={<ConferenceLoader />} />
            <Route path="/conf/:slug" element={<ConferenceLoader />} />
            
            {/* Existing Routes with slug parameter */}
            <Route path="/:slug/agenda" element={<ProgramPage />} />
            <Route path="/:slug/register" element={<RegistrationPage />} />
            <Route path="/:slug/check-status" element={<CheckStatusPage />} />
            <Route path="/:slug/non-member/hub" element={<NonMemberHubPage />} />
            <Route path="/:slug/registration-success" element={<RegistrationSuccessPage />} />
            <Route path="/:slug/abstracts" element={<AbstractSubmissionPage />} />
            <Route path="/:slug/terms" element={<TermsPage />} />
            <Route path="/:slug/privacy" element={<PrivacyPage />} />
            
            {/* Fallback: Use FinalConferenceHome for backward compatibility - BUT exclude admin */}
            <Route path="/admin" element={<Navigate to="/admin/login" replace />} />

            {/* Catch-all for conference slugs (must be last) */}
            <Route path="/:slug" element={<ConferenceLoader />} />

            {/* --- FALLBACK --- */}
            <Route path="/" element={
              (hostname === 'eregi.co.kr' || hostname.startsWith('www') || hostname.includes('localhost'))
                ? <LandingPage />
                : <SocietyLandingPage />
            } />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </Router>
    </GlobalErrorBoundary>
  );
};

export default App;
