'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Upload, Activity, Zap, Shield, Eye, Code, Accessibility,
  FileText, AlertTriangle, Monitor, Smartphone, Mail,
  ChevronRight, BarChart3, Palette, Link2, Type, Layers,
  Box, FileCode, Gauge, Wrench, BookOpen,
} from 'lucide-react';
import { runFullAnalysis } from '@/lib/analyzers';
import { Finding, FullAnalysisResults, TabId } from '@/types';
import ScoreGauge from './ScoreGauge';
import FindingsList, { FindingSummaryBadges } from './FindingsList';
import CategoryCard from './CategoryCard';
import ClientPreview from './ClientPreview';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_CONTENT_LENGTH = 500000;

// Maps issue keywords to actionable fix instructions with source references
function getFixInstruction(message: string): { fix: string; source: string; url: string } {
  const msg = message.toLowerCase();

  // Subject line fixes
  if (msg.includes('subject') && msg.includes('long')) return { fix: 'Shorten your subject line to under 50 characters. Move extra details to the preheader text instead.', source: 'Retention Science / Marketo', url: 'https://www.retentionscience.com/' };
  if (msg.includes('subject') && msg.includes('short')) return { fix: 'Add more descriptive text to your subject line. Aim for 30-50 characters that clearly convey the email\'s value.', source: 'Retention Science / Marketo', url: 'https://www.retentionscience.com/' };
  if (msg.includes('subject') && (msg.includes('emoji') || msg.includes('special char'))) return { fix: 'Remove emojis or special characters from the subject line — they can trigger spam filters and render inconsistently.', source: 'Campaign Monitor', url: 'https://www.campaignmonitor.com/resources/' };
  if (msg.includes('subject') && msg.includes('caps')) return { fix: 'Convert ALL CAPS words to normal casing. All-caps triggers spam filters and feels aggressive.', source: 'SpamAssassin SUBJECT_ALL_CAPS', url: 'https://spamassassin.apache.org/tests_3_4_x.html' };
  if (msg.includes('subject') && msg.includes('spam')) return { fix: 'Remove spam trigger words (free, act now, limited time, etc.) from your subject line. Use specific, value-driven language instead.', source: 'SpamAssassin / HubSpot', url: 'https://spamassassin.apache.org/tests_3_4_x.html' };
  if (msg.includes('subject') && msg.includes('word count')) return { fix: 'Aim for 6-10 words in your subject line for the best open rates.', source: 'Return Path', url: 'https://www.validity.com/everest/' };
  if (msg.includes('subject') && msg.includes('title case')) return { fix: 'Use sentence case instead of Title Case — it feels more personal and less promotional.', source: 'AWeber', url: 'https://www.aweber.com/blog/' };
  if (msg.includes('subject') && msg.includes('exclamation')) return { fix: 'Remove extra exclamation marks. Multiple exclamation marks trigger spam filters.', source: 'SpamAssassin', url: 'https://spamassassin.apache.org/tests_3_4_x.html' };
  if (msg.includes('subject') && msg.includes('re:') || msg.includes('fw:')) return { fix: 'Remove fake RE:/FW: prefixes. This is a known spam technique that erodes trust.', source: 'SpamAssassin FAKE_REPLY_C', url: 'https://spamassassin.apache.org/tests_3_4_x.html' };
  if (msg.includes('subject') && msg.includes('whitespace')) return { fix: 'Trim leading and trailing whitespace from your subject line.', source: 'QA best practice', url: '' };

  // Preheader fixes
  if (msg.includes('preheader') && (msg.includes('missing') || msg.includes('no preheader'))) return { fix: 'Add a preheader by inserting a hidden <span> immediately after the opening <body> tag:\n<span style="display:none;max-height:0;overflow:hidden;">Your preheader text here</span>', source: 'Litmus', url: 'https://www.litmus.com/blog' };
  if (msg.includes('preheader') && msg.includes('long')) return { fix: 'Shorten your preheader to 40-130 characters. After that length, email clients will pull in body text.', source: 'Litmus', url: 'https://www.litmus.com/blog' };
  if (msg.includes('preheader') && msg.includes('short')) return { fix: 'Extend your preheader to at least 40 characters. Add zero-width spaces (&zwnj;) after your text to prevent body text from bleeding in.', source: 'Litmus', url: 'https://www.litmus.com/blog' };
  if (msg.includes('preheader') && msg.includes('repeat')) return { fix: 'Make your preheader different from the subject line. Use it to add context or a secondary message.', source: 'Campaign Monitor', url: 'https://www.campaignmonitor.com/resources/' };

  // Alt text / images
  if (msg.includes('alt') && msg.includes('missing')) return { fix: 'Add descriptive alt="" attributes to every <img> tag. For decorative images, use alt="" (empty). For content images, describe what the image shows:\n<img src="hero.jpg" alt="Spring collection: 30% off all items" />', source: 'WCAG 2.2 (1.1.1)', url: 'https://www.w3.org/TR/WCAG22/' };
  if (msg.includes('alt') && msg.includes('decorat')) return { fix: 'For decorative/spacer images, set alt="" (empty string) and add role="presentation":\n<img src="spacer.gif" alt="" role="presentation" />', source: 'WCAG 2.2 (1.1.1)', url: 'https://www.w3.org/TR/WCAG22/' };
  if (msg.includes('images blocked') || msg.includes('image blocking')) return { fix: 'Add descriptive alt text and background colors behind images so the email is readable with images off. Use HTML text for key messages instead of image-only content.', source: 'Litmus', url: 'https://www.litmus.com/blog' };

  // Dark mode
  if (msg.includes('dark mode') && msg.includes('meta')) return { fix: 'Add dark mode meta tag in your <head>:\n<meta name="color-scheme" content="light dark">\n<meta name="supported-color-schemes" content="light dark">', source: 'Can I Email', url: 'https://www.caniemail.com/' };
  if (msg.includes('dark mode') || msg.includes('color-scheme')) return { fix: 'Add dark mode support:\n1. Add <meta name="color-scheme" content="light dark"> in <head>\n2. Add @media (prefers-color-scheme: dark) { } styles\n3. Use transparent backgrounds where possible\n4. Avoid dark text on images (it disappears on dark backgrounds)', source: 'Litmus / Can I Email', url: 'https://www.caniemail.com/' };

  // Responsive
  if (msg.includes('viewport') && msg.includes('missing')) return { fix: 'Add the viewport meta tag in your <head>:\n<meta name="viewport" content="width=device-width, initial-scale=1.0">', source: 'Email on Acid', url: 'https://www.emailonacid.com/blog/' };
  if (msg.includes('media quer') && msg.includes('missing')) return { fix: 'Add responsive media queries in your <style> block:\n@media only screen and (max-width: 600px) {\n  .container { width: 100% !important; }\n  .stack { display: block !important; width: 100% !important; }\n}', source: 'Can I Email', url: 'https://www.caniemail.com/' };
  if (msg.includes('responsive') || msg.includes('mobile')) return { fix: 'Make your email responsive: use max-width on containers, add media queries for screens under 600px, and use percentage-based widths. Stack columns vertically on mobile.', source: 'Litmus', url: 'https://www.litmus.com/blog' };

  // CTA fixes
  if (msg.includes('cta') && (msg.includes('missing') || msg.includes('no cta') || msg.includes('not found'))) return { fix: 'Add a clear call-to-action button using bulletproof HTML:\n<a href="https://example.com" style="background-color:#0167b4;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;font-weight:bold;">Shop Now</a>', source: 'Campaign Monitor', url: 'https://www.campaignmonitor.com/resources/' };
  if (msg.includes('cta') && msg.includes('above fold')) return { fix: 'Move your primary CTA higher in the email so it\'s visible without scrolling (within the first 350px). Place it immediately after your hero image or opening paragraph.', source: 'Nielsen Norman Group', url: 'https://www.nngroup.com/articles/' };
  if (msg.includes('cta') && msg.includes('button')) return { fix: 'Add button styling to your CTA links. Use padding, background-color, and border-radius inline styles. For Outlook support, wrap in VML:\n<!--[if mso]><v:roundrect><![endif]-->\n<a href="..." style="background:#0167b4;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">CTA Text</a>\n<!--[if mso]></v:roundrect><![endif]-->', source: 'Litmus / Email on Acid', url: 'https://www.litmus.com/blog' };

  // Spam
  if (msg.includes('spam') && msg.includes('word')) return { fix: 'Remove or rephrase spam trigger words. Replace "FREE" with "complimentary", "Act now" with a specific deadline, "Click here" with descriptive link text.', source: 'SpamAssassin / HubSpot', url: 'https://spamassassin.apache.org/tests_3_4_x.html' };
  if (msg.includes('text-to-image') || msg.includes('text to image') || msg.includes('image-heavy')) return { fix: 'Add more HTML text content. Aim for at least a 60:40 text-to-image ratio. Don\'t rely on images alone to convey your message.', source: 'Mailchimp', url: 'https://mailchimp.com/resources/' };
  if (msg.includes('unsubscribe') && msg.includes('missing')) return { fix: 'Add a visible unsubscribe link in your email footer and a List-Unsubscribe header. For 2026 compliance, include one-click unsubscribe (RFC 8058):\n<a href="https://example.com/unsubscribe">Unsubscribe</a>', source: 'RFC 8058 / Google Sender Guidelines', url: 'https://datatracker.ietf.org/doc/html/rfc8058' };

  // Accessibility
  if (msg.includes('lang') && msg.includes('missing')) return { fix: 'Add the lang attribute to your <html> tag:\n<html lang="en">', source: 'WCAG 2.2 (3.1.1)', url: 'https://www.w3.org/TR/WCAG22/' };
  if (msg.includes('role') && msg.includes('presentation')) return { fix: 'Add role="presentation" to all layout tables:\n<table role="presentation" cellpadding="0" cellspacing="0">', source: 'WCAG 2.2 / A11Y Project', url: 'https://www.a11yproject.com/checklist/' };
  if (msg.includes('heading') || msg.includes('h1') || msg.includes('h2') || msg.includes('h3')) return { fix: 'Use proper heading tags (h1, h2, h3) instead of styled divs/spans for headings. Maintain a logical hierarchy — don\'t skip from h1 to h3.', source: 'WCAG 2.2 (1.3.1)', url: 'https://www.w3.org/TR/WCAG22/' };
  if (msg.includes('font') && msg.includes('small')) return { fix: 'Increase font sizes to at least 14px for body text and 22px for headings. On iOS, text smaller than 13px triggers auto-zoom which breaks layout.', source: 'Nielsen Norman Group', url: 'https://www.nngroup.com/articles/' };
  if (msg.includes('contrast') || msg.includes('color ratio')) return { fix: 'Increase the contrast between text and background colors. Use a contrast checker tool — aim for at least 4.5:1 ratio for normal text (WCAG AA).', source: 'WCAG 2.2 (1.4.3) / WebAIM', url: 'https://webaim.org/resources/contrastchecker/' };
  if (msg.includes('link') && msg.includes('descriptive')) return { fix: 'Replace generic link text like "Click here" or "Read more" with descriptive text that explains where the link goes: "View the full report" or "Shop spring collection".', source: 'WCAG 2.2 (2.4.4)', url: 'https://www.w3.org/TR/WCAG22/' };
  if (msg.includes('semantic')) return { fix: 'Replace <div> and <span> tags used for structure with semantic HTML: <h1>-<h6> for headings, <p> for paragraphs, <ul>/<ol> for lists.', source: 'WCAG 2.2 (1.3.1)', url: 'https://www.w3.org/TR/WCAG22/' };

  // Code quality
  if (msg.includes('doctype') && msg.includes('missing')) return { fix: 'Add the HTML5 DOCTYPE at the very start of your email:\n<!DOCTYPE html>', source: 'Email on Acid', url: 'https://www.emailonacid.com/blog/' };
  if (msg.includes('inline') && msg.includes('css')) return { fix: 'Move CSS from <style> blocks to inline styles on each element. Use a CSS inliner tool (e.g., juice, premailer) to automate this. Some email clients strip <style> blocks entirely.', source: 'Can I Email', url: 'https://www.caniemail.com/' };
  if (msg.includes('mismatch') || msg.includes('unclosed') || msg.includes('closing tag')) return { fix: 'Fix the mismatched/unclosed HTML tags listed above. Every opening tag needs a matching closing tag. Self-closing tags like <img /> and <br /> don\'t need closing tags.', source: 'W3C Validator', url: 'https://validator.w3.org/' };
  if (msg.includes('deprecated') || msg.includes('obsolete')) return { fix: 'Replace deprecated HTML attributes with CSS equivalents. For example, use style="text-align:center" instead of align="center" on non-table elements.', source: 'Email on Acid', url: 'https://www.emailonacid.com/blog/' };
  if (msg.includes('table') && msg.includes('nested') && msg.includes('depth')) return { fix: 'Reduce table nesting depth. Deeply nested tables slow rendering and cause issues in Outlook. Aim for a maximum of 3-4 levels of nesting.', source: 'Microsoft Outlook Rendering', url: 'https://learn.microsoft.com/en-us/previous-versions/office/developer/o365-enterprise-dev/dn792009(v=office.15)' };

  // Email weight / clipping
  if (msg.includes('clip') || (msg.includes('size') && msg.includes('102'))) return { fix: 'Reduce your HTML to under 102KB to prevent Gmail clipping. Remove unnecessary whitespace, comments, and unused CSS. Minify your HTML before sending.', source: 'Google / Litmus', url: 'https://www.litmus.com/blog' };
  if (msg.includes('weight') || (msg.includes('size') && msg.includes('large'))) return { fix: 'Reduce email file size: minify HTML, compress images, remove unused CSS, and eliminate redundant wrapper elements.', source: 'Litmus', url: 'https://www.litmus.com/blog' };

  // Outlook
  if (msg.includes('outlook') && msg.includes('css')) return { fix: 'Outlook 2007-2021 uses Word\'s rendering engine. Use table-based layouts, inline CSS only, and avoid: float, position, flexbox, grid, background-image (use VML instead), margin on block elements.', source: 'Microsoft Outlook Rendering', url: 'https://learn.microsoft.com/en-us/previous-versions/office/developer/o365-enterprise-dev/dn792009(v=office.15)' };
  if (msg.includes('outlook') && msg.includes('conditional')) return { fix: 'Use Outlook conditional comments for Outlook-specific fixes:\n<!--[if mso]>\n  <table><tr><td>Outlook-only content</td></tr></table>\n<![endif]-->', source: 'Microsoft Outlook Rendering', url: 'https://learn.microsoft.com/en-us/previous-versions/office/developer/o365-enterprise-dev/dn792009(v=office.15)' };
  if (msg.includes('vml') || (msg.includes('outlook') && msg.includes('background'))) return { fix: 'For background images in Outlook, use VML:\n<!--[if mso]>\n<v:rect style="width:600px;height:300px" fill="true">\n<v:fill type="tile" src="bg.jpg" />\n<v:textbox>\n<![endif]-->\n  Your content here\n<!--[if mso]></v:textbox></v:rect><![endif]-->', source: 'Microsoft Outlook Rendering', url: 'https://learn.microsoft.com/en-us/previous-versions/office/developer/o365-enterprise-dev/dn792009(v=office.15)' };

  // AMP
  if (msg.includes('amp')) return { fix: 'AMP for Email enables interactive content. To add AMP, include a MIME part with content-type "text/x-amp-html" and register your sending domain with Google.', source: 'AMP for Email Spec', url: 'https://amp.dev/documentation/guides-and-tutorials/learn/email-spec/amp-email-format/' };

  // Structured data
  if (msg.includes('structured data') || msg.includes('schema')) return { fix: 'Add JSON-LD structured data in a <script type="application/ld+json"> block in <head>. Gmail supports schemas like EmailMessage, Order, Event, and Reservation for enhanced inbox cards.', source: 'Schema.org', url: 'https://schema.org/EmailMessage' };

  // Font stack
  if (msg.includes('font') && msg.includes('fallback')) return { fix: 'Add web-safe fallback fonts to your font-family declarations:\nfont-family: "Your Font", Arial, Helvetica, sans-serif;\nNever rely on a single custom font.', source: 'Can I Email', url: 'https://www.caniemail.com/' };
  if (msg.includes('web font') || msg.includes('@font-face')) return { fix: 'Web fonts only work in Apple Mail, iOS Mail, and some Android clients. Always include fallback fonts. Use @font-face in a <style> block, not a <link> tag.', source: 'Can I Email', url: 'https://www.caniemail.com/' };

  // Link quality
  if (msg.includes('http://') && msg.includes('https')) return { fix: 'Change all http:// links to https://. Non-secure links trigger spam filters and browser warnings.', source: 'Google Sender Guidelines', url: 'https://blog.google/products/gmail/gmail-security-authentication-spam-protection/' };
  if (msg.includes('broken') && msg.includes('link')) return { fix: 'Test all links before sending. Remove or fix any links with empty href, javascript:, or malformed URLs.', source: 'Email on Acid', url: 'https://www.emailonacid.com/blog/' };
  if (msg.includes('tracking') && msg.includes('link')) return { fix: 'Ensure tracking links resolve correctly. Overly long or suspicious-looking tracking URLs can trigger spam filters.', source: 'Validity / Return Path', url: 'https://www.validity.com/everest/' };

  // Interactive elements
  if (msg.includes('interactive') || msg.includes('form') || msg.includes('input')) return { fix: 'Interactive elements (forms, inputs) only work in a few email clients. Always provide a fallback link to a web version for clients that don\'t support them.', source: 'Can I Email', url: 'https://www.caniemail.com/' };

  // Generic fallback
  if (msg.includes('missing')) return { fix: 'Add the missing element referenced above to your email HTML.', source: '', url: '' };
  return { fix: 'Review the issue description above and update your email HTML accordingly. Check email client compatibility before sending.', source: '', url: '' };
}

