// Données fictives de la démonstration en ligne. Tout passe par l'API réelle du serveur,
// avec ses validations. Chaque nom est marqué DEMO.
export const ACCOUNTS={
  direction:{name:'Direction · DEMO',email:'direction@demo.burntmills.test',password:'demo-direction-2026'},
  client:{name:'Alex Morgan · DEMO',email:'client@demo.burntmills.test',password:'demo-client-2026'}
};

export async function seed(api){
  const day=(delta=0)=>new Date(Date.now()+delta*86400000).toISOString().slice(0,10);
  const at=(delta,hour)=>{const d=new Date(Date.now()+delta*86400000);d.setHours(hour,0,0,0);return d.toISOString();};
  const add=(kind,data)=>api('POST','/api/records/'+kind,data);
  // Les factures et devis naissent en brouillon, puis sont émis comme dans l'application.
  const issue=async(kind,data)=>{const draft=await add(kind,{...data,status:'draft'});return api('PATCH',`/api/records/${kind}/${draft.id}`,{status:'sent',version:draft.version});};
  const {direction,client}=ACCOUNTS;

  await api('POST','/api/setup',{...direction});
  await api('POST','/api/demo',{});
  const state=await api('GET','/api/state');
  const r=state.records;
  const alex=r.clients.find(c=>c.name.startsWith('Alex Morgan'));
  const oak=r.projects.find(p=>p.name.startsWith('Oak House')),maple=r.projects.find(p=>p.name.startsWith('Maple Residence'));

  const casey=await add('clients',{name:'Casey Brooks · DEMO',email:'casey@example.com',phone:'+1 (301) 555-0142',city:'Rockville',state:'MD',source:'Website / Site internet',status:'won',notes:'Fictional record / Donnée fictive'});
  const riley=await add('clients',{name:'Riley Chen · DEMO',email:'riley@example.com',city:'Takoma Park',state:'MD',source:'Referral',status:'won',notes:'Fictional record / Donnée fictive'});
  await add('clients',{name:'Morgan Diaz · DEMO',email:'morgan@example.com',city:'Wheaton',state:'MD',source:'Website / Site internet',status:'new',notes:'Basement finishing request · DEMO'});
  await add('clients',{name:'Sam Patel · DEMO',email:'sam@example.com',city:'College Park',state:'MD',source:'Referral',status:'appointment',notes:'Deck and porch · DEMO'});

  const cedar=await add('projects',{name:'Cedar Porch · DEMO',clientId:casey.id,address:'Rockville, MD · DEMO',manager:'Alex',start:day(-150),due:day(-40),budget:3600000,progress:100,status:'completed',notes:'Porch and exterior stairs / Porche et escalier extérieur — DEMO'});
  const birch=await add('projects',{name:'Birch Bathroom · DEMO',clientId:riley.id,address:'Takoma Park, MD · DEMO',manager:'Jordan',start:day(-60),due:day(12),budget:2800000,progress:80,status:'active',notes:'Bathroom remodel / Rénovation de salle de bains — DEMO'});

  await add('subcontractors',{name:'Capital Plumbing · DEMO',email:'plumbing@example.com',trade:'Plumbing',license:'MD-DEMO-0001',insurance:'Policy DEMO',expiry:day(18),rate:6500,status:'assigned',notes:''});
  await add('suppliers',{name:'Montgomery Lumber · DEMO',email:'orders@example.com',phone:'+1 (301) 555-0199',address:'Gaithersburg, MD · DEMO',status:'active',notes:''});

  // Six mois d'activité pour le graphique du tableau de bord.
  const history=[
    [cedar,'Cedar Porch — deposit · DEMO',1200000,-150],[cedar,'Cedar Porch — progress · DEMO',1400000,-110],[cedar,'Cedar Porch — final · DEMO',1000000,-45],
    [birch,'Birch Bathroom — deposit · DEMO',900000,-58],[birch,'Birch Bathroom — progress · DEMO',950000,-20]
  ];
  for(const [project,name,amount,delta] of history){
    const inv=await issue('invoices',{name,clientId:project.clientId,projectId:project.id,amount,due:day(delta+14),notes:'Fictional invoice'});
    await api('POST','/api/payments',{invoiceId:inv.id,amount,date:day(delta+6),method:delta%2?'check':'bank',reference:'DEMO-'+String(-delta).padStart(3,'0'),notes:'Fictional, not a real payment'});
  }
  const open=await issue('invoices',{name:'Oak House — progress · DEMO',clientId:alex.id,projectId:oak.id,amount:3000000,due:day(10),notes:'Fictional invoice'});
  for(const [project,name,category,amount,delta] of [
    [cedar,'Pressure-treated lumber · DEMO','materials',640000,-140],[cedar,'Railing installation · DEMO','subcontractors',820000,-100],
    [birch,'Tile and fixtures · DEMO','materials',540000,-50],[birch,'Plumbing rough-in · DEMO','subcontractors',610000,-30],
    [oak,'Permit fees · DEMO','permits',95000,-18],[maple,'Dumpster rental · DEMO','equipment',45000,-6]
  ])await add('expenses',{name,projectId:project.id,category,amount,date:day(delta),notes:''});

  const quote=await issue('estimates',{name:'Kitchen island extension · DEMO',clientId:alex.id,address:'Silver Spring, MD · DEMO',due:day(20),items:[{name:'Island cabinetry · DEMO',quantity:1,unitPrice:980000},{name:'Quartz countertop · DEMO',quantity:32,unitPrice:9500}],taxBps:0,discount:0,notes:'Fictional estimate'});
  await api('POST','/api/share/estimates/'+quote.id,{shared:true,version:quote.version});
  await api('POST','/api/share/invoices/'+open.id,{shared:true,version:open.version});

  await add('tasks',{name:'Cabinet installation · DEMO',projectId:oak.id,assignee:'Alex',start:day(1),due:day(4),priority:'high',status:'todo',notes:''});
  await add('tasks',{name:'Shower glass install · DEMO',projectId:birch.id,assignee:'Jordan',due:day(3),priority:'normal',status:'doing',notes:''});
  await add('events',{name:'Client walkthrough · DEMO',projectId:oak.id,assignee:'Alex',start:at(2,10),end:at(2,11),category:'meeting',notes:''});
  await add('events',{name:'Tile delivery · DEMO',projectId:birch.id,assignee:'Jordan',start:at(4,8),end:at(4,9),category:'delivery',notes:''});
  await add('messages',{name:'Cabinet delivery · DEMO',projectId:oak.id,audience:'client',notes:'Cabinets arrive Monday morning; please keep the driveway clear. / Livraison des meubles lundi matin. — DEMO'});

  await api('POST','/api/users',{...client,role:'client',clientId:alex.id,projectIds:[],active:true,budgetAccess:false});
}
