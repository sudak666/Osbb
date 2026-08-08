import {
  calculateInventoryHeaderStats,
  filterInventoryByValue,
  filterSkladItems,
  normalizeSearchText,
  valuesMatchSearch,
} from './sklad-domain.js';
import { dateInputToTimestamp, dateToInputValue } from './sklad-dates.js';
import {
  formatMoney as money,
  isPurchasePriceSchemaError,
  itemPriceValue as priceValue,
  parseOptionalPrice as optionalPrice,
} from './sklad-pricing.js';
import { escapeHtml, safeExternalUrl } from './app-security.js';
import { isAuthSessionValid } from './auth-session.js';
import { numericIdFromInsertResponse } from './supabase-api.js';
import { adjustedStockAfterMovementEdit, buildIssueEditPatch, buildIssuePayload, buildReceiptEditPatch, buildReceiptPayload, filterInventoryLogs, filterInventoryReceipts } from './sklad-movements.js';
import { buildBalanceExportRows, buildInventoryExportRows, buildIssueExportRows, calculateInventoryValueSummary, sortLowStockItems, sortUnpricedItems, summarizeInventoryCategories } from './sklad-reporting.js';
import { createInventoryCollectionState, deleteInventoryResultFromRpcResponse, inventoryItemsFromResponse, inventoryLogsFromResponse, inventoryReceiptsFromResponse, inventoryUnitFromRpcResponse } from './sklad-state.js';
import { loadPurchasePriceRpcAvailable, markPurchasePriceRpcUnavailable, nextSkladTheme, saveSkladTheme } from './sklad-client-state.js';
import { createSkladDeletePinController } from './sklad-delete-pin-controller.js';
import { createSkladModalController } from './sklad-modal-controller.js';
import { createSkladDataController } from './sklad-data-controller.js';
import { createSkladAuditController } from './sklad-audit-controller.js';
import { createSkladSupplierController } from './sklad-supplier-controller.js';
import { createSkladItemMenuController } from './sklad-item-menu-controller.js';
import { createSkladPhotoController } from './sklad-photo-controller.js';
import { createSkladItemCrudController } from './sklad-item-crud-controller.js';
import { createSkladMovementsController } from './sklad-movements-controller.js';
let { allItems, allLogs, allReceipts } = createInventoryCollectionState();
let curCat='',logCat='',quickId=null,stockFilter='';
const catBadge={'Прибирання':'bc','Ремонт':'br','Електрика':'be','Сантехніка':'bp','Відеоспостереження':'bv','Інше':'bo'};
const catIcon={'Прибирання':'🧹','Ремонт':'🔧','Електрика':'⚡','Сантехніка':'🚿','Відеоспостереження':'📹','Інше':'📦'};
const catColor={'Прибирання':'#16a34a','Ремонт':'#ea580c','Електрика':'#ca8a04','Сантехніка':'#2563eb','Відеоспостереження':'#7c3aed','Інше':'#64748b'};
// HTML-рендер іконок Material Symbols. catIcon (emoji) лишається окремо для Chart.js,
// оскільки canvas-легенда графіка не вміє рендерити HTML-теги.
function msIcon(name,size){return '<span class="ms" aria-hidden="true" style="font-size:'+(size||'1em')+';vertical-align:-0.15em;">'+name+'</span>';}
const catIconName={'Прибирання':'cleaning_services','Ремонт':'build','Електрика':'bolt','Сантехніка':'plumbing','Відеоспостереження':'videocam','Інше':'inventory_2'};
const catIconHtml={};
Object.keys(catIconName).forEach(k=>catIconHtml[k]=msIcon(catIconName[k]));
const catIconHtmlDefault=msIcon(catIconName['Інше']);
const pageTitles={items:{icon:'inventory_2',label:'Майно та матеріали'},issue:{icon:'output',label:'Видача зі складу'},log:{icon:'receipt_long',label:'Журнал видач'},add:{icon:'add_circle',label:'Додати / Поповнити'},receipts:{icon:'move_to_inbox',label:'Надходження'},audit:{icon:'fact_check',label:'Інвентаризація'},stats:{icon:'bar_chart',label:'Статистика'}};
let purchasePriceRpcAvailable=loadPurchasePriceRpcAvailable(localStorage);
function disablePurchasePriceRpc(){
  purchasePriceRpcAvailable=false;
  markPurchasePriceRpcUnavailable(localStorage);
}
function showPurchasePriceMigrationNotice(){
  console.info('Історія закупівельних цін стане доступною після міграції 009.');
}
function priceBadge(item){
  const id=escapeHtml(String(item?.id||''));
  const price=priceValue(item);
  if(!price) return `<button type="button" class="btn btn-ghost btn-sm price-badge-btn" data-price-badge-action="manual-price" data-item-id="${id}"><span class="ms" aria-hidden="true">add</span> Ціна</button>`;
  const checked=item.price_checked_at?new Date(item.price_checked_at).toLocaleDateString('uk-UA'):'';
  const src=item.price_source?escapeHtml(item.price_source):'ціна';
  const title=[src,checked].filter(Boolean).join(' · ');
  return `<button type="button" class="btn btn-ghost btn-sm price-badge-btn has-price" data-price-badge-action="manual-price" data-item-id="${id}" data-tip="${escapeHtml(title)}">
    <span class="price-badge-value">${money(price)}</span>
    <span class="price-badge-source">${src}</span>
  </button>`;
}
const emptyStateIcons=new Set(['inbox','search_off','inventory_2','history']);
function emptyState(icon,title,supportingText=''){
  const safeIcon=emptyStateIcons.has(icon)?icon:'inbox';
  const supporting=supportingText
    ? `<div class="md-empty-state-supporting">${escapeHtml(supportingText)}</div>`
    : '';
  return `<div class="empty md-empty-state">
    <span class="ms md-empty-state-icon" aria-hidden="true">${safeIcon}</span>
    <div class="md-empty-state-title">${escapeHtml(title)}</div>
    ${supporting}
  </div>`;
}
function skeletonRows(columns=1,rows=3){
  const safeColumns=Math.min(8,Math.max(1,Math.trunc(columns)));
  const safeRows=Math.min(6,Math.max(1,Math.trunc(rows)));
  const cells=Array.from({length:safeColumns},(_,index)=>
    `<td><span class="skel ${index%3===0?'skel-fluid-xl':'skel-fluid-md'}"></span></td>`
  ).join('');
  return Array.from({length:safeRows},()=>`<tr aria-hidden="true">${cells}</tr>`).join('');
}
function skeletonStack(rows=3){
  const safeRows=Math.min(6,Math.max(1,Math.trunc(rows)));
  return `<div class="skeleton-stack" aria-hidden="true">${Array.from({length:safeRows},()=>`
    <div class="skeleton-card">
      <span class="skel skel-fluid-xl"></span>
      <span class="skel skel-fluid-md"></span>
    </div>`).join('')}</div>`;
}

const supplierController=createSkladSupplierController({db,document,window,storage:localStorage,toast,openModal,closeModal});
const setSupplierPreset=button=>supplierController.select(button);
const syncSupplierTags=(targetId,value)=>supplierController.sync(targetId,value);
const loadSupplierTagsCloud=()=>supplierController.loadCloud();
const renderCustomSupplierTags=()=>supplierController.render();
const addCustomSupplierTag=()=>supplierController.add();
const requestRemoveCustomSupplierTag=tag=>supplierController.requestRemove(tag);
const confirmRemoveCustomSupplierTag=()=>supplierController.confirmRemove();

const movementsController=createSkladMovementsController({db});
const runDeleteInventoryRpc=(name,args)=>movementsController.runDelete(name,args);

const photoController=createSkladPhotoController({db,document,window,getItem:findItemForAction,loadItems,openModal,closeModal,requestDeletePin:showDeletePinModal,toast});
const openPhotoModal=id=>photoController.open(id);
const uploadPhoto=()=>photoController.upload();
const deletePhoto=()=>photoController.remove();
const openLightbox=(url,itemId=null)=>photoController.openLightbox(url,itemId);
const closeLightbox=()=>photoController.closeLightbox();
const deleteLightboxPhoto=event=>photoController.removeFromLightbox(event);

const itemCrudController=createSkladItemCrudController({db,document,categories:catBadge,getItems:()=>allItems,findItem:findItemForAction,
  refreshSelect:refreshEnhancedSelect,openModal,closeModal,setButtonLoading:setActionButtonLoading,loadItems,populateSelects:populateSels,
  renderLowStock:renderAddLow,requestDeletePin:showDeletePinModal,runDeleteRpc:runDeleteInventoryRpc,toast});
const openEditItem=id=>itemCrudController.openEdit(id);
const confirmEditItem=button=>itemCrudController.saveEdit(button);
const openDelete=id=>itemCrudController.openDelete(id);
const confirmDelete=()=>itemCrudController.confirmDelete();

const itemMenuController=createSkladItemMenuController({document,window,actions:{
  quick:id=>openQuick(id),history:id=>openHistory(id),edit:id=>openEditItem(id),photo:id=>openPhotoModal(id),
  internal:(id,trigger)=>toggleInternal(id,trigger.dataset.internalNext==='true'),
  'manual-price':id=>openManualPriceModal(id),delete:id=>openDelete(id),
  lightbox:(id,trigger)=>openLightbox(trigger.dataset.photoUrl||'',id),
}});
const closeOpenItemMenus=except=>itemMenuController.closeAll(except);
const repositionOpenItemMenus=()=>itemMenuController.reposition();
const bindItemActionDelegation=()=>itemMenuController.bind();

const {
  initPullToRefresh,
  initRealtime,
  loadItems,
  loadLogs,
  loadReceipts,
  markDataUpdated,
  refreshAll,
  setRefreshStatus,
}=createSkladDataController({
  db,
  document,
  window,
  toast,
  iconHtml:msIcon,
  skeletonRows,
  skeletonStack,
  loadSupplierTags:loadSupplierTagsCloud,
  onItems(items){ allItems=items; renderItems(); updateStats(); },
  onLogs(logs){ allLogs=logs; renderLog(); },
  onReceipts(receipts){ allReceipts=receipts; renderReceipts(); },
});

const auditController=createSkladAuditController({
  db,document,
  getItems:()=>allItems,
  itemMatchesSearch,
  updateResultSummary,
  categoryBadges:catBadge,
  categoryIcons:catIconHtml,
  defaultCategoryIcon:catIconHtmlDefault,
  toast,openModal,closeModal,loadItems,
});
const initAudit=()=>auditController.init();
const renderAuditList=()=>auditController.render();
const onAuditInput=(itemId,value)=>auditController.input(itemId,value);
const clearAuditItem=itemId=>auditController.clear(itemId);
const auditFillCurrent=()=>auditController.fillCurrent();
const auditFillZeros=()=>auditController.fillZeros();
const openAuditConfirm=()=>auditController.openConfirm();
const confirmAudit=()=>auditController.confirm();

