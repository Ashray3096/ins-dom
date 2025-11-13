'use client';

/**
 * Email Visual Selector Component
 *
 * AI-powered email field extraction with user-provided prompts
 * Features:
 * - Email preview (headers + body)
 * - User enters extraction instructions
 * - AI generates field suggestions
 * - User reviews and saves template
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail, Sparkles, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Artifact } from '@/types/artifacts';

// ParsedEmail type (matches email-parser.ts)
interface ParsedEmail {
  headers: {
    from: string;
    fromName: string;
    fromEmail: string;
    to: string;
    subject: string;
    date: string | null;
  };
  body: {
    html?: string;
    text: string;
  };
  attachments: Array<{
    filename?: string;
    contentType: string;
    size: number;
  }>;
}

interface EmailFieldSuggestion {
  name: string;
  value: string;
  description: string;
}

interface EmailVisualSelectorProps {
  artifact: Artifact;
  onSave: (extractionPrompt: string, fields: string[]) => void;
  onCancel: () => void;
}

export function EmailVisualSelector({
  artifact,
  onSave,
  onCancel,
}: EmailVisualSelectorProps) {
  const [parsedEmail, setParsedEmail] = useState<ParsedEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [extractionPrompt, setExtractionPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [suggestedFields, setSuggestedFields] = useState<EmailFieldSuggestion[]>([]);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  // Parse email on mount
  useEffect(() => {
    parseEmail();
  }, [artifact]);

  const parseEmail = async () => {
    try {
      // Call server-side API to parse email (mailparser is Node.js only)
      const response = await fetch(`/api/emails/${artifact.id}/parse`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to parse email');
      }

      const parsedData = result.data;
      setParsedEmail(parsedData);

      // Auto-suggest standard email fields
      const standardFields: EmailFieldSuggestion[] = [
        { name: 'from_email', value: parsedData.headers.fromEmail, description: 'Sender email address' },
        { name: 'from_name', value: parsedData.headers.fromName, description: 'Sender name' },
        { name: 'to', value: parsedData.headers.to, description: 'Recipient' },
        { name: 'subject', value: parsedData.headers.subject, description: 'Email subject' },
        { name: 'date', value: parsedData.headers.date || '', description: 'Email date' },
      ];

      setSuggestedFields(standardFields);
      // Auto-select standard fields
      setSelectedFields(new Set(standardFields.map(f => f.name)));

    } catch (error) {
      console.error('Error parsing email:', error);
      toast.error('Failed to parse email content');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFields = async () => {
    if (!extractionPrompt.trim()) {
      toast.error('Please enter extraction instructions');
      return;
    }

    if (!parsedEmail) return;

    try {
      setGenerating(true);

      // Call AI to suggest additional fields based on prompt
      const response = await fetch('/api/extract/email-ai/suggest-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_text: parsedEmail.body.text,
          extraction_prompt: extractionPrompt,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate fields');
      }

      // Add AI-suggested fields to the list
      const aiFields = result.suggested_fields || [];
      setSuggestedFields([...suggestedFields, ...aiFields]);

      // Auto-select AI-suggested fields
      const newSelected = new Set(selectedFields);
      aiFields.forEach((field: EmailFieldSuggestion) => newSelected.add(field.name));
      setSelectedFields(newSelected);

      toast.success(`Generated ${aiFields.length} additional fields`);

    } catch (error) {
      console.error('Error generating fields:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate fields');
    } finally {
      setGenerating(false);
    }
  };

  const toggleField = (fieldName: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(fieldName)) {
      newSelected.delete(fieldName);
    } else {
      newSelected.add(fieldName);
    }
    setSelectedFields(newSelected);
  };

  const handleSave = () => {
    if (selectedFields.size === 0) {
      toast.error('Please select at least one field');
      return;
    }

    const fieldsArray = Array.from(selectedFields);
    onSave(extractionPrompt, fieldsArray);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!parsedEmail) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-gray-500">
          <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p>Failed to parse email</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel: Email Preview */}
      <div className="flex-1 flex flex-col border-r bg-white overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Email Preview</h2>
          <p className="text-sm text-gray-500 mt-1">Review email content before extraction</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Email Headers */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-sm">Email Headers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-[80px_1fr] gap-2">
                <span className="text-gray-600">From:</span>
                <span className="font-medium">{parsedEmail.headers.from}</span>

                <span className="text-gray-600">To:</span>
                <span>{parsedEmail.headers.to}</span>

                <span className="text-gray-600">Subject:</span>
                <span className="font-medium">{parsedEmail.headers.subject}</span>

                <span className="text-gray-600">Date:</span>
                <span>{parsedEmail.headers.date?.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Email Body */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Email Body</CardTitle>
            </CardHeader>
            <CardContent>
              {parsedEmail.body.html ? (
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: parsedEmail.body.html }}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-xs font-mono text-gray-700 bg-gray-50 p-4 rounded">
                  {parsedEmail.body.text}
                </pre>
              )}
            </CardContent>
          </Card>

          {/* Attachments */}
          {parsedEmail.attachments.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">Attachments ({parsedEmail.attachments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  {parsedEmail.attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-gray-600">{att.filename || 'Unnamed'}</span>
                      <span className="text-xs text-gray-400">({(att.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Right Panel: Field Generation */}
      <div className="w-96 flex flex-col bg-white">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Extract Fields</h2>
          <p className="text-sm text-gray-500 mt-1">
            {selectedFields.size} field{selectedFields.size !== 1 ? 's' : ''} selected
          </p>
        </div>

        {/* Extraction Prompt */}
        <div className="p-4 border-b">
          <Label htmlFor="prompt" className="text-sm font-medium">
            What should we extract from these emails?
          </Label>
          <Textarea
            id="prompt"
            value={extractionPrompt}
            onChange={(e) => setExtractionPrompt(e.target.value)}
            placeholder="e.g., Extract company names, investment amounts, and investor names mentioned in the email"
            rows={4}
            className="mt-2"
          />
          <Button
            onClick={handleGenerateFields}
            disabled={generating || !extractionPrompt.trim()}
            className="w-full mt-3"
            size="sm"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Fields with AI
              </>
            )}
          </Button>
        </div>

        {/* Field List */}
        <div className="flex-1 overflow-y-auto p-4">
          {suggestedFields.length === 0 ? (
            <div className="text-center text-gray-500 py-12 text-sm">
              <p>Standard email fields loaded</p>
              <p className="text-xs mt-2">Add extraction instructions to generate custom fields</p>
            </div>
          ) : (
            <div className="space-y-2">
              {suggestedFields.map((field) => (
                <Card
                  key={field.name}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedFields.has(field.name) ? 'bg-blue-50 border-blue-300' : ''
                  }`}
                  onClick={() => toggleField(field.name)}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                      {selectedFields.has(field.name) ? (
                        <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 border-2 border-gray-300 rounded" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{field.name}</div>
                      {field.description && (
                        <div className="text-xs text-gray-500 mt-1">{field.description}</div>
                      )}
                      {field.value && (
                        <div className="text-xs text-gray-600 mt-1 truncate">
                          Sample: {field.value}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t bg-gray-50 space-y-2">
          <Button
            onClick={handleSave}
            className="w-full"
            disabled={selectedFields.size === 0}
          >
            <Check className="w-4 h-4 mr-2" />
            Save Template ({selectedFields.size} fields)
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
