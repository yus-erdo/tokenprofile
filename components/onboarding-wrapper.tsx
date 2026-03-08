"use client";

import { useState } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { OnboardingModal } from "./onboarding-modal";

interface Props {
  hasOnboarded: boolean;
  apiKey: string;
  userId: string;
}

export function OnboardingWrapper({ hasOnboarded, apiKey, userId }: Props) {
  const { user } = useAuth();
  const [show, setShow] = useState(!hasOnboarded);

  // Only show for the profile owner
  if (!user || user.uid !== userId || !show) return null;

  return <OnboardingModal apiKey={apiKey} userId={userId} onComplete={() => setShow(false)} />;
}
