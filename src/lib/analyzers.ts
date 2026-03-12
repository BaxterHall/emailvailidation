import {
  Finding, AnalysisResult, CTAAnalysisResult, AISummaryResult,
  SpamResult, EmailWeightResult, FullAnalysisResults
} from '@/types';

// --- Helpers ---

// Scoring approach inspired by Mail-Tester.com (10-point scale mapped to 0-100):
// - Start at 100, deduct points per issue
// - Critical issues: -15 each (similar to SpamAssassin's 5.0 default threshold = fail)
// - Warnings: -5 each (similar to SpamAssassin 1-2 point rules)
// - Info: -1 each (minor, informational)
// - Passes add no points (they prevent deductions by not triggering issues)
// Sources: Mail-Tester uses a 10-point deduction system; SpamAssassin default threshold is 5.0
function calcScore(findings: Finding[]): number {
  const criticals = findings.filter(f => f.severity === 'critical').length;
  const warnings = findings.filter(f => f.severity === 'warning').length;
  const infos = findings.filter(f => f.severity === 'info').length;
  const total = findings.length;

  if (total === 0) return 0;

  // Start at 100, deduct per issue
  let score = 100;
  score -= criticals * 15;
  score -= warnings * 5;
  score -= infos * 1;

  // Cap: any critical issue means max 75; 2+ criticals max 60; 4+ max 40
  if (criticals >= 4) score = Math.min(score, 40);
  else if (criticals >= 2) score = Math.min(score, 60);
  else if (criticals >= 1) score = Math.min(score, 75);

  return Math.max(0, Math.min(100, score));
}

function stripHTML(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Void elements that don't need closing tags
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

interface TagIssue {
  tag: string;
  line: number;
}

function getLineNumber(text: string, charIndex: number): number {
  let line = 1;
  for (let i = 0; i < charIndex && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

function findMismatchedTags(html: string): { unclosed: TagIssue[]; extraClosing: TagIssue[]; mismatched: TagIssue[] } {
  const unclosed: TagIssue[] = [];
  const extraClosing: TagIssue[] = [];
  const mismatched: TagIssue[] = [];

  // Strip comments, scripts, styles, and CDATA — replace with same-length whitespace to preserve positions
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, m => ' '.repeat(m.length))
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, m => ' '.repeat(m.length))
    .replace(/<script[\s\S]*?<\/script>/gi, m => ' '.repeat(m.length))
    .replace(/<style[\s\S]*?<\/style>/gi, m => ' '.repeat(m.length));

  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*?\/?>/g;
  const stack: { tag: string; line: number }[] = [];
  let match;

  while ((match = tagRegex.exec(cleaned)) !== null) {
    const fullTag = match[0];
    const tagName = match[1]!.toLowerCase();
    const line = getLineNumber(html, match.index);

    // Skip void elements and self-closing
    if (VOID_ELEMENTS.has(tagName) || fullTag.endsWith('/>')) continue;

    if (fullTag.startsWith('</')) {
      // Closing tag
      if (stack.length === 0) {
        extraClosing.push({ tag: tagName, line });
      } else if (stack[stack.length - 1]!.tag === tagName) {
        stack.pop();
      } else {
        // Look for the tag in the stack
        let idx = -1;
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i]!.tag === tagName) { idx = i; break; }
        }
        if (idx >= 0) {
          // Everything between is unclosed
          const unclosedBetween = stack.splice(idx);
          unclosedBetween.pop(); // Remove the matched one
          unclosedBetween.forEach(t => unclosed.push({ tag: t.tag, line: t.line }));
        } else {
          mismatched.push({ tag: tagName, line });
        }
      }
    } else {
      // Opening tag
      stack.push({ tag: tagName, line });
    }
  }

  // Remaining in stack are unclosed
  stack.forEach(t => unclosed.push({ tag: t.tag, line: t.line }));

  return { unclosed, extraClosing, mismatched };
}

function sanitizeHTML(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '');
}

// --- 1. Subject Line ---

