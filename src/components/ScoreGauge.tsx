'use client';

interface ScoreGaugeProps {
  score: number;
  size?: number;
  label?: string;
}

export default function ScoreGauge({ score, size = 160, label }: ScoreGaugeProps) {
  const strokeWidth = size < 80 ? 4 : 8;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 80 ? '#16a34a' :
    score >= 60 ? '#d97706' :
    '#dc2626';

  const bgColor =
    score >= 80 ? '#f0fdf4' :
    score >= 60 ? '#fffbeb' :
    '#fef2f2';

  // Scale font size relative to gauge size
  const scoreFontSize = size < 60 ? 14 : size < 100 ? 18 : size < 150 ? 28 : 36;
  const subFontSize = size < 80 ? 8 : 11;

  return (
    <div className="flex flex-col items-center flex-shrink-0">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill={bgColor}
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bold" style={{ color, fontSize: scoreFontSize }}>{score}</span>
          {size >= 60 && <span style={{ fontSize: subFontSize, color: '#6b7280' }}>/ 100</span>}
        </div>
      </div>
      {label && <div className="mt-2 text-sm font-semibold text-black">{label}</div>}
    </div>
  );
}
