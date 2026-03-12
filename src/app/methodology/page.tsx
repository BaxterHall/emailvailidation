'use client';

import { ArrowLeft, Shield, Mail, Eye, Code, Accessibility, Zap, FileText, Palette, Link2, Type, Layers, Box, FileCode, Gauge, Monitor, BarChart3, Activity } from 'lucide-react';
import Link from 'next/link';

interface Check {
  name: string;
  threshold: string;
  source: string;
}

interface AnalyzerSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  checks: Check[];
}

const analyzers: AnalyzerSection[] = [
  {
    id: 'subject',
    title: '1. Subject Line',
    icon: <Mail className="w-5 h-5" />,
    checks: [
      { name: 'Length optimal', threshold: '41-50 chars ideal, >70 critical', source: 'Retention Science / Marketo open-rate data' },
      { name: 'Spam trigger words', threshold: '55+ words in 6 categories', source: 'SpamAssassin rules (FUZZY_FREE, GUARANTEED, URG_BIZ, STRONG_BUY, DEAR_FRIEND, WORK_AT_HOME, FUZZY_CREDIT, MORTGAGE) + HubSpot/Mailchimp/Campaign Monitor lists' },
      { name: 'ALL CAPS detection', threshold: 'Entire subject >5 chars', source: 'SpamAssassin SUBJECT_ALL_CAPS rule' },
      { name: 'Excessive exclamation marks', threshold: '>1', source: 'SpamAssassin punctuation rules' },
      { name: 'Emoji detection', threshold: 'Any emoji present', source: 'Industry best practice (informational)' },
      { name: 'Personalization tokens', threshold: '{{}}, %%, *||* patterns', source: 'Experian study: personalized subjects = 26% higher open rates' },
      { name: 'RE:/FW: prefix', threshold: 'Fake reply/forward detected', source: 'SpamAssassin FAKE_REPLY_C rule' },
      { name: 'Word count', threshold: '6-10 words optimal, <3 or >15 warning', source: 'Return Path open-rate research' },
      { name: 'Leading/trailing whitespace', threshold: 'Any stray whitespace', source: 'QA best practice' },
      { name: 'Special character spam', threshold: '$$$, ###, ***, etc.', source: 'SpamAssassin punctuation heuristics' },
      { name: 'Question usage', threshold: 'Contains ?', source: 'Yesware study: questions boost open rates ~10%' },
      { name: 'Number/statistic usage', threshold: 'Contains digits', source: 'Campaign Monitor: numbers boost open rates 57%' },
      { name: 'Title Case detection', threshold: 'All words >3 chars capitalized', source: 'AWeber research: sentence case feels more personal' },
    ],
  },
  {
    id: 'preheader',
    title: '2. Preheader',
    icon: <FileText className="w-5 h-5" />,
    checks: [
      { name: 'Length', threshold: '40-130 chars optimal', source: 'Litmus preheader research (Gmail: ~90 chars desktop, ~40 mobile)' },
      { name: 'Hidden preheader technique', threshold: 'display:none + class="preheader"', source: 'Litmus / Email on Acid recommendations' },
      { name: 'Duplicate of subject', threshold: 'Exact match comparison', source: 'Campaign Monitor best practice' },
    ],
  },
  {
    id: 'ai-summary',
    title: '3. AI Summary Readiness',
    icon: <Activity className="w-5 h-5" />,
    checks: [
      { name: 'Subject length for AI context', threshold: '<10 chars = critical', source: 'Apple Mail / Gmail AI summary feature behavior' },
      { name: 'Content sufficiency', threshold: '<100 chars = warning', source: 'General NLP minimum for meaningful extraction' },
      { name: 'Key highlights detection', threshold: 'Key phrases + numbers extracted', source: 'Apple Mail summarization patterns' },
      { name: 'Preheader contribution', threshold: '>20 chars = enhances summary', source: 'Apple Mail / Gmail AI summary behavior' },
    ],
  },
  {
    id: 'cta',
    title: '4. CTA Analysis',
    icon: <Zap className="w-5 h-5" />,
    checks: [
      { name: 'CTA presence', threshold: '0 CTAs = critical', source: 'Universal email marketing best practice' },
      { name: 'Above-fold placement', threshold: 'Pixel estimation, 400px threshold', source: 'Litmus / Email on Acid viewport data (Outlook ~300px, Gmail ~500px)' },
      { name: 'CTA count', threshold: '1-3 optimal, >5 warning', source: "Hick's Law (psychology) + Campaign Monitor / HubSpot click-through data" },
      { name: 'Vague CTA text', threshold: '"click here", "here", "link"', source: 'WCAG 2.2 link text guidelines + NN Group UX research' },
      { name: 'Bulletproof buttons (VML)', threshold: 'CSS buttons without VML fallback', source: 'Litmus Outlook rendering documentation' },
    ],
  },
  {
    id: 'content',
    title: '5. Content Quality',
    icon: <FileCode className="w-5 h-5" />,
    checks: [
      { name: '<html> tag present', threshold: 'Required', source: 'W3C HTML spec' },
      { name: '<body> tag present', threshold: 'Required', source: 'W3C HTML spec' },
      { name: '<head> tag present', threshold: 'Expected', source: 'W3C HTML spec' },
      { name: 'Unclosed <html>/<body>', threshold: 'Must close', source: 'W3C HTML spec' },
      { name: '<title> tag', threshold: 'Expected', source: 'Litmus: some clients display title in tabs' },
      { name: 'Link count', threshold: '>10 = warning', source: 'SpamAssassin URI rules + Campaign Monitor/Mailchimp guidelines' },
      { name: 'Text-to-image ratio', threshold: '<2:1 = warning', source: 'SpamAssassin HTML_IMAGE_ONLY_04/08 rules, industry standard 60:40' },
      { name: 'Word count', threshold: '50-300 pass, 75-125 optimal', source: 'Boomerang study (40M emails) + HubSpot / Campaign Monitor data' },
      { name: 'HTML minimum size', threshold: '<200 chars = critical', source: 'Structural minimum for valid email HTML' },
    ],
  },
  {
    id: 'spam',
    title: '6. Spam Analysis',
    icon: <Shield className="w-5 h-5" />,
    checks: [
      { name: 'Unsubscribe link', threshold: 'Required', source: 'CAN-SPAM Act (15 U.S.C. 7701-7713), CASL, GDPR' },
      { name: 'Physical address', threshold: 'Required (5 regex patterns)', source: 'CAN-SPAM Act — up to $51,744/email (FTC) + CASL — up to $10M/violation (CRTC)' },
      { name: 'Excessive caps', threshold: '>3 instances of 10+ caps', source: 'SpamAssassin CAPS rules' },
      { name: 'URL shorteners', threshold: 'bit.ly, tinyurl, goo.gl, etc.', source: 'SpamAssassin / Gmail phishing filters' },
      { name: 'Hidden text', threshold: '7 patterns (excludes preheader)', source: 'SpamAssassin INVISIBLE_TEXT rule' },
      { name: 'Excessive exclamation marks', threshold: '>5 in body', source: 'SpamAssassin punctuation scoring' },
      { name: 'Subject spam cross-check', threshold: '12 high-signal trigger words', source: 'SpamAssassin rules (re-scored in spam context)' },
    ],
  },
  {
    id: 'deliverability',
    title: '7. Deliverability',
    icon: <BarChart3 className="w-5 h-5" />,
    checks: [
      { name: 'List-Unsubscribe header', threshold: 'Detected or ESP merge tag', source: 'RFC 2369 + Gmail/Yahoo 2024 sender requirements' },
      { name: 'One-Click Unsubscribe', threshold: 'RFC 8058 compliance', source: 'RFC 8058 — required by Gmail and Yahoo for bulk senders (>5000/day)' },
      { name: 'BIMI', threshold: 'Informational only (DNS-based)', source: 'BIMI Group spec — requires DMARC p=quarantine/reject + VMC certificate' },
      { name: 'DKIM/SPF/DMARC', threshold: 'From EML authentication headers', source: 'RFC 6376 (DKIM), RFC 7208 (SPF), RFC 7489 (DMARC)' },
      { name: 'Sender reputation note', threshold: 'Informational', source: 'Validity/Return Path data: reputation = 70-80% of filtering decisions' },
    ],
  },
  {
    id: 'dark-mode',
    title: '8. Dark Mode',
    icon: <Palette className="w-5 h-5" />,
    checks: [
      { name: 'color-scheme meta tag', threshold: '<meta name="color-scheme">', source: 'Apple Mail / Outlook dark mode documentation' },
      { name: 'prefers-color-scheme media query', threshold: '@media (prefers-color-scheme: dark)', source: 'W3C Media Queries Level 5 spec' },
      { name: 'color-scheme CSS property', threshold: 'color-scheme: declaration', source: 'CSS Color Adjustment Module Level 1' },
      { name: 'Background color set', threshold: 'On body or wrapper', source: 'Litmus dark mode testing guide' },
      { name: 'Transparent PNG warning', threshold: '.png detected', source: 'Email on Acid dark mode design guide' },
    ],
  },
  {
    id: 'amp',
    title: '9. AMP for Email',
    icon: <Zap className="w-5 h-5" />,
    checks: [
      { name: 'AMP markup detection', threshold: 'amp4email / ⚡4email / AMP CDN', source: 'Google AMP for Email spec' },
      { name: 'AMP component detection', threshold: 'amp-img, amp-form, etc.', source: 'Google AMP for Email component docs' },
    ],
  },
  {
    id: 'structured-data',
    title: '10. Structured Data',
    icon: <Layers className="w-5 h-5" />,
    checks: [
      { name: 'JSON-LD detection', threshold: 'application/ld+json script', source: 'Schema.org + Google Structured Data docs' },
      { name: 'Microdata detection', threshold: 'itemscope/itemtype', source: 'Schema.org microdata spec' },
      { name: 'Gmail Actions markup', threshold: 'EmailMessage, Event, Order, etc.', source: 'Gmail Actions developer documentation' },
    ],
  },
  {
    id: 'email-weight',
    title: '11. Email Weight',
    icon: <Gauge className="w-5 h-5" />,
    checks: [
      { name: 'HTML size / Gmail clipping', threshold: '>102KB = clipped', source: 'Gmail documented 102KB limit' },
      { name: 'Image count', threshold: '>7 = warning', source: 'Campaign Monitor data: 1-3 images optimal + SpamAssassin HTML_IMAGE_ONLY rules' },
      { name: 'Image dimensions', threshold: 'width/height attributes', source: 'CLS (Cumulative Layout Shift) web standard' },
      { name: 'Table count', threshold: '>15 = warning', source: 'Email on Acid: max 3-4 nesting levels recommended' },
      { name: 'CSS size', threshold: '>20KB = info', source: 'Contributes to 102KB Gmail clip limit' },
    ],
  },
  {
    id: 'responsive',
    title: '12. Responsive Design',
    icon: <Monitor className="w-5 h-5" />,
    checks: [
      { name: 'Viewport meta tag', threshold: '<meta name="viewport">', source: 'W3C viewport spec / mobile rendering standard' },
      { name: 'Media queries', threshold: '@media detected', source: 'CSS standard for responsive design' },
      { name: 'Fluid width patterns', threshold: 'width:100% / max-width', source: 'Litmus responsive email guide' },
      { name: 'MSO conditional comments', threshold: '<!--[if mso]>', source: 'Microsoft Outlook rendering documentation' },
      { name: 'Max-width 550-640px', threshold: 'Standard email width', source: 'Industry standard (600px) — Litmus, Campaign Monitor, Mailchimp' },
    ],
  },
  {
    id: 'font-stack',
    title: '13. Font Stack',
    icon: <Type className="w-5 h-5" />,
    checks: [
      { name: 'Web font fallbacks', threshold: 'System font with @font-face', source: 'Campaign Monitor CSS support data' },
      { name: 'Font size minimum', threshold: '<13px = warning', source: 'iOS auto-zoom behavior (WebKit minimum font threshold)' },
      { name: 'Line-height declarations', threshold: 'Present or absent', source: 'Typography best practice / WCAG readability guidelines' },
    ],
  },
  {
    id: 'link-quality',
    title: '14. Link Quality',
    icon: <Link2 className="w-5 h-5" />,
    checks: [
      { name: 'Empty/placeholder links', threshold: 'href="#" or empty', source: 'HTML validation standard' },
      { name: 'javascript: links', threshold: 'Blocked by all clients', source: 'All major email client security policies' },
      { name: 'HTTP vs HTTPS', threshold: 'HTTP = warning', source: 'Browser/client security warnings (Google Safe Browsing)' },
      { name: 'mailto: links', threshold: 'Informational', source: 'Standard email protocol' },
      { name: 'tel: links', threshold: 'Informational', source: 'Mobile UX standard' },
      { name: 'Retina/HiDPI images', threshold: 'srcset / 2x/3x', source: 'Apple HiDPI display standard' },
    ],
  },
  {
    id: 'interactive',
    title: '15. Interactive Elements',
    icon: <Box className="w-5 h-5" />,
    checks: [
      { name: 'CSS animations', threshold: '@keyframes / animation', source: 'Can I Email support data: Apple Mail, iOS, some Gmail' },
      { name: 'CSS transitions', threshold: 'transition:', source: 'Can I Email support data' },
      { name: 'HTML forms', threshold: '<form>', source: 'Can I Email: very limited client support' },
      { name: 'Input/button elements', threshold: '<input>, <select>, <button>', source: 'Can I Email support data' },
      { name: 'CSS :hover', threshold: ':hover pseudo-class', source: 'Desktop-only; Can I Email support data' },
      { name: 'HTML5 video', threshold: '<video>', source: 'Can I Email: Apple Mail and iOS Mail only' },
    ],
  },
  {
    id: 'accessibility',
    title: '16. Accessibility',
    icon: <Accessibility className="w-5 h-5" />,
    checks: [
      { name: 'Image alt text', threshold: 'All <img> must have alt', source: 'WCAG 2.2 Success Criterion 1.1.1 (Non-text Content)' },
      { name: 'Empty alt on decorative images', threshold: 'alt="" informational', source: 'WCAG 2.2 — decorative images should have empty alt' },
      { name: 'Language attribute', threshold: 'lang= on <html>', source: 'WCAG 2.2 SC 3.1.1 (Language of Page)' },
      { name: 'Semantic HTML', threshold: '<header>, <nav>, <main>, etc.', source: 'WCAG 2.2 / WAI-ARIA landmark roles' },
      { name: 'Table role="presentation"', threshold: 'Layout tables need role="presentation"', source: 'WCAG 2.2 SC 1.3.1 (Info and Relationships)' },
      { name: 'Vague link text', threshold: '"click here", "read more"', source: 'WCAG 2.2 SC 2.4.4 (Link Purpose)' },
      { name: 'Color contrast', threshold: 'Light text detection', source: 'WCAG 2.2 SC 1.4.3 (4.5:1 contrast ratio for AA)' },
    ],
  },
  {
    id: 'code-quality',
    title: '17. Code Quality',
    icon: <Code className="w-5 h-5" />,
    checks: [
      { name: 'Unclosed HTML tags', threshold: 'Line-specific detection', source: 'W3C HTML validation' },
      { name: 'Extra closing tags', threshold: 'Line-specific detection', source: 'W3C HTML validation' },
      { name: 'Mismatched tags', threshold: 'Line-specific detection', source: 'W3C HTML validation' },
      { name: 'DOCTYPE', threshold: '<!DOCTYPE html>', source: 'W3C: prevents quirks mode' },
      { name: 'XMLNS', threshold: 'xmlns on <html>', source: 'XHTML spec / some email clients require it' },
      { name: 'Charset meta', threshold: '<meta charset>', source: 'W3C character encoding standard' },
      { name: 'Table-based layout', threshold: 'Tables present', source: 'Email industry standard for compatibility' },
      { name: 'External stylesheets', threshold: 'Non-font <link> stylesheets', source: 'Campaign Monitor / Litmus CSS support data' },
      { name: 'JavaScript', threshold: '<script> (excl. JSON-LD)', source: 'All email clients block JS execution' },
      { name: 'Inline styles', threshold: 'style= attributes', source: 'Most reliable styling method — Litmus / Email on Acid' },
      { name: 'Flexbox/Grid', threshold: 'display: flex/grid', source: 'Not supported in Outlook — Can I Email' },
      { name: 'position: absolute/fixed', threshold: 'CSS positioning', source: 'Unreliable in email — Can I Email' },
      { name: 'CSS background shorthand', threshold: 'background: without background-color:', source: 'Outlook Word engine ignores shorthand' },
      { name: 'CSS float', threshold: 'float: left/right', source: 'Poorly supported in Outlook — Microsoft docs' },
      { name: 'CSS variables', threshold: 'var()', source: 'Not supported in most email clients — Can I Email' },
    ],
  },
  {
    id: 'outlook',
    title: '18. Outlook Compatibility',
    icon: <Eye className="w-5 h-5" />,
    checks: [
      { name: 'MSO conditional comments', threshold: '<!--[if mso]>', source: 'Microsoft Outlook rendering docs' },
      { name: 'Table-based layout', threshold: 'Required for Outlook', source: 'Microsoft Word rendering engine limitations' },
      { name: 'Flexbox/Grid', threshold: 'Breaks completely', source: 'Microsoft — Word engine has no flex/grid support' },
      { name: 'border-radius', threshold: 'Ignored (use VML)', source: 'Microsoft — Word engine limitation' },
      { name: 'CSS background images', threshold: 'Stripped (use VML v:fill)', source: 'Microsoft — Word engine limitation' },
      { name: 'max-width', threshold: 'Not supported', source: 'Microsoft Outlook CSS support docs' },
      { name: 'margin: auto', threshold: 'Ignored (use align="center")', source: 'Microsoft Outlook CSS support docs' },
      { name: 'Padding on <a> tags', threshold: 'Ignored', source: 'Microsoft — use VML bulletproof buttons' },
      { name: 'background shorthand', threshold: 'May be ignored', source: 'Microsoft Outlook CSS support docs' },
      { name: 'box-shadow', threshold: 'Not supported', source: 'Can I Email / Microsoft docs' },
      { name: 'text-shadow', threshold: 'Not supported', source: 'Can I Email / Microsoft docs' },
      { name: 'opacity', threshold: 'Not supported', source: 'Can I Email / Microsoft docs' },
      { name: 'CSS gradients', threshold: 'Not supported (use VML)', source: 'Microsoft — use v:fill type="gradient"' },
      { name: 'CSS float', threshold: 'Unreliable', source: 'Microsoft Outlook rendering docs' },
      { name: 'VML namespaces', threshold: 'xmlns:v, xmlns:o', source: 'Microsoft VML specification' },
      { name: 'DPI scaling', threshold: 'o:PixelsPerInch fix', source: 'Microsoft high-DPI rendering docs' },
    ],
  },
];

