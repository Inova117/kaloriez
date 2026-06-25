import React from 'react';
import { OnboardingFlow, HAS_COMPLETED_ONBOARDING_KEY } from './onboarding/OnboardingFlow';

// Re-export so existing imports (e.g. App.tsx) keep working.
export { HAS_COMPLETED_ONBOARDING_KEY };

interface OnboardingScreenProps {
    onComplete: () => void;
    isEditing?: boolean;
}

export function OnboardingScreen({ onComplete, isEditing = false }: OnboardingScreenProps) {
    return <OnboardingFlow onComplete={onComplete} isEditing={isEditing} />;
}
