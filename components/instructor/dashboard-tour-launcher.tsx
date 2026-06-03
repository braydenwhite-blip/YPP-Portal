"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import GuidedTour, { type TourStep } from "./guided-tour";

/* ------------------------------------------------------------------
   Phase-4 dashboard tour.

   This is the post-training / post-approval walkthrough. It runs on
   the REAL instructor dashboard and points coachmarks at real DOM
   (the `data-tour` regions), touring the areas that just unlocked, in
   order: Dashboard → Course Materials → Session Logging →
   Mentorship/Community.

   It self-activates when the instructor lands on the dashboard with
   `?tour=1` (the launchpad sets this when onboarding finishes), and
   clears the param on exit so it doesn't re-run on refresh.
   ------------------------------------------------------------------ */

const STEPS: TourStep[] = [
  {
    selector: '[data-tour="dashboard"]',
    title: "Your dashboard",
    body: "This is home base. Your greeting, what needs attention, and your week at a glance all live here every time you sign in.",
  },
  {
    selector: '[data-tour="course-materials"]',
    title: "Course materials",
    body: "Your classes and their curriculum, lesson plans, and resources. Open any class to teach from it or pick up where you left off.",
  },
  {
    selector: '[data-tour="session-logging"]',
    title: "Session logging",
    body: "Your upcoming sessions. After each one, open the class to log attendance and what you covered — it keeps families and your record in sync.",
  },
  {
    selector: '[data-tour="community"]',
    title: "Mentorship & community",
    body: "Track your teaching impact and active mentees here, and use the growth record and messages to stay connected to the YPP community.",
  },
];

export default function DashboardTourLauncher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (searchParams.get("tour") === "1") {
      setActive(true);
    }
  }, [searchParams]);

  const close = useCallback(() => {
    setActive(false);
    if (searchParams.get("tour")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tour");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  if (!active) return null;
  return <GuidedTour steps={STEPS} onClose={close} />;
}