interface FixItem {
  finding: Finding;
  fix: string;
  source: string;
  url: string;
}

interface FixCategory {
  name: string;
  icon: React.ReactNode;
  findings: FixItem[];
}


const tabs: { id: TabId; name: string; icon: React.ReactNode }[] = [
  { id: 'overview', name: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'deliverability', name: 'Deliverability', icon: <Shield className="w-4 h-4" /> },
  { id: 'content', name: 'Content', icon: <FileText className="w-4 h-4" /> },
  { id: 'compatibility', name: 'Compatibility', icon: <Layers className="w-4 h-4" /> },
  { id: 'code', name: 'Code Quality', icon: <Code className="w-4 h-4" /> },
  { id: 'accessibility', name: 'Accessibility', icon: <Accessibility className="w-4 h-4" /> },
  { id: 'fixes', name: 'Fixes', icon: <Wrench className="w-4 h-4" /> },
];

// Generate a stable DOM id from a finding message
function fixId(message: string): string {
  return 'fix-' + message.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '').slice(0, 60);
}

export default function EmailTester() {
  const [emailContent, setEmailContent] = useState('');
  const [subjectLine, setSubjectLine] = useState('');
  const [preheader, setPreheader] = useState('');
  const [results, setResults] = useState<FullAnalysisResults | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [scrollToFix, setScrollToFix] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Scroll to a specific fix card after switching to fixes tab
  useEffect(() => {
    if (scrollToFix && activeTab === 'fixes') {
      const timer = setTimeout(() => {
        const el = document.getElementById(scrollToFix);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-blue-400');
          setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400'), 2000);
        }
        setScrollToFix(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [scrollToFix, activeTab]);

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
          <div className="flex items-center gap-4">
            <Link
              href="/methodology"
              className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
              style={{ color: '#0167b4' }}
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Methodology</span>
            </Link>
            {results && (
              <>
                <ScoreGauge score={results.overall} size={48} />
                <div className="hidden sm:block text-right">
                  <div className="text-sm font-semibold text-black">Score: {results.overall}/100</div>
                  <div className="text-xs text-gray-500">
                    {results.overall >= 80 ? 'Ready to send' : results.overall >= 60 ? 'Needs improvement' : 'Review required'}
                  </div>
                </div>
              </>
            )}
          </div>
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
                    <button
                      onClick={() => setSeverityFilter(severityFilter === 'critical' ? null : 'critical')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                        severityFilter === 'critical' ? 'ring-2 ring-red-400 bg-red-200 text-red-800' : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      {criticalCount} Critical
                    </button>
                    <button
                      onClick={() => setSeverityFilter(severityFilter === 'warning' ? null : 'warning')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                        severityFilter === 'warning' ? 'ring-2 ring-amber-400 bg-amber-200 text-amber-800' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      }`}
                    >
                      {warningCount} Warnings
                    </button>
                    <button
                      onClick={() => setSeverityFilter(severityFilter === 'info' ? null : 'info')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all cursor-pointer"
                      style={{
                        background: severityFilter === 'info' ? '#cce5f5' : '#e8f4fc',
                        color: '#0167b4',
                        boxShadow: severityFilter === 'info' ? '0 0 0 2px #0167b4' : 'none',
                      }}
                    >
                      {infoCount} Info
                    </button>
                    <button
                      onClick={() => setSeverityFilter(severityFilter === 'pass' ? null : 'pass')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                        severityFilter === 'pass' ? 'ring-2 ring-green-400 bg-green-200 text-green-800' : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {passCount} Passed
                    </button>
                  </div>
                </div>
                <ScoreGauge score={results.overall} size={180} label="Overall Score" />
              </div>

              {/* Filtered findings list */}
              {severityFilter && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-black text-base">
                      All {severityFilter === 'critical' ? 'Critical' : severityFilter === 'warning' ? 'Warning' : severityFilter === 'info' ? 'Info' : 'Passed'} Findings
                    </h3>
                    <button
                      onClick={() => setSeverityFilter(null)}
                      className="text-sm text-gray-500 hover:text-black transition-colors"
                    >
                      Clear filter
                    </button>
                  </div>
                  {severityFilter !== 'pass' && (
                    <div className="mb-3">
                      <button
                        onClick={() => { setSeverityFilter(null); setActiveTab('fixes'); }}
                        className="text-sm font-semibold hover:underline inline-flex items-center gap-1"
                        style={{ color: '#0167b4' }}
                      >
                        <Wrench className="w-3.5 h-3.5" /> View all fixes →
                      </button>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {(allFindings.filter(f => f.severity === severityFilter) as Finding[]).map((finding, idx) => {
                      const isInfo = finding.severity === 'info';
                      const bgClass = finding.severity === 'critical' ? 'bg-red-50 border-red-200' : finding.severity === 'warning' ? 'bg-amber-50 border-amber-200' : finding.severity === 'pass' ? 'bg-green-50 border-green-200' : '';
                      const textClass = finding.severity === 'critical' ? 'text-red-800' : finding.severity === 'warning' ? 'text-amber-800' : finding.severity === 'pass' ? 'text-green-800' : 'text-black';
                      return (
                        <div
                          key={idx}
                          className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${isInfo ? '' : bgClass} ${severityFilter !== 'pass' ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}`}
                          style={isInfo ? { background: '#f0f7fd', borderColor: '#b8ddf7' } : {}}
                          onClick={severityFilter !== 'pass' ? () => { setSeverityFilter(null); setActiveTab('fixes'); setScrollToFix(fixId(finding.message)); } : undefined}
                        >
                          <div className="min-w-0 flex-1">
                            <div className={`text-sm font-semibold ${isInfo ? 'text-black' : textClass}`}>
                              {finding.message}
                            </div>
                            {finding.detail && (
                              <div className={`text-xs mt-0.5 opacity-80 ${isInfo ? 'text-black' : textClass}`}>
                                {finding.detail}
                              </div>
                            )}
                          </div>
                          {severityFilter !== 'pass' && (
                            <span className="text-xs flex-shrink-0 mt-0.5" style={{ color: '#0167b4' }}>
                              Fix →
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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

                {/* Fixes Tab */}
                {activeTab === 'fixes' && (() => {
                  const categories: FixCategory[] = [
                    { name: 'Deliverability & Spam', icon: <Shield className="w-5 h-5" style={{ color: '#0167b4' }} />, findings: [...results.deliverability.findings, ...results.spam.findings].filter(f => f.severity !== 'pass').map(f => ({ finding: f, ...getFixInstruction(f.message) })) },
                    { name: 'Subject & Preheader', icon: <Mail className="w-5 h-5" style={{ color: '#0167b4' }} />, findings: [...results.subject.findings, ...results.preheader.findings].filter(f => f.severity !== 'pass').map(f => ({ finding: f, ...getFixInstruction(f.message) })) },
                    { name: 'Content & CTAs', icon: <FileText className="w-5 h-5" style={{ color: '#0167b4' }} />, findings: [...results.content.findings, ...results.cta.findings].filter(f => f.severity !== 'pass').map(f => ({ finding: f, ...getFixInstruction(f.message) })) },
                    { name: 'AI Summary', icon: <Zap className="w-5 h-5" style={{ color: '#0167b4' }} />, findings: results.aiSummary.findings.filter(f => f.severity !== 'pass').map(f => ({ finding: f, ...getFixInstruction(f.message) })) },
                    { name: 'Dark Mode & Responsive', icon: <Palette className="w-5 h-5" style={{ color: '#0167b4' }} />, findings: [...results.darkMode.findings, ...results.responsive.findings].filter(f => f.severity !== 'pass').map(f => ({ finding: f, ...getFixInstruction(f.message) })) },
                    { name: 'Outlook Compatibility', icon: <Monitor className="w-5 h-5" style={{ color: '#0167b4' }} />, findings: results.outlookCompat.findings.filter(f => f.severity !== 'pass').map(f => ({ finding: f, ...getFixInstruction(f.message) })) },
                    { name: 'Code Quality & Weight', icon: <Code className="w-5 h-5" style={{ color: '#0167b4' }} />, findings: [...results.codeQuality.findings, ...results.emailWeight.findings].filter(f => f.severity !== 'pass').map(f => ({ finding: f, ...getFixInstruction(f.message) })) },
                    { name: 'Fonts & Links', icon: <Link2 className="w-5 h-5" style={{ color: '#0167b4' }} />, findings: [...results.fontStack.findings, ...results.linkQuality.findings].filter(f => f.severity !== 'pass').map(f => ({ finding: f, ...getFixInstruction(f.message) })) },
                    { name: 'Accessibility', icon: <Accessibility className="w-5 h-5" style={{ color: '#0167b4' }} />, findings: results.accessibility.findings.filter(f => f.severity !== 'pass').map(f => ({ finding: f, ...getFixInstruction(f.message) })) },
                    { name: 'AMP & Structured Data', icon: <Box className="w-5 h-5" style={{ color: '#0167b4' }} />, findings: [...results.amp.findings, ...results.structuredData.findings, ...results.interactiveElements.findings].filter(f => f.severity !== 'pass').map(f => ({ finding: f, ...getFixInstruction(f.message) })) },
                  ].map(c => ({
                    ...c,
                    findings: c.findings.sort((a, b) => {
                      const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
                      return (order[a.finding.severity] ?? 3) - (order[b.finding.severity] ?? 3);
                    }),
                  })).filter(c => c.findings.length > 0);

                  const totalIssues = categories.reduce((sum, c) => sum + c.findings.length, 0);
                  const criticals = categories.reduce((sum, c) => sum + c.findings.filter(f => f.finding.severity === 'critical').length, 0);
                  const warnings = categories.reduce((sum, c) => sum + c.findings.filter(f => f.finding.severity === 'warning').length, 0);

                  const severityBorder = (s: string) =>
                    s === 'critical' ? 'border-l-red-500' : s === 'warning' ? 'border-l-amber-500' : 'border-l-blue-400';
                  const severityBg = (s: string) =>
                    s === 'critical' ? 'bg-red-50' : s === 'warning' ? 'bg-amber-50' : '';
                  const severityLabel = (s: string) =>
                    s === 'critical' ? 'bg-red-100 text-red-700' : s === 'warning' ? 'bg-amber-100 text-amber-700' : 'text-blue-700';

                  return (
                    <div className="space-y-6">
                      {/* Summary bar */}
                      <div className="rounded-xl p-4 border flex items-center justify-between flex-wrap gap-3" style={{ background: '#f0f7fd', borderColor: '#b8ddf7' }}>
                        <div>
                          <h3 className="font-bold text-black text-base">
                            {totalIssues === 0 ? 'No issues found!' : `${totalIssues} issue${totalIssues === 1 ? '' : 's'} to fix`}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {totalIssues === 0
                              ? 'Your email passes all checks.'
                              : `${criticals} critical, ${warnings} warning${warnings === 1 ? '' : 's'}, ${totalIssues - criticals - warnings} info`}
                          </p>
                        </div>
                        <Wrench className="w-8 h-8" style={{ color: '#0167b4' }} />
                      </div>

                      {/* Fix cards by category */}
                      {categories.map((cat, catIdx) => (
                        <div key={catIdx}>
                          <h3 className="font-bold text-black mb-3 flex items-center gap-2 text-base">
                            {cat.icon} {cat.name}
                            <span className="text-xs font-normal text-gray-500">({cat.findings.length})</span>
                          </h3>
                          <div className="space-y-4">
                            {(['critical', 'warning', 'info'] as const).map(severity => {
                              const items = cat.findings.filter(f => f.finding.severity === severity);
                              if (items.length === 0) return null;
                              const groupLabel = severity === 'critical' ? 'Critical' : severity === 'warning' ? 'Warning' : 'Info';
                              const groupLabelColor = severity === 'critical' ? 'text-red-700' : severity === 'warning' ? 'text-amber-700' : '';
                              return (
                                <div key={severity}>
                                  <div
                                    className={`text-xs font-bold uppercase tracking-wider mb-2 ${groupLabelColor}`}
                                    style={severity === 'info' ? { color: '#0167b4' } : {}}
                                  >
                                    {groupLabel} ({items.length})
                                  </div>
                                  <div className="space-y-3">
                                    {items.map((item, idx) => (
                                      <div
                                        key={idx}
                                        id={fixId(item.finding.message)}
                                        className={`border rounded-lg overflow-hidden transition-all ${severityBg(item.finding.severity)}`}
                                      >
                                        <div className={`px-4 py-3 border-l-4 ${severityBorder(item.finding.severity)}`}>
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="text-sm font-semibold text-black">{item.finding.message}</div>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${severityLabel(item.finding.severity)}`}>
                                              {item.finding.severity}
                                            </span>
                                          </div>
                                          {item.finding.detail && (
                                            <div className="text-xs text-gray-600 mt-1">{item.finding.detail}</div>
                                          )}
                                        </div>
                                        <div className="px-4 py-3 bg-white border-t border-gray-100">
                                          <div className="flex items-start gap-2">
                                            <Wrench className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#0167b4' }} />
                                            <div className="text-sm text-black">
                                              <span className="font-semibold" style={{ color: '#0167b4' }}>Fix: </span>
                                              <span className="whitespace-pre-line">{item.fix}</span>
                                            </div>
                                          </div>
                                          {item.source && (
                                            <div className="mt-2 ml-6 text-xs text-slate-400">
                                              Source: {item.url ? (
                                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: '#0167b4' }}>{item.source}</a>
                                              ) : (
                                                <span>{item.source}</span>
                                              )}
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
                        </div>
                      ))}

                      {totalIssues === 0 && (
                        <div className="text-center py-12">
                          <div className="text-5xl mb-3">&#10003;</div>
                          <div className="text-lg font-bold text-black">All checks passed</div>
                          <div className="text-sm text-gray-500 mt-1">Your email follows all best practices.</div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
