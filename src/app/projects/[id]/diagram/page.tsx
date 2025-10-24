'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, LayoutGrid, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import Link from 'next/link';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Connection,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Project, Entity, Relationship, Dimension, Fact } from '@/types/database';

// Custom node components
import EntityNode from '@/components/diagram/EntityNode';
import DimensionNode from '@/components/diagram/DimensionNode';
import FactNode from '@/components/diagram/FactNode';

const nodeTypes = {
  entity: EntityNode,
  dimension: DimensionNode,
  fact: FactNode,
};

export default function DiagramPage() {
  const { user } = useAuth();
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (user && projectId) {
      loadProject();
      loadData();
    }
  }, [user, projectId]);

  async function loadProject() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Error loading project:', error);
    }
  }

  async function loadData() {
    try {
      // Load all data in parallel
      const [entitiesRes, relationshipsRes, dimensionsRes, factsRes, diagramStateRes] =
        await Promise.all([
          supabase
            .from('entities')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true }),
          supabase
            .from('relationships')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true }),
          supabase
            .from('dimensions')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true }),
          supabase
            .from('facts')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true }),
          supabase
            .from('diagram_states')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single(),
        ]);

      if (entitiesRes.error) throw entitiesRes.error;
      if (relationshipsRes.error) throw relationshipsRes.error;
      if (dimensionsRes.error) throw dimensionsRes.error;
      if (factsRes.error) throw factsRes.error;

      setEntities(entitiesRes.data || []);
      setRelationships(relationshipsRes.data || []);
      setDimensions(dimensionsRes.data || []);
      setFacts(factsRes.data || []);

      // Build diagram from data
      if (diagramStateRes.data) {
        // Load saved diagram state
        const savedState = diagramStateRes.data.state as any;
        setNodes(savedState.nodes || []);
        setEdges(savedState.edges || []);
      } else {
        // Generate initial diagram layout
        generateDiagram(
          entitiesRes.data || [],
          relationshipsRes.data || [],
          dimensionsRes.data || [],
          factsRes.data || []
        );
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function generateDiagram(
    entities: Entity[],
    relationships: Relationship[],
    dimensions: Dimension[],
    facts: Fact[]
  ) {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Create entity nodes
    entities.forEach((entity, index) => {
      newNodes.push({
        id: `entity-${entity.id}`,
        type: 'entity',
        position: { x: 250 + (index % 3) * 350, y: 100 + Math.floor(index / 3) * 250 },
        data: { entity },
      });
    });

    // Create dimension nodes
    dimensions.forEach((dimension, index) => {
      const linkedEntity = dimension.entity_id
        ? `entity-${dimension.entity_id}`
        : null;
      const baseX = linkedEntity
        ? newNodes.find((n) => n.id === linkedEntity)?.position.x || 100
        : 100 + index * 300;
      const baseY = linkedEntity
        ? (newNodes.find((n) => n.id === linkedEntity)?.position.y || 0) - 150
        : 500 + Math.floor(index / 3) * 200;

      newNodes.push({
        id: `dimension-${dimension.id}`,
        type: 'dimension',
        position: { x: baseX, y: baseY },
        data: { dimension },
      });

      // Add edge to linked entity
      if (linkedEntity) {
        newEdges.push({
          id: `dimension-link-${dimension.id}`,
          source: `dimension-${dimension.id}`,
          target: linkedEntity,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#9333ea', strokeWidth: 2, strokeDasharray: '5,5' },
          label: 'describes',
        });
      }
    });

    // Create fact nodes
    facts.forEach((fact, index) => {
      const linkedEntity = fact.entity_id ? `entity-${fact.entity_id}` : null;
      const baseX = linkedEntity
        ? newNodes.find((n) => n.id === linkedEntity)?.position.x || 100
        : 100 + index * 300;
      const baseY = linkedEntity
        ? (newNodes.find((n) => n.id === linkedEntity)?.position.y || 0) + 200
        : 800 + Math.floor(index / 3) * 200;

      newNodes.push({
        id: `fact-${fact.id}`,
        type: 'fact',
        position: { x: baseX, y: baseY },
        data: { fact },
      });

      // Add edge to linked entity
      if (linkedEntity) {
        newEdges.push({
          id: `fact-link-${fact.id}`,
          source: linkedEntity,
          target: `fact-${fact.id}`,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#16a34a', strokeWidth: 2, strokeDasharray: '5,5' },
          label: 'measures',
        });
      }
    });

    // Create relationship edges
    relationships.forEach((rel) => {
      newEdges.push({
        id: `relationship-${rel.id}`,
        source: `entity-${rel.from_entity_id}`,
        target: `entity-${rel.to_entity_id}`,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#3b82f6', strokeWidth: 2 },
        label: rel.relationship_type,
        labelStyle: { fill: '#3b82f6', fontWeight: 600 },
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }

  async function handleAutoLayout() {
    // Regenerate diagram with current data
    generateDiagram(entities, relationships, dimensions, facts);
  }

  async function handleSaveDiagram() {
    setSaving(true);
    try {
      const diagramState = {
        nodes,
        edges,
      };

      // Check if diagram state exists
      const { data: existing } = await supabase
        .from('diagram_states')
        .select('id')
        .eq('project_id', projectId)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('diagram_states')
          .update({
            state: diagramState,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase.from('diagram_states').insert([
          {
            project_id: projectId,
            state: diagramState,
          },
        ]);

        if (error) throw error;
      }

      alert('Diagram saved successfully!');
    } catch (error) {
      console.error('Error saving diagram:', error);
      alert('Failed to save diagram');
    } finally {
      setSaving(false);
    }
  }

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading diagram...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Project not found</h2>
          <Link href="/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/projects/${projectId}`}
                className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Project
              </Link>
              <div className="border-l border-gray-300 h-6"></div>
              <h1 className="text-xl font-bold text-gray-900">
                ER Diagram - {project.name}
              </h1>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleAutoLayout}>
                <LayoutGrid className="h-4 w-4 mr-2" />
                Auto Layout
              </Button>
              <Button onClick={handleSaveDiagram} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Diagram'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Diagram Canvas */}
      <div className="flex-1 bg-gray-50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Controls />
          <MiniMap zoomable pannable />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}
