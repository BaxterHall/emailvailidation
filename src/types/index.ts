export type Severity = 'critical' | 'warning' | 'info' | 'pass';

export interface Finding {
  severity: Severity;
  message: string;
  detail?: string;
}

export interface AnalysisResult {
  findings: Finding[];
  score: number;
  meta?: Record<string, unknown>;
}

export interface CTAItem {
  text: string;
  href: string;
  type: string;
  hasButtonStyling: boolean;
  position: number;
  isAboveFold: boolean;
}

export interface CTAAnalysisResult extends AnalysisResult {
  meta: {
    ctas: CTAItem[];
    aboveFoldCTAs: number;
    belowFoldCTAs: number;
  };
}

export interface AISummaryResult extends AnalysisResult {
  meta: {
    mobileAISummary: string;
    desktopAISummary: string;
    extractedElements: {
      keyPhrases: string[];
      numbers: string[];
      primaryAction: string;
      sentenceCount: number;
      wordCount: number;
    };
  };
}

export interface SpamResult extends AnalysisResult {
  meta: {
    spamScore: number;
    spamRating: string;
    spamColor: string;
  };
}

export interface EmailWeightResult extends AnalysisResult {
  meta: {
    htmlSizeKB: number;
    imageCount: number;
    willBeClipped: boolean;
    nestedTableDepth: number;
  };
}

export interface FullAnalysisResults {
  overall: number;
  subject: AnalysisResult;
  preheader: AnalysisResult;
  content: AnalysisResult;
  cta: CTAAnalysisResult;
  aiSummary: AISummaryResult;
  spam: SpamResult;
  deliverability: AnalysisResult;
  darkMode: AnalysisResult;
  amp: AnalysisResult;
  structuredData: AnalysisResult;
  emailWeight: EmailWeightResult;
  responsive: AnalysisResult;
  fontStack: AnalysisResult;
  linkQuality: AnalysisResult;
  interactiveElements: AnalysisResult;
  accessibility: AnalysisResult;
  codeQuality: AnalysisResult;
  outlookCompat: AnalysisResult;
}

export interface Publication {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface EmailClient {
  id: string;
  name: string;
  type: 'desktop' | 'mobile';
}

export type TabId = 'overview' | 'deliverability' | 'content' | 'compatibility' | 'code' | 'accessibility';

export interface Tab {
  id: TabId;
  name: string;
  icon: string;
}
