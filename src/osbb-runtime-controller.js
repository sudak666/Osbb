import { shouldApplyRealtimeRefresh } from './osbb-client-state.js';

export function createOsbbRuntimeController(options) {
    const { document, window, navigator, isPreview, tabs, initialTab, isTabAllowed, isDispatcher, requestShiftPin,
        getSelectedMonth, loadPhotos, updateToday, loadDashboard, loaders, setSyncStatus, createRealtimeClient,
        showToast, onlineIcon, offlineIcon, warn = console.warn } = options;
    let currentTab=initialTab, realtimeChannel=null;
    const publishTab=() => options.onTabChanged?.(currentTab);
    function setTab(tab,{load=true}={}) {
        if(!tabs.includes(tab)) return false; currentTab=tab; publishTab();
        tabs.forEach(name => {
            document.getElementById(`section-${name}`)?.classList.toggle('hidden',name!==tab);
            for(const id of [`tab-${name}`,`tab-${name}-m`]) { const element=document.getElementById(id); if(!element) continue;
                element.classList.toggle(id.endsWith('-m') ? 'mob-active' : 'active',name===tab);
                element.toggleAttribute('aria-current',name===tab); element.setAttribute('aria-selected',String(name===tab)); }
        });
        if(load) void loaders[tab]?.(); return true;
    }
    function requestTab(tab) {
        if(!isTabAllowed(tab)) { showToast('Цей розділ вам недоступний'); return false; }
        if(tab==='dispatcher'&&!isDispatcher()) { showToast('Цей розділ доступний лише Диспетчеру/Адміну'); return false; }
        if(tab==='shifts') { requestShiftPin(()=>setTab(tab)); return true; }
        return setTab(tab);
    }
    async function initCalendar() {
        const month=getSelectedMonth(); if(!Number.isInteger(month.year)||!Number.isInteger(month.month)) throw new TypeError('Invalid selected calendar month');
        options.onMonthChanged?.(month); setSyncStatus('loading'); await loadPhotos(); setSyncStatus('ok'); updateToday();
        await loaders[currentTab]?.(); await loadDashboard(); return month;
    }
    function safeRealtimeRefresh(tab,loader) { const active=document.activeElement; if(shouldApplyRealtimeRefresh(currentTab,tab,active?.tagName)) void loader(); }
    function initRealtime() {
        if(isPreview||!createRealtimeClient||realtimeChannel) return realtimeChannel;
        try { const client=createRealtimeClient(); let channel=client.channel('osbb-live');
            for(const subscription of options.subscriptions) channel=channel.on('postgres_changes',subscription.filter,()=>safeRealtimeRefresh(subscription.tab,subscription.load));
            realtimeChannel=channel.subscribe(); return realtimeChannel;
        } catch(error) { warn('osbb realtime init failed:',error); return null; }
    }
    function updateNetworkBadge() { const badge=document.getElementById('network-badge'); if(badge) badge.style.display=navigator.onLine?'none':'flex'; }
    function bindNetwork() {
        window.addEventListener('online',()=>{updateNetworkBadge();showToast('Мережа відновлена',onlineIcon);});
        window.addEventListener('offline',()=>{updateNetworkBadge();showToast('Немає мережі — працюємо офлайн',offlineIcon,4000);}); updateNetworkBadge();
    }
    return { bindNetwork, getCurrentTab:()=>currentTab, initCalendar, initRealtime, requestTab, safeRealtimeRefresh, setTab, updateNetworkBadge };
}
