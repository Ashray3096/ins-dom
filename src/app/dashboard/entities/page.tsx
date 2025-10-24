'use client';

/**
 * Entities Page
 *
 * View and manage extracted data entities
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wand2, Download, Filter } from 'lucide-react';

export default function EntitiesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Entities</h1>
          <p className="mt-2 text-gray-600">
            View and manage your extracted data entities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Empty State */}
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
            <Wand2 className="h-8 w-8 text-orange-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No entities yet
          </h3>
          <p className="text-gray-600 text-center mb-6 max-w-md">
            Run your first extraction to start seeing extracted data entities here.
            Entities are the structured records extracted from your source files.
          </p>
          <Button>
            <Wand2 className="mr-2 h-4 w-4" />
            Run Your First Extraction
          </Button>
        </CardContent>
      </Card>

      {/* Info Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Extraction Results</CardTitle>
            <CardDescription>View extracted data records</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              All extracted entities from your AI extractions will appear here with
              full details and metadata.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Search & Filter</CardTitle>
            <CardDescription>Find specific entities</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Use powerful search and filtering to find exactly the entities you're
              looking for across all extractions.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export Data</CardTitle>
            <CardDescription>Download in multiple formats</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Export your extracted entities to CSV, Excel, or JSON for use in
              other systems and analytics tools.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Entity Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Entity Statistics</CardTitle>
          <CardDescription>Overview of your extracted data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">0</div>
              <div className="text-sm text-gray-600 mt-1">Total Entities</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">0</div>
              <div className="text-sm text-gray-600 mt-1">Extractions Run</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">0</div>
              <div className="text-sm text-gray-600 mt-1">Corrections Made</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">0%</div>
              <div className="text-sm text-gray-600 mt-1">Avg Accuracy</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
