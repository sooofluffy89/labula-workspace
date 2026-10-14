import { CheckCircle2, Circle, CircleDot, PauseCircle } from 'lucide-react';
import { statusLabels, type RecipeStatus } from '@/lib/recipe-progress';

export function RecipeStatusBadge({status, count}: {status: RecipeStatus; count?: number}) {
  const Icon = status === 'completed' ? CheckCircle2 : status === 'in-progress' ? CircleDot : status === 'inactive' ? PauseCircle : Circle;
  return <span className={`recipe-status ${status}`}><Icon size={16} aria-hidden="true"/>{count !== undefined && <strong>{count}</strong>}{statusLabels[status]}</span>;
}
