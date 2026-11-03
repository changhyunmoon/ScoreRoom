// 결과 공유 이미지(PNG) 테마와 Canvas 그리기
import { formatAvg } from '../../../shared/lib/format';
import type { Project } from '../../projects';

export type Basis = 'avg' | 'inAvg';

/* ---------- 테마 ---------- */
export type Theme = {
  key: string; name: string;
  headFrom: string; headTo: string; headText: string; headSub: string; pill: string; deco: string;
  bg: string; card: string; cardShadow: string; text: string; sub: string; muted: string;
  accent: string; chipBg: string; chipText: string; otherRankBg: string; otherRankText: string;
  medals: [string, string, string]; first: string; foot: string;
};
export const THEMES: Theme[] = [
  {
    key: 'navy', name: '네이비',
    headFrom: '#0E2848', headTo: '#1D4F8C', headText: '#FFFFFF', headSub: 'rgba(255,255,255,0.75)', pill: 'rgba(255,255,255,0.16)', deco: 'rgba(255,255,255,0.06)',
    bg: '#F3F5F9', card: '#FFFFFF', cardShadow: 'rgba(16,38,70,0.08)', text: '#16202E', sub: '#4A5566', muted: '#8A93A3',
    accent: '#1D4F8C', chipBg: '#EAF0F8', chipText: '#1D4F8C', otherRankBg: '#E6ECF4', otherRankText: '#1D4F8C',
    medals: ['#E8A900', '#9AA5B4', '#C47A3F'], first: '#E8A900', foot: '#9AA3B2',
  },
  {
    key: 'dark', name: '다크',
    headFrom: '#0B0F17', headTo: '#1E2433', headText: '#FFFFFF', headSub: 'rgba(255,255,255,0.65)', pill: 'rgba(255,214,102,0.18)', deco: 'rgba(255,214,102,0.07)',
    bg: '#121722', card: '#1B2230', cardShadow: 'rgba(0,0,0,0.35)', text: '#F2F4F8', sub: '#B7BFCC', muted: '#7E8899',
    accent: '#FFD666', chipBg: '#2A3344', chipText: '#FFD666', otherRankBg: '#2A3344', otherRankText: '#D7DDE7',
    medals: ['#F5C542', '#BFC7D2', '#D58B4E'], first: '#F5C542', foot: '#6C7686',
  },
  {
    key: 'white', name: '화이트',
    headFrom: '#FFFFFF', headTo: '#F1F4F8', headText: '#111827', headSub: '#6B7280', pill: '#E9EDF3', deco: 'rgba(17,24,39,0.04)',
    bg: '#FFFFFF', card: '#F7F8FA', cardShadow: 'rgba(0,0,0,0)', text: '#111827', sub: '#4B5563', muted: '#9CA3AF',
    accent: '#111827', chipBg: '#E9EDF3', chipText: '#374151', otherRankBg: '#E9EDF3', otherRankText: '#374151',
    medals: ['#D4A017', '#A0A8B4', '#B8733A'], first: '#111827', foot: '#9CA3AF',
  },
  {
    key: 'forest', name: '포레스트',
    headFrom: '#0F3D2E', headTo: '#1F7A57', headText: '#FFFFFF', headSub: 'rgba(255,255,255,0.75)', pill: 'rgba(255,255,255,0.16)', deco: 'rgba(255,255,255,0.07)',
    bg: '#F1F6F3', card: '#FFFFFF', cardShadow: 'rgba(15,61,46,0.08)', text: '#13261E', sub: '#46594F', muted: '#859489',
    accent: '#1F7A57', chipBg: '#E3F1EA', chipText: '#1F7A57', otherRankBg: '#E3F1EA', otherRankText: '#1F7A57',
    medals: ['#E3A600', '#9AA5A0', '#C0773C'], first: '#E3A600', foot: '#93A39A',
  },
  {
    key: 'sunset', name: '선셋',
    headFrom: '#E8505B', headTo: '#F59E3D', headText: '#FFFFFF', headSub: 'rgba(255,255,255,0.85)', pill: 'rgba(255,255,255,0.22)', deco: 'rgba(255,255,255,0.1)',
    bg: '#FFF6F1', card: '#FFFFFF', cardShadow: 'rgba(232,80,91,0.1)', text: '#2B1A1A', sub: '#6B4F4A', muted: '#A88B85',
    accent: '#E8505B', chipBg: '#FDE8E3', chipText: '#D43F4A', otherRankBg: '#FDE8E3', otherRankText: '#D43F4A',
    medals: ['#F2B01E', '#AEB4BC', '#C97A43'], first: '#F2B01E', foot: '#B9A29C',
  },
];

