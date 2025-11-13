'use client';

/**
 * Entity Data Tab Component
 *
 * Displays extracted data from entity table
 * - Paginated table view
 * - Refresh button
 * - Export CSV
 * - Empty state with call-to-action
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Download, Database, Play } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface Entity {
  id: string;
  name: string;
  display_name: string;
  table_status: string;
}

export function EntityDataTab({ entityId }: { entityId: string }) {
  const [entity, setEntity] = useState<Entity | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [fields, setFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recordCount, setRecordCount] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    loadData();
  }, [entityId, page]);

  const loadData = async () => {
    try {
      const supabase = createClient();

      // Get entity info
      const { data: entityData, error: entityError } = await supabase
        .from('entities')
        .select('*')
        .eq('id', entityId)
        .single();

      if (entityError) throw entityError;
      setEntity(entityData);

      // If table not created, don't try to fetch data
      if (entityData.table_status !== 'created') {
        setLoading(false);
        return;
      }

      // Get entity fields to know column names
      const { data: fieldsData } = await supabase
        .from('entity_fields')
        .select('name')
        .eq('entity_id', entityId)
        .order('sort_order');

      const fieldNames = fieldsData?.map(f => f.name) || [];
      setFields(fieldNames);

      // Fetch data from entity table using raw SQL
      // Note: Table name from entity.name
      const { data: tableData, error: dataError, count } = await supabase
        .from(entityData.name)
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (dataError) {
        console.error('Error fetching table data:', dataError);
        // Table might be empty or not exist yet
        setData([]);
        setRecordCount(0);
      } else {
        setData(tableData || []);
        setRecordCount(count || 0);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const handleExport = () => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Simple CSV export
    const csv = [
      fields.join(','),
      ...data.map(row => fields.map(f => row[f] || '').join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entity?.name}_data.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Data exported to CSV');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!entity) {
    return <div className="text-center text-gray-500 py-12">Entity not found</div>;
  }

  if (entity.table_status !== 'created') {
    return (
      <Card>
        <CardContent className="pt-12 pb-12">
          <div className="text-center text-gray-500">
            <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Table Not Created</p>
            <p className="text-sm mb-4">Create the database table in the Schema tab first</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Go to Schema Tab
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Data Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Data Preview</CardTitle>
              <CardDescription>
                {recordCount} record{recordCount !== 1 ? 's' : ''} in {entity.name}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={data.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <Play className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">No Data Yet</p>
              <p className="text-sm mb-4">
                Run the pipeline to extract data from your source
              </p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Go to Pipeline Tab
              </Button>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {fields.map((field) => (
                        <th
                          key={field}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
                        >
                          {field}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((row, idx) => (
                      <tr key={row.id || idx} className="hover:bg-gray-50">
                        {fields.map((field) => (
                          <td
                            key={field}
                            className="px-4 py-3 text-gray-900 max-w-xs truncate"
                          >
                            {row[field]?.toString() || (
                              <span className="text-gray-400 italic">null</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-600">
                  Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, recordCount)} of {recordCount}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={(page + 1) * pageSize >= recordCount}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
