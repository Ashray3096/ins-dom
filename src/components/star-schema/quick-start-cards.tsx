'use client';

/**
 * Quick Start Cards for Star Schema Design
 *
 * Context-aware suggestion cards based on actual data
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Database, TrendingUp, Users, MapPin, Calendar, Package } from 'lucide-react';

interface QuickStartCard {
  icon: React.ReactNode;
  title: string;
  description: string;
  prompt: string;
  category: 'schema' | 'dimension' | 'fact' | 'analysis';
}

interface QuickStartCardsProps {
  entities: any[];
  onCardClick: (prompt: string) => void;
}

export function QuickStartCards({ entities, onCardClick }: QuickStartCardsProps) {
  // Generate cards based on available entities
  const cards: QuickStartCard[] = [];

  const interimEntities = entities.filter(e => e.entity_type === 'INTERIM');
  const hasInterim = interimEntities.length > 0;

  // Always show: Complete Star Schema suggestion
  if (hasInterim) {
    cards.push({
      icon: <Sparkles className="w-5 h-5" />,
      title: 'Suggest Complete Star Schema',
      description: `Analyze ${interimEntities.map(e => e.name).join(', ')} and recommend full dimensional model with facts and dimensions`,
      prompt: 'Analyze all my INTERIM entities and suggest a complete star schema with dimension tables, fact tables, and relationships. Include specific field mappings and deduplication strategies.',
      category: 'schema'
    });
  }

  // Brand/Company dimension (if brand-like fields exist)
  const hasBrandFields = interimEntities.some(e =>
    e.name.includes('brand') ||
    JSON.stringify(e).toLowerCase().includes('brand')
  );

  if (hasBrandFields) {
    cards.push({
      icon: <Database className="w-5 h-5" />,
      title: 'Brand Dimension Table',
      description: 'Create dim_brand dimension from unique brands across your data sources',
      prompt: 'Suggest a brand dimension table (dim_brand) by analyzing brand-related fields in my INTERIM entities. Include deduplication strategy and all relevant brand attributes.',
      category: 'dimension'
    });
  }

  // Product dimension
  const hasProductFields = interimEntities.some(e =>
    JSON.stringify(e).toLowerCase().includes('product') ||
    JSON.stringify(e).toLowerCase().includes('type')
  );

  if (hasProductFields) {
    cards.push({
      icon: <Package className="w-5 h-5" />,
      title: 'Product Type Dimension',
      description: 'Create dim_product_type for product categorization and analysis',
      prompt: 'Suggest a product dimension table analyzing product types and categories in my data. Include hierarchies if applicable.',
      category: 'dimension'
    });
  }

  // Geographic dimension
  const hasLocationFields = interimEntities.some(e =>
    JSON.stringify(e).toLowerCase().includes('state') ||
    JSON.stringify(e).toLowerCase().includes('location') ||
    JSON.stringify(e).toLowerCase().includes('ct_code')
  );

  if (hasLocationFields) {
    cards.push({
      icon: <MapPin className="w-5 h-5" />,
      title: 'Geographic Dimension',
      description: 'Create dim_location for geographic analysis by state/region',
      prompt: 'Suggest a geographic dimension table from state and location fields in my data. Map state codes to full names.',
      category: 'dimension'
    });
  }

  // Time dimension
  const hasTimeFields = interimEntities.some(e =>
    JSON.stringify(e).toLowerCase().includes('date') ||
    JSON.stringify(e).toLowerCase().includes('month') ||
    JSON.stringify(e).toLowerCase().includes('year')
  );

  if (hasTimeFields) {
    cards.push({
      icon: <Calendar className="w-5 h-5" />,
      title: 'Time Dimension',
      description: 'Create dim_time for temporal analysis and trending',
      prompt: 'Suggest a time dimension table from date/month/year fields. Include hierarchies for year > quarter > month > day.',
      category: 'dimension'
    });
  }

  // Fact table suggestions
  if (hasInterim) {
    cards.push({
      icon: <TrendingUp className="w-5 h-5" />,
      title: 'Sales/Metrics Fact Table',
      description: 'Create fact table for analytics with measures and dimension keys',
      prompt: 'Suggest appropriate fact tables for analytics. Define grain, measures, and foreign keys to dimension tables. Consider what questions users want to answer with this data.',
      category: 'fact'
    });
  }

  // Relationship analysis
  cards.push({
    icon: <Users className="w-5 h-5" />,
    title: 'Relationship Recommendations',
    description: 'Identify potential join keys and relationships between entities',
    prompt: 'Analyze my entities and suggest relationships. Identify common fields that could be join keys. Recommend foreign key constraints.',
    category: 'analysis'
  });

  const categoryColors = {
    schema: 'border-purple-300 bg-purple-50 hover:bg-purple-100',
    dimension: 'border-blue-300 bg-blue-50 hover:bg-blue-100',
    fact: 'border-green-300 bg-green-50 hover:bg-green-100',
    analysis: 'border-orange-300 bg-orange-50 hover:bg-orange-100'
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Start a Conversation</h1>
        <p className="text-gray-600">
          Ask questions about your data schema and get AI-powered dimensional modeling insights
        </p>
      </div>

      {/* Quick Start Label */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700">Quick Start</h2>
        <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
          <Sparkles className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-2 gap-4">
        {cards.map((card, index) => (
          <Card
            key={index}
            className={`cursor-pointer transition-all border-2 ${categoryColors[card.category]}`}
            onClick={() => onCardClick(card.prompt)}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white border flex items-center justify-center">
                  {card.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {card.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {card.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State if no cards */}
      {cards.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p>Create some INTERIM entities first to get schema suggestions</p>
        </div>
      )}
    </div>
  );
}
