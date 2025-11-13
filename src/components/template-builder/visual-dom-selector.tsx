'use client';

/**
 * Visual DOM Selector Component
 *
 * Allows users to click elements in rendered HTML to build extraction templates
 * Features:
 * - Renders actual HTML file (not extracted text)
 * - Click to select elements
 * - Highlights selected elements
 * - Captures XPath and CSS selectors
 * - Field mapping panel
 */

import { useState, useEffect, useRef } from 'react';
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
import { X, MousePointer2, Check, Trash2, Copy, Table, List, Regex } from 'lucide-react';
import { toast } from 'sonner';
import type { Artifact } from '@/types/artifacts';

export interface FieldMapping {
  id: string;
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  required: boolean;
  xpath: string;
  cssSelector: string;
  sampleValue: string;
  elementInfo: {
    tagName: string;
    className: string;
    id: string;
  };
  regexPattern?: string; // Optional regex pattern for extraction
  isArray?: boolean; // If true, extracts multiple values
  preview?: string[]; // Preview of extracted data
  // Checkbox/Radio group metadata (optional, for backward compatibility)
  checkboxConfig?: {
    isCheckboxGroup: boolean;
    inputType: 'checkbox' | 'radio';
    allOptions: string[];
    currentlyChecked: string | string[];
    multiSelect: boolean;
    extractionMode: 'checked_only' | 'all_options' | 'boolean';
  };
}

interface VisualDOMSelectorProps {
  artifact: Artifact;
  onSave: (fieldMappings: FieldMapping[]) => void;
  onCancel: () => void;
}

