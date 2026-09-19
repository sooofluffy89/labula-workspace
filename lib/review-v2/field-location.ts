import {groups, visible, type Field} from './fields';
import {entity, values, list, str, options, type Draft, type Target} from './model';

// Include only the stable target, even when callers pass an Issue with extra fields.
export const fieldAnchor = (target: Target) => 'review-field-' + encodeURIComponent(JSON.stringify({
  entityId: target.entityId, group: target.group, path: target.path,
}));

export function fieldLocationLabel(data: Draft, target: Target): string {
  const record = entity(data, target.entityId), group = groups.find(g => g.id === target.group);
  if (!record || !group) return 'Review this topic';
  let fields = group.fields, answer = values(record, group.id);
  const parts: string[] = [];
  for (let i = 0; i < target.path.length; i++) {
    const field: Field | undefined = fields.find(f => f.key === target.path[i] && visible(f, answer, fields));
    if (!field) break;
    parts.push(field.label);
    if (field.type !== 'rows' || i === target.path.length - 1) break;
    const rowId = target.path[++i];
    const rows = list(answer, field.key), index = rows.findIndex(r => r.id === rowId);
    if (index < 0) break;
    answer = rows[index];
    const reference = field.fields?.find(f => f.type === 'ref' && str(answer, f.key));
    const name = str(answer, 'name') || (reference && options(data, record, reference, answer).find(o => o.id === str(answer, reference.key))?.name);
    parts.push(`row ${index + 1}${name ? ` (${name})` : ''}`);
    fields = field.fields ?? [];
  }
  return parts.join(' · ') || group.title;
}

// A group-wide issue stays at the group. A stale or hidden target falls back to
// its closest rendered ancestor, never an unrelated first input.
export function focusReviewField(target: Target, root: Pick<Document, 'getElementById'> = document): boolean {
  for (let length = target.path.length; length >= 0; length--) {
    const element = root.getElementById(fieldAnchor({...target, path: target.path.slice(0, length)}));
    if (!element) continue;
    element.scrollIntoView({block: 'center'});
    element.focus({preventScroll: true});
    return true;
  }
  return false;
}
