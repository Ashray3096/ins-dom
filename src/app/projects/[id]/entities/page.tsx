'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus, Database, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type { Project, Entity } from '@/types/database';

export default function EntitiesPage() {
  const { user } = useAuth();
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && projectId) {
      loadProject();
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

  async function loadEntities() {
    try {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntities(data || []);
    } catch (error) {
      console.error('Error loading entities:', error);
    }
  }

  async function handleDeleteEntity(entityId: string, entityName: string) {
    if (!confirm(`Are you sure you want to delete entity "${entityName}"?`)) return;

    try {
      const { error } = await supabase
        .from('entities')
        .delete()
        .eq('id', entityId);

      if (error) throw error;
      await loadEntities();
    } catch (error) {
      console.error('Error deleting entity:', error);
      alert('Failed to delete entity');
    }
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

  function getEntityTypeIcon(type: string) {
    // You can customize icons per type if desired
    return <Database className="h-8 w-8 text-gray-500" />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading entities...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Data Entities</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage entities for {project.name}
              </p>
            </div>
            <Button onClick={() => router.push(`/projects/${projectId}/entities/new`)}>
              <Plus className="h-4 w-4 mr-2" />
              New Entity
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Entity Type Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Interim Entities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {entities.filter(e => e.entity_type === 'interim').length}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Temporary/staging data structures
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Reference Entities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {entities.filter(e => e.entity_type === 'reference').length}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Lookup/dimension tables
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Master Entities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {entities.filter(e => e.entity_type === 'master').length}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Core business entities
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Entities List */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            All Entities ({entities.length})
          </h2>
        </div>

        {entities.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Database className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No entities created yet
              </h3>
              <p className="text-gray-600 text-center mb-6">
                Create your first entity to start building your data model
              </p>
              <Button onClick={() => router.push(`/projects/${projectId}/entities/new`)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Entity
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {entities.map((entity) => (
              <Card
                key={entity.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/projects/${projectId}/entities/${entity.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{entity.name}</CardTitle>
                      <span
                        className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium border ${getEntityTypeColor(
                          entity.entity_type
                        )}`}
                      >
                        {entity.entity_type.toUpperCase()}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEntity(entity.id, entity.name);
                      }}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {entity.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {entity.description}
                    </p>
                  )}
                  <div className="text-xs text-gray-500">
                    Created {new Date(entity.created_at).toLocaleDateString()}
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
