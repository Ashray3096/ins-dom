'use client';

/**
 * Entity Pipeline Tab Component
 *
 * Displays pipeline configuration and run controls
 * - Shows source, template, target info
 * - Run Pipeline button
 * - Run history
 * - Real-time status updates
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, CheckCircle, XCircle, Clock, FileText, Database as DatabaseIcon, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface Entity {
  id: string;
  name: string;
  display_name: string;
  entity_type: string;
  template_id: string | null;
  table_status: string;
  table_created_at: string | null;
}

interface Template {
  id: string;
  name: string;
  artifact_type: string;
  extraction_method: string;
  fields: string[];
}

interface Source {
  id: string;
  name: string;
  source_type: string;
  configuration: any;
}

interface PipelineRun {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  records_processed: number;
  records_loaded: number;
  error_message: string | null;
}

export function EntityPipelineTab({ entityId }: { entityId: string }) {
  const [entity, setEntity] = useState<Entity | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [fileCount, setFileCount] = useState<number>(0);
  const [lastRunResult, setLastRunResult] = useState<any>(null);
  const [transformReady, setTransformReady] = useState(false);
  const [dependencies, setDependencies] = useState<any[]>([]);

  useEffect(() => {
    loadEntityData();
  }, [entityId]);

  const loadEntityData = async () => {
    try {
      const supabase = createClient();

      // Get entity with template
      const { data: entityData, error: entityError } = await supabase
        .from('entities')
        .select('*')
        .eq('id', entityId)
        .single();

      if (entityError) throw entityError;
      setEntity(entityData);

      // Get template if linked
      if (entityData.template_id) {
        const { data: templateData, error: templateError } = await supabase
          .from('templates')
          .select('*')
          .eq('id', entityData.template_id)
          .single();

        if (templateError) throw templateError;
        setTemplate(templateData);

        // Get source from template's sample artifact
        if (templateData.sample_artifact_id) {
          const { data: artifactData } = await supabase
            .from('artifacts')
            .select('source_id')
            .eq('id', templateData.sample_artifact_id)
            .single();

          if (artifactData?.source_id) {
            const { data: sourceData } = await supabase
              .from('sources')
              .select('*')
              .eq('id', artifactData.source_id)
              .single();

            if (sourceData) {
              setSource(sourceData);

              // Get file count from source
              const { count } = await supabase
                .from('artifacts')
                .select('*', { count: 'exact', head: true })
                .eq('source_id', sourceData.id)
                .eq('extraction_status', 'completed');

              setFileCount(count || 0);
            }
          }
        }
      }

      // Load pipeline runs (TODO: when we have pipeline_runs table)
      // For now, show empty
      setRuns([]);

      // Check transformation readiness for REFERENCE/MASTER entities
      if (entityData.entity_type !== 'INTERIM') {
        checkTransformReadiness();
      }

    } catch (error) {
      console.error('Error loading entity data:', error);
      toast.error('Failed to load entity data');
    } finally {
      setLoading(false);
    }
  };

  const checkTransformReadiness = async () => {
    try {
      const response = await fetch(`/api/entities/${entityId}/run-transform`);
      if (response.ok) {
        const result = await response.json();
        setTransformReady(result.ready);
        setDependencies(result.dependencies || []);
      }
    } catch (error) {
      console.error('Error checking transform readiness:', error);
    }
  };

  const handleRunPipeline = async () => {
    if (!entity || !template || !source) {
      toast.error('Missing entity, template, or source configuration');
      return;
    }

    if (entity.table_status !== 'created') {
      toast.error('Please create the table first in the Schema tab');
      return;
    }

    try {
      setRunning(true);

      const response = await fetch(`/api/entities/${entityId}/run-pipeline`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to run pipeline');
      }

      // Save result to display
      setLastRunResult(result);

      toast.success(
        `✅ Data loaded! ${result.records_loaded || 0} records from ${result.artifacts_processed || 0} files`
      );

      // Reload data to update file count if needed
      setTimeout(() => {
        loadEntityData();
      }, 1000);

    } catch (error) {
      console.error('Error running pipeline:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to run pipeline');
    } finally {
      setRunning(false);
    }
  };

  const handleRunTransform = async () => {
    if (!entity) return;

    if (entity.table_status !== 'created') {
      toast.error('Please create the table first in the Schema tab');
      return;
    }

    try {
      setRunning(true);

      const response = await fetch(`/api/entities/${entityId}/run-transform`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to run transformation');
      }

      // Save result to display
      setLastRunResult({
        records_loaded: result.rowsInserted,
        duration_ms: result.duration_ms
      });

      toast.success(
        `✅ Transformation complete! ${result.rowsInserted || 0} records loaded in ${result.duration_ms}ms`
      );

      // Reload data
      setTimeout(() => {
        loadEntityData();
      }, 1000);

    } catch (error) {
      console.error('Error running transformation:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to run transformation');
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!entity) {
    return <div className="text-center text-gray-500 py-12">Entity not found</div>;
  }

  const tableCreated = entity.table_status === 'created';

  return (
    <div className="space-y-6">
      {/* Pipeline Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Configuration</CardTitle>
          <CardDescription>
            Extract data from your source using the template and load it into this entity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Source Info */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-sm text-gray-900">Source</div>
              {source ? (
                <>
                  <div className="text-sm text-gray-700 mt-1">{source.name}</div>
                  <div className="text-xs text-gray-500">
                    Type: {source.source_type === 's3_bucket' ? 'S3 Bucket' : 'Manual Upload'}
                  </div>
                  {source.source_type === 's3_bucket' && (
                    <div className="text-xs text-gray-500">
                      s3://{source.configuration.bucket}/{source.configuration.prefix || ''}
                    </div>
                  )}
                  <div className="text-xs text-gray-600 mt-1">
                    <strong>{fileCount}</strong> file{fileCount !== 1 ? 's' : ''} available
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500 mt-1">No source configured</div>
              )}
            </div>
          </div>

          {/* Template Info */}
          <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <DatabaseIcon className="w-5 h-5 text-purple-600 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-sm text-gray-900">Template</div>
              {template ? (
                <>
                  <div className="text-sm text-gray-700 mt-1">{template.name}</div>
                  <div className="text-xs text-gray-500">
                    Method: {template.extraction_method} extraction
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    <strong>{template.fields?.length || 0}</strong> field{template.fields?.length !== 1 ? 's' : ''} mapped
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500 mt-1">No template linked</div>
              )}
            </div>
          </div>

          {/* Target Info */}
          <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
            <DatabaseIcon className="w-5 h-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-sm text-gray-900">Target Entity</div>
              <div className="text-sm text-gray-700 mt-1">{entity.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {entity.entity_type}
                </Badge>
                {tableCreated ? (
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Table Created
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300 text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    Table Pending
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Dependencies for REFERENCE/MASTER entities */}
          {entity.entity_type !== 'INTERIM' && dependencies.length > 0 && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="font-medium text-sm text-gray-900 mb-2">Source Dependencies</div>
              {dependencies.map((dep: any) => (
                <div key={dep.entity} className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-700">{dep.entity}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{dep.rowCount} records</span>
                    {dep.hasData ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Load Data Button - for INTERIM entities */}
          {entity.entity_type === 'INTERIM' && (
            <div className="pt-4">
              <Button
                onClick={handleRunPipeline}
                disabled={running || !tableCreated || !source || !template}
                className="w-full h-12 text-lg bg-green-600 hover:bg-green-700"
                size="lg"
              >
                {running ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Loading Data...
                  </>
                ) : (
                  <>
                    <DatabaseIcon className="mr-2 h-5 w-5" />
                    Load Data
                  </>
                )}
              </Button>
              {!tableCreated && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Create the table in the Schema tab first
                </p>
              )}
            </div>
          )}

          {/* Transform Data Button - for REFERENCE/MASTER entities */}
          {entity.entity_type !== 'INTERIM' && (
            <div className="pt-4">
              <Button
                onClick={handleRunTransform}
                disabled={running || !tableCreated || !transformReady}
                className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                {running ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Transforming Data...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-5 w-5" />
                    Transform Data
                  </>
                )}
              </Button>
              {!tableCreated && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Create the table in the Schema tab first
                </p>
              )}
              {tableCreated && !transformReady && (
                <p className="text-xs text-red-500 mt-2 text-center">
                  Source dependencies need data first
                </p>
              )}
            </div>
          )}

          {/* Last Run Result */}
          {lastRunResult && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-900">Data Loaded Successfully</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-gray-600 text-xs">Files Processed</div>
                  <div className="font-semibold text-green-700">{lastRunResult.artifacts_processed || 0}</div>
                </div>
                <div>
                  <div className="text-gray-600 text-xs">Records Extracted</div>
                  <div className="font-semibold text-green-700">{lastRunResult.records_extracted || 0}</div>
                </div>
                <div>
                  <div className="text-gray-600 text-xs">Records Loaded</div>
                  <div className="font-semibold text-green-700">{lastRunResult.records_loaded || 0}</div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3"
                onClick={() => window.location.reload()}
              >
                View Data in Data Tab →
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Lineage Visualization - for REFERENCE/MASTER entities */}
      {entity.entity_type !== 'INTERIM' && dependencies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Data Lineage</CardTitle>
            <CardDescription>Data flow from source to target entity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-6">
              {dependencies.map((dep, idx) => (
                <div key={dep.entity} className="flex items-center">
                  {/* Source Entity */}
                  <div className="flex flex-col items-center">
                    <div className="px-6 py-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                      <div className="flex items-center gap-2">
                        <DatabaseIcon className="w-5 h-5 text-yellow-600" />
                        <div>
                          <div className="font-medium text-sm">{dep.entity}</div>
                          <div className="text-xs text-gray-500">{dep.rowCount} records</div>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="mt-2 text-xs bg-yellow-100">
                      SOURCE
                    </Badge>
                  </div>

                  {/* Animated Arrow */}
                  <div className="mx-6 flex flex-col items-center">
                    <div className="relative">
                      <ArrowRight className={`w-12 h-12 text-blue-500 ${running ? 'animate-pulse' : ''}`} />
                      {running && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                        </div>
                      )}
                    </div>
                    <div className={`text-xs mt-1 font-medium ${running ? 'text-blue-600' : 'text-gray-400'}`}>
                      {running ? 'Transforming...' : 'Ready'}
                    </div>
                  </div>

                  {/* Target Entity */}
                  {idx === dependencies.length - 1 && (
                    <div className="flex flex-col items-center">
                      <div className={`px-6 py-4 border-2 rounded-lg ${
                        entity.entity_type === 'REFERENCE'
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-green-50 border-green-300'
                      }`}>
                        <div className="flex items-center gap-2">
                          <DatabaseIcon className={`w-5 h-5 ${
                            entity.entity_type === 'REFERENCE' ? 'text-blue-600' : 'text-green-600'
                          }`} />
                          <div>
                            <div className="font-medium text-sm">{entity.name}</div>
                            <div className="text-xs text-gray-500">Target</div>
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className={`mt-2 text-xs ${
                        entity.entity_type === 'REFERENCE'
                          ? 'bg-blue-100'
                          : 'bg-green-100'
                      }`}>
                        {entity.entity_type}
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Run History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Run History</CardTitle>
          <CardDescription>Past pipeline executions</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm">No pipeline runs yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Click "Run Pipeline" to start extracting data
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    {run.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : run.status === 'failed' ? (
                      <XCircle className="w-5 h-5 text-red-600" />
                    ) : (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    )}
                    <div>
                      <div className="text-sm font-medium">
                        {new Date(run.started_at).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {run.records_loaded} records loaded
                      </div>
                    </div>
                  </div>
                  <Badge variant={run.status === 'completed' ? 'default' : 'secondary'}>
                    {run.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
