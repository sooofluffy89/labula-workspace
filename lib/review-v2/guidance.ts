export const GUIDE_VERSION = '2026-09-self-guided-v1';
export type GuidePreference='seen'|'skipped';
type GuideStorage={getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void};
export const guidePreferenceKey=(userId:string)=>`labula-guide:${GUIDE_VERSION}:${userId}`;
export function readGuidePreference(userId:string,storage?:Pick<GuideStorage,'getItem'>):GuidePreference|undefined{try{const value=storage?.getItem(guidePreferenceKey(userId));return value==='seen'||value==='skipped'?value:undefined;}catch{return undefined;}}
export function writeGuidePreference(userId:string,value:GuidePreference,storage?:Pick<GuideStorage,'setItem'>){try{storage?.setItem(guidePreferenceKey(userId),value);}catch{/* A personal preference cannot block review work. */}}

export type GuideExample = 'coriander' | 'shared-output' | 'evidence' | 'checks' | 'status';
export type GuideEntry = {
  summary: string;
  detail: string;
  example?: GuideExample;
  production?: boolean;
};

export const guideIntroduction = [
  'Describe the current practice at Vinohrady and say whose work you are describing.',
  'Older entries are clues to check, not automatically correct answers.',
  'If you do not know a fact, keep it unknown and assign a specific check. You can add facts later.',
  'Your draft saves as you type; the top bar shows whether the latest change is saved. Saved does not mean confirmed.',
  'Your answers prepare corrections for review. Only the owner can approve an exact version and apply it to the Recipe Notebook.',
];

const topic: Record<string, GuideEntry> = {
  'SET-01': {summary: 'Name the people and the practice truthfully.', detail: 'If you are filling this in yourself, enter your own name as the person recording it. Say whether the answers describe your work, an agreed kitchen method, or work you observed.'},
  'ITEM-01': {summary: 'Identify the product first, then its physical stages.', detail: 'A product is the ingredient or preparation. Received, washed whole and chopped are physical stages of that product. Reuse the correct existing record before creating another one.', example: 'coriander'},
  'ITEM-02': {summary: 'Separate how the item arrives from work done here.', detail: 'Bought or house-made is only a starting clue. Record the real source route, the state at receipt and the exact local process when one exists.', example: 'coriander'},
  'ITEM-03': {summary: 'Record only work that really happens at Vinohrady.', detail: 'A bought item used unchanged needs no invented production. Washing, cutting, portioning or another real local step does belong here.', example: 'coriander'},
  'PROC-01': {summary: 'A process is one repeatable method, not one morning’s run.', detail: 'Use one process for the same method. Record a dated full run or top-up separately as a run sample.', example: 'shared-output', production: true},
  'PROC-02': {summary: 'List the real inputs to this process.', detail: 'Link the exact product, stage and source. If an earlier batch is used, identify that actual earlier lot instead of treating it as a new ingredient.', example: 'shared-output', production: true},
  'PROC-03': {summary: 'One process can create several usable outputs.', detail: 'List every real output and link shared work once. Two separate tasks happening at the same time are still separate processes.', example: 'shared-output', production: true},
  'PROC-05': {summary: 'State the boundary of the recorded production.', detail: 'If some outputs or shared work are outside this review, say so. Missing shared work remains unknown; it is never zero.', example: 'shared-output', production: true},
  'RUN-01': {summary: 'This screen describes one specific run sample.', detail: 'A measured run, a written standard and an estimate of a typical run are different evidence. A full batch and a small top-up are separate samples.', example: 'evidence', production: true},
  'RUN-02': {summary: 'Record what went into this particular run.', detail: 'Use the quantity and physical stage that were actually used in this run. Do not copy an old estimate into a measured run.', example: 'evidence', production: true},
  'RUN-03': {summary: 'Record the total output before assigning it to uses.', detail: 'A bag or container count is not a known weight unless the content of one container and the total fill are known.', example: 'evidence', production: true},
  'RUN-05': {summary: 'Waiting time and active work are different.', detail: 'Record unattended cooking, cooling or resting as elapsed time. Do not count it as active labour unless a person is actually working.', example: 'shared-output', production: true},
  'RUN-06': {summary: 'Duration and person-minutes answer different questions.', detail: 'If the number of people changes during the run, record separate intervals. Ten minutes with two people is twenty person-minutes.', example: 'shared-output', production: true},
  'RUN-07': {summary: 'Record shared work once and link it to the right outputs.', detail: 'Work that benefits several outputs belongs to the shared process once. Later cutting or packing for only one output is linked only to that output.', example: 'shared-output', production: true},
  'RUN-09': {summary: 'A full run and a top-up need separate evidence.', detail: 'Describe each actual sample. Never calculate top-up time by scaling the weight of a full batch.', example: 'evidence', production: true},
  'STORE-01': {summary: 'Storage belongs to an exact product and physical state.', detail: 'Name the state, packaging and location precisely. Raw, cooked, frozen, thawed and opened states can need separate records.'},
  'STORE-02': {summary: 'Describe the exact packaging and local location.', detail: 'Identify the container, whether it is open or sealed, and where it is kept. Repacking does not automatically restart a safe storage period.'},
  'STORE-03': {summary: 'Observed quality is not an approved storage rule.', detail: 'Record what has actually been observed and its conditions. Keep safety or policy limits separate until an authorised person verifies a documented rule.', example: 'evidence'},
  'STORE-04': {summary: 'Unknown storage facts need a concrete check.', detail: 'Keep the value unknown and create a check that says what will be inspected, who will do it, how and by when.', example: 'checks'},
  'STORE-05': {summary: 'Capacity must refer to the exact stored state.', detail: 'Describe the real container and usable space. Storage capacity alone does not prove that a larger production batch is safe or practical.'},
  'CHECK-01': {summary: 'An assigned check is a task, not a result.', detail: 'Name the missing fact, responsible person, exact method, reason and due date. Add the result and evidence only after the check is performed.', example: 'checks'},
  'CHECK-02': {summary: 'Close a check only with a usable result.', detail: 'Record the result, evidence, performer and date. An inconclusive result needs a concrete next step.', example: 'checks'},
};

