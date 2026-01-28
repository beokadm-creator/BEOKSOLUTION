import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLoginPage from './pages/admin/auth/AdminLoginPage';
import SuperAdminPage from './pages/admin/SuperAdminPage';
import AdminGuard from './components/auth/AdminGuard';
import NewAuthPortal from './pages/auth/NewAuthPortal'; // Ensure this is the Clean UI
import UserHubPage from './pages/UserHubPage';
import StandAloneBadgePage from './pages/StandAloneBadgePage';
import FinalConferenceHome from './pages/FinalConferenceHome';
import RegistrationPage from './pages/RegistrationPage';
import CheckStatusPage from './pages/CheckStatusPage';
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
import ManualAdminWrapper from './components/admin/ManualAdminWrapper';
import SocietyDashboardPage from './pages/admin/SocietyDashboardPage';
import InfraPage from './pages/admin/InfraPage';
import IdentityPage from './pages/admin/IdentityPage';
import TemplatesPage from './pages/admin/TemplatesPage';
import MemberManagerPage from './pages/admin/MemberManagerPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import ConfigPage from './pages/admin/ConfigPage';
import DashboardPage from './pages/admin/DashboardPage';
import ConferenceSettingsPage from './pages/admin/ConferenceSettingsPage';
import RegistrationSettingsPage from './pages/admin/RegistrationSettingsPage';
import AttendanceSettingsPage from './pages/admin/AttendanceSettingsPage';
import AttendanceLivePage from './pages/admin/AttendanceLivePage';
import KioskScannerPage from './pages/admin/conference/attendance/KioskScannerPage';
import InfoDeskKioskPage from './pages/admin/conference/attendance/InfoDeskKioskPage';
import AgendaManager from './pages/admin/AgendaManager';
import RegistrationListPage from './pages/admin/RegistrationListPage';
import RegistrationDetailPage from './pages/admin/RegistrationDetailPage';
import PageEditor from './pages/admin/PageEditor';
import BadgeEditorPage from './pages/admin/BadgeEditorPage';
import AdminRefundPage from './pages/admin/AdminRefundPage';
import AbstractManagerPage from './pages/admin/AbstractManagerPage';
import InfoDeskPage from './pages/InfoDeskPage';
import AccessControlPage from './pages/AccessControlPage';
import SocietyLoginPage from './pages/SocietyLoginPage';
import LoadingSpinner from './components/common/LoadingSpinner';
import { ConferenceMyPageRedirect } from '@/components/common/ConferenceMyPageRedirect';
import { Toaster } from 'react-hot-toast';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

import LandingPage from './pages/LandingPage';
import KADDSpringLanding from './pages/2026spring/LandingPage';

import AdminLayout from './components/admin/AdminLayout';
import SecurityPolicyManager from './components/admin/SecurityPolicyManager';