// ===== PIN AUTH (визначено вище перед HTML) =====
if(EMBEDDED_SHELL_AUTH || isAuthSessionValid()) document.getElementById('authScreen').style.display='none';

// ===== NAV =====
function setPageTitle(page){
  const target=document.getElementById('pageTitle');
  if(!target) return;
  const title=pageTitles[page];
  target.textContent='';
  if(!title) return;
  const icon=document.createElement('span');
  icon.className='ms topbar-title-icon';
  icon.setAttribute('aria-hidden','true');
  setIcon(icon,title.icon);
  target.append(icon,document.createTextNode(title.label));
}
function nav(page,el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.ni,.bn-item').forEach(n=>{n.classList.remove('active');n.removeAttribute('aria-current');});
  document.getElementById('page-'+page).classList.add('active');
  document.querySelectorAll('.ni[data-page='+page+'],.bn-item[data-page='+page+']').forEach(n=>{n.classList.add('active');n.setAttribute('aria-current','page');});
  setPageTitle(page);
  if(page==='issue'){populateSels();loadRecentIssues();}
  if(page==='log'){loadLogs();}
  if(page==='add'){populateSels();renderAddLow();}
  if(page==='receipts'){loadReceipts();}
  if(page==='audit'){initAudit();}
  if(page==='stats'){renderStats();}
}
function goReceipts(){nav('receipts',null);}

// ===== STAT CARD FILTER =====
function filterByStock(mode,card){
  stockFilter=(stockFilter===mode)?'':mode;
  document.querySelectorAll('.stat-card').forEach(c=>{
    const active=Boolean(stockFilter)&&c===card;
    c.classList.toggle('sc-active',active);
    c.setAttribute('aria-pressed',String(active));
  });
  renderItems();
  document.querySelector('.desktop-table,.mobile-cards')?.scrollIntoView({behavior:'smooth',block:'start'});
}

// ===== FILTER CAT =====
function filterCat(btn,cat){
  document.querySelectorAll('#catPills .pill').forEach(b=>{
    const active=b===btn;
    b.classList.toggle('active',active);
    b.setAttribute('aria-pressed',String(active));
  });
  curCat=cat;renderItems();
}

// ===== IN STOCK ONLY TOGGLE =====
let inStockOnly=false;
function setFilterPillState(button,active){
  if(!button) return;
  button.classList.toggle('active',active);
  button.setAttribute('aria-pressed',String(active));
}
function toggleInStock(btn){
  inStockOnly=!inStockOnly;
  setFilterPillState(btn,inStockOnly);
  renderItems();
}

// ===== Фільтри внутрішнього використання (хознужди) =====
// Два режими: приховати внутрішні товари (hideInternal) або показати лише
// внутрішні (onlyInternal). Режими взаємовиключні — увімкнення одного
// автоматично вимикає інший (див. toggleHideInternal/toggleOnlyInternal).
let hideInternal=false;
let onlyInternal=false;
function resetInternalPill(id){
  const btn=document.getElementById(id);
  setFilterPillState(btn,false);
}
function toggleHideInternal(btn){
  hideInternal=!hideInternal;
  if(hideInternal){
    onlyInternal=false;
    resetInternalPill('onlyInternalPill');
    setFilterPillState(btn,true);
  } else {
    setFilterPillState(btn,false);
  }
  renderItems();
}
function toggleOnlyInternal(btn){
  onlyInternal=!onlyInternal;
  if(onlyInternal){
    hideInternal=false;
    resetInternalPill('hideInternalPill');
    setFilterPillState(btn,true);
  } else {
    setFilterPillState(btn,false);
  }
  renderItems();
}
function resetItemFilters(){
  curCat='';
  stockFilter='';
  inStockOnly=false;
  hideInternal=false;
  onlyInternal=false;
  const search=document.getElementById('searchInp');
  if(search) search.value='';
  document.querySelectorAll('.stat-card').forEach(c=>{
    c.classList.remove('sc-active');
    c.setAttribute('aria-pressed','false');
  });
  document.querySelectorAll('#catPills .pill').forEach((b,idx)=>{
    const active=idx===0;
    b.classList.toggle('active',active);
    b.setAttribute('aria-pressed',String(active));
  });
  const inStock=document.getElementById('inStockPill');
  setFilterPillState(inStock,false);
  resetInternalPill('hideInternalPill');
  resetInternalPill('onlyInternalPill');
  renderItems();
  toast('Фільтри скинуто','info');
}

// Позначає/знімає позначку "внутрішнє використання" (хознужди) для товару.
// Такі товари лишаються на складі, але виключаються з балансу видаткових товарів.
function toggleInternal(id,val){
  db.from('inventory_items').update({is_internal:val}).eq('id',id).then(({error})=>{
    if(error) return toast('Помилка: '+error.message,'error');
    const item=allItems.find(i=>i.id===id);
    if(item) item.is_internal=val;
    renderItems();
    if(document.getElementById('page-stats').classList.contains('active')) renderStats();
    toast(val?'Позначено як внутрішнє використання (хознужди)':'Знято позначку "внутрішнє використання"','success');
  });
}

// ===== RENDER ITEMS =====


function activateSkladPageTrigger(trigger){
  const page=trigger.dataset.skladPage||trigger.dataset.page;
  if(page) nav(page,trigger);
}
function handleSkladStaticKeydown(event){
  if(event.key!=='Enter'&&event.key!==' ') return;
  const trigger=event.target.closest('[data-sklad-page],[data-page],[data-stock-filter]');
  if(!trigger) return;
  event.preventDefault();
  trigger.click();
}
function debounce(fn,wait){
  let timer=null;
  return (...args)=>{
    clearTimeout(timer);
    timer=setTimeout(()=>fn(...args),wait);
  };
}
const prefersReducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// Плавно "перемотує" число від поточного значення до нового замість миттєвої
// заміни тексту — і на першому завантаженні, і на маленьких дельтах після
// одиничної дії, однаково коротка (380мс) відчутна анімація.
function animateNumber(el,target,{prefix='',suffix=''}={}){
  if(!el) return;
  const targetNum=Number(target)||0;
  const startNum=Number(el.dataset.animRaw??String(el.textContent||'').replace(/[^\d.-]/g,''))||0;
  if(prefersReducedMotion()||startNum===targetNum){
    el.textContent=prefix+targetNum+suffix;
    el.dataset.animRaw=String(targetNum);
    return;
  }
  const t0=performance.now();
  const dur=380;
  function step(now){
    const p=Math.min(1,(now-t0)/dur);
    const eased=1-Math.pow(1-p,3);
    const val=Math.round(startNum+(targetNum-startNum)*eased);
    el.textContent=prefix+val+suffix;
    if(p<1) requestAnimationFrame(step);
    else el.dataset.animRaw=String(targetNum);
  }
  requestAnimationFrame(step);
}
function bindSkladStaticControls(){
  document.querySelectorAll('[data-sklad-page], .ni[data-page], .bn-item[data-page]').forEach(trigger=>{
    trigger.addEventListener('click',()=>activateSkladPageTrigger(trigger));
    trigger.addEventListener('keydown',handleSkladStaticKeydown);
  });
  document.querySelectorAll('[data-stock-filter]').forEach(card=>{
    card.addEventListener('click',()=>filterByStock(card.dataset.stockFilter,card));
    card.addEventListener('keydown',handleSkladStaticKeydown);
  });
  const actionHandlers={
    'chart':openChartModal,
    'manual-price':()=>openManualPriceModal(),
    'qr':openQR,
    'receipts':goReceipts,
    'export-excel':exportExcel,
    'refresh':refreshAll,
    'theme':toggleTheme,
    'reset-item-filters':resetItemFilters,
    'refill-submit':(button)=>doRefill(button),
    'add-new-submit':(button)=>doAddNew(button),
    'barcode-add-open':openBarcodeAddScanner,
    'audit-fill-zeros':auditFillZeros,
    'audit-fill-current':auditFillCurrent,
    'audit-confirm-open':openAuditConfirm,
    'quick-issue-submit':(button)=>doQuickIssue(button),
    'photo-file-select':()=>document.getElementById('photoFileI').click(),
    'photo-delete':deletePhoto,
    'edit-item-confirm':(button)=>confirmEditItem(button),
    'delete-confirm':confirmDelete,
    'audit-confirm-save':confirmAudit,
    'delete-log-confirm':confirmDeleteLog,
    'edit-log-confirm':confirmEditLog,
    'delete-receipt-confirm':confirmDeleteReceipt,
    'edit-receipt-confirm':confirmEditReceipt,
    'barcode-google':searchInGoogle,
    'barcode-reset':resetBarcodeScanner,
    'barcode-manual-search':searchManualBarcode,
    'barcode-add-close':()=>{stopBarcodeAdd();closeModal('barcodeAddModal');},
    'qr-close':()=>{stopQR();closeModal('qrModal');},
    'manual-price-save':saveManualPrice,
    'supplier-tag-add':addCustomSupplierTag,
    'supplier-tag-delete-confirm':confirmRemoveCustomSupplierTag,
    'lightbox-delete-photo':(button,event)=>deleteLightboxPhoto(event),
  };
  document.querySelectorAll('[data-sklad-action]').forEach(button=>{
    const handler=actionHandlers[button.dataset.skladAction];
    if(handler) button.addEventListener('click',(event)=>handler(button,event));
  });
  const filterHandlers={
    'in-stock':toggleInStock,
    'hide-internal':toggleHideInternal,
    'only-internal':toggleOnlyInternal,
  };
  document.querySelectorAll('[data-filter-toggle]').forEach(button=>{
    const handler=filterHandlers[button.dataset.filterToggle];
    if(handler) button.addEventListener('click',(event)=>handler(button,event));
  });
  document.querySelectorAll('[data-category-filter]').forEach(button=>{
    button.addEventListener('click',()=>filterCat(button,button.dataset.categoryFilter));
  });
  document.querySelectorAll('[data-person-preset]').forEach(button=>{
    button.addEventListener('click',()=>setPerson(button.dataset.personPreset,button));
  });
  document.querySelectorAll('[data-supplier-preset]').forEach(button=>{
    button.addEventListener('click',()=>setSupplierPreset(button));
  });
  ['refillSupplierI','editReceiptSupplier','newItemSupplier'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input',(event)=>syncSupplierTags(id,event.target.value));
  });
  document.getElementById('newSupplierTag')?.addEventListener('keydown',(event)=>{
    if(event.key==='Enter'){event.preventDefault();addCustomSupplierTag();}
  });
  renderCustomSupplierTags();
  document.querySelectorAll('[data-log-category-filter]').forEach(button=>{
    button.addEventListener('click',()=>filterLogCat(button,button.dataset.logCategoryFilter));
  });
  document.querySelector('[data-render-items-input]')?.addEventListener('input',debounce(renderItems,200));
  document.querySelector('[data-render-log-input]')?.addEventListener('input',debounce(renderLog,200));
  document.querySelector('[data-render-audit-input]')?.addEventListener('input',debounce(renderAuditList,200));
  document.querySelector('[data-render-receipts-input]')?.addEventListener('input',debounce(renderReceipts,200));
  document.querySelector('[data-new-product-input]')?.addEventListener('input',debounce(renderNewProductMatches,200));
  document.querySelector('[data-unit-word-input]')?.addEventListener('blur',(event)=>validateUnitWordInput(event.target));
  document.querySelector('[data-issue-select]')?.addEventListener('change',onIssueSel);
  document.getElementById('issueForm')?.addEventListener('submit',(event)=>{
    event.preventDefault();
    void doIssue(event.submitter);
  });
  document.querySelector('[data-refill-select]')?.addEventListener('change',onRefillSel);
  document.querySelectorAll('[data-stats-filter]').forEach(select=>select.addEventListener('change',renderStats));
  document.querySelector('[data-photo-file]')?.addEventListener('change',uploadPhoto);
  document.querySelectorAll('[data-modal-backdrop]').forEach(backdrop=>{
    backdrop.addEventListener('click',(event)=>closeModal(backdrop.dataset.modalBackdrop,event));
  });
  document.querySelectorAll('[data-modal-close]').forEach(button=>{
    button.addEventListener('click',()=>closeModal(button.dataset.modalClose));
  });
  document.querySelector('[data-delete-pin-cancel]')?.addEventListener('click',delPinModalCancel);
  document.querySelectorAll('[data-delete-pin-key]').forEach(button=>{
    button.addEventListener('click',()=>deletePinPress(button.dataset.deletePinKey));
  });
  document.querySelector('[data-lightbox-close]')?.addEventListener('click',closeLightbox);
  document.querySelector('[data-lightbox-stop]')?.addEventListener('click',(event)=>event.stopPropagation());
}

