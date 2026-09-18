'use client';
export function TextArea({value,onChange,id,placeholder}:{value:string;onChange:(v:string)=>void;id?:string;placeholder?:string}){return <textarea id={id} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={2} maxLength={6000}/>;}
