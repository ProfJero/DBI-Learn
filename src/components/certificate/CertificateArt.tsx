import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/great-vibes/400.css';
import type { Certificate } from '@/lib/types';
import { BRAND, SITE_URL } from '@/lib/config';
import { formatDate } from '@/lib/utils';

export const CERT_W = 1123; // A4 landscape at 96dpi
export const CERT_H = 794;

type Theme = { primary: string; deep: string; accent: string; title: string; subtitle: string };

const THEMES: Record<Certificate['kind'], Theme> = {
  completion: { primary: '#03c14b', deep: '#0b3d24', accent: '#c9a227', title: 'Certificate', subtitle: 'of Completion' },
  distinction: { primary: '#b8891d', deep: '#3a2a06', accent: '#d4a72c', title: 'Certificate', subtitle: 'of Completion with Distinction' },
  participation: { primary: '#0b7be8', deep: '#0e2a4f', accent: '#c9a227', title: 'Certificate', subtitle: 'of Participation' },
  achievement: { primary: '#7c3aed', deep: '#2a1157', accent: '#c9a227', title: 'Certificate', subtitle: 'of Achievement' },
};

/** Hypotrochoid path — the spirograph curves used in banknote guilloché security patterns. */
function guilloche(cx: number, cy: number, R: number, r: number, d: number, steps = 1400, scale = 1) {
  const k = (R - r) / r;
  const turns = r / gcd(Math.round(R), Math.round(r));
  let path = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * turns;
    const x = cx + scale * ((R - r) * Math.cos(t) + d * Math.cos(k * t));
    const y = cy + scale * ((R - r) * Math.sin(t) - d * Math.sin(k * t));
    path += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return path + 'Z';
}
function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** Wave band along an edge, like the borders of banknotes. */
function waveBand(x0: number, x1: number, y: number, amp: number, period: number, phase: number) {
  let p = '';
  for (let x = x0; x <= x1; x += 2) {
    const yy = y + amp * Math.sin(((x - x0) / period) * Math.PI * 2 + phase);
    p += `${x === x0 ? 'M' : 'L'}${x} ${yy.toFixed(1)}`;
  }
  return p;
}

