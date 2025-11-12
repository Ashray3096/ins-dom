'use client';

/**
 * Entity Detail Page
 *
 * View and edit entity schema using the visual designer
 */

import { use } from 'react';
import { VisualDesigner } from '@/components/entities/visual-designer';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function EntityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div>
        <Link href="/dashboard/entities">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Entities
          </Button>
        </Link>
      </div>

      {/* Visual Designer */}
      <VisualDesigner entityId={id} />
    </div>
  );
}
