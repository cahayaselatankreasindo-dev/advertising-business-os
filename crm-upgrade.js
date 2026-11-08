(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CSKCRMUpgrade = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const LEAD_STATUSES = ["new", "contacted", "nego", "won", "lost"];
  const PROJECT_STATUSES = ["plan", "ongoing", "review", "done"];
  function normalizeText(value) {
    return String(value == null ? "" : value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }
  function toISODate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.getFullYear() + "-" + String(value.getMonth()+1).padStart(2,"0") + "-" + String(value.getDate()).padStart(2,"0");
    }
    const raw=String(value == null ? "" : value).trim();
    const match=raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if(!match)return "";
    const parts=match[1].split("-").map(Number), check=new Date(parts[0],parts[1]-1,parts[2]);
    return check.getFullYear()===parts[0]&&check.getMonth()===parts[1]-1&&check.getDate()===parts[2]?match[1]:"";
  }
  function todayISO(now){return toISODate(now instanceof Date?now:new Date());}
  function getLeadFollowUpState(lead,today){
    const date=toISODate(lead&&lead.nextFollowUp);if(!date)return "unscheduled";
    const current=toISODate(today)||todayISO();return date<current?"overdue":date===current?"today":"scheduled";
  }
  function getProjectDeadlineState(project,today){
    if(normalizeText(project&&project.status)==="done")return "completed";
    const date=toISODate(project&&project.deadline);if(!date)return "no-date";
    const current=toISODate(today)||todayISO();return date<current?"overdue":date===current?"today":"upcoming";
  }
  function leadMatchesQuery(lead,query){
    const q=normalizeText(query);if(!q)return true;
    return [lead&&lead.name,lead&&lead.phone,lead&&lead.email,lead&&lead.source,lead&&lead.industry,lead&&lead.pic,lead&&lead.picTitle,lead&&lead.notes,lead&&lead.followUpNote]
      .some(value=>normalizeText(value).includes(q));
  }
  function filterLeadRecords(leads,options,today){
    const opts=options||{};
    return (Array.isArray(leads)?leads:[]).filter(lead=>{
      if(opts.status&&opts.status!=="all"&&normalizeText(lead.status)!==normalizeText(opts.status))return false;
      if(!leadMatchesQuery(lead,opts.query))return false;
      if(opts.followUp&&opts.followUp!=="all"&&getLeadFollowUpState(lead,today)!==opts.followUp)return false;
      return true;
    });
  }
  function filterClientRecords(clients,options){
    const q=normalizeText(options&&options.query);
    return (Array.isArray(clients)?clients:[]).filter(client=>!q||[client&&client.name,client&&client.phone,client&&client.notes,client&&client.review].some(value=>normalizeText(value).includes(q)));
  }
  function filterProjectRecords(projects,options,today){
    const opts=options||{},q=normalizeText(opts.query);
    return (Array.isArray(projects)?projects:[]).filter(project=>{
      if(opts.status&&opts.status!=="all"&&normalizeText(project.status)!==normalizeText(opts.status))return false;
      if(opts.deadline&&opts.deadline!=="all"&&getProjectDeadlineState(project,today)!==opts.deadline)return false;
      return !q||[project&&project.title,project&&project.client,project&&project.pic,project&&project.notes].some(value=>normalizeText(value).includes(q));
    });
  }
  function getProjectProgress(project){
    const raw=String(project&&project.sopChecklist||"");if(!raw.trim())return {completed:0,total:5,percent:0};
    const entries=raw.split(";").map(part=>part.split(":")),total=entries.length||5;
    const completed=entries.filter(pair=>pair.length>1&&String(pair[1]).trim()==="1").length;
    return {completed:completed,total:total,percent:Math.round(completed/total*100)};
  }
  function summarizeCRM(leads,projects,today){
    const active=(Array.isArray(leads)?leads:[]).filter(lead=>!["won","lost"].includes(normalizeText(lead.status)));
    const overdueLeads=active.filter(lead=>getLeadFollowUpState(lead,today)==="overdue").sort((a,b)=>toISODate(a.nextFollowUp).localeCompare(toISODate(b.nextFollowUp)));
    const dueTodayLeads=active.filter(lead=>getLeadFollowUpState(lead,today)==="today");
    const unscheduledLeads=active.filter(lead=>getLeadFollowUpState(lead,today)==="unscheduled");
    const overdueProjects=(Array.isArray(projects)?projects:[]).filter(project=>getProjectDeadlineState(project,today)==="overdue").sort((a,b)=>toISODate(a.deadline).localeCompare(toISODate(b.deadline)));
    return {activeLeads:active.length,overdueLeads:overdueLeads,dueTodayLeads:dueTodayLeads,unscheduledLeads:unscheduledLeads,overdueProjects:overdueProjects};
  }
  return {LEAD_STATUSES,PROJECT_STATUSES,normalizeText,toISODate,todayISO,getLeadFollowUpState,getProjectDeadlineState,filterLeadRecords,filterClientRecords,filterProjectRecords,getProjectProgress,summarizeCRM};
});

