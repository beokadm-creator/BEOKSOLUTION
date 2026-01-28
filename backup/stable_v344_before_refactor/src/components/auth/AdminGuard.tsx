import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../common/LoadingSpinner';

const AdminGuard: React.FC = () => {
  const { auth: { user, loading } } = useAuth();
  const location = useLocation();

  // [수정 5] Super Admin Bypass
  const SUPER_ADMINS = ['aaron@beoksolution.com', 'test@eregi.co.kr', 'any@eregi.co.kr'];
  if (location.pathname.startsWith('/super') && user && user.email && SUPER_ADMINS.includes(user.email)) {
      // Super admin passes immediately
      return <Outlet />;
  }

  if (loading) return <LoadingSpinner />;
  
  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <Outlet />; // Allow access to child routes (Admin Panel)
};
export default AdminGuard;
