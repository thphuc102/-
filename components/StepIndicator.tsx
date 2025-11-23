

import React from 'react';
import { AppStep } from '../types';

interface StepIndicatorProps {
  currentStep: AppStep;
}

const steps = [
  { id: AppStep.FRAME_UPLOAD, name: 'Upload Frame' },
  { id: AppStep.TEMPLATE_DESIGN, name: 'Design Layout' },
  { id: AppStep.PHOTO_UPLOAD, name: 'Add Photos' },
  // Fix: Corrected enum member to match its definition in `types.ts`.
  { id: AppStep.FINALIZE_AND_EXPORT, name: 'Finalize & Export' },
];

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  return (
    <nav aria-label="Progress">
      <ol role="list" className="flex items-center">
        {steps.map((step, stepIdx) => (
          <li key={step.name} className={`relative ${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''}`}>
            {currentStep > step.id ? (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-[var(--color-primary)]" />
                </div>
                <div
                  className="relative flex h-8 w-8 items-center justify-center bg-[var(--color-primary)] rounded-full filter hover:brightness-125"
                >
                  <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z" clipRule="evenodd" />
                  </svg>
                </div>
              </>
            ) : currentStep === step.id ? (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-gray-700" />
                </div>
                <div
                  className="relative flex h-8 w-8 items-center justify-center bg-[var(--color-primary)] rounded-full border-2 border-[var(--color-primary)]"
                  aria-current="step"
                >
                  <span className="h-2.5 w-2.5 bg-white rounded-full" aria-hidden="true" />
                </div>
              </>
            ) : (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-gray-700" />
                </div>
                <div
                  className="group relative flex h-8 w-8 items-center justify-center bg-[var(--color-panel)] rounded-full border-2 border-[var(--color-border)] hover:border-gray-500"
                >
                   <span className="h-2.5 w-2.5 bg-transparent rounded-full" />
                </div>
              </>
            )}
            <span className="absolute -bottom-7 w-max text-center text-xs opacity-70">{step.name}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default StepIndicator;