function validateUnitWordInput(input){
  if(/^\d+([.,]\d+)?$/.test(input.value.trim())) toast('Одиниця має бути словом, не числом!','error');
}
function bindPriceBadgeActions(){
  document.addEventListener('click',(event)=>{
    const button=event.target.closest('[data-price-badge-action="manual-price"]');
    if(!button) return;
    event.preventDefault();
    openManualPriceModal(button.dataset.itemId||'');
  });
}

function bindAuditListDelegation(){
  const list=document.getElementById('auditList');
  if(!list) return;
  list.addEventListener('input',(event)=>{
    const input=event.target.closest('[data-audit-input]');
    if(!input) return;
    onAuditInput(Number(input.dataset.itemId),input.value);
  });
  list.addEventListener('focusin',(event)=>{
    const input=event.target.closest('[data-audit-input]');
    if(input) input.select();
  });
  list.addEventListener('click',(event)=>{
    const button=event.target.closest('[data-audit-clear]');
    if(!button) return;
    event.preventDefault();
    clearAuditItem(Number(button.dataset.itemId));
  });
}

function bindLogActionDelegation(){
  ['logTable','logMobileList'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.addEventListener('click',(event)=>{
      const button=event.target.closest('[data-log-action]');
      if(!button) return;
      event.preventDefault();
      const logId=Number(button.dataset.logId);
      if(!logId) return;
      if(button.dataset.logAction==='edit') openEditLog(logId);
      if(button.dataset.logAction==='delete') openDeleteLog(logId);
    });
  });
}

function bindReceiptActionDelegation(){
  ['recTable','recMobileList'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.addEventListener('click',(event)=>{
      const button=event.target.closest('[data-receipt-action]');
      if(!button) return;
      event.preventDefault();
      const receiptId=Number(button.dataset.receiptId);
      if(!receiptId) return;
      if(button.dataset.receiptAction==='edit') openEditReceipt(receiptId);
      if(button.dataset.receiptAction==='delete') openDeleteReceipt(receiptId);
    });
  });
}

function bindNewProductMatchActions(){
  const box=document.getElementById('newNameMatches');
  if(!box) return;
  box.addEventListener('click',(event)=>{
    const button=event.target.closest('[data-new-match-action]');
    if(!button) return;
    event.preventDefault();
    const itemId=button.dataset.itemId||'';
    if(button.dataset.newMatchAction==='refill') useExistingItemForRefill(itemId);
  });
}

function bindPhotoCurrentActions(){
  const box=document.getElementById('photoCurrent');
  if(!box) return;
  box.addEventListener('click',(event)=>{
    const image=event.target.closest('[data-photo-current-lightbox]');
    if(!image) return;
    event.preventDefault();
    openLightbox(image.dataset.photoUrl||'',Number(image.dataset.itemId)||null);
  });
}

function updateItemsResultSummary(count,total,query){
  const el=document.getElementById('itemsResultSummary');
  if(!el) return;
  const activeFilters=[
    curCat,
    stockFilter&&stockFilter!=='all'?'залишок':'',
    inStockOnly?'в наявності':'',
    hideInternal?'без внутрішніх':'',
    onlyInternal?'тільки внутрішні':'',
    query?'пошук':''
  ].filter(Boolean);
  const filtersText=activeFilters.length?' · фільтри: '+activeFilters.join(', '):'';
  el.textContent=`Показано ${count} із ${total}${filtersText}`;
  const resetBtn=document.getElementById('resetItemFiltersBtn');
  if(resetBtn) resetBtn.style.display=activeFilters.length?'inline-flex':'none';
}
function renderItems(){
  const s=document.getElementById('searchInp').value;
  const items=filterSkladItems(allItems,{
    query:s,
    category:curCat,
    stock:stockFilter,
    inStockOnly,
    hideInternal,
    onlyInternal
  });
  updateItemsResultSummary(items.length,allItems.length,s);

  // Desktop table
  const tb=document.getElementById('itemsTable');
  if(!items.length){
    const isFiltered=Boolean(s||curCat||stockFilter!=='all'||inStockOnly||hideInternal||onlyInternal);
    const state=emptyState(
      isFiltered?'search_off':'inventory_2',
      isFiltered?'Товарів не знайдено':'Склад поки порожній',
      isFiltered?'Змініть пошук або скиньте активні фільтри.':'Додайте перший товар, щоб почати облік залишків.'
    );
    tb.innerHTML=`<tr><td colspan="8">${state}</td></tr>`;
    const mc=document.getElementById('mobileCards');
    if(mc) mc.innerHTML=state;
    return;
  }
  tb.innerHTML=items.map((item,idx)=>{
    const qc=item.quantity==0?'qty-zero':item.quantity<=3?'qty-low':'qty-ok';
    const id=Number(item.id);
    const name=escapeHtml(item.name||'');
    const category=escapeHtml(item.category||'—');
    const unit=escapeHtml(item.unit||'');
    const safePhoto=item.photo_url?safeExternalUrl(item.photo_url):'';
    const photoCell=safePhoto
      ? `<img src="${safePhoto}" loading="lazy" class="photo-thumb tip-up" data-item-action="lightbox" data-item-id="${id}" data-photo-url="${safePhoto}" data-tip="Переглянути" alt="Фото товару ${name}">`
      : `<div class="photo-ph tip-up" data-item-action="photo" data-item-id="${id}" data-tip="Додати фото" role="button" tabindex="0" aria-label="Додати фото"><span class="ms ic-18">photo_camera</span></div>`;
    return `<tr>
      <td class="table-idx-cell">${idx+1}</td>
      <td class="table-name-cell">${name}${item.is_internal?' <span class="badge badge-internal">внутрішнє</span>':''}</td>
      <td><span class="badge ${catBadge[item.category]||'bo'}">${catIconHtml[item.category]||catIconHtmlDefault} ${category}</span></td>
      <td class="table-unit-cell">${unit}</td>
      <td>${photoCell}</td>
      <td><span class="${qc}">${escapeHtml(String(item.quantity??0))}</span> <span class="table-qty-unit">${unit}</span></td>
      <td>${priceBadge(item)}</td>
      <td><div class="table-row-actions">
        <button type="button" class="btn btn-primary btn-sm" data-item-action="quick" data-item-id="${id}"><span class="ms ic-15-3">output</span> Видати</button>
        <button type="button" class="btn btn-ghost btn-sm" data-item-action="history" data-item-id="${id}"><span class="ms ic-15-3">history</span> Історія</button>
        <details class="item-more"><summary aria-label="Додаткові дії" aria-haspopup="menu" aria-expanded="false"><span class="ms" aria-hidden="true">more_horiz</span></summary>
          <div class="item-more-menu" role="menu">
            <button type="button" role="menuitem" data-item-action="edit" data-item-id="${id}"><span class="ms">edit</span> Редагувати</button>
            <button type="button" role="menuitem" data-item-action="photo" data-item-id="${id}"><span class="ms">photo_camera</span> Фото</button>
            <button type="button" role="menuitem" data-item-action="internal" data-item-id="${id}" data-internal-next="${!item.is_internal}"><span class="ms">swap_horizontal_circle</span> ${item.is_internal?'Повернути в баланс':'Внутрішнє'}</button>
            <button type="button" role="menuitem" data-item-action="manual-price" data-item-id="${id}"><span class="ms">sell</span> Ручна ціна</button>
            <button type="button" role="menuitem" class="danger" data-item-action="delete" data-item-id="${id}"><span class="ms">delete</span> Видалити</button>
          </div>
        </details>
      </div></td>
    </tr>`;
  }).join('');

  // Mobile cards
  const mc=document.getElementById('mobileCards');
  if(mc) mc.innerHTML=items.map(item=>{
    const qc=item.quantity==0?'qty-zero':item.quantity<=3?'qty-low':'qty-ok';
    const id=Number(item.id);
    const name=escapeHtml(item.name||'');
    const category=escapeHtml(item.category||'—');
    const unit=escapeHtml(item.unit||'');
    const safePhoto=item.photo_url?safeExternalUrl(item.photo_url):'';
    const photo=safePhoto
      ? `<img src="${safePhoto}" loading="lazy" alt="Фото товару ${name}" class="m-card-photo" data-item-action="lightbox" data-item-id="${id}" data-photo-url="${safePhoto}">`
      : '';
    return `<div class="m-card">
      <div class="m-card-head">
        <div class="m-card-main">
          <div class="m-card-title">${name}</div>
          <div class="m-card-meta"><span class="badge ${catBadge[item.category]||'bo'}">${catIconHtml[item.category]||catIconHtmlDefault} ${category}</span>${item.is_internal?' <span class="badge badge-internal">внутрішнє</span>':''}</div>
          <div class="m-card-price">${priceBadge(item)}</div>
        </div>
        <div class="m-card-side">
          ${photo}
          <div class="m-card-qty">
            <span class="${qc} m-card-qty-value">${escapeHtml(String(item.quantity??0))}</span>
            <div class="m-card-unit">${unit}</div>
          </div>
        </div>
      </div>
      <div class="m-card-actions">
        <button type="button" class="btn btn-primary" data-item-action="quick" data-item-id="${id}"><span class="ms ic-15-3">output</span> Видати</button>
        <button type="button" class="btn btn-ghost" data-item-action="history" data-item-id="${id}"><span class="ms ic-15-3">history</span> Деталі</button>
        <details class="item-more"><summary aria-label="Додаткові дії" aria-haspopup="menu" aria-expanded="false"><span class="ms" aria-hidden="true">more_horiz</span></summary>
          <div class="item-more-menu" role="menu">
            <button type="button" role="menuitem" data-item-action="edit" data-item-id="${id}"><span class="ms">edit</span> Редагувати</button>
            <button type="button" role="menuitem" data-item-action="photo" data-item-id="${id}"><span class="ms">photo_camera</span> Фото</button>
            <button type="button" role="menuitem" data-item-action="internal" data-item-id="${id}" data-internal-next="${!item.is_internal}"><span class="ms">swap_horizontal_circle</span> ${item.is_internal?'Повернути в баланс':'Внутрішнє'}</button>
            <button type="button" role="menuitem" data-item-action="manual-price" data-item-id="${id}"><span class="ms">sell</span> Ручна ціна</button>
            <button type="button" role="menuitem" class="danger" data-item-action="delete" data-item-id="${id}"><span class="ms">delete</span> Видалити</button>
          </div>
        </details>
      </div>
    </div>`;
  }).join('');
}

