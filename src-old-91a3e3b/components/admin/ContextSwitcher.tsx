import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAdminStore } from '../../store/adminStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { ChevronsUpDown, Building2, Calendar, Plus } from 'lucide-react';
import { safeText } from '../../utils/safeText';
import { cn } from '../../lib/utils';

interface ConferenceOption {
  id: string;
  title: string;
  slug: string;
}

export default function ContextSwitcher() {
  const navigate = useNavigate();
  const { 
    selectedSocietyId, 
    selectedConferenceId, 
    enterConferenceMode, 
    exitConferenceMode 
  } = useAdminStore();
  
  const [conferences, setConferences] = useState<ConferenceOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Determine current active item
  // If selectedConferenceId is present, we are in Conference Mode
  // Otherwise, we are in Society HQ Mode
  const isConferenceMode = !!selectedConferenceId;

  // Fetch conferences when society ID is available
  useEffect(() => {
    // Fallback logic for society ID similar to other pages
    const getSocietyId = () => {
        if (selectedSocietyId) return selectedSocietyId;
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') return parts[0];
        if (hostname === 'localhost' || hostname === '127.0.0.1') return 'kap'; 
        return null;
    };

    const targetId = getSocietyId();
    if (!targetId) return;

    const fetchConferences = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'conferences'), where('societyId', '==', targetId));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          title: doc.data().title || 'Untitled Event',
          slug: doc.data().slug
        }));
        setConferences(list);
      } catch (error) {
        console.error("Error fetching conferences for switcher:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchConferences();
  }, [selectedSocietyId]);

  const handleSelectHQ = () => {
    exitConferenceMode();
    navigate('/admin/society');
  };

  const handleSelectConference = (conf: ConferenceOption) => {
    enterConferenceMode(conf.id, conf.slug, selectedSocietyId || 'kap', safeText(conf.title));
    navigate(`/admin/conf/${conf.id}`);
  };

  // Find current title
  const currentTitle = isConferenceMode 
    ? (conferences.find(c => c.id === selectedConferenceId)?.title ? safeText(conferences.find(c => c.id === selectedConferenceId)?.title) : 'Active Conference')
    : 'Society HQ';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="lg"
          className={cn(
            "w-full justify-between px-3 hover:bg-slate-100 transition-colors h-14",
            isConferenceMode ? "text-blue-700 bg-blue-50 hover:bg-blue-100" : "text-slate-700"
          )}
        >
          <div className="flex items-center gap-3 text-left overflow-hidden">
            <div className={cn(
                "p-1.5 rounded-md shrink-0",
                isConferenceMode ? "bg-blue-200 text-blue-700" : "bg-slate-200 text-slate-700"
            )}>
                {isConferenceMode ? <Calendar className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
            </div>
            <div className="flex flex-col overflow-hidden">
                <span className="font-bold text-sm truncate leading-none mb-1">{currentTitle}</span>
                <span className="text-xs opacity-70 truncate font-normal">
                    {isConferenceMode ? 'Event Mode' : 'Society Infrastructure'}
                </span>
            </div>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start" side="right">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Switch Context</DropdownMenuLabel>
        
        {/* Society HQ Option */}
        <DropdownMenuItem onClick={handleSelectHQ} className="gap-2 cursor-pointer p-3">
          <div className="p-1 rounded bg-slate-100">
             <Building2 className="w-4 h-4 text-slate-600" />
          </div>
          <div className="flex flex-col">
             <span className="font-medium">Society HQ</span>
             <span className="text-xs text-muted-foreground">Infrastructure & Users</span>
          </div>
          {!isConferenceMode && <span className="ml-auto text-xs text-green-600 font-bold">●</span>}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Conferences</DropdownMenuLabel>
        
        {/* Conference List */}
        <div className="max-h-60 overflow-y-auto">
            {conferences.map(conf => (
                <DropdownMenuItem 
                    key={conf.id} 
                    onClick={() => handleSelectConference(conf)}
                    className="gap-2 cursor-pointer p-2"
                >
                    <div className="p-1 rounded bg-blue-50">
                        <Calendar className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="truncate flex-1">{safeText(conf.title)}</span>
                    {selectedConferenceId === conf.id && <span className="ml-auto text-xs text-green-600 font-bold">●</span>}
                </DropdownMenuItem>
            ))}
            {conferences.length === 0 && !loading && (
                <div className="p-2 text-xs text-center text-muted-foreground">No conferences found.</div>
            )}
        </div>

        <DropdownMenuSeparator />
        
        <DropdownMenuItem className="gap-2 cursor-pointer text-muted-foreground hover:text-primary">
            <Plus className="w-4 h-4" />
            <span className="text-xs">Create New Event (Coming Soon)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
