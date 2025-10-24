/**
 * Jira Helper - Connects to Jira MCP Server
 *
 * This uses the Jira MCP server we built to interact with Jira.
 * The MCP server is configured in Claude Desktop config.
 */

export interface JiraIssue {
  key: string;
  summary: string;
  description?: string;
  status: string;
  assignee: string;
  priority: string;
  issueType: string;
  created: string;
  updated: string;
  url: string;
}

export interface JiraProject {
  key: string;
  name: string;
  description: string;
}

/**
 * Note: These functions are placeholders for documentation.
 * In Claude Desktop/Code with MCP, you would ask Claude directly:
 *
 * Examples:
 * - "Show me all tickets in project CIQ"
 * - "Create a task in project CIQ with summary 'Build login page'"
 * - "Get details for ticket CIQ-123"
 * - "Update ticket CIQ-123 to In Progress"
 *
 * The MCP server (D:\Claude workspace\mcp-server) handles these requests.
 */

// For server-side API routes, we can fetch from Jira directly
export async function fetchJiraTickets(projectKey: string): Promise<JiraIssue[]> {
  const config = {
    host: process.env.JIRA_HOST || 'twenty20systems.atlassian.net',
    email: process.env.JIRA_EMAIL || '',
    apiToken: process.env.JIRA_API_TOKEN || ''
  };

  if (!config.email || !config.apiToken) {
    console.warn('Jira credentials not configured');
    return [];
  }

  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  const jql = encodeURIComponent(`project = ${projectKey} ORDER BY created DESC`);

  const response = await fetch(
    `https://${config.host}/rest/api/3/search?jql=${jql}&maxResults=50`,
    {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Jira tickets: ${response.status}`);
  }

  const data = await response.json();

  return data.issues.map((issue: any) => ({
    key: issue.key,
    summary: issue.fields.summary,
    description: issue.fields.description,
    status: issue.fields.status.name,
    assignee: issue.fields.assignee?.displayName || 'Unassigned',
    priority: issue.fields.priority?.name || 'None',
    issueType: issue.fields.issuetype.name,
    created: issue.fields.created,
    updated: issue.fields.updated,
    url: `https://${config.host}/browse/${issue.key}`
  }));
}

export async function fetchJiraProjects(): Promise<JiraProject[]> {
  const config = {
    host: process.env.JIRA_HOST || 'twenty20systems.atlassian.net',
    email: process.env.JIRA_EMAIL || '',
    apiToken: process.env.JIRA_API_TOKEN || ''
  };

  if (!config.email || !config.apiToken) {
    console.warn('Jira credentials not configured');
    return [];
  }

  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

  const response = await fetch(
    `https://${config.host}/rest/api/3/project`,
    {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Jira projects: ${response.status}`);
  }

  const data = await response.json();

  return data.map((project: any) => ({
    key: project.key,
    name: project.name,
    description: project.description || ''
  }));
}