function updateStats(){
  const stats=calculateInventoryHeaderStats(allItems);
  animateNumber(document.getElementById('st-available'),stats.availableItems);
  animateNumber(document.getElementById('st-units'),stats.totalUnits);
  const valueElement=document.getElementById('st-value');
  if(valueElement) valueElement.textContent=stats.estimatedValue>0?money(stats.estimatedValue):'0 грн';
}

// ===== QUICK MODAL =====
function findItemForAction(id, actionLabel){
  const item=allItems.find(i=>i.id===id);
  if(item) return item;
  toast(`Товар не знайдено для дії «${actionLabel}». Оновіть список і спробуйте ще раз.`,'error');
  refreshAll().catch(e=>console.warn('refresh after missing item failed:',e));
  return null;
}
function setActionButtonLoading(btn,label){
  if(!btn) return ()=>{};
  if(btn.dataset.busy==='1') return null;
  const previousHtml=btn.innerHTML;
  btn.dataset.busy='1';
  btn.disabled=true;
  btn.setAttribute('aria-busy','true');
  btn.innerHTML=msIcon('sync','16px')+' '+escapeHtml(label);
  return ()=>{
    btn.innerHTML=previousHtml;
    btn.disabled=false;
    btn.setAttribute('aria-busy','false');
    delete btn.dataset.busy;
  };
}
function openQuick(id){
  const item=findItemForAction(id,'видача');
  if(!item) return;
  quickId=id;
  document.getElementById('qmName').textContent=item.name;
  document.getElementById('qmQtyShow').textContent=item.quantity+' '+item.unit;
  document.getElementById('qmQtyI').value='';
  document.getElementById('qmPersonI').value='';
  openModal('qModal');
  setTimeout(()=>document.getElementById('qmQtyI').focus(),100);
}
async function doQuickIssue(btn){
  const payload=buildIssuePayload({
    itemId:quickId,
    quantity:document.getElementById('qmQtyI').value,
    person:document.getElementById('qmPersonI').value
  });
  if(!payload.ok) return toast(payload.error==='person'?'Вкажіть кому!':'Вкажіть кількість!','error');
  const done=setActionButtonLoading(btn,'Видаю...');
  if(!done) return;
  try{
    const {itemId,quantity,person}=payload.value;
    const ok=await issueItem(itemId,quantity,person,'');
    if(ok) closeModal('qModal');
  }finally{
    done();
  }
}

// ===== ISSUE PAGE =====
function onIssueSel(){
  const id=parseInt(document.getElementById('issueItemSel').value);
  const item=allItems.find(i=>i.id===id);
  const box=document.getElementById('issueInfo');
  if(!item){box.style.display='none';return;}
  box.style.display='block';
  document.getElementById('issueInfoQty').textContent=item.quantity+' '+item.unit;
}
async function doIssue(btn){
  const payload=buildIssuePayload({
    itemId:document.getElementById('issueItemSel').value,
    quantity:document.getElementById('issueQtyI').value,
    person:document.getElementById('issuePersonI').value,
    note:document.getElementById('issueNoteI').value,
    occurredAt:dateInputToTimestamp(document.getElementById('issueDateI').value)
  });
  if(!payload.ok){
    const messages={item:'Оберіть товар!',quantity:'Вкажіть кількість!',person:'Вкажіть кому!'};
    return toast(messages[payload.error]||'Перевірте дані видачі','error');
  }
  const done=setActionButtonLoading(btn,'Видаю...');
  if(!done) return;
  try{
    const {itemId,quantity,person,note,occurredAt}=payload.value;
    const ok=await issueItem(itemId,quantity,person,note,occurredAt);
    if(!ok) return;
    ['issueItemSel','issueQtyI','issuePersonI','issueNoteI'].forEach(k=>document.getElementById(k).value='');
    document.getElementById('issueDateI').value=new Date().toISOString().slice(0,10);
    refreshEnhancedSelect(document.getElementById('issueItemSel'));
    document.getElementById('issueInfo').style.display='none';
    loadRecentIssues();
  }catch(error){
    console.error('issue submit failed:',error);
    toast('Не вдалося виконати видачу. Спробуйте ще раз.','error');
  }finally{
    done();
  }
}
async function issueItem(itemId,qty,person,note,issueDate){
  const item=allItems.find(i=>i.id===itemId);
  if(!item){toast('Товар не знайдено!','error');return false;}
  const issuedAt=issueDate?.includes('T')?issueDate:dateInputToTimestamp(issueDate);
  // Атомарний RPC замість read-check-write з клієнта: перевірка залишку і
  // списання відбуваються однією транзакцією на сервері (issue_item),
  // тому паралельна видача того самого товару не може дати від'ємний залишок.
  const {data,error}=await db.rpc('issue_item',{
    p_item_id:itemId, p_qty:qty, p_person:person, p_note:note||null, p_issued_at:issuedAt||null
  });
  if(error){
    if((error.message||'').includes('insufficient_stock')){
      toast('Недостатньо! Залишок: '+item.quantity+' '+item.unit,'error');
    }else{
      toast('Помилка: '+error.message,'error');
    }
    return false;
  }
  const unit=inventoryUnitFromRpcResponse(data,item.unit);
  toast('Видано: '+qty+' '+unit+' → '+person,'success');
  notifyTelegram('📤 Видача: '+item.name+' −'+qty+' '+unit+' → '+person+(note?' ('+note+')':''));
  await loadItems();
  return true;
}
async function loadRecentIssues(){
  const el=document.getElementById('recentIssues');
  const {data,error}=await db.from('inventory_logs').select('*').order('issued_at',{ascending:false}).limit(7);
  if(error){
    console.warn('recent issues load failed',error);
    el.innerHTML='<div class="empty" style="padding:24px;font-size:13px;"><span class="ms ic-16-3">cloud_off</span> Не вдалося завантажити останні видачі</div>';
    return;
  }
  const rows=inventoryLogsFromResponse(data);
  if(!rows.length){el.innerHTML='<div class="empty" style="padding:24px;font-size:13px;"><span class="ms ic-16-3">inbox</span> Видач ще не було</div>';return;}
  el.innerHTML=rows.map(l=>{
    const d=new Date(l.issued_at);
    const dt=d.toLocaleDateString('uk-UA',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});
    const safeName=escapeHtml(l.item_name||'—');
    const safeIssuedTo=escapeHtml(l.issued_to||'—');
    return `<div class="log-row"><div class="log-icon"><span class="ms ic-18">output</span></div>
      <div class="log-row-main">
        <div class="log-row-title">${safeName}</div>
        <div class="log-row-meta">${safeIssuedTo} · ${dt}</div>
      </div>
      <div class="log-row-qty log-qty-out">−${escapeHtml(String(l.quantity??0))}</div>
    </div>`;
  }).join('');
}

