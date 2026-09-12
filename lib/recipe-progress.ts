import type { Notebook, Recipe } from './notebook';
import { menu } from './menu';

export type RecipeStatus = 'not-started' | 'in-progress' | 'completed' | 'inactive';
export const statusLabels: Record<RecipeStatus, string> = {
  'not-started': 'Not started', 'in-progress': 'In progress', completed: 'Completed', inactive: 'Inactive',
};
export function recipeStatus(recipe: Recipe): RecipeStatus {
  if (!recipe.active) return 'inactive';
  if (!recipe.inputs.length) return 'not-started';
  return recipe.recorded ? 'completed' : 'in-progress';
}
export function dishProgress(recipes: Recipe[], menuId: string) {
  const active = recipes.filter(r => r.menuId === menuId && r.active);
  const completed = active.filter(r => recipeStatus(r) === 'completed').length;
  const status: RecipeStatus = !active.length ? 'inactive' : completed === active.length ? 'completed'
    : active.some(r => r.inputs.length > 0) ? 'in-progress' : 'not-started';
  return { status, completed, total: active.length };
}
export function notebookProgress(notebook: Notebook) {
  const dishes = new Map(menu.map(d => [d.id, dishProgress(notebook.recipes, d.id)]));
  const counts: Record<RecipeStatus, number> = { 'not-started': 0, 'in-progress': 0, completed: 0, inactive: 0 };
  for (const dish of dishes.values()) counts[dish.status]++;
  return { dishes, counts, active: menu.length - counts.inactive };
}
