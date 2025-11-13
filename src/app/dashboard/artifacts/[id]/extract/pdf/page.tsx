'use client';

/**
 * PDF Extraction Page
 *
 * Visual selector for PDF regions using bounding boxes
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PDFVisualSelector } from '@/components/template-builder/pdf-visual-selector';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Artifact } from '@/types/artifacts';
import type { PDFFieldMapping } from '@/components/template-builder/textract-rule-builder';

export default function PDFExtractionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleSave = async (fieldMappings: PDFFieldMapping[]) => {
    if (!artifact) return;

    // For now, just navigate back to artifacts
    // TODO: Implement save template logic
    toast.success(`Selected ${fieldMappings.length} fields`);
    router.push('/dashboard/artifacts');
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
    <PDFVisualSelector
      artifact={artifact}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}