// ===== LOG PAGE =====
function filterLogCat(btn,cat){
  document.querySelectorAll('#page-log .pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');logCat=cat;renderLog();
}
function updateResultSummary(id,count,total,query,extraFilter=''){
  const el=document.getElementById(id);
  if(!el) return;
  const filters=[extraFilter,query?'пошук':''].filter(Boolean);
  el.textContent=`Показано ${count} із ${total}${filters.length?' · фільтри: '+filters.join(', '):''}`;
}
function renderLog(){
  const s=document.getElementById('logSearch').value;
  const logs=filterInventoryLogs(allLogs,allItems,s,logCat);
  updateResultSummary('logResultSummary',logs.length,allLogs.length,s,logCat);
  const tb=document.getElementById('logTable');
  const mb=document.getElementById('logMobileList');
  if(!logs.length){
    const state=s
      ? emptyState('search_off','Записів не знайдено','Спробуйте змінити пошуковий запит.')
      : emptyState('history','Видач ще не було','Нові операції видачі з’являться тут автоматично.');
    tb.innerHTML=`<tr><td colspan="6">${state}</td></tr>`;
    mb.innerHTML=state;
    return;
  }
  tb.innerHTML=logs.map(l=>{
    const d=new Date(l.issued_at);
    const dt=d.toLocaleDateString('uk-UA',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+d.toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});
    const item=allItems.find(i=>i.id===l.item_id);
    const cat=item?item.category:'';
    const safeCat=escapeHtml(cat||'');
    const safeName=escapeHtml(l.item_name||'—');
    const safeUnit=escapeHtml(item?.unit||'');
    const safeIssuedTo=escapeHtml(l.issued_to||'—');
    const safeNote=escapeHtml(l.note||'—');
    return `<tr>
      <td class="log-date-cell">${dt}</td>
      <td class="log-name-cell">${safeName}${cat?` <span class="badge ${catBadge[cat]||'bo'} log-cat-badge">${safeCat}</span>`:''}</td>
      <td class="log-qty-out">${escapeHtml(String(l.quantity??0))} <span class="log-unit-suffix">${safeUnit}</span></td>
      <td class="log-person-cell">${safeIssuedTo}</td>
      <td class="log-note-cell">${safeNote}</td>
      <td><div class="table-row-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-log-action="edit" data-log-id="${l.id}" aria-label="Редагувати запис видачі"><span class="ms ic-16">edit</span></button>
        <button type="button" class="btn btn-danger btn-sm" data-log-action="delete" data-log-id="${l.id}" aria-label="Видалити запис видачі"><span class="ms ic-16">delete</span></button>
      </div></td>
    </tr>`;
  }).join('');
  // mobile cards
  mb.innerHTML=logs.map(l=>{
    const d=new Date(l.issued_at);
    const dt=d.toLocaleDateString('uk-UA',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});
    const item=allItems.find(i=>i.id===l.item_id);
    const cat=item?item.category:'';
    const safeName=escapeHtml(l.item_name||'—');
    const safeUnit=escapeHtml(item?.unit||'');
    const safeIssuedTo=escapeHtml(l.issued_to||'—');
    const safeNote=l.note?' · '+escapeHtml(l.note):'';
    const icon=catIconHtml[cat]||catIconHtmlDefault;
    return `<div class="log-mobile-item">
      <div class="log-mobile-icon">${icon}</div>
      <div class="log-mobile-main">
        <div class="log-mobile-title">${safeName}</div>
        <div class="log-mobile-meta">${safeIssuedTo} · ${dt}${safeNote}</div>
      </div>
      <div class="log-mobile-side">
        −${escapeHtml(String(l.quantity??0))}<span class="log-mobile-unit"> ${safeUnit}</span>
        <div class="log-mobile-actions">
          <button type="button" class="icon-action" data-log-action="edit" data-log-id="${l.id}" aria-label="Редагувати запис видачі"><span class="ms ic-16">edit</span></button>
          <button type="button" class="icon-action danger" data-log-action="delete" data-log-id="${l.id}" aria-label="Видалити запис видачі"><span class="ms ic-16">delete</span></button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ===== EDIT / DELETE LOG =====
let deleteLogId=null,editLogId=null;
function openDeleteLog(id){
  const l=allLogs.find(x=>x.id===id);
  if(!l) return;
  deleteLogId=id;
  document.getElementById('delLogItemName').textContent=`${l.item_name} · ${l.quantity} ${(allItems.find(i=>i.id===l.item_id)||{}).unit||''} · ${l.issued_to||'—'}`;
  openModal('delLogModal');
}
async function confirmDeleteLog(){
  if(!deleteLogId) return;
  const id=deleteLogId;
  closeModal('delLogModal');
  showDeletePinModal('PIN для видалення запису', async (pin)=>{
    const result=await runDeleteInventoryRpc('delete_inventory_log',{p_log_id:id,attempt:pin});
    if(result.ok){
      toast('Запис видалено, товар повернуто на склад','success');
      deleteLogId=null;
      await loadItems();await loadLogs();
    }
    return result;
  });
}
function openEditLog(id){
  const l=allLogs.find(x=>x.id===id);
  if(!l) return;
  editLogId=id;
  const item=allItems.find(i=>i.id===l.item_id);
  document.getElementById('editLogItemName').textContent=`${l.item_name}${item?' · поточний залишок: '+item.quantity+' '+item.unit:''}`;
  document.getElementById('editLogQty').value=l.quantity;
  document.getElementById('editLogDate').value=dateToInputValue(l.issued_at);
  document.getElementById('editLogPerson').value=l.issued_to||'';
  document.getElementById('editLogNote').value=l.note||'';
  openModal('editLogModal');
}
async function confirmEditLog(){
  if(!editLogId) return;
  const l=allLogs.find(x=>x.id===editLogId);
  if(!l) return closeModal('editLogModal');
  const patchResult=buildIssueEditPatch({
    quantity:document.getElementById('editLogQty').value,
    person:document.getElementById('editLogPerson').value,
    note:document.getElementById('editLogNote').value,
    occurredAt:dateInputToTimestamp(document.getElementById('editLogDate').value)
  });
  if(!patchResult.ok) return toast('Введіть коректну кількість','error');
  const logPatch=patchResult.value;
  const newQty=logPatch.quantity;
  const item=allItems.find(i=>i.id===l.item_id);
  if(item){
    const adjustedStock=adjustedStockAfterMovementEdit(item.quantity,l.quantity,newQty,'issue');
    if(adjustedStock===null) return toast('Недостатньо товару на складі для такої кількості','error');
    await db.from('inventory_items').update({quantity:adjustedStock}).eq('id',item.id);
  }
  const {error}=await db.from('inventory_logs').update(logPatch).eq('id',editLogId);
  if(error) return toast('Помилка: '+error.message,'error');
  toast('Запис оновлено','success');
  closeModal('editLogModal');
  editLogId=null;
  await loadItems();await loadLogs();
}

// ===== RECEIPTS (ПРИХІД) =====
function renderReceipts(){
  const s=document.getElementById('recSearch').value;
  const recs=filterInventoryReceipts(allReceipts,s);
  updateResultSummary('recResultSummary',recs.length,allReceipts.length,s);
  const tb=document.getElementById('recTable');
  const mb=document.getElementById('recMobileList');
  if(!recs.length){
    const state=s
      ? emptyState('search_off','Приходів не знайдено','Спробуйте змінити пошуковий запит.')
      : emptyState('inbox','Приходів ще не було','Після поповнення складу операції з’являться тут.');
    tb.innerHTML=`<tr><td colspan="7">${state}</td></tr>`;
    mb.innerHTML=state;
    return;
  }
  tb.innerHTML=recs.map(r=>{
    const d=new Date(r.received_at);
    const dt=d.toLocaleDateString('uk-UA',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+d.toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});
    const item=allItems.find(i=>i.id===r.item_id);
    const safeName=escapeHtml(r.item_name||'—');
    const safeUnit=escapeHtml(item?.unit||'');
    const safeSupplier=escapeHtml(r.supplier||'—');
    const safeNote=escapeHtml(r.note||'—');
    const hasReceiptPrice=Number(r.purchase_price_unit)>0;
    const purchasePrice=money(hasReceiptPrice?r.purchase_price_unit:item?.price_unit);
    const purchasePriceHtml=purchasePrice==='—'?'—':`${purchasePrice}${hasReceiptPrice?'':' <span class="price-origin-note">поточна</span>'}`;
    return `<tr>
      <td class="log-date-cell">${dt}</td>
      <td class="log-name-cell">${safeName}</td>
      <td class="log-qty-in">+${escapeHtml(String(r.quantity??0))} <span class="log-unit-suffix">${safeUnit}</span></td>
      <td class="log-price-cell">${purchasePriceHtml}</td>
      <td class="log-person-cell">${safeSupplier}</td>
      <td class="log-note-cell">${safeNote}</td>
      <td><div class="table-row-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-receipt-action="edit" data-receipt-id="${r.id}" aria-label="Редагувати прихід"><span class="ms ic-16">edit</span></button>
        <button type="button" class="btn btn-danger btn-sm" data-receipt-action="delete" data-receipt-id="${r.id}" aria-label="Видалити прихід"><span class="ms ic-16">delete</span></button>
      </div></td>
    </tr>`;
  }).join('');
  mb.innerHTML=recs.map(r=>{
    const d=new Date(r.received_at);
    const dt=d.toLocaleDateString('uk-UA',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});
    const item=allItems.find(i=>i.id===r.item_id);
    const safeName=escapeHtml(r.item_name||'—');
    const safeUnit=escapeHtml(item?.unit||'');
    const safeSupplier=escapeHtml(r.supplier||'—');
    const safeNote=r.note?' · '+escapeHtml(r.note):'';
    const hasReceiptPrice=Number(r.purchase_price_unit)>0;
    const purchasePrice=money(hasReceiptPrice?r.purchase_price_unit:item?.price_unit);
    return `<div class="receipt-mobile-item">
      <div class="receipt-mobile-icon"><span class="ms ic-20">move_to_inbox</span></div>
      <div class="receipt-mobile-main">
        <div class="receipt-mobile-title">${safeName}</div>
        <div class="receipt-mobile-meta">${safeSupplier} · ${dt}${safeNote}${purchasePrice!=='—'?' · '+purchasePrice+'/од.'+(hasReceiptPrice?'':' (поточна)'):''}</div>
      </div>
      <div class="receipt-mobile-side">
        +${escapeHtml(String(r.quantity??0))}<span class="receipt-mobile-unit"> ${safeUnit}</span>
        <div class="receipt-mobile-actions">
          <button type="button" class="icon-action" data-receipt-action="edit" data-receipt-id="${r.id}" aria-label="Редагувати прихід"><span class="ms ic-16">edit</span></button>
          <button type="button" class="icon-action danger" data-receipt-action="delete" data-receipt-id="${r.id}" aria-label="Видалити прихід"><span class="ms ic-16">delete</span></button>
        </div>
      </div>
    </div>`;
  }).join('');
}
let deleteReceiptId=null,editReceiptId=null;
function openDeleteReceipt(id){
  const r=allReceipts.find(x=>x.id===id);
  if(!r) return;
  deleteReceiptId=id;
  document.getElementById('delReceiptItemName').textContent=`${r.item_name} · +${r.quantity} ${(allItems.find(i=>i.id===r.item_id)||{}).unit||''} · ${r.supplier||'—'}`;
  openModal('delReceiptModal');
}
async function confirmDeleteReceipt(){
  if(!deleteReceiptId) return;
  const id=deleteReceiptId;
  closeModal('delReceiptModal');
  showDeletePinModal('PIN для видалення приходу', async (pin)=>{
    const result=await runDeleteInventoryRpc('delete_inventory_receipt',{p_receipt_id:id,attempt:pin});
    if(result.ok){
      toast('Прихід видалено, залишок скориговано','success');
      deleteReceiptId=null;
      await loadItems();await loadReceipts();
    }
    return result;
  });
}
function openEditReceipt(id){
  const r=allReceipts.find(x=>x.id===id);
  if(!r) return;
  editReceiptId=id;
  const item=allItems.find(i=>i.id===r.item_id);
  document.getElementById('editReceiptItemName').textContent=`${r.item_name}${item?' · поточний залишок: '+item.quantity+' '+item.unit:''}`;
  document.getElementById('editReceiptQty').value=r.quantity;
  document.getElementById('editReceiptDate').value=dateToInputValue(r.received_at);
  document.getElementById('editReceiptPrice').value=r.purchase_price_unit||item?.price_unit||'';
  document.getElementById('editReceiptSupplier').value=r.supplier||'';
  syncSupplierTags('editReceiptSupplier',r.supplier||'');
  document.getElementById('editReceiptNote').value=r.note||'';
  openModal('editReceiptModal');
}
async function confirmEditReceipt(){
  if(!editReceiptId) return;
  const r=allReceipts.find(x=>x.id===editReceiptId);
  if(!r) return closeModal('editReceiptModal');
  const patchResult=buildReceiptEditPatch({
    quantity:document.getElementById('editReceiptQty').value,
    purchasePrice:optionalPrice(document.getElementById('editReceiptPrice').value),
    supplier:document.getElementById('editReceiptSupplier').value,
    note:document.getElementById('editReceiptNote').value,
    occurredAt:dateInputToTimestamp(document.getElementById('editReceiptDate').value)
  });
  if(!patchResult.ok){
    return toast(patchResult.error==='price'?'Введіть коректну ціну закупівлі':'Введіть коректну кількість','error');
  }
  const receiptPatch=patchResult.value;
  const newQty=receiptPatch.quantity;
  const purchasePrice=receiptPatch.purchase_price_unit;
  const item=allItems.find(i=>i.id===r.item_id);
  if(item){
    const adjustedStock=adjustedStockAfterMovementEdit(item.quantity,r.quantity,newQty,'receipt');
    if(adjustedStock===null) return toast('Це призведе до від\'ємного залишку','error');
    const itemPatch={quantity:adjustedStock};
    if(purchasePrice!==null) Object.assign(itemPatch,{price_unit:purchasePrice,price_source:'Закупівля',price_confidence:'manual',price_checked_at:new Date().toISOString()});
    const {error:itemError}=await db.from('inventory_items').update(itemPatch).eq('id',item.id);
    if(itemError) return toast('Не вдалося оновити товар: '+itemError.message,'error');
  }
  let {error}=await db.from('inventory_receipts').update(receiptPatch).eq('id',editReceiptId);
  let priceHistorySaved=true;
  if(error&&isPurchasePriceSchemaError(error)){
    priceHistorySaved=false;
    const legacyPatch={...receiptPatch};
    delete legacyPatch.purchase_price_unit;
    ({error}=await db.from('inventory_receipts').update(legacyPatch).eq('id',editReceiptId));
  }
  if(error) return toast('Помилка: '+error.message,'error');
  toast('Прихід оновлено','success');
  closeModal('editReceiptModal');
  editReceiptId=null;
  await loadItems();await loadReceipts();
  if(!priceHistorySaved) showPurchasePriceMigrationNotice();
}

// ===== ADD PAGE =====
function onRefillSel(){
  const id=parseInt(document.getElementById('refillSel').value);
  const item=allItems.find(i=>i.id===id);
  const box=document.getElementById('refillInfo');
  if(!item){box.style.display='none';return;}
  box.style.display='block';
  document.getElementById('refillCur').textContent=item.quantity+' '+item.unit;
}
async function doRefill(btn){
  const payload=buildReceiptPayload({
    itemId:document.getElementById('refillSel').value,
    quantity:document.getElementById('refillQtyI').value,
    purchasePrice:optionalPrice(document.getElementById('refillPriceI').value),
    supplier:document.getElementById('refillSupplierI').value,
    note:document.getElementById('refillNoteI').value,
    occurredAt:dateInputToTimestamp(document.getElementById('refillDateI').value)
  });
  if(!payload.ok){
    const messages={item:'Оберіть товар!',quantity:'Вкажіть кількість!',price:'Вкажіть коректну ціну закупівлі'};
    return toast(messages[payload.error]||'Перевірте дані приходу','error');
  }
  const {itemId:id,quantity:qty,purchasePrice,supplier,note,occurredAt:receivedAt}=payload.value;
  const item=findItemForAction(id,'прихід');
  if(!item) return;
  const done=setActionButtonLoading(btn,'Поповнюю...');
  if(!done) return;
  try{
  // Атомарний RPC (receive_item): оновлення залишку і запис приходу в
  // одній транзакції на сервері, замість двох окремих незалежних запитів.
  let data=null;
  let error=null;
  if(purchasePrice!==null&&purchasePriceRpcAvailable){
    ({data,error}=await db.rpc('receive_item',{
      p_item_id:id, p_qty:qty, p_supplier:supplier||null, p_note:note||null, p_received_at:receivedAt||null, p_price_unit:purchasePrice
    }));
  }else{
    ({data,error}=await db.rpc('receive_item',{
      p_item_id:id,p_qty:qty,p_supplier:supplier||null,p_note:note||null,p_received_at:receivedAt||null
    }));
  }
  let priceHistorySaved=true;
  if(error&&purchasePrice!==null&&isPurchasePriceSchemaError(error)){
    priceHistorySaved=false;
    disablePurchasePriceRpc();
    ({data,error}=await db.rpc('receive_item',{
      p_item_id:id,p_qty:qty,p_supplier:supplier||null,p_note:note||null,p_received_at:receivedAt||null
    }));
    if(!error){
      const {error:priceError}=await db.from('inventory_items').update({
        price_unit:purchasePrice,price_source:'Закупівля',price_confidence:'manual',price_checked_at:new Date().toISOString()
      }).eq('id',id);
      if(priceError) return toast('Прихід збережено, але ціну не оновлено: '+priceError.message,'error');
    }
  }
  if(error) return toast('Помилка: '+error.message,'error');
  const unit=inventoryUnitFromRpcResponse(data,item.unit);
  toast('Поповнено +'+qty+' '+unit,'success');
  notifyTelegram('📦 Прихід: '+item.name+' +'+qty+' '+item.unit+(supplier?' від '+supplier:'')+(note?' ('+note+')':''));
  document.getElementById('refillQtyI').value='';
  document.getElementById('refillPriceI').value='';
  document.getElementById('refillSupplierI').value='';
  syncSupplierTags('refillSupplierI','');
  document.getElementById('refillNoteI').value='';
  document.getElementById('refillDateI').value=new Date().toISOString().slice(0,10);
  document.getElementById('refillInfo').style.display='none';
  document.getElementById('refillSel').value='';
  await loadItems();populateSels();renderAddLow();
  if(!priceHistorySaved) showPurchasePriceMigrationNotice();
  }finally{
    done();
  }
}
function itemMatchesSearch(item, query){
  return valuesMatchSearch([item.name,item.category,item.unit,item.price_source],query);
}
function renderNewProductMatches(){
  const box=document.getElementById('newNameMatches');
  const input=document.getElementById('newName');
  if(!box||!input) return;
  const q=input.value.trim();
  if(q.length<2){box.style.display='none';box.innerHTML='';return;}
  const matches=allItems.filter(i=>itemMatchesSearch(i,q)).slice(0,5);
  if(!matches.length){
    box.style.display='block';
    box.innerHTML='<div class="match-empty">Схожих товарів не знайдено — можна додавати новий.</div>';
    return;
  }
  box.style.display='block';
  box.innerHTML='<div class="match-heading">Схожі товари на складі</div>'+matches.map(i=>`<div class="match-row">
    <div class="match-row-main">
      <div class="match-row-title">${escapeHtml(i.name)}</div>
      <div class="match-row-meta">${escapeHtml(i.category||'—')} · ${escapeHtml(String(i.quantity??0))} ${escapeHtml(i.unit||'')} · ${priceValue(i)?money(priceValue(i)):'без ціни'}</div>
    </div>
    <div class="match-row-actions">
      <button type="button" class="btn btn-ghost btn-sm match-row-btn" data-new-match-action="refill" data-item-id="${escapeHtml(String(i.id))}">Поповнити</button>
      <button type="button" class="btn btn-ghost btn-sm match-row-btn" data-price-badge-action="manual-price" data-item-id="${escapeHtml(String(i.id))}">Ціна</button>
    </div>
  </div>`).join('');
}
function useExistingItemForRefill(id){
  const sel=document.getElementById('refillSel');
  if(!sel) return;
  sel.value=String(id);
  sel.dispatchEvent(new Event('change'));
  refreshEnhancedSelect(sel);
  document.getElementById('refillQtyI')?.focus();
  const box=document.getElementById('newNameMatches');
  if(box){box.style.display='none';box.innerHTML='';}
  toast('Товар знайдено — введіть кількість для поповнення','info');
}

async function doAddNew(btn){
  const name=document.getElementById('newName').value.trim();
  const category=document.getElementById('newCat').value;
  const unit=document.getElementById('newUnit').value.trim()||'шт';
  const quantity=parseFloat(document.getElementById('newQty').value)||0;
  const purchasePrice=optionalPrice(document.getElementById('newPrice').value);
  const supplier=document.getElementById('newItemSupplier').value.trim();
  const is_internal=document.getElementById('newInternal').checked;
  if(!name) return toast('Введіть назву товару!','error');
  if(Number.isNaN(purchasePrice)) return toast('Вкажіть коректну ціну закупівлі','error');
  if(/^\d+([.,]\d+)?$/.test(unit)) return toast('"Одиниця" має бути словом (напр. "шт", "уп."), а не числом!','error');
  const done=setActionButtonLoading(btn,'Додаю...');
  if(!done) return;
  try{
  const priceFields=purchasePrice===null?{}:{price_unit:purchasePrice,price_source:'Закупівля',price_confidence:'manual',price_checked_at:new Date().toISOString()};
  const {data:newItemResponse,error}=await db.from('inventory_items').insert([{name,category,unit,quantity,is_internal,...priceFields}]).select().single();
  if(error) return toast('Помилка: '+error.message,'error');
  const newItemId=numericIdFromInsertResponse(newItemResponse);
  let initialReceiptSaved=quantity<=0;
  let purchasePriceSchemaUnavailable=false;
  // записуємо початковий прихід якщо кількість > 0
  if(quantity>0 && newItemId!==null){
    try{
      const receiptRow={
        item_id:newItemId,
        item_name:name,
        quantity,
        purchase_price_unit:purchasePrice,
        supplier:supplier||null,
        note:'Початковий залишок при додаванні товару'
      };
      let {error:receiptError}=await db.from('inventory_receipts').insert([receiptRow]);
      if(receiptError&&isPurchasePriceSchemaError(receiptError)){
        purchasePriceSchemaUnavailable=true;
        delete receiptRow.purchase_price_unit;
        ({error:receiptError}=await db.from('inventory_receipts').insert([receiptRow]));
      }
      if(receiptError) console.warn('receipt insert failed',receiptError);
      else initialReceiptSaved=true;
    }catch(e){console.warn('receipt insert failed',e);}
  }
  if(quantity>0 && newItemId===null){
    console.warn('receipt insert skipped: inventory item insert response has no valid id');
  }
  if(!initialReceiptSaved) toast('"'+name+'" додано, але початкове надходження не записано','info');
  else toast('"'+name+'" додано!','success');
  if(purchasePriceSchemaUnavailable) showPurchasePriceMigrationNotice();
  notifyTelegram('🆕 Новий товар: '+name+' — '+quantity+' '+unit+(is_internal?' (внутрішнє використання)':''));
  ['newName','newUnit','newQty','newPrice','newItemSupplier'].forEach(k=>document.getElementById(k).value='');
  syncSupplierTags('newItemSupplier','');
  const matchesBox=document.getElementById('newNameMatches');
  if(matchesBox){matchesBox.style.display='none';matchesBox.innerHTML='';}
  document.getElementById('newInternal').checked=false;
  await loadItems();populateSels();renderAddLow();
  }finally{
    done();
  }
}
function renderAddLow(){
  const low=allItems.filter(i=>i.quantity<=3).sort((a,b)=>a.quantity-b.quantity).slice(0,10);
  const el=document.getElementById('addLowList');
  if(!low.length){el.innerHTML='<div class="add-low-empty"><span class="ms ic-15-3">check_circle</span> Все в нормі!</div>';return;}
  el.innerHTML=low.map(i=>`<div class="add-low-row">
    <span class="add-low-name">${escapeHtml(i.name||'—')}</span>
    <span class="${i.quantity==0?'qty-zero':'qty-low'}">${escapeHtml(String(i.quantity??0))}</span>
  </div>`).join('');
}

// ===== STATS =====
function syncValueFilterOptions(){
  const sel=document.getElementById('valueCatFilter');
  if(!sel) return;
  const current=sel.value;
  const cats=[...new Set(allItems.map(i=>i.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'uk'));
  sel.innerHTML='<option value="">Усі категорії</option>'+cats.map(cat=>`<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
  if(cats.includes(current)) sel.value=current;
  refreshEnhancedSelect(sel);
}
function getValueFilteredItems(){
  const cat=document.getElementById('valueCatFilter')?.value||'';
  const stock=document.getElementById('valueStockFilter')?.value||'all';
  const internal=document.getElementById('valueInternalFilter')?.value||'balance';
  const price=document.getElementById('valuePriceFilter')?.value||'all';
  return filterInventoryByValue(allItems,{category:cat,stock,internal,price});
}
function renderStats(){
  syncValueFilterOptions();
  const filteredItems=getValueFilteredItems();
  const stats=calculateInventoryValueSummary(allItems,filteredItems);
  document.getElementById('bal-total').textContent=stats.balanceItems;
  document.getElementById('bal-internal').textContent=stats.internalItems;
  document.getElementById('bal-value').textContent=stats.balanceValue?money(stats.balanceValue):'—';
  document.getElementById('bal-priced').textContent=stats.pricedItems;
  const filteredValueEl=document.getElementById('bal-filtered-value');
  if(filteredValueEl) filteredValueEl.textContent=stats.filteredValue?money(stats.filteredValue):'—';
  const filteredCountEl=document.getElementById('bal-filtered-count');
  if(filteredCountEl) filteredCountEl.innerHTML=`<span class="ms ic-13-2">filter_alt</span> ${stats.filteredItems} поз. · ${stats.filteredInStock} в наявності · ${stats.filteredInternal} внутр.`;
  const summary=document.getElementById('valueFilterSummary');
  if(summary){
    const missing=stats.filteredItems-stats.filteredPriced;
    summary.textContent=`У фільтрі: ${stats.filteredItems} позицій, в наявності ${stats.filteredInStock}, внутрішніх ${stats.filteredInternal}, оцінено ${stats.filteredPriced}, без ціни ${missing}. Сума рахується як залишок × ціна за одиницю.`;
  }
  document.getElementById('statCats').innerHTML=summarizeInventoryCategories(allItems).map(({category:cat,count,percentage:pct})=>{
    const c=catColor[cat]||'#64748b';
    const safeCat=escapeHtml(cat||'—');
    return `<div>
      <div class="stat-cat-row-head">
        <span class="stat-cat-name">${catIconHtml[cat]||catIconHtmlDefault} ${safeCat}</span>
        <span class="stat-cat-count">${count} поз.</span>
      </div>
      <div class="pbar"><div class="pfill" style="width:${pct}%;background:${c};"></div></div>
    </div>`;
  }).join('');
  const low=sortLowStockItems(allItems);
  document.getElementById('statLow').innerHTML=low.length
    ? low.map(i=>`<div class="stat-low-row">
        <span class="stat-low-name">${escapeHtml(i.name||'—')}</span>
        <span class="${i.quantity==0?'qty-zero':'qty-low'} stat-low-qty">${escapeHtml(String(i.quantity??0))} ${escapeHtml(i.unit||'')}</span>
      </div>`).join('')
    : '<div class="stat-low-empty"><span class="ms ic-15-3">check_circle</span> Всі товари в нормі!</div>';
  const unpriced=sortUnpricedItems(allItems);
  const unpricedBox=document.getElementById('statUnpriced');
  if(unpricedBox) unpricedBox.innerHTML=unpriced.length
    ? unpriced.slice(0,12).map(i=>`<div class="stat-unpriced-row">
        <div class="stat-unpriced-main">
          <div class="stat-unpriced-title">${escapeHtml(i.name)}</div>
          <div class="stat-unpriced-meta">${escapeHtml(i.category||'—')} · ${escapeHtml(String(i.quantity??0))} ${escapeHtml(i.unit||'')}</div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm stat-unpriced-btn" data-price-badge-action="manual-price" data-item-id="${escapeHtml(String(i.id))}">Ціна</button>
      </div>`).join('')+(unpriced.length>12?`<div class="stat-unpriced-more">Ще ${unpriced.length-12} товарів без ціни — увімкніть фільтр “Без ціни”.</div>`:'')
    : '<div class="stat-low-empty"><span class="ms ic-15-3">check_circle</span> Усі товари мають ціну!</div>';
  document.getElementById('statLog').innerHTML=allLogs.slice(0,10).map(l=>{
    const d=new Date(l.issued_at).toLocaleDateString('uk-UA',{day:'2-digit',month:'2-digit',year:'numeric'});
    const safeName=escapeHtml(l.item_name||'—');
    const safeIssuedTo=escapeHtml(l.issued_to||'—');
    return `<div class="stat-log-row">
      <span class="stat-log-name">${safeName}</span>
      <span class="stat-log-person">${safeIssuedTo}</span>
      <span class="stat-log-date">${d}</span>
    </div>`;
  }).join('')||'<div class="empty" style="padding:16px;">Журнал порожній</div>';
}
// ===== EXCEL =====
function exportExcel(){
  if(!allItems.length) return toast('Немає даних!','error');
  const ws=XLSX.utils.json_to_sheet(buildInventoryExportRows(allItems));
  ws['!cols']=[{wch:4},{wch:60},{wch:14},{wch:10},{wch:12},{wch:14},{wch:18},{wch:28},{wch:18},{wch:20}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Товари');
  const wsBalance=XLSX.utils.json_to_sheet(buildBalanceExportRows(allItems));
  wsBalance['!cols']=[{wch:50},{wch:12}];
  XLSX.utils.book_append_sheet(wb,wsBalance,'Баланс');
  if(allLogs.length){
    const ws2=XLSX.utils.json_to_sheet(buildIssueExportRows(allLogs));
    ws2['!cols']=[{wch:18},{wch:50},{wch:8},{wch:25},{wch:30}];
    XLSX.utils.book_append_sheet(wb,ws2,'Журнал видач');
  }
  const date=new Date().toLocaleDateString('uk-UA',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\./g,'-');
  XLSX.writeFile(wb,'Склад_ОСББ_'+date+'.xlsx');
  toast('Excel завантажено!','success');
}


// ===== РУЧНА ЦІНА / БАЛАНС =====
function fillPriceSelect(selectedId='') {
  const options=allItems.map(item=>`<option value="${Number(item.id)}">${escapeHtml(item.name)} (${escapeHtml(String(item.quantity??0))} ${escapeHtml(item.unit||'')})</option>`).join('');
  const select=document.getElementById('manualPriceItemSel');
  select.innerHTML='<option value="">— Оберіть товар —</option>'+options;
  if(selectedId) select.value=String(selectedId);
  refreshEnhancedSelect(select);
}
function openManualPriceModal(id='') {
  fillPriceSelect(id);
  const item=allItems.find(i=>String(i.id)===String(id));
  document.getElementById('manualPriceValue').value=item&&priceValue(item)?priceValue(item):'';
  document.getElementById('manualPriceSource').value=item?.price_source||'';
  clearTextSelection();
  openModal('manualPriceModal');
  requestAnimationFrame(clearTextSelection);
}
async function saveItemPrice(itemId, price, source='') {
  const payload={
    price_unit:Number(price),
    price_source:source||'Ручна ціна',
    price_url:null,
    price_checked_at:new Date().toISOString(),
    price_confidence:'manual'
  };
  const {error}=await db.from('inventory_items').update(payload).eq('id',itemId);
  if(error) {
    if(String(error.message||'').includes('price_unit')) toast('Спочатку виконайте SQL 004_add_price_tracking.sql у базі Складу','error');
    else toast('Помилка збереження ціни: '+error.message,'error');
    return false;
  }
  const item=allItems.find(i=>String(i.id)===String(itemId));
  if(item) Object.assign(item,payload);
  renderItems();updateStats();renderStats();
  return true;
}
async function saveManualPrice(){
  const id=document.getElementById('manualPriceItemSel').value;
  const price=parseFloat(document.getElementById('manualPriceValue').value);
  const source=document.getElementById('manualPriceSource').value.trim();
  if(!id) return toast('Оберіть товар','error');
  if(!price||price<=0) return toast('Вкажіть ціну','error');
  if(await saveItemPrice(id,price,source)) { closeModal('manualPriceModal'); toast('Ціну збережено','success'); }
}

// ===== SET PERSON (role buttons) =====
function setPerson(name, btn) {
  // detect which modal is open
  const qOpen = document.getElementById('qModal').classList.contains('open');
  const field = document.getElementById(qOpen ? 'qmPersonI' : 'issuePersonI');
  field.value = name;
  // highlight active btn
  btn.closest('div').querySelectorAll('.btn').forEach(b=>b.style.background='');
  btn.style.background = 'var(--brand)';
  btn.style.color = '#fff';
}

// ===== BARCODE SCANNER (НОВИЙ ТОВАР) =====
let barcodeAddScanner=null,lastScannedCode='';
function openBarcodeAddScanner(){
  openModal('barcodeAddModal');
  resetBarcodeScanner();
  setTimeout(()=>{
    barcodeAddScanner=new Html5Qrcode('barcodeAddReader');
    barcodeAddScanner.start(
      {facingMode:'environment'},
      {fps:10,qrbox:{width:240,height:120}},
      async(decoded)=>{
        lastScannedCode=decoded;
        try{if(barcodeAddScanner&&barcodeAddScanner.isScanning) await barcodeAddScanner.pause();}catch(e){}
        stopBarcodeAdd();
        closeModal('barcodeAddModal');
        window.open('https://www.google.com/search?q='+encodeURIComponent(decoded),'_blank');
      },
      ()=>{}
    ).catch(()=>{document.getElementById('barcodeAddScanning').innerHTML='<span class="ms ic-14-2">warning</span> Не вдалось запустити камеру.';});
  },300);
}
function searchManualBarcode(){
  const code=document.getElementById('manualBarcodeI').value.trim();
  if(!code){toast('Введіть штрих-код','error');return;}
  window.open('https://www.google.com/search?q='+encodeURIComponent(code),'_blank');
}
function searchInGoogle(){
  if(!lastScannedCode) return;
  window.open('https://www.google.com/search?q='+encodeURIComponent(lastScannedCode+' товар'), '_blank');
}
function resetBarcodeScanner(){
  document.getElementById('barcodeNotFound').style.display='none';
  document.getElementById('barcodeAddScanning').style.display='block';
  document.getElementById('barcodeAddScanning').textContent='Наведіть камеру на штрих-код товару';
  try{if(barcodeAddScanner) barcodeAddScanner.resume();}catch(e){}
}
function stopBarcodeAdd(){
  if(barcodeAddScanner){try{if(barcodeAddScanner.isScanning) barcodeAddScanner.stop().catch(()=>{});}catch(e){} barcodeAddScanner=null;}
  const el=document.getElementById('barcodeAddReader');if(el) el.innerHTML='';
}

// ===== QR SCANNER =====
let qrScanner=null;
function openQR(){
  openModal('qrModal');
  document.getElementById('qrResult').style.display='none';
  setTimeout(()=>{
    qrScanner=new Html5Qrcode('qrReader');
    qrScanner.start(
      {facingMode:'environment'},
      {fps:10,qrbox:{width:220,height:220}},
      (decoded)=>{
        document.getElementById('qrResult').style.display='block';
        document.getElementById('qrResult').innerHTML='<span class="ms ic-14-2">check_circle</span> Зчитано: '+escapeHtml(decoded);
        const found=allItems.find(i=>i.name.toLowerCase().includes(decoded.toLowerCase())||decoded.includes(String(i.id)));
        if(found){stopQR();closeModal('qrModal');openQuick(found.id);}
      },
      ()=>{}
    ).catch(()=>{
      document.getElementById('qrResult').style.display='block';
      document.getElementById('qrResult').innerHTML='<span class="ms ic-14-2">warning</span> Не вдалось запустити камеру. Перевірте дозволи браузера.';
    });
  },300);
}
function stopQR(){
  if(qrScanner){
    try{if(qrScanner.isScanning) qrScanner.stop().catch(()=>{});}catch(e){}
    qrScanner=null;
  }
  const el=document.getElementById('qrReader');if(el) el.innerHTML='';
}

// ===== ITEM HISTORY =====
async function openHistory(itemId){
  const item=findItemForAction(itemId,'історія');
  if(!item) return;
  const unit=escapeHtml(item.unit||'');
  document.getElementById('histTitle').textContent=item.name;
  document.getElementById('histSubtitle').textContent='Поточний залишок: '+item.quantity+' '+item.unit;
  document.getElementById('histList').innerHTML=skeletonStack(3);
  openModal('histModal');
  const {data,error}=await db.from('inventory_logs').select('*').eq('item_id',itemId).order('issued_at',{ascending:false}).limit(30);
  if(error){
    console.warn('item history load failed',error);
    document.getElementById('histList').innerHTML='<div class="history-modal-state">Не вдалося завантажити історію</div>';
    toast('Не вдалося завантажити історію товару','error');
    return;
  }
  const rows=inventoryLogsFromResponse(data);
  if(!rows.length){
    document.getElementById('histList').innerHTML='<div class="history-modal-state">Видач не було</div>';
    return;
  }
  document.getElementById('histList').innerHTML=rows.map(l=>{
    const d=new Date(l.issued_at).toLocaleDateString('uk-UA',{day:'2-digit',month:'2-digit',year:'numeric'});
    const t=new Date(l.issued_at).toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});
    return `<div class="hist-row">
      <div class="hist-main">
        <div class="hist-person">${escapeHtml(l.issued_to||'—')}</div>
        <div class="hist-meta">${d} ${t}${l.note?' · '+escapeHtml(l.note):''}</div>
      </div>
      <div class="hist-out">−${escapeHtml(String(l.quantity??0))} ${unit}</div>
    </div>`;
  }).join('');
}

