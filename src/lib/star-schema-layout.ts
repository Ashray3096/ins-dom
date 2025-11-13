/**
 * Star Schema Layout Algorithm
 *
 * Calculates hierarchical positions for INTERIM → REFERENCE → MASTER entities
 * Creates clear visual flow showing dimensional model structure
 */

interface Entity {
  id: string;
  name: string;
  entity_type: 'INTERIM' | 'REFERENCE' | 'MASTER';
}

interface LayoutNode {
  id: string;
  position: { x: number; y: number };
}

interface LayoutResult {
  nodes: LayoutNode[];
  tiers: {
    INTERIM: Entity[];
    REFERENCE: Entity[];
    MASTER: Entity[];
  };
}

/**
 * Calculate star schema hierarchical layout
 *
 * Arranges entities in 3 tiers:
 * - Tier 1 (top): INTERIM entities (raw/staging data)
 * - Tier 2 (middle): REFERENCE entities (dimensions)
 * - Tier 3 (bottom): MASTER entities (facts)
 */
export function calculateStarSchemaLayout(entities: Entity[]): LayoutResult {
  // Group entities by type
  const interim = entities.filter(e => e.entity_type === 'INTERIM');
  const reference = entities.filter(e => e.entity_type === 'REFERENCE');
  const master = entities.filter(e => e.entity_type === 'MASTER');

  // Tier vertical positions
  const tierY = {
    INTERIM: 100,      // Top tier
    REFERENCE: 450,    // Middle tier
    MASTER: 800        // Bottom tier
  };

  // Horizontal spacing
  const nodeWidth = 280;
  const horizontalGap = 80;
  const spacing = nodeWidth + horizontalGap;

  // Calculate positions for each tier
  const positions: LayoutNode[] = [];

  // Helper to center entities horizontally
  const centerEntities = (tierEntities: Entity[], y: number) => {
    if (tierEntities.length === 0) return;

    const totalWidth = tierEntities.length * spacing - horizontalGap;
    const startX = Math.max(50, (1400 - totalWidth) / 2); // Center with min margin

    tierEntities.forEach((entity, index) => {
      positions.push({
        id: entity.id,
        position: {
          x: startX + (index * spacing),
          y: y
        }
      });
    });
  };

  // Layout each tier
  centerEntities(interim, tierY.INTERIM);
  centerEntities(reference, tierY.REFERENCE);
  centerEntities(master, tierY.MASTER);

  return {
    nodes: positions,
    tiers: {
      INTERIM: interim,
      REFERENCE: reference,
      MASTER: master
    }
  };
}

/**
 * Calculate grid layout (existing 3-column layout)
 */
export function calculateGridLayout(entities: Entity[]): LayoutResult {
  const columns = 3;
  const columnWidth = 350;
  const rowHeight = 300;

  const positions = entities.map((entity, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);

    return {
      id: entity.id,
      position: {
        x: 50 + (col * columnWidth),
        y: 50 + (row * rowHeight)
      }
    };
  });

  return {
    nodes: positions,
    tiers: {
      INTERIM: entities.filter(e => e.entity_type === 'INTERIM'),
      REFERENCE: entities.filter(e => e.entity_type === 'REFERENCE'),
      MASTER: entities.filter(e => e.entity_type === 'MASTER')
    }
  };
}

/**
 * Auto-arrange with smart algorithm
 * Attempts to minimize edge crossings and group related entities
 */
export function autoArrangeLayout(
  entities: Entity[],
  relationships: any[]
): LayoutResult {
  // For now, use star schema layout as the smart arrangement
  // Future: Implement force-directed or hierarchical layout algorithms
  return calculateStarSchemaLayout(entities);
}