function Seal({ theme, year }: { theme: Theme; year: string }) {
  const rays = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    const r1 = i % 2 ? 54 : 60;
    return `${(70 + r1 * Math.cos(a)).toFixed(1)},${(70 + r1 * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  const inner = useMemo(() => guilloche(70, 70, 40, 7, 13, 900, 0.95), []);
  return (
    <svg width="140" height="170" viewBox="0 0 140 170" aria-hidden>
      <defs>
        <linearGradient id="foil" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e7a8" />
          <stop offset=".35" stopColor="#d4a72c" />
          <stop offset=".6" stopColor="#f3dc9b" />
          <stop offset="1" stopColor="#9c7414" />
        </linearGradient>
        <linearGradient id="ribbon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={theme.primary} />
          <stop offset="1" stopColor={theme.deep} />
        </linearGradient>
      </defs>
      <path d="M48 110 L36 166 L52 156 L60 170 L70 116 Z" fill="url(#ribbon)" />
      <path d="M92 110 L104 166 L88 156 L80 170 L70 116 Z" fill="url(#ribbon)" />
      <polygon points={rays} fill="url(#foil)" stroke="#9c7414" strokeWidth=".6" />
      <circle cx="70" cy="70" r="49" fill="none" stroke="#fff8dc" strokeWidth="1.2" opacity=".9" />
      <circle cx="70" cy="70" r="45" fill="url(#foil)" stroke="#9c7414" strokeWidth=".8" />
      <path d={inner} fill="none" stroke="#8a6512" strokeWidth=".35" opacity=".55" />
      <circle cx="70" cy="70" r="27" fill={theme.deep} stroke="#f3dc9b" strokeWidth="1.5" />
      <text x="70" y="69" textAnchor="middle" fontFamily="'Cormorant Garamond', serif" fontWeight="700" fontSize="18" fill="#f6e7a8" letterSpacing="1">
        DBI
      </text>
      <text x="70" y="84" textAnchor="middle" fontFamily="Inter Variable, sans-serif" fontWeight="700" fontSize="8" fill="#f6e7a8" letterSpacing="2">
        {year}
      </text>
      <path id="sealArc" d="M 70 70 m -36 0 a 36 36 0 1 1 72 0" fill="none" />
      <text fontFamily="Inter Variable, sans-serif" fontSize="6.4" fontWeight="700" fill="#5c430b" letterSpacing="1.6">
        <textPath href="#sealArc" startOffset="50%" textAnchor="middle">
          VERIFIED · DIGITAL BRIDGE INITIATIVE
        </textPath>
      </text>
    </svg>
  );
}

export const CertificateArt = forwardRef<HTMLDivElement, { cert: Certificate }>(function CertificateArt({ cert }, ref) {
  const theme = THEMES[cert.kind] ?? THEMES.completion;
  const verifyUrl = `${SITE_URL}/verify/${cert.serial}`;
  const [qr, setQr] = useState('');
  useEffect(() => {
    QRCode.toDataURL(verifyUrl, { margin: 0, width: 220, errorCorrectionLevel: 'M', color: { dark: theme.deep, light: '#00000000' } }).then(setQr);
  }, [verifyUrl, theme.deep]);

  const patterns = useMemo(
    () => ({
      rosetteL: guilloche(0, 0, 150, 23, 61),
      rosetteR: guilloche(0, 0, 130, 19, 54),
      center: guilloche(0, 0, 210, 31, 88, 2200),
      bandsTop: [0, 1, 2, 3].map((i) => waveBand(60, CERT_W - 60, 44, 4, 22, i * 0.8)),
      bandsBottom: [0, 1, 2, 3].map((i) => waveBand(60, CERT_W - 60, CERT_H - 44, 4, 22, i * 0.8 + 1.4)),
    }),
    [],
  );

  const year = new Date(cert.issued_at).getFullYear().toString();
  const sigs = cert.signatories?.length ? cert.signatories.slice(0, 2) : [{ name: 'Benjamin Amoako', title: 'Executive Director', signature_url: '/images/signatures/executive-director.png' }];
  const nameSize = cert.recipient_name.length > 30 ? 52 : cert.recipient_name.length > 22 ? 62 : 72;
  const titleSize = cert.course_title.length > 48 ? 22 : cert.course_title.length > 32 ? 26 : 30;
  const isRevoked = cert.status === 'revoked';

  return (
    <div
      ref={ref}
      style={{ width: CERT_W, height: CERT_H, fontFamily: "'Inter Variable', Inter, sans-serif" }}
      className="relative overflow-hidden bg-[#fffdf6] text-[#1d2a22]"
    >
      {/* Paper + security patterns */}
      <svg className="absolute inset-0" width={CERT_W} height={CERT_H} aria-hidden>
        <defs>
          <radialGradient id="paper" cx="50%" cy="45%" r="75%">
            <stop offset="0" stopColor="#fffef9" />
            <stop offset="1" stopColor="#f6efd9" />
          </radialGradient>
          <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={theme.deep} />
            <stop offset=".5" stopColor={theme.primary} />
            <stop offset="1" stopColor={theme.deep} />
          </linearGradient>
          <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#9c7414" />
            <stop offset=".5" stopColor="#f3dc9b" />
            <stop offset="1" stopColor="#9c7414" />
          </linearGradient>
          <pattern id="micro" width="180" height="10" patternUnits="userSpaceOnUse">
            <text x="0" y="7" fontSize="5" fill={theme.primary} opacity=".22" fontFamily="Inter Variable, sans-serif" letterSpacing=".5">
              DIGITAL BRIDGE INITIATIVE · DBI LEARN ·
            </text>
          </pattern>
        </defs>
        <rect width={CERT_W} height={CERT_H} fill="url(#paper)" />
        <g transform={`translate(${CERT_W / 2} ${CERT_H / 2 + 10})`} opacity=".07">
          <path d={patterns.center} fill="none" stroke={theme.primary} strokeWidth=".6" />
        </g>
        <g transform="translate(70 110)" opacity=".12">
          <path d={patterns.rosetteL} fill="none" stroke={theme.primary} strokeWidth=".45" />
        </g>
        <g transform={`translate(${CERT_W - 70} ${CERT_H - 110})`} opacity=".12">
          <path d={patterns.rosetteR} fill="none" stroke={theme.primary} strokeWidth=".45" />
        </g>
        {/* Outer frame */}
        <rect x="14" y="14" width={CERT_W - 28} height={CERT_H - 28} fill="none" stroke="url(#frame)" strokeWidth="10" />
        <rect x="26" y="26" width={CERT_W - 52} height={CERT_H - 52} fill="none" stroke="url(#gold)" strokeWidth="2" />
        <rect x="32" y="32" width={CERT_W - 64} height={CERT_H - 64} fill="url(#micro)" opacity=".9" />
        <rect x="40" y="40" width={CERT_W - 80} height={CERT_H - 80} fill="#fffdf6" opacity=".93" />
        <rect x="40" y="40" width={CERT_W - 80} height={CERT_H - 80} fill="none" stroke={theme.primary} strokeWidth=".8" opacity=".6" />
        {patterns.bandsTop.map((d, i) => (
          <path key={`t${i}`} d={d} fill="none" stroke={i % 2 ? theme.accent : theme.primary} strokeWidth=".5" opacity=".55" />
        ))}
        {patterns.bandsBottom.map((d, i) => (
          <path key={`b${i}`} d={d} fill="none" stroke={i % 2 ? theme.accent : theme.primary} strokeWidth=".5" opacity=".55" />
        ))}
        {/* Corner ornaments */}
        {[
          [40, 40, 0],
          [CERT_W - 40, 40, 90],
          [CERT_W - 40, CERT_H - 40, 180],
          [40, CERT_H - 40, 270],
        ].map(([x, y, rot]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${rot})`}>
            <path d="M0 0 L46 0 M0 0 L0 46" stroke="url(#gold)" strokeWidth="3" />
            <path d="M8 8 L30 8 M8 8 L8 30" stroke={theme.primary} strokeWidth="1.2" />
            <circle cx="8" cy="8" r="3.2" fill="url(#gold)" />
            <path d="M14 14 q 14 2 18 18 q -16 -4 -18 -18 z" fill={theme.primary} opacity=".55" />
          </g>
        ))}
      </svg>

      {isRevoked && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <span className="-rotate-12 rounded-xl border-[6px] border-red-600/70 px-10 py-3 text-7xl font-black tracking-widest text-red-600/70">REVOKED</span>
        </div>
      )}

      {/* Content */}
      <div className="absolute inset-0 z-10 flex flex-col items-center px-[110px] pt-[68px] text-center">
        <div className="flex items-center gap-3">
          <img src="/brand/emblem.png" alt="" width={54} height={54} crossOrigin="anonymous" />
          <div className="text-left leading-tight">
            <div className="text-[15px] font-extrabold tracking-[0.32em]" style={{ color: theme.deep }}>
              DIGITAL BRIDGE INITIATIVE
            </div>
            <div className="text-[11px] font-semibold tracking-[0.25em]" style={{ color: theme.primary }}>
              DBI LEARN · {BRAND.tagline.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="mt-6 font-serif font-bold leading-none tracking-[0.06em]" style={{ fontSize: 66, color: theme.deep }}>
          {theme.title}
        </div>
        <div className="mt-1 flex items-center gap-4">
          <span className="h-px w-16" style={{ background: `linear-gradient(90deg, transparent, ${theme.accent})` }} />
          <span className="font-serif text-[22px] font-semibold uppercase tracking-[0.28em]" style={{ color: theme.primary }}>
            {theme.subtitle}
          </span>
          <span className="h-px w-16" style={{ background: `linear-gradient(90deg, ${theme.accent}, transparent)` }} />
        </div>

        <div className="mt-6 text-[13px] font-medium uppercase tracking-[0.3em] text-[#6b6450]">This certificate is proudly presented to</div>
        <div className="mt-1 font-script leading-[1.15]" style={{ fontSize: nameSize, color: '#1d2a22' }}>
          {cert.recipient_name}
        </div>
        <div className="h-[2px] w-[460px]" style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)` }} />

        <p className="mt-4 max-w-[760px] font-serif text-[19px] leading-snug text-[#3b3a33]">
          {cert.kind === 'participation' ? 'for active participation in' : cert.kind === 'achievement' ? 'in recognition of outstanding achievement in' : 'for successfully completing all lessons and assessments of'}
        </p>
        <div className="mt-1 max-w-[820px] font-serif font-bold leading-tight" style={{ fontSize: titleSize, color: theme.deep }}>
          {cert.course_title}
        </div>
        <div className="mt-3 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6b6450]">
          {cert.category_name && <span>{cert.category_name}</span>}
          {cert.hours != null && (
            <>
              <Dot c={theme.accent} />
              <span>{Number(cert.hours)} learning hours</span>
            </>
          )}
          {cert.grade != null && (
            <>
              <Dot c={theme.accent} />
              <span>Final grade {cert.grade}%</span>
            </>
          )}
          <Dot c={theme.accent} />
          <span>{formatDate(cert.issued_at, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Footer: signatures · seal · verification */}
      <div className="absolute inset-x-[90px] bottom-[64px] z-10 grid grid-cols-[1fr_auto_1fr] items-end gap-6">
        <div className="flex items-end justify-start gap-8">
          {sigs.map((s) => (
            <div key={s.name} className="w-[200px] text-center">
              <div className="flex h-[60px] items-end justify-center">
                {s.signature_url ? (
                  <img src={s.signature_url} alt="" crossOrigin="anonymous" className="max-h-[60px] max-w-[170px] object-contain" style={{ mixBlendMode: 'multiply' }} />
                ) : (
                  <span className="font-script text-[34px] text-[#1d2a22]">{s.name}</span>
                )}
              </div>
              <div className="mt-1 h-px w-full bg-[#1d2a22]/60" />
              <div className="mt-1.5 text-[13px] font-bold text-[#1d2a22]">{s.name}</div>
              <div className="text-[10.5px] font-medium uppercase tracking-[0.14em]" style={{ color: theme.primary }}>
                {s.title}
              </div>
            </div>
          ))}
        </div>
        <div className="-mb-3">
          <Seal theme={theme} year={year} />
        </div>
        <div className="flex items-end justify-end gap-3 text-right">
          <div className="pb-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b6450]">Certificate ID</div>
            <div className="font-mono text-[14px] font-bold tracking-wider" style={{ color: theme.deep }}>
              {cert.serial}
            </div>
            <div className="mt-1 max-w-[190px] text-[9.5px] leading-snug text-[#6b6450]">
              Scan or visit {SITE_URL.replace(/^https?:\/\//, '')}/verify to confirm authenticity
            </div>
          </div>
          <div className="rounded-lg border bg-white/80 p-1.5" style={{ borderColor: theme.accent }}>
            {qr ? <img src={qr} alt="Verification QR code" width={84} height={84} /> : <div className="h-[84px] w-[84px]" />}
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-[46px] z-10 text-center text-[8.5px] font-medium tracking-[0.18em] text-[#8a8370]">
        BUILT BY {BRAND.builtBy.toUpperCase()} · POWERED BY {BRAND.org.toUpperCase()}
      </div>
    </div>
  );
});

function Dot({ c }: { c: string }) {
  return <span className="inline-block h-1.5 w-1.5 rotate-45" style={{ background: c }} />;
}

/** Scales the fixed-size certificate to fit its container. */
export function ScaledCertificate({ cert, artRef }: { cert: Certificate; artRef?: React.Ref<HTMLDivElement> }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / CERT_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={wrap} className="relative w-full overflow-hidden rounded-xl shadow-lift ring-1 ring-black/5" style={{ height: CERT_H * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: CERT_W, height: CERT_H }}>
        <CertificateArt cert={cert} ref={artRef} />
      </div>
    </div>
  );
}