/* Browser integration for the existing CSK Business OS. */
(function installCSKCRM(root){
  if(!root||!root.document||!root.CSKCRMUpgrade)return;
  const api=root.CSKCRMUpgrade,doc=root.document;let installed=false;
  function appDB(){try{return typeof db!=="undefined"?db:null;}catch(_){return null;}}
  function notify(message,isError){try{if(typeof showToast==="function")showToast(message,!!isError);}catch(_){}}
  function persist(){try{if(typeof saveDB==="function")saveDB();}catch(error){notify("Perubahan CRM belum tersimpan: "+String(error&&error.message||error),true);}}
  function el(tag,classes,value){const node=doc.createElement(tag);if(classes)node.className=classes;if(value!==undefined)node.textContent=value;return node;}
  function searchInput(id,placeholder){const input=el("input","w-full min-w-0 p-2.5 border border-slate-200 rounded-lg text-xs bg-white");input.type="search";input.id=id;input.placeholder=placeholder;input.setAttribute("aria-label",placeholder);return input;}
  function selectInput(id,label,options){const select=el("select","w-full min-w-0 p-2.5 border border-slate-200 rounded-lg text-xs bg-white");select.id=id;select.setAttribute("aria-label",label);options.forEach(option=>{const item=el("option","",option.label);item.value=option.value;select.appendChild(item);});return select;}
  function toolbar(id,target,controls){
    if(doc.getElementById(id)||!target||!target.parentNode)return;
    const bar=el("div","grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 bg-white border border-slate-200 rounded-xl p-3 shadow-sm");bar.id=id;
    controls.forEach(control=>bar.appendChild(control));target.parentNode.insertBefore(bar,target);
  }
  function injectFormFields(){
    const notes=doc.getElementById("lead-notes");
    if(notes&&!doc.getElementById("lead-next-follow-up")){
      const group=el("div","grid grid-cols-1 sm:grid-cols-2 gap-2"),dateWrap=el("div"),noteWrap=el("div");
      dateWrap.appendChild(el("label","block font-semibold text-slate-700 mb-1","Jadwal Follow-up Berikutnya"));
      const date=el("input","w-full p-2 border border-slate-300 rounded-lg bg-white");date.type="date";date.id="lead-next-follow-up";dateWrap.appendChild(date);
      noteWrap.appendChild(el("label","block font-semibold text-slate-700 mb-1","Catatan Follow-up"));
      const note=el("input","w-full p-2 border border-slate-300 rounded-lg");note.type="text";note.id="lead-follow-up-note";note.placeholder="Contoh: Hubungi kembali setelah penawaran";noteWrap.appendChild(note);
      group.append(dateWrap,noteWrap);const form=notes.closest("form");if(form&&notes.parentElement)form.insertBefore(group,notes.parentElement);
    }
    const projectNotes=doc.getElementById("proj-notes");
    if(projectNotes&&!doc.getElementById("proj-pic")){
      const wrap=el("div"),label=el("label","block font-semibold text-slate-700 mb-1","PIC / Penanggung Jawab Proyek"),input=el("input","w-full p-2 border border-slate-300 rounded-lg");
      input.type="text";input.id="proj-pic";input.placeholder="Nama anggota tim";wrap.append(label,input);
      const form=projectNotes.closest("form");if(form&&projectNotes.parentElement)form.insertBefore(wrap,projectNotes.parentElement);
    }
  }
  function injectControls(){
    const leads=doc.getElementById("leads-container");
    if(leads){
      const search=searchInput("csk-lead-search","Cari nama, WhatsApp, email, PIC, industri, catatan…");
      const follow=selectInput("csk-lead-follow-filter","Filter jadwal follow-up",[
        {value:"all",label:"Semua jadwal follow-up"},{value:"overdue",label:"Terlambat ditindaklanjuti"},{value:"today",label:"Follow-up hari ini"},{value:"scheduled",label:"Terjadwal"},{value:"unscheduled",label:"Belum dijadwalkan"}
      ]);
      toolbar("csk-lead-tools",leads,[search,follow]);search.addEventListener("input",()=>root.renderLeads&&root.renderLeads());follow.addEventListener("change",()=>root.renderLeads&&root.renderLeads());
    }
    const clients=doc.getElementById("clients-container");
    if(clients){const search=searchInput("csk-client-search","Cari nama klien, WhatsApp, atau catatan…");toolbar("csk-client-tools",clients,[search]);search.addEventListener("input",()=>root.renderClients&&root.renderClients());}
    const projects=doc.getElementById("projects-container");
    if(projects){
      const search=searchInput("csk-project-search","Cari proyek, klien, PIC, atau catatan…");
      const status=selectInput("csk-project-status-filter","Filter status proyek",[
        {value:"all",label:"Semua status proyek"},{value:"plan",label:"Perencanaan"},{value:"ongoing",label:"Pengerjaan"},{value:"review",label:"Review klien"},{value:"done",label:"Selesai"}
      ]);
      const deadline=selectInput("csk-project-deadline-filter","Filter deadline proyek",[
        {value:"all",label:"Semua deadline"},{value:"overdue",label:"Terlambat"},{value:"today",label:"Deadline hari ini"},{value:"upcoming",label:"Belum jatuh tempo"},{value:"no-date",label:"Belum ada deadline"}
      ]);
      toolbar("csk-project-tools",projects,[search,status,deadline]);search.addEventListener("input",()=>root.renderProjects&&root.renderProjects());status.addEventListener("change",()=>root.renderProjects&&root.renderProjects());deadline.addEventListener("change",()=>root.renderProjects&&root.renderProjects());
    }
  }
  function activeLeadStatus(){try{if(typeof currentLeadFilter!=="undefined")return currentLeadFilter;}catch(_){}const active=Array.from(doc.querySelectorAll(".lead-filter-btn")).find(button=>button.classList.contains("bg-slate-900"));return active&&active.dataset.filter||"all";}
  function decorateLeadCards(leads){
    const container=doc.getElementById("leads-container");if(!container)return;
    Array.from(container.querySelectorAll("article")).forEach((card,index)=>{
      const lead=leads[index];if(!lead||card.querySelector(".csk-lead-followup"))return;
      const state=api.getLeadFollowUpState(lead),labels={overdue:"Terlambat",today:"Hari ini",scheduled:"Terjadwal",unscheduled:"Belum dijadwalkan"};
      const color=state==="overdue"?"bg-red-100 text-red-700":state==="today"?"bg-amber-100 text-amber-700":"bg-slate-100 text-slate-600";
      const panel=el("section","csk-lead-followup border border-slate-200 bg-slate-50 rounded-xl p-3 space-y-2"),heading=el("div","flex items-center justify-between gap-2");
      heading.append(el("span","text-[11px] font-bold text-slate-700","Tindak lanjut"),el("span","px-2 py-1 rounded-full text-[10px] font-semibold "+color,labels[state]));panel.appendChild(heading);
      const fields=el("div","grid grid-cols-1 sm:grid-cols-2 gap-2"),date=el("input","w-full p-2 border border-slate-200 rounded-lg text-xs bg-white"),note=el("input","w-full p-2 border border-slate-200 rounded-lg text-xs bg-white");
      date.type="date";date.value=api.toISODate(lead.nextFollowUp);date.setAttribute("aria-label","Tanggal follow-up "+String(lead.name||""));
      note.type="text";note.value=String(lead.followUpNote||"");note.placeholder="Catatan follow-up";note.setAttribute("aria-label","Catatan follow-up "+String(lead.name||""));fields.append(date,note);panel.appendChild(fields);
      const actions=el("div","flex flex-wrap gap-2"),save=el("button","px-3 py-2 rounded-lg bg-slate-900 text-white text-[11px] font-semibold","Simpan jadwal"),contacted=el("button","px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-semibold","Catat sudah dihubungi");
      save.type="button";save.addEventListener("click",()=>{lead.nextFollowUp=date.value||"";lead.followUpNote=note.value.trim();persist();notify("Jadwal follow-up diperbarui.");});
      contacted.type="button";contacted.addEventListener("click",()=>{lead.lastContactAt=api.todayISO();if(lead.status==="new")lead.status="contacted";persist();notify("Kontak terakhir berhasil dicatat.");});
      actions.append(save,contacted);panel.appendChild(actions);if(lead.lastContactAt)panel.appendChild(el("p","text-[10px] text-slate-500","Kontak terakhir: "+api.toISODate(lead.lastContactAt)));card.appendChild(panel);
    });
  }
  function decorateClientCards(clients){
    const container=doc.getElementById("clients-container");if(!container)return;
    Array.from(container.querySelectorAll("article")).forEach((card,index)=>{
      const client=clients[index];if(!client)return;
      Array.from(card.querySelectorAll("div")).forEach(label=>{if((label.textContent||"").trim()==="LTV Total")label.textContent="Total Nilai Proyek";});
      const count=Math.max(0,Number(client.projectsCount)||0),label=count>1?"Repeat Order":count===1?"1 Proyek":"Belum ada proyek";
      card.appendChild(el("span","inline-flex self-start px-2 py-1 rounded-full text-[10px] font-semibold "+(count>1?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-600"),label));
    });
  }
  function decorateProjectCards(projects){
    const container=doc.getElementById("projects-container");if(!container)return;
    Array.from(container.querySelectorAll("article")).forEach((card,index)=>{
      const project=projects[index];if(!project)return;
      const progress=api.getProjectProgress(project),state=api.getProjectDeadlineState(project),meta=el("div","flex flex-wrap items-center gap-2 text-[11px] text-slate-600");
      if(project.pic)meta.appendChild(el("span","px-2 py-1 rounded-full bg-indigo-50 text-indigo-700","PIC: "+String(project.pic)));
      meta.appendChild(el("span","px-2 py-1 rounded-full bg-slate-100 text-slate-700","SOP "+progress.completed+"/"+progress.total+" ("+progress.percent+"%)"));
      if(state==="overdue")meta.appendChild(el("span","px-2 py-1 rounded-full bg-red-100 text-red-700 font-semibold","Terlambat"));
      else if(state==="today")meta.appendChild(el("span","px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold","Deadline hari ini"));
      card.appendChild(meta);
    });
  }
  function renderActionCenter(){
    const page=doc.getElementById("page-dashboard");if(!page)return;
    let panel=doc.getElementById("csk-crm-action-center");
    if(!panel){
      panel=el("section","bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3");panel.id="csk-crm-action-center";
      const leadList=doc.getElementById("dash-leads-list"),anchor=leadList&&leadList.closest(".bg-white");
      if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(panel,anchor);else page.insertBefore(panel,page.children[1]||null);
    }
    const data=appDB();if(!data)return;const summary=api.summarizeCRM(data.leads||[],data.projects||[]);panel.replaceChildren();
    panel.appendChild(el("h2","font-bold text-sm text-slate-900","Pusat Tindakan CRM"));
    const stats=el("div","grid grid-cols-2 sm:grid-cols-4 gap-2");
    [["Follow-up terlambat",summary.overdueLeads.length,"text-red-700"],["Follow-up hari ini",summary.dueTodayLeads.length,"text-amber-700"],["Belum dijadwalkan",summary.unscheduledLeads.length,"text-slate-700"],["Proyek terlambat",summary.overdueProjects.length,"text-red-700"]].forEach(item=>{
      const box=el("div","rounded-xl bg-slate-50 border border-slate-100 p-3");box.append(el("div","text-[10px] text-slate-500",item[0]),el("div","text-xl font-bold "+item[2],String(item[1])));stats.appendChild(box);
    });panel.appendChild(stats);
    const urgent=summary.overdueLeads.concat(summary.dueTodayLeads).slice(0,5),list=el("div","space-y-2");
    if(!urgent.length)list.appendChild(el("p","text-xs text-slate-500","Tidak ada follow-up yang jatuh tempo hari ini."));
    urgent.forEach(lead=>{
      const row=el("div","flex items-center justify-between gap-3 border-t border-slate-100 pt-2"),info=el("div","min-w-0");
      info.append(el("div","text-xs font-semibold text-slate-800 truncate",String(lead.name||"Lead tanpa nama")),el("div","text-[10px] text-slate-500","Jadwal: "+api.toISODate(lead.nextFollowUp)));row.appendChild(info);
      const button=el("button","shrink-0 px-3 py-2 rounded-lg bg-slate-900 text-white text-[10px] font-semibold","Buka Leads");button.type="button";button.addEventListener("click",()=>{if(typeof root.nav==="function")root.nav("leads");});row.appendChild(button);list.appendChild(row);
    });panel.appendChild(list);
    summary.overdueProjects.slice(0,3).forEach(project=>{
      const row=el("div","flex items-center justify-between gap-3 border-t border-slate-100 pt-2");row.appendChild(el("div","text-xs font-semibold text-red-700","Proyek terlambat: "+String(project.title||"Tanpa nama")));
      const button=el("button","shrink-0 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-semibold","Buka Proyek");button.type="button";button.addEventListener("click",()=>{if(typeof root.nav==="function")root.nav("projects");});row.appendChild(button);panel.appendChild(row);
    });
  }
  function wrapRenderer(name,handler){
    const original=root[name];if(typeof original!=="function"||original.__cskCRMUpgradeWrapped)return;
    const wrapped=function(){return handler.call(this,original,arguments);};wrapped.__cskCRMUpgradeWrapped=true;root[name]=wrapped;
  }
  function installRenderers(){
    wrapRenderer("renderLeads",function(original,args){
      const data=appDB();if(!data)return original.apply(this,args);
      const source=data.leads||[],query=doc.getElementById("csk-lead-search")?.value||"",follow=doc.getElementById("csk-lead-follow-filter")?.value||"all";
      data.leads=api.filterLeadRecords(source,{query:query,followUp:follow});
      try{original.apply(this,args);}finally{data.leads=source;}
      decorateLeadCards(api.filterLeadRecords(source,{query:query,status:activeLeadStatus(),followUp:follow}));
    });
    wrapRenderer("renderClients",function(original,args){
      const data=appDB();if(!data)return original.apply(this,args);
      const source=data.clients||[],filtered=api.filterClientRecords(source,{query:doc.getElementById("csk-client-search")?.value||""});
      data.clients=filtered;try{original.apply(this,args);}finally{data.clients=source;}decorateClientCards(filtered);
    });
    wrapRenderer("renderProjects",function(original,args){
      const data=appDB();if(!data)return original.apply(this,args);
      const source=data.projects||[],filtered=api.filterProjectRecords(source,{query:doc.getElementById("csk-project-search")?.value||"",status:doc.getElementById("csk-project-status-filter")?.value||"all",deadline:doc.getElementById("csk-project-deadline-filter")?.value||"all"});
      data.projects=filtered;try{original.apply(this,args);}finally{data.projects=source;}decorateProjectCards(filtered);
    });
    wrapRenderer("renderDashboard",function(original,args){const result=original.apply(this,args);renderActionCenter();return result;});
  }
  function install(){
    if(installed)return;installed=true;injectFormFields();injectControls();installRenderers();
    if(typeof root.renderAll==="function")root.renderAll();
    else{if(typeof root.renderLeads==="function")root.renderLeads();if(typeof root.renderClients==="function")root.renderClients();if(typeof root.renderProjects==="function")root.renderProjects();renderActionCenter();}
  }
  if(doc.readyState==="loading")doc.addEventListener("DOMContentLoaded",install,{once:true});else install();
})(typeof window!=="undefined"?window:null);
