'use client';

/**
 * Correction Table Component
 *
 * Displays AI extraction results in an editable table
 * Tracks user corrections to improve template accuracy
 *
 * Features:
 * - Inline editing of extracted data
 * - Visual highlighting of corrected fields (yellow)
 * - Original vs corrected comparison view
 * - Correction statistics
 * - Save as template functionality
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Save,
  RotateCcw,
  Eye,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

interface CorrectionTableProps {
  fields: string[];
  data: Record<string, any>[];
  onSaveTemplate?: (corrections: CorrectionData) => void;
  onCorrectionsChange?: (corrections: CorrectionData) => void;
}

export interface CorrectionData {
  corrections: Record<string, Record<string, any>>; // rowId -> field -> value
  originalData: Record<string, any>[];
  correctedData: Record<string, any>[];
  statistics: CorrectionStatistics;
}

interface CorrectionStatistics {
  totalFields: number;
  correctedFields: number;
  correctedRows: number;
  correctionRate: number;
}

export function CorrectionTable({
  fields,
  data,
  onSaveTemplate,
  onCorrectionsChange
}: CorrectionTableProps) {
  // State for edited data
  const [editedData, setEditedData] = useState<Record<string, any>[]>(
    data.map(row => ({ ...row }))
  );

  // Track which fields were corrected: rowIndex -> field -> true
  const [corrections, setCorrections] = useState<Record<string, Record<string, boolean>>>({});

  // Show comparison view
  const [showComparison, setShowComparison] = useState(false);

  // Track active edit cell
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);

  /**
   * Handle cell value change
   */
  const handleCellChange = useCallback((rowIndex: number, field: string, newValue: any) => {
    const originalValue = data[rowIndex][field];

    // Update edited data
    setEditedData(prev => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        [field]: newValue
      };
      return updated;
    });

    // Track correction if value changed from original
    setCorrections(prev => {
      const updated = { ...prev };
      const rowKey = String(rowIndex);

      if (!updated[rowKey]) {
        updated[rowKey] = {};
      }

      // Mark as corrected if different from original
      if (String(newValue) !== String(originalValue)) {
        updated[rowKey][field] = true;
      } else {
        // Remove correction marker if value reverted to original
        delete updated[rowKey][field];
        if (Object.keys(updated[rowKey]).length === 0) {
          delete updated[rowKey];
        }
      }

      return updated;
    });
  }, [data]);

  /**
   * Reset a single field to original value
   */
  const handleResetField = useCallback((rowIndex: number, field: string) => {
    const originalValue = data[rowIndex][field];
    handleCellChange(rowIndex, field, originalValue);
    toast.success(`Reset ${field} to original value`);
  }, [data, handleCellChange]);

  /**
   * Reset all corrections
   */
  const handleResetAll = useCallback(() => {
    setEditedData(data.map(row => ({ ...row })));
    setCorrections({});
    toast.success('All corrections reset');
  }, [data]);

  /**
   * Calculate correction statistics
   */
  const calculateStatistics = useCallback((): CorrectionStatistics => {
    const totalFields = data.length * fields.length;
    let correctedFields = 0;
    const correctedRowsSet = new Set<number>();

    Object.entries(corrections).forEach(([rowKey, fieldCorrections]) => {
      const rowIndex = parseInt(rowKey);
      correctedRowsSet.add(rowIndex);
      correctedFields += Object.keys(fieldCorrections).length;
    });

    return {
      totalFields,
      correctedFields,
      correctedRows: correctedRowsSet.size,
      correctionRate: totalFields > 0 ? (correctedFields / totalFields) * 100 : 0
    };
  }, [corrections, data.length, fields.length]);

  /**
   * Check if a specific cell was corrected
   */
  const isCorrected = useCallback((rowIndex: number, field: string): boolean => {
    const rowKey = String(rowIndex);
    return corrections[rowKey]?.[field] === true;
  }, [corrections]);

  /**
   * Check if a row has any corrections
   */
  const hasRowCorrections = useCallback((rowIndex: number): boolean => {
    const rowKey = String(rowIndex);
    return corrections[rowKey] && Object.keys(corrections[rowKey]).length > 0;
  }, [corrections]);

  /**
   * Save corrections as template
   */
  const handleSaveTemplate = useCallback(() => {
    const statistics = calculateStatistics();

    const correctionData: CorrectionData = {
      corrections,
      originalData: data,
      correctedData: editedData,
      statistics
    };

    if (onSaveTemplate) {
      onSaveTemplate(correctionData);
    }

    if (onCorrectionsChange) {
      onCorrectionsChange(correctionData);
    }

    toast.success('Corrections saved! You can now create a template.');
  }, [corrections, data, editedData, calculateStatistics, onSaveTemplate, onCorrectionsChange]);

  const statistics = calculateStatistics();
  const hasCorrections = statistics.correctedFields > 0;

  return (
    <div className="space-y-4">
      {/* Statistics Card */}
      <Card className={hasCorrections ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {hasCorrections ? (
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
              )}
              <h3 className="font-semibold text-gray-900">
                {hasCorrections ? 'Corrections Made' : 'No Corrections Yet'}
              </h3>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowComparison(!showComparison)}
                className="gap-2"
              >
                <Eye className="w-4 h-4" />
                {showComparison ? 'Hide' : 'Show'} Comparison
              </Button>

              {hasCorrections && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetAll}
                  className="gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset All
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Total Fields</p>
              <p className="font-semibold text-gray-900 text-lg">
                {statistics.totalFields}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Corrected Fields</p>
              <p className="font-semibold text-yellow-700 text-lg">
                {statistics.correctedFields}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Corrected Rows</p>
              <p className="font-semibold text-yellow-700 text-lg">
                {statistics.correctedRows}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Correction Rate</p>
              <p className="font-semibold text-gray-900 text-lg">
                {statistics.correctionRate.toFixed(1)}%
              </p>
            </div>
          </div>

          {hasCorrections && (
            <div className="mt-4 p-3 bg-white rounded-md border border-yellow-300">
              <p className="text-sm text-gray-700">
                <strong>Note:</strong> You've corrected {statistics.correctedFields} field
                {statistics.correctedFields !== 1 ? 's' : ''} across {statistics.correctedRows} row
                {statistics.correctedRows !== 1 ? 's' : ''}.
                These corrections will help improve the extraction template.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Extracted Data ({data.length} rows)</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Click on any cell to edit. Corrected cells are highlighted in yellow.
            </p>
          </div>

          {hasCorrections && (
            <Button onClick={handleSaveTemplate} className="gap-2">
              <Save className="w-4 h-4" />
              Save as Template
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium text-gray-700 w-12">Row</th>
                  {fields.map((field) => (
                    <th
                      key={field}
                      className="text-left p-3 font-medium text-gray-700"
                    >
                      {field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {editedData.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={`border-b hover:bg-gray-50 ${
                      hasRowCorrections(rowIndex) ? 'bg-yellow-50' : ''
                    }`}
                  >
                    {/* Row number */}
                    <td className="p-3 text-gray-500 font-medium">
                      {rowIndex + 1}
                      {hasRowCorrections(rowIndex) && (
                        <span className="ml-1 text-yellow-600">*</span>
                      )}
                    </td>

                    {/* Data cells */}
                    {fields.map((field) => {
                      const value = row[field];
                      const originalValue = data[rowIndex][field];
                      const corrected = isCorrected(rowIndex, field);
                      const isEditing = editingCell?.row === rowIndex && editingCell?.field === field;

                      return (
                        <td
                          key={`${rowIndex}-${field}`}
                          className={`p-3 relative group ${
                            corrected ? 'bg-yellow-100' : ''
                          }`}
                        >
                          {/* Editable input */}
                          <input
                            type="text"
                            value={value !== undefined && value !== null ? String(value) : ''}
                            onChange={(e) => handleCellChange(rowIndex, field, e.target.value)}
                            onFocus={() => setEditingCell({ row: rowIndex, field })}
                            onBlur={() => setEditingCell(null)}
                            className={`
                              w-full px-2 py-1 rounded border
                              ${corrected
                                ? 'border-yellow-300 bg-yellow-50'
                                : 'border-transparent bg-transparent'
                              }
                              hover:border-gray-300 focus:border-blue-400 focus:outline-none
                              transition-colors
                            `}
                          />

                          {/* Show comparison on hover if corrected */}
                          {corrected && showComparison && !isEditing && (
                            <div className="absolute left-0 top-full mt-1 z-10 bg-white border border-gray-300 rounded-md shadow-lg p-3 min-w-[200px] hidden group-hover:block">
                              <div className="space-y-2 text-xs">
                                <div>
                                  <p className="text-gray-500 font-medium">Original (AI):</p>
                                  <p className="text-gray-700 line-through">
                                    {originalValue !== undefined && originalValue !== null
                                      ? String(originalValue)
                                      : '-'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500 font-medium">Corrected (You):</p>
                                  <p className="text-green-700 font-semibold">
                                    {value !== undefined && value !== null
                                      ? String(value)
                                      : '-'}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleResetField(rowIndex, field)}
                                  className="w-full mt-2"
                                >
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  Reset
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Correction indicator */}
                          {corrected && (
                            <div className="absolute top-1 right-1">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-6 text-xs text-gray-600 border-t pt-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded" />
              <span>Corrected field</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full" />
              <span>Has correction</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-600">*</span>
              <span>Row has corrections</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison View (when enabled) */}
      {showComparison && hasCorrections && (
        <Card className="bg-gray-50 border-gray-300">
          <CardHeader>
            <CardTitle>Detailed Comparison View</CardTitle>
            <p className="text-sm text-gray-600">
              Side-by-side comparison of AI-extracted values vs your corrections
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(corrections).map(([rowKey, fieldCorrections]) => {
                const rowIndex = parseInt(rowKey);

                return (
                  <div key={rowKey} className="bg-white border rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">
                      Row {rowIndex + 1} - {Object.keys(fieldCorrections).length} correction(s)
                    </h4>

                    <div className="space-y-2">
                      {Object.keys(fieldCorrections).map((field) => (
                        <div
                          key={field}
                          className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded"
                        >
                          <div>
                            <p className="text-xs text-gray-500 font-medium mb-1">
                              Original (AI)
                            </p>
                            <p className="text-sm text-gray-700 line-through">
                              <strong>{field}:</strong>{' '}
                              {data[rowIndex][field] !== undefined && data[rowIndex][field] !== null
                                ? String(data[rowIndex][field])
                                : '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 font-medium mb-1">
                              Corrected (You)
                            </p>
                            <p className="text-sm text-green-700 font-semibold">
                              <strong>{field}:</strong>{' '}
                              {editedData[rowIndex][field] !== undefined && editedData[rowIndex][field] !== null
                                ? String(editedData[rowIndex][field])
                                : '-'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
