'use client';

/**
 * DOM Extraction Page
 *
 * Visual selector for HTML elements using CSS selectors
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { VisualDOMSelector } from '@/components/template-builder/visual-dom-selector';
import type { FieldMapping } from '@/components/template-builder/visual-dom-selector';
import { TemplateSaveModal } from '@/components/template-builder/template-save-modal';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Artifact } from '@/types/artifacts';

export default function DOMExtractionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingFieldMappings, setPendingFieldMappings] = useState<FieldMapping[] | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);

  useEffect(() => {
    const fetchArtifact = async () => {
      try {
        const artifactId = params.id;
        if (!artifactId) return;

        const response = await fetch(`/api/artifacts/${artifactId}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to load artifact');
        }

        setArtifact(result.data);
      } catch (error) {
        console.error('Error fetching artifact:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to load artifact');
        router.push('/dashboard/artifacts');
      } finally {
        setLoading(false);
      }
    };

    fetchArtifact();
  }, [params.id, router]);

  const handleSave = async (fieldMappings: FieldMapping[]) => {
    if (!artifact) return;

    // Store mappings and show modal
    setPendingFieldMappings(fieldMappings);
    setShowSaveModal(true);
  };

  const handleModalSave = async (templateName: string, templateDescription: string) => {
    if (!artifact || !pendingFieldMappings) return;

    try {
      // Build selectors in the expected format
      const fields = pendingFieldMappings.map(m => m.name);
      const selectors: Record<string, any> = {
        fields: {}
      };

      pendingFieldMappings.forEach((mapping) => {
        selectors.fields[mapping.name] = {
          structural: {
            xpath: mapping.xpath,
            cssSelector: mapping.cssSelector,
            sampleValue: mapping.sampleValue,
            elementInfo: mapping.elementInfo
          },
          validation: {
            format: mapping.type === 'number' ? 'numeric' :
                   mapping.type === 'date' ? 'date' :
                   mapping.type === 'boolean' ? 'boolean' : 'text',
            required: mapping.required
          }
        };
      });

      const prompt = templateDescription || `Extract the following fields: ${fields.join(', ')}`;

      // Save template via API
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          description: templateDescription,
          prompt,
          fields,
          artifact_type: 'html',
          selectors,
          extraction_method: 'html',
          sample_artifact_id: artifact.id,
          status: 'ACTIVE'
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save template');
      }

      toast.success(`Template "${templateName}" saved with ${fields.length} fields!`);
      setPendingFieldMappings(null);
      router.push('/dashboard/artifacts');
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save template');
      throw error; // Re-throw to let modal handle loading state
    }
  };

  const handleCancel = () => {
    router.push('/dashboard/artifacts');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!artifact) {
    return null;
  }

  return (
    <>
      <VisualDOMSelector
        artifact={artifact}
        onSave={handleSave}
        onCancel={handleCancel}
      />

      <TemplateSaveModal
        open={showSaveModal}
        onClose={() => {
          setShowSaveModal(false);
          setPendingFieldMappings(null);
        }}
        onSave={handleModalSave}
        defaultName={`${artifact.original_filename.replace(/\.[^/.]+$/, '')} Template`}
        fieldCount={pendingFieldMappings?.length || 0}
      />
    </>
  );
}
