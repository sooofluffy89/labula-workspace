// These older regression scenarios run as visitors already invited to a private
// Site. Explicitly provision that synthetic audience, not production visitors.
// New allowlist tests do NOT use this helper and exercise denied identities.
export function fixtureAuthSource(userExpression,dbExpression){return `
 const provisioned=new WeakMap();
 export const getChatGPTUser=async()=>{
  const user=${userExpression};if(!user)return null;const db=${dbExpression};let seen=provisioned.get(db);if(!seen){seen=new Set();provisioned.set(db,seen);}if(seen.has(user.userId))return user;
  const row=await db.prepare('SELECT * FROM kitchen_team WHERE user_id=? OR lower(email)=?').bind(user.userId,user.email.toLowerCase()).first();
  if(!row)await db.prepare("INSERT INTO kitchen_team(id,user_id,email,name,access_role,active,access_enabled,revision,created_at) VALUES(?,?,?,?,'legacy',1,1,0,?) ON CONFLICT DO NOTHING").bind(crypto.randomUUID(),user.userId,user.email.toLowerCase(),user.fullName??user.email,new Date().toISOString()).run();
  else if(row.access_enabled===0&&row.revision===0)await db.prepare('UPDATE kitchen_team SET access_enabled=1 WHERE id=?').bind(row.id).run();
  if(user.email.toLowerCase()==='jan@bananasport.cz')await db.prepare("INSERT INTO kitchen_owner(id,user_id) VALUES('owner',?) ON CONFLICT(id) DO NOTHING").bind(user.userId).run();
  seen.add(user.userId);return user;
 };`}
