'use client';

/**
 * Pipelines Page
 *
 * List and manage data pipelines
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Plus,
  Play,
  Pause,
  Activity,
  Loader2,
  Clock,
  Eye,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  schedule: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  provider: {
    id: string;
    name: string;
    type: string;
  } | null;
  template: {
    id: string;
    name: string;
  } | null;
}

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPipelines();
  }, []);

  const loadPipelines = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/pipelines');
      if (!response.ok) throw new Error('Failed to fetch pipelines');
      const data = await response.json();
      setPipelines(data);
    } catch (error) {
      console.error('Error loading pipelines:', error);
      toast.error('Failed to load pipelines');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (pipelineId: string, currentState: boolean) => {
    try {
      const response = await fetch(`/api/pipelines/${pipelineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentState }),
      });

      if (!response.ok) throw new Error('Failed to update pipeline');

      toast.success(currentState ? 'Pipeline paused' : 'Pipeline activated');
      loadPipelines();
    } catch (error) {
      console.error('Error toggling pipeline:', error);
      toast.error('Failed to update pipeline');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pipelines</h1>
            <p className="mt-2 text-gray-600">
              Automated data extraction pipelines
            </p>
          </div>
          <Link href="/dashboard/pipelines/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Pipeline
            </Button>
          </Link>
        </div>

        <Card className="p-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No pipelines yet
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Create your first pipeline to start automatically processing documents.
            </p>
            <Link href="/dashboard/pipelines/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Pipeline
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pipelines</h1>
          <p className="mt-2 text-gray-600">
            {pipelines.length} pipeline{pipelines.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <Link href="/dashboard/pipelines/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Pipeline
          </Button>
        </Link>
      </div>

      {/* Pipelines List */}
      <div className="grid gap-4">
        {pipelines.map((pipeline) => (
          <Card key={pipeline.id} className="p-6">
            <div className="flex items-start justify-between">
              {/* Main Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {pipeline.name}
                  </h3>
                  <Badge
                    variant={pipeline.is_active ? 'default' : 'secondary'}
                    className={
                      pipeline.is_active
                        ? 'bg-green-500 hover:bg-green-600'
                        : 'bg-gray-300'
                    }
                  >
                    {pipeline.is_active ? 'Active' : 'Paused'}
                  </Badge>
                  {pipeline.schedule && (
                    <Badge variant="outline" className="text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      Scheduled
                    </Badge>
                  )}
                </div>

                {pipeline.description && (
                  <p className="text-sm text-gray-600 mb-3">
                    {pipeline.description}
                  </p>
                )}

                <div className="flex items-center gap-6 text-xs text-gray-500">
                  {pipeline.provider && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Provider:</span>
                      <span>{pipeline.provider.name}</span>
                    </div>
                  )}
                  {pipeline.template && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Template:</span>
                      <span>{pipeline.template.name}</span>
                    </div>
                  )}
                  {pipeline.schedule && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Schedule:</span>
                      <code className="bg-gray-100 px-1 py-0.5 rounded">
                        {pipeline.schedule}
                      </code>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-6 text-xs text-gray-500 mt-2">
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Last run:</span>
                    <span>{formatDate(pipeline.last_run_at)}</span>
                  </div>
                  {pipeline.is_active && pipeline.next_run_at && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Next run:</span>
                      <span>{formatDate(pipeline.next_run_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleActive(pipeline.id, pipeline.is_active)}
                >
                  {pipeline.is_active ? (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Activate
                    </>
                  )}
                </Button>
                <Link href={`/dashboard/pipelines/${pipeline.id}`}>
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
