import React from 'react';
import { useParams } from 'react-router-dom';
import ConferenceWideTemplate from '../../templates/ConferenceWideTemplate';
import { useSubdomain } from '../../hooks/useSubdomain';

const ConferenceLoader = () => {
  // 1. URL에서 slug 파라미터 추출 (예: kadd_2026spring)
  const { slug } = useParams<{ slug: string }>();
  
  // 2. 서브도메인 확인 (예: kadd)
  const { subdomain } = useSubdomain();

  // 3. 안전장치: slug가 없으면 에러 표시
  if (!slug) {
    return <div className="p-10 text-center text-red-500">잘못된 접근입니다. (Conference ID Missing)</div>;
  }

  // 4. 서브도메인이 있고 slug에 _가 없다면 학회 ID 결합 (예: kadd_2026spring)
  // 이는 서브도메인 접속 시 slug만으로는 문서를 찾지 못하는 문제를 해결함
  const finalSlug = (subdomain && !slug.includes('_')) 
    ? `${subdomain}_${slug}` 
    : slug;

  // 5. 데이터 로딩은 Template 내부에서 수행하므로, 여기서는 slug만 전달!
  return <ConferenceWideTemplate slug={finalSlug} />;
};

export default ConferenceLoader;
