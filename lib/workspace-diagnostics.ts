import {getChatGPTUser} from '@/app/chatgpt-auth';
import {getRawDb} from '@/db';
import {RequestError} from './access-context';
import {accessRole} from './team-access-server';

type SchemaRow={type:string;name:string;tbl_name:string;sql:string|null};
type ColumnRow={name:string;type:string;pk:number};
const SCHEMA_LIMIT=2000,LEDGER_TABLE_LIMIT=16,LEDGER_ROW_LIMIT=200;
const schemaSql="SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name LIMIT "+(SCHEMA_LIMIT+1);
const privateHeaders={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};

// Identifiers come only from sqlite_schema, never request input. Quoting still
// matters: SQLite permits quote characters and SQL punctuation in table names.
export function quoteDiagnosticIdentifier(name:string){return '"'+name.replaceAll('"','""')+'"';}
function isLedger(name:string,columns:ColumnRow[]){
 if(['d1_migrations','__drizzle_migrations'].includes(name.toLowerCase()))return true;
 const fields=new Set(columns.map(column=>column.name.toLowerCase()));
 return ['hash','checksum','migration','migration_id','migration_name','version','name'].some(field=>fields.has(field))&&
  ['id','created_at','applied_at','executed_at','timestamp','applied','created'].some(field=>fields.has(field));
}
async function requireExistingOwner(user:NonNullable<Awaited<ReturnType<typeof getChatGPTUser>>>){
 if(await accessRole(user,'management',false)!=='owner')throw new RequestError('Only the existing Owner can read workspace diagnostics.',403,'role_restricted');
}

// A dedicated read-only boundary avoids the ordinary identity-link/bootstrap
// path. It has no POST, arbitrary SQL, schema changes or repair functionality.
export async function workspaceDiagnostics(request:Request){
 try{
  const user=await getChatGPTUser();if(!user)throw new RequestError('Sign in to read diagnostics.',401,'sign_in_required');
  if(request.headers.get('X-Labula-Account-Id')&&request.headers.get('X-Labula-Account-Id')!==user.userId)throw new RequestError('The signed-in account changed.',403,'account_changed');
  await requireExistingOwner(user);
  if(request.method!=='GET')throw new RequestError('Method not allowed.',405);
  if(new URL(request.url).search)throw new RequestError('Diagnostics accepts no query parameters.',400,'diagnostics_fixed_query');
  const db=getRawDb(),first=await db.prepare(schemaSql).all<SchemaRow>();
  const schema=first.results.slice(0,SCHEMA_LIMIT),schemaComplete=first.results.length<=SCHEMA_LIMIT;
  const candidates=schema.filter(row=>row.type==='table'&&/migrat(?:ion|ions|e)/i.test(row.name));
  const ledgers:Record<string,unknown>[]=[];
  for(const table of candidates.slice(0,LEDGER_TABLE_LIMIT)){
   const identifier=quoteDiagnosticIdentifier(table.name);
   try{
    const metadata=await db.prepare('PRAGMA table_info('+identifier+')').all<ColumnRow>();
    const columns=metadata.results.map(column=>({name:column.name,type:column.type,pk:column.pk}));
    if(!isLedger(table.name,metadata.results)){ledgers.push({table:table.name,columns,selected:false,reason:'Migration-named table does not have identified ledger columns.'});continue;}
    const values=await db.batch([
     db.prepare('SELECT count(*) AS row_count FROM '+identifier),
     db.prepare('SELECT * FROM '+identifier+' LIMIT '+(LEDGER_ROW_LIMIT+1)),
    ]);
    const rows=values[1].results,total=(values[0].results[0] as {row_count:number}).row_count;
    ledgers.push({table:table.name,columns,selected:true,readable:true,totalRows:total,rows:rows.slice(0,LEDGER_ROW_LIMIT),complete:rows.length<=LEDGER_ROW_LIMIT});
   }catch{
    // Some hosting-owned tables may be protected. Preserve the schema evidence
    // and explicitly identify the unreadable table instead of guessing its state.
    ledgers.push({table:table.name,selected:true,readable:false,complete:false,error:'The database did not permit reading this migration metadata table.'});
   }
  }
  const last=await db.prepare(schemaSql).all<SchemaRow>();
  if(JSON.stringify(first.results)!==JSON.stringify(last.results))throw new RequestError('Database schema changed during diagnostics. Load a new report.',409,'diagnostics_changed');
  // Withhold the entire private response if Owner access changed during reads.
  await requireExistingOwner(user);
  return Response.json({format:'LABULA read-only database diagnostics',version:1,readOnly:true,accountId:user.userId,capturedAt:new Date().toISOString(),
   schema,schemaComplete,ledgers,discovery:{rule:'Actual sqlite_schema tables with migration-related names; known ledger names or identifying metadata columns.',candidateTables:candidates.map(table=>table.name),allCandidatesInspected:candidates.length<=LEDGER_TABLE_LIMIT},
   limits:{schemaObjects:SCHEMA_LIMIT,ledgerTables:LEDGER_TABLE_LIMIT,rowsPerLedger:LEDGER_ROW_LIMIT},
   scope:'Schema and bounded migration metadata only. This is not a restaurant-data backup, write freeze, migration repair or authorization to deploy.'},
   {headers:{...privateHeaders,'X-Labula-Account-Id':user.userId}});
 }catch(error){const known=error instanceof RequestError;return Response.json({error:known?error.message:'Could not read database diagnostics. No repair was attempted.',code:known?error.code:'diagnostics_unavailable'},{status:known?error.status:503,headers:privateHeaders});}
}
