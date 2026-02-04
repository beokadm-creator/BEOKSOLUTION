import React from 'react'; 
import { useParams } from 'react-router-dom'; 
import ConferenceWideTemplate from '../../templates/ConferenceWideTemplate'; 

const ConferenceLoader = () => { 
  // 1. URL에서 slug 파라미터 추출 (예: kadd_2026spring) 
  const { slug } = useParams<{ slug: string }>(); 

  // 2. 안전장치: slug가 없으면 에러 표시 
  if (!slug) { 
    return <div className="p-10 text-center text-red-500">잘못된 접근입니다. (Conference ID Missing)</div>; 
  } 

  // 3. 데이터 로딩은 Template 내부에서 수행하므로, 여기서는 slug만 전달! 
  // (여기서 useTranslation을 호출하던 옛날 코드를 삭제함 -> 에러 해결) 
  return <ConferenceWideTemplate slug={slug} />; 
}; 

export default ConferenceLoader;
