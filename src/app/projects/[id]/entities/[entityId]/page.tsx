'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus, Trash2, Save, Key, Link as LinkIcon, GitBranch } from 'lucide-react';
import Link from 'next/link';
import type { Entity, EntityField, Relationship, RelationshipType, Dimension, Fact } from '@/types/database';

interface FieldFormData {
  id?: string;
  name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  default_value: string;
}

export default function EntityDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const projectId = params.id as string;
  const entityId = params.entityId as string;
  const router = useRouter();

  const [entity, setEntity] = useState<Entity | null>(null);
  const [fields, setFields] = useState<EntityField[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [allEntities, setAllEntities] = useState<Entity[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddField, setShowAddField] = useState(false);
  const [showAddRelationship, setShowAddRelationship] = useState(false);
  const [fieldForm, setFieldForm] = useState<FieldFormData>({
    name: '',
    data_type: 'text',
    is_nullable: true,
    is_primary_key: false,
    is_foreign_key: false,
    default_value: '',
  });
  const [relationshipForm, setRelationshipForm] = useState({
    to_entity_id: '',
    relationship_type: '1:N' as RelationshipType,
    relationship_name: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && entityId && projectId) {
      loadEntity();
      loadFields();
      loadRelationships();
      loadAllEntities();
      loadDimensions();
      loadFacts();
    }
  }, [user, entityId, projectId]);

  async function loadEntity() {
    try {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('id', entityId)
        .single();

      if (error) throw error;
      setEntity(data);
    } catch (error) {
      console.error('Error loading entity:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadFields() {
    try {
      const { data, error } = await supabase
        .from('entity_fields')
        .select('*')
        .eq('entity_id', entityId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setFields(data || []);
    } catch (error) {
      console.error('Error loading fields:', error);
    }
  }

  async function handleAddField() {
    setError('');
    setSaving(true);

    if (!fieldForm.name.trim()) {
      setError('Field name is required');
      setSaving(false);
      return;
    }

    try {
      const { error } = await supabase.from('entity_fields').insert([
        {
          entity_id: entityId,
          name: fieldForm.name.trim(),
          data_type: fieldForm.data_type,
          is_nullable: fieldForm.is_nullable,
          is_primary_key: fieldForm.is_primary_key,
          is_foreign_key: fieldForm.is_foreign_key,
          default_value: fieldForm.default_value.trim() || null,
          constraints: {},
        },
      ]);

      if (error) throw error;

      // Reset form
      setFieldForm({
        name: '',
        data_type: 'text',
        is_nullable: true,
        is_primary_key: false,
        is_foreign_key: false,
        default_value: '',
      });
      setShowAddField(false);
      await loadFields();
    } catch (err) {
      console.error('Error adding field:', err);
      setError(err instanceof Error ? err.message : 'Failed to add field');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteField(fieldId: string, fieldName: string) {
    if (!confirm(`Are you sure you want to delete field "${fieldName}"?`)) return;

    try {
      const { error } = await supabase
        .from('entity_fields')
        .delete()
        .eq('id', fieldId);

      if (error) throw error;
      await loadFields();
    } catch (error) {
      console.error('Error deleting field:', error);
      alert('Failed to delete field');
    }
  }

  async function loadRelationships() {
    try {
      const { data, error } = await supabase
        .from('relationships')
        .select('*')
        .or(`from_entity_id.eq.${entityId},to_entity_id.eq.${entityId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRelationships(data || []);
    } catch (error) {
      console.error('Error loading relationships:', error);
    }
  }

  async function loadAllEntities() {
    try {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('project_id', projectId)
        .order('name', { ascending: true });

      if (error) throw error;
      setAllEntities(data || []);
    } catch (error) {
      console.error('Error loading entities:', error);
    }
  }

  async function loadDimensions() {
    try {
      const { data, error } = await supabase
        .from('dimensions')
        .select('*')
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDimensions(data || []);
    } catch (error) {
      console.error('Error loading dimensions:', error);
    }
  }

  async function loadFacts() {
    try {
      const { data, error } = await supabase
        .from('facts')
        .select('*')
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFacts(data || []);
    } catch (error) {
      console.error('Error loading facts:', error);
    }
  }

  async function handleAddRelationship() {
    setError('');
    setSaving(true);

    if (!relationshipForm.to_entity_id) {
      setError('Please select a target entity');
      setSaving(false);
      return;
    }

    try {
      const { error } = await supabase.from('relationships').insert([
        {
          project_id: projectId,
          from_entity_id: entityId,
          to_entity_id: relationshipForm.to_entity_id,
          relationship_type: relationshipForm.relationship_type,
          relationship_name: relationshipForm.relationship_name.trim() || null,
        },
      ]);

      if (error) throw error;

      // Reset form
      setRelationshipForm({
        to_entity_id: '',
        relationship_type: '1:N',
        relationship_name: '',
      });
      setShowAddRelationship(false);
      await loadRelationships();
    } catch (err) {
      console.error('Error adding relationship:', err);
      setError(err instanceof Error ? err.message : 'Failed to add relationship');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRelationship(relationshipId: string) {
    if (!confirm('Are you sure you want to delete this relationship?')) return;

    try {
      const { error } = await supabase
        .from('relationships')
        .delete()
        .eq('id', relationshipId);

      if (error) throw error;
      await loadRelationships();
    } catch (error) {
      console.error('Error deleting relationship:', error);
      alert('Failed to delete relationship');
    }
  }

  function getEntityName(entityId: string): string {
    const entity = allEntities.find(e => e.id === entityId);
    return entity ? entity.name : 'Unknown';
  }

  function getEntityTypeColor(type: string) {
    switch (type) {
      case 'interim':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'reference':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'master':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading entity...</p>
        </div>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Entity not found</h2>
          <Link href={`/projects/${projectId}/entities`}>
            <Button>Back to Entities</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href={`/projects/${projectId}/entities`}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Entities
          </Link>
          <div className="flex items-center justify-between mt-2">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{entity.name}</h1>
                <span
                  className={`inline-block px-3 py-1 rounded text-sm font-medium border ${getEntityTypeColor(
                    entity.entity_type
                  )}`}
                >
                  {entity.entity_type.toUpperCase()}
                </span>
              </div>
              {entity.description && (
                <p className="text-sm text-gray-600 mt-1">{entity.description}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Fields Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Entity Fields</CardTitle>
                <CardDescription>
                  Define the structure and properties of this entity
                </CardDescription>
              </div>
              {!showAddField && (
                <Button onClick={() => setShowAddField(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Field
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Add Field Form */}
            {showAddField && (
              <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h3 className="font-semibold text-gray-900 mb-4">Add New Field</h3>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fieldName">Field Name *</Label>
                    <Input
                      id="fieldName"
                      value={fieldForm.name}
                      onChange={(e) =>
                        setFieldForm({ ...fieldForm, name: e.target.value })
                      }
                      placeholder="e.g., id, name, email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dataType">Data Type</Label>
                    <select
                      id="dataType"
                      value={fieldForm.data_type}
                      onChange={(e) =>
                        setFieldForm({ ...fieldForm, data_type: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="integer">Integer</option>
                      <option value="decimal">Decimal</option>
                      <option value="boolean">Boolean</option>
                      <option value="date">Date</option>
                      <option value="datetime">DateTime</option>
                      <option value="timestamp">Timestamp</option>
                      <option value="uuid">UUID</option>
                      <option value="json">JSON</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultValue">Default Value</Label>
                    <Input
                      id="defaultValue"
                      value={fieldForm.default_value}
                      onChange={(e) =>
                        setFieldForm({ ...fieldForm, default_value: e.target.value })
                      }
                      placeholder="Optional default value"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>Properties</Label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={fieldForm.is_nullable}
                          onChange={(e) =>
                            setFieldForm({ ...fieldForm, is_nullable: e.target.checked })
                          }
                          className="mr-2"
                        />
                        <span className="text-sm">Nullable</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={fieldForm.is_primary_key}
                          onChange={(e) =>
                            setFieldForm({ ...fieldForm, is_primary_key: e.target.checked })
                          }
                          className="mr-2"
                        />
                        <span className="text-sm">Primary Key</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={fieldForm.is_foreign_key}
                          onChange={(e) =>
                            setFieldForm({ ...fieldForm, is_foreign_key: e.target.checked })
                          }
                          className="mr-2"
                        />
                        <span className="text-sm">Foreign Key</span>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <Button onClick={handleAddField} disabled={saving}>
                    {saving ? 'Adding...' : 'Add Field'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddField(false);
                      setError('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Fields List */}
            {fields.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-600 mb-4">No fields defined yet</p>
                {!showAddField && (
                  <Button onClick={() => setShowAddField(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Field
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field) => (
                  <div
                    key={field.id}
                    className="p-4 border border-gray-200 rounded-lg bg-white hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-gray-900">{field.name}</h4>
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            {field.data_type}
                          </span>
                          {field.is_primary_key && (
                            <span className="inline-flex items-center text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              <Key className="h-3 w-3 mr-1" />
                              PK
                            </span>
                          )}
                          {field.is_foreign_key && (
                            <span className="inline-flex items-center text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                              <LinkIcon className="h-3 w-3 mr-1" />
                              FK
                            </span>
                          )}
                          {!field.is_nullable && (
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                              NOT NULL
                            </span>
                          )}
                        </div>
                        {field.default_value && (
                          <p className="text-sm text-gray-600">
                            Default: <code className="bg-gray-100 px-1 py-0.5 rounded">{field.default_value}</code>
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteField(field.id, field.name)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Relationships Section */}
        <Card className="mt-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Relationships</CardTitle>
                <CardDescription>
                  Define relationships between this entity and other entities
                </CardDescription>
              </div>
              {!showAddRelationship && (
                <Button onClick={() => setShowAddRelationship(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Relationship
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Add Relationship Form */}
            {showAddRelationship && (
              <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h3 className="font-semibold text-gray-900 mb-4">Add New Relationship</h3>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="toEntity">Target Entity *</Label>
                    <select
                      id="toEntity"
                      value={relationshipForm.to_entity_id}
                      onChange={(e) =>
                        setRelationshipForm({ ...relationshipForm, to_entity_id: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select an entity...</option>
                      {allEntities
                        .filter(e => e.id !== entityId)
                        .map(e => (
                          <option key={e.id} value={e.id}>
                            {e.name} ({e.entity_type})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="relationshipType">Relationship Type</Label>
                    <select
                      id="relationshipType"
                      value={relationshipForm.relationship_type}
                      onChange={(e) =>
                        setRelationshipForm({
                          ...relationshipForm,
                          relationship_type: e.target.value as RelationshipType,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="1:1">One-to-One (1:1)</option>
                      <option value="1:N">One-to-Many (1:N)</option>
                      <option value="N:M">Many-to-Many (N:M)</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="relationshipName">Relationship Name (Optional)</Label>
                    <Input
                      id="relationshipName"
                      value={relationshipForm.relationship_name}
                      onChange={(e) =>
                        setRelationshipForm({ ...relationshipForm, relationship_name: e.target.value })
                      }
                      placeholder="e.g., has_orders, belongs_to"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <Button onClick={handleAddRelationship} disabled={saving}>
                    {saving ? 'Adding...' : 'Add Relationship'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddRelationship(false);
                      setError('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Relationships List */}
            {relationships.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <GitBranch className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No relationships defined yet</p>
                {!showAddRelationship && (
                  <Button onClick={() => setShowAddRelationship(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Relationship
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {relationships.map((rel) => {
                  const isOutgoing = rel.from_entity_id === entityId;
                  const otherEntityId = isOutgoing ? rel.to_entity_id : rel.from_entity_id;
                  const otherEntityName = getEntityName(otherEntityId);

                  return (
                    <div
                      key={rel.id}
                      className="p-4 border border-gray-200 rounded-lg bg-white hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <GitBranch className="h-4 w-4 text-gray-500" />
                            <span className="font-semibold text-gray-900">
                              {isOutgoing ? entity?.name : otherEntityName}
                            </span>
                            <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono">
                              {rel.relationship_type}
                            </span>
                            <span className="font-semibold text-gray-900">
                              {isOutgoing ? otherEntityName : entity?.name}
                            </span>
                          </div>
                          {rel.relationship_name && (
                            <p className="text-sm text-gray-600 ml-6">
                              Name: <span className="font-medium">{rel.relationship_name}</span>
                            </p>
                          )}
                          <p className="text-xs text-gray-500 ml-6">
                            {isOutgoing ? 'Outgoing relationship' : 'Incoming relationship'}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRelationship(rel.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Linked Dimensions & Facts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          {/* Linked Dimensions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Linked Dimensions</CardTitle>
                  <CardDescription>
                    Dimensions linked to this entity
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/projects/${projectId}/dimensions`)}
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dimensions.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-3">
                    No dimensions linked to this entity
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/projects/${projectId}/dimensions/new`)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Dimension
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {dimensions.map((dimension) => (
                    <div
                      key={dimension.id}
                      className="p-3 border border-gray-200 rounded-lg bg-white hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => router.push(`/projects/${projectId}/dimensions/${dimension.id}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 text-sm">
                            {dimension.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                              {dimension.dimension_type}
                            </span>
                            <span className="text-xs text-gray-500">
                              SCD Type {dimension.scd_type}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {(dimension.attributes as string[]).length} attributes
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {dimensions.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => router.push(`/projects/${projectId}/dimensions`)}
                    >
                      View All Dimensions
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linked Facts */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Linked Facts</CardTitle>
                  <CardDescription>
                    Fact tables linked to this entity
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/projects/${projectId}/facts`)}
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {facts.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-3">
                    No facts linked to this entity
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/projects/${projectId}/facts/new`)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Fact
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {facts.map((fact) => (
                    <div
                      key={fact.id}
                      className="p-3 border border-gray-200 rounded-lg bg-white hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => router.push(`/projects/${projectId}/facts/${fact.id}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 text-sm">
                            {fact.name}
                          </h4>
                          {fact.grain && (
                            <p className="text-xs text-gray-600 mt-1">
                              Grain: {fact.grain}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {Object.keys(fact.measures).length} measures
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {facts.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => router.push(`/projects/${projectId}/facts`)}
                    >
                      View All Facts
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
