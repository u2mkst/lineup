const players = [
  ['1','김민준','GK'],['21','양형모','GK'],['30','김준홍','GK'],['31','이경준','GK'],
  ['3','모경빈','DF'],['4','송주훈','DF'],['5','고종현','DF'],['11','이준재','DF'],['13','여민준','DF'],['15','정성민','DF'],['18','최지묵','DF'],['20','홍정호','DF'],['27','이건희','DF'],['28','윤근영','DF'],['32','정동윤','DF'],['33','박대원','DF'],['66','한현서','DF'],
  ['6','임지훈','MF'],['10','헤이스','MF'],['14','정호연','MF'],['16','박현빈','MF'],['17','강현묵','MF'],['19','김성주','MF'],['23','김민우','MF'],['24','고승범','MF'],['42','이준우','MF'],['80','김지성','MF'],
  ['7','페신','FW'],['8','르본','FW'],['22','강성진','FW'],['58','브루노 실바','FW'],['71','김지호','FW'],['77','김지현','FW'],['90','김결','FW'],['92','이상민','FW'],['98','두비츠카스','FW'],['99','김도연','FW']
].map(([number,name,pos])=>({number,name,pos,id:number}));

const formationGroups={
  back3:['3-5-2','3-4-3','3-4-1-2','3-4-2-1','3-2-4-1'],
  back4:['4-3-3','4-2-3-1','4-4-2','4-1-2-1-2','4-1-4-1','4-3-2-1','4-5-1'],
  back5:['5-3-2','5-4-1']
};

// Each formation lists field-player slots from the defensive line to the attack.
const formationSlots={
  '4-3-3':[['LB','LCB','RCB','RB'],['LCM','CM','RCM'],['LW','ST','RW']],
  '4-2-3-1':[['LB','LCB','RCB','RB'],['LCM','RCM'],['LW','AM','RW'],['ST']],
  '4-4-2':[['LB','LCB','RCB','RB'],['LM','LCM','RCM','RM'],['LST','RST']],
  '4-1-2-1-2':[['LB','LCB','RCB','RB'],['CDM'],['LCM','RCM'],['AM'],['LST','RST']],
  '4-1-4-1':[['LB','LCB','RCB','RB'],['CDM'],['LM','LCM','RCM','RM'],['ST']],
  '4-3-2-1':[['LB','LCB','RCB','RB'],['LCM','CM','RCM'],['LAM','RAM'],['ST']],
  '4-5-1':[['LB','LCB','RCB','RB'],['LM','LCM','CM','RCM','RM'],['ST']],
  '3-5-2':[['LCB','CB','RCB'],['LWB','LCM','CM','RCM','RWB'],['LST','RST']],
  '3-4-3':[['LCB','CB','RCB'],['LWB','LCM','RCM','RWB'],['LW','ST','RW']],
  '3-4-1-2':[['LCB','CB','RCB'],['LWB','LCM','RCM','RWB'],['AM'],['LST','RST']],
  '3-4-2-1':[['LCB','CB','RCB'],['LWB','LCM','RCM','RWB'],['LAM','RAM'],['ST']],
  '3-2-4-1':[['LCB','CB','RCB'],['LCM','RCM'],['LW','LAM','RAM','RW'],['ST']],
  '5-3-2':[['LWB','LCB','CB','RCB','RWB'],['LCM','CM','RCM'],['LST','RST']],
  '5-4-1':[['LWB','LCB','CB','RCB','RWB'],['LM','LCM','RCM','RM'],['ST']]
};

let state={mode:'starters',phase:'attack',filter:'전체',starters:[],subs:[],formation:{attack:'4-2-3-1',defense:'5-4-1'},formationFamily:{attack:'back4',defense:'back5'},lineups:{attack:{},defense:{}},activeSlot:{attack:null,defense:null}};
const $=selector=>document.querySelector(selector);
const roster=$('#roster'),pitchPlayers=$('#pitchPlayers');

function player(id){return players.find(p=>p.id===id)}
function showToast(message){const toast=$('#toast');toast.textContent=message;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),1800)}

function renderRoster(){
  const list=players.filter(p=>state.filter==='전체'||p.pos===state.filter);
  roster.innerHTML=list.map(p=>{
    const type=state.starters.includes(p.id)?'starter':state.subs.includes(p.id)?'sub':'';
    return `<button class="player-card ${type?'selected-'+type:''}" data-id="${p.id}" type="button"><span class="number">${p.number}</span><span class="name">${p.name}</span><span class="pos">${p.pos}</span>${type?`<span class="badge ${type==='sub'?'sub':''}">${type==='starter'?'선발':'교체'}</span>`:''}</button>`;
  }).join('');
}

function clearPlayerFromLineups(id){
  Object.values(state.lineups).forEach(lineup=>Object.keys(lineup).forEach(role=>{if(lineup[role]===id)lineup[role]=null}));
}

