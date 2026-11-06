// 발표 구성원 (화면 표시용)
import type { ID } from '../../../shared/lib/types';
import { userName, type User } from '../../organization';
import type { Presentation } from './types';

/** 발표 구성원 전체 (대표·팀원, 한 사람은 한 번) */
export const involvedIds = (p: Presentation): ID[] => Array.from(new Set([p.leaderId, ...p.presenterIds, ...p.memberIds]));

/**
 * 이 사람이 구성원으로 들어 있는 발표. 한 사람은 평가룸에서 발표 하나에만 참여한다.
 * 팀 발표는 한 명이 등록하면 구성원 전원이 그 발표로 등록된다.
 */
export const presentationOfUser = (d: { presentations: Presentation[] }, pid: ID, userId: ID) =>
  d.presentations.find(p => p.projectId === pid && involvedIds(p).includes(userId));

/** 발표를 수정·삭제할 수 있는 사람: 룸 운영자, 구성원(대표·팀원), 발표를 만든 사람 */
export const canEditPresentation = (p: Presentation, userId: ID, isAdmin: boolean) =>
  isAdmin || p.createdBy === userId || involvedIds(p).includes(userId);

/**
 * 발표 구성원과 역할: 대표 → 팀원 순서. 모두 한 명씩 평가받는다.
 * 발표자 구분은 없다. 예전 데이터에 발표자(presenterIds)로 남아 있는 사람도 팀원으로 본다.
 */
export type CrewRole = 'LEADER' | 'MEMBER';
/** 대표를 뺀 팀원 (예전 발표자 포함, 한 사람은 한 번) */
export const teamMembersOf = (p: Presentation): ID[] => Array.from(new Set([...p.presenterIds, ...p.memberIds])).filter(id => id !== p.leaderId);
export const crewOf = (p: Presentation): { id: ID; role: CrewRole }[] => [
  { id: p.leaderId, role: 'LEADER' },
  ...teamMembersOf(p).map(id => ({ id, role: 'MEMBER' as const })),
];
export const roleText: Record<CrewRole, string> = { LEADER: '대표', MEMBER: '팀원' };
export const roleClass: Record<CrewRole, string> = { LEADER: 'lead', MEMBER: 'member' };

export const presTypeText = { PERSONAL: '개인', TEAM: '팀' } as const;

/** 관리자 설정 순서대로 */
export const presentationsOf = (d: { presentations: Presentation[] }, pid: ID) =>
  d.presentations.filter(p => p.projectId === pid).sort((a, b) => a.order - b.order);

/** 목록용 한 줄 요약: "정예린 외 2명" (대표 기준) */
export function crewSummary(d: { users: User[] }, p: Presentation) {
  const others = involvedIds(p).length - 1;
  return others > 0 ? `${userName(d, p.leaderId)} 외 ${others}명` : userName(d, p.leaderId);
}

