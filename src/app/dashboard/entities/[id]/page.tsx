'use client';

/**
 * Entity Detail Page
 *
 * Tabbed interface for entity management:
 * - Schema: Design entity fields
 * - Pipeline: Run extraction pipeline
 * - Data: View extracted data
 */

import { use, useState } from 'react';
import { VisualDesigner } from '@/components/entities/visual-designer';
import { EntityPipelineTab } from '@/components/entities/entity-pipeline-tab';
import { EntityDataTab } from '@/components/entities/entity-data-tab';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Database, Play, Table } from 'lucide-react';
import Link from 'next/link';

export default function EntityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState('schema');

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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
          <TabsTrigger value="schema" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Schema
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="flex items-center gap-2">
            <Play className="w-4 h-4" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-2">
            <Table className="w-4 h-4" />
            Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schema" className="mt-6">
          <VisualDesigner entityId={id} />
        </TabsContent>

        <TabsContent value="pipeline" className="mt-6">
          <EntityPipelineTab entityId={id} />
        </TabsContent>

        <TabsContent value="data" className="mt-6">
          <EntityDataTab entityId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
