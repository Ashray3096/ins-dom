'use client';

/**
 * CSV Visual Selector Component
 *
 * Table-based viewer for CSV files with column selection
 * Features:
 * - Table preview with scrollable rows
 * - Click column headers to select
 * - Column mapping to field names
 * - Type detection from sample data
 * - Field mapping panel
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { X, Check, Trash2, Plus, Table as TableIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Artifact } from '@/types/artifacts';

export interface CSVFieldMapping {
  id: string;
  name: string;
  columnIndex: number;
  columnName: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  required: boolean;
  sampleValues: string[];
}

interface CSVVisualSelectorProps {
  artifact: Artifact;
  onSave: (fieldMappings: CSVFieldMapping[]) => void;
  onCancel: () => void;
}

export function CSVVisualSelector({
  artifact,
  onSave,
  onCancel,
}: CSVVisualSelectorProps) {
  const [fieldMappings, setFieldMappings] = useState<CSVFieldMapping[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<number | null>(null);
  const [currentFieldName, setCurrentFieldName] = useState('');
  const [currentFieldType, setCurrentFieldType] = useState<'string' | 'number' | 'date' | 'boolean'>('string');
  const [currentFieldRequired, setCurrentFieldRequired] = useState(true);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);

  // Parse CSV on mount
  useEffect(() => {
    try {
      let csvText: string;

      if (artifact.raw_content && typeof artifact.raw_content === 'object') {
        // If wrapped in { content: "..." }
        csvText = artifact.raw_content.content || '';
      } else if (typeof artifact.raw_content === 'string') {
        csvText = artifact.raw_content;
      } else {
        throw new Error('No CSV content found');
      }

      if (!csvText) {
        throw new Error('CSV content is empty');
      }

      // Simple CSV parser (handles basic CSV files)
      const rows = parseCSV(csvText);

      if (rows.length === 0) {
        throw new Error('CSV file is empty');
      }

      // Assume first row is headers
      const headerRow = rows[0];
      const dataRows = rows.slice(1);

      setCsvData(rows);
      setHeaders(headerRow);
      setPreviewRows(dataRows.slice(0, 5)); // Show first 5 rows
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to parse CSV content');
    }
  }, [artifact]);

  // Simple CSV parser
  function parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      if (line.trim() === '') continue;

      // Simple split by comma (doesn't handle quoted commas)
      // For production, use a proper CSV parser library
      const row = line.split(',').map(cell => cell.trim());
      rows.push(row);
    }

    return rows;
  }

  // Handle column selection
  function handleColumnClick(columnIndex: number) {
    setSelectedColumn(columnIndex);

    // Generate field name from header
    const header = headers[columnIndex];
    const suggestedName = header
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    setCurrentFieldName(suggestedName);

    // Infer type from sample values
    const sampleValues = previewRows.slice(0, 5).map(row => row[columnIndex]);
    const inferredType = inferTypeFromSamples(sampleValues);
    setCurrentFieldType(inferredType);
  }

  // Infer field type from sample values
  function inferTypeFromSamples(samples: string[]): 'string' | 'number' | 'date' | 'boolean' {
    const nonEmpty = samples.filter(s => s && s.trim() !== '');

    if (nonEmpty.length === 0) return 'string';

    // Check if all are numbers
    const allNumbers = nonEmpty.every(s => !isNaN(parseFloat(s)) && isFinite(Number(s)));
    if (allNumbers) return 'number';

    // Check if all are booleans
    const allBooleans = nonEmpty.every(s =>
      ['true', 'false', 'yes', 'no', '1', '0'].includes(s.toLowerCase())
    );
    if (allBooleans) return 'boolean';

    // Check if looks like dates
    const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}/;
    const allDates = nonEmpty.every(s => datePattern.test(s));
    if (allDates) return 'date';

    return 'string';
  }

  // Add field mapping
  function addFieldMapping() {
    if (!currentFieldName.trim()) {
      toast.error('Please enter a field name');
      return;
    }

    if (selectedColumn === null) {
      toast.error('Please select a column');
      return;
    }

    // Check if column already mapped
    if (fieldMappings.some(m => m.columnIndex === selectedColumn)) {
      toast.error('This column is already mapped');
      return;
    }

    const sampleValues = previewRows.slice(0, 5).map(row => row[selectedColumn] || '');

    const newMapping: CSVFieldMapping = {
      id: Date.now().toString(),
      name: currentFieldName.trim(),
      columnIndex: selectedColumn,
      columnName: headers[selectedColumn],
      type: currentFieldType,
      required: currentFieldRequired,
      sampleValues,
    };

    setFieldMappings([...fieldMappings, newMapping]);

    // Reset form
    setSelectedColumn(null);
    setCurrentFieldName('');
    setCurrentFieldType('string');
    setCurrentFieldRequired(true);

    toast.success(`Field "${newMapping.name}" added`);
  }

  // Remove field mapping
  function removeFieldMapping(id: string) {
    setFieldMappings(fieldMappings.filter(m => m.id !== id));
    toast.success('Field removed');
  }

  // Handle save
  function handleSave() {
    if (fieldMappings.length === 0) {
      toast.error('Please add at least one field mapping');
      return;
    }

    onSave(fieldMappings);
  }

  // Check if column is mapped
  function isColumnMapped(columnIndex: number): boolean {
    return fieldMappings.some(m => m.columnIndex === columnIndex);
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel: CSV Table */}
      <div className="flex-1 flex flex-col border-r bg-white overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">CSV Preview</h2>
          <p className="text-sm text-gray-500 mt-1">
            Click on column headers to select them for extraction
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Showing {previewRows.length} of {csvData.length - 1} rows
          </p>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {headers.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {headers.map((header, index) => (
                      <th
                        key={index}
                        onClick={() => handleColumnClick(index)}
                        className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 ${
                          selectedColumn === index
                            ? 'bg-blue-100 border-b-4 border-blue-600'
                            : isColumnMapped(index)
                            ? 'bg-green-50'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-700">{header}</span>
                          {isColumnMapped(index) && (
                            <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded">
                              ✓
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 font-normal mt-1">
                          Col {index}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className={`px-4 py-3 text-sm text-gray-900 ${
                            selectedColumn === cellIndex ? 'bg-blue-50' : ''
                          } ${isColumnMapped(cellIndex) ? 'bg-green-50' : ''}`}
                        >
                          {cell || <span className="text-gray-400 italic">empty</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <TableIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p>No CSV data found</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Field Mappings */}
      <div className="w-96 flex flex-col bg-white">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Field Mappings</h2>
          <p className="text-sm text-gray-500 mt-1">
            {fieldMappings.length} column{fieldMappings.length !== 1 ? 's' : ''} selected
          </p>
        </div>

        {/* Add Field Form */}
        {selectedColumn !== null && (
          <Card className="m-4 p-4 bg-blue-50 border-blue-200">
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-gray-700">Selected Column</Label>
                <div className="mt-1 p-2 bg-white rounded border text-xs font-medium text-gray-700">
                  {headers[selectedColumn]} (Column {selectedColumn})
                </div>
              </div>

              <div>
                <Label htmlFor="fieldName" className="text-xs font-medium">
                  Field Name
                </Label>
                <Input
                  id="fieldName"
                  value={currentFieldName}
                  onChange={(e) => setCurrentFieldName(e.target.value)}
                  placeholder="e.g., product_name"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="fieldType" className="text-xs font-medium">
                  Field Type
                </Label>
                <Select value={currentFieldType} onValueChange={(value: any) => setCurrentFieldType(value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">String</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="required"
                  checked={currentFieldRequired}
                  onChange={(e) => setCurrentFieldRequired(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="required" className="text-xs font-medium cursor-pointer">
                  Required field
                </Label>
              </div>

              <Button onClick={addFieldMapping} className="w-full" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Field
              </Button>
            </div>
          </Card>
        )}

        {/* Field Mappings List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {fieldMappings.length === 0 ? (
            <div className="text-center text-gray-500 py-12 text-sm">
              <p>No columns selected yet</p>
              <p className="text-xs mt-2">Click on column headers to add them</p>
            </div>
          ) : (
            fieldMappings.map((mapping) => (
              <Card key={mapping.id} className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">
                        {mapping.name}
                      </span>
                      {mapping.required && (
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                          Required
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 mt-1">
                      Column: {mapping.columnName} (#{mapping.columnIndex})
                    </p>

                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {mapping.type}
                      </span>
                    </div>

                    {mapping.sampleValues.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        <div className="font-medium">Sample values:</div>
                        {mapping.sampleValues.slice(0, 3).map((val, i) => (
                          <div key={i} className="truncate">• {val || '(empty)'}</div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFieldMapping(mapping.id)}
                    className="ml-2"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t bg-gray-50 space-y-2">
          <Button onClick={handleSave} className="w-full" disabled={fieldMappings.length === 0}>
            <Check className="w-4 h-4 mr-2" />
            Save Template ({fieldMappings.length} fields)
          </Button>
          <Button onClick={onCancel} variant="outline" className="w-full">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
