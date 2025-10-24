'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { EntityType } from '@/types/database';

export default function NewEntityPage() {
  const { user } = useAuth();
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState<EntityType>('interim');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      setError('Entity name is required');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('entities')
        .insert([
          {
            project_id: projectId,
            name: name.trim(),
            entity_type: entityType,
            description: description.trim() || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Redirect to entity detail page
      router.push(`/projects/${projectId}/entities/${data.id}`);
    } catch (err) {
      console.error('Error creating entity:', err);
      setError(err instanceof Error ? err.message : 'Failed to create entity');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href={`/projects/${projectId}/entities`}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Entities
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Create New Entity</CardTitle>
            <CardDescription>
              Define a new data entity for your extraction pipeline
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {/* Entity Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Entity Name *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="e.g., Product, Customer, Order"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
                <p className="text-xs text-gray-500">
                  Use PascalCase for entity names (e.g., ProductDetails, CustomerInfo)
                </p>
              </div>

              {/* Entity Type */}
              <div className="space-y-2">
                <Label htmlFor="entityType">Entity Type *</Label>
                <select
                  id="entityType"
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value as EntityType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="interim">Interim - Temporary/staging data</option>
                  <option value="reference">Reference - Lookup/dimension tables</option>
                  <option value="master">Master - Core business entities</option>
                </select>
                <div className="mt-3 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-700 font-medium mb-2">
                    {entityType === 'interim' && 'Interim Entity'}
                    {entityType === 'reference' && 'Reference Entity'}
                    {entityType === 'master' && 'Master Entity'}
                  </p>
                  <p className="text-xs text-gray-600">
                    {entityType === 'interim' &&
                      'Temporary data structures used during extraction and transformation. Data flows through interim entities before reaching master entities.'}
                    {entityType === 'reference' &&
                      'Lookup tables and dimensional data. Contains relatively static reference data like categories, statuses, or geographical information.'}
                    {entityType === 'master' &&
                      'Core business entities that represent your main data objects. Examples: Products, Customers, Orders, Transactions.'}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the purpose of this entity..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                />
              </div>
            </CardContent>
            <div className="px-6 pb-6 flex gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Entity'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/projects/${projectId}/entities`)}
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