// ===== CHART =====
let chartInst=null;
function openChartModal(){
  openModal('chartModal');
  setTimeout(renderChart,100);
}
function renderChart(){
  const ctx=document.getElementById('stockChart').getContext('2d');
  if(chartInst){chartInst.destroy();chartInst=null;}
  const cats=[...new Set(allItems.map(i=>i.category))];
  const data=cats.map(c=>allItems.filter(i=>i.category===c).reduce((s,i)=>s+(+i.quantity),0));
  const colors=cats.map(c=>catColor[c]||'#64748b');
  chartInst=new Chart(ctx,{
    type:'bar',
    data:{
      labels:cats.map(c=>(catIcon[c]||'')+' '+c),
      datasets:[{label:'Загальна к-сть',data,backgroundColor:colors.map(c=>c+'cc'),borderColor:colors,borderWidth:2,borderRadius:8}]
    },
    options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'#f0eeff'}},x:{grid:{display:false}}}}
  });
}

// ===== SELECTS =====
function populateSels(){
  const opts=allItems.map(i=>`<option value="${Number(i.id)}">${escapeHtml(i.name||'—')} (${escapeHtml(String(i.quantity??0))} ${escapeHtml(i.unit||'')})</option>`).join('');
  ['issueItemSel','refillSel'].forEach(k=>{const el=document.getElementById(k);if(el){el.innerHTML='<option value="">— Оберіть товар —</option>'+opts;refreshEnhancedSelect(el);}});
}

