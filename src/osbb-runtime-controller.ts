import { shouldApplyRealtimeRefresh } from './osbb-client-state.ts';
import type { CalendarMonth, SyncStatusType, WarnFn } from './controller-types.ts';

type AsyncLoader = () => unknown;

interface RealtimeChannelLike {
    on(event: string, filter: Record<string, unknown>, callback: () => void): RealtimeChannelLike;
    subscribe(): unknown;
}

export interface OsbbRealtimeSubscription {
    tab: string;
    filter: Record<string, unknown>;
    load: AsyncLoader;
}

export interface OsbbRuntimeControllerOptions {
    document: Document;
    window: Window;
    navigator: Navigator;
    isPreview: boolean;
    tabs: readonly string[];
    initialTab: string;
    isTabAllowed(tab: string): boolean;
    requestShiftPin(onAuthorized: (attempt: string) => void): void;
    getSelectedMonth(): CalendarMonth;
    loadPhotos(): Promise<unknown>;
    updateToday(): void;
    loadDashboard(): Promise<unknown>;
    loaders: Record<string, AsyncLoader | undefined>;
    setSyncStatus(type: SyncStatusType): void;
    createRealtimeClient: (() => { channel(name: string): RealtimeChannelLike }) | null;
    showToast(message: string, icon?: string, duration?: number): void;
    onlineIcon?: string;
    offlineIcon?: string;
    warn?: WarnFn;
    subscriptions: readonly OsbbRealtimeSubscription[];
    onTabChanged?: (tab: string) => void;
    onShiftAuthorized?: (attempt: string) => void;
    onMonthChanged?: (month: CalendarMonth) => void;
}

export function createOsbbRuntimeController(options: OsbbRuntimeControllerOptions) {
    const { document, window, navigator, isPreview, tabs, initialTab, isTabAllowed, requestShiftPin,
        getSelectedMonth, loadPhotos, updateToday, loadDashboard, loaders, setSyncStatus, createRealtimeClient,
        showToast, onlineIcon, offlineIcon, warn = console.warn } = options;
    let currentTab=initialTab, realtimeChannel: unknown=null;
    const publishTab=() => options.onTabChanged?.(currentTab);
    function setTab(tab: string,{load=true}: { load?: boolean }={}) {
        if(!tabs.includes(tab)) return false; currentTab=tab; publishTab();
        tabs.forEach(name => {
            document.getElementById(`section-${name}`)?.classList.toggle('hidden',name!==tab);
            for(const id of [`tab-${name}`,`tab-${name}-m`]) { const element=document.getElementById(id); if(!element) continue;
                element.classList.toggle(id.endsWith('-m') ? 'mob-active' : 'active',name===tab);
                element.toggleAttribute('aria-current',name===tab); element.setAttribute('aria-selected',String(name===tab)); }
        });
        if(load) void loaders[tab]?.(); return true;
    }
    function requestTab(tab: string) {
        if(!isTabAllowed(tab)) { showToast('Цей розділ вам недоступний'); return false; }
        if(tab==='shifts') {
            if(currentTab==='shifts') return true;
            requestShiftPin(attempt=>{ options.onShiftAuthorized?.(attempt); setTab(tab); });
            return true;
        }
        return setTab(tab);
    }
    async function initCalendar() {
        const month=getSelectedMonth(); if(!Number.isInteger(month.year)||!Number.isInteger(month.month)) throw new TypeError('Invalid selected calendar month');
        options.onMonthChanged?.(month); setSyncStatus('loading'); await loadPhotos(); setSyncStatus('ok'); updateToday();
        await loaders[currentTab]?.(); await loadDashboard(); return month;
    }
    function safeRealtimeRefresh(tab: string,loader: AsyncLoader) { const active=document.activeElement; if(shouldApplyRealtimeRefresh(currentTab,tab,active?.tagName)) void loader(); }
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
