'use client';

/**
 * Create New Pipeline Page
 *
 * Form to configure and create a new data pipeline
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Plus, Wand2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface Provider {
  id: string;
  name: string;
  type: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  fields: any;
  selectors?: {
    isMultiEntity?: boolean;
    targetEntities?: string[];
    tablePatterns?: any[];
  };
}

interface Entity {
  id: string;
  name: string;
  display_name: string;
  entity_type: 'INTERIM' | 'REFERENCE' | 'MASTER';
  template_id: string | null;
}

interface Source {
  id: string;
  name: string;
  source_type: string;
  provider_id: string;
}

export default function NewPipelinePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [sources, setSources] = useState<Source[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    provider_id: '',
    template_id: '',
    target_entity_id: '',
    source_ids: [] as string[],
    schedule: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const supabase = createClient();

      // Load providers
      const { data: providersData, error: providersError } = await supabase
        .from('providers')
        .select('*')
        .order('name');

      if (providersError) {
        console.error('Error loading providers:', providersError);
      }

      // Load templates (include selectors for multi-entity detection)
      const { data: templatesData, error: templatesError } = await supabase
        .from('templates')
        .select('id, name, description, fields, selectors')
        .eq('status', 'ACTIVE')
        .order('name');

      if (templatesError) {
        console.error('Error loading templates:', templatesError);
      }

      // Load entities (no status filter - load all)
      const { data: entitiesData, error: entitiesError } = await supabase
        .from('entities')
        .select('*')
        .order('display_name');

      if (entitiesError) {
        console.error('Error loading entities:', entitiesError);
      } else {
        console.log('Loaded entities:', entitiesData);
      }

      // Load sources
      const { data: sourcesData, error: sourcesError } = await supabase
        .from('sources')
        .select('*')
        .order('name');

      if (sourcesError) {
        console.error('Error loading sources:', sourcesError);
      }

      setProviders(providersData || []);
      setTemplates(templatesData || []);
      setEntities(entitiesData || []);
      setSources(sourcesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load form data');
    }
  };

  const handleProviderChange = (providerId: string) => {
    setFormData({
      ...formData,
      provider_id: providerId,
      template_id: '',
      target_entity_id: '',
      source_ids: [],
    });
  };

  const handleTemplateChange = (templateId: string) => {
    const selectedTemplate = templates.find(t => t.id === templateId);

    // Check if this is a multi-entity template
    const isMultiEntity = selectedTemplate?.selectors?.isMultiEntity === true;
    const targetEntities = selectedTemplate?.selectors?.targetEntities || [];

    if (isMultiEntity) {
      // Multi-entity template - clear single entity selection
      setFormData({
        ...formData,
        template_id: templateId,
        target_entity_id: '', // Clear single entity
      });
    } else {
      // Single-entity template - auto-select linked entity
      const linkedEntity = entities.find(e => e.template_id === templateId);
      if (linkedEntity) {
        setFormData({
          ...formData,
          template_id: templateId,
          target_entity_id: linkedEntity.id,
        });
      } else {
        setFormData({ ...formData, template_id: templateId });
      }
    }
  };

  const handleSourceToggle = (sourceId: string, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        source_ids: [...formData.source_ids, sourceId],
      });
    } else {
      setFormData({
        ...formData,
        source_ids: formData.source_ids.filter(id => id !== sourceId),
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if this is a multi-entity template
    const selectedTemplate = templates.find(t => t.id === formData.template_id);
    const isMultiEntity = selectedTemplate?.selectors?.isMultiEntity === true;
    const targetEntities = selectedTemplate?.selectors?.targetEntities || [];

    // Validation
    if (!formData.name) {
      toast.error('Please fill in pipeline name');
      return;
    }

    if (!isMultiEntity && !formData.target_entity_id) {
      toast.error('Please select a target entity');
      return;
    }

    try {
      setLoading(true);

      const requestBody: any = {
        name: formData.name,
        description: formData.description || null,
        provider_id: formData.provider_id || null,
        template_id: formData.template_id || null,
        schedule: formData.schedule || null,
        config: {
          source_ids: formData.source_ids,
        },
      };

      // Add multi-entity or single-entity fields
      if (isMultiEntity) {
        requestBody.is_multi_entity = true;
        requestBody.target_entities = targetEntities;
      } else {
        requestBody.is_multi_entity = false;
        requestBody.config.target_entity_id = formData.target_entity_id;
      }

      console.log('Submitting pipeline creation request:', requestBody);

      // Call API route
      const response = await fetch('/api/pipelines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to create pipeline');
      }

      const data = await response.json();

      toast.success('Pipeline created successfully!');
      router.push(`/dashboard/pipelines/${data.id}`);
    } catch (error) {
      console.error('Error creating pipeline:', error);
      toast.error('Failed to create pipeline');
    } finally {
      setLoading(false);
    }
  };

  const selectedEntity = entities.find(e => e.id === formData.target_entity_id);
  const providerSources = sources.filter(s => s.provider_id === formData.provider_id);

  // Check if selected template is multi-entity
  const selectedTemplate = templates.find(t => t.id === formData.template_id);
  const isMultiEntityTemplate = selectedTemplate?.selectors?.isMultiEntity === true;
  const targetEntitiesList = selectedTemplate?.selectors?.targetEntities || [];

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
        <h1 className="text-3xl font-bold text-gray-900">Create Pipeline</h1>
        <p className="mt-2 text-gray-600">
          Configure a new data extraction pipeline
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Name and describe your pipeline
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">
                Pipeline Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., TTB Certificate Processing"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this pipeline does..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Provider & Template */}
        <Card>
          <CardHeader>
            <CardTitle>Data Source Configuration</CardTitle>
            <CardDescription>
              Select the provider and template for extraction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={formData.provider_id}
                onValueChange={handleProviderChange}
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select a provider..." />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name} ({provider.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="template">Extraction Template</Label>
              <Select
                value={formData.template_id}
                onValueChange={handleTemplateChange}
              >
                <SelectTrigger id="template">
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-gray-500">No template (AI only)</span>
                  </SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.template_id && formData.template_id !== 'none' && (
                <p className="text-xs text-gray-500 mt-1">
                  Template-based extraction will be tried first, with AI fallback
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Target Entity */}
        <Card>
          <CardHeader>
            <CardTitle>
              Target {isMultiEntityTemplate ? 'Entities' : 'Entity'}
              {!isMultiEntityTemplate && <span className="text-red-500"> *</span>}
            </CardTitle>
            <CardDescription>
              {isMultiEntityTemplate
                ? 'Multi-entity template will load data into multiple tables'
                : 'Select where extracted data will be loaded'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isMultiEntityTemplate ? (
              // Multi-entity template view
              <div>
                <Alert>
                  <Wand2 className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    This template will extract data into <strong>{targetEntitiesList.length} entities</strong> automatically
                  </AlertDescription>
                </Alert>
                <div className="mt-4 space-y-2">
                  <Label className="text-sm font-medium">Target Entities:</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {targetEntitiesList.map((entityName: string) => (
                      <div
                        key={entityName}
                        className="p-2 border rounded bg-gray-50 text-sm flex items-center gap-2"
                      >
                        <Badge variant="secondary" className="bg-yellow-200 text-yellow-900 text-xs">
                          INTERIM
                        </Badge>
                        <span className="truncate">{entityName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              // Single-entity template view
              <>
                <div>
                  <Label htmlFor="entity">Entity</Label>
                  <Select
                    value={formData.target_entity_id}
                    onValueChange={(value) => setFormData({ ...formData, target_entity_id: value })}
                  >
                    <SelectTrigger id="entity">
                      <SelectValue placeholder="Select an entity..." />
                    </SelectTrigger>
                    <SelectContent>
                      {entities.map((entity) => (
                        <SelectItem key={entity.id} value={entity.id}>
                          <div className="flex items-center gap-2">
                            <span>{entity.display_name}</span>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${
                                entity.entity_type === 'INTERIM'
                                  ? 'bg-yellow-200 text-yellow-900'
                                  : entity.entity_type === 'REFERENCE'
                                  ? 'bg-blue-200 text-blue-900'
                                  : 'bg-green-200 text-green-900'
                              }`}
                            >
                              {entity.entity_type}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedEntity && (
                  <Alert>
                    <Wand2 className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Pipeline will load data into <strong>{selectedEntity.name}</strong> table
                      {selectedEntity.template_id && ' using linked template field mappings'}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Sources */}
        {formData.provider_id && (
          <Card>
            <CardHeader>
              <CardTitle>Data Sources</CardTitle>
              <CardDescription>
                Select which sources to process
              </CardDescription>
            </CardHeader>
            <CardContent>
              {providerSources.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    No sources found for this provider. Create a source first.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {providerSources.map((source) => (
                    <div
                      key={source.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <Checkbox
                        id={`source-${source.id}`}
                        checked={formData.source_ids.includes(source.id)}
                        onCheckedChange={(checked) =>
                          handleSourceToggle(source.id, checked as boolean)
                        }
                      />
                      <label
                        htmlFor={`source-${source.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{source.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {source.source_type}
                          </Badge>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule (Optional)</CardTitle>
            <CardDescription>
              Configure automated runs using cron syntax
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="schedule">Cron Expression</Label>
              <Input
                id="schedule"
                placeholder="e.g., 0 */6 * * * (every 6 hours)"
                value={formData.schedule}
                onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty for manual runs only. Examples: <code>0 0 * * *</code> (daily at midnight),{' '}
                <code>0 */4 * * *</code> (every 4 hours)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard/pipelines')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Pipeline
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
