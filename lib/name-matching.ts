// Exact scores at or above the suggestion threshold, with early rejection below it.
export const prepareName=(name:string)=>({name,tokens:name.split(' '),tokenSet:new Set(name.split(' '))});
export function matchingScore(a:string,b:string){return preparedScore(prepareName(a),prepareName(b));}
export function preparedScore(left:ReturnType<typeof prepareName>,right:ReturnType<typeof prepareName>,best=0){
 const a=left.name,b=right.name;if(a===b)return 1;if(!a||!b)return best;
 const longest=Math.max(a.length,b.length);
 const overlap=left.tokens.filter(t=>right.tokenSet.has(t)).length/Math.max(left.tokens.length,right.tokens.length)*.9;
 if(Math.max(overlap,1-Math.abs(a.length-b.length)/longest)<=best)return best;
 const limit=Math.floor(longest*(1-Math.max(.7,best))+1e-9);
 if(Math.abs(a.length-b.length)>limit)return Math.max(best,overlap);
 let start=0,endA=a.length,endB=b.length;
 while(start<endA&&start<endB&&a[start]===b[start])start++;
 while(endA>start&&endB>start&&a[endA-1]===b[endB-1]){endA--;endB--;}
 const al=endA-start,bl=endB-start;
 if(!al||!bl)return Math.max(best,overlap,1-Math.max(al,bl)/longest);
 let prev=new Uint16Array(bl+1),row=new Uint16Array(bl+1);
 for(let j=0;j<=bl;j++)prev[j]=j;
 for(let i=1;i<=al;i++){
  row.fill(limit+1);row[0]=i;let min=limit+1;
  for(let j=Math.max(1,i-limit);j<=Math.min(bl,i+limit);j++){
   row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[start+i-1]===b[start+j-1]?0:1));min=Math.min(min,row[j]);
  }
  if(min>limit)return Math.max(best,overlap);
  const swap=prev;prev=row;row=swap;
 }
 return Math.max(best,overlap,1-prev[bl]/longest);
}
