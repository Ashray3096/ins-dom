'use client';

/**
 * JSON Visual Selector Component
 *
 * Tree-based viewer for JSON documents with JSONPath selection
 * Features:
 * - Collapsible JSON tree
 * - Click to select fields
 * - JSONPath generation
 * - Array detection and handling
 * - Type inference
 * - Field mapping panel
 */

import { useState } from 'react';
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
import { X, Check, Trash2, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Artifact } from '@/types/artifacts';

export interface JSONFieldMapping {
  id: string;
  name: string;
  jsonPath: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  required: boolean;
  sampleValue: any;
  isArray: boolean;
}

interface JSONVisualSelectorProps {
  artifact: Artifact;
  onSave: (fieldMappings: JSONFieldMapping[]) => void;
  onCancel: () => void;
}

interface TreeNode {
  key: string;
  path: string;
  value: any;
  type: string;
  isArray: boolean;
  children?: TreeNode[];
  isExpanded?: boolean;
}

export function JSONVisualSelector({
  artifact,
  onSave,
  onCancel,
}: JSONVisualSelectorProps) {
  const [fieldMappings, setFieldMappings] = useState<JSONFieldMapping[]>([]);
  const [jsonData, setJsonData] = useState<any>(null);
  const [treeRoot, setTreeRoot] = useState<TreeNode | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [currentFieldName, setCurrentFieldName] = useState('');
  const [currentFieldType, setCurrentFieldType] = useState<'string' | 'number' | 'date' | 'boolean'>('string');
  const [currentFieldRequired, setCurrentFieldRequired] = useState(true);

  // Parse JSON on mount
  useState(() => {
    try {
      let parsed;
      if (artifact.raw_content && typeof artifact.raw_content === 'object') {
        // If raw_content is already an object
        if (artifact.raw_content.content) {
          // If wrapped in { content: "..." }
          parsed = typeof artifact.raw_content.content === 'string'
            ? JSON.parse(artifact.raw_content.content)
            : artifact.raw_content.content;
        } else {
          parsed = artifact.raw_content;
        }
      } else if (typeof artifact.raw_content === 'string') {
        parsed = JSON.parse(artifact.raw_content);
      } else {
        throw new Error('No JSON content found');
      }

      setJsonData(parsed);
      const tree = buildTree(parsed, 'root', '$');
      setTreeRoot(tree);
    } catch (error) {
      console.error('Error parsing JSON:', error);
      toast.error('Failed to parse JSON content');
    }
  });

  // Build tree structure from JSON
  function buildTree(data: any, key: string, path: string): TreeNode {
    const type = Array.isArray(data) ? 'array' : typeof data;
    const isArray = Array.isArray(data);

    const node: TreeNode = {
      key,
      path,
      value: data,
      type,
      isArray,
      isExpanded: true, // Start expanded
    };

    if (type === 'object' && data !== null && !isArray) {
      node.children = Object.keys(data).map((childKey) =>
        buildTree(data[childKey], childKey, `${path}.${childKey}`)
      );
    } else if (isArray && data.length > 0) {
      // For arrays, show first element's structure
      node.children = [buildTree(data[0], '[0]', `${path}[0]`)];
    }

    return node;
  }

  // Toggle node expansion
  function toggleNode(node: TreeNode) {
    const updateNode = (n: TreeNode): TreeNode => {
      if (n.path === node.path) {
        return { ...n, isExpanded: !n.isExpanded };
      }
      if (n.children) {
        return { ...n, children: n.children.map(updateNode) };
      }
      return n;
    };

    if (treeRoot) {
      setTreeRoot(updateNode(treeRoot));
    }
  }

  // Handle node selection
  function handleNodeClick(node: TreeNode) {
    // Don't select root or pure objects/arrays without value
    if (node.key === 'root' || (node.type === 'object' && !isPrimitive(node.value))) {
      return;
    }

    setSelectedPath(node.path);

    // Generate a field name from the path
    const suggestedName = node.key.replace(/\[.*\]/, '').replace(/^\./, '');
    setCurrentFieldName(suggestedName);

    // Infer type from value
    const inferredType = inferType(node.value);
    setCurrentFieldType(inferredType);
  }

  // Check if value is primitive
  function isPrimitive(value: any): boolean {
    return value === null || ['string', 'number', 'boolean'].includes(typeof value);
  }

  // Infer field type from value
  function inferType(value: any): 'string' | 'number' | 'date' | 'boolean' {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'string') {
      // Check if it looks like a date
      const datePattern = /^\d{4}-\d{2}-\d{2}/;
      if (datePattern.test(value)) return 'date';
    }
    return 'string';
  }

  // Get value at JSON path
  function getValueAtPath(path: string): any {
    if (!jsonData) return null;

    try {
      // Simple path evaluation (supports $.key and $.key[0].subkey)
      let current = jsonData;
      const parts = path.replace(/^\$\.?/, '').split(/\.|\[|\]/).filter(Boolean);

      for (const part of parts) {
        if (part.match(/^\d+$/)) {
          current = current[parseInt(part)];
        } else {
          current = current[part];
        }
      }

      return current;
    } catch {
      return null;
    }
  }

  // Add field mapping
  function addFieldMapping() {
    if (!currentFieldName.trim()) {
      toast.error('Please enter a field name');
      return;
    }

    if (!selectedPath) {
      toast.error('Please select a JSON path');
      return;
    }

    const value = getValueAtPath(selectedPath);
    const isArray = Array.isArray(value);

    const newMapping: JSONFieldMapping = {
      id: Date.now().toString(),
      name: currentFieldName.trim(),
      jsonPath: selectedPath,
      type: currentFieldType,
      required: currentFieldRequired,
      sampleValue: isArray ? value[0] : value,
      isArray,
    };

    setFieldMappings([...fieldMappings, newMapping]);

    // Reset form
    setSelectedPath(null);
    setCurrentFieldName('');
    setCurrentFieldType('string');
    setCurrentFieldRequired(true);

    toast.success(`Field "${newMapping.name}" added`);
  }

  // Remove field mapping
  function removeFieldMapping(id: string) {
    setFieldMappings(fieldMappings.filter((m) => m.id !== id));
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

  // Render tree node
  function renderTreeNode(node: TreeNode, level: number = 0): JSX.Element {
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = node.path === selectedPath;
    const isPrimitiveValue = isPrimitive(node.value);
    const isClickable = node.key !== 'root' && (isPrimitiveValue || node.isArray);

    return (
      <div key={node.path}>
        <div
          className={`flex items-center py-1 px-2 hover:bg-gray-100 rounded cursor-pointer ${
            isSelected ? 'bg-blue-100 border-l-4 border-blue-600' : ''
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleNode(node);
            }
            if (isClickable) {
              handleNodeClick(node);
            }
          }}
        >
          {hasChildren && (
            <span className="mr-1">
              {node.isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </span>
          )}

          <span className="font-mono text-sm">
            <span className="text-purple-600 font-semibold">{node.key}</span>
            {node.isArray && <span className="text-gray-500">[]</span>}
            {isPrimitiveValue && (
              <>
                <span className="text-gray-500">: </span>
                <span className={`${
                  node.type === 'string' ? 'text-green-600' :
                  node.type === 'number' ? 'text-blue-600' :
                  node.type === 'boolean' ? 'text-orange-600' :
                  'text-gray-600'
                }`}>
                  {JSON.stringify(node.value)}
                </span>
              </>
            )}
            {node.type === 'object' && !node.isArray && (
              <span className="text-gray-500"> {'{}'}</span>
            )}
          </span>
        </div>

        {hasChildren && node.isExpanded && (
          <div>
            {node.children!.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel: JSON Tree */}
      <div className="flex-1 flex flex-col border-r bg-white">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">JSON Structure</h2>
          <p className="text-sm text-gray-500 mt-1">
            Click on fields to select them for extraction
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {treeRoot ? (
            renderTreeNode(treeRoot)
          ) : (
            <div className="text-center text-gray-500 py-12">
              <p>Unable to parse JSON content</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Field Mappings */}
      <div className="w-96 flex flex-col bg-white">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Field Mappings</h2>
          <p className="text-sm text-gray-500 mt-1">
            {fieldMappings.length} field{fieldMappings.length !== 1 ? 's' : ''} selected
          </p>
        </div>

        {/* Add Field Form */}
        {selectedPath && (
          <Card className="m-4 p-4 bg-blue-50 border-blue-200">
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-gray-700">JSON Path</Label>
                <div className="mt-1 p-2 bg-white rounded border text-xs font-mono text-gray-700">
                  {selectedPath}
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
                  placeholder="e.g., user_name"
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
              <p>No fields selected yet</p>
              <p className="text-xs mt-2">Click on JSON fields to add them</p>
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
                      {mapping.isArray && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                          Array
                        </span>
                      )}
                      {mapping.required && (
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                          Required
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 font-mono mt-1 truncate">
                      {mapping.jsonPath}
                    </p>

                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {mapping.type}
                      </span>
                      {mapping.sampleValue !== null && mapping.sampleValue !== undefined && (
                        <span className="text-xs text-gray-600 truncate">
                          Sample: {JSON.stringify(mapping.sampleValue).slice(0, 30)}...
                        </span>
                      )}
                    </div>
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
