'use client';

import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { Finding, Severity } from '@/types';

const severityConfig: Record<Severity, { icon: typeof XCircle; label: string; bg: string; border: string; text: string; iconColor: string; detailText: string }> = {
  critical: { icon: XCircle, label: 'Critical', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', iconColor: 'text-red-500', detailText: 'text-red-900' },
  warning: { icon: AlertTriangle, label: 'Warning', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', iconColor: 'text-amber-500', detailText: 'text-amber-900' },
  info: { icon: Info, label: 'Info', bg: '', border: '', text: '', iconColor: '', detailText: 'text-black' },
  pass: { icon: CheckCircle, label: 'Pass', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', iconColor: 'text-green-500', detailText: 'text-green-900' },
};

const severityOrder: Severity[] = ['critical', 'warning', 'info', 'pass'];

interface FindingsListProps {
  findings: Finding[];
  showEmpty?: boolean;
}

export default function FindingsList({ findings, showEmpty = false }: FindingsListProps) {
  const grouped = severityOrder.reduce<Record<Severity, Finding[]>>((acc, s) => {
    acc[s] = findings.filter(f => f.severity === s);
    return acc;
  }, { critical: [], warning: [], info: [], pass: [] });

  return (
    <div className="space-y-3">
      {severityOrder.map(severity => {
        const items = grouped[severity];
        if (items.length === 0 && !showEmpty) return null;
        if (items.length === 0) return null;

        const config = severityConfig[severity];
        const Icon = config.icon;

        // Info uses brand blue
        const isInfo = severity === 'info';

        return (
          <div key={severity}>
            <div
              className={`text-xs font-bold uppercase tracking-wider mb-1.5 ${isInfo ? '' : config.text}`}
              style={isInfo ? { color: '#0167b4' } : {}}
            >
              {config.label} ({items.length})
            </div>
            <div className="space-y-1.5">
              {items.map((finding, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${isInfo ? '' : `${config.bg} ${config.border}`}`}
                  style={isInfo ? { background: '#f0f7fd', borderColor: '#b8ddf7' } : {}}
                >
                  <Icon
                    className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isInfo ? '' : config.iconColor}`}
                    style={isInfo ? { color: '#0167b4' } : {}}
                  />
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-semibold ${isInfo ? 'text-black' : config.text}`}
                    >
                      {finding.message}
                    </div>
                    {finding.detail && (
                      <div className={`text-xs mt-0.5 ${isInfo ? 'text-black' : config.detailText} opacity-80`}>
                        {finding.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function FindingSummaryBadges({ findings }: { findings: Finding[] }) {
  const counts = {
    critical: findings.filter(f => f.severity === 'critical').length,
    warning: findings.filter(f => f.severity === 'warning').length,
    info: findings.filter(f => f.severity === 'info').length,
    pass: findings.filter(f => f.severity === 'pass').length,
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {counts.critical > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
          <XCircle className="w-3 h-3" /> {counts.critical}
        </span>
      )}
      {counts.warning > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
          <AlertTriangle className="w-3 h-3" /> {counts.warning}
        </span>
      )}
      {counts.info > 0 && (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ background: '#e8f4fc', color: '#0167b4' }}
        >
          <Info className="w-3 h-3" /> {counts.info}
        </span>
      )}
      {counts.pass > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
          <CheckCircle className="w-3 h-3" /> {counts.pass}
        </span>
      )}
    </div>
  );
}
