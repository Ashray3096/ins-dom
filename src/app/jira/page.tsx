'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  assignee: string;
  priority: string;
  issueType: string;
  url: string;
}

export default function JiraPage() {
  const [tickets, setTickets] = useState<JiraIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/jira/tickets?project=CIQ');
      const data = await response.json();

      if (data.success) {
        setTickets(data.tickets);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch tickets');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Jira Tickets - ConsumerIQ (CIQ)</CardTitle>
          <CardDescription>
            View and manage your Jira tickets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="text-center py-8">Loading tickets...</div>
          )}

          {error && (
            <div className="text-red-500 py-4">
              Error: {error}
            </div>
          )}

          {!loading && !error && tickets.length === 0 && (
            <div className="text-center py-8">No tickets found</div>
          )}

          {!loading && !error && tickets.length > 0 && (
            <>
              <div className="mb-4">
                <Button onClick={fetchTickets}>Refresh</Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow key={ticket.key}>
                      <TableCell className="font-medium">{ticket.key}</TableCell>
                      <TableCell>{ticket.summary}</TableCell>
                      <TableCell>{ticket.issueType}</TableCell>
                      <TableCell>{ticket.status}</TableCell>
                      <TableCell>{ticket.priority}</TableCell>
                      <TableCell>{ticket.assignee}</TableCell>
                      <TableCell>
                        <a
                          href={ticket.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 text-sm text-gray-600">
                Total tickets: {tickets.length}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
