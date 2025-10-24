import { NextRequest, NextResponse } from 'next/server';
import { fetchJiraTickets } from '@/lib/jira';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectKey = searchParams.get('project') || 'CIQ';

    const tickets = await fetchJiraTickets(projectKey);

    return NextResponse.json({
      success: true,
      project: projectKey,
      count: tickets.length,
      tickets
    });
  } catch (error) {
    console.error('Error fetching Jira tickets:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tickets'
      },
      { status: 500 }
    );
  }
}
