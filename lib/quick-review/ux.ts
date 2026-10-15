import type {Gap} from './model';
export function quickStepFor(topic:string):0|1|2{return topic==='scope'?0:['trigger','limits'].includes(topic)?2:1;}
export function blockingStepGaps(gaps:Gap[],step:number){return gaps.filter(g=>!g.unknown&&quickStepFor(g.topic)===step);}
