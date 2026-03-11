'use client';

import { useState } from 'react';
import { Monitor, Smartphone, Globe } from 'lucide-react';
import { EmailClient } from '@/types';

interface ClientGroup {
  label: string;
  clients: EmailClient[];
}

const clientGroups: ClientGroup[] = [
  {
    label: 'Outlook',
    clients: [
      { id: 'outlook-2019', name: 'Outlook 2019/2021', type: 'desktop' },
      { id: 'outlook-365', name: 'Outlook 365 (New)', type: 'desktop' },
      { id: 'outlook-web', name: 'Outlook.com (Web)', type: 'desktop' },
      { id: 'outlook-mobile', name: 'Outlook (Mobile)', type: 'mobile' },
    ],
  },
  {
    label: 'Gmail',
    clients: [
      { id: 'gmail-desktop', name: 'Gmail (Desktop)', type: 'desktop' },
      { id: 'gmail-mobile', name: 'Gmail (Mobile)', type: 'mobile' },
    ],
  },
  {
    label: 'Apple',
    clients: [
      { id: 'apple-mail', name: 'Apple Mail', type: 'desktop' },
      { id: 'iphone', name: 'iPhone Mail', type: 'mobile' },
    ],
  },
  {
    label: 'Other',
    clients: [
      { id: 'yahoo-desktop', name: 'Yahoo (Desktop)', type: 'desktop' },
      { id: 'yahoo-mobile', name: 'Yahoo (Mobile)', type: 'mobile' },
      { id: 'thunderbird', name: 'Thunderbird', type: 'desktop' },
    ],
  },
];

const allClients = clientGroups.flatMap(g => g.clients);

// Client-specific CSS overrides that simulate real rendering quirks
function getClientCSS(clientId: string): string {
  switch (clientId) {
    // Outlook 2019/2021 uses Word rendering engine — extremely limited CSS
    case 'outlook-2019':
      return `
        /* === WORD RENDERING ENGINE SIMULATION === */
        /* No border-radius anywhere */
        * { border-radius: 0 !important; -webkit-border-radius: 0 !important; }
        /* No CSS background images — Word strips them */
        [style*="background-image"] { background-image: none !important; }
        [style*="background:"] { background-image: none !important; }
        /* No max-width — Word doesn't understand it */
        * { max-width: none !important; }
        /* No margin: auto centering — must use align="center" */
        [style*="margin: 0 auto"], [style*="margin:0 auto"], [style*="margin: auto"],
        [style*="margin-left: auto"], [style*="margin-right: auto"] {
          margin-left: 0 !important; margin-right: 0 !important;
        }
        /* Padding on <a> tags is completely ignored */
        a { padding: 0 !important; }
        /* No CSS animations, transitions, or transforms */
        * { animation: none !important; transition: none !important; transform: none !important; }
        /* Word adds gaps between tables */
        table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { display: block; border: 0; outline: none; text-decoration: none; }
        /* No flexbox or grid */
        [style*="display: flex"], [style*="display:flex"] { display: block !important; }
        [style*="display: grid"], [style*="display:grid"] { display: block !important; }
        /* No opacity */
        [style*="opacity"] { opacity: 1 !important; }
        /* No box-shadow */
        * { box-shadow: none !important; }
        /* No CSS gradients */
        [style*="gradient"] { background-image: none !important; }
        /* Word engine line-height behaves differently */
        p { margin: 0; mso-line-height-rule: exactly; }
        /* No object-fit */
        img { object-fit: unset !important; }
        /* No text-shadow */
        * { text-shadow: none !important; }
      `;

    // Outlook 365 (New) uses web rendering — much better than Word engine
    case 'outlook-365':
      return `
        /* New Outlook is web-based, similar to Outlook.com */
        img { display: block; max-width: 100%; }
        /* Strips some <style> block rules */
        @media screen { /* preserved */ }
      `;

    // Outlook.com (Web)
    case 'outlook-web':
      return `
        /* Outlook.com strips <style> from <head>, keeps inline styles */
        img { display: block; max-width: 100%; }
        /* Strips position: absolute/relative */
        [style*="position: absolute"], [style*="position: relative"] {
          position: static !important;
        }
      `;

    // Gmail Desktop — strips <style> from <head>, no <link>, no @media in <head>
    case 'gmail-desktop':
      return `
        /* Gmail strips margin/padding on body */
        body { margin: 0 !important; padding: 0 !important; }
        img { display: block; }
        /* Gmail wraps content in a div, overriding some table widths */
        table { max-width: 100%; }
      `;

    // Gmail Mobile — same as desktop but narrower viewport
    case 'gmail-mobile':
      return `
        body { margin: 0 !important; padding: 0 !important; }
        img { display: block; max-width: 100% !important; height: auto !important; }
        table { width: 100% !important; max-width: 100% !important; }
        td { display: block !important; width: 100% !important; }
      `;

    // Apple Mail — best rendering, supports most CSS
    case 'apple-mail':
      return `
        /* Apple Mail has excellent CSS support including animations, web fonts */
        img { max-width: 100%; }
      `;

    // iPhone Mail
    case 'iphone':
      return `
        /* iOS Mail auto-scales small text to 13px min */
        body { -webkit-text-size-adjust: 100%; }
        img { max-width: 100% !important; height: auto !important; }
        /* iOS may auto-link dates, addresses, phone numbers */
      `;

    // Yahoo — strips <style> in <head>, limited CSS support
    case 'yahoo-desktop':
      return `
        img { display: block; }
        /* Yahoo adds its own wrapper styles */
        body { margin: 0; padding: 0; }
      `;

    case 'yahoo-mobile':
      return `
        img { display: block; max-width: 100% !important; height: auto !important; }
        table { width: 100% !important; }
        body { margin: 0; padding: 0; }
      `;

    // Outlook Mobile — decent web-based rendering
    case 'outlook-mobile':
      return `
        img { display: block; max-width: 100% !important; height: auto !important; }
        table { width: 100% !important; }
        body { margin: 0; padding: 0; }
      `;

    // Thunderbird — decent rendering, similar to Firefox
    case 'thunderbird':
      return `
        img { display: block; }
        body { margin: 0; padding: 0; }
      `;

    default:
      return '';
  }
}