function nextAutomaticSlot(phase){
  const lineup=state.lineups[phase];
  const nextFieldSlot=formationSlots[state.formation[phase]].flat().find(slot=>!lineup[slot]);
  return nextFieldSlot||(!lineup.GK?'GK':null);
}

function autoAssignStarter(id){
  const phase=state.phase,lineup=state.lineups[phase],p=player(id),requestedSlot=state.activeSlot[phase];
  if(p.pos==='GK'){if(!lineup.GK)lineup.GK=id;return}
  if(requestedSlot){
    if(requestedSlot==='GK'&&p.pos!=='GK'){showToast('GK 슬롯에는 골키퍼만 배치할 수 있습니다');return}
    lineup[requestedSlot]=id;
    state.activeSlot[phase]=formationSlots[state.formation[phase]].flat().find(slot=>!lineup[slot])||(lineup.GK?null:'GK');
    return;
  }
  const assigned=new Set(Object.values(lineup).filter(Boolean));
  const unassigned=state.starters.filter(playerId=>player(playerId).pos!=='GK'&&!assigned.has(playerId));
  const openSlots=formationSlots[state.formation[phase]].flat().filter(slot=>!lineup[slot]);
  openSlots.forEach((slot,index)=>{if(unassigned[index])lineup[slot]=unassigned[index]});
}

function assignStarterToSlot(id){
  const phase=state.phase,role=state.activeSlot[phase],p=player(id);
  if(!role){showToast('피치에서 먼저 포지션을 선택하세요');return}
  if(role==='GK'&&p.pos!=='GK'){showToast('GK 슬롯에는 골키퍼만 배치할 수 있습니다');return}
  if(role!=='GK'&&p.pos==='GK'){showToast('골키퍼는 GK 슬롯에만 배치할 수 있습니다');return}
  const lineup=state.lineups[phase];
  Object.keys(lineup).forEach(slot=>{if(lineup[slot]===id)lineup[slot]=null});
  lineup[role]=id;
  state.activeSlot[phase]=formationSlots[state.formation[phase]].flat().find(slot=>!lineup[slot])||(lineup.GK?null:'GK');
}

function renderPitch(){
  const chosen=state.starters;
  const formation=state.formation[state.phase];
  const active=state.activeSlot[state.phase];
  const nextSlot=nextAutomaticSlot(state.phase);
  $('#formationNote').textContent=active?`${active} 슬롯 선택됨 · 선발 명단에서 배치할 선수를 선택하세요`:nextSlot?`${nextSlot} 슬롯에 배치할 선수를 선택하세요 · 포지션을 누르면 원하는 자리로 배치할 수 있습니다`:`${state.phase==='attack'?'공격':'수비'} 라인업 배치 완료 · 포지션을 눌러 선수를 자유롭게 변경하세요`;
  $('#pitchEmpty').style.display='none';
  const lineup=state.lineups[state.phase];
  const rows=formationSlots[formation].map(labels=>labels.map(role=>({role,id:lineup[role]||null}))).reverse();
  rows.push([{role:'GK',id:lineup.GK||null}]);
  const startY=74,endY=476,gap=rows.length>1?(endY-startY)/(rows.length-1):0;
  pitchPlayers.innerHTML=rows.flatMap((row,rowIndex)=>row.map((entry,index)=>{
    const p=player(entry.id);
    const left=(100/(row.length+1))*(index+1);
    return `<button class="field-player slot ${entry.role==='GK'?'gk':''} ${p?'':'empty-slot'} ${active===entry.role?'active-slot':''}" type="button" data-slot="${entry.role}" style="left:${left}%;top:${startY+(gap*rowIndex)}px"><div class="shirt">${p?p.number:'+'}</div><span>${p?`${entry.role} · ${p.name}`:entry.role}</span></button>`;
  })).join('');
}

function renderAssignment(){
  const phase=state.phase,active=state.activeSlot[phase],lineup=state.lineups[phase];
  const nextSlot=nextAutomaticSlot(phase);
  $('#assignmentTitle').textContent=`${phase==='attack'?'공격':'수비'} 라인업 배치`;
  $('#assignmentHint').textContent=active?`${active} 위치에 넣을 선발 선수를 선택하세요.`:nextSlot?`자동 배치 다음 순서: ${nextSlot}. 포지션을 직접 누르면 원하는 자리에 넣을 수 있습니다.`:'배치 완료. 피치의 포지션을 눌러 선수를 자유롭게 변경하세요.';
  const assigned=new Set(Object.values(lineup).filter(Boolean));
  $('#starterPicker').innerHTML=state.starters.length?state.starters.map(id=>{const p=player(id);return `<button class="starter-pick ${assigned.has(id)?'assigned':''}" type="button" data-assign="${id}">${p.number} ${p.name}</button>`}).join(''):'<span class="empty-selection">선발 선수를 먼저 선택하세요.</span>';
}

