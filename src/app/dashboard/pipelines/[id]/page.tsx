'use client';

/**
 * Pipeline Detail Page
 *
 * View pipeline configuration, generated code, and deployment status
 */

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Loader2,
  Code2,
  Database,
  Settings2,
  Rocket,
  Copy,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play,
  Pause,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  schedule: string | null;
  config: any;
  provider: any;
  template: any;
}

export default function PipelineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [generatedCode, setGeneratedCode] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadPipeline();
    loadLatestDeployment();
  }, [id]);

  const loadPipeline = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/pipelines/${id}`);
      if (!response.ok) throw new Error('Failed to load pipeline');
      const data = await response.json();
      setPipeline(data);
    } catch (error) {
      console.error('Error loading pipeline:', error);
      toast.error('Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  };

  const loadLatestDeployment = async () => {
    try {
      const response = await fetch(`/api/pipelines/${id}/generate-code`);
      if (!response.ok) return; // No deployments yet

      const data = await response.json();
      if (data.deployments && data.deployments.length > 0) {
        // Get the latest deployment
        const latest = data.deployments[0];
        setGeneratedCode({
          deployment_id: latest.id,
          pipeline_name: latest.pipeline_name,
          version: latest.version,
          pipeline_code: latest.python_code,
          entity_sql: '', // Not stored in DB, would need to regenerate
          dagster_config: '', // Not stored in DB, would need to regenerate
          lines_of_code: latest.python_code.split('\n').length,
        });
      }
    } catch (error) {
      console.error('Error loading deployment:', error);
      // Don't show error to user - it's okay if there's no deployment yet
    }
  };

  const handleGenerateCode = async () => {
    try {
      setGenerating(true);
      toast.info('Generating Dagster pipeline code...');
      const response = await fetch(`/api/pipelines/${id}/generate-code`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Failed to generate code');
      }
      const data = await response.json();
      setGeneratedCode(data);
      toast.success(`Pipeline code generated! ${data.lines_of_code} lines of Python code`);
    } catch (error) {
      console.error('Error generating code:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate pipeline code');
    } finally {
      setGenerating(false);
    }
  };

  const handleTestRun = async (limit: number = 10) => {
    try {
      setTesting(true);
      const response = await fetch(`/api/pipelines/${id}/test-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to run test');
      }

      const results = await response.json();
      setTestResults(results);
      toast.success(`Test completed! Processed ${results.execution_summary.total_files} files`);
    } catch (error) {
      console.error('Error running test:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to run pipeline test');
    } finally {
      setTesting(false);
    }
  };

  const handleExecute = async (limit: number = 100) => {
    if (!confirm(`This will create the database table and load ${limit} records. Continue?`)) {
      return;
    }

    try {
      setTesting(true);
      const response = await fetch(`/api/pipelines/${id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit, createTable: true }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to execute pipeline');
      }

      const results = await response.json();
      setTestResults(results);

      toast.success(
        `Pipeline executed! Loaded ${results.execution_summary.loaded} rows into ${results.table_name}`
      );

      loadPipeline(); // Refresh to show active status
    } catch (error) {
      console.error('Error executing pipeline:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to execute pipeline');
    } finally {
      setTesting(false);
    }
  };

  const handleDeploy = async () => {
    if (!generatedCode) {
      toast.error('Please generate pipeline code first');
      return;
    }

    try {
      setDeploying(true);
      toast.info('Deploying pipeline to Dagster...');

      const response = await fetch(`/api/pipelines/${id}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deployment_id: generatedCode.deployment_id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Failed to deploy pipeline');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Deployment failed');
      }

      toast.success('Pipeline deployed successfully!');
      console.log('Deployment result:', result);

      // Reload pipeline to show active status
      loadPipeline();
    } catch (error) {
      console.error('Error deploying pipeline:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to deploy pipeline');
    } finally {
      setDeploying(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this pipeline?')) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/pipelines/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete pipeline');
      toast.success('Pipeline deleted successfully');
      router.push('/dashboard/pipelines');
    } catch (error) {
      console.error('Error deleting pipeline:', error);
      toast.error('Failed to delete pipeline');
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold">Pipeline not found</h2>
        <Link href="/dashboard/pipelines">
          <Button className="mt-4">Back to Pipelines</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/dashboard/pipelines">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Pipelines
          </Button>
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">{pipeline.name}</h1>
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
            </div>
            {pipeline.description && (
              <p className="mt-2 text-gray-600">{pipeline.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Configuration Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {pipeline.provider && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Provider</div>
              <div className="font-medium text-sm">{pipeline.provider.name}</div>
            </div>
          )}
          {pipeline.template && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Template</div>
              <div className="font-medium text-sm">{pipeline.template.name}</div>
            </div>
          )}
          {pipeline.schedule && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Schedule</div>
              <code className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                {pipeline.schedule}
              </code>
            </div>
          )}
          <div>
            <div className="text-xs text-gray-500 mb-1">Status</div>
            <div className="font-medium text-sm">
              {pipeline.is_active ? 'Running' : 'Paused'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Code Generation & Deployment */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="test">Test Run</TabsTrigger>
          <TabsTrigger value="code">Generated Code</TabsTrigger>
          <TabsTrigger value="deploy">Deployment</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Details</CardTitle>
              <CardDescription>
                Configuration and metadata for this pipeline
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Pipeline ID</h4>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded block">
                  {pipeline.id}
                </code>
              </div>

              {pipeline.config && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Configuration</h4>
                  <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
                    {JSON.stringify(pipeline.config, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Run Tab */}
        <TabsContent value="test" className="space-y-4">
          {!testResults ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Play className="w-16 h-16 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Test Pipeline
                </h3>
                <p className="text-gray-600 text-center mb-6 max-w-md">
                  Test first to preview, then execute to create tables and load data.
                </p>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-2 text-center">Preview Only (no data loaded)</p>
                    <div className="flex gap-2">
                      <Button onClick={() => handleTestRun(5)} disabled={testing} variant="outline">
                        {testing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="mr-2 h-4 w-4" />
                        )}
                        Test with 5 files
                      </Button>
                      <Button onClick={() => handleTestRun(10)} disabled={testing} variant="outline">
                        {testing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="mr-2 h-4 w-4" />
                        )}
                        Test with 10 files
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-2 text-center">Create Table & Load Data</p>
                    <div className="flex gap-2">
                      <Button onClick={() => handleExecute(50)} disabled={testing}>
                        {testing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Database className="mr-2 h-4 w-4" />
                        )}
                        Execute with 50 files
                      </Button>
                      <Button onClick={() => handleExecute(100)} disabled={testing} variant="default">
                        {testing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Database className="mr-2 h-4 w-4" />
                        )}
                        Execute with 100 files
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Test Summary */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Test Results</CardTitle>
                      <CardDescription>
                        Pipeline: {testResults.pipeline_name} → {testResults.entity_name}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTestResults(null)}
                    >
                      Run Another Test
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-900">
                        {testResults.execution_summary.total_files}
                      </div>
                      <div className="text-xs text-blue-700 mt-1">Files Processed</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-900">
                        {testResults.execution_summary.processed}
                      </div>
                      <div className="text-xs text-green-700 mt-1">Successful</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-900">
                        {testResults.execution_summary.failed}
                      </div>
                      <div className="text-xs text-red-700 mt-1">Failed</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-900">
                        {testResults.execution_summary.success_rate}
                      </div>
                      <div className="text-xs text-purple-700 mt-1">Success Rate</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sample Data Preview */}
              {testResults.sample_data && testResults.sample_data.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Sample Data (First 5 Rows)</CardTitle>
                    <CardDescription>
                      Preview of mapped data that would be loaded into {testResults.entity_name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            {Object.keys(testResults.sample_data[0]).map((key) => (
                              <th key={key} className="text-left p-2 font-medium text-gray-700">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {testResults.sample_data.map((row: any, idx: number) => (
                            <tr key={idx} className="border-b hover:bg-gray-50">
                              {Object.values(row).map((value: any, vIdx: number) => (
                                <td key={vIdx} className="p-2 text-gray-600">
                                  {value === null ? (
                                    <span className="text-gray-400 italic">null</span>
                                  ) : typeof value === 'object' ? (
                                    <span className="text-xs">
                                      {JSON.stringify(value).substring(0, 50)}...
                                    </span>
                                  ) : (
                                    String(value).substring(0, 100)
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Processed Files List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Processed Files</CardTitle>
                  <CardDescription>
                    Detailed results for each file
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {testResults.processed_files.map((file: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 rounded border ${
                          file.status === 'SUCCESS'
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {file.status === 'SUCCESS' ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                            <span className="text-sm font-medium">{file.filename}</span>
                          </div>
                          <Badge
                            variant={file.status === 'SUCCESS' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {file.status}
                          </Badge>
                        </div>
                        {file.error && (
                          <p className="text-xs text-red-600 mt-2">{file.error}</p>
                        )}
                        {file.extraction_method && (
                          <p className="text-xs text-gray-500 mt-1">
                            Method: {file.extraction_method}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Generated Code Tab */}
        <TabsContent value="code" className="space-y-4">
          {!generatedCode ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Code2 className="w-16 h-16 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Generate Pipeline Code
                </h3>
                <p className="text-gray-600 text-center mb-6 max-w-md">
                  Generate Dagster pipeline code based on your entity model and template configuration.
                </p>
                <Button onClick={handleGenerateCode} disabled={generating}>
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Code2 className="mr-2 h-4 w-4" />
                      Generate Code
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Python Pipeline Code */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Pipeline Code (Python)</CardTitle>
                      <CardDescription>
                        Dagster assets for data extraction and loading
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generatedCode.pipeline_code, 'Pipeline code')}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded overflow-x-auto max-h-[500px]">
                    {generatedCode.pipeline_code}
                  </pre>
                </CardContent>
              </Card>

              {/* Entity SQL */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Entity Table SQL</CardTitle>
                      <CardDescription>
                        Database schema for target entity
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generatedCode.entity_sql, 'Entity SQL')}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded overflow-x-auto">
                    {generatedCode.entity_sql}
                  </pre>
                </CardContent>
              </Card>

              {/* Dagster Config */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Dagster Configuration</CardTitle>
                      <CardDescription>
                        Workspace configuration for deployment
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generatedCode.dagster_config, 'Dagster config')}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded overflow-x-auto">
                    {generatedCode.dagster_config}
                  </pre>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Deployment Tab */}
        <TabsContent value="deploy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deploy to Dagster</CardTitle>
              <CardDescription>
                Deploy this pipeline to start automated processing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!generatedCode ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Generate pipeline code first before deploying
                  </AlertDescription>
                </Alert>
              ) : pipeline.is_active ? (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Pipeline is active and deployed
                    </AlertDescription>
                  </Alert>

                  {generatedCode.deployment_id && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Deployment ID:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {generatedCode.deployment_id}
                        </code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pipeline Name:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {generatedCode.pipeline_name}
                        </code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Version:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          v{generatedCode.version}
                        </code>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>Deployment Process:</strong>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Format Python code with Black</li>
                        <li>Validate Python syntax</li>
                        <li>Deploy to Dagster (Cloud or Local)</li>
                        <li>Activate pipeline monitoring</li>
                      </ul>
                    </AlertDescription>
                  </Alert>

                  <div className="text-xs text-gray-600 space-y-1">
                    <div><strong>Environment Variables:</strong></div>
                    <div>• DAGSTER_DEPLOYMENT_MODE: {process.env.DAGSTER_DEPLOYMENT_MODE || 'local'}</div>
                    <div>• Black formatter: {process.env.PATH?.includes('black') ? 'Available' : 'Install with: pip install black'}</div>
                    <div>• Python3: {process.env.PATH?.includes('python') ? 'Available' : 'Required'}</div>
                  </div>

                  <Button onClick={handleDeploy} disabled={deploying} size="lg" className="w-full">
                    {deploying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deploying...
                      </>
                    ) : (
                      <>
                        <Rocket className="mr-2 h-4 w-4" />
                        Deploy Pipeline
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
