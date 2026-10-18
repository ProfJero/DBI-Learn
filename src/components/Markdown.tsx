import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Link } from 'react-router-dom';
import { Lightbulb, AlertTriangle, Info, CheckCircle2, Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { img } from '@/lib/media';
import { tryItLink } from '@/features/codelab/projects';

const CALLOUTS: Record<string, { icon: ReactNode; cls: string; label: string }> = {
  TIP: { icon: <Lightbulb className="h-4 w-4" />, cls: 'border-brand-300 bg-brand-50 text-brand-900 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-100', label: 'Tip' },
  NOTE: { icon: <Info className="h-4 w-4" />, cls: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100', label: 'Note' },
  WARNING: { icon: <AlertTriangle className="h-4 w-4" />, cls: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100', label: 'Watch out' },
  TRY: { icon: <CheckCircle2 className="h-4 w-4" />, cls: 'border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100', label: 'Try it yourself' },
};

function textOf(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node && typeof node === 'object' && 'props' in node) return textOf((node as { props: { children?: ReactNode } }).props.children);
  return '';
}

/** Puts each `> [!TIP]` marker in its own paragraph so the callout body isn't hidden with it. */
export function splitCalloutMarkers(md: string) {
  return md.replace(/^(>[ \t]?\[!(?:TIP|NOTE|WARNING|TRY)\])[ \t]*\n(?=>[ \t]*\S)/gm, '$1\n>\n');
}

/** Renders lesson markdown with GFM tables, syntax highlighting and `> [!TIP]` style callouts. */
/** With `tryIt`, runnable code blocks get a button that opens them in the Code Lab. */
export function Markdown({ children, className, tryIt }: { children: string; className?: string; tryIt?: boolean }) {
  return (
    <div className={cn('lesson-prose', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
              {children}
            </a>
          ),
          img: ({ src, alt }) => <img src={typeof src === 'string' ? img(src, 900) : undefined} alt={alt ?? ''} loading="lazy" />,
          blockquote: ({ children }) => {
            const text = textOf(children).trim();
            const m = text.match(/^\[!(TIP|NOTE|WARNING|TRY)\]/);
            if (!m) return <blockquote>{children}</blockquote>;
            const c = CALLOUTS[m[1]!]!;
            return (
              <div className={cn('not-prose my-5 rounded-xl border-l-4 px-4 py-3 text-[15px] leading-relaxed', c.cls)}>
                <p className="mb-1 flex items-center gap-1.5 text-sm font-bold">
                  {c.icon}
                  {c.label}
                </p>
                <div className="[&_p]:my-1 [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em] [&>p:first-child]:hidden">{children}</div>
              </div>
            );
          },
          pre: ({ children }) => {
            const code = Array.isArray(children) ? children[0] : children;
            const cls = (code as { props?: { className?: string } } | undefined)?.props?.className ?? '';
            const lang = cls.match(/language-([\w-]+)/)?.[1];
            const link = tryIt && lang ? tryItLink(lang, textOf(children).replace(/\n$/, '')) : null;
            if (!link) return <pre>{children}</pre>;
            return (
              <div className="relative">
                <pre>{children}</pre>
                <Link
                  to={link.to}
                  state={link.state}
                  className="not-prose absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1 text-xs font-bold text-white shadow hover:bg-brand-600"
                >
                  <Play className="h-3 w-3 fill-current" /> Try it
                </Link>
              </div>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {splitCalloutMarkers(children)}
      </ReactMarkdown>
    </div>
  );
}
