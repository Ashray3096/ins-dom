'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus, X } from 'lucide-react';
import Link from 'next/link';
import type { Entity, AggregationType } from '@/types/database';

interface Measure {
  name: string;
  aggregation: AggregationType;
  description: string;
}

export default function NewFactPage() {
  const { user } = useAuth();
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [entities, setEntities] = useState<Entity[]>([]);
  const [name, setName] = useState('');
  const [entityId, setEntityId] = useState('');
  const [grain, setGrain] = useState('');
  const [measures, setMeasures] = useState<Measure[]>([
    { name: '', aggregation: 'sum', description: '' },
  ]);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && projectId) {
      loadEntities();
    }
  }, [user, projectId]);

  async function loadEntities() {
    try {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('project_id', projectId)
        .order('name', { ascending: true });

      if (error) throw error;
      setEntities(data || []);
    } catch (err) {
      console.error('Error loading entities:', err);
    }
  }

  function handleAddMeasure() {
    setMeasures([...measures, { name: '', aggregation: 'sum', description: '' }]);
  }

  function handleRemoveMeasure(index: number) {
    setMeasures(measures.filter((_, i) => i !== index));
  }

  function handleMeasureChange(index: number, field: keyof Measure, value: string) {
    const newMeasures = [...measures];
    newMeasures[index] = { ...newMeasures[index], [field]: value };
    setMeasures(newMeasures);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!user) {
      setError('You must be logged in');
      setLoading(false);
      return;
    }

    if (!name.trim()) {
      setError('Fact name is required');
      setLoading(false);
      return;
    }

    // Validate measures
    const validMeasures = measures.filter(m => m.name.trim() !== '');

    if (validMeasures.length === 0) {
      setError('At least one measure is required');
      setLoading(false);
      return;
    }

    // Convert measures array to object
    const measuresObject: Record<string, any> = {};
    validMeasures.forEach((measure) => {
      measuresObject[measure.name.trim()] = {
        aggregation: measure.aggregation,
        description: measure.description.trim() || null,
      };
    });

    try {
      const { data, error } = await supabase
        .from('facts')
        .insert([
          {
            project_id: projectId,
            name: name.trim(),
            entity_id: entityId || null,
            grain: grain.trim() || null,
            measures: measuresObject,
            description: description.trim() || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Redirect to facts list
      router.push(`/projects/${projectId}/facts`);
    } catch (err) {
      console.error('Error creating fact:', err);
      setError(err instanceof Error ? err.message : 'Failed to create fact');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href={`/projects/${projectId}/facts`}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Facts
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Create New Fact</CardTitle>
            <CardDescription>
              Define a new fact table to track measurable business events
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {/* Fact Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Fact Name *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="e.g., SalesFact, OrderFact, TransactionFact"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
                <p className="text-xs text-gray-500">
                  Use PascalCase for fact names (e.g., SalesFact, OrderFact)
                </p>
              </div>

              {/* Link to Entity */}
              <div className="space-y-2">
                <Label htmlFor="entity">Link to Entity (Optional)</Label>
                <select
                  id="entity"
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="">No entity linked</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.name} ({entity.entity_type})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Link this fact to an existing entity
                </p>
              </div>

              {/* Grain */}
              <div className="space-y-2">
                <Label htmlFor="grain">Grain (Optional)</Label>
                <Input
                  id="grain"
                  type="text"
                  placeholder="e.g., One row per order line item, One row per transaction"
                  value={grain}
                  onChange={(e) => setGrain(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-gray-500">
                  Describe the level of detail (granularity) of each row in the fact table
                </p>
              </div>

              {/* Measures */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Measures *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddMeasure}
                    disabled={loading}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Measure
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Define the numeric measures that can be aggregated (e.g., revenue, quantity, cost)
                </p>
                <div className="space-y-4">
                  {measures.map((measure, index) => (
                    <Card key={index} className="border-2">
                      <CardContent className="pt-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <h4 className="text-sm font-semibold text-gray-700">
                              Measure {index + 1}
                            </h4>
                            {measures.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveMeasure(index)}
                                disabled={loading}
                                className="text-red-500 hover:text-red-700"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`measure-name-${index}`}>Measure Name *</Label>
                            <Input
                              id={`measure-name-${index}`}
                              type="text"
                              placeholder="e.g., total_revenue, quantity_sold, order_count"
                              value={measure.name}
                              onChange={(e) =>
                                handleMeasureChange(index, 'name', e.target.value)
                              }
                              disabled={loading}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`measure-agg-${index}`}>Aggregation Type *</Label>
                            <select
                              id={`measure-agg-${index}`}
                              value={measure.aggregation}
                              onChange={(e) =>
                                handleMeasureChange(
                                  index,
                                  'aggregation',
                                  e.target.value as AggregationType
                                )
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={loading}
                            >
                              <option value="sum">Sum - Add all values</option>
                              <option value="avg">Average - Mean of values</option>
                              <option value="count">Count - Number of records</option>
                              <option value="min">Minimum - Lowest value</option>
                              <option value="max">Maximum - Highest value</option>
                              <option value="distinct_count">
                                Distinct Count - Unique values
                              </option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`measure-desc-${index}`}>
                              Description (Optional)
                            </Label>
                            <Input
                              id={`measure-desc-${index}`}
                              type="text"
                              placeholder="Describe this measure..."
                              value={measure.description}
                              onChange={(e) =>
                                handleMeasureChange(index, 'description', e.target.value)
                              }
                              disabled={loading}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the purpose of this fact table..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                />
              </div>
            </CardContent>
            <div className="px-6 pb-6 flex gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Fact'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/projects/${projectId}/facts`)}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
