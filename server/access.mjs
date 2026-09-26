// Authorization and field projection are shared by every API read/write path.
export const ROLES=['admin','director','accountant','project_manager','foreman','employee','subcontractor','client'];
export const SCOPED=['project_manager','foreman','employee','subcontractor'];
const MODULES=['clients','projects','tasks','employees','subcontractors','suppliers','materials','expenses','estimates','invoices','events','messages','contracts','payments','time','files','users'];
export function permissions(user){
  let read=[],write=[];
  if(user.role==='admin')read=write=[...MODULES];
  if(user.role==='director')read=write=MODULES.filter(k=>k!=='users');
  if(user.role==='accountant'){read=['clients','projects','invoices','payments','expenses','suppliers','materials'];write=['invoices','payments','expenses','suppliers','materials'];}
  if(user.role==='project_manager'){read=['clients','projects','tasks','events','materials','files','messages'];write=['projects','tasks','events','materials','files','messages'];if(user.budgetAccess){read.push('expenses');write.push('expenses');}}
  if(user.role==='foreman'){read=['projects','tasks','events','materials','files','messages'];write=['projects','tasks','files','messages'];}
  if(['employee','subcontractor'].includes(user.role)){read=['projects','tasks','events','files','messages'];write=['tasks','files','messages'];}
  if(['foreman','employee'].includes(user.role)&&user.employeeId){read.push('employees','time');write.push('time');}
  if(user.role==='client'){read=['clients','projects','estimates','invoices','contracts','payments','events','files','messages'];write=['messages'];}
  return {read,write,budget:['admin','director','accountant'].includes(user.role)||(user.role==='project_manager'&&!!user.budgetAccess),share:['admin','director','project_manager'].includes(user.role)};
}
export const can=(user,kind,write=false)=>permissions(user)[write?'write':'read'].includes(kind);
const pick=(record,keys)=>Object.fromEntries(['id','version','createdAt','updatedAt',...keys].filter(k=>k in record).map(k=>[k,record[k]]));
export function accessControl(store){
  const {get}=store;
  const projectAllowed=(user,projectId)=>{
    const project=get('projects',projectId);if(!project)return false;
    if(['admin','director','accountant'].includes(user.role))return true;
    if(user.role==='client')return !!user.clientId&&project.clientId===user.clientId;
    return user.projectIds.includes(projectId);
  };
  const audienceAllowed=(user,audience)=>{
    if(['admin','director','project_manager'].includes(user.role))return true;
    return user.role==='client'?audience==='client':audience==='team';
  };
  const visible=(user,kind,row)=>{
    if(!row||!can(user,kind))return false;
    if(['admin','director','accountant'].includes(user.role))return true;
    if(user.role==='client'){
      if(kind==='clients')return row.id===user.clientId;
      if(kind==='projects')return projectAllowed(user,row.id);
      if(['estimates','invoices','contracts'].includes(kind))return row.clientId===user.clientId&&row.shared===true&&(kind==='contracts'||(kind==='estimates'?['sent','accepted','rejected'].includes(row.status):row.status==='sent'));
      if(kind==='payments')return visible(user,'invoices',get('invoices',row.invoiceId));
    }
    if(kind==='clients')return user.projectIds.some(p=>get('projects',p)?.clientId===row.id);
    if(kind==='projects')return projectAllowed(user,row.id);
    if(kind==='employees')return row.id===user.employeeId;
    if(kind==='time')return row.employeeId===user.employeeId; // Own completed history survives reassignment.
    if(!projectAllowed(user,row.projectId))return false;
    if(kind==='files'||kind==='messages')return audienceAllowed(user,row.audience||'internal');
    if(kind==='events'&&user.role==='client')return row.shared===true;
    if(kind==='tasks'&&['employee','subcontractor'].includes(user.role))return row.assigneeId===user.id;
    return true;
  };
  const project=(user,kind,row)=>{
    if(['admin','director','accountant'].includes(user.role))return row;
    if(kind==='clients')return pick(row,['name','company','email','phone','address','city','state','zip']);
    if(kind==='projects')return pick(row,['name','clientId','address','manager','start','due','progress','status',...(user.role==='client'?[]:['notes']),...(permissions(user).budget?['budget']:[])]);
    if(kind==='employees')return pick(row,['name','trade']);
    if(kind==='time')return pick(row,['employeeId','projectId','name','start','end','notes']);
    if(kind==='materials'&&!permissions(user).budget)return pick(row,['name','projectId','reference','quantity','due','status','notes']);
    if(user.role==='client'){
      if(kind==='payments')return pick(row,['name','invoiceId','projectId','amount','date','method']);
      if(kind==='estimates')return pick(row,['name','clientId','address','due','status','items','subtotal','discount','taxBps','tax','total','shared','decisionAt']);
      if(kind==='invoices')return pick(row,['name','clientId','projectId','due','status','amount','shared']);
      if(kind==='contracts')return pick(row,['name','clientId','projectId','total','status','items','shared']);
      if(kind==='events')return pick(row,['name','projectId','start','end','category','shared']);
    }
    return row;
  };
  return {projectAllowed,audienceAllowed,visible,project};
}
