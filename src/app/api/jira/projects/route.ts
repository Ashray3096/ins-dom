import { NextResponse } from 'next/server';
import { fetchJiraProjects } from '@/lib/jira';

export async function GET() {
  try {
    const projects = await fetchJiraProjects();

    return NextResponse.json({
      success: true,
      count: projects.length,
      projects
    });
  } catch (error) {
    console.error('Error fetching Jira projects:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch projects'
      },
      { status: 500 }
    );
  }
}
