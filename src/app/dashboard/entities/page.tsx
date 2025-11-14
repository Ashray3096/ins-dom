'use client';

/**
 * Entity Modeling Page
 *
 * Define and manage entity schemas for the three-tier data architecture
 * INTERIM (raw) → REFERENCE (dimensions) → MASTER (facts)
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  RefreshCw,
  FileText,
  Database,
  Layers,
  Edit,
  Trash2,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EntityForm } from '@/components/entities/entity-form';
import { getEntityTypeBadgeColor } from '@/components/entities/entity-type-selector';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface Entity {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  entity_type: 'INTERIM' | 'REFERENCE' | 'MASTER';
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  template_id: string | null;
  created_at: string;
  updated_at: string;
}

const ENTITY_TYPE_ICONS = {
  INTERIM: FileText,
  REFERENCE: Database,
  MASTER: Layers,
};

export default function EntitiesPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchEntities();
  }, []);

  const fetchEntities = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntities(data || []);
    } catch (error) {
      console.error('Error fetching entities:', error);
      toast.error('Failed to load entities');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormOpen(true);
  };

  const handleSubmit = async (formData: any) => {
    try {
      setIsSubmitting(true);
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase.from('entities').insert({
        name: formData.name,
        display_name: formData.display_name,
        description: formData.description || null,
        entity_type: formData.entity_type,
        template_id: formData.template_id || null,
        metadata: formData.metadata || {},
        status: 'DRAFT',
        created_by: user.id,
      });

      if (error) throw error;

      toast.success('Entity created successfully!');
      setFormOpen(false);
      fetchEntities();
    } catch (error) {
      console.error('Error creating entity:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create entity');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This will also drop the physical table. This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/entities/${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete entity');
      }

      toast.success(result.table_dropped
        ? 'Entity and table deleted successfully'
        : 'Entity deleted successfully'
      );
      fetchEntities();
    } catch (error) {
      console.error('Error deleting entity:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete entity');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Entity Modeling</h1>
          <p className="mt-2 text-gray-600">
            Define entity schemas for your three-tier data architecture
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchEntities} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Entity
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-yellow-700" />
                <CardTitle className="text-base text-yellow-900">INTERIM</CardTitle>
              </div>
              <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                {entities.filter(e => e.entity_type === 'INTERIM').length}
              </Badge>
            </div>
            <CardDescription>Raw extracted data</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-yellow-800">
              1:1 with source documents. Matches extraction templates directly with minimal transformation.
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-700" />
                <CardTitle className="text-base text-blue-900">REFERENCE</CardTitle>
              </div>
              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                {entities.filter(e => e.entity_type === 'REFERENCE').length}
              </Badge>
            </div>
            <CardDescription>Lookup/dimension tables</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-800">
              Deduplicated, standardized data with unique constraints and slow-changing dimensions.
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-green-700" />
                <CardTitle className="text-base text-green-900">MASTER</CardTitle>
              </div>
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                {entities.filter(e => e.entity_type === 'MASTER').length}
              </Badge>
            </div>
            <CardDescription>Core business fact tables</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-800">
              Business logic with foreign keys, validation rules, and aggregations optimized for analytics.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Entities List */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </CardContent>
        </Card>
      ) : entities.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <Layers className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No entities yet
            </h3>
            <p className="text-gray-600 text-center mb-6 max-w-md">
              Create your first entity to define the structure of your data warehouse.
              Start with INTERIM entities that match your extraction templates.
            </p>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Entity
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {entities.map((entity) => {
            const Icon = ENTITY_TYPE_ICONS[entity.entity_type];
            return (
              <Card key={entity.id}>
                <CardContent className="flex items-center justify-between p-6">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-3 rounded-lg ${
                      entity.entity_type === 'INTERIM' ? 'bg-yellow-100' :
                      entity.entity_type === 'REFERENCE' ? 'bg-blue-100' :
                      'bg-green-100'
                    }`}>
                      <Icon className={`w-6 h-6 ${
                        entity.entity_type === 'INTERIM' ? 'text-yellow-700' :
                        entity.entity_type === 'REFERENCE' ? 'text-blue-700' :
                        'text-green-700'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-gray-900">{entity.display_name}</h3>
                        <Badge variant="secondary" className={getEntityTypeBadgeColor(entity.entity_type)}>
                          {entity.entity_type}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {entity.status}
                        </Badge>
                      </div>
                      <code className="text-sm text-gray-600 font-mono">{entity.name}</code>
                      {entity.description && (
                        <p className="text-sm text-gray-600 mt-2">{entity.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/entities/${entity.id}`}>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(entity.id, entity.display_name)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Entity Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Entity</DialogTitle>
            <DialogDescription>
              Define a new entity for your data warehouse. Choose the appropriate type
              based on its role in your data pipeline.
            </DialogDescription>
          </DialogHeader>
          <EntityForm
            onSubmit={handleSubmit}
            onCancel={() => setFormOpen(false)}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
