'use client';

/**
 * Analysis Progress Component
 *
 * Shows visual feedback during automatic schema analysis
 */

import { CheckCircle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface AnalysisProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
}

export function AnalysisProgress({ currentStep, totalSteps, stepLabel }: AnalysisProgressProps) {
  const steps = [
    { label: 'Understanding entities', icon: '🔍' },
    { label: 'Reviewing data', icon: '📊' },
    { label: 'Generating suggestions', icon: '✨' }
  ];

  return (
    <Card className="p-6 max-w-2xl mx-auto mt-12">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-gray-900">Analyzing Your Data</h3>
        <p className="text-sm text-gray-600 mt-1">{stepLabel}</p>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isComplete = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <div key={index} className="flex items-center gap-3">
              {isComplete ? (
                <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
              ) : isCurrent ? (
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-gray-400 text-xs">{stepNumber}</span>
                </div>
              )}

              <div className="flex-1">
                <div className={`text-sm font-medium ${
                  isComplete ? 'text-green-700' :
                  isCurrent ? 'text-blue-700' :
                  'text-gray-400'
                }`}>
                  {step.icon} {step.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="mt-6">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">
          Step {currentStep} of {totalSteps}
        </p>
      </div>
    </Card>
  );
}
