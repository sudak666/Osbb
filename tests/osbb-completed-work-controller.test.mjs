import test from 'node:test';
import assert from 'node:assert/strict';
import { createOsbbCompletedWorkController } from '../src/osbb-completed-work-controller.js';

const id = '123e4567-e89b-12d3-a456-426614174000';
function fixture(overrides={}) {
  let pin='1234'; let payload=null; let rendered=[];
  const controller=createOsbbCompletedWorkController({ loadRows:async()=>({data:[],error:null}), saveRow:async value=>{payload=value;return id;}, deleteRow:async()=>true,
    getSession:()=>({id:'staff-1'}),getPin:()=>pin,clearPin:()=>{pin=null;},requestReauth:async()=>true,render:value=>{rendered=value;},setStatus(){},showToast(){},...overrides });
  return {controller,getPayload:()=>payload,getRendered:()=>rendered};
}

test('completed work controller saves through the guarded RPC contract', async()=>{
  const {controller,getPayload}=fixture();
  assert.equal(await controller.save({workDate:'2026-08-14',workerRole:'plumber',description:'Полагодив замок',note:''}),true);
  assert.deepEqual(getPayload(),{p_id:null,p_work_date:'2026-08-14',p_worker_role:'plumber',p_description:'Полагодив замок',p_note:'',p_staff_id:'staff-1',attempt:'1234'});
});

test('completed work controller rejects invalid drafts before RPC', async()=>{
  let saves=0; const {controller}=fixture({saveRow:async()=>{saves++;return id;}});
  assert.equal(await controller.save({workDate:'',workerRole:'plumber',description:'x'}),false);
  assert.equal(saves,0);
});
