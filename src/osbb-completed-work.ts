export type CompletedWorkRole = 'electrician' | 'janitor' | 'plumber';
export interface CompletedWorkEntry { id:string; workDate:string; workerRole:CompletedWorkRole; description:string; note:string }
export interface CompletedWorkDraft { id?:string | null; workDate?:string; workerRole?:string; description?:string; note?:string }
export const COMPLETED_WORK_ROLES: readonly CompletedWorkRole[] = ['electrician','janitor','plumber'];
export function normalizeCompletedWorkEntry(value:unknown):CompletedWorkEntry|null {
    if(typeof value!=='object'||value===null||Array.isArray(value))return null;const row=value as Record<string,unknown>;
    const id=typeof row.id==='string'&&/^[0-9a-f-]{36}$/i.test(row.id)?row.id:null;const workDate=typeof row.work_date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(row.work_date)?row.work_date:'';
    const workerRole=typeof row.worker_role==='string'&&COMPLETED_WORK_ROLES.includes(row.worker_role as CompletedWorkRole)?row.worker_role as CompletedWorkRole:null;
    const description=typeof row.description==='string'?row.description.trim():'';const note=typeof row.note==='string'?row.note.trim():'';
    return id&&workDate&&workerRole&&description&&description.length<=1000&&note.length<=500?{id,workDate,workerRole,description,note}:null;
}
export function completedWorkEntriesFromResponse(value:unknown):CompletedWorkEntry[]{return Array.isArray(value)?value.flatMap(entry=>normalizeCompletedWorkEntry(entry)||[]):[];}
export function validateCompletedWorkDraft(value:CompletedWorkDraft):{error:string}|{value:{id:string|null;workDate:string;workerRole:CompletedWorkRole;description:string;note:string}}{
    const workDate=typeof value?.workDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.workDate)?value.workDate:'';const workerRole=typeof value?.workerRole==='string'&&COMPLETED_WORK_ROLES.includes(value.workerRole as CompletedWorkRole)?value.workerRole as CompletedWorkRole:null;
    const description=String(value?.description??'').trim(),note=String(value?.note??'').trim();if(!workDate)return{error:'Оберіть дату роботи'};if(!workerRole)return{error:'Оберіть виконавця'};if(!description)return{error:'Опишіть виконану роботу'};if(description.length>1000)return{error:'Опис має бути до 1000 символів'};if(note.length>500)return{error:'Примітка має бути до 500 символів'};
    const id=value?.id==null||value.id===''?null:typeof value.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id)?value.id:undefined;if(id===undefined)return{error:'Некоректний ідентифікатор запису'};return{value:{id,workDate,workerRole,description,note}};
}
export function filterCompletedWork(entries:CompletedWorkEntry[],query:unknown,role='all'):CompletedWorkEntry[]{const needle=String(query??'').trim().toLocaleLowerCase('uk-UA');return entries.filter(entry=>(role==='all'||entry.workerRole===role)&&(!needle||`${entry.description} ${entry.note}`.toLocaleLowerCase('uk-UA').includes(needle)));}