export function analyzeSubjectLine(subject: string): AnalysisResult {
  const findings: Finding[] = [];

  if (!subject || subject.trim().length === 0) {
    findings.push({ severity: 'critical', message: 'Subject line is required' });
    return { findings, score: 0 };
  }

  const len = subject.length;

  if (len < 20) {
    findings.push({ severity: 'warning', message: `Subject line is very short (${len} chars)`, detail: 'Optimal length is 41-50 characters for best open rates' });
  } else if (len >= 41 && len <= 50) {
    findings.push({ severity: 'pass', message: `Subject line length is optimal (${len} chars)` });
  } else if (len > 70) {
    findings.push({ severity: 'critical', message: `Subject line too long (${len} chars)`, detail: 'Will be truncated on mobile devices. Keep under 70 characters' });
  } else if (len > 50) {
    findings.push({ severity: 'info', message: `Subject line is ${len} chars`, detail: 'Slightly long. Optimal is 41-50 characters' });
  } else {
    findings.push({ severity: 'pass', message: `Subject line length is acceptable (${len} chars)` });
  }

  // Spam trigger words — based on SpamAssassin rules (FUZZY_FREE, FUZZY_CREDIT, GUARANTEED,
  // URG_BIZ, etc.) and published lists from HubSpot, Mailchimp, and Campaign Monitor.
  // Grouped by category for maintainability.
  const spamWords = [
    // Urgency / pressure (SpamAssassin URG_BIZ, STRONG_BUY rules)
    'act now', 'limited time', 'urgent', 'expires', 'hurry', 'last chance',
    'don\'t delay', 'immediate', 'only today', 'deadline',
    // Financial / too-good-to-be-true (SpamAssassin FUZZY_FREE, GUARANTEED rules)
    'free', 'no cost', 'no fee', 'risk-free', 'no obligation', 'guaranteed',
    'winner', 'cash', 'million dollars', 'earn extra', 'double your',
    'lowest price', 'best price', 'bargain', 'affordable',
    // Purchase pressure (SpamAssassin STRONG_BUY)
    'buy now', 'order now', 'buy direct', 'shop now', 'apply now',
    'call now', 'get it now',
    // Spam phrases (SpamAssassin DEAR_FRIEND, NOT_SPAM rules)
    'dear friend', 'this is not spam', 'you have been selected',
    'congratulations', 'click here', 'click below',
    'incredible deal', 'special offer', 'exclusive deal',
    // Financial services (SpamAssassin FUZZY_CREDIT, MORTGAGE rules)
    'no credit check', 'credit score', 'debt relief', 'consolidate debt',
    // MLM / work from home (SpamAssassin WORK_AT_HOME)
    'work from home', 'be your own boss', 'extra income',
    'make money', 'income from home',
    // Excessive punctuation patterns
    '!!!',
  ];
  const foundSpam = spamWords.filter(w => subject.toLowerCase().includes(w));
  if (foundSpam.length > 0) {
    findings.push({ severity: 'warning', message: `Spam trigger words detected: ${foundSpam.join(', ')}`, detail: 'These match SpamAssassin rules. Note: individual words matter less than combinations — sender reputation accounts for 70-80% of filtering decisions (Validity/Return Path data)' });
  } else {
    findings.push({ severity: 'pass', message: 'No obvious spam trigger words' });
  }

  // ALL CAPS
  if (subject === subject.toUpperCase() && len > 5) {
    findings.push({ severity: 'warning', message: 'Subject line is ALL CAPS', detail: 'All caps can trigger spam filters and appears aggressive' });
  }

  // Excessive punctuation
  const exclamations = (subject.match(/!/g) || []).length;
  if (exclamations > 1) {
    findings.push({ severity: 'warning', message: `${exclamations} exclamation marks in subject`, detail: 'Multiple exclamation marks can trigger spam filters' });
  }

  // Emoji detection
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const emojis = subject.match(emojiRegex);
  if (emojis && emojis.length > 0) {
    findings.push({ severity: 'info', message: `${emojis.length} emoji(s) detected in subject`, detail: 'Emojis can improve open rates but may render differently across clients' });
  }

  // Personalization tokens
  const personalizationPatterns = /\{\{.*?\}\}|%%.*?%%|\*\|.*?\|\*/;
  if (personalizationPatterns.test(subject)) {
    findings.push({ severity: 'pass', message: 'Personalization tokens detected', detail: 'Personalized subject lines typically improve open rates' });
  }

  // RE:/FW: prefix
  if (/^(RE|FW|Fwd):/i.test(subject)) {
    findings.push({ severity: 'warning', message: 'Subject starts with RE:/FW: prefix', detail: 'Fake reply/forward prefixes are a spam technique and erode trust' });
  }

  // Word count — Return Path research: 6-10 words yields highest open rates
  const wordCount = subject.trim().split(/\s+/).length;
  if (wordCount < 3) {
    findings.push({ severity: 'warning', message: `Subject line is only ${wordCount} word(s)`, detail: 'Too vague. Aim for 6-10 words for best open rates (Return Path)' });
  } else if (wordCount >= 6 && wordCount <= 10) {
    findings.push({ severity: 'pass', message: `Word count is optimal (${wordCount} words)` });
  } else if (wordCount > 15) {
    findings.push({ severity: 'warning', message: `Subject line is ${wordCount} words`, detail: 'Wordy subjects get truncated and reduce engagement. Aim for 6-10 words' });
  } else {
    findings.push({ severity: 'pass', message: `Word count is acceptable (${wordCount} words)` });
  }

  // Leading/trailing whitespace
  if (subject !== subject.trim()) {
    findings.push({ severity: 'warning', message: 'Subject line has leading or trailing whitespace', detail: 'Stray spaces can look unprofessional and indicate copy-paste errors' });
  }

  // Special character overuse ($$$, ###, ***)
  const specialCharSpam = /(\${2,}|#{2,}|\*{3,}|={3,}|~{3,}|\^{3,})/.test(subject);
  if (specialCharSpam) {
    findings.push({ severity: 'warning', message: 'Repeated special characters in subject', detail: 'Patterns like $$$, ###, or *** are common spam indicators' });
  }

  // Question in subject — Yesware study: questions boost open rates by ~10%
  if (/\?/.test(subject)) {
    findings.push({ severity: 'pass', message: 'Subject uses a question', detail: 'Questions can increase open rates by driving curiosity (Yesware research)' });
  }

  // Numbers/statistics — Campaign Monitor: subject lines with numbers get 57% higher open rates
  if (/\d/.test(subject) && !/^(RE|FW|Fwd):/i.test(subject)) {
    findings.push({ severity: 'pass', message: 'Subject includes a number or statistic', detail: 'Numbers add specificity and can boost open rates (Campaign Monitor)' });
  }

  // Sentence case vs ALL Title Case — AWeber research: sentence case feels more personal
  const words = subject.split(/\s+/).filter(w => w.length > 3);
  const capitalizedWords = words.filter(w => /^[A-Z][a-z]/.test(w));
  if (words.length > 4 && capitalizedWords.length === words.length && !/\?$/.test(subject)) {
    findings.push({ severity: 'info', message: 'Subject uses Title Case for every word', detail: 'Sentence case tends to feel more personal and less promotional (AWeber research)' });
  }

  return { findings, score: calcScore(findings) };
}

// --- 2. Preheader ---

export function analyzePreheader(preheader: string, subject: string, content: string): AnalysisResult {
  const findings: Finding[] = [];

  if (!preheader || preheader.trim().length === 0) {
    // Check if there's a hidden preheader in the HTML
    const hasHiddenPreheader = /display\s*:\s*none[^"]*preheader|preheader[^"]*display\s*:\s*none/i.test(content) ||
      /class=["'][^"']*preheader/i.test(content) ||
      /<!--\s*preheader/i.test(content);

    if (hasHiddenPreheader) {
      findings.push({ severity: 'pass', message: 'Hidden preheader technique detected in HTML' });
    } else {
      findings.push({ severity: 'warning', message: 'No preheader text provided', detail: 'Without a preheader, email clients will pull the first text from your email body' });
    }
    return { findings, score: calcScore(findings) };
  }

  const len = preheader.length;

  if (len < 40) {
    findings.push({ severity: 'warning', message: `Preheader is short (${len} chars)`, detail: 'Optimal preheader length is 40-130 characters' });
  } else if (len >= 40 && len <= 130) {
    findings.push({ severity: 'pass', message: `Preheader length is optimal (${len} chars)` });
  } else {
    findings.push({ severity: 'info', message: `Preheader is long (${len} chars)`, detail: 'May be truncated. Optimal is 40-130 characters' });
  }

  // Check if preheader duplicates subject
  if (subject && preheader.toLowerCase().trim() === subject.toLowerCase().trim()) {
    findings.push({ severity: 'warning', message: 'Preheader duplicates the subject line', detail: 'Use the preheader to add new information, not repeat the subject' });
  } else if (subject) {
    findings.push({ severity: 'pass', message: 'Preheader adds information beyond subject line' });
  }

  return { findings, score: calcScore(findings) };
}

// --- 3. AI Summary ---

export function analyzeAISummary(content: string, subject: string, preheader: string): AISummaryResult {
  const findings: Finding[] = [];
  const textContent = stripHTML(content);
  const sentences = textContent.match(/[^.!?]+[.!?]+/g) || [];
  const numbers = textContent.match(/\d+%|\$[\d,]+|\d+\s*(?:million|billion|thousand)/gi) || [];

  const keyPhrases: string[] = [];
  const patterns = [
    /(?:announces?|launches?|introduces?|reveals?)\s+([^,.!?]{10,50})/gi,
    /(?:new|latest|upcoming)\s+([^,.!?]{10,50})/gi,
  ];
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(textContent)) !== null && keyPhrases.length < 3) {
      keyPhrases.push(match[1].trim());
    }
  }

  const ctaMatches = textContent.match(/(?:learn more|sign up|get started|download|register)/gi) || [];
  const primaryAction = ctaMatches[0] || 'learn more';

  let aiSummary = subject || 'Email';
  if (preheader && preheader.toLowerCase() !== subject?.toLowerCase()) {
    aiSummary += '. ' + preheader;
  }
  if (keyPhrases.length > 0) {
    aiSummary += ' ' + keyPhrases[0];
  } else if (sentences.length > 0) {
    const firstPart = sentences[0]!.substring(0, 100);
    if (firstPart.length > 20) aiSummary += '. ' + firstPart;
  }
  if (numbers.length > 0) {
    aiSummary += '. Key figures: ' + numbers.slice(0, 2).join(', ');
  }

  const mobile = aiSummary.substring(0, 180) + (aiSummary.length > 180 ? '...' : '');
  const desktop = aiSummary.substring(0, 250) + (aiSummary.length > 250 ? '...' : '');

  if (!subject || subject.length < 10) {
    findings.push({ severity: 'critical', message: 'Subject line too short for AI summary context' });
  } else {
    findings.push({ severity: 'pass', message: 'Subject provides good foundation for AI summary' });
  }

  if (textContent.length < 100) {
    findings.push({ severity: 'warning', message: 'Limited content — AI summary may be generic' });
  } else {
    findings.push({ severity: 'pass', message: 'Sufficient content for meaningful AI summary' });
  }

  if (keyPhrases.length === 0 && numbers.length === 0) {
    findings.push({ severity: 'warning', message: 'No key highlights detected', detail: 'AI may generate a generic summary without strong hooks' });
  } else {
    findings.push({ severity: 'pass', message: 'Key elements detected for AI extraction' });
  }

  if (preheader && preheader.length > 20) {
    findings.push({ severity: 'pass', message: 'Preheader enhances AI summary' });
  } else if (!preheader) {
    findings.push({ severity: 'info', message: 'No preheader — AI relies only on content' });
  }

  return {
    findings,
    score: calcScore(findings),
    meta: {
      mobileAISummary: mobile,
      desktopAISummary: desktop,
      extractedElements: {
        keyPhrases: keyPhrases.slice(0, 3),
        numbers: numbers.slice(0, 3),
        primaryAction,
        sentenceCount: sentences.length,
        wordCount: textContent.split(/\s+/).filter(w => w.length > 0).length,
      },
    },
  };
}

// --- 4. CTA Analysis ---