// Кастомний select підключено зі shared/enhance-select.js.
// ===== MODAL =====
const modalController = createSkladModalController({ document, window });

function clearTextSelection() { modalController.clearTextSelection(); }
function openModal(id) { modalController.open(id); }
function closeModal(id, event) { modalController.close(id, event); }
function closeOpenModals() { modalController.closeAll(); }
function trapModalFocus(event) { modalController.trapFocus(event); }

// ===== PIN ПРИ ВИДАЛЕННІ =====
// Видалення товару/запису/приходу тепер вимагає повторного вводу того ж
// PIN, що й на вході — сама перевірка й видалення відбуваються в одній
// RPC на сервері (delete_inventory_item/log/receipt), а не напряму
// анонімним ключем, щоб бот з ключем зі сторінки не міг видаляти дані.
const deletePinController = createSkladDeletePinController({
  document,
  openModal,
  closeModal: (id) => closeModal(id),
});

function showDeletePinModal(title, action) { deletePinController.show(title, action); }
function delPinModalCancel(event) { deletePinController.cancel(event); }
function deletePinPress(key) { return deletePinController.press(key); }

// ===== TOAST =====
let toastT;
const toastIcons={success:'check_circle',error:'error',info:'info'};
function toast(msg,type=''){
  const el=document.getElementById('toast');
  const t=type||'info';
  el.innerHTML=msIcon(toastIcons[t]||'info','16px')+' '+escapeHtml(msg);
  el.className='show '+t;
  clearTimeout(toastT);toastT=setTimeout(()=>el.className='',3200);
}

