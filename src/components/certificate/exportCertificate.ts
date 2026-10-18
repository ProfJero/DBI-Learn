import type { Certificate } from '@/lib/types';
import { CERT_H, CERT_W } from './CertificateArt';

async function toPng(node: HTMLElement) {
  const { toPng } = await import('html-to-image');
  await document.fonts.ready;
  return toPng(node, { pixelRatio: 3, width: CERT_W, height: CERT_H, cacheBust: true, style: { transform: 'none' } });
}

const fileBase = (c: Certificate) => `DBI-Certificate-${c.serial}`;

export async function downloadCertificatePng(node: HTMLElement, cert: Certificate) {
  const url = await toPng(node);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileBase(cert)}.png`;
  a.click();
}

export async function downloadCertificatePdf(node: HTMLElement, cert: Certificate) {
  const [{ jsPDF }, url] = await Promise.all([import('jspdf'), toPng(node)]);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({
    title: `${cert.course_title} — ${cert.recipient_name}`,
    subject: `Certificate ${cert.serial}`,
    author: 'Digital Bridge Initiative',
    creator: 'DBI Learn · Built by ProfJero Digital Studio',
  });
  pdf.addImage(url, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
  pdf.save(`${fileBase(cert)}.pdf`);
}

export function linkedInAddUrl(cert: Certificate, verifyUrl: string) {
  const d = new Date(cert.issued_at);
  const p = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: cert.course_title,
    organizationName: 'Digital Bridge Initiative',
    issueYear: String(d.getFullYear()),
    issueMonth: String(d.getMonth() + 1),
    certUrl: verifyUrl,
    certId: cert.serial,
  });
  return `https://www.linkedin.com/profile/add?${p}`;
}