const totalChecks = analyzers.reduce((sum, a) => sum + a.checks.length, 0);

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 hover:underline"
            style={{ color: '#0167b4' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Email Tester
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Methodology & Sources</h1>
          <p className="text-slate-600 text-lg">
            Every check in our email analysis is backed by industry standards, published research, or documented email client behavior.
            Below is a complete list of all <strong>{totalChecks} checks</strong> across <strong>{analyzers.length} analyzers</strong>.
          </p>
        </div>

        {/* Scoring system */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-3">Scoring System</h2>
          <p className="text-slate-600 mb-4">
            Our scoring uses a <strong>deduction-based system</strong> inspired by{' '}
            <strong>Mail-Tester.com</strong> and <strong>SpamAssassin</strong>:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-sm font-bold text-red-800">Critical Issues</div>
              <div className="text-2xl font-bold text-red-600">-15 pts</div>
              <div className="text-xs text-red-700 mt-1">Similar to SpamAssassin 5.0 threshold</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-sm font-bold text-amber-800">Warnings</div>
              <div className="text-2xl font-bold text-amber-600">-5 pts</div>
              <div className="text-xs text-amber-700 mt-1">Similar to SpamAssassin 1-2 point rules</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: '#f0f7fd', border: '1px solid #b8ddf7' }}>
              <div className="text-sm font-bold" style={{ color: '#0167b4' }}>Info</div>
              <div className="text-2xl font-bold" style={{ color: '#0167b4' }}>-1 pt</div>
              <div className="text-xs mt-1" style={{ color: '#0167b4' }}>Minor, informational notes</div>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-4">
            Score starts at 100. Any critical issue caps the score at 75; 2+ criticals cap at 60; 4+ cap at 40.
            The overall score is a weighted average across 6 categories: Deliverability (25%), Spam (20%),
            Content (15%), Compatibility (15%), Code (15%), and Accessibility (10%).
          </p>
        </div>

        {/* Key sources summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-3">Key Sources</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-600">
            <div><strong>SpamAssassin</strong> — spam detection rules & thresholds</div>
            <div><strong>CAN-SPAM Act / CASL</strong> — U.S. & Canadian commercial email law</div>
            <div><strong>WCAG 2.2</strong> — web accessibility guidelines</div>
            <div><strong>W3C HTML/CSS specs</strong> — web standards</div>
            <div><strong>RFC 8058</strong> — one-click unsubscribe</div>
            <div><strong>RFC 6376/7208/7489</strong> — DKIM, SPF, DMARC</div>
            <div><strong>Boomerang</strong> — 40M email study on engagement</div>
            <div><strong>HubSpot / Campaign Monitor</strong> — email marketing data</div>
            <div><strong>Litmus / Email on Acid</strong> — email testing research</div>
            <div><strong>Can I Email</strong> — email client CSS support data</div>
            <div><strong>Microsoft</strong> — Outlook/Word rendering docs</div>
            <div><strong>Google</strong> — Gmail, AMP, Structured Data docs</div>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-3">Overall Score Categories</h2>
          <p className="text-slate-600 mb-4">
            The overall score is a <strong>weighted average</strong> of 6 category scores. Each category combines
            results from multiple analyzers. The weights reflect real-world impact on email success.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-2.5 font-semibold">Category</th>
                  <th className="px-4 py-2.5 font-semibold">Weight</th>
                  <th className="px-4 py-2.5 font-semibold">Analyzers Included</th>
                  <th className="px-4 py-2.5 font-semibold">Why This Weight</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-3 font-semibold text-slate-900">Deliverability</td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#0167b4' }}>25%</td>
                  <td className="px-4 py-3 text-slate-600">Deliverability + Spam Analysis</td>
                  <td className="px-4 py-3 text-slate-500">If your email doesn&apos;t reach the inbox, nothing else matters</td>
                </tr>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <td className="px-4 py-3 font-semibold text-slate-900">Spam</td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#0167b4' }}>20%</td>
                  <td className="px-4 py-3 text-slate-600">Spam Analysis</td>
                  <td className="px-4 py-3 text-slate-500">Spam filtering is the #1 reason emails fail to deliver</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-3 font-semibold text-slate-900">Content</td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#0167b4' }}>15%</td>
                  <td className="px-4 py-3 text-slate-600">Subject + Preheader + Content Quality + CTA + AI Summary</td>
                  <td className="px-4 py-3 text-slate-500">Content quality drives opens, clicks, and conversions</td>
                </tr>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <td className="px-4 py-3 font-semibold text-slate-900">Compatibility</td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#0167b4' }}>15%</td>
                  <td className="px-4 py-3 text-slate-600">Dark Mode + AMP + Responsive + Interactive + Structured Data + Outlook</td>
                  <td className="px-4 py-3 text-slate-500">Emails must render correctly across all clients and devices</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-3 font-semibold text-slate-900">Code Quality</td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#0167b4' }}>15%</td>
                  <td className="px-4 py-3 text-slate-600">Code Quality + Email Weight + Font Stack + Link Quality</td>
                  <td className="px-4 py-3 text-slate-500">Clean code prevents rendering bugs and reduces file size</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-900">Accessibility</td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#0167b4' }}>10%</td>
                  <td className="px-4 py-3 text-slate-600">Accessibility</td>
                  <td className="px-4 py-3 text-slate-500">Ensures emails are usable by everyone, including screen reader users</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Severity levels */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-3">Severity Levels</h2>
          <p className="text-slate-600 mb-4">
            Each check produces a finding with one of four severity levels, from most to least severe:
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-center min-w-[80px]">
                <div className="text-2xl font-bold text-red-600">-15</div>
                <div className="text-xs text-red-700">per issue</div>
              </div>
              <div>
                <div className="font-bold text-red-800">Critical</div>
                <div className="text-sm text-red-700">Must fix before sending. These issues will cause delivery failures, broken rendering, or legal non-compliance. Any critical issue caps the score at 75.</div>
                <div className="text-xs text-red-600 mt-1">Examples: Missing unsubscribe link, no CTAs, JavaScript in email, Gmail clipping</div>
              </div>
            </div>
            <div className="flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="text-center min-w-[80px]">
                <div className="text-2xl font-bold text-amber-600">-5</div>
                <div className="text-xs text-amber-700">per issue</div>
              </div>
              <div>
                <div className="font-bold text-amber-800">Warning</div>
                <div className="text-sm text-amber-700">Should fix for best results. These issues reduce deliverability, engagement, or compatibility but won&apos;t completely break the email.</div>
                <div className="text-xs text-amber-600 mt-1">Examples: Missing viewport meta, no dark mode support, spam trigger words, no physical address</div>
              </div>
            </div>
            <div className="flex items-start gap-4 rounded-lg p-4" style={{ background: '#f0f7fd', border: '1px solid #b8ddf7' }}>
              <div className="text-center min-w-[80px]">
                <div className="text-2xl font-bold" style={{ color: '#0167b4' }}>-1</div>
                <div className="text-xs" style={{ color: '#0167b4' }}>per issue</div>
              </div>
              <div>
                <div className="font-bold" style={{ color: '#015a9c' }}>Info</div>
                <div className="text-sm" style={{ color: '#015a9c' }}>Nice to know. Informational notes about optional enhancements or minor observations. Minimal impact on score.</div>
                <div className="text-xs mt-1" style={{ color: '#0167b4' }}>Examples: Emoji in subject, no AMP markup, CSS animations detected, border-radius with tables</div>
              </div>
            </div>
            <div className="flex items-start gap-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-center min-w-[80px]">
                <div className="text-2xl font-bold text-green-600">+0</div>
                <div className="text-xs text-green-700">no deduction</div>
              </div>
              <div>
                <div className="font-bold text-green-800">Pass</div>
                <div className="text-sm text-green-700">Check passed. The email meets or exceeds the standard for this check. Passes prevent deductions by not triggering issues.</div>
                <div className="text-xs text-green-600 mt-1">Examples: Good word count, alt text on all images, unsubscribe link present, DKIM passed</div>
              </div>
            </div>
          </div>
        </div>

        {/* Score caps */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-3">Score Caps & Floors</h2>
          <p className="text-slate-600 mb-4">
            Beyond point deductions, the scoring system applies hard caps based on the severity of issues found:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-2.5 font-semibold">Condition</th>
                  <th className="px-4 py-2.5 font-semibold">Max Score</th>
                  <th className="px-4 py-2.5 font-semibold">Rationale</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-3 text-slate-900">1 critical issue</td>
                  <td className="px-4 py-3 font-bold text-red-600">75</td>
                  <td className="px-4 py-3 text-slate-500">A single critical issue means the email isn&apos;t ready</td>
                </tr>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-900">2-3 critical issues</td>
                  <td className="px-4 py-3 font-bold text-red-600">60</td>
                  <td className="px-4 py-3 text-slate-500">Multiple critical issues indicate systemic problems</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-3 text-slate-900">4+ critical issues</td>
                  <td className="px-4 py-3 font-bold text-red-600">40</td>
                  <td className="px-4 py-3 text-slate-500">Fundamental issues across multiple areas</td>
                </tr>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-900">Missing basic HTML structure</td>
                  <td className="px-4 py-3 font-bold text-red-600">10</td>
                  <td className="px-4 py-3 text-slate-500">No &lt;html&gt; or &lt;body&gt; — not a valid email</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900">Under 20 words of content</td>
                  <td className="px-4 py-3 font-bold text-red-600">20</td>
                  <td className="px-4 py-3 text-slate-500">Insufficient content for a meaningful email</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* All analyzers */}
        <div className="space-y-6">
          {analyzers.map((analyzer) => (
            <div key={analyzer.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
                <span style={{ color: '#0167b4' }}>{analyzer.icon}</span>
                <h2 className="text-lg font-bold text-slate-900">{analyzer.title}</h2>
                <span className="ml-auto text-xs font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                  {analyzer.checks.length} check{analyzer.checks.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                      <th className="px-6 py-2.5 font-semibold">Check</th>
                      <th className="px-6 py-2.5 font-semibold">Threshold</th>
                      <th className="px-6 py-2.5 font-semibold">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyzer.checks.map((check, idx) => (
                      <tr
                        key={idx}
                        className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                      >
                        <td className="px-6 py-2.5 font-medium text-slate-900">{check.name}</td>
                        <td className="px-6 py-2.5 text-slate-600 font-mono text-xs">{check.threshold}</td>
                        <td className="px-6 py-2.5 text-slate-500">{check.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-slate-400 pb-8">
          <p>{totalChecks} checks across {analyzers.length} analyzers</p>
          <p className="mt-1">All thresholds are based on published standards, documented email client behavior, or peer-reviewed research.</p>
        </div>
      </div>
    </div>
  );
}