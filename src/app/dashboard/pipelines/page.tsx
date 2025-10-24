'use client';

/**
 * Pipelines Page
 *
 * Set up automated extraction pipelines with Dagster
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Activity, Play, Pause } from 'lucide-react';

export default function PipelinesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pipelines</h1>
          <p className="mt-2 text-gray-600">
            Set up automated extraction pipelines with Dagster
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Pipeline
        </Button>
      </div>

      {/* Empty State */}
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
            <Activity className="h-8 w-8 text-indigo-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No pipelines yet
          </h3>
          <p className="text-gray-600 text-center mb-6 max-w-md">
            Create your first pipeline to automate data extraction workflows.
            Pipelines can run on a schedule or be triggered manually.
          </p>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Your First Pipeline
          </Button>
        </CardContent>
      </Card>

      {/* Pipeline Features */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Pipeline Capabilities</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scheduled Execution</CardTitle>
              <CardDescription>Automate extraction on a schedule</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Run extractions automatically on a daily, weekly, or monthly basis.
                Perfect for recurring data sources like NABCA monthly reports.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Manual Triggers</CardTitle>
              <CardDescription>Run pipelines on demand</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Manually trigger pipelines whenever you need to process new files
                or re-run extractions with updated templates.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Multi-Step Workflows</CardTitle>
              <CardDescription>Chain multiple operations</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Create complex workflows that combine file uploads, extractions,
                validation, and data export in a single pipeline.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monitoring & Logs</CardTitle>
              <CardDescription>Track pipeline execution</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Monitor pipeline runs in real-time with detailed logs, error
                tracking, and execution history for debugging.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pipeline Architecture */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Architecture</CardTitle>
          <CardDescription>How pipelines work in Inspector Dom</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <div className="font-medium text-sm">Source Ingestion</div>
                <div className="text-xs text-gray-600 mt-1">
                  Automatically fetch files from providers or wait for manual uploads
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <div className="font-medium text-sm">AI Extraction</div>
                <div className="text-xs text-gray-600 mt-1">
                  Apply templates to extract structured data using Claude AI
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <div className="font-medium text-sm">Validation</div>
                <div className="text-xs text-gray-600 mt-1">
                  Validate extracted data against expected schemas and rules
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-sm">
                4
              </div>
              <div>
                <div className="font-medium text-sm">Storage & Export</div>
                <div className="text-xs text-gray-600 mt-1">
                  Store entities in database and optionally export to external systems
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Statistics</CardTitle>
          <CardDescription>Overview of pipeline execution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">0</div>
              <div className="text-sm text-gray-600 mt-1">Total Pipelines</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">0</div>
              <div className="text-sm text-gray-600 mt-1">Runs Today</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">0</div>
              <div className="text-sm text-gray-600 mt-1">Active Pipelines</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">0</div>
              <div className="text-sm text-gray-600 mt-1">Failed Runs</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
