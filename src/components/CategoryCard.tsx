'use client';

import { AnalysisResult } from '@/types';
import { FindingSummaryBadges } from './FindingsList';
import ScoreGauge from './ScoreGauge';

interface CategoryCardProps {
  title: string;
  result: AnalysisResult;
  icon: React.ReactNode;
  onClick?: () => void;
}

export default function CategoryCard({ title, result, icon, onClick }: CategoryCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left border-2 border-gray-200 rounded-xl p-5 hover:shadow-md transition-all bg-white"
      style={{ ['--hover-border' as string]: '#0167b4' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#b8ddf7'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div style={{ color: '#0167b4' }}>{icon}</div>
          <h3 className="font-semibold text-black">{title}</h3>
        </div>
        <ScoreGauge score={result.score} size={56} />
      </div>
      <FindingSummaryBadges findings={result.findings} />
    </button>
  );
}
