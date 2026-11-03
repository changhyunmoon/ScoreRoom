import { Icon } from '../../../shared/icons/Icon';
import type { ID } from '../../../shared/lib/types';
import type { Team } from '../model/types';

/** 접고 펼 수 있는 팀 트리의 한 줄 (하위 팀을 재귀로 그린다) */
export function TeamTreeNode({
  team, teams, users, depth, selectedId, expandedIds, search, onSelect, onToggle,
}: {
  team: Team; teams: Team[]; users: { teamId: ID | null; isSysAdmin: boolean }[];
  depth: number; selectedId: ID | null; expandedIds: Set<ID>; search: string;
  onSelect: (id: ID) => void; onToggle: (id: ID) => void;
}) {
  const children = teams.filter(t => t.parentId === team.id);
  const matches = (t: Team): boolean =>
    t.name.toLowerCase().includes(search) || teams.some(child => child.parentId === t.id && matches(child));
  if (search && !matches(team)) return null;
  const expanded = !!search || expandedIds.has(team.id);
  const count = users.filter(u => !u.isSysAdmin && u.teamId === team.id).length;
  return (
    <div>
      <div className={`org-team-row ${selectedId === team.id ? 'selected' : ''}`} style={{ paddingLeft: 10 + depth * 16 }}>
        <button type="button" className="org-tree-toggle" aria-label={`${team.name} 하위 팀 ${expanded ? '접기' : '펼치기'}`}
          onClick={() => onToggle(team.id)} disabled={children.length === 0}>
          {children.length > 0 && <Icon name={expanded ? 'down' : 'right'} size={14} />}
        </button>
        <button type="button" className="org-team-name" onClick={() => onSelect(team.id)}>
          <span className="ellipsis">{team.name}</span><small>{count}</small>
        </button>
      </div>
      {expanded && children.map(child => (
        <TeamTreeNode key={child.id} team={child} teams={teams} users={users} depth={depth + 1}
          selectedId={selectedId} expandedIds={expandedIds} search={search} onSelect={onSelect} onToggle={onToggle} />
      ))}
    </div>
  );
}
