'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Upload, Activity, Zap, Shield, Eye, Code, Accessibility,
  FileText, AlertTriangle, Monitor, Smartphone, Mail,
  ChevronRight, BarChart3, Palette, Link2, Type, Layers,
  Box, FileCode, Gauge,
} from 'lucide-react';
import { runFullAnalysis } from '@/lib/analyzers';
import { FullAnalysisResults, TabId } from '@/types';
import ScoreGauge from './ScoreGauge';
import FindingsList, { FindingSummaryBadges } from './FindingsList';
import CategoryCard from './CategoryCard';
import ClientPreview from './ClientPreview';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_CONTENT_LENGTH = 500000;

const tabs: { id: TabId; name: string; icon: React.ReactNode }[] = [
  { id: 'overview', name: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'deliverability', name: 'Deliverability', icon: <Shield className="w-4 h-4" /> },
  { id: 'content', name: 'Content', icon: <FileText className="w-4 h-4" /> },
  { id: 'compatibility', name: 'Compatibility', icon: <Layers className="w-4 h-4" /> },
  { id: 'code', name: 'Code Quality', icon: <Code className="w-4 h-4" /> },
  { id: 'accessibility', name: 'Accessibility', icon: <Accessibility className="w-4 h-4" /> },
];

export default function EmailTester() {
  const [emailContent, setEmailContent] = useState('');
  const [subjectLine, setSubjectLine] = useState('');
  const [preheader, setPreheader] = useState('');
  const [results, setResults] = useState<FullAnalysisResults | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setEmailContent(content);
      }
    };
    reader.onerror = () => setError('Error reading file');
    reader.readAsText(file);
  }, []);

  const analyzeEmail = useCallback(() => {
    setError(null);

    if (!subjectLine.trim()) {
      setError('Subject line is required');
      return;
    }
    if (!emailContent.trim()) {
      setError('Email content is required');
      return;
    }
    if (emailContent.length > MAX_CONTENT_LENGTH) {
      setError('Email content exceeds maximum size');
      return;
    }

    setIsAnalyzing(true);
    setTimeout(() => {
      try {
        const analysisResults = runFullAnalysis(emailContent, subjectLine, preheader);
        setResults(analysisResults);
        setActiveTab('overview');
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred during analysis');
      } finally {
        setIsAnalyzing(false);
      }
    }, 100);
  }, [subjectLine, emailContent, preheader]);

  // Gather all findings for summary counts
  const allFindings = results
    ? Object.values(results)
        .filter(v => v && typeof v === 'object' && 'findings' in v)
        .flatMap((v: { findings: unknown[] }) => v.findings as { severity: string }[])
    : [];
  const criticalCount = allFindings.filter(f => f.severity === 'critical').length;
  const warningCount = allFindings.filter(f => f.severity === 'warning').length;
  const passCount = allFindings.filter(f => f.severity === 'pass').length;
  const infoCount = allFindings.filter(f => f.severity === 'info').length;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e8f4fc 100%)' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#0167b4' }}>
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-black">Email Verifier</h1>
              <p className="text-xs text-gray-500">2026 Best Practices &bull; Deliverability &bull; Compatibility</p>
            </div>
          </div>
          {results && (
            <div className="flex items-center gap-4">
              <ScoreGauge score={results.overall} size={48} />
              <div className="hidden sm:block text-right">
                <div className="text-sm font-semibold text-black">Score: {results.overall}/100</div>
                <div className="text-xs text-gray-500">
                  {results.overall >= 80 ? 'Ready to send' : results.overall >= 60 ? 'Needs improvement' : 'Review required'}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Input Panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-bold text-black mb-5 flex items-center gap-2">
            <FileCode className="w-5 h-5" style={{ color: '#0167b4' }} />
            Email Input
          </h2>

          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-red-800 text-sm">Error</div>
                <div className="text-sm text-red-700">{error}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
            {/* Subject line */}
            <div className="lg:col-span-2">
              <label htmlFor="subject-line" className="block text-sm font-semibold text-black mb-1.5">
                Subject Line <span className="text-red-500">*</span>
              </label>
              <input
                id="subject-line"
                type="text"
                value={subjectLine}
                onChange={(e) => setSubjectLine(e.target.value.substring(0, 200))}
                placeholder="Enter email subject line..."
                maxLength={200}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': '#0167b4' } as React.CSSProperties}
              />
              <div className="text-xs text-gray-500 mt-1 text-right">{subjectLine.length}/200</div>
            </div>

            {/* Preheader */}
            <div>
              <label htmlFor="preheader" className="block text-sm font-semibold text-black mb-1.5">
                Preheader
              </label>
              <input
                id="preheader"
                type="text"
                value={preheader}
                onChange={(e) => setPreheader(e.target.value.substring(0, 150))}
                placeholder="Preview text..."
                maxLength={150}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': '#0167b4' } as React.CSSProperties}
              />
              <div className="text-xs text-gray-500 mt-1 text-right">{preheader.length}/150</div>
            </div>
          </div>

          {/* Upload + Textarea */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="email-content" className="block text-sm font-semibold text-black">
                Email HTML Content <span className="text-red-500">*</span>
              </label>
              <label
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition text-sm font-medium border"
                style={{ background: '#e8f4fc', color: '#0167b4', borderColor: '#b8ddf7' }}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload HTML/EML
                <input
                  type="file"
                  accept=".html,.htm,.eml"
                  onChange={handleFileUpload}
                  className="hidden"
                  aria-label="Upload HTML or EML file"
                />
              </label>
            </div>
            <textarea
              id="email-content"
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              placeholder="Paste your HTML email content here, or upload a file above..."
              rows={12}
              maxLength={MAX_CONTENT_LENGTH}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg font-mono text-sm leading-relaxed resize-y focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': '#0167b4' } as React.CSSProperties}
            />
            <div className="text-xs text-gray-500 mt-1 text-right">
              {emailContent.length.toLocaleString()}/{MAX_CONTENT_LENGTH.toLocaleString()} characters
            </div>
          </div>

          {/* Analyze Button */}
          <button
            onClick={analyzeEmail}
            disabled={!subjectLine || !emailContent || isAnalyzing}
            className="w-full text-white py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm text-base"
            style={{ background: isAnalyzing ? '#015a9e' : '#0167b4' }}
            onMouseEnter={(e) => { if (!isAnalyzing) e.currentTarget.style.background = '#015a9e'; }}
            onMouseLeave={(e) => { if (!isAnalyzing) e.currentTarget.style.background = '#0167b4'; }}
          >
            {isAnalyzing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Gauge className="w-5 h-5" />
                Run Complete Analysis
              </>
            )}
          </button>
        </div>

        {/* Results Dashboard */}
        {results && (
          <div ref={resultsRef} className="space-y-6">
            {/* Score Hero */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="text-center md:text-left">
                  <h2 className="text-2xl font-bold text-black mb-2">Email Health Score</h2>
                  <p className="text-gray-600 text-base mb-4">
                    {results.overall >= 80
                      ? 'Excellent — this email is ready to send'
                      : results.overall >= 60
                      ? 'Good — review the warnings below before sending'
                      : 'Needs work — address the critical issues before sending'}
                  </p>
                  <div className="flex gap-3 flex-wrap justify-center md:justify-start">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-red-100 text-red-700">
                      {criticalCount} Critical
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-amber-100 text-amber-700">
                      {warningCount} Warnings
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold" style={{ background: '#e8f4fc', color: '#0167b4' }}>
                      {infoCount} Info
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-green-100 text-green-700">
                      {passCount} Passed
                    </span>
                  </div>
                </div>
                <ScoreGauge score={results.overall} size={180} label="Overall Score" />
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="flex border-b border-gray-200 overflow-x-auto">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-5 py-3.5 font-semibold whitespace-nowrap transition-all text-sm border-b-2 ${
                      activeTab === tab.id
                        ? 'border-b-2 text-black'
                        : 'border-transparent text-gray-500 hover:text-black hover:bg-gray-50'
                    }`}
                    style={activeTab === tab.id ? { borderColor: '#0167b4', background: '#f0f7fd' } : {}}
                  >
                    {tab.icon}
                    {tab.name}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <CategoryCard
                      title="Deliverability"
                      result={{
                        findings: [...results.deliverability.findings, ...results.spam.findings],
                        score: Math.round((results.deliverability.score + results.spam.score) / 2),
                      }}
                      icon={<Shield className="w-5 h-5" />}
                      onClick={() => setActiveTab('deliverability')}
                    />
                    <CategoryCard
                      title="Subject & Content"
                      result={{
                        findings: [...results.subject.findings, ...results.preheader.findings, ...results.cta.findings],
                        score: Math.round((results.subject.score + results.preheader.score + results.content.score + results.cta.score) / 4),
                      }}
                      icon={<FileText className="w-5 h-5" />}
                      onClick={() => setActiveTab('content')}
                    />
                    <CategoryCard
                      title="Compatibility"
                      result={{
                        findings: [...results.darkMode.findings, ...results.responsive.findings, ...results.interactiveElements.findings, ...results.outlookCompat.findings],
                        score: Math.round((results.darkMode.score + results.responsive.score + results.interactiveElements.score + results.outlookCompat.score) / 4),
                      }}
                      icon={<Layers className="w-5 h-5" />}
                      onClick={() => setActiveTab('compatibility')}
                    />
                    <CategoryCard
                      title="Code Quality"
                      result={{
                        findings: [...results.codeQuality.findings, ...results.emailWeight.findings],
                        score: Math.round((results.codeQuality.score + results.emailWeight.score) / 2),
                      }}
                      icon={<Code className="w-5 h-5" />}
                      onClick={() => setActiveTab('code')}
                    />
                    <CategoryCard
                      title="Accessibility"
                      result={results.accessibility}
                      icon={<Accessibility className="w-5 h-5" />}
                      onClick={() => setActiveTab('accessibility')}
                    />
                    <CategoryCard
                      title="AI Summary"
                      result={results.aiSummary}
                      icon={<Zap className="w-5 h-5" />}
                      onClick={() => setActiveTab('content')}
                    />
                  </div>
                )}

                {/* Deliverability Tab */}
                {activeTab === 'deliverability' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-bold text-black mb-3 flex items-center gap-2 text-base">
                        <Shield className="w-5 h-5" style={{ color: '#0167b4' }} /> Spam Risk
                      </h3>
                      <div className={`p-4 rounded-xl border-2 mb-4 text-center ${
                        results.spam.meta.spamColor === 'green' ? 'bg-green-50 border-green-300' :
                        results.spam.meta.spamColor === 'yellow' ? 'bg-amber-50 border-amber-300' :
                        'bg-red-50 border-red-300'
                      }`}>
                        <div className={`text-3xl font-bold mb-1 ${
                          results.spam.meta.spamColor === 'green' ? 'text-green-600' :
                          results.spam.meta.spamColor === 'yellow' ? 'text-amber-600' :
                          'text-red-600'
                        }`}>
                          {results.spam.meta.spamRating}
                        </div>
                        <div className="text-sm text-black">Score: {results.spam.meta.spamScore} points</div>
                      </div>
                      <FindingsList findings={results.spam.findings} />
                    </div>
                    <div>
                      <h3 className="font-bold text-black mb-3 flex items-center gap-2 text-base">
                        <Mail className="w-5 h-5" style={{ color: '#0167b4' }} /> Deliverability
                      </h3>
                      <FindingsList findings={results.deliverability.findings} />

                      <div className="mt-6 rounded-xl p-4 border" style={{ background: '#f0f7fd', borderColor: '#b8ddf7' }}>
                        <h4 className="font-semibold text-black mb-2 text-sm">2026 Deliverability Checklist</h4>
                        <ul className="text-sm text-black space-y-1.5">
                          <li>&bull; <strong>DKIM, SPF, DMARC:</strong> Authentication is mandatory for inbox placement</li>
                          <li>&bull; <strong>One-Click Unsubscribe:</strong> Required by Gmail &amp; Yahoo for bulk senders (RFC 8058)</li>
                          <li>&bull; <strong>List-Unsubscribe header:</strong> Must include both mailto: and https: options</li>
                          <li>&bull; <strong>BIMI:</strong> Brand logo display requires DMARC enforcement + VMC certificate</li>
                          <li>&bull; <strong>Spam rate:</strong> Keep below 0.1% or risk throttling</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Content Tab */}
                {activeTab === 'content' && (
                  <div className="space-y-6">
                    {/* AI Summary Preview */}
                    <div className="rounded-xl p-6 border" style={{ background: 'linear-gradient(135deg, #f5f0ff 0%, #f0f7fd 100%)', borderColor: '#d8b4fe' }}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-black flex items-center gap-2 text-base">
                          <Zap className="w-5 h-5 text-purple-600" /> AI-Generated Summary Preview
                        </h3>
                        <ScoreGauge score={results.aiSummary.score} size={48} />
                      </div>
                      <p className="text-sm text-black mb-4">
                        Gmail, Outlook, and Apple Mail use AI to generate email summaries. This is how your email may appear:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Smartphone className="w-4 h-4" style={{ color: '#0167b4' }} />
                            <span className="text-sm font-semibold text-black">Mobile (180 chars)</span>
                          </div>
                          <div className="bg-gray-50 p-3 rounded border-l-4 border-purple-500">
                            <div className="text-xs text-gray-500 mb-1">AI-generated</div>
                            <div className="text-sm text-black italic">&ldquo;{results.aiSummary.meta.mobileAISummary}&rdquo;</div>
                          </div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Monitor className="w-4 h-4" style={{ color: '#0167b4' }} />
                            <span className="text-sm font-semibold text-black">Desktop (250 chars)</span>
                          </div>
                          <div className="bg-gray-50 p-3 rounded border-l-4" style={{ borderColor: '#0167b4' }}>
                            <div className="text-xs text-gray-500 mb-1">AI-generated</div>
                            <div className="text-sm text-black italic">&ldquo;{results.aiSummary.meta.desktopAISummary}&rdquo;</div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <FindingsList findings={results.aiSummary.findings} />
                      </div>
                    </div>

                    {/* Subject + Preheader + Content + CTA */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-6">
                        <div>
                          <h3 className="font-bold text-black mb-3 flex items-center gap-2 text-base">
                            <Mail className="w-5 h-5" style={{ color: '#0167b4' }} /> Subject Line
                          </h3>
                          <FindingsList findings={results.subject.findings} />
                        </div>
                        <div>
                          <h3 className="font-bold text-black mb-3 flex items-center gap-2 text-base">
                            <FileText className="w-5 h-5" style={{ color: '#0167b4' }} /> Preheader
                          </h3>
                          <FindingsList findings={results.preheader.findings} />
                        </div>
                        <div>
                          <h3 className="font-bold text-black mb-3 flex items-center gap-2 text-base">
                            <Activity className="w-5 h-5" style={{ color: '#0167b4' }} /> Content Quality
                          </h3>
                          <FindingsList findings={results.content.findings} />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-black mb-3 flex items-center gap-2 text-base">
                          <ChevronRight className="w-5 h-5" style={{ color: '#0167b4' }} /> CTA Analysis
                        </h3>

                        {/* CTA Stats */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="rounded-lg p-3 text-center border" style={{ background: '#f0f7fd', borderColor: '#b8ddf7' }}>
                            <div className="text-2xl font-bold" style={{ color: '#0167b4' }}>{results.cta.meta.ctas.length}</div>
                            <div className="text-xs text-black">Total</div>
                          </div>
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-green-600">{results.cta.meta.aboveFoldCTAs}</div>
                            <div className="text-xs text-black">Above Fold</div>
                          </div>
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-amber-600">{results.cta.meta.belowFoldCTAs}</div>
                            <div className="text-xs text-black">Below Fold</div>
                          </div>
                        </div>

                        {/* CTA list */}
                        {results.cta.meta.ctas.length > 0 && (
                          <div className="space-y-2 mb-4">
                            {results.cta.meta.ctas.map((cta, idx) => (
                              <div
                                key={idx}
                                className={`border rounded-lg p-3 text-sm ${
                                  cta.isAboveFold ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                                }`}
                              >
                                <div className="font-semibold text-black">{cta.text || '(no text)'}</div>
                                <div className="text-xs text-gray-500 truncate mt-0.5">{cta.href}</div>
                                <div className="flex gap-2 mt-1.5 text-xs text-gray-600">
                                  <span>#{cta.position}</span>
                                  <span className={cta.isAboveFold ? 'text-green-600 font-medium' : ''}>
                                    {cta.isAboveFold ? 'Above fold' : 'Below fold'}
                                  </span>
                                  {cta.hasButtonStyling && <span style={{ color: '#0167b4' }}>Button</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <FindingsList findings={results.cta.findings} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Compatibility Tab */}
                {activeTab === 'compatibility' && (
                  <div className="space-y-6">
                    <ClientPreview
                      content={emailContent}
                      subjectLine={subjectLine}
                      preheader={preheader}
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                      <div>
                        <h3 className="font-bold text-black mb-3 flex items-center gap-2 text-base">
                          <Palette className="w-5 h-5" style={{ color: '#0167b4' }} /> Dark Mode
                        </h3>
                        <FindingsList findings={results.darkMode.findings} />
                      </div>
                      <div>
                        <h3 className="font-bold text-black mb-3 flex items-center gap-2 text-base">
                          <Smartphone className="w-5 h-5" style={{ color: '#0167b4' }} /> Responsive Design
                        </h3>
                        <FindingsList findings={results.responsive.findings} />
                      </div>
                      <div>
                        <h3 className="font-bold text-black mb-3 flex items-center gap-2 text-base">
                          <Zap className="w-5 h-5" style={{ color: '#0167b4' }} /> AMP for Email
                        </h3>
                        <FindingsList findings={results.amp.findings} />
                      </div>
                      <div>
                        <h3 className="font-bold text-black mb-3 flex items-center gap-2 text-base">
                          <Box className="w-5 h-5" style={{ color: '#0167b4' }} /> Structured Data
                        </h3>
                        <FindingsList findings={results.structuredData.findings} />
                      </div>
                      <div>
                        <h3 className="font-bold text-black mb-3 flex items-center gap-2 text-base">
                          <Layers className="w-5 h-5" style={{ color: '#0167b4' }} /> Interactive Elements
                        </h3>
                        <FindingsList findings={results.interactiveElements.findings} />
                      </div>
                      <div className="lg:col-span-2">
                        <h3 className="font-bold text-black mb-3 flex items-center gap-2 text-base">
                          <Monitor className="w-5 h-5" style={{ color: '#0167b4' }} /> Outlook Compatibility
                        </h3>
                        <p className="text-xs text-gray-600 mb-3">Outlook 2007–2021 uses the Microsoft Word rendering engine with severely limited CSS support.</p>
                        <FindingsList findings={results.outlookCompat.findings} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Code Quality Tab */}
                {activeTab === 'code' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-bold text-black mb-3 flex items-center gap-2 text-base">
                        <Code className="w-5 h-5" style={{ color: '#0167b4' }} /> HTML &amp; CSS
                      </h3>
                      <FindingsList findings={results.codeQuality.findings} />
                    </div>
                    <div>
                      <h3 className="font-bold text-black mb-3 flex items-center gap-2 text-base">
                        <Gauge className="w-5 h-5" style={{ color: '#0167b4' }} /> Email Weight
                      </h3>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className={`border rounded-lg p-3 text-center ${results.emailWeight.meta.willBeClipped ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                          <div className={`text-2xl font-bold ${results.emailWeight.meta.willBeClipped ? 'text-red-600' : 'text-green-600'}`}>
                            {results.emailWeight.meta.htmlSizeKB}KB
                          </div>
                          <div className="text-xs text-black">HTML Size</div>
                        </div>
                        <div className="rounded-lg p-3 text-center border" style={{ background: '#f0f7fd', borderColor: '#b8ddf7' }}>
                          <div className="text-2xl font-bold" style={{ color: '#0167b4' }}>{results.emailWeight.meta.imageCount}</div>
                          <div className="text-xs text-black">Images</div>
                        </div>
                      </div>
                      <FindingsList findings={results.emailWeight.findings} />
                    </div>
                    <div>
                      <h3 className="font-bold text-black mb-3 flex items-center gap-2 text-base">
                        <Type className="w-5 h-5" style={{ color: '#0167b4' }} /> Font Stack
                      </h3>
                      <FindingsList findings={results.fontStack.findings} />
                    </div>
                    <div>
                      <h3 className="font-bold text-black mb-3 flex items-center gap-2 text-base">
                        <Link2 className="w-5 h-5" style={{ color: '#0167b4' }} /> Link Quality
                      </h3>
                      <FindingsList findings={results.linkQuality.findings} />
                    </div>
                  </div>
                )}

                {/* Accessibility Tab */}
                {activeTab === 'accessibility' && (
                  <div>
                    <FindingsList findings={results.accessibility.findings} />
                    <div className="mt-6 bg-purple-50 border border-purple-200 rounded-xl p-4">
                      <h4 className="font-semibold text-black mb-2 text-sm">WCAG 2.2 Email Guidelines</h4>
                      <ul className="text-sm text-black space-y-1.5">
                        <li>&bull; <strong>Alt text:</strong> All images must have descriptive alt attributes</li>
                        <li>&bull; <strong>Color contrast:</strong> 4.5:1 ratio minimum (AA standard)</li>
                        <li>&bull; <strong>Semantic HTML:</strong> Use proper heading hierarchy</li>
                        <li>&bull; <strong>Link text:</strong> Links should be descriptive, not &ldquo;click here&rdquo;</li>
                        <li>&bull; <strong>Language attribute:</strong> Set lang on &lt;html&gt; for screen readers</li>
                        <li>&bull; <strong>Table role:</strong> Use role=&ldquo;presentation&rdquo; on layout tables</li>
                        <li>&bull; <strong>Font size:</strong> Minimum 13px to prevent iOS auto-zoom</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