const field: Record<string, GuideEntry> = {
  'SET-01.interviewer': {summary: 'If you are filling this in yourself, enter your own name.', detail: 'This identifies who recorded the answers. It does not change your access or role.'},
  'SET-01.whose': {summary: 'Say whose method these answers describe.', detail: 'Choose your own usual method, an agreed kitchen method, or another cook’s work that you personally observed.'},
  'ITEM-01.identity': topic['ITEM-01'],
  'ITEM-01.stages': topic['ITEM-01'],
  'ITEM-02.route': topic['ITEM-02'],
  'ITEM-02.phase': topic['ITEM-02'],
  'ITEM-02.process': topic['ITEM-02'],
  'ITEM-03.actions': topic['ITEM-03'],
  'PROC-03.outputs': topic['PROC-03'],
  'RUN-01.basis': topic['RUN-01'],
  'RUN-01.size': topic['RUN-01'],
  'RUN-03.outputs': topic['RUN-03'],
  'RUN-07.steps': topic['RUN-07'],
  'RUN-07.intervals': topic['RUN-06'],
  'RUN-07.mode': topic['RUN-06'],
  'RUN-07.people': topic['RUN-06'],
  'RUN-09.topups': topic['RUN-09'],
  'STORE-01.phase': topic['STORE-01'],
  'STORE-02.container': topic['STORE-02'],
  'STORE-03.basis': topic['STORE-03'],
  'STORE-03.duration': topic['STORE-03'],
};

export function topicGuide(groupId: string, productionOutsideReview = false): GuideEntry | undefined {
  const entry = topic[groupId] ?? (groupId.startsWith('CHECK') ? topic['CHECK-01'] : undefined);
  return entry?.production && productionOutsideReview ? undefined : entry;
}

export function fieldGuide(groupId: string, path: string[], productionOutsideReview = false): GuideEntry | undefined {
  const last = path.at(-1);
  if (!last) return undefined;
  const entry = field[`${groupId}.${last}`];
  return entry?.production && productionOutsideReview ? undefined : entry;
}

export const guideExamples: Record<GuideExample, {title: string; steps: string[]; note: string}> = {
  coriander: {
    title: 'Product, stage and local work',
    steps: ['Coriander received', 'Washed whole', 'Chopped', 'Used or stored in that exact state'],
    note: 'Washing and chopping are local work. One real morning pass is a run sample; it is not the general method. Do not create or merge records unless they represent the real product and stage.',
  },
  'shared-output': {
    title: 'One cooking process, two outputs',
    steps: ['Example cooking', 'Example meat + Example broth', 'Shared work recorded once', 'Later meat-only cutting linked only to Example meat'],
    note: 'Two simultaneous jobs are not automatically one process. Keep the full run and a small top-up as separate samples; do not split shared time in half or scale it by weight.',
  },
  evidence: {
    title: 'What supports this value?',
    steps: ['Observed or measured run', 'Current written standard', 'Estimate of a typical run'],
    note: 'Choose the source that is actually available and record its date or limits. An estimate remains an estimate and an old entry is not a new measurement.',
  },
  checks: {
    title: 'A useful CHECK',
    steps: ['Name the exact missing fact', 'Assign a responsible person and date', 'Describe the exact method', 'Record the result and evidence later'],
    note: 'Assignment is not the answer. Do not invent a person, deadline, method or result.',
  },
  status: {
    title: 'Saved, confirmed and applied are different',
    steps: ['Draft saved', 'Topic confirmed', 'Check verified', 'Owner approval', 'Approved version applied'],
    note: 'Only the final explicit owner action changes the Recipe Notebook. Opening help or completing a topic never applies a correction.',
  },
};