// Надсилає текст у Telegram через Supabase Edge Function (токен бота лишається
// секретом на сервері, ніколи не потрапляє у клієнтський код). Це best-effort
// сповіщення: складська операція вже збережена, тому мережеві/CORS проблеми
// Telegram-інтеграції не повинні показувати користувачу червоні помилки в консолі.
const TELEGRAM_NOTIFY_URL='https://vkwkyhjjjmcpmiakxohw.supabase.co/functions/v1/notify-telegram';
function notifyTelegram(text){
  const payload=JSON.stringify({text});
  try{
    if(navigator.sendBeacon){
      const blob=new Blob([payload],{type:'text/plain;charset=UTF-8'});
      if(navigator.sendBeacon(TELEGRAM_NOTIFY_URL,blob)) return;
    }
  }catch(e){}
  fetch(TELEGRAM_NOTIFY_URL,{
    method:'POST',
    mode:'no-cors',
    keepalive:true,
    headers:{'Content-Type':'text/plain;charset=UTF-8'},
    body:payload
  }).catch(()=>{});
}

// ===== ТЕМА (світла/темна) =====
function applyTheme(theme){
  document.body.className=theme;
  const icon=document.getElementById('themeToggleIcon');
  setIcon(icon, theme==='theme-dark' ? 'light_mode' : 'dark_mode');
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', theme==='theme-dark' ? '#121214' : '#F2F2F7');
}
function toggleTheme(){
  const next = nextSkladTheme(document.body.classList.contains('theme-dark')?'theme-dark':'theme-light');
  saveSkladTheme(localStorage,next);
  applyTheme(next);
}
applyTheme(document.body.className || 'theme-light');

function normalizeSkladFieldMetadata(root=document){
  root.querySelectorAll('input[id],select[id],textarea[id]').forEach((field)=>{
    if(!field.getAttribute('name')) field.setAttribute('name',field.id);
  });
  root.querySelectorAll('label:not([for])').forEach((label)=>{
    const field=label.parentElement?.querySelector('input[id],select[id],textarea[id]');
    if(field) label.setAttribute('for',field.id);
  });
}
normalizeSkladFieldMetadata();

// ===== INIT =====
document.getElementById('issueDateI').value=new Date().toISOString().slice(0,10);
document.getElementById('refillDateI').value=new Date().toISOString().slice(0,10);
['issueItemSel','refillSel','newCat','editItemCategory','manualPriceItemSel','valueCatFilter','valueStockFilter','valueInternalFilter','valuePriceFilter'].forEach(id=>enhanceSelect(document.getElementById(id)));
['issueDateI','refillDateI','editLogDate','editReceiptDate'].forEach(id=>window.enhanceDateInput?.(document.getElementById(id)));
function isTypingTarget(el){
  return !!el && (['INPUT','TEXTAREA','SELECT'].includes(el.tagName) || el.isContentEditable);
}
function focusActivePageSearch(){
  const active=document.querySelector('.page.active');
  const searchId={
    'page-items':'searchInp',
    'page-log':'logSearch',
    'page-receipts':'recSearch',
    'page-audit':'auditSearch'
  }[active?.id];
  const input=searchId?document.getElementById(searchId):null;
  if(!input) return false;
  input.focus();
  input.select?.();
  return true;
}
function clearSearchInput(input){
  if(!input || !input.value) return false;
  input.value='';
  const renderById={
    searchInp:renderItems,
    logSearch:renderLog,
    recSearch:renderReceipts,
    auditSearch:renderAuditList
  };
  renderById[input.id]?.();
  return true;
}
document.addEventListener('keydown',e=>{
  if((e.key==='/' || (e.ctrlKey && e.key.toLowerCase()==='k')) && !isTypingTarget(e.target)){
    if(focusActivePageSearch()){
      e.preventDefault();
      return;
    }
  }
  if(e.key==='Escape' && clearSearchInput(e.target)){
    e.preventDefault();
    return;
  }
  if(e.key==='Escape'){
    const openItemMenu=document.querySelector('details.item-more[open]');
    closeOpenItemMenus();
    openItemMenu?.querySelector('summary')?.focus({preventScroll:true});
    closeOpenModals();
    closeLightbox();
    stopQR();stopBarcodeAdd();
  }
  trapModalFocus(e);
});

bindItemActionDelegation();
bindPriceBadgeActions();
bindAuditListDelegation();
bindLogActionDelegation();
bindReceiptActionDelegation();
bindNewProductMatchActions();
bindPhotoCurrentActions();
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bindSkladStaticControls,{once:true});
else bindSkladStaticControls();
initPullToRefresh();
setRefreshStatus('syncing','Завантаження...');
loadItems()
  .then(()=>loadLogs())
  .then(()=>markDataUpdated())
  .catch(e=>{
    console.warn('initial sklad load failed:',e);
    setRefreshStatus('ready','Помилка завантаження');
  });
loadSupplierTagsCloud().catch(error=>console.warn('supplier tags initial sync failed:',error));
initRealtime();
