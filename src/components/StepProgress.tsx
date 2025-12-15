"use client";

import React from "react";
import { CheckIcon } from "@heroui/shared-icons";

interface Step {
  id: number;
  title: string;
  description: string;
}

interface StepProgressProps {
  currentStep: 1 | 2 | 3 | 4;
}

const steps: Step[] = [
  {
    id: 1,
    title: "Scan Inbox",
    description: "Discover your contacts",
  },
  {
    id: 2,
    title: "Manage Contacts",
    description: "Review and organize",
  },
  {
    id: 3,
    title: "Label Rules",
    description: "Create automation rules",
  },
  {
    id: 4,
    title: "Label Jobs",
    description: "Monitor automation",
  },
];

export default function StepProgress({ currentStep }: StepProgressProps) {
  return (
    <div className="w-full max-w-4xl mx-auto mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isUpcoming = step.id > currentStep;

          return (
            <React.Fragment key={step.id}>
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isCompleted
                      ? "bg-success border-success text-success-foreground"
                      : isCurrent
                      ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/30"
                      : "bg-default-100 border-default-300 text-default-500"
                  }`}
                >
                  {isCompleted ? (
                    <CheckIcon className="w-6 h-6" />
                  ) : (
                    <span className="font-semibold text-sm">{step.id}</span>
                  )}
                </div>

                {/* Step Text */}
                <div className="text-center mt-3 max-w-[120px]">
                  <p
                    className={`text-sm font-medium transition-colors ${
                      isCompleted || isCurrent ? "text-foreground" : "text-default-500"
                    }`}
                  >
                    {step.title}
                  </p>
                  <p
                    className={`text-xs transition-colors ${
                      isCompleted || isCurrent ? "text-default-600" : "text-default-400"
                    }`}
                  >
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Connector Line (except for last step) */}
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-4 transition-colors duration-300 ${
                    step.id < currentStep ? "bg-success" : "bg-default-300"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
