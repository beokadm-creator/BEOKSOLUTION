import React from 'react';

interface WideAboutProps {
  title: string;
  description: string;
}

export const WideAbout: React.FC<WideAboutProps> = ({ title, description }) => {
  return (
    <section className="max-w-4xl mx-auto text-center space-y-4">
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <p className="text-slate-600 leading-relaxed whitespace-pre-line">
        {description}
      </p>
    </section>
  );
};