export type Entry = { key: string; rank: number; name: string; title: string; score: number };

/* ---------- 이미지 그리기 (Canvas) ---------- */
const FONT = `'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif`;

export async function drawResultImage(project: Project, entries: Entry[], t: Theme, o: {
  showScore: boolean; basis: Basis; decimals: boolean; aggText: string; topLabel: string;
}): Promise<string> {
  // 웹 글꼴이 다 불러와진 뒤 그린다 (안 그러면 기본 글꼴로 그려진다)
  try { await Promise.all([document.fonts.load(`700 40px 'Noto Sans KR'`), document.fonts.load(`400 24px 'Noto Sans KR'`)]); } catch { /* 기본 글꼴 사용 */ }

  const W = 1080, PAD = 64, HEAD = 220, ROW = 104, GAP = 12;
  const H = HEAD + 32 + entries.length * (ROW + GAP) - GAP + 44;
  const SCALE = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const c = canvas.getContext('2d')!;
  c.scale(SCALE, SCALE);
  c.textBaseline = 'middle';
  const font = (weight: number, size: number) => { c.font = `${weight} ${size}px ${FONT}`; };
  const fit = (text: string, max: number) => {
    if (c.measureText(text).width <= max) return text;
    let s = text;
    while (s.length > 1 && c.measureText(s + '…').width > max) s = s.slice(0, -1);
    return s + '…';
  };
  const round = (x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

  // 배경
  c.fillStyle = t.bg;
  c.fillRect(0, 0, W, H);

  // 평가룸과 순위 기준
  const g = c.createLinearGradient(0, 0, W, HEAD);
  g.addColorStop(0, t.headFrom);
  g.addColorStop(1, t.headTo);
  c.fillStyle = g;
  c.fillRect(0, 0, W, HEAD);
  c.fillStyle = t.headText;
  font(700, 50);
  c.fillText(fit(project.name, W - PAD * 2), PAD, 78);
  const d = new Date();
  const dateText = `${project.status === 'CLOSED' ? '최종 결과' : '중간 결과'} · ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  c.fillStyle = t.headSub;
  font(400, 23);
  c.fillText(dateText, PAD, 138);
  const basisText = o.basis === 'inAvg' ? `집계 기준 평균 (${o.aggText})` : '전체 평균';
  c.fillText(`${basisText} · ${o.topLabel}`, PAD, 178);
  if (t.key === 'white') { c.fillStyle = '#E5E7EB'; c.fillRect(0, HEAD - 1, W, 1); }

  let y = HEAD + 32;
  for (const e of entries) {
    const x = PAD, w = W - PAD * 2;
    const top3 = e.rank <= 3;
    c.fillStyle = t.card;
    round(x, y, w, ROW, 16); c.fill();
    if (e.rank === 1) { c.strokeStyle = t.first; c.lineWidth = 2; round(x + 1, y + 1, w - 2, ROW - 2, 15); c.stroke(); }

    const cx = x + 52, cy = y + ROW / 2;
    c.fillStyle = top3 ? t.medals[e.rank - 1] : t.otherRankBg;
    c.beginPath(); c.arc(cx, cy, 30, 0, Math.PI * 2); c.fill();
    c.fillStyle = top3 ? '#FFFFFF' : t.otherRankText;
    font(700, e.rank >= 10 ? 23 : 27);
    c.textAlign = 'center';
    c.fillText(String(e.rank), cx, cy + 1);
    c.textAlign = 'left';

    const tx = x + 108;
    const scoreWidth = o.showScore ? (o.decimals ? 210 : 130) : 0;
    font(700, 34);
    c.fillStyle = t.text;
    const duplicateName = entries.some(other => other.key !== e.key && other.name === e.name);
    c.fillText(fit(e.name, w - 108 - scoreWidth - 48), tx, duplicateName ? y + 38 : cy);
    if (duplicateName) {
      font(400, 20);
      c.fillStyle = t.sub;
      c.fillText(fit(e.title, w - 108 - scoreWidth - 48), tx, y + 75);
    }

    if (o.showScore) {
      c.textAlign = 'right';
      const rx = x + w - 36;
      font(700, 36);
      c.fillStyle = t.accent;
      c.fillText(formatAvg(e.score, o.decimals), rx, cy);
      c.textAlign = 'left';
    }
    y += ROW + GAP;
  }

  const url = canvas.toDataURL('image/png');
  if (url === 'data:,') throw new Error('Canvas image export failed');
  return url;
}
