import {getRawDb} from '@/db';
import {scopeSource,type MenuScopeSource} from './menu-scope';

// Final source per revision: Review apply updates notebook and authority within one transaction.
export const menuSourcesSql='SELECT * FROM menu_scope_sources WHERE seq IN (SELECT max(seq) FROM menu_scope_sources GROUP BY notebook_revision) ORDER BY seq';
export const latestMenuSourceSql='SELECT * FROM menu_scope_sources ORDER BY seq DESC LIMIT 1';
export async function readMenuSource(){const row=await getRawDb().prepare(latestMenuSourceSql).first<MenuScopeSource>();return row?{row,scope:scopeSource(row)}:null;}
export const activeScopeSql=(column:string)=>`${column} IN (SELECT value FROM json_each(?))`;
