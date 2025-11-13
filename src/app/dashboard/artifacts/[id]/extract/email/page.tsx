'use client';

/**
 * Email Extraction Page
 *
 * AI-powered field extraction from emails with user prompts
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { EmailVisualSelector } from '@/components/template-builder/email-visual-selector';
import { TemplateSaveModal } from '@/components/template-builder/template-save-modal';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Artifact } from '@/types/artifacts';

export default function EmailExtractionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingPrompt, setPendingPrompt] = useState<string>('');
  const [pendingFields, setPendingFields] = useState<string[]>([]);
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

  const handleSave = (extractionPrompt: string, fields: string[]) => {
    // Store for modal
    setPendingPrompt(extractionPrompt);
    setPendingFields(fields);
    setShowSaveModal(true);
  };

  const handleModalSave = async (templateName: string, templateDescription: string) => {
    if (!artifact) return;

    try {
      // Save template via API
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          description: templateDescription,
          prompt: pendingPrompt, // Store user's extraction instructions
          fields: pendingFields,
          artifact_type: 'email',
          selectors: {
            extraction_prompt: pendingPrompt, // AI uses this at runtime
          },
          extraction_method: 'email',
          sample_artifact_id: artifact.id,
          status: 'ACTIVE'
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save template');
      }

      toast.success(`Template "${templateName}" saved with ${pendingFields.length} fields!`);
      router.push('/dashboard/artifacts');
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save template');
      throw error;
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
      <EmailVisualSelector
        artifact={artifact}
        onSave={handleSave}
        onCancel={handleCancel}
      />

      <TemplateSaveModal
        open={showSaveModal}
        onClose={() => {
          setShowSaveModal(false);
          setPendingPrompt('');
          setPendingFields([]);
        }}
        onSave={handleModalSave}
        defaultName={`${artifact.original_filename.replace(/\.[^/.]+$/, '')} Template`}
        fieldCount={pendingFields.length}
      />
    </>
  );
}
