import { T } from '../App.jsx';

function inlineFormat(text) {
  const parts = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0, match, key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(<span key={key++}>{text.slice(last, match.index)}</span>);
    if (match[2]) parts.push(<strong key={key++}><em>{match[2]}</em></strong>);
    else if (match[3]) parts.push(<strong key={key++} style={{ color: T.INK, fontWeight: 700 }}>{match[3]}</strong>);
    else if (match[4]) parts.push(<em key={key++} style={{ color: T.CYAN }}>{match[4]}</em>);
    else if (match[5]) parts.push(<code key={key++} style={{ background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 4, padding: '1px 5px', fontSize: 12, fontFamily: 'monospace', color: '#a8d8ea' }}>{match[5]}</code>);
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(<span key={key++}>{text.slice(last)}</span>);
  return parts.length ? parts : text;
}

export default function MarkdownPreview({ content }) {
  if (!content?.trim()) {
    return (
      <div style={{ color: T.MUTED, fontFamily: 'Inter, sans-serif', fontSize: 14,
        textAlign: 'center', padding: '3rem' }}>
        No hay contenido para previsualizar.
      </div>
    );
  }

  const lines = content.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { elements.push(<div key={i} style={{ height: 8 }} />); i++; continue; }

    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: `1px solid ${T.BORDER}`, margin: '1rem 0' }} />);
      i++; continue;
    }

    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);
    if (h1) { elements.push(<h1 key={i} style={{ fontSize: 22, fontWeight: 700, color: T.INK, fontFamily: "'Space Grotesk', sans-serif", margin: '1.4rem 0 0.5rem' }}>{inlineFormat(h1[1])}</h1>); i++; continue; }
    if (h2) { elements.push(<h2 key={i} style={{ fontSize: 17, fontWeight: 700, color: T.INK, fontFamily: "'Space Grotesk', sans-serif", margin: '1.2rem 0 0.4rem', borderBottom: `1px solid ${T.BORDER}`, paddingBottom: 6 }}>{inlineFormat(h2[1])}</h2>); i++; continue; }
    if (h3) { elements.push(<h3 key={i} style={{ fontSize: 14, fontWeight: 700, color: T.ACCENT, fontFamily: "'Space Grotesk', sans-serif", margin: '1rem 0 0.3rem', letterSpacing: 0.5 }}>{inlineFormat(h3[1])}</h3>); i++; continue; }

    if (line.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      elements.push(
        <pre key={i} style={{ background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 8,
          padding: '0.8rem 1rem', fontSize: 12, color: '#a8d8ea', fontFamily: 'monospace',
          overflowX: 'auto', margin: '0.5rem 0' }}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      i++; continue;
    }

    if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(<li key={i} style={{ marginBottom: 4, lineHeight: 1.65 }}>{inlineFormat(lines[i].replace(/^[-*] /, ''))}</li>);
        i++;
      }
      elements.push(<ul key={`ul-${i}`} style={{ paddingLeft: 20, margin: '0.4rem 0', color: 'rgba(240,240,245,0.8)', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>{items}</ul>);
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(<li key={i} style={{ marginBottom: 4, lineHeight: 1.65 }}>{inlineFormat(lines[i].replace(/^\d+\. /, ''))}</li>);
        i++;
      }
      elements.push(<ol key={`ol-${i}`} style={{ paddingLeft: 20, margin: '0.4rem 0', color: 'rgba(240,240,245,0.8)', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>{items}</ol>);
      continue;
    }

    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} style={{ borderLeft: `3px solid ${T.ACCENT}`, paddingLeft: 12, margin: '0.5rem 0',
          color: T.MUTED, fontStyle: 'italic', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
          {inlineFormat(line.replace(/^> /, ''))}
        </blockquote>
      );
      i++; continue;
    }

    elements.push(
      <p key={i} style={{ margin: '0.2rem 0', fontSize: 14, lineHeight: 1.75,
        color: 'rgba(240,240,245,0.82)', fontFamily: 'Inter, sans-serif' }}>
        {inlineFormat(line)}
      </p>
    );
    i++;
  }

  return <div style={{ padding: '0.5rem 0' }}>{elements}</div>;
}
