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
  /** 이미지 위 장식 (코드로 직접 그린다. 외부 그림·캐릭터는 쓰지 않는다) */
  scene?: Scene;
  /** 테마 고르기 카드에 보여 줄 작은 아이콘 */
  emoji?: string;
};
type Scene = 'night' | 'ocean' | 'dusk' | 'fireworks' | 'pastel' | 'crayon' | 'cloud';
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
  /* ---- 귀여운 장식 테마 ---- */
  {
    key: 'night', name: '밤하늘', emoji: '🌙', scene: 'night',
    headFrom: '#0B1033', headTo: '#2E2A6E', headText: '#FFFFFF', headSub: 'rgba(230,232,255,0.78)', pill: 'rgba(255,255,255,0.14)', deco: 'rgba(255,255,255,0.06)',
    bg: '#141938', card: '#1E2452', cardShadow: 'rgba(0,0,0,0.3)', text: '#F3F4FF', sub: '#BCC0EA', muted: '#7F84B8',
    accent: '#FFD86B', chipBg: '#2B3270', chipText: '#FFD86B', otherRankBg: '#2B3270', otherRankText: '#DADDFF',
    medals: ['#F7C948', '#C3C8E6', '#E09B5A'], first: '#FFD86B', foot: '#6F74A8',
  },
  {
    key: 'ocean', name: '바다', emoji: '🌊', scene: 'ocean',
    headFrom: '#0369A1', headTo: '#38BDF8', headText: '#FFFFFF', headSub: 'rgba(255,255,255,0.85)', pill: 'rgba(255,255,255,0.2)', deco: 'rgba(255,255,255,0.1)',
    bg: '#E8F7FD', card: '#FFFFFF', cardShadow: 'rgba(3,105,161,0.1)', text: '#073247', sub: '#3E6377', muted: '#86A6B6',
    accent: '#0284C7', chipBg: '#DCF1FB', chipText: '#0369A1', otherRankBg: '#DCF1FB', otherRankText: '#0369A1',
    medals: ['#F4B400', '#9FB3C1', '#D08A4C'], first: '#38BDF8', foot: '#7FA4B6',
  },
  {
    key: 'dusk', name: '노을', emoji: '🌇', scene: 'dusk',
    headFrom: '#4C2A85', headTo: '#F59E6B', headText: '#FFFFFF', headSub: 'rgba(255,255,255,0.86)', pill: 'rgba(255,255,255,0.2)', deco: 'rgba(255,255,255,0.1)',
    bg: '#FFF2EC', card: '#FFFFFF', cardShadow: 'rgba(124,58,110,0.1)', text: '#2E1B30', sub: '#6E4F66', muted: '#AD909F',
    accent: '#C2477A', chipBg: '#FBE4EC', chipText: '#B23A6C', otherRankBg: '#F6E3EE', otherRankText: '#8E3D72',
    medals: ['#F2A93B', '#B6AEC4', '#C9784E'], first: '#F59E6B', foot: '#B49AA8',
  },
  {
    key: 'fireworks', name: '폭죽', emoji: '🎆', scene: 'fireworks',
    headFrom: '#160C2E', headTo: '#3D1E63', headText: '#FFFFFF', headSub: 'rgba(255,255,255,0.78)', pill: 'rgba(255,255,255,0.14)', deco: 'rgba(255,255,255,0.06)',
    bg: '#1A1230', card: '#251A42', cardShadow: 'rgba(0,0,0,0.35)', text: '#FFFFFF', sub: '#CDBFEA', muted: '#8C7BB0',
    accent: '#FF7AC2', chipBg: '#3A2A60', chipText: '#FF9FD3', otherRankBg: '#3A2A60', otherRankText: '#EAD9FF',
    medals: ['#FFC83D', '#C9C2E0', '#F08A5D'], first: '#FF7AC2', foot: '#7D6CA3',
  },
  {
    key: 'pastel', name: '말랑 파스텔', emoji: '🍡', scene: 'pastel',
    headFrom: '#FFC9D9', headTo: '#FFEAF1', headText: '#5B3848', headSub: '#8C6676', pill: 'rgba(255,255,255,0.6)', deco: 'rgba(255,255,255,0.5)',
    bg: '#FFF7FA', card: '#FFFFFF', cardShadow: 'rgba(242,123,160,0.12)', text: '#4A2E3A', sub: '#8C6676', muted: '#C1A3B0',
    accent: '#EF6F98', chipBg: '#FFE6EE', chipText: '#D9577F', otherRankBg: '#FFE6EE', otherRankText: '#C2577A',
    medals: ['#F7C45A', '#C6C1D4', '#E8A07A'], first: '#F7A8C0', foot: '#C9A9B6',
  },
  {
    key: 'crayon', name: '크레용 낙서', emoji: '🖍️', scene: 'crayon',
    headFrom: '#FFD43B', headTo: '#FF8A5B', headText: '#2B1A0B', headSub: '#5E3A1C', pill: 'rgba(255,255,255,0.4)', deco: 'rgba(255,255,255,0.3)',
    bg: '#FFFBEA', card: '#FFFFFF', cardShadow: 'rgba(230,57,70,0.1)', text: '#2B1A0B', sub: '#6B4A2B', muted: '#B39A7C',
    accent: '#E63946', chipBg: '#FFF0D6', chipText: '#C2410C', otherRankBg: '#FFEFC2', otherRankText: '#B45309',
    medals: ['#F4B400', '#9AA5B4', '#D9772F'], first: '#E63946', foot: '#B8A386',
  },
  {
    key: 'cloud', name: '하늘 구름', emoji: '☁️', scene: 'cloud',
    headFrom: '#2FA8E8', headTo: '#A8DDF7', headText: '#FFFFFF', headSub: 'rgba(255,255,255,0.9)', pill: 'rgba(255,255,255,0.3)', deco: 'rgba(255,255,255,0.2)',
    bg: '#F1F9FF', card: '#FFFFFF', cardShadow: 'rgba(30,136,229,0.1)', text: '#0B2E4A', sub: '#3F6380', muted: '#8EAAC0',
    accent: '#1E88E5', chipBg: '#E1F1FC', chipText: '#1565C0', otherRankBg: '#E1F1FC', otherRankText: '#1565C0',
    medals: ['#F6B826', '#A5B6C6', '#D88A4A'], first: '#F6B826', foot: '#8EAAC0',
  },
];

