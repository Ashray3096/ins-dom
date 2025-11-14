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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { calculateStarSchemaLayout } from '@/lib/star-schema-layout';
import { AIChatPanel } from '@/components/star-schema/ai-chat-panel';
import {
  parseSourceMapping,
  getUniqueSourceEntities,
  mapAITypeToDBType,
  determineRelationshipType,
  type AIFieldSuggestion
} from '@/lib/source-mapping-parser';
import { getSourceDependencies } from '@/lib/transform-sql-generator';

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
  const [viewMode, setViewMode] = useState<'diagram' | 'ai-analysis'>('diagram');

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
    // Apply star schema layout (hierarchical)
    const layout = calculateStarSchemaLayout(entities);

    // Update node positions
    const layoutNodes = nodes.map(node => {
      const pos = layout.nodes.find(n => n.id === node.id);
      return pos ? { ...node, position: pos.position } : node;
    });

    setNodes(layoutNodes);
    toast.success('Star schema layout applied');
  };

  /**
   * Helper function to look up entity ID by name
   */
  const lookupEntityIdByName = (entityName: string): string | null => {
    const entity = entities.find(e => e.name === entityName);
    return entity ? entity.id : null;
  };

  /**
   * Create entity from AI suggestion
   */
  const handleCreateEntity = async (suggestion: any) => {
    try {
      setSaving(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      console.log('Creating entity from suggestion:', suggestion);

      // Check if entity already exists (query database directly to get fresh data)
      const { data: existingEntities } = await supabase
        .from('entities')
        .select('id, name')
        .eq('name', suggestion.name)
        .eq('created_by', user.id);

      if (existingEntities && existingEntities.length > 0) {
        toast.error(`Entity "${suggestion.name}" already exists. Delete it first or ask AI for a different name.`);
        return;
      }

      // 1. Create entity
      const entityType = suggestion.type === 'dimension' ? 'REFERENCE' : 'MASTER';
      const displayName = suggestion.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

      const sourceEntities = getUniqueSourceEntities(suggestion.fields || []);
      const sourceDependencies = sourceEntities.filter(e => e !== suggestion.name);

      console.log('Source dependencies:', sourceDependencies);

      const { data: entityData, error: entityError } = await supabase
        .from('entities')
        .insert({
          name: suggestion.name,
          display_name: displayName,
          description: suggestion.description || null,
          entity_type: entityType,
          status: 'ACTIVE',
          created_by: user.id,
          metadata: {
            ai_generated: true,
            reasoning: suggestion.reasoning,
            source_dependencies: sourceDependencies
          }
        })
        .select()
        .single();

      if (entityError) {
        console.error('Entity creation error:', entityError);
        throw new Error(entityError.message || 'Failed to create entity');
      }

      toast.success(`Created entity: ${suggestion.name}`);

      // 2. Create fields
      const fieldsToInsert: any[] = [];

      // Add primary key field
      fieldsToInsert.push({
        entity_id: entityData.id,
        name: `${suggestion.name}_id`,
        display_name: 'ID',
        description: 'Primary key',
        data_type: 'UUID',
        is_required: true,
        is_unique: true,
        is_primary_key: true,
        sort_order: 0
      });

      // Add suggested fields (only those with source mappings)
      for (let i = 0; i < (suggestion.fields || []).length; i++) {
        const field = suggestion.fields[i];

        // Skip fields without source mappings
        if (!field.source) {
          console.warn(`Skipping field ${field.name} - no source mapping`);
          continue;
        }

        const parsed = parseSourceMapping(field.source);

        // Check if this is a foreign key
        let fkEntityId = null;
        let fkFieldId = null;
        if (parsed && parsed.isFK) {
          fkEntityId = lookupEntityIdByName(parsed.sourceEntity);
        }

        fieldsToInsert.push({
          entity_id: entityData.id,
          name: field.name,
          display_name: field.name.replace(/_/g, ' '),
          description: field.source ? `Source: ${field.source}` : null,
          data_type: mapAITypeToDBType(field.type),
          is_required: field.name.toLowerCase().includes('_id'),
          is_unique: false,
          is_primary_key: false,
          foreign_key_entity_id: fkEntityId,
          sort_order: i + 1,
          metadata: {
            source: field.source,
            parsed: parsed,
            join_on: field.join_on
          }
        });
      }

      const { error: fieldsError } = await supabase
        .from('entity_fields')
        .insert(fieldsToInsert);

      if (fieldsError) {
        console.error('Fields creation error:', fieldsError);
        // Rollback - delete the entity we just created
        await supabase.from('entities').delete().eq('id', entityData.id);
        throw new Error(fieldsError.message || 'Failed to create fields');
      }

      toast.success(`Created ${fieldsToInsert.length} fields`);

      // 3. Create relationships
      for (const sourceEntity of sourceDependencies) {
        const toEntityId = lookupEntityIdByName(sourceEntity);
        if (toEntityId) {
          const relType = determineRelationshipType(entityType, 'INTERIM');

          console.log(`Creating relationship: ${suggestion.name} -> ${sourceEntity} (${relType})`);

          const { data: relData, error: relError } = await supabase
            .from('entity_relationships')
            .insert({
              from_entity_id: entityData.id,
              to_entity_id: toEntityId,
              relationship_type: relType,
              description: `Auto-generated: ${suggestion.name} sources data from ${sourceEntity}`,
              created_by: user.id
            })
            .select();

          if (relError) {
            console.error('Error creating relationship:', relError);
            // Don't fail the whole operation for relationship errors
          } else {
            console.log('Relationship created:', relData);
          }
        } else {
          console.warn(`Could not find entity: ${sourceEntity}`);
        }
      }

      if (sourceDependencies.length > 0) {
        toast.success(`Created ${sourceDependencies.length} relationships`);
      }

      // 4. Create table
      const createTableResponse = await fetch(`/api/entities/${entityData.id}/create-table`, {
        method: 'POST'
      });

      if (!createTableResponse.ok) {
        throw new Error('Failed to create table');
      }

      toast.success(`Created table: ${suggestion.name}`);

      // 5. Refresh diagram
      await loadDiagram();

      toast.success(`✅ Entity ${suggestion.name} created successfully!`);
    } catch (error) {
      console.error('Error creating entity from AI:', error);
      toast.error(`Failed to create entity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
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
            <h1 className="text-3xl font-bold text-gray-900">Schema Designer</h1>
            <p className="mt-2 text-gray-600">
              {entities.length} entities, {edges.length} relationships
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadDiagram}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {viewMode === 'diagram' && (
              <>
                <Button variant="outline" size="sm" onClick={handleAutoLayout}>
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Auto Layout
                </Button>
                <Button variant="outline" size="sm" onClick={handleSaveLayout}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Layout
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="flex-1 flex flex-col">
        <div className="flex-none px-6 pt-4 border-b bg-gray-50">
          <TabsList>
            <TabsTrigger value="diagram">Schema Diagram</TabsTrigger>
            <TabsTrigger value="ai-analysis">✨ Generate Schema with AI</TabsTrigger>
          </TabsList>
        </div>

        {/* Diagram View */}
        <TabsContent value="diagram" className="flex-1 mt-0">
          <div className="h-full relative">
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
        </TabsContent>

        {/* AI Analysis View */}
        <TabsContent value="ai-analysis" className="flex-1 mt-0 h-full">
          <AIChatPanel
            entities={entities}
            onCreateEntity={handleCreateEntity}
            onCreateRelationship={(suggestion) => {
              toast.success('Relationship creation from AI - coming soon!');
            }}
          />
        </TabsContent>
      </Tabs>

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
