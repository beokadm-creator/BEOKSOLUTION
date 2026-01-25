import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

export const useConferenceData = (slug: string) => {
  const [conference, setConference] = useState<any>(null);
  const [society, setSociety] = useState<any>(null);
  const [speakers, setSpeakers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      // [Fix-Step 318] Simplified Fetch Logic & State Separation
      const societyId = 'kadd'; 
      const docId = `${societyId}_${slug}`; 
      const collectionName = 'conferences';
      const path = `${collectionName}/${docId}`;

      try {
        // 1. Fetch Conference Main Doc
        const docRef = doc(db, collectionName, docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log("DEBUG RAW DB:", data.title); // [Fix-Step 326] Check if title is Map or String
          console.dir(data);
          
          // --- Fetch Sub-collections ---
          
          // Fees
          const feesRef = doc(db, `${path}/settings/registration`);
          const feesSnap = await getDoc(feesRef);
          let feesData: any[] = [];
          let periodsData: any[] = [];
          let refundPolicyData: string = "";

          if (feesSnap.exists()) {
              const regData = feesSnap.data();
              if (Array.isArray(regData.fees)) {
                  feesData = regData.fees;
              } else if (regData.prices) {
                  feesData = Object.entries(regData.prices).map(([name, amount]) => ({ name, amount, currency: 'KRW' }));
              }
              
              if (regData.periods) periodsData = regData.periods;
              if (regData.refundPolicy) refundPolicyData = regData.refundPolicy;
          }

          // Agendas
          const agendasRef = collection(db, `${path}/agendas`);
          const agendasSnap = await getDocs(agendasRef);
          const agendasData = agendasSnap.docs.map(d => {
              const dData = d.data();
              return {
                  id: d.id,
                  startTime: dData.startTime ? (dData.startTime.toDate ? dData.startTime.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : dData.startTime) : 'TBD',
                  title: dData.title?.ko || dData.title?.en || dData.title || 'Untitled Session',
                  speakers: dData.speakers ? (Array.isArray(dData.speakers) ? dData.speakers.join(', ') : dData.speakers) : '',
                  description: dData.description?.ko || dData.description?.en || ''
              };
          });

          // Speakers (Separate State)
          const speakersRef = collection(db, `${path}/speakers`);
          const speakersSnap = await getDocs(speakersRef);
          const speakersData = speakersSnap.docs.map(d => {
              const sData = d.data();
              return {
                  id: d.id,
                  name: sData.name?.ko || sData.name?.en || sData.name || 'Unknown',
                  affiliation: sData.affiliation?.ko || sData.affiliation?.en || sData.affiliation || '',
                  image: sData.image?.url || sData.photoUrl || null,
                  role: sData.role || 'Speaker'
              };
          });
          setSpeakers(speakersData);

          // Society (Separate State)
          const societyRef = doc(db, `societies/${societyId}`);
          const societySnap = await getDoc(societyRef);
          if (societySnap.exists()) {
              setSociety(societySnap.data());
          }

          // Construct Conference Object (Direct Mapping)
          const finalData = {
              ...data, // Spread raw data
              fees: feesData,
              periods: periodsData,
              refundPolicy: refundPolicyData,
              programs: agendasData
          };

          setConference(finalData);
        } else {
          console.warn('[DataFetch] Document not found at:', path);
          setError(`Conference not found`);
          setConference(null);
        }
      } catch (err: any) {
        console.error('[DataFetch] Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug]);

  return { conference, society, speakers, loading, error };
};