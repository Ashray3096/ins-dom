'use client';

/**
 * Provider Form Component
 *
 * Form for creating and editing providers
 */

import { useState } from 'react';
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
import type { Provider, ProviderType, ProviderCadence } from '@/types/providers';

interface ProviderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider?: Provider;
  onSuccess: () => void;
}

interface FormData {
  name: string;
  type: ProviderType;
  cadence: ProviderCadence;
  description?: string;
}

const PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: 'NABCA', label: 'NABCA' },
  { value: 'TTB', label: 'TTB' },
  { value: 'CUSTOM', label: 'Custom' },
];

const PROVIDER_CADENCES: { value: ProviderCadence; label: string }[] = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'ADHOC', label: 'Ad-hoc' },
];

export function ProviderForm({
  open,
  onOpenChange,
  provider,
  onSuccess,
}: ProviderFormProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!provider;

  const form = useForm<FormData>({
    defaultValues: {
      name: provider?.name || '',
      type: provider?.type || 'CUSTOM',
      cadence: provider?.cadence || 'MONTHLY',
      description: provider?.description || '',
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);

      const url = isEdit ? `/api/providers/${provider.id}` : '/api/providers';
      const method = isEdit ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save provider');
      }

      toast.success(isEdit ? 'Provider updated successfully' : 'Provider created successfully');
      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error saving provider:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save provider');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Provider' : 'Create Provider'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update provider information'
              : 'Add a new data provider to organize your sources'}
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
                    <Input placeholder="e.g., NABCA Distilled Spirits" {...field} />
                  </FormControl>
                  <FormDescription>
                    A descriptive name for this provider
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              rules={{ required: 'Type is required' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PROVIDER_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The type of data provider
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cadence"
              rules={{ required: 'Cadence is required' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cadence</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select update frequency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PROVIDER_CADENCES.map((cadence) => (
                        <SelectItem key={cadence.value} value={cadence.value}>
                          {cadence.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    How often this provider is updated
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
                      placeholder="Optional description of this provider..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Additional details about this provider (optional)
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
                {loading ? 'Saving...' : isEdit ? 'Update Provider' : 'Create Provider'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
