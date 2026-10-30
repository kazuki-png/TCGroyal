export class BackActions{
 private entries:{priority:number;handle:()=>boolean}[]=[];
 register(priority:number,handle:()=>boolean){const entry={priority,handle};this.entries.push(entry);return()=>{this.entries=this.entries.filter(value=>value!==entry)}}
 dispatch(){
  // Highest visible layer first; most recently mounted handler wins ties.
  for(const entry of [...this.entries].reverse().sort((a,b)=>b.priority-a.priority))if(entry.handle())return true;
  return false; // Delegate tab roots to Android's default back/exit behaviour.
 }
}
export const appBackActions=new BackActions();
