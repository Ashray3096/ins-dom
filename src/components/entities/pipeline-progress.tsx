'use client';

/**
 * Pipeline Progress Component
 *
 * Real-time progress tracking for async pipeline jobs
 */

import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, StopCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PipelineProgressProps {
  jobId: string;
  onComplete?: (job: any) => void;
  onError?: (error: string) => void;
}

export function PipelineProgress({ jobId, onComplete, onError }: PipelineProgressProps) {
  const [job, setJob] = useState<any>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    // Poll for job status every 2 seconds
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/pipeline-jobs/${jobId}`);
        if (response.ok) {
          const data = await response.json();
          setJob(data);

          // Stop polling if job is done
          if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
            clearInterval(interval);

            if (data.status === 'completed' && onComplete) {
              onComplete(data);
            } else if (data.status === 'failed' && onError) {
              onError(data.error || 'Pipeline failed');
            }
          }
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, onComplete, onError]);

  const handleCancel = async () => {
    if (!confirm('Cancel this pipeline job? Data already extracted will be saved.')) {
      return;
    }

    setCancelling(true);
    try {
      await fetch(`/api/pipeline-jobs/${jobId}`, { method: 'DELETE' });
      toast.success('Pipeline job cancelled');
    } catch (error) {
      toast.error('Failed to cancel job');
    } finally {
      setCancelling(false);
    }
  };

  if (!job) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading job status...</span>
      </div>
    );
  }

  const progress = job.progress_total > 0
    ? (job.progress_current / job.progress_total) * 100
    : 0;

  return (
    <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {job.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
          {job.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-600" />}
          {job.status === 'failed' && <XCircle className="w-4 h-4 text-red-600" />}
          {job.status === 'cancelled' && <StopCircle className="w-4 h-4 text-gray-600" />}

          <span className="font-medium text-sm capitalize">{job.status}</span>
        </div>

        <span className="text-sm text-gray-600">
          {job.progress_current}/{job.progress_total}
        </span>
      </div>

      {/* Progress Bar */}
      <Progress value={progress} className="h-2" />

      {/* Progress Message */}
      <p className="text-xs text-gray-700">{job.progress_message}</p>

      {/* Actions */}
      {job.status === 'running' && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={cancelling}
            className="text-red-600 hover:text-red-700"
          >
            {cancelling ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <StopCircle className="w-3 h-3 mr-1" />
                Cancel
              </>
            )}
          </Button>
        </div>
      )}

      {/* Result Summary */}
      {job.status === 'completed' && job.result && (
        <div className="pt-2 border-t border-blue-300">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-gray-600">Files</div>
              <div className="font-semibold text-blue-700">{job.result.artifacts_processed || 0}</div>
            </div>
            <div>
              <div className="text-gray-600">Extracted</div>
              <div className="font-semibold text-blue-700">{job.result.records_extracted || 0}</div>
            </div>
            <div>
              <div className="text-gray-600">Loaded</div>
              <div className="font-semibold text-green-700">{job.result.records_loaded || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {job.status === 'failed' && job.error && (
        <div className="pt-2 border-t border-red-300 bg-red-50 p-2 rounded">
          <p className="text-xs text-red-700">{job.error}</p>
        </div>
      )}
    </div>
  );
}
