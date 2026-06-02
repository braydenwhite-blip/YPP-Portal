import type { Metadata } from "next";
import InstructorOnboardingGuide from "@/components/instructor-onboarding/instructor-onboarding-guide";

export const metadata: Metadata = {
  title: "Instructor Onboarding Guide | YPP Portal",
};

export default function InstructorOnboardingPage() {
  return <InstructorOnboardingGuide />;
}
