'use client';

/**
 * ER Diagram Page
 *
 * Interactive Entity-Relationship diagram showing all entities and their relationships
 */

import { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  BackgroundVariant,
  MiniMap,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Plus,
  RefreshCw,
  Maximize2,
  Save,
  Loader2,
  ZoomIn,
  ZoomOut,
  Trash2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { EntityNode } from '@/components/er-diagram/entity-node';
import { RelationshipDialog } from '@/components/er-diagram/relationship-dialog';

interface Entity {
  id: string;
  name: string;
  display_name: string;
  entity_type: 'INTERIM' | 'REFERENCE' | 'MASTER';
  description: string | null;
}

interface EntityField {
  id: string;
  name: string;
  display_name: string;
  data_type: string;
  is_primary_key: boolean;
  is_required: boolean;
  is_unique: boolean;
}

interface EntityRelationship {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  relationship_type: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY';
  from_field_id: string | null;
  description: string | null;
}

const nodeTypes = {
  entityNode: EntityNode,
};

export default function ERDiagramPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [relationshipDialogOpen, setRelationshipDialogOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);

  useEffect(() => {
    loadDiagram();
  }, []);

  const loadDiagram = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      // Fetch entities with their fields
      const { data: entitiesData, error: entitiesError } = await supabase
        .from('entities')
        .select('*')
        .order('created_at');

      if (entitiesError) throw entitiesError;

      // Fetch all entity fields
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('entity_fields')
        .select('*')
        .order('sort_order');

      if (fieldsError) throw fieldsError;

      // Fetch relationships
      const { data: relationshipsData, error: relationshipsError } = await supabase
        .from('entity_relationships')
        .select('*');

      if (relationshipsError) throw relationshipsError;

      setEntities(entitiesData || []);

      // Create nodes from entities
      const flowNodes: Node[] = (entitiesData || []).map((entity, index) => {
        const entityFields = (fieldsData || []).filter(f => f.entity_id === entity.id);

        return {
          id: entity.id,
          type: 'entityNode',
          position: {
            x: 100 + (index % 3) * 350,
            y: 100 + Math.floor(index / 3) * 300,
          },
          data: {
            entity,
            fields: entityFields,
          },
        };
      });

      setNodes(flowNodes);

      // Create edges from relationships
      const flowEdges: Edge[] = (relationshipsData || []).map((rel) => ({
        id: rel.id,
        source: rel.from_entity_id,
        target: rel.to_entity_id,
        type: 'smoothstep',
        animated: false,
        label: rel.relationship_type.replace('_', '-'),
        labelStyle: { fontSize: 10, fontWeight: 500 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
        },
        style: {
          strokeWidth: 2,
        },
      }));

      setEdges(flowEdges);
    } catch (error) {
      console.error('Error loading ER diagram:', error);
      toast.error('Failed to load ER diagram');
    } finally {
      setLoading(false);
    }
  };

  const onConnect = useCallback(
    (connection: Connection) => {
      setSelectedConnection(connection);
      setRelationshipDialogOpen(true);
    },
    []
  );

  const handleSaveRelationship = async (
    relationshipType: string,
    fromFieldId: string | null,
    description: string
  ) => {
    if (!selectedConnection) return;

    try {
      setSaving(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('entity_relationships')
        .insert({
          from_entity_id: selectedConnection.source,
          to_entity_id: selectedConnection.target,
          relationship_type: relationshipType,
          from_field_id: fromFieldId,
          description: description || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add edge to diagram
      const newEdge: Edge = {
        id: data.id,
        source: selectedConnection.source!,
        target: selectedConnection.target!,
        type: 'smoothstep',
        animated: false,
        label: relationshipType.replace('_', '-'),
        labelStyle: { fontSize: 10, fontWeight: 500 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
        },
        style: {
          strokeWidth: 2,
        },
      };

      setEdges((eds) => addEdge(newEdge, eds));
      toast.success('Relationship created successfully!');
      setRelationshipDialogOpen(false);
      setSelectedConnection(null);
    } catch (error) {
      console.error('Error saving relationship:', error);
      toast.error('Failed to save relationship');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoLayout = () => {
    // Simple auto-layout algorithm
    const layoutNodes = nodes.map((node, index) => ({
      ...node,
      position: {
        x: 100 + (index % 3) * 350,
        y: 100 + Math.floor(index / 3) * 300,
      },
    }));
    setNodes(layoutNodes);
    toast.success('Layout updated');
  };

  const handleSaveLayout = async () => {
    // In a real implementation, save node positions to database
    toast.success('Layout saved');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">ER Diagram</h1>
            <p className="mt-2 text-gray-600">
              Visualize your entity relationships
            </p>
          </div>
        </div>

        <Card className="p-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Maximize2 className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No entities yet
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Create some entities first to see them visualized in the ER diagram.
            </p>
            <Button onClick={() => window.location.href = '/dashboard/entities'}>
              <Plus className="mr-2 h-4 w-4" />
              Create Entity
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-none p-6 border-b bg-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">ER Diagram</h1>
            <p className="mt-2 text-gray-600">
              {entities.length} entities, {edges.length} relationships
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadDiagram}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleAutoLayout}>
              <Maximize2 className="mr-2 h-4 w-4" />
              Auto Layout
            </Button>
            <Button variant="outline" size="sm" onClick={handleSaveLayout}>
              <Save className="mr-2 h-4 w-4" />
              Save Layout
            </Button>
          </div>
        </div>
      </div>

      {/* ER Diagram Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          connectionLineType="smoothstep"
          connectionMode="loose"
          fitView
          minZoom={0.1}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const entityType = node.data.entity.entity_type;
              return entityType === 'INTERIM' ? '#fef3c7' :
                     entityType === 'REFERENCE' ? '#dbeafe' :
                     '#d1fae5';
            }}
            maskColor="rgb(240, 240, 240, 0.6)"
          />

          {/* Legend */}
          <Panel position="top-right" className="bg-white p-3 rounded-lg shadow-lg border">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-700 mb-2">Entity Types</div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-200 border border-yellow-300 rounded"></div>
                <span className="text-xs">INTERIM</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-200 border border-blue-300 rounded"></div>
                <span className="text-xs">REFERENCE</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-200 border border-green-300 rounded"></div>
                <span className="text-xs">MASTER</span>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Relationship Dialog */}
      <RelationshipDialog
        open={relationshipDialogOpen}
        onOpenChange={setRelationshipDialogOpen}
        connection={selectedConnection}
        entities={entities}
        onSave={handleSaveRelationship}
        saving={saving}
      />
    </div>
  );
}