const App: React.FC = () => {
  const hostname = window.location.hostname;

  // 1. ADMIN DOMAIN
  if (hostname.includes('admin.eregi') || hostname.startsWith('admin.')) {
    return (
      <Router>
        <div className="App font-sans text-slate-900">
          <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
          <Routes>
            <Route path="/login" element={<AdminLoginPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route element={<AdminGuard />}>
              <Route element={<AdminLayout />}>
                <Route path="/super" element={<SuperAdminPage />} />
                <Route path="/super/security" element={<SecurityPolicyManager />} />
              </Route>
              <Route path="*" element={<Navigate to="/super" />} />
            </Route>
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </div>
      </Router>
    );
  }

  // 2. USER DOMAIN (Main & Society)
  return (
    <Router>
      <div className="App font-sans text-slate-900">
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
        <Routes>
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
          
          {/* [Fix-Step 416-Dev] Smart Redirect for Conference MyPage */}
          <Route path="/:slug/mypage" element={<ConferenceMyPageRedirect />} />
          <Route path="/:slug/mypage/*" element={<ConferenceMyPageRedirect />} />

          {/* --- PRIORITY 4: SUB-AUTH --- */}
          <Route path="/:slug/auth" element={<NewAuthPortal />} />

          {/* --- PRIORITY 5: REGISTER --- */}
          <Route path="/:slug/register" element={<RegistrationPage />} />
          {/* [Fix-Step 314] Added Check Status Route */}
          <Route path="/:slug/check-status" element={<CheckStatusPage />} />
          <Route path="/:slug/register/success" element={<RegistrationSuccessPage />} />

          {/* --- FALLBACK CONFERENCE ROUTES (Abstracts, Program) --- */}
          <Route path="/:slug/abstracts" element={<AbstractSubmissionPage />} />
          <Route path="/:slug/program" element={<ProgramPage />} />

          {/* SOCIETY ADMIN ROUTES (Preserved) */}
          {/* [Report] This /admin/login route is for Society Admins (User Domain). 
              Super Admins/Platform Admins should use the admin.eregi.co.kr subdomain 
              which routes to AdminLoginPage (lines 58-74). 
          */}
          <Route path="/admin/login" element={<SocietyLoginPage />} />
          <Route element={<AdminGuard />}>
            <Route path="/admin/society" element={<ManualAdminWrapper><SocietyDashboardPage /></ManualAdminWrapper>} />
            <Route path="/admin/infra" element={<ManualAdminWrapper><InfraPage /></ManualAdminWrapper>} />
            <Route path="/admin/identity" element={<ManualAdminWrapper><IdentityPage /></ManualAdminWrapper>} />
            <Route path="/admin/templates" element={<ManualAdminWrapper><TemplatesPage /></ManualAdminWrapper>} />
            <Route path="/admin/members" element={<ManualAdminWrapper><MemberManagerPage /></ManualAdminWrapper>} />
            <Route path="/admin/users" element={<ManualAdminWrapper><AdminUsersPage /></ManualAdminWrapper>} />
            <Route path="/admin/config" element={<ManualAdminWrapper><ConfigPage /></ManualAdminWrapper>} />
            <Route path="/admin/conference/dashboard" element={<ManualAdminWrapper><DashboardPage /></ManualAdminWrapper>} />
            <Route path="/admin/conference/settings" element={<ManualAdminWrapper><ConferenceSettingsPage /></ManualAdminWrapper>} />
            <Route path="/admin/conference/settings/registration" element={<ManualAdminWrapper><RegistrationSettingsPage /></ManualAdminWrapper>} />
            <Route path="/admin/conference/attendance/settings" element={<ManualAdminWrapper><AttendanceSettingsPage /></ManualAdminWrapper>} />
            <Route path="/admin/conference/attendance/live" element={<ManualAdminWrapper><AttendanceLivePage /></ManualAdminWrapper>} />
            <Route path="/admin/conference/attendance/scanner" element={<ManualAdminWrapper><KioskScannerPage /></ManualAdminWrapper>} />
            <Route path="/admin/conference/attendance/infodesk" element={<ManualAdminWrapper><InfoDeskKioskPage /></ManualAdminWrapper>} />
            <Route path="/admin/conference/agenda" element={<ManualAdminWrapper><AgendaManager /></ManualAdminWrapper>} />
            <Route path="/admin/conference/registrations" element={<ManualAdminWrapper><RegistrationListPage /></ManualAdminWrapper>} />
            <Route path="/admin/conference/registrations/:id" element={<ManualAdminWrapper><RegistrationDetailPage /></ManualAdminWrapper>} />
            <Route path="/admin/conference/pages" element={<ManualAdminWrapper><PageEditor /></ManualAdminWrapper>} />
            <Route path="/admin/conference/badge-editor" element={<ManualAdminWrapper><BadgeEditorPage /></ManualAdminWrapper>} />
            <Route path="/admin/conference/refunds" element={<ManualAdminWrapper><AdminRefundPage /></ManualAdminWrapper>} />
            <Route path="/admin/abstracts" element={<ManualAdminWrapper><AbstractManagerPage /></ManualAdminWrapper>} />
            <Route path="/ops/info-desk" element={<InfoDeskPage />} />
            <Route path="/ops/access" element={<AccessControlPage />} />
            <Route path="/admin" element={<Navigate to="/admin/society" replace />} />
          </Route>

          {/* --- PRIORITY 6: CONFERENCE HOME (Generic Catch-all for slug) --- */}
          <Route path="/2026spring" element={<KADDSpringLanding />} />
          <Route path="/:slug/agenda" element={<ProgramPage />} />
          <Route path="/:slug" element={<FinalConferenceHome />} />

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
  );
};

export default App;
