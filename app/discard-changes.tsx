'use client';
import {useState} from 'react';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
export function useDiscardChanges(dirty:boolean,onDiscard:()=>void){
 const [confirm,setConfirm]=useState(false);
 const requestClose=()=>{if(dirty)setConfirm(true);else onDiscard();};
 const confirmation=<AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Discard these changes?</AlertDialogTitle><AlertDialogDescription>Your changes have not been shared. Keep editing to continue, or discard this form.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={()=>{setConfirm(false);onDiscard();}}>Discard changes</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
 return {requestClose,confirmation};
}
