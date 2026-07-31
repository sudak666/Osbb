const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface JiraIssueRequest {
  summary?: unknown;
  description?: unknown;
  sourceId?: unknown;
}

interface JiraCreateResponse {
  id?: string;
  key?: string;
  self?: string;
  errorMessages?: string[];
  errors?: Record<string, string>;
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

function jiraErrorMessage(data: JiraCreateResponse): string {
  const messages = Array.isArray(data.errorMessages) ? data.errorMessages : [];
  const fieldErrors = isObject(data.errors) ? Object.values(data.errors).filter(value => typeof value === 'string') : [];
  return [...messages, ...fieldErrors].join('; ') || 'Jira API error';
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = Deno.env.get('JIRA_API_TOKEN');
  const email = Deno.env.get('JIRA_EMAIL') || 'guard.mykytska.sloboda@gmail.com';
  const baseUrl = (Deno.env.get('JIRA_BASE_URL') || '').replace(/\/$/, '');
  const projectKey = Deno.env.get('JIRA_PROJECT_KEY') || 'MS';
  const issueType = Deno.env.get('JIRA_ISSUE_TYPE') || 'Task';
  if (!token || !email || !baseUrl) {
    return json({ error: 'Jira is not configured (missing secrets)' }, 500);
  }

  let body: JiraIssueRequest;
  try {
    const parsed: unknown = await req.json();
    if (!isObject(parsed)) throw new Error('Body must be an object');
    body = parsed;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const sourceId = typeof body.sourceId === 'string' ? body.sourceId.trim() : '';
  if (!summary) return json({ error: 'summary is required' }, 400);

  const descriptionText = [description, sourceId ? `ID заявки ОСББ: ${sourceId}` : '']
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 30000);

  try {
    const jiraResponse = await fetch(`${baseUrl}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${email}:${token}`)}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          issuetype: { name: issueType },
          summary: summary.slice(0, 255),
          description: {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: descriptionText || summary }],
            }],
          },
        },
      }),
    });
    const data = await jiraResponse.json() as JiraCreateResponse;
    if (!jiraResponse.ok || !data.key) {
      return json({ error: jiraErrorMessage(data) }, 502);
    }
    return json({
      ok: true,
      issue: { key: data.key, url: `${baseUrl}/browse/${encodeURIComponent(data.key)}` },
    }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Jira request failed' }, 502);
  }
});
