'use client';

/**
 * AI Chat Panel - Claude Style
 * Scrollable messages, fixed input at bottom
 */

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Send, Plus, Database as DatabaseIcon, ArrowRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { QuickStartCards } from './quick-start-cards';
import { AnalysisProgress } from './analysis-progress';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: SchemaSuggestion[];
  timestamp: Date;
}

interface SchemaSuggestion {
  type: 'dimension' | 'fact' | 'relationship';
  name: string;
  description: string;
  fields?: Array<{ name: string; type: string; source?: string }>;
  reasoning?: string;
}

interface AIChatPanelProps {
  entities: any[];
  onCreateEntity: (suggestion: SchemaSuggestion) => void;
  onCreateRelationship: (suggestion: SchemaSuggestion) => void;
}

export function AIChatPanel({ entities, onCreateEntity, onCreateRelationship }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    // Restore messages from sessionStorage
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('ai-chat-messages');
      if (saved) {
        try {
          return JSON.parse(saved).map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(1);
  const [analysisLabel, setAnalysisLabel] = useState('');
  const [showCards, setShowCards] = useState(true);
  const [hasRunAnalysis, setHasRunAnalysis] = useState(() => {
    // Check if analysis has been run in this session
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('ai-analysis-run') === 'true';
    }
    return false;
  });
  const [selectedEntity, setSelectedEntity] = useState<string | null>(() => {
    // Restore selected entity from sessionStorage
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('ai-selected-entity');
    }
    return null;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get INTERIM entities for dropdown
  const interimEntities = entities.filter(e => e.entity_type === 'INTERIM');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Save messages to sessionStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      sessionStorage.setItem('ai-chat-messages', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    // Only run auto-analysis if it hasn't been run in this session
    if (!hasRunAnalysis) {
      runAutoAnalysis();
    }
  }, [hasRunAnalysis]);

  const runAutoAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisStep(1);
    setAnalysisLabel('Understanding your entities...');

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      setAnalysisStep(2);
      setAnalysisLabel('Reviewing sample data...');
      await new Promise(resolve => setTimeout(resolve, 800));
      setAnalysisStep(3);
      setAnalysisLabel('Generating suggestions...');

      const response = await fetch('/api/star-schema/auto-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_entity: selectedEntity
        })
      });
      const result = await response.json();

      if (response.ok && result.success) {
        const summary = result.analysis_summary;
        setMessages([{
          role: 'assistant',
          content: `✅ Analysis complete!\n\nAnalyzed ${summary?.entities_analyzed || 0} entities with ${summary?.total_records || 0} records.\n\nClick cards above or ask me anything!`,
          timestamp: new Date()
        }]);
        // Mark analysis as run
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('ai-analysis-run', 'true');
        }
        setHasRunAnalysis(true);
      }
    } catch (error) {
      console.error('Auto-analysis error:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setShowCards(false);

    try {
      const interimEntities = entities.filter(e => e.entity_type === 'INTERIM').map(e => e.id);

      // Include conversation history for context
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch('/api/star-schema/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          entities,
          interim_entities: interimEntities,
          conversation_history: conversationHistory,
          selected_entity: selectedEntity
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed');
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.message,
        suggestions: result.suggestions || [],
        timestamp: new Date()
      }]);

    } catch (error) {
      console.error('AI chat error:', error);
      toast.error('Failed to get AI response');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    if (!confirm('Clear conversation history? This cannot be undone.')) {
      return;
    }

    setMessages([]);
    setShowCards(true);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('ai-chat-messages');
      sessionStorage.removeItem('ai-analysis-run');
    }
    setHasRunAnalysis(false);
    toast.success('Chat cleared');

    // Re-run analysis
    runAutoAnalysis();
  };

  const handleEntityContextChange = (value: string) => {
    const newEntity = value === 'all' ? null : value;
    setSelectedEntity(newEntity);

    // Save to sessionStorage
    if (typeof window !== 'undefined') {
      if (newEntity) {
        sessionStorage.setItem('ai-selected-entity', newEntity);
      } else {
        sessionStorage.removeItem('ai-selected-entity');
      }
    }

    // Clear chat and re-run analysis for new context
    setMessages([]);
    setShowCards(true);
    setHasRunAnalysis(false);
    sessionStorage.removeItem('ai-chat-messages');
    sessionStorage.removeItem('ai-analysis-run');

    toast.success(newEntity ? `Context switched to ${newEntity}` : 'Context switched to all entities');

    // Re-run analysis with new context
    setTimeout(() => runAutoAnalysis(), 100);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Entity Context Selector - Futuristic Header */}
      <div className="flex-none border-b border-purple-500/30 bg-black/20 backdrop-blur-sm p-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <label className="text-sm font-medium text-purple-300">Context:</label>
            <Select value={selectedEntity || 'all'} onValueChange={handleEntityContextChange}>
              <SelectTrigger className="w-[200px] bg-purple-950/50 border-purple-500/50 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-purple-500/50">
                <SelectItem value="all" className="text-white hover:bg-purple-900">All Entities</SelectItem>
                {interimEntities.map(e => (
                  <SelectItem key={e.id} value={e.name} className="text-white hover:bg-purple-900">
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEntity && (
              <Badge variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/50 glow">
                Focused on {selectedEntity}
              </Badge>
            )}
          </div>

          {/* Clear Chat Button */}
          {messages.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              className="text-red-400 hover:text-red-300 hover:bg-red-950/30"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Scrollable Content - Dark theme with particles effect */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-transparent to-black/20">
        {/* Cards - show initially */}
        {showCards && !analyzing && messages.length <= 1 && (
          <QuickStartCards
            entities={entities}
            onCardClick={(prompt) => {
              setInput(prompt);
              setTimeout(() => handleSend(), 100);
            }}
          />
        )}

        {/* Progress */}
        {analyzing && (
          <AnalysisProgress
            currentStep={analysisStep}
            totalSteps={3}
            stepLabel={analysisLabel}
          />
        )}

        {/* Messages */}
        <div className="p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/50'
                  : 'bg-slate-800/80 text-gray-100 border border-purple-500/30 shadow-lg backdrop-blur-sm'
              } rounded-lg p-3`}>
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>

                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {msg.suggestions.map((suggestion, sidx) => (
                      <Card key={sidx} className="p-3 bg-white border-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {suggestion.type === 'dimension' ? (
                                <DatabaseIcon className="w-4 h-4 text-blue-600" />
                              ) : (
                                <DatabaseIcon className="w-4 h-4 text-green-600" />
                              )}
                              <span className="font-medium text-sm">{suggestion.name}</span>
                              <Badge variant="outline" className="text-xs">{suggestion.type}</Badge>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">{suggestion.description}</p>

                            {/* Show fields */}
                            {suggestion.fields && suggestion.fields.length > 0 && (
                              <div className="mt-2 pl-1">
                                <div className="text-xs font-medium text-gray-700 mb-1">Fields:</div>
                                <div className="space-y-0.5">
                                  {suggestion.fields.slice(0, 5).map((field: any, fidx: number) => (
                                    <div key={fidx} className="text-xs text-gray-600 flex items-center gap-1">
                                      <span className="font-mono">{field.name}</span>
                                      <span className="text-gray-400">({field.type})</span>
                                      {field.source && (
                                        <span className="text-blue-600">← {field.source}</span>
                                      )}
                                    </div>
                                  ))}
                                  {suggestion.fields.length > 5 && (
                                    <div className="text-xs text-gray-400">+ {suggestion.fields.length - 5} more</div>
                                  )}
                                </div>
                              </div>
                            )}

                            {suggestion.reasoning && (
                              <p className="text-xs text-gray-500 mt-2 italic">{suggestion.reasoning}</p>
                            )}
                          </div>
                          <Button size="sm" variant="outline" onClick={() => onCreateEntity(suggestion)}>
                            <Plus className="w-3 h-3 mr-1" />
                            Create
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="text-xs opacity-70 mt-2">
                  {msg.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-3">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed Input - Always at Bottom - Futuristic */}
      <div className="flex-none border-t border-purple-500/30 bg-black/40 backdrop-blur-md p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="✨ Ask AI to design your schema..."
            disabled={loading}
            className="flex-1 bg-slate-800/50 border-purple-500/50 text-white placeholder:text-gray-400 focus:border-purple-400 focus:ring-purple-400/50 shadow-inner"
          />
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            size="icon"
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-500/50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <div className="mt-2 text-xs text-purple-300 text-center">
          Press <kbd className="px-1 py-0.5 bg-purple-950/50 border border-purple-500/30 rounded text-purple-300">Enter</kbd> to send
        </div>
      </div>
    </div>
  );
}
