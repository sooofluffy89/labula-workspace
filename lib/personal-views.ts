import {z} from 'zod';
export const preferenceSchema=z.object({search:z.string().max(500),type:z.enum(['all','bought','prep']),tracking:z.enum(['all','tracked','untracked']),menu:z.array(z.enum(['Starters','Main Dishes','Specials'])).max(3),group:z.string().max(100),current:z.string().max(50),instruction:z.enum(['all','with','without']),sort:z.enum(['asc','desc']),frequency:z.enum(['all','tracked','off','daily','twice-weekly','weekly']).optional()});
export type ListPreference=z.infer<typeof preferenceSchema>;
export const defaultPreference:ListPreference={search:'',type:'all',tracking:'all',menu:[],group:'all',current:'all',instruction:'all',sort:'asc'};
const viewSchema=z.object({id:z.string().max(100),name:z.string().trim().min(1).max(50),value:preferenceSchema});
export type PersonalView=z.infer<typeof viewSchema>;
export const personalViewsKey=(account:string,scope:string)=>`labula.personal-views.v1.${encodeURIComponent(account.toLowerCase())}.${encodeURIComponent(scope)}`;
export function readPersonalViews(raw:string|null):PersonalView[]{try{const result=z.array(viewSchema).max(30).safeParse(JSON.parse(raw??'[]'));return result.success?result.data:[];}catch{return [];}}
export function readListPreference(raw:string|null):ListPreference|null{try{const result=preferenceSchema.safeParse(JSON.parse(raw??'null'));return result.success?result.data:null;}catch{return null;}}
