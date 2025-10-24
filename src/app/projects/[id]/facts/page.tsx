'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus, Database, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type { Project, Fact, Entity } from '@/types/database';

export default function FactsPage() {
  const { user } = useAuth();
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && projectId) {
      loadProject();
      loadFacts();
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

  async function loadFacts() {
    try {
      const { data, error } = await supabase
        .from('facts')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFacts(data || []);
    } catch (error) {
      console.error('Error loading facts:', error);
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

  async function handleDeleteFact(factId: string, factName: string) {
    if (!confirm(`Are you sure you want to delete fact "${factName}"?`)) return;

    try {
      const { error } = await supabase
        .from('facts')
        .delete()
        .eq('id', factId);

      if (error) throw error;
      await loadFacts();
    } catch (error) {
      console.error('Error deleting fact:', error);
      alert('Failed to delete fact');
    }
  }

  function getEntityName(entityId: string | null) {
    if (!entityId) return 'No entity linked';
    const entity = entities.find((e) => e.id === entityId);
    return entity ? entity.name : 'Unknown entity';
  }

  function getAggregationLabel(agg: string) {
    const labels: Record<string, string> = {
      sum: 'Sum',
      avg: 'Average',
      count: 'Count',
      min: 'Minimum',
      max: 'Maximum',
      distinct_count: 'Distinct Count',
    };
    return labels[agg] || agg;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading facts...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Facts</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage fact tables and measures for {project.name}
              </p>
            </div>
            <Button onClick={() => router.push(`/projects/${projectId}/facts/new`)}>
              <Plus className="h-4 w-4 mr-2" />
              New Fact
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Facts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{facts.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Measures</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {facts.reduce((sum, fact) => sum + Object.keys(fact.measures).length, 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Linked Entities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(facts.filter(f => f.entity_id).map(f => f.entity_id)).size}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Facts List */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            All Facts ({facts.length})
          </h2>
        </div>

        {facts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Database className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No facts created yet
              </h3>
              <p className="text-gray-600 text-center mb-6">
                Create your first fact table to track measurable business events
              </p>
              <Button onClick={() => router.push(`/projects/${projectId}/facts/new`)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Fact
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {facts.map((fact) => (
              <Card
                key={fact.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/projects/${projectId}/facts/${fact.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{fact.name}</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFact(fact.id, fact.name);
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
                        {getEntityName(fact.entity_id)}
                      </span>
                    </div>
                    {fact.grain && (
                      <div className="text-sm">
                        <span className="font-semibold text-gray-700">Grain:</span>
                        <span className="ml-2 text-gray-600">{fact.grain}</span>
                      </div>
                    )}
                    <div className="text-sm">
                      <span className="font-semibold text-gray-700">Measures:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Object.entries(fact.measures as Record<string, any>)
                          .slice(0, 5)
                          .map(([measureName, measureData]) => (
                            <span
                              key={measureName}
                              className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-800"
                              title={`${measureName}: ${getAggregationLabel(
                                measureData.aggregation
                              )}`}
                            >
                              {measureName}
                            </span>
                          ))}
                        {Object.keys(fact.measures).length > 5 && (
                          <span className="text-xs text-gray-500">
                            +{Object.keys(fact.measures).length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                    {fact.description && (
                      <div className="text-xs text-gray-600 mt-2 line-clamp-2">
                        {fact.description}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
                      Created {new Date(fact.created_at).toLocaleDateString()}
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
