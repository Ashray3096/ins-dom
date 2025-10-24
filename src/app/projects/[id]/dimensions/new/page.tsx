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
import type { Entity, DimensionType, SCDType } from '@/types/database';

export default function NewDimensionPage() {
  const { user } = useAuth();
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [entities, setEntities] = useState<Entity[]>([]);
  const [name, setName] = useState('');
  const [dimensionType, setDimensionType] = useState<DimensionType>('other');
  const [entityId, setEntityId] = useState('');
  const [scdType, setScdType] = useState<SCDType>(1);
  const [attributes, setAttributes] = useState<string[]>(['']);
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

  function handleAddAttribute() {
    setAttributes([...attributes, '']);
  }

  function handleRemoveAttribute(index: number) {
    setAttributes(attributes.filter((_, i) => i !== index));
  }

  function handleAttributeChange(index: number, value: string) {
    const newAttributes = [...attributes];
    newAttributes[index] = value;
    setAttributes(newAttributes);
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
      setError('Dimension name is required');
      setLoading(false);
      return;
    }

    // Filter out empty attributes
    const validAttributes = attributes.filter(attr => attr.trim() !== '');

    if (validAttributes.length === 0) {
      setError('At least one attribute is required');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('dimensions')
        .insert([
          {
            project_id: projectId,
            name: name.trim(),
            dimension_type: dimensionType,
            entity_id: entityId || null,
            scd_type: scdType,
            attributes: validAttributes,
            description: description.trim() || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Redirect to dimensions list
      router.push(`/projects/${projectId}/dimensions`);
    } catch (err) {
      console.error('Error creating dimension:', err);
      setError(err instanceof Error ? err.message : 'Failed to create dimension');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href={`/projects/${projectId}/dimensions`}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dimensions
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Create New Dimension</CardTitle>
            <CardDescription>
              Define a new dimensional attribute for your data warehouse
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {/* Dimension Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Dimension Name *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="e.g., DateDimension, GeographyDimension"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
                <p className="text-xs text-gray-500">
                  Use PascalCase for dimension names (e.g., TimeDimension, CustomerDimension)
                </p>
              </div>

              {/* Dimension Type */}
              <div className="space-y-2">
                <Label htmlFor="dimensionType">Dimension Type *</Label>
                <select
                  id="dimensionType"
                  value={dimensionType}
                  onChange={(e) => setDimensionType(e.target.value as DimensionType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="time">Time - Temporal dimensions (dates, months, years)</option>
                  <option value="geography">Geography - Spatial dimensions (location, region)</option>
                  <option value="product">Product - Product catalog dimensions</option>
                  <option value="customer">Customer - Customer/user dimensions</option>
                  <option value="other">Other - Custom dimensions</option>
                </select>
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
                  Link this dimension to an existing entity
                </p>
              </div>

              {/* SCD Type */}
              <div className="space-y-2">
                <Label htmlFor="scdType">Slowly Changing Dimension Type *</Label>
                <select
                  id="scdType"
                  value={scdType}
                  onChange={(e) => setScdType(Number(e.target.value) as SCDType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value={0}>Type 0 - No changes allowed (fixed reference)</option>
                  <option value={1}>Type 1 - Overwrite (no history)</option>
                  <option value={2}>Type 2 - Add new row (full history)</option>
                  <option value={3}>Type 3 - Add new column (limited history)</option>
                </select>
                <div className="mt-3 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-700 font-medium mb-2">
                    {scdType === 0 && 'SCD Type 0 - No Changes Allowed'}
                    {scdType === 1 && 'SCD Type 1 - Overwrite'}
                    {scdType === 2 && 'SCD Type 2 - Add New Row'}
                    {scdType === 3 && 'SCD Type 3 - Add New Column'}
                  </p>
                  <p className="text-xs text-gray-600">
                    {scdType === 0 &&
                      'Dimension values never change. Used for fixed reference data like date dimensions.'}
                    {scdType === 1 &&
                      'New values overwrite old values. No historical data is preserved. Simplest approach.'}
                    {scdType === 2 &&
                      'New values create new rows with versioning. Full historical data preserved with effective dates.'}
                    {scdType === 3 &&
                      'New values stored in additional columns. Limited history (current + previous value).'}
                  </p>
                </div>
              </div>

              {/* Attributes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Dimension Attributes *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddAttribute}
                    disabled={loading}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Attribute
                  </Button>
                </div>
                <div className="space-y-2">
                  {attributes.map((attribute, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="text"
                        placeholder={`e.g., ${
                          dimensionType === 'time'
                            ? 'year, month, day'
                            : dimensionType === 'geography'
                            ? 'country, state, city'
                            : dimensionType === 'product'
                            ? 'category, brand, name'
                            : 'attribute_name'
                        }`}
                        value={attribute}
                        onChange={(e) => handleAttributeChange(index, e.target.value)}
                        disabled={loading}
                      />
                      {attributes.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAttribute(index)}
                          disabled={loading}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  Define the attributes that make up this dimension
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the purpose of this dimension..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                />
              </div>
            </CardContent>
            <div className="px-6 pb-6 flex gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Dimension'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/projects/${projectId}/dimensions`)}
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