export function VisualDOMSelector({
  artifact,
  onSave,
  onCancel,
}: VisualDOMSelectorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [currentFieldName, setCurrentFieldName] = useState('');
  const [currentFieldType, setCurrentFieldType] = useState<'string' | 'number' | 'date' | 'boolean'>('string');
  const [currentFieldRequired, setCurrentFieldRequired] = useState(true);
  const [highlightedElement, setHighlightedElement] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState<string | null>(null);

  // Pattern detection state
  const [similarElements, setSimilarElements] = useState<HTMLElement[]>([]);
  const [showSimilarPrompt, setShowSimilarPrompt] = useState(false);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
  const [pendingFieldName, setPendingFieldName] = useState<string>(''); // Store field name during pattern prompt
  const [pendingFieldType, setPendingFieldType] = useState<'string' | 'number' | 'date' | 'boolean'>('string');
  const [pendingFieldRequired, setPendingFieldRequired] = useState<boolean>(true);
  const [showRegexBuilder, setShowRegexBuilder] = useState(false);
  const [regexPattern, setRegexPattern] = useState('');
  const [previewData, setPreviewData] = useState<string[]>([]);
  const [patternDetectionDismissed, setPatternDetectionDismissed] = useState(false); // Track if user dismissed pattern detection

  // Use refs to always get current values in event handlers
  const currentFieldNameRef = useRef(currentFieldName);
  const currentFieldTypeRef = useRef(currentFieldType);
  const currentFieldRequiredRef = useRef(currentFieldRequired);

  // Update refs when state changes
  useEffect(() => {
    currentFieldNameRef.current = currentFieldName;
  }, [currentFieldName]);

  useEffect(() => {
    currentFieldTypeRef.current = currentFieldType;
  }, [currentFieldType]);

  useEffect(() => {
    currentFieldRequiredRef.current = currentFieldRequired;
  }, [currentFieldRequired]);

  // Inject selection script into iframe when loaded
  useEffect(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;

    const handleLoad = () => {
      console.log('🎬 Iframe loaded, attempting to inject selection handlers...');

      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

        if (!iframeDoc) {
          console.error('❌ Cannot access iframe document (security restrictions?)');
          setIframeError('Cannot access document content. This may be a security restriction.');
          return;
        }

        console.log('✅ Iframe document accessible');
        setIframeLoaded(true);
        setIframeError(null);

        // Inject CSS for hover effects and pattern detection
        const style = iframeDoc.createElement('style');
        style.textContent = `
          .dom-selector-hover {
            outline: 2px dashed #3b82f6 !important;
            outline-offset: 2px !important;
            cursor: pointer !important;
          }
          .dom-selector-selected {
            outline: 3px solid #10b981 !important;
            outline-offset: 2px !important;
            background-color: rgba(16, 185, 129, 0.1) !important;
          }
          .dom-selector-similar {
            outline: 2px dashed #f59e0b !important;
            outline-offset: 2px !important;
            background-color: rgba(245, 158, 11, 0.05) !important;
          }
        `;
        iframeDoc.head.appendChild(style);
        console.log('✅ Injected hover/selection CSS styles');

        // Add event listeners for selection
        if (selectionMode) {
          console.log('🎯 Selection mode is ON, enabling element selection...');
          enableSelectionMode(iframeDoc);
        }
      } catch (error) {
        console.error('❌ Error injecting selection handlers:', error);
        setIframeError('Failed to set up element selection. Please try refreshing the page.');
      }
    };

    const handleError = () => {
      console.error('❌ Iframe failed to load');
      setIframeError('Failed to load document preview. Please check the file.');
      setIframeLoaded(false);
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  }, [selectionMode]);

  const enableSelectionMode = (iframeDoc: Document) => {
    console.log('🔧 Setting up element selection handlers...');

    // Hover effect
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target !== iframeDoc.body && target !== iframeDoc.documentElement) {
        target.classList.add('dom-selector-hover');
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target) {
        target.classList.remove('dom-selector-hover');
      }
    };

    // Click to select
    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as HTMLElement;
      if (!target || target === iframeDoc.body || target === iframeDoc.documentElement) {
        console.log('⚠️ Clicked on body/html element, ignoring');
        return;
      }

      console.log('🎯 Element clicked:', {
        tag: target.tagName,
        id: target.id,
        classes: target.className,
        text: target.textContent?.substring(0, 50)
      });

      // Remove hover class
      target.classList.remove('dom-selector-hover');

      // Capture element info
      handleElementSelected(target, iframeDoc);
    };

    iframeDoc.addEventListener('mouseover', handleMouseOver, true);
    iframeDoc.addEventListener('mouseout', handleMouseOut, true);
    iframeDoc.addEventListener('click', handleClick, true);

    console.log('✅ Element selection handlers attached');

    // Store cleanup function
    (iframeDoc as any)._cleanupSelectionMode = () => {
      console.log('🧹 Cleaning up selection mode handlers');
      iframeDoc.removeEventListener('mouseover', handleMouseOver, true);
      iframeDoc.removeEventListener('mouseout', handleMouseOut, true);
      iframeDoc.removeEventListener('click', handleClick, true);
    };
  };

  const disableSelectionMode = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;

    // Call cleanup function
    if ((iframeDoc as any)._cleanupSelectionMode) {
      (iframeDoc as any)._cleanupSelectionMode();
    }

    // Remove all selection classes
    iframeDoc.querySelectorAll('.dom-selector-hover, .dom-selector-selected').forEach(el => {
      el.classList.remove('dom-selector-hover', 'dom-selector-selected');
    });
  };

  const generateXPath = (element: HTMLElement, doc: Document): string => {
    // If element has ID, use it
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    // For table cells, use relative XPath with table position
    const table = element.closest('table');
    if (table) {
      // Find which table this is (counting all tables in document)
      const allTables = Array.from(doc.querySelectorAll('table'));
      const tableIndex = allTables.indexOf(table) + 1;

      // Find row within table
      const tr = element.closest('tr');
      const allRows = table.querySelectorAll('tr');
      const rowIndex = tr ? Array.from(allRows).indexOf(tr) + 1 : 1;

      // Find cell within row
      const td = element.closest('td, th');
      const cellIndex = td && tr ? Array.from(tr.children).indexOf(td) + 1 : 1;

      // Build relative XPath: //table[N]//tr[M]//td[K]//div[@class='data']
      // Use bracket notation [N] which lxml supports (not position()=N)
      let xpath = `//table[${tableIndex}]//tr[${rowIndex}]//td[${cellIndex}]`;

      // Add final element
      if (element.tagName.toLowerCase() !== 'td') {
        if (element.className && element.className.includes('data')) {
          xpath += `//div[contains(@class, 'data')]`;
        } else {
          xpath += `//${element.tagName.toLowerCase()}`;
        }
      }

      return xpath;
    }

    // Fallback: relative path without table
    return `//${element.tagName.toLowerCase()}`;
  };

  const generateCSSSelector = (element: HTMLElement): string => {
    // If element has ID, use it
    if (element.id) {
      return `#${element.id}`;
    }

    // Check if element is in a table - use structural path
    const table = element.closest('table');
    if (table) {
      // Get the iframe document
      const iframeDoc = element.ownerDocument;
      return generateTableCellSelector(element, table, iframeDoc);
    }

    // Otherwise, build contextual path
    return generateContextualPath(element);
  };

  const generateTableCellSelector = (element: HTMLElement, table: HTMLElement, doc: Document): string => {
    const parts: string[] = [];

    // Add table identifier
    const tableClasses = table.className.trim().split(/\s+/).filter(c => c && c.length > 2);
    if (tableClasses.length > 0) {
      parts.push(`table.${tableClasses[0]}`);
    } else {
      // Find which table number this is (use iframe document, not outer document)
      const allTables = Array.from(doc.querySelectorAll('table'));
      const tableIndex = allTables.indexOf(table) + 1;
      parts.push(`table:nth-of-type(${tableIndex})`);
    }

    // Find row position
    const tr = element.closest('tr');
    if (tr) {
      // Find all rows in table (whether in tbody or not)
      const allRows = Array.from(table.querySelectorAll('tr'));
      const rowIndex = allRows.indexOf(tr) + 1;

      // Don't include tbody in selector - it may not exist in raw HTML
      // (browsers auto-insert it, but stored HTML might not have it)
      parts.push(`tr:nth-of-type(${rowIndex})`);
    }

    // Find cell position
    const td = element.closest('td, th');
    if (td) {
      const cells = Array.from(td.parentElement!.children);
      const cellIndex = cells.indexOf(td) + 1;
      parts.push(`td:nth-of-type(${cellIndex})`);
    }

    // Add final element if not the cell itself
    if (element.tagName.toLowerCase() !== 'td' && element.tagName.toLowerCase() !== 'th') {
      const classes = element.className?.trim().split(/\s+/).filter(c => c && !c.startsWith('dom-selector'));
      if (classes && classes.length > 0) {
        parts.push(`${element.tagName.toLowerCase()}.${classes.join('.')}`);
      } else {
        parts.push(element.tagName.toLowerCase());
      }
    }

    return parts.join(' ');
  };

  const generateContextualPath = (element: HTMLElement): string => {
    // Build path with limited depth (max 4 levels)
    const parts: string[] = [];
    let current: HTMLElement | null = element;
    let depth = 0;
    const maxDepth = 4;

    while (current && depth < maxDepth) {
      let part = current.tagName.toLowerCase();

      const classes = current.className?.trim().split(/\s+/).filter(c => c && !c.startsWith('dom-selector'));
      if (classes && classes.length > 0) {
        part += `.${classes[0]}`;
      } else if (depth > 0) {
        // Add nth-of-type for elements without classes (except the target element)
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(el => el.tagName === current!.tagName);
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            part += `:nth-of-type(${index})`;
          }
        }
      }

      parts.unshift(part);
      current = current.parentElement;
      depth++;
    }

    return parts.join(' ');
  };

  // Pattern Detection Functions
  const findSimilarElements = (element: HTMLElement, doc: Document): HTMLElement[] => {
    const similar: HTMLElement[] = [];
    const tagName = element.tagName.toLowerCase();

    // Get all elements with same tag
    const allElements = doc.getElementsByTagName(tagName);

    // Extract classes (excluding our selection classes)
    const elementClasses = element.className
      ? element.className.split(/\s+/).filter(c => c && !c.startsWith('dom-selector'))
      : [];

    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i] as HTMLElement;
      if (el === element) continue; // Skip the selected element itself

      // Check if it has similar structure
      const elClasses = el.className
        ? el.className.split(/\s+/).filter(c => c && !c.startsWith('dom-selector'))
        : [];

      // Match if same tag and at least one common class, or same parent structure
      const hasCommonClass = elementClasses.some(c => elClasses.includes(c));
      const sameParentTag = el.parentElement?.tagName === element.parentElement?.tagName;

      if (hasCommonClass || (sameParentTag && elementClasses.length === 0)) {
        similar.push(el);
      }
    }

    console.log(`🔍 Found ${similar.length} similar elements to ${tagName}`);
    return similar;
  };

  const detectTableStructure = (element: HTMLElement): { isTable: boolean; headers: string[]; rows: string[][] } | null => {
    // Check if element is within a table
    let table = element.closest('table');
    if (!table) return null;

    const headers: string[] = [];
    const rows: string[][] = [];

    // Extract headers
    const headerCells = table.querySelectorAll('thead th, thead td');
    headerCells.forEach(cell => headers.push(cell.textContent?.trim() || ''));

    // If no thead, try first row
    if (headers.length === 0) {
      const firstRow = table.querySelector('tr');
      if (firstRow) {
        firstRow.querySelectorAll('th, td').forEach(cell => {
          headers.push(cell.textContent?.trim() || '');
        });
      }
    }

    // Extract data rows
    const dataRows = table.querySelectorAll('tbody tr, tr');
    dataRows.forEach((row, idx) => {
      if (idx === 0 && headers.length === 0) return; // Skip if we used first row as headers
      const rowData: string[] = [];
      row.querySelectorAll('td, th').forEach(cell => {
        rowData.push(cell.textContent?.trim() || '');
      });
      if (rowData.length > 0) rows.push(rowData);
    });

    console.log(`📊 Detected table with ${headers.length} columns and ${rows.length} rows`);
    return { isTable: true, headers, rows };
  };

  const detectListPattern = (element: HTMLElement): { isList: boolean; items: string[] } | null => {
    // Check if element is within a list
    let listParent = element.closest('ul, ol');
    if (!listParent) {
      // Check for repeating div pattern
      const parent = element.parentElement;
      if (!parent) return null;

      const siblings = Array.from(parent.children).filter(
        el => el.tagName === element.tagName && el.className === element.className
      );

      if (siblings.length >= 2) {
        const items = siblings.map(el => el.textContent?.trim() || '');
        console.log(`📝 Detected repeating pattern with ${items.length} items`);
        return { isList: true, items };
      }
      return null;
    }

    // Extract list items
    const items: string[] = [];
    listParent.querySelectorAll('li').forEach(li => {
      items.push(li.textContent?.trim() || '');
    });

    console.log(`📝 Detected list with ${items.length} items`);
    return { isList: true, items };
  };

  const detectCheckboxGroup = (element: HTMLElement): {
    isCheckboxGroup: boolean;
    inputType: 'checkbox' | 'radio';
    inputs: HTMLInputElement[];
    allOptions: string[];
    currentlyChecked: string | string[];
    multiSelect: boolean;
  } | null => {
    // Look for checkbox/radio inputs within the selected element
    const checkboxes = Array.from(element.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
    const radios = Array.from(element.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];

    // No inputs found - not a checkbox/radio group
    if (checkboxes.length === 0 && radios.length === 0) {
      return null;
    }

    // Determine which type we have (checkboxes take precedence)
    const inputType: 'checkbox' | 'radio' = checkboxes.length > 0 ? 'checkbox' : 'radio';
    const inputs = inputType === 'checkbox' ? checkboxes : radios;

    console.log(`☑️ Detected ${inputType} group with ${inputs.length} inputs`);

    // Extract all options and their labels
    const allOptions: string[] = [];
    const checkedOptions: string[] = [];

    inputs.forEach((input) => {
      // Try multiple methods to find the label text
      let labelText = '';

      // Method 1: Check for <label> with matching 'for' attribute
      if (input.id) {
        const label = element.querySelector(`label[for="${input.id}"]`);
        if (label) {
          labelText = label.textContent?.trim() || '';
        }
      }

      // Method 2: Check if input is inside a <label>
      if (!labelText) {
        const parentLabel = input.closest('label');
        if (parentLabel) {
          // Get text content but exclude the input itself
          const clone = parentLabel.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('input').forEach(inp => inp.remove());
          labelText = clone.textContent?.trim() || '';
        }
      }

      // Method 3: Check for adjacent text/label (next sibling)
      if (!labelText) {
        let sibling = input.nextSibling;
        while (sibling) {
          if (sibling.nodeType === Node.TEXT_NODE) {
            const text = sibling.textContent?.trim();
            if (text) {
              labelText = text;
              break;
            }
          } else if (sibling.nodeType === Node.ELEMENT_NODE) {
            const el = sibling as HTMLElement;
            if (el.tagName === 'LABEL') {
              labelText = el.textContent?.trim() || '';
              break;
            }
            // Sometimes text is in a span or other element right after input
            const text = el.textContent?.trim();
            if (text && text.length < 100) {
              labelText = text;
              break;
            }
          }
          sibling = sibling.nextSibling;
        }
      }

      // Method 4: Fall back to value attribute or name
      if (!labelText) {
        labelText = input.value || input.name || `Option ${allOptions.length + 1}`;
      }

      allOptions.push(labelText);

      // Track checked state
      if (input.checked) {
        checkedOptions.push(labelText);
      }
    });

    console.log(`☑️ Options found: ${allOptions.join(', ')}`);
    console.log(`✓ Currently checked: ${checkedOptions.join(', ')}`);

    return {
      isCheckboxGroup: true,
      inputType,
      inputs,
      allOptions,
      currentlyChecked: inputType === 'radio' ? (checkedOptions[0] || '') : checkedOptions,
      multiSelect: inputType === 'checkbox',
    };
  };

  const generateRegexFromSample = (text: string): string => {
    // Common patterns
    if (/^\d+$/.test(text)) return '\\d+';
    if (/^[\d,]+$/.test(text)) return '[\\d,]+';
    if (/^\$[\d,.]+$/.test(text)) return '\\$[\\d,.]+';
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return '\\d{4}-\\d{2}-\\d{2}';
    if (/^[\w.]+@[\w.]+$/.test(text)) return '[\\w.]+@[\\w.]+';
    if (/^\(\d{3}\)\s*\d{3}-\d{4}$/.test(text)) return '\\(\\d{3}\\)\\s*\\d{3}-\\d{4}';

    // Default: escape special chars and replace sequences
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
               .replace(/\d+/g, '\\d+')
               .replace(/[a-z]+/gi, '[a-zA-Z]+');
  };

  const handleElementSelected = (element: HTMLElement, doc: Document) => {
    // Read from refs to get current values (not captured closure values)
    const fieldName = currentFieldNameRef.current.trim();
    const fieldType = currentFieldTypeRef.current;
    const fieldRequired = currentFieldRequiredRef.current;

    console.log(`🎯 Element selected. Field name from ref: "${fieldName}"`);

    if (!fieldName) {
      toast.error('Please enter a field name first');
      return;
    }

    // Pattern Detection: Check for tables, lists, checkboxes, and similar elements
    const tableDetection = detectTableStructure(element);
    const listDetection = detectListPattern(element);
    const checkboxDetection = detectCheckboxGroup(element);
    const similar = findSimilarElements(element, doc);

    // Show pattern detection prompts
    if (tableDetection && tableDetection.isTable) {
      toast.success(`📊 Table detected! ${tableDetection.headers.length} columns, ${tableDetection.rows.length} rows`);
    }

    if (listDetection && listDetection.isList && listDetection.items.length > 3) {
      toast.info(`📝 List pattern detected with ${listDetection.items.length} items`);
    }

    if (checkboxDetection && checkboxDetection.isCheckboxGroup) {
      const checkedCount = Array.isArray(checkboxDetection.currentlyChecked)
        ? checkboxDetection.currentlyChecked.length
        : (checkboxDetection.currentlyChecked ? 1 : 0);
      toast.success(`☑️ ${checkboxDetection.inputType === 'checkbox' ? 'Checkbox' : 'Radio'} group detected! ${checkboxDetection.allOptions.length} options, ${checkedCount} selected`);
    }

    // If similar elements found, show prompt and store pending field info
    // Only show if user hasn't dismissed it and there are 3+ similar elements
    if (!patternDetectionDismissed && similar.length >= 3) {
      // Store field info for later use
      setPendingFieldName(fieldName);
      setPendingFieldType(fieldType);
      setPendingFieldRequired(fieldRequired);
      setSelectedElement(element);
      setSimilarElements(similar);
      setShowSimilarPrompt(true);

      // Highlight similar elements
      similar.forEach(el => el.classList.add('dom-selector-similar'));
      toast.info(`Found ${similar.length} similar elements!`, { duration: 5000 });

      // Don't proceed with single mapping yet - wait for user choice
      return;
    }

    // Check if field name already exists - use functional setState to get latest
    setFieldMappings((prevMappings) => {
      console.log(`📊 Current mappings:`, prevMappings.map(m => m.name));

      // Check for duplicate field name
      if (prevMappings.some(f => f.name === fieldName)) {
        toast.error('Field name already exists');
        return prevMappings; // Return unchanged
      }

      // Generate selectors
      const xpath = generateXPath(element, doc);
      const cssSelector = generateCSSSelector(element);
      const sampleValue = element.textContent?.trim() || '';

      // Create field mapping
      const mapping: FieldMapping = {
        id: Date.now().toString(),
        name: fieldName,
        type: fieldType,
        required: fieldRequired,
        xpath,
        cssSelector,
        sampleValue,
        elementInfo: {
          tagName: element.tagName.toLowerCase(),
          className: element.className || '',
          id: element.id || '',
        },
      };

      // Add checkbox configuration if detected
      if (checkboxDetection && checkboxDetection.isCheckboxGroup) {
        // Generate checkbox-aware selector that targets checked inputs
        // This selector will work across documents regardless of which option is checked
        const containerSelector = cssSelector;
        const checkedSelector = `${containerSelector} input[type="${checkboxDetection.inputType}"]:checked`;

        // Override CSS selector to use :checked pseudo-selector
        mapping.cssSelector = checkedSelector;
        mapping.xpath = `${xpath}//input[@type="${checkboxDetection.inputType}" and @checked]`;

        mapping.checkboxConfig = {
          isCheckboxGroup: true,
          inputType: checkboxDetection.inputType,
          allOptions: checkboxDetection.allOptions,
          currentlyChecked: checkboxDetection.currentlyChecked,
          multiSelect: checkboxDetection.multiSelect,
          extractionMode: 'checked_only', // Default: extract only checked values
        };
      }

      console.log(`✅ Adding field mapping:`, mapping);
      console.log(`Previous mappings count: ${prevMappings.length}, New count: ${prevMappings.length + 1}`);

      // Highlight the element
      element.classList.add('dom-selector-selected');
      setHighlightedElement(mapping.id);

      toast.success(`Field "${mapping.name}" mapped successfully! (Total: ${prevMappings.length + 1})`);

      // Return new array with added mapping
      return [...prevMappings, mapping];
    });

    // Reset field name for next selection
    setCurrentFieldName('');
  };

  const removeFieldMapping = (id: string) => {
    setFieldMappings((prevMappings) => {
      const filtered = prevMappings.filter(f => f.id !== id);
      console.log(`🗑️ Removing field mapping. Remaining: ${filtered.length}`);
      return filtered;
    });

    // Remove highlight from element
    const iframe = iframeRef.current;
    if (iframe) {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.querySelectorAll('.dom-selector-selected').forEach(el => {
          el.classList.remove('dom-selector-selected');
        });
      }
    }

    toast.info('Field mapping removed');
  };

  const handleSave = () => {
    if (fieldMappings.length === 0) {
      toast.error('Please map at least one field');
      return;
    }

    disableSelectionMode();
    onSave(fieldMappings);
  };

  const toggleSelectionMode = () => {
    const newMode = !selectionMode;
    console.log(`🔄 Toggling selection mode: ${selectionMode} → ${newMode}`);

    if (selectionMode) {
      // Turning off
      disableSelectionMode();
      setSelectionMode(false);
      toast.info('Selection mode disabled');
    } else {
      // Turning on
      setSelectionMode(true);

      // Also inject handlers into already-loaded iframe
      const iframe = iframeRef.current;
      if (iframe) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            enableSelectionMode(iframeDoc);
            toast.success('Selection mode enabled! Hover over elements to select them.');
          } else {
            toast.error('Cannot enable selection - iframe not accessible');
          }
        } catch (error) {
          console.error('Error enabling selection mode:', error);
          toast.error('Failed to enable selection mode');
        }
      }
    }
  };

  const handleSelectAllSimilar = () => {
    if (!selectedElement || similarElements.length === 0) return;

    const iframe = iframeRef.current;
    if (!iframe) return;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;

    // Use pending state instead of refs
    const fieldName = pendingFieldName.trim();
    const fieldType = pendingFieldType;
    const fieldRequired = pendingFieldRequired;

    if (!fieldName) {
      toast.error('Please enter a field name first');
      return;
    }

    // Check for duplicate field name
    if (fieldMappings.some(f => f.name === fieldName)) {
      toast.error('Field name already exists');
      return;
    }

    // Generate a CSS selector that matches all similar elements
    const elementClasses = selectedElement.className
      ? selectedElement.className.split(/\s+/).filter(c => c && !c.startsWith('dom-selector'))
      : [];

    const cssSelector = elementClasses.length > 0
      ? `${selectedElement.tagName.toLowerCase()}.${elementClasses.join('.')}`
      : selectedElement.tagName.toLowerCase();

    // Extract all values
    const allElements = [selectedElement, ...similarElements];
    const previewValues = allElements.map(el => el.textContent?.trim() || '');

    // Create field mapping for array of values
    const mapping: FieldMapping = {
      id: Date.now().toString(),
      name: fieldName,
      type: fieldType,
      required: fieldRequired,
      xpath: `//${selectedElement.tagName.toLowerCase()}[contains(@class, "${elementClasses[0] || ''}")]`,
      cssSelector,
      sampleValue: previewValues[0],
      elementInfo: {
        tagName: selectedElement.tagName.toLowerCase(),
        className: selectedElement.className || '',
        id: selectedElement.id || '',
      },
      isArray: true,
      preview: previewValues.slice(0, 10), // Show first 10
    };

    setFieldMappings(prev => [...prev, mapping]);

    // Highlight all similar elements
    allElements.forEach(el => el.classList.add('dom-selector-selected'));

    // Clear similar elements state and pending values
    similarElements.forEach(el => el.classList.remove('dom-selector-similar'));
    setSimilarElements([]);
    setShowSimilarPrompt(false);
    setSelectedElement(null);
    setPendingFieldName('');
    setPendingFieldType('string');
    setPendingFieldRequired(true);
    setCurrentFieldName('');

    toast.success(`Mapped ${allElements.length} similar elements to "${fieldName}"!`);
  };

  const handleSkipSimilar = () => {
    // Mark pattern detection as dismissed for this session
    setPatternDetectionDismissed(true);

    if (!selectedElement) return;

    const iframe = iframeRef.current;
    if (!iframe) return;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;

    // Use pending state to map just the selected element
    const fieldName = pendingFieldName.trim();
    const fieldType = pendingFieldType;
    const fieldRequired = pendingFieldRequired;

    if (!fieldName) {
      toast.error('Please enter a field name first');
      return;
    }

    // Check for duplicate field name
    if (fieldMappings.some(f => f.name === fieldName)) {
      toast.error('Field name already exists');
      return;
    }

    // Generate selectors for single element
    const xpath = generateXPath(selectedElement, iframeDoc);
    const cssSelector = generateCSSSelector(selectedElement);
    const sampleValue = selectedElement.textContent?.trim() || '';

    // Detect checkbox group in this element
    const checkboxDetection = detectCheckboxGroup(selectedElement);

    // Create field mapping for single element
    const mapping: FieldMapping = {
      id: Date.now().toString(),
      name: fieldName,
      type: fieldType,
      required: fieldRequired,
      xpath,
      cssSelector,
      sampleValue,
      elementInfo: {
        tagName: selectedElement.tagName.toLowerCase(),
        className: selectedElement.className || '',
        id: selectedElement.id || '',
      },
    };

    // Add checkbox configuration if detected
    if (checkboxDetection && checkboxDetection.isCheckboxGroup) {
      // Generate checkbox-aware selector that targets checked inputs
      const containerSelector = cssSelector;
      const checkedSelector = `${containerSelector} input[type="${checkboxDetection.inputType}"]:checked`;

      // Override CSS selector to use :checked pseudo-selector
      mapping.cssSelector = checkedSelector;
      mapping.xpath = `${xpath}//input[@type="${checkboxDetection.inputType}" and @checked]`;

      mapping.checkboxConfig = {
        isCheckboxGroup: true,
        inputType: checkboxDetection.inputType,
        allOptions: checkboxDetection.allOptions,
        currentlyChecked: checkboxDetection.currentlyChecked,
        multiSelect: checkboxDetection.multiSelect,
        extractionMode: 'checked_only', // Default: extract only checked values
      };
    }

    setFieldMappings(prev => [...prev, mapping]);

    // Highlight the selected element
    selectedElement.classList.add('dom-selector-selected');

    // Clear similar highlighting and state
    similarElements.forEach(el => el.classList.remove('dom-selector-similar'));
    setSimilarElements([]);
    setShowSimilarPrompt(false);
    setSelectedElement(null);
    setPendingFieldName('');
    setPendingFieldType('string');
    setPendingFieldRequired(true);
    setCurrentFieldName('');

    toast.success(`Field "${fieldName}" mapped successfully!`);
  };

  // Get HTML content - prefer srcdoc for better reliability
  const htmlContent = artifact.raw_content?.html || null;
  const htmlUrl = !htmlContent ? `/api/artifacts/${artifact.id}/download` : null;

  // Check if HTML content is available
  if (!htmlContent && !htmlUrl) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-lg font-semibold mb-2">No HTML Content Available</div>
          <p className="text-gray-600 mb-4">
            This artifact doesn't have HTML content to display.
          </p>
          <Button onClick={onCancel}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between bg-gray-50">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Visual Template Builder</h2>
          <p className="text-sm text-gray-600">
            {selectionMode ? (
              <span className="text-blue-600 font-medium">
                ✓ Selection mode active - Click elements in the document to map them
              </span>
            ) : (
              'Click "Enable Selection" button to start mapping fields'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={selectionMode ? "default" : "outline"}
            onClick={toggleSelectionMode}
            className={selectionMode ? "gap-2 bg-blue-600 hover:bg-blue-700" : "gap-2"}
            disabled={!iframeLoaded && !iframeError}
          >
            <MousePointer2 className="w-4 h-4" />
            {selectionMode ? 'Selection Mode ON' : 'Enable Selection'}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={fieldMappings.length === 0}>
            <Check className="w-4 h-4 mr-2" />
            Save Template ({fieldMappings.length} fields)
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {iframeError && (
        <div className="bg-red-50 border-b border-red-200 p-3 flex items-center gap-2">
          <div className="text-red-600 text-sm">
            <strong>Error:</strong> {iframeError}
          </div>
        </div>
      )}

      {/* Loading Banner */}
      {!iframeLoaded && !iframeError && (
        <div className="bg-blue-50 border-b border-blue-200 p-3 flex items-center gap-2">
          <div className="text-blue-600 text-sm">
            Loading document preview...
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left: HTML Preview */}
        <div className="flex-1 border-r overflow-hidden">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="font-medium text-gray-900">Document Preview</h3>
              <p className="text-sm text-gray-600">{artifact.original_filename}</p>
            </div>
            <div className="flex-1 overflow-auto bg-white">
              <iframe
                ref={iframeRef}
                {...(htmlContent ? { srcDoc: htmlContent } : { src: htmlUrl! })}
                className="w-full h-full border-0"
                title="HTML Preview"
                sandbox="allow-same-origin allow-scripts"
              />
            </div>
          </div>
        </div>

        {/* Right: Field Mapping Panel */}
        <div className="w-96 overflow-y-auto bg-gray-50 p-4 space-y-4 flex-shrink-0">
          {/* Instructions */}
          {fieldMappings.length === 0 && (
            <Card className="p-4 bg-blue-50 border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-2">📝 Step-by-step:</h3>
              <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                <li><strong>Enter a field name</strong> in the input below (e.g., "brand_name")</li>
                <li><strong>Choose field type</strong> and whether it's required</li>
                <li><strong>Click "Enable Selection"</strong> button at the top</li>
                <li><strong>Click the element</strong> in the document that contains this field</li>
                <li><strong>Repeat steps 1-4</strong> for all fields you need to extract</li>
                <li><strong>Click "Save Template"</strong> when done</li>
              </ol>
            </Card>
          )}

          <Card className="p-4">
            <h3 className="font-medium text-gray-900 mb-4">Add New Field</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="field-name">Field Name *</Label>
                <Input
                  id="field-name"
                  value={currentFieldName}
                  onChange={(e) => setCurrentFieldName(e.target.value)}
                  placeholder="e.g., product_name"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter a name, then enable selection and click an element
                </p>
              </div>

              <div>
                <Label htmlFor="field-type">Field Type</Label>
                <Select
                  value={currentFieldType}
                  onValueChange={(v: any) => setCurrentFieldType(v)}
                >
                  <SelectTrigger>
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
                  id="field-required"
                  checked={currentFieldRequired}
                  onChange={(e) => setCurrentFieldRequired(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="field-required" className="cursor-pointer">
                  Required field
                </Label>
              </div>

              {selectionMode && currentFieldName && (
                <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                  ✓ Ready! Click an element in the document to map "{currentFieldName}"
                </p>
              )}
            </div>
          </Card>

          {/* Similar Elements Prompt */}
          {showSimilarPrompt && similarElements.length > 0 && (
            <Card className="p-4 bg-amber-50 border-amber-300 max-w-full">
              <div className="flex items-start gap-3">
                <Copy className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-amber-900 mb-2 break-words">
                    Pattern Detected!
                  </h4>
                  <p className="text-xs text-amber-700 mb-1 font-medium">
                    {similarElements.length + 1} similar elements found
                  </p>
                  <p className="text-sm text-amber-800 mb-3">
                    Would you like to select all of them at once?
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={handleSelectAllSimilar}
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-xs w-full"
                    >
                      <Copy className="w-3 h-3 mr-2" />
                      Select All {similarElements.length + 1}
                    </Button>
                    <Button
                      onClick={handleSkipSimilar}
                      variant="outline"
                      size="sm"
                      className="text-xs w-full"
                    >
                      Skip, select only one
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Mapped Fields */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Mapped Fields ({fieldMappings.length})</h3>
            <div className="space-y-2">
              {fieldMappings.map((mapping) => (
                <Card key={mapping.id} className="p-3 max-w-full">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium text-gray-900 break-words">{mapping.name}</div>
                        {mapping.isArray && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded whitespace-nowrap">
                            Array ({mapping.preview?.length || 0})
                          </span>
                        )}
                        {mapping.checkboxConfig && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded whitespace-nowrap">
                            ☑ {mapping.checkboxConfig.inputType === 'checkbox' ? 'Checkbox' : 'Radio'} ({mapping.checkboxConfig.allOptions.length})
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {mapping.type}
                        {mapping.required && <span className="text-red-500"> *</span>}
                        {mapping.regexPattern && (
                          <span className="text-xs text-blue-600 ml-2">
                            <Regex className="w-3 h-3 inline mr-1" />
                            regex
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 font-mono break-all">
                        {mapping.cssSelector.length > 40
                          ? mapping.cssSelector.substring(0, 40) + '...'
                          : mapping.cssSelector
                        }
                      </div>
                      {mapping.checkboxConfig ? (
                        <div className="text-xs text-gray-400 mt-2 bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
                          <div className="font-semibold text-gray-600 mb-1">Options ({mapping.checkboxConfig.allOptions.length}):</div>
                          {mapping.checkboxConfig.allOptions.map((option, idx) => {
                            const isChecked = Array.isArray(mapping.checkboxConfig!.currentlyChecked)
                              ? mapping.checkboxConfig!.currentlyChecked.includes(option)
                              : mapping.checkboxConfig!.currentlyChecked === option;
                            return (
                              <div key={idx} className="break-words">
                                {isChecked ? '☑' : '☐'} {option}
                              </div>
                            );
                          })}
                          <div className="text-xs text-blue-600 mt-1">
                            Mode: {mapping.checkboxConfig.extractionMode}
                          </div>
                        </div>
                      ) : mapping.isArray && mapping.preview && mapping.preview.length > 0 ? (
                        <div className="text-xs text-gray-400 mt-2 bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
                          <div className="font-semibold text-gray-600 mb-1">Preview ({mapping.preview.length} items):</div>
                          {mapping.preview.map((val, idx) => (
                            <div key={idx} className="break-words">
                              {idx + 1}. {val.length > 60 ? val.substring(0, 60) + '...' : val}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 mt-1 break-words">
                          Sample: {mapping.sampleValue.substring(0, 50)}
                          {mapping.sampleValue.length > 50 && '...'}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFieldMapping(mapping.id)}
                      className="flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </Card>
              ))}

              {fieldMappings.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No fields mapped yet.
                  <br />
                  Enable selection mode and click elements to start.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