function renderSelections(){
  const all=[...state.starters,...state.subs];
  $('#selectionList').innerHTML=all.length?all.map(id=>{const p=player(id);return `<button class="chosen" type="button" data-remove="${id}"><b>${p.number}</b>${p.name}</button>`}).join(''):'<span class="empty-selection">아직 선택된 선수가 없습니다.</span>';
}

function renderBench(){
  $('#benchTitle').textContent=`교체 명단 ${state.subs.length}/9`;
  $('#benchSummary').textContent=state.subs.length?`교체: ${state.subs.map(id=>{const p=player(id);return `${p.number} ${p.name}`}).join(' · ')}`:'교체: 아직 선택된 선수가 없습니다.';
}

function renderHeader(){
  const starter=state.starters.length,sub=state.subs.length;
  $('#starterCount').textContent=starter;$('#subCount').textContent=sub;
  document.querySelectorAll('.status-item').forEach(b=>b.classList.toggle('active',b.dataset.mode===state.mode));
  $('#rosterTitle').textContent=state.mode==='starters'?'선발 선수 선택':'교체 명단 선택';
  $('#rosterHint').textContent=state.mode==='starters'?`최대 11명 · ${starter}/11`:`최대 9명 · ${sub}/9`;
  document.querySelectorAll('.phase').forEach(b=>b.classList.toggle('active',b.dataset.phase===state.phase));
  document.querySelectorAll('.family').forEach(b=>b.classList.toggle('active',b.dataset.family===state.formationFamily[state.phase]));
}

function renderFormation(){
  const select=$('#formation'),family=state.formationFamily[state.phase];
  select.innerHTML=formationGroups[family].map(f=>`<option ${f===state.formation[state.phase]?'selected':''}>${f}</option>`).join('');
}
function render(){renderHeader();renderFormation();renderRoster();renderAssignment();renderPitch();renderBench();renderSelections()}

roster.addEventListener('click',event=>{
  const card=event.target.closest('[data-id]');if(!card)return;
  const id=card.dataset.id;
  if(state.starters.includes(id)){state.starters=state.starters.filter(x=>x!==id);clearPlayerFromLineups(id);render();return}
  if(state.subs.includes(id)){state.subs=state.subs.filter(x=>x!==id);render();return}
  if(state.starters.length<11&&state.mode==='starters'){
    state.starters.push(id);autoAssignStarter(id);render();return;
  }
  if(state.subs.length>=9){showToast('교체 명단은 9명까지 선택할 수 있습니다');return}
  state.subs.push(id);
  if(state.starters.length>=11){state.mode='subs';showToast('교체 명단에 추가했습니다');}
  render();
});

document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{state.mode=b.dataset.mode;render()}));
document.querySelectorAll('[data-phase]').forEach(b=>b.addEventListener('click',()=>{state.phase=b.dataset.phase;render()}));
document.querySelectorAll('[data-family]').forEach(b=>b.addEventListener('click',()=>{const family=b.dataset.family;state.formationFamily[state.phase]=family;if(!formationGroups[family].includes(state.formation[state.phase]))state.formation[state.phase]=formationGroups[family][0];render()}));
$('#filters').addEventListener('click',event=>{const button=event.target.closest('[data-filter]');if(!button)return;state.filter=button.dataset.filter;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===button));renderRoster()});
$('#formation').addEventListener('change',event=>{state.formation[state.phase]=event.target.value;state.activeSlot[state.phase]=null;render()});
pitchPlayers.addEventListener('click',event=>{
  const slot=event.target.closest('[data-slot]');if(!slot)return;
  const role=slot.dataset.slot,lineup=state.lineups[state.phase];
  if(event.target.closest('.shirt')&&lineup[role]){
    const id=lineup[role];
    state.starters=state.starters.filter(playerId=>playerId!==id);
    clearPlayerFromLineups(id);
    state.activeSlot[state.phase]=role;render();return;
  }
  state.activeSlot[state.phase]=role;renderAssignment();renderPitch();
});
$('#starterPicker').addEventListener('click',event=>{const choice=event.target.closest('[data-assign]');if(!choice)return;assignStarterToSlot(choice.dataset.assign);render()});
$('#selectionList').addEventListener('click',event=>{const button=event.target.closest('[data-remove]');if(!button)return;const id=button.dataset.remove;state.starters=state.starters.filter(x=>x!==id);state.subs=state.subs.filter(x=>x!==id);clearPlayerFromLineups(id);render()});
$('#resetBtn').addEventListener('click',()=>{state.mode='starters';state.starters=[];state.subs=[];state.lineups={attack:{},defense:{}};state.activeSlot={attack:null,defense:null};render();showToast('선택을 초기화했습니다')});

render();
