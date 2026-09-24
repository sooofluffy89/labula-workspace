// Presentation only. Stored answers and queued commands keep have / missing / null.
export function morningChoice(targetDay:string,tomorrowDay:string){
 const isTomorrow=targetDay===tomorrowDay;
 const date=new Date(targetDay+'T12:00:00Z');
 const label=isTomorrow?'For tomorrow':Number.isNaN(date.getTime())?'For the selected morning':`For ${new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(date)}`;
 return {label,column:'To do'};
}
export function stockAnswerLabel(value:unknown,plannedLabel:string){
 return value==='have'?'No action needed':value==='missing'?plannedLabel:'Unchecked';
}
export function historicalAnswerLabel(value:unknown){
 return value==='have'?'No morning task selected':value==='missing'?'For Morning prep':'Unchecked';
}
export function answerActivityLabel(value:unknown){
 return value==='have'?'Not selected for Morning prep':value==='missing'?'Selected for Morning prep':'Returned to Unchecked';
}
