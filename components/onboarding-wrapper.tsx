"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { OnboardingModal } from "./onboarding-modal";

interface Props {
  hasOnboarded: boolean;
  apiKey: string;
  userId: string;
}

export function OnboardingWrapper({ hasOnboarded, apiKey, userId }: Props) {
  const { data: session } = useSession();
  const [show, setShow] = useState(!hasOnboarded);

  // Only show for the profile owner
  if (!session || session.user.firestoreId !== userId || !show) return null;

  return <OnboardingModal apiKey={apiKey} userId={userId} onComplete={() => setShow(false)} />;
}
