import { randomUUID } from 'node:crypto';

export const models = {
  clients: { required:['name'], fields:['name','company','email','phone','address','city','state','zip','siteAddress','source','notes'], states:['new','contacted','appointment','sent','negotiation','won','lost'] },
  projects: { required:['name','clientId'], fields:['name','clientId','address','manager','start','due','notes'], numbers:['budget','progress'], states:['planned','preparing','active','waiting','delayed','completed','closed'] },
  tasks: { required:['name','projectId'], fields:['name','projectId','assignee','assigneeId','start','due','notes'], states:['todo','doing','done'], enums:{priority:['low','normal','high']} },
  employees: { required:['name'],fields:['name','email','phone','trade','expiry','notes'],numbers:['rate'],states:['available','assigned','unavailable'] },
  subcontractors: { required:['name'],fields:['name','email','phone','trade','license','insurance','expiry','notes'],numbers:['rate'],states:['available','assigned','unavailable'] },
  suppliers: { required:['name'],fields:['name','email','phone','address','notes'],states:['active','inactive'] },
  materials: { required:['name','projectId'],fields:['name','projectId','supplierId','reference','due','notes'],numbers:['quantity','unitPrice'],states:['to_order','ordered','shipped','delivered','used'] },
  expenses: { required:['name','projectId','date'],fields:['name','projectId','supplierId','date','notes'],numbers:['amount'],enums:{category:['materials','labor','equipment','transport','subcontractors','permits','insurance','other']} },
  estimates: { required:['name','clientId'],fields:['name','clientId','address','due','notes'],numbers:['taxBps','discount'],states:['draft','sent','accepted','rejected'] },
  invoices: { required:['name','clientId','projectId','due'],fields:['name','clientId','projectId','due','notes'],numbers:['amount'],states:['draft','sent','cancelled'] },
  events: { required:['name','projectId','start','end','assignee'],fields:['name','projectId','start','end','assignee','notes'],enums:{category:['work','meeting','delivery','inspection']} },
  messages: { required:['name','projectId','notes'],fields:['name','projectId','notes'],enums:{audience:['internal','team','client']} }
};
export const financeKinds=['expenses','estimates','invoices','payments','suppliers','materials','contracts'];
export const accountantKinds=['clients','projects','invoices','payments','expenses','suppliers','materials'];
export class Failure extends Error { constructor(code,status=400){ super(code);this.code=code;this.status=status; } }
export function must(condition,code,status=400){if(!condition)throw new Failure(code,status);}
export function money(n){must(Number.isSafeInteger(n)&&n>=0&&n<=1e12,'invalid_amount');return n;}
export function validate(kind, input, lookup){
  const model=models[kind]; must(model,'unknown_module',404);must(input && typeof input==='object' && !Array.isArray(input),'invalid_data');
  const out={};
  for(const key of model.fields){const val=input[key]??'';must(typeof val==='string'&&val.length<=(key==='notes'?5000:250),'invalid_'+key);out[key]=val.trim();}
  for(const key of model.required) must(out[key], 'required_'+key);
  if(out.email) must(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email),'invalid_email');
  for(const key of model.numbers??[]){const n=input[key]??0;must(typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1e12,'invalid_'+key);out[key]=n;if(!['quantity','progress'].includes(key))money(n);}
  if('progress' in out)must(out.progress<=100,'invalid_progress');
  if('taxBps' in out)must(out.taxBps<=10000,'invalid_taxBps');
  if(model.states){out.status=input.status??model.states[0];must(model.states.includes(out.status),'invalid_status');}
  for(const [key,choices] of Object.entries(model.enums??{})){out[key]=input[key]??choices[0];must(choices.includes(out[key]),'invalid_'+key);}
  for(const [key,k] of [['clientId','clients'],['projectId','projects'],['supplierId','suppliers']])if(out[key]) must(lookup(k,out[key]),'invalid_'+key);
  if(out.projectId&&out.clientId)must(lookup('projects',out.projectId).clientId===out.clientId,'client_project_mismatch');
  for(const key of ['date','due','expiry']) if(out[key])must(/^\d{4}-\d{2}-\d{2}$/.test(out[key])&&Number.isFinite(Date.parse(out[key]))&&new Date(out[key]).toISOString().slice(0,10)===out[key],'invalid_'+key);
  if(kind==='projects'||kind==='tasks'){if(out.start)must(/^\d{4}-\d{2}-\d{2}$/.test(out.start)&&Number.isFinite(Date.parse(out.start))&&new Date(out.start).toISOString().slice(0,10)===out.start,'invalid_start');if(out.start&&out.due)must(out.start<=out.due,'invalid_date_range');}
  if(kind==='events'){must(Number.isFinite(Date.parse(out.start))&&Number.isFinite(Date.parse(out.end))&&Date.parse(out.start)<Date.parse(out.end),'invalid_date_range');out.start=new Date(out.start).toISOString();out.end=new Date(out.end).toISOString();}
  if(kind==='estimates'){
    must(Array.isArray(input.items)&&input.items.length>0&&input.items.length<=100,'invalid_items');
    out.items=input.items.map(x=>{must(x&&typeof x.name==='string'&&x.name.trim().length>0&&x.name.length<=250,'invalid_item');must(typeof x.quantity==='number'&&Number.isFinite(x.quantity)&&x.quantity>0&&x.quantity<=1e6,'invalid_quantity');money(x.unitPrice);return {name:x.name.trim(),quantity:x.quantity,unitPrice:x.unitPrice,total:money(Math.round(x.quantity*x.unitPrice))};});
    out.subtotal=money(out.items.reduce((s,x)=>s+x.total,0));must(out.discount<=out.subtotal,'invalid_discount');out.tax=money(Math.round((out.subtotal-out.discount)*out.taxBps/10000));out.total=money(out.subtotal-out.discount+out.tax);
  }
  return out;
}
export const id=()=>randomUUID();