export function analyzeCTA(content: string): CTAAnalysisResult {
  const findings: Finding[] = [];
  const ctas: { text: string; href: string; type: string; hasButtonStyling: boolean; position: number; isAboveFold: boolean }[] = [];
  let aboveFoldCTAs = 0;
  let belowFoldCTAs = 0;

  const ctaPatterns = [
    { pattern: /learn more/gi, type: 'informational' },
    { pattern: /sign up/gi, type: 'conversion' },
    { pattern: /get started/gi, type: 'conversion' },
    { pattern: /download/gi, type: 'conversion' },
    { pattern: /register/gi, type: 'conversion' },
    { pattern: /subscribe/gi, type: 'conversion' },
    { pattern: /buy now/gi, type: 'conversion' },
    { pattern: /shop now/gi, type: 'conversion' },
    { pattern: /book now/gi, type: 'conversion' },
    { pattern: /contact us/gi, type: 'engagement' },
    { pattern: /request a demo/gi, type: 'conversion' },
    { pattern: /try free/gi, type: 'conversion' },
    { pattern: /read more/gi, type: 'informational' },
    { pattern: /view details/gi, type: 'informational' },
  ];

  const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const matches = Array.from(content.matchAll(linkRegex));

  matches.forEach((match, linkIndex) => {
    const href = match[1] || '';
    const linkText = (match[2] || '').replace(/<[^>]*>/g, '').trim();
    const fullMatch = match[0];

    let isCTA = false;
    let ctaType = 'other';

    for (const cp of ctaPatterns) {
      if (new RegExp(cp.pattern.source, cp.pattern.flags).test(linkText)) {
        isCTA = true;
        ctaType = cp.type;
        break;
      }
    }

    const hasButtonStyling = /background(?:-color)?[:\s]*[^;]+;/i.test(fullMatch) ||
      /padding[:\s]*[^;]+;/i.test(fullMatch);

    if (hasButtonStyling) isCTA = true;

    if (isCTA) {
      // Estimate pixel position based on HTML structure before this link.
      // Industry data (Litmus, Email on Acid): above-fold is ~300px (Outlook preview)
      // to ~500px (Gmail web). We use 400px as a safe middle ground.
      // Estimation: each <tr>/<div>/<p> ≈ ~40px, each <img> ≈ ~150px,
      // spacer <td> with height ≈ its height value, padding/margin adds up.
      const contentBeforeLink = content.substring(0, match.index);
      const blockElements = (contentBeforeLink.match(/<tr|<div|<p/gi) || []).length;
      const imagesBefore = (contentBeforeLink.match(/<img/gi) || []).length;
      // Extract explicit height values from spacers/tds
      const heightMatches = contentBeforeLink.match(/height[=:]\s*["']?(\d+)/gi) || [];
      const explicitHeight = heightMatches.reduce((sum, m) => {
        const val = parseInt(m.replace(/[^0-9]/g, ''));
        return sum + (val > 0 && val < 500 ? val : 0);
      }, 0);
      const estimatedPx = (blockElements * 40) + (imagesBefore * 150) + explicitHeight;
      const isAboveFold = estimatedPx < 400; // 400px = safe for most clients (Litmus data)

      ctas.push({
        text: linkText.substring(0, 100),
        href: href.substring(0, 200),
        type: ctaType,
        hasButtonStyling,
        position: linkIndex + 1,
        isAboveFold,
      });

      if (isAboveFold) aboveFoldCTAs++;
      else belowFoldCTAs++;
    }
  });

  if (ctas.length === 0) {
    findings.push({ severity: 'critical', message: 'No CTAs detected', detail: 'Every email should have at least one clear call-to-action' });
  } else {
    findings.push({ severity: 'pass', message: `${ctas.length} CTA${ctas.length > 1 ? 's' : ''} detected` });
  }

  if (ctas.length > 0 && aboveFoldCTAs === 0) {
    findings.push({ severity: 'critical', message: 'No CTAs above the fold', detail: 'Primary CTA should be visible without scrolling' });
  } else if (aboveFoldCTAs > 0) {
    findings.push({ severity: 'pass', message: `${aboveFoldCTAs} CTA${aboveFoldCTAs > 1 ? 's' : ''} above fold` });
  }

  // CTA count — Hick's Law (psychology): too many choices reduces conversion.
  // Campaign Monitor & HubSpot data: 1-3 CTAs is optimal for click-through rate.
  if (ctas.length > 5) {
    findings.push({ severity: 'warning', message: `Too many CTAs (${ctas.length})`, detail: 'Hick\'s Law: too many choices reduces conversions. Campaign Monitor data shows 1-3 CTAs is optimal' });
  } else if (ctas.length >= 1 && ctas.length <= 3) {
    findings.push({ severity: 'pass', message: `Optimal CTA count (${ctas.length})` });
  }

  // Check for vague CTA text
  const vagueCTAs = ctas.filter(c => /^(click here|here|link|read more)$/i.test(c.text));
  if (vagueCTAs.length > 0) {
    findings.push({ severity: 'warning', message: `${vagueCTAs.length} CTA(s) with vague text`, detail: 'Use action-oriented text like "Download Guide" instead of "Click Here"' });
  }

  // Check for bulletproof buttons (VML)
  const hasVMLButtons = /<!--\[if mso\]>[\s\S]*?v:roundrect/i.test(content);
  if (ctas.some(c => c.hasButtonStyling) && !hasVMLButtons) {
    findings.push({ severity: 'info', message: 'No bulletproof buttons (VML) for Outlook', detail: 'CSS-styled buttons may not render in Outlook. Consider VML fallbacks' });
  }

  return {
    findings,
    score: calcScore(findings),
    meta: { ctas, aboveFoldCTAs, belowFoldCTAs },
  };
}

// --- 5. Content Quality ---

export function analyzeContent(content: string): AnalysisResult {
  const findings: Finding[] = [];

  if (!content || content.trim().length === 0) {
    findings.push({ severity: 'critical', message: 'No email content provided' });
    return { findings, score: 0 };
  }

  // Structural HTML validation
  const hasHtmlTag = /<html/i.test(content);
  const hasBodyTag = /<body/i.test(content);
  const hasHeadTag = /<head/i.test(content);
  const hasClosingHtml = /<\/html>/i.test(content);
  const hasClosingBody = /<\/body>/i.test(content);

  if (!hasHtmlTag) {
    findings.push({ severity: 'critical', message: 'Missing <html> tag', detail: 'Email must have a complete HTML document structure' });
  } else {
    findings.push({ severity: 'pass', message: '<html> tag present' });
  }

  if (!hasBodyTag) {
    findings.push({ severity: 'critical', message: 'Missing <body> tag', detail: 'Email must have a <body> element' });
  } else {
    findings.push({ severity: 'pass', message: '<body> tag present' });
  }

  if (!hasHeadTag) {
    findings.push({ severity: 'warning', message: 'Missing <head> tag', detail: 'The <head> section should contain meta tags and title' });
  } else {
    findings.push({ severity: 'pass', message: '<head> tag present' });
  }

  if (hasHtmlTag && !hasClosingHtml) {
    findings.push({ severity: 'critical', message: 'Unclosed <html> tag' });
  }

  if (hasBodyTag && !hasClosingBody) {
    findings.push({ severity: 'critical', message: 'Unclosed <body> tag' });
  }

  // Check for malformed/incomplete HTML
  const openTags = (content.match(/<[a-z][a-z0-9]*(?:\s[^>]*)?(?<!\/)\s*>/gi) || []).length;
  const closeTags = (content.match(/<\/[a-z][a-z0-9]*\s*>/gi) || []).length;
  if (openTags > 0 && closeTags === 0) {
    findings.push({ severity: 'critical', message: 'No closing HTML tags found', detail: 'HTML appears malformed or incomplete' });
  }

  // Title tag
  const hasTitle = /<title/i.test(content);
  if (!hasTitle) {
    findings.push({ severity: 'warning', message: 'Missing <title> tag', detail: 'Some email clients display the title in tabs or previews' });
  } else {
    findings.push({ severity: 'pass', message: '<title> tag present' });
  }

  // Link count — SpamAssassin penalizes excessive URIs. Industry consensus: 2-5 ideal,
  // 10+ raises spam filter flags (Campaign Monitor, Mailchimp guidelines).
  const linkCount = (content.match(/<a\s+href=/gi) || []).length;
  if (linkCount === 0) {
    findings.push({ severity: 'warning', message: 'No links found in email' });
  } else if (linkCount > 10) {
    findings.push({ severity: 'warning', message: `High link count (${linkCount})`, detail: 'More than 10 links can trigger spam filters (SpamAssassin URI rules). Aim for 2-5 links' });
  } else {
    findings.push({ severity: 'pass', message: `Appropriate link count (${linkCount})` });
  }

  // Image ratio — SpamAssassin rules HTML_IMAGE_ONLY_04/08 penalize image-heavy emails.
  // Campaign Monitor data: 1-3 images with ~200 words = best click-through.
  // Industry standard: at least 60% text / 40% images by content area.
  const imageCount = (content.match(/<img/gi) || []).length;
  const textContent = stripHTML(content);
  const textToImageRatio = textContent.length / Math.max(imageCount * 100, 1);

  if (imageCount > 0 && textToImageRatio < 2) {
    findings.push({ severity: 'warning', message: 'Image-heavy email', detail: 'Low text-to-image ratio triggers SpamAssassin (HTML_IMAGE_ONLY rules). Aim for 60:40 text-to-image ratio' });
  } else if (imageCount > 0) {
    findings.push({ severity: 'pass', message: 'Good text-to-image balance' });
  }

  if (imageCount === 0 && textContent.length > 50) {
    findings.push({ severity: 'info', message: 'No images detected', detail: 'Images are optional but can improve engagement. Text-only emails are fine for transactional messages' });
  }

  // Word count check — Boomerang study (40M emails): 75-125 words = best response rate.
  // HubSpot/Campaign Monitor: 50-200 words = best click-through. We use 50-300 as the pass range.
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 20) {
    findings.push({ severity: 'critical', message: `Very low word count (${wordCount})`, detail: 'Email has insufficient content. Emails under 20 words are frequently flagged as spam' });
  } else if (wordCount < 50) {
    findings.push({ severity: 'warning', message: `Low word count (${wordCount})`, detail: 'Boomerang/HubSpot research shows 50-200 words gets the best engagement' });
  } else if (wordCount > 500) {
    findings.push({ severity: 'warning', message: `High word count (${wordCount})`, detail: 'Emails over 500 words see declining response rates (Boomerang study). Consider shortening' });
  } else if (wordCount > 300) {
    findings.push({ severity: 'info', message: `Word count is ${wordCount}`, detail: 'Slightly long. Studies show 75-200 words is the sweet spot for engagement' });
  } else {
    findings.push({ severity: 'pass', message: `Good word count (${wordCount})` });
  }

  // Content length check
  if (content.length < 200) {
    findings.push({ severity: 'critical', message: 'Email HTML is too short', detail: `Only ${content.length} characters. A properly structured email needs substantially more HTML` });
  }

  return { findings, score: calcScore(findings) };
}

// --- 6. Spam Analysis ---

export function analyzeSpam(content: string, subject: string): SpamResult {
  const findings: Finding[] = [];
  let spamScore = 0;

  // Unsubscribe (also detect ESP merge tags like @{confirmunsubscribelink}@, *|UNSUB|*, %%unsubscribe%%, etc.)
  const hasUnsubscribe = /unsubscribe|opt[\s-]?out|confirmunsubscribelink|UNSUB/gi.test(content);
  if (!hasUnsubscribe) {
    spamScore += 5;
    findings.push({ severity: 'critical', message: 'Missing unsubscribe link', detail: 'Required by CAN-SPAM, CASL, and GDPR. All marketing emails must include an unsubscribe mechanism' });
  } else {
    findings.push({ severity: 'pass', message: 'Unsubscribe link present' });
  }

  // Physical address — CAN-SPAM Act (15 U.S.C. 7701-7713) and CASL (S.C. 2010, c. 23) require a valid physical postal
  // address in every commercial email. Valid: street address, PO Box, or registered CMRA (e.g. UPS Store).
  // Penalty: up to $51,744 per email (FTC). We check common patterns.
  const hasAddress = /\d+\s+[\w\s]+,\s*[\w\s]+,\s*[A-Z]{2}\s*\d{5}/i.test(content) ||  // US: 123 Main St, City, ST 12345
    /\d+\s+[\w\s]+,\s*[\w\s]+,\s*[A-Z]{2}/i.test(content) ||                           // US: 123 Main St, City, ST
    /P\.?O\.?\s*Box\s*\d+/i.test(content) ||                                             // PO Box 123
    /[A-Z]\d[A-Z]\s*\d[A-Z]\d/i.test(content) ||                                        // Canadian postal code: A1A 1A1
    /\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Place|Pl|Court|Ct)\b/i.test(content); // Street type
  if (!hasAddress) {
    spamScore += 3;
    findings.push({ severity: 'warning', message: 'Physical address not detected', detail: 'CAN-SPAM & CASL require a valid physical mailing address in every commercial email. CAN-SPAM penalty: up to $51,744 per email (FTC). CASL penalty: up to $10M per violation (CRTC)' });
  } else {
    findings.push({ severity: 'pass', message: 'Physical address included' });
  }

  // Excessive caps in body
  const excessiveCaps = (content.match(/[A-Z]{10,}/g) || []).length;
  if (excessiveCaps > 3) {
    spamScore += 2;
    findings.push({ severity: 'warning', message: `Excessive capitalization (${excessiveCaps} instances)` });
  }

  // URL shorteners
  const shorteners = /bit\.ly|tinyurl|goo\.gl|ow\.ly|t\.co|is\.gd|buff\.ly/i.test(content);
  if (shorteners) {
    spamScore += 4;
    findings.push({ severity: 'critical', message: 'URL shorteners detected', detail: 'URL shorteners are heavily associated with spam and phishing' });
  }

  // Hidden text — SpamAssassin INVISIBLE_TEXT rule flags text hidden via various techniques.
  // Exclude known-legitimate preheader hiding patterns (display:none with max-height:0).
  const preheaderPattern = /display\s*:\s*none[^"]*max-height\s*:\s*0|max-height\s*:\s*0[^"]*display\s*:\s*none/i;
  const hiddenTextPatterns = [
    /font-size\s*:\s*0(?:px|em|%)?\s*[;'"]/i,          // font-size: 0
    /font-size\s*:\s*1px/i,                              // font-size: 1px
    /color\s*:\s*#fff(?:fff)?\s*;/i,                     // color: #fff or #ffffff
    /color\s*:\s*white\s*;/i,                             // color: white
    /color\s*:\s*#f{3,6}\s*;.*background[^:]*:\s*#f{3,6}/i, // white text on white bg
    /line-height\s*:\s*0/i,                              // line-height: 0
    /overflow\s*:\s*hidden.*height\s*:\s*0|height\s*:\s*0.*overflow\s*:\s*hidden/i, // height:0 + overflow:hidden
  ];
  const hasHiddenText = hiddenTextPatterns.some(p => p.test(content)) && !preheaderPattern.test(content);
  if (hasHiddenText) {
    spamScore += 3;
    findings.push({ severity: 'warning', message: 'Possible hidden text detected', detail: 'SpamAssassin INVISIBLE_TEXT rule flags hidden text (tiny font, white-on-white, zero height). Preheader hiding is excluded from this check' });
  }

  // Excessive exclamation marks in body text
  const bodyExclamations = (stripHTML(content).match(/!/g) || []).length;
  if (bodyExclamations > 5) {
    spamScore += 1;
    findings.push({ severity: 'info', message: `${bodyExclamations} exclamation marks in body text`, detail: 'Excessive punctuation can contribute to spam scoring' });
  }

  // Subject spam words (cross-check with high-signal SpamAssassin triggers)
  if (subject) {
    const subjectSpam = ['free', 'guaranteed', 'winner', 'urgent', 'act now', 'limited time',
      'congratulations', 'no cost', 'risk-free', 'buy now', 'order now', 'click here'];
    const found = subjectSpam.filter(w => subject.toLowerCase().includes(w));
    if (found.length > 0) {
      spamScore += found.length;
    }
  }

  // Thresholds inspired by SpamAssassin (default threshold: 5.0 = spam).
  // Our scale: 0-4 = low risk, 5-9 = medium, 10+ = high.
  const rating = spamScore >= 10 ? 'High Risk' : spamScore >= 5 ? 'Medium Risk' : 'Low Risk';
  const color = spamScore >= 10 ? 'red' : spamScore >= 5 ? 'yellow' : 'green';

  if (spamScore < 5) {
    findings.push({ severity: 'pass', message: 'Low spam risk score' });
  }

  return {
    findings,
    score: Math.max(0, 100 - spamScore * 5),
    meta: { spamScore, spamRating: rating, spamColor: color },
  };
}

// --- 7. Deliverability ---

export function analyzeDeliverability(content: string): AnalysisResult {
  const findings: Finding[] = [];

  // List-Unsubscribe header (or ESP merge tag that handles unsubscribe server-side)
  const hasESPUnsubscribe = /confirmunsubscribelink|UNSUB\||\%\%unsubscribe\%\%|unsubscribe_url|subscription_url/i.test(content);
  const hasListUnsub = /List-Unsubscribe/i.test(content) || hasESPUnsubscribe;
  if (hasListUnsub) {
    findings.push({ severity: 'pass', message: hasESPUnsubscribe ? 'ESP unsubscribe merge tag detected (handles List-Unsubscribe)' : 'List-Unsubscribe header reference detected' });
  } else {
    findings.push({ severity: 'info', message: 'No List-Unsubscribe header detected', detail: 'Add List-Unsubscribe and List-Unsubscribe-Post headers for one-click unsubscribe (RFC 8058). Required by Gmail and Yahoo as of 2024' });
  }

  // One-Click Unsubscribe (RFC 8058) — ESPs with unsubscribe merge tags handle this automatically
  const hasOneClick = /List-Unsubscribe-Post/i.test(content) || hasESPUnsubscribe;
  if (hasOneClick) {
    findings.push({ severity: 'pass', message: hasESPUnsubscribe ? 'ESP handles one-click unsubscribe automatically' : 'One-Click Unsubscribe (RFC 8058) detected' });
  } else if (!hasListUnsub) {
    findings.push({ severity: 'warning', message: 'No One-Click Unsubscribe support', detail: 'Gmail and Yahoo require RFC 8058 one-click unsubscribe for bulk senders (>5000/day)' });
  }

  // BIMI — Brand Indicators for Message Identification. BIMI is configured via DNS
  // (TXT record at default._bimi.<domain>), not in HTML. We can't detect it from email
  // content alone, so we only provide informational guidance.
  findings.push({ severity: 'info', message: 'BIMI not detected — consider implementing', detail: 'BIMI displays your brand logo in Gmail, Apple Mail, and Yahoo. Requires: DMARC at p=quarantine or p=reject, plus a paid VMC certificate (~$1,500/year from DigiCert or Entrust). Cannot be detected from HTML — it is a DNS record' });

  // Authentication-Results (EML files)
  const hasAuthResults = /Authentication-Results/i.test(content);
  const hasDKIM = /dkim=pass/i.test(content);
  const hasSPF = /spf=pass/i.test(content);
  const hasDMARC = /dmarc=pass/i.test(content);

  if (hasAuthResults) {
    if (hasDKIM) findings.push({ severity: 'pass', message: 'DKIM authentication passed' });
    else findings.push({ severity: 'critical', message: 'DKIM authentication not passing', detail: 'DKIM is essential for email deliverability' });
    if (hasSPF) findings.push({ severity: 'pass', message: 'SPF authentication passed' });
    else findings.push({ severity: 'warning', message: 'SPF authentication not passing' });
    if (hasDMARC) findings.push({ severity: 'pass', message: 'DMARC authentication passed' });
    else findings.push({ severity: 'warning', message: 'DMARC authentication not passing', detail: 'DMARC is required for BIMI and recommended for all senders' });
  } else {
    findings.push({ severity: 'info', message: 'No authentication headers found', detail: 'Upload an EML file to check DKIM, SPF, and DMARC authentication results. These are critical for deliverability' });
  }

  return { findings, score: calcScore(findings) };
}

// --- 8. Dark Mode ---

export function analyzeDarkMode(content: string): AnalysisResult {
  const findings: Finding[] = [];

  const hasColorSchemeMeta = /<meta[^>]*color-scheme/i.test(content);
  const hasPrefersColorScheme = /prefers-color-scheme/i.test(content);
  const hasColorSchemeCSS = /color-scheme\s*:/i.test(content);

  if (hasColorSchemeMeta) {
    findings.push({ severity: 'pass', message: 'color-scheme meta tag present', detail: 'Tells email clients this email supports dark mode' });
  } else {
    findings.push({ severity: 'warning', message: 'Missing color-scheme meta tag', detail: 'Add <meta name="color-scheme" content="light dark"> to support dark mode' });
  }

  if (hasPrefersColorScheme) {
    findings.push({ severity: 'pass', message: 'prefers-color-scheme media query detected' });
  } else {
    findings.push({ severity: 'warning', message: 'No prefers-color-scheme media query', detail: 'Add @media (prefers-color-scheme: dark) styles for dark mode support' });
  }

  if (hasColorSchemeCSS) {
    findings.push({ severity: 'pass', message: 'color-scheme CSS property used' });
  }

  // Check for background color on body/wrapper
  const hasBodyBg = /<body[^>]*background|<body[^>]*bgcolor|<body[^>]*style[^>]*background/i.test(content);
  const hasWrapperBg = /background-color\s*:\s*#[0-9a-f]{3,6}/i.test(content);
  if (!hasBodyBg && !hasWrapperBg) {
    findings.push({ severity: 'warning', message: 'No background color set', detail: 'Without explicit background colors, dark mode may cause readability issues' });
  } else {
    findings.push({ severity: 'pass', message: 'Background colors defined' });
  }

  // Transparent PNG check
  const hasPNG = /\.png/i.test(content);
  if (hasPNG) {
    findings.push({ severity: 'info', message: 'PNG images detected', detail: 'Transparent PNGs may look bad on dark backgrounds. Consider using dark-mode-safe logos' });
  }

  const darkModeReady = hasColorSchemeMeta && hasPrefersColorScheme;
  if (darkModeReady) {
    findings.push({ severity: 'pass', message: 'Email appears dark mode ready' });
  }

  return { findings, score: calcScore(findings) };
}

// --- 9. AMP for Email ---

export function analyzeAMP(content: string): AnalysisResult {
  const findings: Finding[] = [];

  const hasAMP = /<html[^>]*(?:amp4email|⚡4email)/i.test(content);
  const hasAMPScript = /cdn\.ampproject\.org/i.test(content);
  const hasAMPComponents = /amp-(img|carousel|form|list|accordion|bind|selector)/i.test(content);

  if (hasAMP || hasAMPScript) {
    findings.push({ severity: 'pass', message: 'AMP for Email detected' });
    if (hasAMPComponents) {
      findings.push({ severity: 'pass', message: 'AMP components found' });
    }
    findings.push({ severity: 'info', message: 'AMP email support is limited', detail: 'Supported by Gmail, Yahoo, and Mail.ru. Always include an HTML fallback' });
  } else {
    findings.push({ severity: 'info', message: 'No AMP for Email markup detected', detail: 'AMP enables interactive email experiences (forms, carousels, real-time content). Consider it for advanced interactivity' });
  }

  return { findings, score: calcScore(findings) };
}

// --- 10. Structured Data ---

export function analyzeStructuredData(content: string): AnalysisResult {
  const findings: Finding[] = [];

  const hasJSONLD = /<script[^>]*type=["']application\/ld\+json["']/i.test(content);
  const hasMicrodata = /itemscope|itemtype/i.test(content);
  const hasGmailActions = /schema\.org\/(EmailMessage|Event|Order|Flight|Reservation)/i.test(content);

  if (hasJSONLD) {
    findings.push({ severity: 'pass', message: 'JSON-LD structured data detected' });
  }

  if (hasMicrodata) {
    findings.push({ severity: 'pass', message: 'Schema.org microdata detected' });
  }

  if (hasGmailActions) {
    findings.push({ severity: 'pass', message: 'Gmail action markup detected', detail: 'Enables rich cards and action buttons in Gmail' });
  }

  if (!hasJSONLD && !hasMicrodata && !hasGmailActions) {
    // Only give neutral info if the email is real; otherwise it's a bigger problem
    if (/<html/i.test(content) && /<body/i.test(content)) {
      findings.push({ severity: 'info', message: 'No structured data detected', detail: 'Adding Schema.org markup enables Gmail action buttons, rich cards, and event tracking' });
    } else {
      findings.push({ severity: 'warning', message: 'No structured data (email lacks valid HTML structure)' });
    }
  }

  return { findings, score: calcScore(findings) };
}

// --- 11. Email Weight ---

export function analyzeEmailWeight(content: string): EmailWeightResult {
  const findings: Finding[] = [];
  const htmlSizeKB = Math.round(new Blob([content]).size / 1024 * 10) / 10;
  const imageCount = (content.match(/<img/gi) || []).length;

  // Gmail clips at 102KB
  const willBeClipped = htmlSizeKB > 102;
  if (willBeClipped) {
    findings.push({ severity: 'critical', message: `HTML size is ${htmlSizeKB}KB — Gmail will clip this email`, detail: 'Gmail clips emails larger than 102KB. The "[Message clipped]" link hides your content and CTA' });
  } else if (htmlSizeKB > 80) {
    findings.push({ severity: 'warning', message: `HTML size is ${htmlSizeKB}KB — approaching Gmail clip limit`, detail: 'Gmail clips at 102KB. Consider reducing HTML size' });
  } else {
    findings.push({ severity: 'pass', message: `HTML size is ${htmlSizeKB}KB (under 102KB limit)` });
  }

  // Image count — Campaign Monitor: 1-3 images is ideal. More than 7 increases load
  // time and spam risk. SpamAssassin HTML_IMAGE_ONLY rules flag image-heavy emails.
  if (imageCount > 7) {
    findings.push({ severity: 'warning', message: `${imageCount} images detected`, detail: 'More than 7 images increases load time and spam risk. Campaign Monitor data shows 1-3 images is optimal' });
  } else if (imageCount > 0) {
    findings.push({ severity: 'pass', message: `${imageCount} image${imageCount > 1 ? 's' : ''} detected` });
  }

  // Check for width/height on images
  const imagesWithDimensions = (content.match(/<img[^>]*(?:width|height)\s*=/gi) || []).length;
  if (imageCount > 0 && imagesWithDimensions < imageCount) {
    findings.push({ severity: 'warning', message: `${imageCount - imagesWithDimensions} image(s) missing width/height attributes`, detail: 'Set dimensions to prevent layout shift while images load' });
  } else if (imageCount > 0) {
    findings.push({ severity: 'pass', message: 'All images have explicit dimensions' });
  }

  // Table count — Email on Acid recommends max 3-4 levels of nesting.
  // Outlook's Word engine struggles with deeply nested tables.
  // 15+ tables is common in complex emails but worth noting.
  const tableCount = (content.match(/<table/gi) || []).length;
  const nestedTableDepth = tableCount;
  if (tableCount > 15) {
    findings.push({ severity: 'warning', message: `${tableCount} tables detected`, detail: 'High table count may slow rendering in Outlook. Consider simplifying the layout' });
  } else if (tableCount > 0) {
    findings.push({ severity: 'pass', message: `${tableCount} table${tableCount > 1 ? 's' : ''} — reasonable complexity` });
  }

  // CSS size estimation
  const styleBlocks = content.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  const cssSize = styleBlocks.reduce((sum, s) => sum + s.length, 0);
  const cssSizeKB = Math.round(cssSize / 1024 * 10) / 10;
  if (cssSizeKB > 20) {
    findings.push({ severity: 'info', message: `Embedded CSS is ${cssSizeKB}KB`, detail: 'Large CSS blocks contribute to the 102KB clip limit' });
  }

  return {
    findings,
    score: calcScore(findings),
    meta: { htmlSizeKB, imageCount, willBeClipped, nestedTableDepth },
  };
}

// --- 12. Responsive Design ---

export function analyzeResponsive(content: string): AnalysisResult {
  const findings: Finding[] = [];

  const hasMediaQueries = /@media/i.test(content);
  const hasViewport = /<meta[^>]*viewport/i.test(content);
  const hasFluidWidth = /width\s*:\s*100%|max-width/i.test(content);
  const hasMSOConditionals = /<!--\[if\s+(?:mso|gte\s+mso)/i.test(content);

  if (hasViewport) {
    findings.push({ severity: 'pass', message: 'Viewport meta tag present' });
  } else {
    findings.push({ severity: 'warning', message: 'Missing viewport meta tag', detail: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0"> for responsive rendering' });
  }

  if (hasMediaQueries) {
    findings.push({ severity: 'pass', message: 'Media queries detected' });
  } else {
    findings.push({ severity: 'warning', message: 'No media queries found', detail: 'Media queries are essential for mobile-responsive email layouts' });
  }

  if (hasFluidWidth) {
    findings.push({ severity: 'pass', message: 'Fluid width patterns detected' });
  } else {
    findings.push({ severity: 'info', message: 'No fluid width patterns detected', detail: 'Consider using width:100% and max-width for responsive tables' });
  }

  // MSO conditionals
  if (hasMSOConditionals) {
    findings.push({ severity: 'pass', message: 'MSO conditional comments present', detail: 'Outlook-specific fixes via conditional comments' });
  } else {
    findings.push({ severity: 'info', message: 'No MSO conditional comments', detail: 'Consider adding <!--[if mso]> blocks for Outlook-specific rendering fixes' });
  }

  // Fixed width tables without responsive handling
  const fixedWidthTables = content.match(/<table[^>]*width=["']?\d{4,}["']?/gi) || [];
  if (fixedWidthTables.length > 0 && !hasMediaQueries) {
    findings.push({ severity: 'warning', message: `${fixedWidthTables.length} wide fixed-width table(s) without media queries`, detail: 'Large fixed-width tables will overflow on mobile screens' });
  }

  // Max-width 600-640px check
  const hasProperMaxWidth = /max-width\s*:\s*(5[5-9]\d|6[0-4]\d)px/i.test(content);
  if (hasProperMaxWidth) {
    findings.push({ severity: 'pass', message: 'Email max-width set to 550-640px range' });
  } else {
    findings.push({ severity: 'info', message: 'Consider setting max-width to 600px', detail: 'Standard email width of 600px ensures readability across clients' });
  }

  return { findings, score: calcScore(findings) };
}

// --- 13. Font Stack ---

export function analyzeFontStack(content: string): AnalysisResult {
  const findings: Finding[] = [];

  const hasWebFonts = /@font-face|fonts\.googleapis\.com|@import\s+url/i.test(content);
  const webSafeFonts = ['arial', 'helvetica', 'georgia', 'times new roman', 'courier', 'verdana', 'tahoma', 'trebuchet ms'];
  const hasFallbackFont = webSafeFonts.some(f => content.toLowerCase().includes(f));
  const hasSansSerif = /sans-serif|serif|monospace/i.test(content);

  if (hasWebFonts) {
    findings.push({ severity: 'info', message: 'Web fonts detected', detail: 'Web fonts have limited email client support. Gmail, Outlook, and Yahoo may ignore them' });
    if (hasFallbackFont || hasSansSerif) {
      findings.push({ severity: 'pass', message: 'System font fallbacks present' });
    } else {
      findings.push({ severity: 'warning', message: 'No system font fallbacks for web fonts', detail: 'Always include web-safe fallback fonts (Arial, Helvetica, Georgia)' });
    }
  } else if (hasFallbackFont) {
    findings.push({ severity: 'pass', message: 'Web-safe fonts used' });
  }

  // Font size check
  const smallFonts = content.match(/font-size\s*:\s*(\d+)px/gi) || [];
  const tooSmall = smallFonts.filter(match => {
    const size = parseInt(match.replace(/[^0-9]/g, ''));
    return size > 0 && size < 13;
  });
  if (tooSmall.length > 0) {
    findings.push({ severity: 'warning', message: `${tooSmall.length} font-size declaration(s) below 13px`, detail: 'iOS auto-zooms text smaller than 13px. Use minimum 13px for body text' });
  } else if (smallFonts.length > 0) {
    findings.push({ severity: 'pass', message: 'Font sizes meet minimum requirements' });
  }

  // Line-height check
  const hasLineHeight = /line-height/i.test(content);
  if (hasLineHeight) {
    findings.push({ severity: 'pass', message: 'Line-height declarations present' });
  } else {
    findings.push({ severity: 'info', message: 'No line-height set', detail: 'Explicit line-height improves readability and prevents client-specific defaults' });
  }

  return { findings, score: calcScore(findings) };
}

// --- 14. Link Quality ---

export function analyzeLinkQuality(content: string): AnalysisResult {
  const findings: Finding[] = [];

  const linkRegex = /<a[^>]*href=["']([^"']*)["']/gi;
  const links: string[] = [];
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    links.push(match[1]);
  }

  if (links.length === 0) {
    findings.push({ severity: 'info', message: 'No links found' });
    return { findings, score: calcScore(findings) };
  }

  // Empty or # links
  const emptyLinks = links.filter(l => !l || l === '#' || l === '');
  if (emptyLinks.length > 0) {
    findings.push({ severity: 'warning', message: `${emptyLinks.length} empty or placeholder link(s)`, detail: 'Replace # and empty href values with actual URLs' });
  }

  // javascript: in href
  const jsLinks = links.filter(l => /^javascript:/i.test(l));
  if (jsLinks.length > 0) {
    findings.push({ severity: 'critical', message: `${jsLinks.length} javascript: link(s) detected`, detail: 'javascript: links are blocked by all email clients' });
  }

  // HTTP vs HTTPS
  const httpLinks = links.filter(l => /^http:/i.test(l));
  if (httpLinks.length > 0) {
    findings.push({ severity: 'warning', message: `${httpLinks.length} non-HTTPS link(s)`, detail: 'Use HTTPS for all links. HTTP links may trigger security warnings' });
  }

  // mailto: validation
  const mailtoLinks = links.filter(l => /^mailto:/i.test(l));
  if (mailtoLinks.length > 0) {
    findings.push({ severity: 'pass', message: `${mailtoLinks.length} mailto: link(s) found` });
  }

  // tel: links
  const telLinks = links.filter(l => /^tel:/i.test(l));
  if (telLinks.length > 0) {
    findings.push({ severity: 'pass', message: `${telLinks.length} tel: link(s) found` });
  }

  // Retina/HiDPI images
  const hasSrcset = /srcset/i.test(content);
  const hasRetinaHint = /2x|3x|retina/i.test(content);
  if (hasSrcset || hasRetinaHint) {
    findings.push({ severity: 'pass', message: 'Retina/HiDPI image support detected' });
  } else {
    const imageCount = (content.match(/<img/gi) || []).length;
    if (imageCount > 0) {
      findings.push({ severity: 'info', message: 'No retina image support', detail: 'Consider 2x images with explicit width/height for sharp display on high-DPI screens' });
    }
  }

  // Count valid links
  const validLinks = links.filter(l => l && l !== '#' && !/^javascript:/i.test(l));
  if (validLinks.length > 0) {
    findings.push({ severity: 'pass', message: `${validLinks.length} valid link(s)` });
  }

  return { findings, score: calcScore(findings) };
}

// --- 15. Interactive Elements ---

export function analyzeInteractiveElements(content: string): AnalysisResult {
  const findings: Finding[] = [];

  const hasAnimations = /@keyframes|animation\s*:/i.test(content);
  const hasTransitions = /transition\s*:/i.test(content);
  const hasForms = /<form/i.test(content);
  const hasInputs = /<input|<select|<button/i.test(content);
  const hasHoverEffects = /:hover/i.test(content);
  const hasVideo = /<video/i.test(content);

  if (hasAnimations) {
    findings.push({ severity: 'info', message: 'CSS animations detected', detail: 'CSS animations work in Apple Mail, iOS Mail, and some Gmail. Not supported in Outlook' });
  }

  if (hasTransitions) {
    findings.push({ severity: 'info', message: 'CSS transitions detected', detail: 'Transitions have limited email client support' });
  }

  if (hasForms) {
    findings.push({ severity: 'warning', message: 'Form elements detected', detail: 'HTML forms are only supported in a few email clients. Consider AMP for Email or linking to a web form' });
  }

  if (hasInputs && !hasForms) {
    findings.push({ severity: 'info', message: 'Input/button elements detected without form', detail: 'Interactive elements have limited support in email clients' });
  }

  if (hasHoverEffects) {
    findings.push({ severity: 'info', message: 'CSS :hover effects detected', detail: 'Hover effects work on desktop clients but not mobile. Good for progressive enhancement' });
  }

  if (hasVideo) {
    findings.push({ severity: 'warning', message: 'Video element detected', detail: 'HTML5 video is only supported in Apple Mail and iOS Mail. Use an animated GIF or thumbnail image with play button linking to video' });
  }

  if (!hasAnimations && !hasTransitions && !hasForms && !hasHoverEffects && !hasVideo) {
    // Only credit this as a pass if the email has real HTML structure
    if (/<html/i.test(content) && /<body/i.test(content)) {
      findings.push({ severity: 'pass', message: 'No compatibility-risky interactive elements' });
    } else {
      findings.push({ severity: 'info', message: 'No interactive elements (email lacks basic HTML structure)' });
    }
  }

  return { findings, score: calcScore(findings) };
}

// --- 16. Accessibility ---

export function analyzeAccessibility(content: string): AnalysisResult {
  const findings: Finding[] = [];

  // Alt text
  const totalImages = (content.match(/<img/gi) || []).length;
  const withAlt = (content.match(/<img[^>]*alt=/gi) || []).length;
  if (totalImages > 0) {
    const missing = totalImages - withAlt;
    if (missing > 0) {
      findings.push({ severity: 'critical', message: `${missing} of ${totalImages} image(s) missing alt text`, detail: 'All images must have alt attributes for screen reader users' });
    } else {
      findings.push({ severity: 'pass', message: `All ${totalImages} image(s) have alt text` });
    }
    // Empty alt on decorative images is fine, but check for alt=""
    const emptyAlts = (content.match(/<img[^>]*alt=["']\s*["']/gi) || []).length;
    if (emptyAlts > 0) {
      findings.push({ severity: 'info', message: `${emptyAlts} image(s) with empty alt text`, detail: 'Empty alt is correct for decorative images. Ensure informational images have descriptive alt text' });
    }
  }

  // Language attribute
  const hasLang = /<html[^>]*lang=/i.test(content);
  if (hasLang) {
    findings.push({ severity: 'pass', message: 'Language attribute set' });
  } else {
    findings.push({ severity: 'warning', message: 'Missing lang attribute on <html>', detail: 'Screen readers use the lang attribute to determine pronunciation' });
  }

  // Semantic HTML
  const hasSemanticHTML = /<(header|nav|main|article|section|footer)/i.test(content);
  if (hasSemanticHTML) {
    findings.push({ severity: 'pass', message: 'Semantic HTML elements used' });
  }

  // Table role="presentation"
  const layoutTables = (content.match(/<table/gi) || []).length;
  const presentationTables = (content.match(/<table[^>]*role=["']presentation["']/gi) || []).length;
  if (layoutTables > 0 && presentationTables === 0) {
    findings.push({ severity: 'warning', message: 'Layout tables missing role="presentation"', detail: 'Screen readers may interpret layout tables as data tables. Add role="presentation" to layout tables' });
  } else if (presentationTables > 0) {
    findings.push({ severity: 'pass', message: 'Table role="presentation" used for layout tables' });
  }

  // Vague link text
  const vagueLinks = content.match(/<a[^>]*>\s*(?:click here|here|link|read more)\s*<\/a>/gi) || [];
  if (vagueLinks.length > 0) {
    findings.push({ severity: 'warning', message: `${vagueLinks.length} link(s) with vague text`, detail: 'Use descriptive link text instead of "click here" or "read more"' });
  }

  // ARIA labels
  const hasAriaLabels = /aria-label/i.test(content);
  if (hasAriaLabels) {
    findings.push({ severity: 'pass', message: 'ARIA labels detected' });
  }

  // Color contrast hint (basic check for light text)
  const lightColors = content.match(/color\s*:\s*#(?:f[0-9a-f]{5}|[c-f][0-9a-f]{5})/gi) || [];
  if (lightColors.length > 3) {
    findings.push({ severity: 'info', message: 'Multiple light-colored text declarations', detail: 'Ensure sufficient color contrast (4.5:1 ratio for WCAG AA)' });
  }

  // Title attribute on links
  const hasTitle = /<a[^>]*title=/i.test(content);
  if (hasTitle) {
    findings.push({ severity: 'pass', message: 'Link title attributes detected' });
  }

  return { findings, score: calcScore(findings) };
}

// --- 17. Code Quality ---

export function analyzeCodeQuality(content: string): AnalysisResult {
  const findings: Finding[] = [];

  // --- HTML Tag Validation ---
  const tagResult = findMismatchedTags(content);

  if (tagResult.unclosed.length > 0) {
    const lineDetails = tagResult.unclosed
      .slice(0, 8)
      .map(t => `<${t.tag}> on line ${t.line}`)
      .join(', ');
    findings.push({
      severity: 'critical',
      message: `${tagResult.unclosed.length} unclosed HTML tag(s)`,
      detail: `${lineDetails}. Every opening tag must have a matching closing tag — unclosed tags cause unpredictable rendering across email clients`,
    });
  } else {
    findings.push({ severity: 'pass', message: 'All HTML tags properly closed' });
  }

  if (tagResult.extraClosing.length > 0) {
    const lineDetails = tagResult.extraClosing
      .slice(0, 8)
      .map(t => `</${t.tag}> on line ${t.line}`)
      .join(', ');
    findings.push({
      severity: 'critical',
      message: `${tagResult.extraClosing.length} extra closing tag(s)`,
      detail: `${lineDetails}. Closing tags without matching opening tags indicate malformed HTML`,
    });
  }

  if (tagResult.mismatched.length > 0) {
    const lineDetails = tagResult.mismatched
      .slice(0, 8)
      .map(t => `<${t.tag}> on line ${t.line}`)
      .join(', ');
    findings.push({
      severity: 'critical',
      message: `${tagResult.mismatched.length} mismatched tag(s)`,
      detail: `${lineDetails}. Tags are closed in the wrong order — this will cause broken layouts in strict email clients`,
    });
  }

  // DOCTYPE
  if (/<!DOCTYPE html>/i.test(content)) {
    findings.push({ severity: 'pass', message: 'DOCTYPE present' });
  } else {
    findings.push({ severity: 'warning', message: 'Missing DOCTYPE declaration', detail: 'Add <!DOCTYPE html> to prevent quirks mode rendering' });
  }

  // XMLNS
  const hasXMLNS = /<html[^>]*xmlns/i.test(content);
  if (hasXMLNS) {
    findings.push({ severity: 'pass', message: 'XMLNS namespace declared' });
  } else if (/<html/i.test(content)) {
    findings.push({ severity: 'warning', message: 'Missing xmlns on <html>', detail: 'Add xmlns="http://www.w3.org/1999/xhtml" for proper rendering in some clients' });
  }

  // Meta charset
  const hasCharset = /<meta[^>]*charset/i.test(content);
  if (hasCharset) {
    findings.push({ severity: 'pass', message: 'Character encoding declared' });
  } else {
    findings.push({ severity: 'warning', message: 'Missing charset meta tag', detail: 'Add <meta charset="UTF-8"> to prevent character encoding issues' });
  }

  // Content-Type meta
  const hasContentType = /<meta[^>]*content-type/i.test(content) || /<meta[^>]*http-equiv/i.test(content);
  if (hasContentType) {
    findings.push({ severity: 'pass', message: 'Content-Type meta tag present' });
  }

  // Table-based layout
  if (/<table/i.test(content)) {
    findings.push({ severity: 'pass', message: 'Table-based layout detected' });
  } else {
    findings.push({ severity: 'warning', message: 'No table-based layout', detail: 'Table-based layouts have the best email client compatibility' });
  }

  // External CSS (exclude font stylesheets — those are expected)
  const externalStylesheets = content.match(/<link[^>]*stylesheet[^>]*>/gi) || [];
  const nonFontStylesheets = externalStylesheets.filter(link => !/fonts\.googleapis|fonts\.gstatic|typekit|font/i.test(link));
  const fontStylesheets = externalStylesheets.filter(link => /fonts\.googleapis|fonts\.gstatic|typekit|font/i.test(link));
  if (nonFontStylesheets.length > 0) {
    findings.push({ severity: 'warning', message: `${nonFontStylesheets.length} external stylesheet(s) detected`, detail: 'Most email clients ignore external CSS. Use inline styles or embedded <style> blocks instead' });
  }
  if (fontStylesheets.length > 0) {
    findings.push({ severity: 'info', message: `${fontStylesheets.length} external font stylesheet(s) detected`, detail: 'Web font stylesheets have limited support — Gmail, Outlook, and Yahoo will ignore them. Ensure fallback fonts are defined' });
  }

  // JavaScript
  if (/<script(?!\s*type=["']application\/ld\+json)/i.test(content)) {
    findings.push({ severity: 'critical', message: 'JavaScript detected', detail: 'All email clients block JavaScript execution' });
  }

  // Inline styles
  const inlineStyles = (content.match(/style=/gi) || []).length;
  if (inlineStyles > 0) {
    findings.push({ severity: 'pass', message: `${inlineStyles} inline style declarations` });
  } else {
    findings.push({ severity: 'warning', message: 'No inline styles detected', detail: 'Inline styles are the most reliable way to style emails' });
  }

  // <style> block
  const hasStyleBlock = /<style/i.test(content);
  if (hasStyleBlock) {
    findings.push({ severity: 'pass', message: '<style> block present' });
    findings.push({ severity: 'info', message: 'Some clients strip <head> styles', detail: 'Gmail strips styles from <head>. Ensure critical styles are also inline' });
  }

  // Flexbox/Grid
  if (/display\s*:\s*(?:flex|grid)/i.test(content)) {
    findings.push({ severity: 'critical', message: 'CSS Flexbox or Grid detected', detail: 'Flexbox and Grid are not supported in Outlook or many email clients. Use table-based layouts' });
  }

  // Position absolute/fixed
  if (/position\s*:\s*(?:absolute|fixed)/i.test(content)) {
    findings.push({ severity: 'warning', message: 'CSS position: absolute/fixed detected', detail: 'Absolute and fixed positioning is unreliable in email clients' });
  }

  // CSS shorthand issues
  if (/(?:^|\s)background\s*:/im.test(content) && !/background-color\s*:/i.test(content)) {
    findings.push({ severity: 'warning', message: 'CSS background shorthand used', detail: 'Outlook may ignore background shorthand. Use background-color for compatibility' });
  }

  // Margin auto
  if (/margin\s*:\s*0?\s*auto/i.test(content)) {
    findings.push({ severity: 'info', message: 'margin: auto detected', detail: 'Outlook ignores margin:auto. Use align="center" on tables for centering' });
  }

  // Float
  if (/float\s*:\s*(?:left|right)/i.test(content)) {
    findings.push({ severity: 'warning', message: 'CSS float detected', detail: 'Float is poorly supported in Outlook. Use table cells for side-by-side layout' });
  }

  // CSS variables
  if (/var\s*\(/i.test(content)) {
    findings.push({ severity: 'warning', message: 'CSS custom properties (variables) detected', detail: 'CSS variables are not supported in most email clients' });
  }

  // calc()
  if (/calc\s*\(/i.test(content)) {
    findings.push({ severity: 'warning', message: 'CSS calc() detected', detail: 'calc() is not supported in Outlook or older email clients' });
  }

  // border-radius on tables
  if (/border-radius/i.test(content) && /<table/i.test(content)) {
    findings.push({ severity: 'info', message: 'border-radius used with tables', detail: 'border-radius on tables is not supported in Outlook. Use VML for rounded corners' });
  }

  return { findings, score: calcScore(findings) };
}

// --- 18. Outlook Compatibility ---

export function analyzeOutlookCompat(content: string): AnalysisResult {
  const findings: Finding[] = [];

  // Outlook uses the Word rendering engine (2007-2021) which is extremely limited
  const hasHTML = /<html/i.test(content);
  if (!hasHTML) {
    findings.push({ severity: 'critical', message: 'No HTML document — will render as plain text in Outlook' });
    return { findings, score: 0 };
  }

  // MSO Conditional Comments — essential for Outlook fixes
  const hasMSOConditionals = /<!--\[if\s+(?:mso|gte\s+mso)/i.test(content);
  if (hasMSOConditionals) {
    findings.push({ severity: 'pass', message: 'MSO conditional comments present' });
  } else {
    findings.push({ severity: 'warning', message: 'No MSO conditional comments', detail: 'Add <!--[if mso]> blocks for Outlook-specific rendering fixes. Essential for Outlook 2007-2021' });
  }

  // Table-based layout — required for Outlook
  const hasTables = /<table/i.test(content);
  if (hasTables) {
    findings.push({ severity: 'pass', message: 'Table-based layout detected (required for Outlook)' });
  } else {
    findings.push({ severity: 'critical', message: 'No table-based layout', detail: 'Outlook uses the Word rendering engine which requires table-based layouts. div-based layouts will collapse' });
  }

  // Flexbox/Grid — completely broken in Outlook
  if (/display\s*:\s*(?:flex|grid)/i.test(content)) {
    findings.push({ severity: 'critical', message: 'Flexbox/Grid detected — breaks in Outlook', detail: 'The Word engine does not support display: flex or grid. Use nested tables instead' });
  } else {
    findings.push({ severity: 'pass', message: 'No Flexbox/Grid (Outlook safe)' });
  }

  // border-radius — completely ignored
  if (/border-radius/i.test(content)) {
    findings.push({ severity: 'warning', message: 'border-radius used — ignored by Outlook', detail: 'Use VML (v:roundrect) for rounded corners in Outlook' });
    // Check if VML fallback exists
    if (/v:roundrect/i.test(content)) {
      findings.push({ severity: 'pass', message: 'VML roundrect fallback present for Outlook' });
    }
  } else {
    findings.push({ severity: 'pass', message: 'No border-radius (Outlook safe)' });
  }

  // CSS background images — stripped by Word engine
  if (/background(?:-image)?\s*:[^;]*url\s*\(/i.test(content)) {
    findings.push({ severity: 'warning', message: 'CSS background images — stripped by Outlook', detail: 'Use VML (v:fill) for background images in Outlook. Or use the background= attribute on <td>' });
    if (/v:fill/i.test(content) || /v:image/i.test(content)) {
      findings.push({ severity: 'pass', message: 'VML background image fallback present' });
    }
  }

  // max-width — not supported
  if (/max-width/i.test(content)) {
    findings.push({ severity: 'warning', message: 'max-width not supported in Outlook', detail: 'Use fixed width= attributes on tables. Wrap in MSO conditional with fixed-width table' });
  }

  // margin: auto — ignored
  if (/margin\s*:\s*(?:\d+px\s+)?auto/i.test(content)) {
    findings.push({ severity: 'warning', message: 'margin: auto ignored by Outlook', detail: 'Use align="center" on tables for centering' });
  }

  // Padding on <a> tags — completely ignored
  if (/<a[^>]*style[^>]*padding/i.test(content)) {
    findings.push({ severity: 'warning', message: 'Padding on links ignored by Outlook', detail: 'Use VML bulletproof buttons for clickable padded areas' });
    if (/v:roundrect/i.test(content)) {
      findings.push({ severity: 'pass', message: 'VML bulletproof button detected' });
    }
  }

  // CSS shorthand background
  if (/(?:^|\s)background\s*:/im.test(content) && !/background-color\s*:/i.test(content)) {
    findings.push({ severity: 'warning', message: 'background shorthand may be ignored', detail: 'Use background-color explicitly. Outlook ignores the background shorthand property' });
  }

  // box-shadow
  if (/box-shadow/i.test(content)) {
    findings.push({ severity: 'info', message: 'box-shadow not supported in Outlook' });
  }

  // text-shadow
  if (/text-shadow/i.test(content)) {
    findings.push({ severity: 'info', message: 'text-shadow not supported in Outlook' });
  }

  // opacity
  if (/opacity\s*:\s*(?!1\b)/i.test(content)) {
    findings.push({ severity: 'info', message: 'CSS opacity not supported in Outlook' });
  }

  // Gradients
  if (/linear-gradient|radial-gradient/i.test(content)) {
    findings.push({ severity: 'warning', message: 'CSS gradients not supported in Outlook', detail: 'Use VML (v:fill type="gradient") or solid background colors as fallback' });
  }

  // float
  if (/float\s*:\s*(?:left|right)/i.test(content)) {
    findings.push({ severity: 'warning', message: 'CSS float unreliable in Outlook', detail: 'Use table cells for side-by-side columns instead of float' });
  }

  // Web fonts
  if (/@font-face|fonts\.googleapis/i.test(content)) {
    findings.push({ severity: 'info', message: 'Web fonts not supported — falls back to system fonts', detail: 'Outlook ignores @font-face and Google Fonts. Ensure fallback fonts look acceptable' });
  }

  // Media queries — completely ignored
  if (/@media/i.test(content)) {
    findings.push({ severity: 'warning', message: 'Media queries ignored by Outlook desktop', detail: 'Email will render at fixed width in Outlook 2007-2021. Design for 600px fixed width' });
  }

  // Animations
  if (/animation|@keyframes|transition/i.test(content)) {
    findings.push({ severity: 'info', message: 'Animations/transitions stripped by Outlook' });
  }

  // XMLNS for VML
  const hasXMLNS = /<html[^>]*xmlns:v/i.test(content) || /<html[^>]*xmlns:o/i.test(content);
  if (hasMSOConditionals && !hasXMLNS) {
    findings.push({ severity: 'warning', message: 'MSO conditionals used but missing VML namespaces', detail: 'Add xmlns:v="urn:schemas-microsoft-com:vml" and xmlns:o="urn:schemas-microsoft-com:office:office" to <html> tag' });
  } else if (hasXMLNS) {
    findings.push({ severity: 'pass', message: 'VML namespaces declared' });
  }

  // DPI scaling issue
  const hasXMSO = /mso-dpi/i.test(content) || /<meta[^>]*name=["']x-apple-disable-message-reformatting["']/i.test(content);
  if (!hasXMSO) {
    findings.push({ severity: 'info', message: 'Consider DPI scaling fixes', detail: 'Outlook on high-DPI displays may scale images. Add <!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->' });
  }

  // Check for role="presentation" on tables (helps accessibility but also Outlook rendering)
  const tableCount = (content.match(/<table/gi) || []).length;
  const cellspacing = (content.match(/<table[^>]*cellspacing/gi) || []).length;
  const cellpadding = (content.match(/<table[^>]*cellpadding/gi) || []).length;
  if (tableCount > 0 && (cellspacing < tableCount || cellpadding < tableCount)) {
    findings.push({ severity: 'info', message: 'Some tables missing cellspacing/cellpadding attributes', detail: 'Outlook adds default spacing. Set cellspacing="0" cellpadding="0" on all tables' });
  }

  return { findings, score: calcScore(findings) };
}

// --- Main Analysis Runner ---

const CATEGORY_WEIGHTS: Record<string, number> = {
  deliverability: 0.25,
  spam: 0.20,
  content: 0.15,
  compatibility: 0.15,
  code: 0.15,
  accessibility: 0.10,
};

export function runFullAnalysis(
  content: string,
  subject: string,
  preheaderText: string,
): FullAnalysisResults {
  const sanitized = sanitizeHTML(content);

  const subjectResult = analyzeSubjectLine(subject);
  const preheaderResult = analyzePreheader(preheaderText, subject, sanitized);
  const contentResult = analyzeContent(sanitized);
  const ctaResult = analyzeCTA(sanitized);
  const aiSummaryResult = analyzeAISummary(sanitized, subject, preheaderText);
  const spamResult = analyzeSpam(sanitized, subject);
  const deliverabilityResult = analyzeDeliverability(sanitized);
  const darkModeResult = analyzeDarkMode(sanitized);
  const ampResult = analyzeAMP(sanitized);
  const structuredDataResult = analyzeStructuredData(sanitized);
  const emailWeightResult = analyzeEmailWeight(sanitized);
  const responsiveResult = analyzeResponsive(sanitized);
  const fontStackResult = analyzeFontStack(sanitized);
  const linkQualityResult = analyzeLinkQuality(sanitized);
  const interactiveResult = analyzeInteractiveElements(sanitized);
  const accessibilityResult = analyzeAccessibility(sanitized);
  const codeQualityResult = analyzeCodeQuality(sanitized);
  const outlookCompatResult = analyzeOutlookCompat(sanitized);

  // Category scores (weighted average)
  const categoryScores = {
    deliverability: (deliverabilityResult.score + spamResult.score) / 2,
    spam: spamResult.score,
    content: (subjectResult.score + preheaderResult.score + contentResult.score + ctaResult.score + aiSummaryResult.score) / 5,
    compatibility: (darkModeResult.score + ampResult.score + responsiveResult.score + interactiveResult.score + structuredDataResult.score + outlookCompatResult.score) / 6,
    code: (codeQualityResult.score + emailWeightResult.score + fontStackResult.score + linkQualityResult.score) / 4,
    accessibility: accessibilityResult.score,
  };

  let overall = Math.round(
    Object.entries(CATEGORY_WEIGHTS).reduce(
      (sum, [key, weight]) => sum + categoryScores[key as keyof typeof categoryScores] * weight,
      0,
    ),
  );

  // Global floor: if the email lacks basic HTML structure, cap overall score harshly
  const hasBasicStructure = /<html/i.test(sanitized) && /<body/i.test(sanitized);
  const hasMinContent = stripHTML(sanitized).split(/\s+/).filter(w => w.length > 0).length >= 20;
  if (!hasBasicStructure) {
    overall = Math.min(overall, 10);
  } else if (!hasMinContent) {
    overall = Math.min(overall, 20);
  }

  return {
    overall,
    subject: subjectResult,
    preheader: preheaderResult,
    content: contentResult,
    cta: ctaResult,
    aiSummary: aiSummaryResult,
    spam: spamResult,
    deliverability: deliverabilityResult,
    darkMode: darkModeResult,
    amp: ampResult,
    structuredData: structuredDataResult,
    emailWeight: emailWeightResult,
    responsive: responsiveResult,
    fontStack: fontStackResult,
    linkQuality: linkQualityResult,
    interactiveElements: interactiveResult,
    accessibility: accessibilityResult,
    codeQuality: codeQualityResult,
    outlookCompat: outlookCompatResult,
  };
}
