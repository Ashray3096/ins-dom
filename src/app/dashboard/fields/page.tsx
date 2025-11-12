'use client';

/**
 * Field Library Management Page
 * Browse, search, create, and edit reusable field definitions
 */

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, RefreshCw, Edit, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { FieldLibrary, CreateFieldLibraryInput, FieldType, FieldClassification } from '@/types/field-library';

const FIELD_TYPES: FieldType[] = ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'EMAIL', 'URL', 'PHONE', 'JSON'];
const CLASSIFICATIONS: FieldClassification[] = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PII', 'PCI', 'PHI'];
const CATEGORIES = ['date', 'vendor', 'product', 'sales', 'volume', 'classification', 'location', 'comparison', 'financial', 'generic'];

export default function FieldsPage() {
  const [fields, setFields] = useState<FieldLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Create/Edit modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldLibrary | null>(null);
  const [formData, setFormData] = useState<CreateFieldLibraryInput>({
    name: '',
    label: '',
    description: '',
    field_type: 'TEXT',
    category: '',
    classification: undefined,
    tags: [],
    transformations: [],
    validation_rules: {},
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchFields();
  }, []);

  const fetchFields = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filterCategory && filterCategory !== 'all') queryParams.set('category', filterCategory);
      if (filterType && filterType !== 'all') queryParams.set('field_type', filterType);
      if (searchTerm) queryParams.set('search', searchTerm);

      const response = await fetch(`/api/fields?${queryParams.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch fields');
      }

      setFields(result.data || []);
    } catch (error) {
      console.error('Error fetching fields:', error);
      toast.error('Failed to load fields');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchFields();
  };

  const handleCreateField = async () => {
    try {
      setSaving(true);

      // Validate required fields
      if (!formData.name || !formData.label || !formData.field_type) {
        toast.error('Please fill in required fields: name, label, type');
        return;
      }

      const response = await fetch('/api/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create field');
      }

      toast.success('Field created successfully!');
      setIsCreateModalOpen(false);
      resetForm();
      fetchFields();
    } catch (error) {
      console.error('Error creating field:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create field');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = async (id: string) => {
    if (!confirm('Are you sure you want to delete this field?')) return;

    try {
      const response = await fetch(`/api/fields/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete field');
      }

      toast.success(result.message);
      fetchFields();
    } catch (error) {
      console.error('Error deleting field:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete field');
    }
  };

  const openCreateModal = () => {
    resetForm();
    setEditingField(null);
    setIsCreateModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      label: '',
      description: '',
      field_type: 'TEXT',
      category: '',
      classification: undefined,
      tags: [],
      transformations: [],
      validation_rules: {},
    });
  };

  const getFieldTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      TEXT: 'bg-blue-100 text-blue-700',
      NUMBER: 'bg-green-100 text-green-700',
      DATE: 'bg-purple-100 text-purple-700',
      BOOLEAN: 'bg-orange-100 text-orange-700',
      EMAIL: 'bg-pink-100 text-pink-700',
      URL: 'bg-cyan-100 text-cyan-700',
      PHONE: 'bg-indigo-100 text-indigo-700',
      JSON: 'bg-gray-100 text-gray-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const getClassificationBadgeColor = (classification?: string) => {
    if (!classification) return 'bg-gray-100 text-gray-700';
    const colors: Record<string, string> = {
      PUBLIC: 'bg-green-100 text-green-700',
      INTERNAL: 'bg-blue-100 text-blue-700',
      CONFIDENTIAL: 'bg-orange-100 text-orange-700',
      PII: 'bg-red-100 text-red-700',
      PCI: 'bg-red-100 text-red-700',
      PHI: 'bg-red-100 text-red-700',
    };
    return colors[classification] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Field Library</h1>
          <p className="text-gray-500 mt-1">
            Reusable field definitions for templates and entities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchFields} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            Create Field
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search fields by name, label, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {FIELD_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={loading}>
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Fields List */}
      <Card>
        <CardHeader>
          <CardTitle>Fields ({fields.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : fields.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No fields found</p>
              <p className="text-sm text-gray-400 mt-2">
                Create your first field to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field) => (
                <div
                  key={field.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-mono font-medium text-gray-900">
                        {field.name}
                      </h3>
                      <Badge className={getFieldTypeBadgeColor(field.field_type)}>
                        {field.field_type}
                      </Badge>
                      {field.classification && (
                        <Badge className={getClassificationBadgeColor(field.classification)}>
                          {field.classification}
                        </Badge>
                      )}
                      {field.category && (
                        <Badge variant="outline">
                          {field.category}
                        </Badge>
                      )}
                      {field.is_deprecated && (
                        <Badge variant="destructive">
                          Deprecated
                        </Badge>
                      )}
                      {field.usage_count !== undefined && field.usage_count > 0 && (
                        <Badge variant="secondary">
                          Used in {field.usage_count} templates
                        </Badge>
                      )}
                    </div>

                    <div className="text-sm text-gray-600 mb-2">
                      {field.label}
                    </div>

                    {field.description && (
                      <div className="text-sm text-gray-500 mb-2">
                        {field.description}
                      </div>
                    )}

                    {field.transformations && field.transformations.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-medium">Transformations:</span>
                        {field.transformations.join(', ')}
                      </div>
                    )}

                    {field.tags && field.tags.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        {field.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteField(field.id)}
                      disabled={field.usage_count && field.usage_count > 0}
                      title={field.usage_count && field.usage_count > 0 ? 'Cannot delete - field is in use' : 'Delete field'}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Field Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Field</DialogTitle>
            <DialogDescription>
              Add a new reusable field definition to the library
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div>
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="vendor_name (snake_case)"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Use snake_case (lowercase with underscores)
              </p>
            </div>

            {/* Label */}
            <div>
              <Label htmlFor="label">
                Label <span className="text-red-500">*</span>
              </Label>
              <Input
                id="label"
                placeholder="Vendor Name"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Company/vendor supplying products"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Field Type */}
            <div>
              <Label htmlFor="field_type">
                Field Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.field_type}
                onValueChange={(value) => setFormData({ ...formData, field_type: value as FieldType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category || 'none'}
                onValueChange={(value) => setFormData({ ...formData, category: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Classification */}
            <div>
              <Label htmlFor="classification">Classification</Label>
              <Select
                value={formData.classification || 'none'}
                onValueChange={(value) => setFormData({ ...formData, classification: value === 'none' ? undefined : value as FieldClassification })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select classification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No classification</SelectItem>
                  {CLASSIFICATIONS.map((cls) => (
                    <SelectItem key={cls} value={cls}>
                      {cls}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                placeholder="vendor, supplier, company"
                onChange={(e) => setFormData({
                  ...formData,
                  tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                })}
              />
            </div>

            {/* Transformations */}
            <div>
              <Label htmlFor="transformations">Transformations (comma-separated)</Label>
              <Input
                id="transformations"
                placeholder="trim, uppercase"
                onChange={(e) => setFormData({
                  ...formData,
                  transformations: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Common: trim, uppercase, lowercase, remove_commas, parse_number
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateField} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
