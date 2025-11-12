'use client';

/**
 * HTML Selector Component
 *
 * Renders HTML in an iframe with click-to-select functionality
 * Generates CSS selectors and XPath for clicked elements
 */

import { useRef, useEffect, useState } from 'react';
import type { Artifact } from '@/types/artifacts';
import type { FieldSelection } from './dom-selector';
import { generateCssSelector, generateXPath } from '@/lib/selector-utils';

interface HtmlSelectorProps {
  artifact: Artifact;
  isSelecting: boolean;
  selections: FieldSelection[];
  onElementSelected: (selection: Omit<FieldSelection, 'id' | 'fieldName' | 'fieldType' | 'required'>) => void;
}

export function HtmlSelector({
  artifact,
  isSelecting,
  selections,
  onElementSelected
}: HtmlSelectorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [highlightedElements, setHighlightedElements] = useState<Element[]>([]);

  /**
   * Inject selection script into iframe
   */
  useEffect(() => {
    if (!iframeRef.current || !iframeReady) return;

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!iframeDoc) return;

    // Inject styles for highlighting
    const style = iframeDoc.createElement('style');
    style.textContent = `
      .inspector-dom-selectable {
        cursor: pointer !important;
        transition: all 0.2s ease;
      }

      .inspector-dom-selectable:hover {
        outline: 2px solid #3b82f6 !important;
        outline-offset: 2px;
        background-color: rgba(59, 130, 246, 0.1) !important;
      }

      .inspector-dom-selected {
        outline: 3px solid #10b981 !important;
        outline-offset: 2px;
        background-color: rgba(16, 185, 129, 0.15) !important;
        position: relative;
      }

      .inspector-dom-selected::after {
        content: '✓ Selected';
        position: absolute;
        top: -24px;
        left: 0;
        background: #10b981;
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        z-index: 1000;
      }
    `;
    iframeDoc.head.appendChild(style);

    // Add click handler if selecting
    const handleClick = (e: MouseEvent) => {
      if (!isSelecting) return;

      e.preventDefault();
      e.stopPropagation();

      const target = e.target as Element;

      // Don't select html, body, or script tags
      if (['HTML', 'BODY', 'SCRIPT', 'STYLE', 'LINK', 'META'].includes(target.tagName)) {
        return;
      }

      // Generate selectors
      const cssSelector = generateCssSelector(target);
      const xpath = generateXPath(target);
      const sampleValue = target.textContent?.trim() || '';

      // Get element info
      const elementInfo = {
        tagName: target.tagName.toLowerCase(),
        className: target.className || '',
        id: target.id || ''
      };

      // Mark as selected
      target.classList.add('inspector-dom-selected');
      setHighlightedElements(prev => [...prev, target]);

      // Notify parent
      onElementSelected({
        cssSelector,
        xpath,
        sampleValue,
        elementInfo
      });
    };

    // Make all elements selectable when in selecting mode
    if (isSelecting) {
      const allElements = iframeDoc.querySelectorAll('*');
      allElements.forEach(el => {
        if (!['HTML', 'BODY', 'SCRIPT', 'STYLE', 'LINK', 'META'].includes(el.tagName)) {
          el.classList.add('inspector-dom-selectable');
        }
      });

      iframeDoc.addEventListener('click', handleClick);
    } else {
      // Remove selectable class
      const allElements = iframeDoc.querySelectorAll('.inspector-dom-selectable');
      allElements.forEach(el => el.classList.remove('inspector-dom-selectable'));

      iframeDoc.removeEventListener('click', handleClick);
    }

    return () => {
      iframeDoc.removeEventListener('click', handleClick);
    };
  }, [iframeReady, isSelecting, onElementSelected]);

  /**
   * Highlight existing selections
   */
  useEffect(() => {
    if (!iframeRef.current || !iframeReady) return;

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;

    // Clear previous highlights
    highlightedElements.forEach(el => {
      el.classList.remove('inspector-dom-selected');
    });

    // Highlight current selections
    selections.forEach(selection => {
      if (selection.cssSelector) {
        try {
          const element = iframeDoc.querySelector(selection.cssSelector);
          if (element) {
            element.classList.add('inspector-dom-selected');
          }
        } catch (error) {
          console.warn('Invalid selector:', selection.cssSelector);
        }
      }
    });
  }, [selections, iframeReady, highlightedElements]);

  /**
   * Get HTML content from artifact
   */
  const getHtmlContent = (): string => {
    if (artifact.raw_content?.text) {
      return artifact.raw_content.text;
    }
    return '<p>No HTML content available</p>';
  };

  return (
    <div className="relative">
      <div className="border rounded-lg overflow-hidden bg-white" style={{ height: '70vh' }}>
        <iframe
          ref={iframeRef}
          srcDoc={getHtmlContent()}
          onLoad={() => setIframeReady(true)}
          className="w-full h-full"
          sandbox="allow-same-origin"
          title="HTML Preview"
        />
      </div>

      {/* Selection Mode Indicator */}
      {isSelecting && (
        <div className="absolute top-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-10">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-sm font-medium">Click any element to select it</span>
        </div>
      )}

      {/* Selection Count */}
      {selections.length > 0 && (
        <div className="absolute top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-10">
          <span className="text-sm font-medium">
            {selections.length} field{selections.length !== 1 ? 's' : ''} selected
          </span>
        </div>
      )}
    </div>
  );
}