/* ---------- 장식 그리기 ---------- */
/** 매번 같은 모양이 나오도록 고정된 순서의 난수 */
function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath(); c.fill();
}

function heart(c: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x, y + s * 0.35);
  c.bezierCurveTo(x - s, y - s * 0.45, x - s * 0.45, y - s, x, y - s * 0.4);
  c.bezierCurveTo(x + s * 0.45, y - s, x + s, y - s * 0.45, x, y + s * 0.35);
  c.fill();
}

function cloud(c: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, s * 0.5, 0, Math.PI * 2);
  c.arc(x + s * 0.55, y - s * 0.25, s * 0.62, 0, Math.PI * 2);
  c.arc(x + s * 1.15, y, s * 0.5, 0, Math.PI * 2);
  c.rect(x, y - s * 0.1, s * 1.15, s * 0.6);
  c.fill();
}

/** 헤더(제목 뒤)와 바탕 가장자리에 장식을 그린다. 글자가 있는 왼쪽은 피하고 오른쪽 위주로 둔다 */
function drawScene(c: CanvasRenderingContext2D, scene: Scene, W: number, H: number, HEAD: number) {
  const rnd = seeded(scene.length * 7919 + 13);
  if (scene === 'night') {
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W, y = rnd() * HEAD, r = 0.8 + rnd() * 1.8;
      c.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.55})`;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    star(c, W - 300, 52, 9, '#FFF3B0'); star(c, W - 380, 150, 6, '#FFF3B0'); star(c, W - 210, 170, 7, '#FFE58A');
    // 초승달
    c.save();
    c.beginPath(); c.rect(0, 0, W, HEAD); c.arc(W - 108, 76, 42, 0, Math.PI * 2); c.clip('evenodd');
    c.fillStyle = '#FFE9A3';
    c.beginPath(); c.arc(W - 130, 92, 46, 0, Math.PI * 2); c.fill();
    c.restore();
    // 바탕 가장자리 별
    for (let i = 0; i < 40; i++) {
      const left = rnd() < 0.5;
      const x = left ? rnd() * 50 : W - rnd() * 50, y = HEAD + rnd() * (H - HEAD);
      c.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.4})`;
      c.beginPath(); c.arc(x, y, 0.8 + rnd() * 1.4, 0, Math.PI * 2); c.fill();
    }
  } else if (scene === 'ocean') {
    // 물방울
    for (let i = 0; i < 14; i++) {
      const x = W * 0.7 + rnd() * W * 0.27, y = 20 + rnd() * (HEAD - 70), r = 4 + rnd() * 12;
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.beginPath(); c.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, Math.PI * 2); c.fill();
    }
    // 물결 두 겹
    const wave = (base: number, amp: number, len: number, color: string) => {
      c.fillStyle = color; c.beginPath(); c.moveTo(0, HEAD);
      for (let x = 0; x <= W; x += 8) c.lineTo(x, base + Math.sin(x / len) * amp);
      c.lineTo(W, HEAD); c.closePath(); c.fill();
    };
    wave(HEAD - 26, 9, 48, 'rgba(255,255,255,0.22)');
    wave(HEAD - 12, 7, 36, 'rgba(255,255,255,0.35)');
  } else if (scene === 'dusk') {
    // 수평선에 걸린 해와 새
    const sun = c.createRadialGradient(W - 190, HEAD + 10, 10, W - 190, HEAD + 10, 120);
    sun.addColorStop(0, 'rgba(255,236,170,0.95)'); sun.addColorStop(0.5, 'rgba(255,200,120,0.55)'); sun.addColorStop(1, 'rgba(255,170,110,0)');
    c.fillStyle = sun; c.fillRect(W - 340, HEAD - 140, 300, 160);
    c.fillStyle = '#FFE3A1';
    c.beginPath(); c.arc(W - 190, HEAD + 6, 58, Math.PI, 0); c.fill();
    c.strokeStyle = 'rgba(60,30,70,0.55)'; c.lineWidth = 3; c.lineCap = 'round';
    for (const [x, y, s] of [[W - 330, 64, 14], [W - 300, 84, 10], [W - 360, 108, 12]] as const) {
      c.beginPath(); c.moveTo(x - s, y - s * 0.4); c.quadraticCurveTo(x - s * 0.4, y - s * 0.8, x, y); c.quadraticCurveTo(x + s * 0.4, y - s * 0.8, x + s, y - s * 0.4); c.stroke();
    }
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(0, HEAD - 3, W, 3);
  } else if (scene === 'fireworks') {
    const burst = (x: number, y: number, r: number, color: string) => {
      c.strokeStyle = color; c.lineWidth = 3; c.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        c.beginPath(); c.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.stroke();
        c.fillStyle = color; c.beginPath(); c.arc(x + Math.cos(a) * (r + 7), y + Math.sin(a) * (r + 7), 2.6, 0, Math.PI * 2); c.fill();
      }
    };
    burst(W - 130, 78, 50, '#FF7AC2'); burst(W - 270, 145, 34, '#FFD166'); burst(W - 320, 52, 22, '#6EE7F9'); burst(W - 52, 178, 22, '#B9FF8A');
    // 바탕 가장자리 꽃가루
    const colors = ['#FF7AC2', '#FFD166', '#6EE7F9', '#B9FF8A', '#C4A1FF'];
    for (let i = 0; i < 46; i++) {
      const left = rnd() < 0.5;
      const x = left ? 10 + rnd() * 44 : W - 10 - rnd() * 44, y = HEAD + 10 + rnd() * (H - HEAD - 20);
      c.save(); c.translate(x, y); c.rotate(rnd() * Math.PI);
      c.fillStyle = colors[i % colors.length]; c.globalAlpha = 0.7;
      c.fillRect(-4, -2, 8, 4); c.restore();
    }
  } else if (scene === 'pastel') {
    // 동글동글 얼굴 (직접 그린 단순한 모양) 과 하트
    const face = (x: number, y: number, r: number, body: string) => {
      c.fillStyle = body; c.beginPath(); c.ellipse(x, y, r, r * 0.9, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#4A2E3A';
      c.beginPath(); c.arc(x - r * 0.32, y - r * 0.05, r * 0.08, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x + r * 0.32, y - r * 0.05, r * 0.08, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,140,170,0.55)';
      c.beginPath(); c.ellipse(x - r * 0.52, y + r * 0.2, r * 0.16, r * 0.1, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(x + r * 0.52, y + r * 0.2, r * 0.16, r * 0.1, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#4A2E3A'; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath(); c.arc(x, y + r * 0.12, r * 0.12, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    };
    face(W - 120, 120, 50, '#FFFFFF'); face(W - 230, 150, 36, '#FFF4D9'); face(W - 310, 100, 28, '#E8F4FF');
    heart(c, W - 170, 52, 16, '#FF8FB1'); heart(c, W - 340, 165, 12, '#FFB3C9'); heart(c, W - 40, 60, 10, '#FF8FB1');
    for (let i = 0; i < 18; i++) {
      const left = rnd() < 0.5;
      heart(c, left ? 16 + rnd() * 34 : W - 16 - rnd() * 34, HEAD + 20 + rnd() * (H - HEAD - 40), 6 + rnd() * 5, 'rgba(255,143,177,0.35)');
    }
  } else if (scene === 'crayon') {
    // 삐뚤빼뚤한 손그림 별·나선·밑줄
    const wobblyStar = (x: number, y: number, r: number, color: string) => {
      c.strokeStyle = color; c.lineWidth = 4; c.lineJoin = 'round'; c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i <= 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = (i % 2 === 0 ? r : r * 0.45) * (0.9 + rnd() * 0.2);
        c.lineTo(x + Math.cos(a) * rr + (rnd() - 0.5) * 3, y + Math.sin(a) * rr + (rnd() - 0.5) * 3);
      }
      c.stroke();
    };
    wobblyStar(W - 130, 80, 36, '#E63946'); wobblyStar(W - 250, 155, 24, '#1D4ED8'); wobblyStar(W - 300, 62, 18, '#16A34A');
    c.strokeStyle = '#7C3AED'; c.lineWidth = 4; c.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.2) c.lineTo(W - 70 + Math.cos(a) * a * 2.4, 170 + Math.sin(a) * a * 2.4);
    c.stroke();
    c.strokeStyle = 'rgba(230,57,70,0.7)'; c.lineWidth = 5; c.beginPath();
    for (let x = 64; x <= 420; x += 6) c.lineTo(x, 104 + Math.sin(x / 9) * 3 + (rnd() - 0.5) * 2);
    c.stroke();
    for (let i = 0; i < 16; i++) {
      const left = rnd() < 0.5;
      wobblyStar(left ? 32 + rnd() * 16 : W - 32 - rnd() * 16, HEAD + 30 + rnd() * (H - HEAD - 60), 7 + rnd() * 5, ['#E63946', '#1D4ED8', '#16A34A', '#F59E0B'][i % 4]);
    }
  } else if (scene === 'cloud') {
    // 해와 몽글몽글 구름
    c.fillStyle = '#FFE07A';
    c.beginPath(); c.arc(W - 120, 70, 34, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#FFE07A'; c.lineWidth = 4; c.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      c.beginPath(); c.moveTo(W - 120 + Math.cos(a) * 44, 70 + Math.sin(a) * 44); c.lineTo(W - 120 + Math.cos(a) * 56, 70 + Math.sin(a) * 56); c.stroke();
    }
    cloud(c, W - 230, 150, 70, 'rgba(255,255,255,0.95)');
    cloud(c, W - 330, 100, 40, 'rgba(255,255,255,0.8)');
    cloud(c, W - 90, 180, 40, 'rgba(255,255,255,0.85)');
    for (let i = 0; i < 6; i++) {
      const left = i % 2 === 0;
      cloud(c, left ? -20 : W - 50, HEAD + 60 + i * ((H - HEAD - 120) / 6), 34, 'rgba(160,210,245,0.35)');
    }
  }
}

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
  if (t.scene) { c.save(); drawScene(c, t.scene, W, H, HEAD); c.restore(); }
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
