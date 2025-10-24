'use client';

/**
 * Template Form Component
 *
 * Form for creating and editing extraction templates
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { Template, TemplateStatus } from '@/types/templates';

interface TemplateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: Template;
  onSuccess: () => void;
}

interface FormData {
  name: string;
  description?: string;
  provider_id?: string;
  prompt: string;
  status: TemplateStatus;
}

interface Provider {
  id: string;
  name: string;
}

const TEMPLATE_STATUSES: { value: TemplateStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export function TemplateForm({
  open,
  onOpenChange,
  template,
  onSuccess,
}: TemplateFormProps) {
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const isEdit = !!template;

  const form = useForm<FormData>({
    defaultValues: {
      name: template?.name || '',
      description: template?.description || '',
      provider_id: template?.provider_id || '',
      prompt: template?.prompt || '',
      status: template?.status || 'DRAFT',
    },
  });

  // Fetch providers on mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoadingProviders(true);
        const response = await fetch('/api/providers');
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch providers');
        }

        setProviders(result.data || []);
      } catch (error) {
        console.error('Error fetching providers:', error);
        toast.error('Failed to load providers');
      } finally {
        setLoadingProviders(false);
      }
    };

    if (open) {
      fetchProviders();
    }
  }, [open]);

  // Reset form when template changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        name: template?.name || '',
        description: template?.description || '',
        provider_id: template?.provider_id || '',
        prompt: template?.prompt || '',
        status: template?.status || 'DRAFT',
      });
    }
  }, [open, template, form]);

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);

      // Prepare data - fields are required but we'll use empty array as default for now
      const requestData = {
        ...data,
        fields: template?.fields || [],
      };

      const url = isEdit ? `/api/templates/${template.id}` : '/api/templates';
      const method = isEdit ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save template');
      }

      toast.success(isEdit ? 'Template updated successfully' : 'Template created successfully');
      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Template' : 'Create Template'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update template information'
              : 'Create a new extraction template for reusable prompts'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: 'Name is required' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., NABCA Distilled Spirits Extractor" {...field} />
                  </FormControl>
                  <FormDescription>
                    A descriptive name for this template
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="provider_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider (Optional)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={loadingProviders}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingProviders ? "Loading..." : "Select a provider"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {providers.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Associate this template with a specific provider
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              rules={{ required: 'Status is required' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select template status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TEMPLATE_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Draft templates can be tested, active ones are ready for use
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prompt"
              rules={{ required: 'Prompt is required' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Extraction Prompt</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the AI prompt for extracting data from documents..."
                      className="resize-none font-mono text-sm"
                      rows={8}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The prompt that will be sent to the AI to extract data
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional description of this template..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Additional details about what this template extracts (optional)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
