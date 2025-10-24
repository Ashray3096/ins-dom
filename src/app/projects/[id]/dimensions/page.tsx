'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus, Box, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type { Project, Dimension, Entity } from '@/types/database';

export default function DimensionsPage() {
  const { user } = useAuth();
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && projectId) {
      loadProject();
      loadDimensions();
      loadEntities();
    }
  }, [user, projectId]);

  async function loadProject() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadDimensions() {
    try {
      const { data, error } = await supabase
        .from('dimensions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDimensions(data || []);
    } catch (error) {
      console.error('Error loading dimensions:', error);
    }
  }

  async function loadEntities() {
    try {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('project_id', projectId)
        .order('name', { ascending: true });

      if (error) throw error;
      setEntities(data || []);
    } catch (error) {
      console.error('Error loading entities:', error);
    }
  }

  async function handleDeleteDimension(dimensionId: string, dimensionName: string) {
    if (!confirm(`Are you sure you want to delete dimension "${dimensionName}"?`)) return;

    try {
      const { error } = await supabase
        .from('dimensions')
        .delete()
        .eq('id', dimensionId);

      if (error) throw error;
      await loadDimensions();
    } catch (error) {
      console.error('Error deleting dimension:', error);
      alert('Failed to delete dimension');
    }
  }

  function getDimensionTypeColor(type: string) {
    switch (type) {
      case 'time':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'geography':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'product':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'customer':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'other':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  function getSCDTypeLabel(scdType: number) {
    switch (scdType) {
      case 0:
        return 'SCD Type 0 - No changes allowed';
      case 1:
        return 'SCD Type 1 - Overwrite';
      case 2:
        return 'SCD Type 2 - Add new row';
      case 3:
        return 'SCD Type 3 - Add new column';
      default:
        return `SCD Type ${scdType}`;
    }
  }

  function getEntityName(entityId: string | null) {
    if (!entityId) return 'No entity linked';
    const entity = entities.find((e) => e.id === entityId);
    return entity ? entity.name : 'Unknown entity';
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dimensions...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Project not found</h2>
          <Link href="/dashboard">
            <Button>Back to Dashboard</Button>
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
            href={`/projects/${projectId}`}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Project
          </Link>
          <div className="flex items-center justify-between mt-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dimensions</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage dimensional attributes for {project.name}
              </p>
            </div>
            <Button onClick={() => router.push(`/projects/${projectId}/dimensions/new`)}>
              <Plus className="h-4 w-4 mr-2" />
              New Dimension
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dimension Type Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dimensions.filter(d => d.dimension_type === 'time').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Geography</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dimensions.filter(d => d.dimension_type === 'geography').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Product</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dimensions.filter(d => d.dimension_type === 'product').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dimensions.filter(d => d.dimension_type === 'customer').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Other</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dimensions.filter(d => d.dimension_type === 'other').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dimensions List */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            All Dimensions ({dimensions.length})
          </h2>
        </div>

        {dimensions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Box className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No dimensions created yet
              </h3>
              <p className="text-gray-600 text-center mb-6">
                Create your first dimension to add dimensional modeling to your data
              </p>
              <Button onClick={() => router.push(`/projects/${projectId}/dimensions/new`)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Dimension
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dimensions.map((dimension) => (
              <Card
                key={dimension.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/projects/${projectId}/dimensions/${dimension.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{dimension.name}</CardTitle>
                      <span
                        className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium border ${getDimensionTypeColor(
                          dimension.dimension_type
                        )}`}
                      >
                        {dimension.dimension_type.toUpperCase()}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDimension(dimension.id, dimension.name);
                      }}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-semibold text-gray-700">Entity:</span>
                      <span className="ml-2 text-gray-600">
                        {getEntityName(dimension.entity_id)}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-gray-700">SCD Type:</span>
                      <span className="ml-2 text-gray-600">
                        Type {dimension.scd_type}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-gray-700">Attributes:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(dimension.attributes as string[]).slice(0, 5).map((attr, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800"
                          >
                            {attr}
                          </span>
                        ))}
                        {(dimension.attributes as string[]).length > 5 && (
                          <span className="text-xs text-gray-500">
                            +{(dimension.attributes as string[]).length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Created {new Date(dimension.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
