import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-10 rounded-2xl shadow-xl border border-gray-100 max-w-lg w-full text-center">
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-amber-500" />
        </div>

        <h1 className="text-4xl font-black text-gray-900 mb-2">404</h1>
        <h2 className="text-lg font-bold text-gray-700 mb-4">Page Not Found</h2>

        <p className="text-gray-500 mb-8 leading-relaxed">
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-8 text-left overflow-hidden">
          <p className="text-xs font-mono text-gray-400 uppercase mb-1">Requested URL</p>
          <p className="text-sm font-mono text-gray-600 break-all">{window.location.pathname}</p>
        </div>

        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate('/')} className="bg-blue-600 hover:bg-blue-700">
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}