const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface JiraIssue {
  key?: string;
  fields?: {
    summary?: string;
    status?: { name?: string };
    priority?: { name?: string } | null;
    assignee?: { displayName?: string } | null;
    created?: string;
    labels?: string[];
  };
}

interface JiraTransition {
  id?: string;
  name?: string;
  to?: { statusCategory?: { key?: string } };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = Deno.env.get('JIRA_API_TOKEN');
  const email = Deno.env.get('JIRA_EMAIL') || 'guard.mykytska.sloboda@gmail.com';
  const baseUrl = (Deno.env.get('JIRA_BASE_URL') || '').replace(/\/$/, '');
  const projectKey = Deno.env.get('JIRA_PROJECT_KEY') || 'MS';
  if (!token || !baseUrl) return json({ error: 'Jira is not configured' }, 500);

  const jiraHeaders = {
    'Authorization': `Basic ${btoa(`${email}:${token}`)}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const action = isObject(body) && typeof body.action === 'string' ? body.action : '';
  const staffId = isObject(body) && typeof body.staffId === 'string' ? body.staffId : '';
  const pin = isObject(body) && typeof body.pin === 'string' ? body.pin : '';
  if (!staffId || !/^\d{4}$/.test(pin)) return json({ error: 'Потрібне підтвердження PIN' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  try {
    const authResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/verify_staff_pin`, {
      method: 'POST',
      headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_staff_id: staffId, attempt: pin }),
    });
    const authData: unknown = await authResponse.json();
    const authResult = Array.isArray(authData) ? authData[0] : authData;
    if (!authResponse.ok || !isObject(authResult) || authResult.ok !== true) {
      return json({ error: 'Невірний PIN' }, 403);
    }
    const staffRole = typeof authResult.role === 'string' ? authResult.role : '';
    const isManager = ['dispatcher', 'admin', 'board'].includes(staffRole);
    const workerRoles = ['plumber', 'janitor', 'electrician'];
    const roleLabel = workerRoles.includes(staffRole) ? `osbb-${staffRole}` : '';

    if (action === 'list') {
      const params = new URLSearchParams({
        jql: `project = ${projectKey} AND statusCategory != Done ORDER BY priority DESC, created ASC`,
        fields: 'summary,status,priority,assignee,created,labels',
        maxResults: '100',
      });
      const response = await fetch(`${baseUrl}/rest/api/3/search/jql?${params}`, { headers: jiraHeaders });
      const data: unknown = await response.json();
      if (!response.ok || !isObject(data)) return json({ error: 'Jira search failed' }, 502);
      const issues = Array.isArray(data.issues) ? data.issues as JiraIssue[] : [];
      const visibleIssues = isManager ? issues : issues.filter(issue => roleLabel && issue.fields?.labels?.includes(roleLabel));
      return json({
        issues: visibleIssues.filter(issue => issue.key && issue.fields?.summary).map(issue => ({
          key: issue.key,
          summary: issue.fields?.summary,
          status: issue.fields?.status?.name || '',
          priority: issue.fields?.priority?.name || '',
          assignee: issue.fields?.assignee?.displayName || '',
          created: issue.fields?.created || '',
          assignedRole: workerRoles.find(role => issue.fields?.labels?.includes(`osbb-${role}`)) || '',
          url: `${baseUrl}/browse/${encodeURIComponent(issue.key || '')}`,
        })),
      });
    }

    const issueKey = isObject(body) && typeof body.issueKey === 'string' ? body.issueKey.trim().toUpperCase() : '';
    if (!new RegExp(`^${projectKey}-\\d+$`).test(issueKey)) return json({ error: 'Invalid issue key' }, 400);

    if (action === 'assign') {
      if (!isManager) return json({ error: 'Призначати заявки може лише диспетчер' }, 403);
      const assignedRole = isObject(body) && typeof body.assignedRole === 'string' ? body.assignedRole : '';
      if (!workerRoles.includes(assignedRole)) return json({ error: 'Invalid worker role' }, 400);
      const issueResponse = await fetch(`${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=labels`, { headers: jiraHeaders });
      const issueData: unknown = await issueResponse.json();
      if (!issueResponse.ok || !isObject(issueData)) return json({ error: 'Не вдалося прочитати Jira-заявку' }, 502);
      const fields = isObject(issueData.fields) ? issueData.fields : {};
      const labels = Array.isArray(fields.labels) ? fields.labels.filter(label => typeof label === 'string') as string[] : [];
      const nextLabels = [...labels.filter(label => !workerRoles.some(role => label === `osbb-${role}`)), `osbb-${assignedRole}`];
      const updateResponse = await fetch(`${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}`, {
        method: 'PUT', headers: jiraHeaders, body: JSON.stringify({ fields: { labels: nextLabels } }),
      });
      if (!updateResponse.ok) return json({ error: 'Не вдалося призначити виконавця' }, 502);
      return json({ ok: true, issueKey, assignedRole });
    }

    if (action !== 'close') return json({ error: 'Invalid action' }, 400);
    if (isManager) return json({ error: 'Закриває заявку призначений працівник' }, 403);
    const issueResponse = await fetch(`${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=labels`, { headers: jiraHeaders });
    const issueData: unknown = await issueResponse.json();
    const issueFields = isObject(issueData) && isObject(issueData.fields) ? issueData.fields : {};
    const issueLabels = Array.isArray(issueFields.labels) ? issueFields.labels : [];
    if (!issueResponse.ok || !roleLabel || !issueLabels.includes(roleLabel)) {
      return json({ error: 'Заявка не призначена цьому працівнику' }, 403);
    }

    const transitionsResponse = await fetch(`${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`, { headers: jiraHeaders });
    const transitionsData: unknown = await transitionsResponse.json();
    const transitions = isObject(transitionsData) && Array.isArray(transitionsData.transitions)
      ? transitionsData.transitions as JiraTransition[]
      : [];
    const doneTransition = transitions.find(transition => transition.to?.statusCategory?.key === 'done');
    if (!transitionsResponse.ok || !doneTransition?.id) {
      return json({ error: 'Для заявки немає переходу у виконаний статус' }, 409);
    }

    const closeResponse = await fetch(`${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`, {
      method: 'POST',
      headers: jiraHeaders,
      body: JSON.stringify({ transition: { id: doneTransition.id } }),
    });
    if (!closeResponse.ok) return json({ error: 'Не вдалося закрити Jira-заявку' }, 502);
    return json({ ok: true, issueKey });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Jira request failed' }, 502);
  }
});