// Client-specific rendering warnings
function getClientWarnings(clientId: string, content: string): string[] {
  const warnings: string[] = [];

  if (clientId === 'outlook-2019') {
    // Word rendering engine: extremely limited CSS
    if (/border-radius/i.test(content)) warnings.push('border-radius completely ignored — use VML for rounded corners');
    if (/max-width/i.test(content)) warnings.push('max-width not supported — use fixed width attributes');
    if (/background\s*:/i.test(content) && /url\s*\(/i.test(content)) warnings.push('CSS background images stripped — use VML for background images');
    if (/(?:^|\s)background\s*:/im.test(content) && !/background-color/i.test(content)) warnings.push('background shorthand ignored — use background-color explicitly');
    if (/display\s*:\s*(flex|grid)/i.test(content)) warnings.push('Flexbox/Grid completely unsupported — use tables');
    if (/@media/i.test(content)) warnings.push('Media queries completely ignored — email is NOT responsive');
    if (/margin\s*:\s*\d*\s*auto/i.test(content)) warnings.push('margin: auto ignored — use align="center" on tables');
    if (/@font-face|fonts\.googleapis/i.test(content)) warnings.push('Web fonts not supported — falls back to system fonts');
    if (/animation|@keyframes|transition/i.test(content)) warnings.push('Animations/transitions/transforms completely stripped');
    if (/box-shadow/i.test(content)) warnings.push('box-shadow not supported');
    if (/opacity\s*:/i.test(content)) warnings.push('CSS opacity not supported');
    if (/text-shadow/i.test(content)) warnings.push('text-shadow not supported');
    if (/float\s*:\s*(left|right)/i.test(content)) warnings.push('CSS float is unreliable — use table cells');
    if (/<a[^>]*style[^>]*padding/i.test(content)) warnings.push('Padding on <a> tags completely ignored — use VML buttons');
    if (/line-height/i.test(content)) warnings.push('line-height rendering differs from web — may add extra spacing');
    if (/<div/i.test(content) && !/<table/i.test(content)) warnings.push('div-based layout will collapse — Word engine requires tables');
    if (/object-fit/i.test(content)) warnings.push('object-fit not supported');
    if (/gradient/i.test(content)) warnings.push('CSS gradients not supported — use VML or solid colors');
    if (!(/<!--\[if\s+(?:mso|gte\s+mso)/i.test(content))) warnings.push('No MSO conditional comments detected — consider adding Outlook-specific fixes');
  }

  if (clientId === 'outlook-365') {
    if (/<!--\[if\s+mso/i.test(content)) warnings.push('MSO conditionals may behave differently than classic Outlook');
  }

  if (clientId === 'outlook-web') {
    if (/<style[^>]*>[\s\S]*?<\/style>/i.test(content)) warnings.push('Some <style> rules may be stripped');
    if (/position\s*:\s*(absolute|relative)/i.test(content)) warnings.push('position: absolute/relative stripped');
  }

  if (clientId.startsWith('gmail')) {
    if (/<style[^>]*>[\s\S]*?<\/style>/i.test(content) && !(/style=/i.test(content))) {
      warnings.push('Gmail strips <style> from <head> — use inline styles');
    }
    if (/@media/i.test(content)) warnings.push('Gmail has limited @media support');
    if (/@font-face|fonts\.googleapis/i.test(content)) warnings.push('Web fonts not supported');
  }

  if (clientId === 'iphone') {
    const smallFonts = content.match(/font-size\s*:\s*(\d+)px/gi) || [];
    const hasSmall = smallFonts.some(m => parseInt(m.replace(/[^0-9]/g, '')) < 13);
    if (hasSmall) warnings.push('iOS auto-scales text below 13px');
  }

  if (clientId.startsWith('yahoo')) {
    if (/<style[^>]*>[\s\S]*?<\/style>/i.test(content)) warnings.push('Yahoo may strip <style> blocks');
  }

  return warnings;
}

function getClientIcon(clientId: string) {
  if (clientId.includes('mobile') || clientId === 'iphone') return Smartphone;
  if (clientId.includes('web') || clientId === 'outlook-365') return Globe;
  return Monitor;
}

function getViewportWidth(clientId: string): number | '100%' {
  switch (clientId) {
    case 'gmail-mobile':
    case 'iphone':
    case 'outlook-mobile':
    case 'yahoo-mobile':
      return 375;
    case 'outlook-2019':
      return 700; // Word engine fixed viewport
    default:
      return '100%';
  }
}

interface ClientPreviewProps {
  content: string;
  subjectLine: string;
  preheader: string;
}

export default function ClientPreview({ content, subjectLine, preheader }: ClientPreviewProps) {
  const [selectedClient, setSelectedClient] = useState('outlook-2019');
  const client = allClients.find(c => c.id === selectedClient);
  const isMobile = client?.type === 'mobile';
  const viewportWidth = getViewportWidth(selectedClient);
  const warnings = getClientWarnings(selectedClient, content);
  const Icon = getClientIcon(selectedClient);

  const clientCSS = getClientCSS(selectedClient);

  // Strip <style> blocks for clients that don't support them
  const stripsHeadStyles = ['gmail-desktop', 'gmail-mobile'].includes(selectedClient);
  let processedContent = content;
  if (stripsHeadStyles) {
    // Simulate Gmail stripping <style> from <head> (but not inline styles)
    processedContent = content.replace(/<head[\s\S]*?<\/head>/gi, (headBlock) => {
      return headBlock.replace(/<style[\s\S]*?<\/style>/gi, '<!-- [style stripped by Gmail] -->');
    });
  }

  const previewHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #000; }
        .preview-header { padding: 12px 16px; background: #f3f4f6; border-bottom: 1px solid #e5e7eb; }
        .preview-subject { font-weight: 700; color: #000; font-size: 15px; }
        .preview-preheader { font-size: 14px; color: #4b5563; margin-top: 4px; }
        .preview-body { padding: 0; }
        /* Client-specific overrides */
        ${clientCSS}
      </style>
    </head>
    <body>
      <div class="preview-header">
        <div class="preview-subject">${subjectLine.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        ${preheader ? `<div class="preview-preheader">${preheader.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
      </div>
      <div class="preview-body">
        ${processedContent}
      </div>
    </body>
    </html>
  `;

  return (
    <div>
      <h3 className="text-base font-bold mb-4 text-black">Email Client Previews</h3>

      {/* Client selector grouped by platform */}
      <div className="space-y-4 mb-6">
        {clientGroups.map(group => (
          <div key={group.label}>
            <div className="text-xs font-bold uppercase tracking-wider mb-2 text-gray-500">{group.label}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {group.clients.map(ec => {
                const ClientIcon = getClientIcon(ec.id);
                return (
                  <button
                    key={ec.id}
                    onClick={() => setSelectedClient(ec.id)}
                    className={`flex flex-col items-center gap-1.5 p-2.5 border-2 rounded-lg transition-all text-sm ${
                      selectedClient === ec.id
                        ? 'text-black'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                    style={selectedClient === ec.id ? { borderColor: '#0167b4', background: '#f0f7fd' } : {}}
                  >
                    <ClientIcon className="w-4 h-4" />
                    <span className="font-medium text-xs text-center leading-tight">{ec.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Rendering warnings */}
      {warnings.length > 0 && (
        <div className="mb-4 px-4 py-3 rounded-lg border" style={{ background: '#fffbeb', borderColor: '#f59e0b' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#92400e' }}>
            Rendering Warnings for {client?.name}
          </div>
          <ul className="space-y-1">
            {warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-900 flex items-start gap-1.5">
                <span className="mt-0.5">⚠</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview frame */}
      <div className="border-2 border-gray-300 rounded-xl overflow-hidden bg-gray-50">
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 border-b border-gray-200">
          <Icon className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-black">{client?.name}</span>
          <span className="text-xs text-gray-500 ml-auto">
            {typeof viewportWidth === 'number' ? `${viewportWidth}px` : 'Full width'}
          </span>
        </div>
        <div className="flex justify-center p-4 bg-gray-50" style={{ minHeight: 400 }}>
          <iframe
            title={`${client?.name} preview`}
            srcDoc={previewHTML}
            sandbox="allow-same-origin"
            className="border border-gray-200 rounded-lg bg-white shadow-sm"
            style={{
              width: typeof viewportWidth === 'number' ? viewportWidth : '100%',
              maxWidth: isMobile ? 375 : 700,
              height: 500,
            }}
          />
        </div>
      </div>
    </div>
  );
}