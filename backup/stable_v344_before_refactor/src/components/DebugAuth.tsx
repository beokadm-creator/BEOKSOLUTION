import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase'; // Ensure this points to your firebase config

export default function DebugAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-blue-600 text-white p-10 font-mono">
      <h1 className="text-3xl font-bold mb-4">🔵 AUTH DIAGNOSTIC SCREEN (FIREBASE)</h1>
      <div className="border p-4 bg-blue-800">
          <p><strong>Loading State:</strong> {String(loading)}</p>
          <p><strong>Current User (Email):</strong> {user ? user.email : "NULL (Logged Out)"}</p>
          <p><strong>UID:</strong> {user ? user.uid : "N/A"}</p>
          <p><strong>Email Verified:</strong> {user ? String(user.emailVerified) : "N/A"}</p>
      </div>
      <p className="mt-4">
          If User is NULL here right after login, 
          <strong>Firebase Auth Persistence is failing</strong> or cookies are blocked.
      </p>
      <div className="mt-4 flex gap-4">
        <button onClick={() => window.location.href = '/admin/login'} className="bg-white text-blue-800 p-2 rounded">
            Go to Login
        </button>
        <button onClick={() => window.location.reload()} className="border border-white text-white p-2 rounded">
            Reload Page
        </button>
      </div>
    </div>
  );
}