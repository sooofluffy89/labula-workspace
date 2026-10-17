/* LABULA Workspace 2.0 clickable design prototype.
 * Dish names/variants follow lib/menu.ts; all compositions and check data are
 * synthetic examples, not the restaurant's recorded recipes or inventory.
 * No network, persistence or production application code is used here.
 */
(function (root) {
  'use strict';

  const clone = value => JSON.parse(JSON.stringify(value));
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const values = data => Object.values(data && data.entities || {});
  const entity = (data, id) => data && data.entities && data.entities[id];
  const ref = (id, amount = '', note = '') => ({id, amount, note});

  function children(data, id) {
    const item = entity(data, id);
    if (!item || item.type === 'ingredient') return [];
    return [...new Set((item.inputs || []).map(input => input.id).filter(Boolean))];
  }

  function descendants(data, id) {
    const seen = new Set([id]);
    const result = [];
    function visit(parentId) {
      for (const childId of children(data, parentId)) {
        if (seen.has(childId)) continue;
        seen.add(childId);
        result.push(childId);
        visit(childId);
      }
    }
    visit(id);
    return result;
  }

  function activeRecipes(data) {
    return values(data).filter(item => item.type === 'dish' && item.active === true);
  }

  function ownState(item) {
    if (!item) return 'empty';
    if (item.type === 'ingredient') return 'confirmed';
    if (!item.inputs || !item.inputs.length) return 'empty';
    return item.confirmed ? 'confirmed' : 'draft';
  }

  function issues(data, id) {
    const found = new Map();
    const visited = new Set();
    const path = new Set();
    function add(itemId, reason) { found.set(itemId + ':' + reason, {id: itemId, reason}); }
    function visit(itemId) {
      if (path.has(itemId)) { add(itemId, 'Circular composition reference'); return; }
      if (visited.has(itemId)) return;
      const item = entity(data, itemId);
      if (!item) { add(itemId, 'Referenced item is unavailable'); return; }
      if (item.type === 'ingredient') { visited.add(itemId); return; }
      path.add(itemId);
      if (ownState(item) === 'empty') add(itemId, 'No components added yet');
      else if (!item.confirmed) add(itemId, 'Composition not confirmed');
      for (const childId of children(data, itemId)) {
        const child = entity(data, childId);
        if (child && child.type === 'dish') add(childId, 'A dish cannot be used as a component');
        visit(childId);
      }
      path.delete(itemId);
      visited.add(itemId);
    }
    visit(id);
    return [...found.values()];
  }

  function complete(data, id) { return Boolean(entity(data, id)) && issues(data, id).length === 0; }

  function activeUses(data, id) {
    return activeRecipes(data).filter(item => item.id !== id && descendants(data, item.id).includes(id));
  }

  function parents(data, id) {
    return values(data).filter(item => children(data, item.id).includes(id));
  }

  function usedItems(data, type) {
    const reachable = new Set(activeRecipes(data).flatMap(item => descendants(data, item.id)));
    return values(data).filter(item => item.type === type && reachable.has(item.id));
  }

  function usedIngredients(data) { return usedItems(data, 'ingredient'); }
  function usedHouseMade(data) { return usedItems(data, 'house'); }

  function health(data) {
    const active = activeRecipes(data);
    const broken = new Set();
    for (const recipe of active) {
      for (const issue of issues(data, recipe.id)) {
        if (issue.reason === 'Circular composition reference' || issue.reason === 'Referenced item is unavailable' || issue.reason === 'A dish cannot be used as a component') {
          broken.add(issue.id + ':' + issue.reason);
        }
      }
    }
    return {
      activeVariants: active.length,
      totalDishes: new Set(values(data).filter(item => item.type === 'dish').map(item => item.dishId || item.id)).size,
      completeVariants: active.filter(item => complete(data, item.id)).length,
      ownToCheck: active.filter(item => ownState(item) !== 'confirmed').length,
      houseToCheck: usedHouseMade(data).filter(item => ownState(item) !== 'confirmed').length,
      broken: broken.size,
    };
  }

  function wouldCycle(data, parentId, childId) {
    return parentId === childId || descendants(data, childId).includes(parentId);
  }

  function saveEntity(data, id, patch) {
    if (!id || typeof id !== 'string') throw new Error('An item ID is required.');
    const existing = entity(data, id);
    const candidate = {...(existing || {id, confirmed: false, inputs: [], notes: '', aliases: []}), ...clone(patch), id};
    if (!['dish', 'house', 'ingredient'].includes(candidate.type)) throw new Error('Choose a dish, house-made item or ingredient.');
    candidate.name = String(candidate.name || '').trim();
    if (!candidate.name) throw new Error('Add a name before saving.');
    candidate.notes = String(candidate.notes || '');
    candidate.aliases = [...new Set((candidate.aliases || []).map(value => String(value).trim()).filter(Boolean))];
    if (!Array.isArray(candidate.inputs)) throw new Error('The component list is invalid.');
    candidate.inputs = candidate.inputs.map(input => ({id: String(input.id || ''), amount: String(input.amount || ''), note: String(input.note || '')}));
    const duplicate = values(data).find(item => item.id !== id && item.type === candidate.type && normalize(item.name) === normalize(candidate.name) && (candidate.type !== 'dish' || normalize(item.variant || 'Standard') === normalize(candidate.variant || 'Standard')));
    if (duplicate) throw new Error('An item with this name already exists. Choose the existing item or a different name.');
    if (candidate.type === 'ingredient' && candidate.inputs.length) throw new Error('A bought ingredient does not need a house-made composition.');
    const seen = new Set();
    for (const input of candidate.inputs) {
      if (!input.id || !entity(data, input.id)) throw new Error('A component is unavailable. Choose an existing item.');
      if (seen.has(input.id)) throw new Error('This component is already in the list.');
      seen.add(input.id);
      if (entity(data, input.id).type === 'dish') throw new Error('Choose an ingredient or a house-made item as the component.');
      if (wouldCycle(data, id, input.id)) throw new Error('This would create a circular recipe. Choose another component.');
    }
    const changedInputs = JSON.stringify(existing && existing.inputs || []) !== JSON.stringify(candidate.inputs);
    if (candidate.type === 'ingredient') candidate.confirmed = true;
    else {
      if (changedInputs && patch.confirmed !== true) candidate.confirmed = false;
      candidate.confirmed = candidate.confirmed === true;
      if (candidate.confirmed && !candidate.inputs.length) throw new Error('Add at least one component before confirming the list.');
    }
    if (candidate.type === 'dish') {
      candidate.active = candidate.active === true;
      candidate.dishId = candidate.dishId || id;
      candidate.variant = candidate.variant || 'Standard';
    }
    // No mutation of an editor draft, input array or the saved snapshot.
    // Frozen copies make accidental edits of the saved composition observable.
    candidate.inputs = Object.freeze(candidate.inputs.map(input => Object.freeze({...input})));
    const next = clone(data);
    next.entities[id] = candidate;
    next.revision = Number(data.revision || 0) + 1;
    return next;
  }

  function seed() {
    const entities = {};
    function ingredient(id, name, group, aliases = [], notes = '') {
      entities[id] = {id, type: 'ingredient', name, group, confirmed: true, inputs: [], notes, aliases};
    }
    ingredient('ingredient-silken-tofu', 'Silken tofu', 'Tofu & proteins', ['Soft tofu']);
    ingredient('ingredient-garlic', 'Garlic', 'Vegetables', ['Česnek']);
    ingredient('ingredient-oil', 'Rapeseed oil', 'Pantry', ['Oil']);
    ingredient('ingredient-chilli', 'Dried chilli', 'Spices', ['Chili']);
    ingredient('ingredient-soy', 'Light soy sauce', 'Pantry', ['Soy sauce'], 'Bought product. Supplier label belongs in product details; it does not create kitchen tasks.');
    ingredient('ingredient-vinegar', 'Rice vinegar', 'Pantry');
    ingredient('ingredient-cucumber', 'Cucumber', 'Vegetables');
    ingredient('ingredient-sesame', 'Sesame seeds', 'Pantry');
    ingredient('ingredient-sugar', 'Sugar', 'Pantry');
    ingredient('ingredient-salt', 'Salt', 'Pantry');
    ingredient('ingredient-eggplant', 'Eggplant', 'Vegetables', ['Aubergine']);
    ingredient('ingredient-starch', 'Potato starch', 'Pantry');
    ingredient('ingredient-chicken', 'Chicken', 'Tofu & proteins');
    ingredient('ingredient-ginger', 'Ginger', 'Vegetables');
    ingredient('ingredient-century-egg', 'Century egg', 'Tofu & proteins');
    ingredient('ingredient-paprika', 'Smoked paprika', 'Spices');
    ingredient('ingredient-flour', 'Wheat flour', 'Pantry');
    ingredient('ingredient-wood-ear', 'Wood ear mushroom', 'Vegetables');
    ingredient('ingredient-beef', 'Beef', 'Tofu & proteins');
    ingredient('ingredient-noodles', 'Wheat noodles', 'Noodles');
    ingredient('ingredient-sweet-noodles', 'Sweet-potato noodles', 'Noodles');
    ingredient('ingredient-pork', 'Pork', 'Tofu & proteins');
    ingredient('ingredient-cabbage', 'Chinese cabbage', 'Vegetables');
    ingredient('ingredient-firm-tofu', 'Firm tofu', 'Tofu & proteins');
    ingredient('ingredient-rice', 'Rice', 'Pantry');
    ingredient('ingredient-spring-onion', 'Spring onion', 'Vegetables');
    ingredient('ingredient-black-pepper', 'Black pepper', 'Spices');

    function house(id, name, confirmed, ids, notes = '') {
      entities[id] = {id, type: 'house', name, confirmed, inputs: ids.map(value => typeof value === 'string' ? ref(value) : value), notes, aliases: []};
    }
    house('house-garlic-paste', 'Garlic paste', true, [ref('ingredient-garlic', '500 g'), ref('ingredient-oil', '100 ml')]);
    house('house-chilli-sauce', 'Chilli sauce', false, ['house-garlic-paste', 'ingredient-chilli', 'ingredient-soy', 'ingredient-vinegar'], 'Example: check that this component list is complete.');
    house('house-cucumber-dressing', 'Cucumber dressing', true, ['house-garlic-paste', 'ingredient-vinegar', 'ingredient-soy', 'ingredient-sugar']);
    house('house-eggplant-coating', 'Eggplant coating', true, ['ingredient-starch', 'ingredient-flour', 'ingredient-salt']);
    house('house-chicken-marinade', 'Chicken marinade', true, ['house-garlic-paste', 'ingredient-ginger', 'ingredient-soy']);
    house('house-paprika-dressing', 'Smoky paprika dressing', true, ['ingredient-paprika', 'ingredient-oil', 'ingredient-vinegar']);
    house('house-dough', 'House dough', true, ['ingredient-flour', 'ingredient-oil', 'ingredient-salt']);
    house('house-mushroom-dressing', 'Mushroom dressing', false, ['ingredient-soy', 'ingredient-vinegar', 'ingredient-sesame']);
    house('house-braised-beef', 'Braised beef', true, ['ingredient-beef', 'house-garlic-paste', 'ingredient-ginger', 'ingredient-soy']);
    house('house-chicken-broth', 'Chicken broth', true, ['ingredient-chicken', 'ingredient-ginger', 'ingredient-spring-onion', 'ingredient-salt']);
    house('house-xiao-mian-base', 'Xiao Mian base', true, ['house-chilli-sauce', 'house-chicken-broth', 'ingredient-soy']);
    house('house-pickled-cabbage', 'Pickled cabbage', true, ['ingredient-cabbage', 'ingredient-salt', 'ingredient-vinegar']);
    house('house-marinated-tofu', 'Marinated tofu', true, ['ingredient-firm-tofu', 'ingredient-soy', 'ingredient-ginger']);
    house('house-mapo-base', 'Mapo base', true, ['house-chilli-sauce', 'ingredient-pork', 'ingredient-soy']);
    house('house-seasonal-dressing', 'Seasonal dressing', false, [], 'New component idea. Not used in the current menu.');

    function dish(dishId, slug, name, category, variant, active, confirmed, ids, notes = '') {
      const id = 'dish-' + dishId + '-' + slug;
      entities[id] = {id, type: 'dish', dishId, name, category, variant, active, confirmed, inputs: ids.map(value => typeof value === 'string' ? ref(value) : value), notes, aliases: []};
    }
    dish('s1', 'standard', 'Silken tofu chili', 'Starters', 'Standard', true, true, [ref('ingredient-silken-tofu', '150 g'), ref('house-chilli-sauce', '25 g'), 'ingredient-spring-onion', 'ingredient-sesame']);
    dish('s2', 'standard', 'Crispy eggplant fries', 'Starters', 'Standard', true, true, ['ingredient-eggplant', 'house-eggplant-coating', 'house-chilli-sauce']);
    dish('s3', 'standard', 'Spicy cucumber', 'Starters', 'Standard', true, true, ['ingredient-cucumber', 'house-cucumber-dressing', 'ingredient-sesame']);
    dish('s4', 'standard', '"Lollipop" chicken', 'Starters', 'Standard', true, true, ['ingredient-chicken', 'house-chicken-marinade', 'ingredient-starch']);
    dish('s5', 'standard', 'Century egg, smoky paprika, dough', 'Starters', 'Standard', true, true, ['ingredient-century-egg', 'house-paprika-dressing', 'house-dough']);
    dish('s6', 'standard', 'Wood ear mushroom', 'Starters', 'Standard', true, false, ['ingredient-wood-ear', 'house-mushroom-dressing', 'ingredient-spring-onion']);
    dish('s7', 'standard', 'Spicy Braised Beef Slices', 'Starters', 'Standard', true, true, ['house-braised-beef', 'house-chilli-sauce', 'ingredient-spring-onion']);
    dish('m1', 'standard', 'Lá Bù Lá beef (Our signature dish)', 'Main Dishes', 'Standard', true, true, ['house-braised-beef', 'ingredient-rice', 'ingredient-cabbage']);
    dish('m1', 'beef-max', 'Lá Bù Lá beef (Our signature dish)', 'Main Dishes', 'Beef MAX', true, true, [ref('house-braised-beef', '250 g'), 'ingredient-rice', 'ingredient-cabbage']);
    dish('m2', 'standard', 'Xiao Mian', 'Main Dishes', 'Standard', true, true, ['ingredient-noodles', 'house-xiao-mian-base', 'house-braised-beef', 'ingredient-spring-onion']);
    dish('m2', 'tofu-chicken-broth', 'Xiao Mian', 'Main Dishes', 'Tofu with chicken broth — confirm', true, false, ['ingredient-noodles', 'house-xiao-mian-base', 'ingredient-silken-tofu'], 'Example: chicken broth is included. Check the real variant before confirming; this prototype makes no dietary claim.');
    dish('m2', 'marinated-tofu', 'Xiao Mian', 'Main Dishes', 'Marinated tofu version', false, true, ['ingredient-noodles', 'house-marinated-tofu', 'house-cucumber-dressing']);
    dish('m3', 'standard', 'Sweet-potato noodles bowl', 'Main Dishes', 'Standard', true, true, ['ingredient-sweet-noodles', 'house-chicken-broth', 'ingredient-cabbage', 'ingredient-spring-onion']);
    dish('m3', 'braised-tofu', 'Sweet-potato noodles bowl', 'Main Dishes', 'Braised tofu version', false, true, ['ingredient-sweet-noodles', 'house-marinated-tofu', 'ingredient-cabbage']);
    dish('m4', 'standard', "Stir-fry Pork with Siehuan 'Paoeai'", 'Main Dishes', 'Standard', true, true, ['ingredient-pork', 'house-pickled-cabbage', 'house-garlic-paste', 'ingredient-rice']);
    dish('m5', 'standard', 'Taste of Hometown', 'Main Dishes', 'Standard', false, true, ['ingredient-pork', 'house-pickled-cabbage', 'ingredient-rice']);
    dish('m6', 'standard', 'Kids Menu', 'Main Dishes', 'Standard', false, false, []);
    dish('p1', 'chicken-feet', 'Braised Chicken Feet/Pork Feet', 'Specials', 'Chicken feet', false, false, ['ingredient-chicken', 'house-chicken-marinade']);
    dish('p1', 'pork-feet', 'Braised Chicken Feet/Pork Feet', 'Specials', 'Pork feet', false, true, ['ingredient-pork', 'house-garlic-paste', 'ingredient-soy']);
    dish('p2', 'standard', 'Beef skewers', 'Specials', 'Standard', false, true, ['ingredient-beef', 'ingredient-black-pepper', 'ingredient-salt']);
    dish('p3', 'standard', 'Lá Bù Lá Mapo Tofu', 'Specials', 'Standard', true, true, ['ingredient-silken-tofu', 'house-mapo-base', 'ingredient-rice']);
    dish('p4', 'standard', 'Today Green Market-until sold-out', 'Specials', 'Standard', false, false, []);
    dish('p5', 'standard', 'Secret Hidden Menu-until sold-out', 'Specials', 'Standard', false, false, []);
    dish('p6', 'standard', "Children's menu", 'Specials', 'Standard', false, false, []);

    return {
      entities,
      tracked: ['house-chilli-sauce', 'house-garlic-paste', 'house-chicken-broth', 'house-braised-beef', 'house-pickled-cabbage', 'ingredient-silken-tofu', 'ingredient-cucumber'],
      checks: {'house-chilli-sauce': 'low', 'house-garlic-paste': 'enough', 'house-chicken-broth': 'low', 'house-braised-beef': 'enough', 'house-pickled-cabbage': 'enough', 'ingredient-silken-tofu': 'enough', 'ingredient-cucumber': 'low'},
      plan: null,
      revision: 1,
    };
  }

  const api = {seed, clone, children, descendants, activeRecipes, ownState, issues, complete, activeUses, parents, usedIngredients, usedHouseMade, health, wouldCycle, saveEntity};
  root.LabulaPrototypeModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
