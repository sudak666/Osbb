import { completedWorkEntriesFromResponse, validateCompletedWorkDraft } from './osbb-completed-work.js';

export function createOsbbCompletedWorkController(options) {
    let entries = [];
    async function load() {
        options.setStatus('loading');
        try { const response = await options.loadRows(); if (response.error) throw response.error;
            entries = completedWorkEntriesFromResponse(response.data); options.setStatus('ok'); options.render(entries); return entries;
        } catch (error) { options.warn?.('completed work load error:',error); options.setStatus('error'); options.showToast('Не вдалося завантажити журнал робіт'); return []; }
    }
    async function save(draft) {
        const checked = validateCompletedWorkDraft(draft);
        if (checked.error) { options.showToast(checked.error); return false; }
        if (!options.getPin() && !await options.requestReauth()) return false;
        const session = options.getSession();
        let id = null;
        try { id = await options.saveRow({ p_id:checked.value.id, p_work_date:checked.value.workDate, p_worker_role:checked.value.workerRole,
            p_description:checked.value.description, p_note:checked.value.note, p_staff_id:session.id, attempt:options.getPin() }); }
        catch (error) { options.warn?.('completed work save error:',error); }
        if (!id) { options.clearPin(); options.showToast('Не вдалося зберегти запис'); return false; }
        await load(); return true;
    }
    async function remove(id) {
        if (!options.getPin() && !await options.requestReauth()) return false;
        const session = options.getSession();
        let ok = false;
        try { ok = await options.deleteRow({ p_id:id, p_staff_id:session.id, attempt:options.getPin() }); }
        catch (error) { options.warn?.('completed work delete error:',error); }
        if (!ok) { options.clearPin(); options.showToast('Не вдалося видалити запис'); return false; }
        await load(); return true;
    }
    return { getEntries:()=>entries, load, remove, save };
}
