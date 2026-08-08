import test from 'node:test';
import assert from 'node:assert/strict';
import { createOsbbElevatorController } from '../src/osbb-elevator-controller.js';
import { createOsbbRuntimeController } from '../src/osbb-runtime-controller.js';

test('elevator controller loads, adds and persists monthly entries', async () => {
  const values=new Map(); let saved; let published=[];
  const controller=createOsbbElevatorController({document:{getElementById:()=>({className:'',innerHTML:''})},storage:{},isPreview:false,
    getMonth:()=>({year:2026,month:7}),getAuthor:()=> 'Олена',readOffline:()=>[],writeOffline:(_s,k,v)=>values.set(k,v),
    fetchMonth:async()=>({data:{data:[]},error:null}),upsertMonth:async row=>{saved=row;return{error:null};},render(){},showToast(){},
    onEntriesChanged:value=>{published=value;}});
  await controller.init(); assert.equal(controller.add(8,'Перевірив двері'),true); await Promise.resolve();
  assert.equal(published[0].createdBy,'Олена'); assert.equal(saved.month_key,'2026-7'); assert.ok(values.has('elevator_2026_7'));
});

test('runtime controller gates tabs and runs the selected loader', async () => {
  const elements=new Map(); const element=()=>({classList:{toggle(){}},toggleAttribute(){},setAttribute(){},style:{}});
  const document={activeElement:null,getElementById:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
  let loaded=0,tab=''; const runtime=createOsbbRuntimeController({document,window:{addEventListener(){}},navigator:{onLine:true},isPreview:true,
    tabs:['dispatcher','tabel'],initialTab:'dispatcher',isTabAllowed:value=>value!=='tabel',isDispatcher:()=>true,requestShiftPin(){},
    getSelectedMonth:()=>({year:2026,month:7}),loadPhotos:async()=>{},updateToday(){},loadDashboard:async()=>{},
    loaders:{dispatcher:async()=>{loaded++;}},setSyncStatus(){},showToast(){},subscriptions:[],onTabChanged:value=>{tab=value;}});
  assert.equal(runtime.requestTab('tabel'),false); assert.equal(runtime.setTab('dispatcher'),true); await Promise.resolve();
  assert.equal(tab,'dispatcher'); assert.equal(loaded,1);
});

test('runtime calendar publishes a valid month before loading active data', async () => {
  const order=[]; const runtime=createOsbbRuntimeController({document:{getElementById:()=>null,activeElement:null},window:{addEventListener(){}},navigator:{onLine:true},
    isPreview:true,tabs:['dispatcher'],initialTab:'dispatcher',isTabAllowed:()=>true,isDispatcher:()=>true,requestShiftPin(){},
    getSelectedMonth:()=>({year:2026,month:7}),onMonthChanged:()=>order.push('month'),loadPhotos:async()=>order.push('photos'),
    updateToday:()=>order.push('today'),loadDashboard:async()=>order.push('dashboard'),loaders:{dispatcher:async()=>order.push('loader')},setSyncStatus(){},showToast(){},subscriptions:[]});
  await runtime.initCalendar(); assert.deepEqual(order,['month','photos','today','loader','dashboard']);
});
