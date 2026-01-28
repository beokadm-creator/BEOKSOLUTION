import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../ui/button';
import { User, Globe } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useUserStore } from '../../store/userStore';

export const Header = () => {
  const navigate = useNavigate();
  const { auth } = useAuth('');
  const { language, setLanguage } = useUserStore();

  React.useEffect(() => {
    console.log("[Header] Auth state:", {
      loading: auth.loading,
      user: auth.user?.name || auth.user?.email,
      uid: auth.user?.uid,
      step: auth.step,
      error: auth.error
    });
  }, [auth.loading, auth.user, auth.step]);

  return (
    <header className="fixed top-0 w-full z-50 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center text-white pointer-events-auto">
            <div className="font-bold text-xl cursor-pointer font-mono" onClick={() => navigate('/')}>
                eRegi
            </div>
            <div className="flex items-center gap-4">
                {auth.loading ? (
                    <div className="w-20 h-9 animate-pulse bg-white/20 rounded-md" />
                ) : auth.user ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/mypage')}
                        className="text-white hover:bg-white/20 mr-2"
                    >
                        <User className="w-4 h-4 mr-2" />
                        {auth.user.name && auth.user.email
                            ? `${auth.user.name} (${auth.user.email})`
                            : auth.user.name || auth.user.email || 'My Page'}
                    </Button>
                ) : (
                    <>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => navigate('/auth?mode=login')} 
                            className="text-white hover:bg-white/20"
                        >
                            Log In
                        </Button>
                        <Button 
                            variant="default" 
                            size="sm" 
                            onClick={() => navigate('/auth?mode=signup')} 
                            className="bg-blue-600 hover:bg-blue-700 border-none"
                        >
                            Sign Up
                        </Button>
                    </>
                )}
                
                <Button variant="ghost" size="sm" onClick={() => setLanguage(language === 'ko' ? 'en' : 'ko')} className="text-white hover:bg-white/20">
                    <Globe className="w-4 h-4 mr-2" />
                    {language === 'ko' ? 'EN' : 'KR'}
                </Button>
            </div>
        </div>
    </header>
  );
};
export default Header;
