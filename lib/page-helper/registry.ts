import type { PageHelperEntry } from "@/lib/page-helper/types";

export const PAGE_HELP_ENTRIES: PageHelperEntry[] = [
  {
    pattern: "/my-weekly-impact",
    title: "My Weekly Impact",
    content: {
      purpose:
        "Your weekly impact update for each team you're on — objective and deliverable, exactly what you did and the outcome, what you'll show next week, and what you need. It's pre-filled from your live work.",
      firstStep:
        "Fill in the Deliverable (what 'done' looks like) and, for each task, exactly what you did and the outcome — be specific; vague answers are blocked on submit.",
      nextStep:
        "Add the artifact you're showing, set your next step and any input you need, then press Submit my weekly impact.",
    },
  },
  {
    pattern: "/command-center",
    title: "Command Center",
    content: {
      purpose: "Start here each day: your mission, your next move, the current meeting, the decisions that matter, and who you're waiting on.",
      firstStep: "Read the mission, then press Start now on Today's focus — it's the single most pressing thing.",
      nextStep: "Work the focus card, then open the next meeting, decision, or waiting-on from the supporting cards as needed.",
    },
  },
  {
    pattern: "/decide",
    title: "Decide",
    content: {
      purpose: "Decisions that need you: leadership choices, ownership gaps, and blockers gathered into clear decision items.",
      firstStep: "Open the focus decision and choose an option, assign an owner, or add it to a meeting.",
      nextStep: "Clear the Needs decision today lane, then check Needs owner and Needs meeting before the decision log.",
    },
  },
  {
    pattern: "/delegate",
    title: "Delegate",
    content: {
      purpose: "The ownership desk: what needs an owner, what's overdue and should be reassigned, and who's waiting on whom.",
      firstStep: "Assign the highest-impact unowned item from the Assignment Queue using the suggested owner.",
      nextStep: "Scan the owner lanes for anyone overdue or at capacity, then use the batch tools to clear gaps in one pass.",
    },
  },
  {
    pattern: "/follow-up",
    title: "Follow Up",
    content: {
      purpose: "The waiting-on / outreach desk: who we're waiting on, what's open and overdue, and who needs a nudge next.",
      firstStep: "Start with the Waiting On People panel — the person blocking the most active work is first.",
      nextStep: "Pick someone in the composer and route into a reminder, a new action, or a meeting to keep momentum.",
    },
  },
  {
    pattern: "/meet",
    title: "Meet",
    content: {
      purpose: "Run your meetings: prep before, run during, and wrap up after — with connected actions, decisions, and open follow-ups alongside.",
      firstStep: "Open the current or next meeting and use the Before / During / After switcher for the phase you're in.",
      nextStep: "Capture decisions and actions into the meeting record, then close the open follow-ups in the context rail.",
    },
  },
  {
    pattern: "/review",
    title: "Review",
    content: {
      purpose: "The weekly operating review: what changed, what needs review, which initiatives need next steps, and the focus for next week.",
      firstStep: "Start the review session, then work the guided steps — review overdue work, assign owners, resolve decisions.",
      nextStep: "Open each initiative review room for its top blocker and next move, then set the focus for next week.",
    },
  },
  {
    pattern: "/",
    title: "Portal Home",
    content: {
      purpose: "This home page is your home base for the work assigned to you and what changed recently.",
      firstStep: "Open the first next action with the nearest due date or the item that is already assigned to you.",
      nextStep: "When you finish an action, the workflow record updates and the next owner or next stage appears automatically."
    },
    roleOverrides: {
      ADMIN: {
        purpose: "This home page is your admin home base for queues, approvals, and the items that need attention first.",
        firstStep: "Start with the highest-priority queue card or overdue workflow item at the top of the page.",
        nextStep: "After you move work forward, the next owner, next stage, or refreshed count appears automatically."
      },
      INSTRUCTOR: {
        purpose: "This home page is your teaching home base for follow-up tasks, alerts, and student-facing work.",
        firstStep: "Open the next teaching or follow-up item with the closest deadline or the clearest blocker.",
        nextStep: "After you finish a task, the page updates so the next class, learner, or workflow step can surface."
      },
      STUDENT: {
        purpose: "This home page is your student home base for progress, reminders, and the next step in your portal journey.",
        firstStep: "Open the top next action first so you can handle the task that matters most right now.",
        nextStep: "After you complete a step, your progress updates and the next recommended action shows up automatically."
      },
      PARENT: {
        purpose: "This home page is your family dashboard for student updates, reminders, and the next parent action that needs attention.",
        firstStep: "Look at the top action or newest alert first so you can respond to the most important family task.",
        nextStep: "After you review or complete the item, the next update or action appears in the same shared workflow."
      }
    }
  },
  {
    pattern: "/achievements/badges",
    title: "Achievement Gallery",
    content: {
      purpose: "This page brings together the main tools and details for the achievement gallery.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/activities",
    title: "Activity Hub",
    content: {
      purpose: "This page brings together the main tools and details for the activity hub.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/admin",
    title: "Admin Home",
    content: {
      purpose: "Every admin tool in one place, grouped by domain (people, hiring, mentorship, programs, partners, communications, reports). You only see the destinations your admin access covers.",
      firstStep: "Pick the domain group that matches your task and follow its link — each entry says exactly what lives behind it.",
      nextStep: "Use the YPP Help Agent (⌘K) when you know the record you need instead of the tool."
    }
  },
  {
    pattern: "/admin/activities",
    title: "Activities Management",
    content: {
      purpose: "This page helps you manage the activities management and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/alumni",
    title: "Manage Alumni & Awards",
    content: {
      purpose: "This page helps you manage the alumni & awards and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/analytics",
    title: "Portal Reliability Dashboard",
    content: {
      purpose: "This page gives you a clear view of the portal reliability dashboard so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/admin/announcements",
    title: "Manage Announcements",
    content: {
      purpose: "This page helps you manage the announcements and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/application-cohorts",
    title: "Application Cohorts",
    content: {
      purpose: "This page helps you review the application cohorts and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/admin/applications",
    title: "Application Pipeline",
    content: {
      purpose: "This page helps you review the application pipeline and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/admin/audit-log",
    title: "Audit Log / Activity Feed",
    content: {
      purpose: "This page helps you review the audit log / activity feed and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/admin/bulk-users",
    title: "Bulk User Management",
    content: {
      purpose: "This page helps you manage the bulk user management and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/challenges",
    title: "Challenge Management",
    content: {
      purpose: "This page helps you manage the challenge management and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/chapter-president-applicants",
    title: "Chapter President Applicants",
    content: {
      purpose: "This page helps you review the chapter president applicants and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/admin/chapter-reports",
    title: "Chapter Performance Reports",
    content: {
      purpose: "This page gives you a clear view of the chapter performance reports so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/admin/chapters",
    title: "All Chapters",
    content: {
      purpose: "This page helps you manage the all chapters and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/competitions",
    title: "Competition Management",
    content: {
      purpose: "This page helps you manage the competition management and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/classes",
    title: "Class Operations",
    content: {
      purpose: "Central admin view of every class proposal, draft, published class, and roster across all chapters.",
      firstStep: "Use the summary cards or tabs to find what needs attention — proposals awaiting review, classes approved but not yet published, or classes with logistics gaps.",
      nextStep: "Open a class to review its proposal, finalize logistics, publish it, or jump straight to its roster."
    }
  },
  {
    pattern: "/admin/classes/[id]",
    title: "Admin Class Detail",
    content: {
      purpose: "Operational detail page for a single class — schedule, location, capacity, approval status, and admin publishing controls.",
      firstStep: "Confirm the schedule, instructor, in-person location or meeting link, and capacity before publishing or making changes.",
      nextStep: "Use the publishing controls to publish, unpublish, close enrollment, cancel, or mark the class completed once review is done."
    }
  },
  {
    pattern: "/admin/classes/[id]/review",
    title: "Class Proposal Review",
    content: {
      purpose: "Reviewer detail for a class proposal — see the full proposal context and decide whether to approve, request revisions, or reject.",
      firstStep: "Read the proposal, the instructor's notes, and any prior reviewer notes so you can give a clear decision.",
      nextStep: "Approve to clear the proposal for publishing, request revisions with specific feedback, or reject with a reason for the audit trail."
    }
  },
  {
    pattern: "/admin/classes/[id]/roster",
    title: "Admin Class Roster",
    content: {
      purpose: "Roster view of a single class — confirmed students, waitlist, drops, and completions, plus parent/guardian contact for each student.",
      firstStep: "Scan the confirmed list against capacity, then check the waitlist and any duplicates flagged in the table.",
      nextStep: "Promote from the waitlist, move students between confirmed and waitlisted, or drop a student — every change preserves an audit trail on the enrollment record."
    }
  },
  {
    pattern: "/admin/classes/reports",
    title: "Class Reports",
    content: {
      purpose: "Live, read-only insight into the whole class program — pipeline, enrollment health, subject demand, and instructor teaching load.",
      firstStep: "Scan the pipeline and enrollment health cards to see what needs attention — classes awaiting review, under-enrolled classes, or seats sitting empty.",
      nextStep: "Use the 'starting soon' table to fix logistics gaps before classes begin, and the subject/instructor sections to decide what to run again."
    }
  },
  {
    pattern: "/admin/curricula",
    title: "Curriculum Review Queue",
    content: {
      purpose: "This page helps you review the curriculum review queue and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/admin/data-export",
    title: "Data Export Tools",
    content: {
      purpose: "This page helps you manage the data export tools and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/emergency-broadcast",
    title: "Emergency Broadcast",
    content: {
      purpose: "This page helps you manage the emergency broadcast and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/events",
    title: "Event Calendar Management",
    content: {
      purpose: "This page helps you see and plan the event calendar management in one place.",
      firstStep: "Look at the upcoming items first so you can spot the next date, deadline, or meeting that matters most.",
      nextStep: "After you open an event or schedule item, use the linked details to prepare, join, or follow up on time."
    }
  },
  {
    pattern: "/admin/events/create",
    title: "Create Event",
    content: {
      purpose: "This page walks you through creating an event in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/admin/export",
    title: "Data Export Center",
    content: {
      purpose: "This page helps you manage the data export center and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/feature-gates",
    title: "Feature Access",
    content: {
      purpose: "This page helps you manage the feature access and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/feedback",
    title: "Manage Project Feedback",
    content: {
      purpose: "This page helps you review the project feedback and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/admin/form-templates",
    title: "Application Form Templates",
    content: {
      purpose: "This page helps you browse the application form templates and open the resource that fits your next task.",
      firstStep: "Start with the most relevant section, filter, or card so you can narrow the list before opening anything.",
      nextStep: "Once you find the right resource, open it and use the linked workspace or material to keep moving forward."
    }
  },
  {
    pattern: "/admin/goals",
    title: "Goal Management",
    content: {
      purpose: "This page helps you manage the goal management and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/governance",
    title: "Governance & Risk Controls",
    content: {
      purpose: "This page helps you manage the governance & risk controls and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/hiring-committee",
    title: "Hiring Chair Queue",
    content: {
      purpose: "This page helps you manage the hiring chair queue and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/incubator",
    title: "Manage Incubator",
    content: {
      purpose: "This page helps you manage the incubator and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/incubator/[id]",
    title: "Cohort Not Found",
    content: {
      purpose: "This page shows the full details for the cohort not found so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/admin/instructor-applicants",
    title: "Instructor Applicants",
    content: {
      purpose: "This page is the shared hiring board for instructor applications from first review through final decision.",
      firstStep: "Open the left-most cards first, check the deadline to action, and confirm the reviewer and current notes before changing status.",
      nextStep: "When you score or move a card forward, the shared workflow record updates and the action moves to the next stage owner automatically."
    }
  },
  {
    pattern: "/admin/instructor-approvals",
    title: "Legacy Instructor Approval History",
    content: {
      purpose: "This page gives you a clear view of the legacy instructor approval history so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/admin/instructor-readiness",
    title: "Instructor Readiness Command Center",
    content: {
      purpose: "This page gives you a clear view of the instructor readiness command center so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/admin/instructors",
    title: "All Instructors",
    content: {
      purpose: "This page helps you manage the all instructors and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/instructors/[id]",
    title: "Instructor Record",
    content: {
      purpose: "This record shows everything one instructor carries — classes, sessions, reviews, mentorship, leadership roles, advisees, and open work — on a single page.",
      firstStep: "Read the next-step card under the key facts first; it names the most urgent flag or onboarding blocker for this instructor.",
      nextStep: "After you act on the next step, use the section links (classes, reviews, caseload, work) or open Admin tools for tags, notes, and the quarterly review form."
    }
  },
  {
    pattern: "/admin/instructors/[id]/manage",
    title: "Instructor Admin Tools",
    content: {
      purpose: "This workspace holds the deep admin tooling for one instructor: tags, notes, tasks, provisional status, people-strategy panels, and the quarterly review form.",
      firstStep: "Use the section tabs to jump to the tool you need — overview, pipeline, assignments, mentorship, leadership, or the quarterly review.",
      nextStep: "After you save an edit or submit a review, return to the instructor record for the full-360 view of what changed."
    }
  },
  {
    pattern: "/admin/leadership",
    title: "Leadership Roles & Contributions",
    content: {
      purpose: "This dashboard assigns and tracks leadership roles beyond teaching — Student Advisors, mentors, reviewers, committee members, and ownership areas — as review and promotion evidence.",
      firstStep: "Check students without an advisor and flagged follow-ups first, then use the assign forms to fill the most important gap.",
      nextStep: "After you assign or re-status a role, the instructor's leadership record and Senior/Lead standing update immediately."
    }
  },
  {
    pattern: "/admin/mentor-match",
    title: "Mentor Match",
    content: {
      purpose: "This page helps you manage the mentor match and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/instructor-mentor-matching",
    title: "Instructor Mentor Matching",
    content: {
      purpose: "This legacy page redirects admins to the canonical mentorship assignments board.",
      firstStep: "Use the assignments tab on the admin mentorship command center to review unassigned instructors.",
      nextStep: "Complete matching from the canonical board so capacity and workload context stay together."
    }
  },
  {
    pattern: "/admin/mentorship/applications",
    title: "Mentorship Matching Queue",
    content: {
      purpose: "This queue groups mentee applications by stage so you can see who is new, who needs recommendations, who is shortlisted, and who is matched.",
      firstStep: "Open an application in the 'New' or 'Needs recommendations' group to start matching.",
      nextStep: "Inside an application, generate scored mentor recommendations and approve the best fit."
    }
  },
  {
    pattern: "/admin/mentorship/applications/[id]",
    title: "Application Matching",
    content: {
      purpose: "This page shows one mentee's application alongside scored, explained mentor recommendations so you can decide who fits best.",
      firstStep: "Read what the mentee submitted, then generate recommendations to score the mentor pool.",
      nextStep: "Shortlist, hold, reject, or approve a recommendation — approving creates the active match and closes the application."
    }
  },
  {
    pattern: "/admin/mentorship/relationships/[mentorshipId]",
    title: "Mentorship Relationship Details",
    content: {
      purpose: "This page gives admins a detailed view of one mentorship relationship.",
      firstStep: "Review the mentor, mentee, sessions, goals, reviews, and support circle together.",
      nextStep: "Use the available admin actions to adjust the relationship while preserving the mentorship record."
    }
  },
  {
    pattern: "/admin/mentorship/gr",
    title: "Goals & Resources — Admin",
    content: {
      purpose: "This is the canonical admin home for Goals & Resources: every active G&R document with its owner, mentor, status, and what needs action.",
      firstStep: "Scan the health signals and document table to spot drafts that were never activated, documents with no goals, or pending goal-change proposals.",
      nextStep: "Open a document for the full detail, or jump to Templates, Assignments, or Resources to make a change."
    }
  },
  {
    pattern: "/admin/mentorship/gr/[documentId]",
    title: "G&R Document — Admin",
    content: {
      purpose: "This page shows one mentee's Goals & Resources document — owner, connected mentor, active and overdue goals, timeline phases, and what the mentee can currently see.",
      firstStep: "Review the active goals, overdue flags, and pending goal changes to understand where the relationship stands.",
      nextStep: "Use Assignments to resolve goal-change proposals, keeping the document accurate without exposing private staff notes."
    }
  },
  {
    pattern: "/admin/mentorship/gr/assignments",
    title: "G&R Assignments — Admin",
    content: {
      purpose: "This page assigns G&R documents to active mentorships and reviews goal-change proposals from mentors and mentees.",
      firstStep: "Review the assigned documents and the proposal queue first so you can decide which item needs action right now.",
      nextStep: "After you assign a document or resolve a proposal, the canonical G&R overview refreshes so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/mentorship/gr/resources",
    title: "G&R Resources — Admin",
    content: {
      purpose: "This page manages the shared resource library (links and uploads) that mentors attach to G&R documents.",
      firstStep: "Filter or search the library to find the resource you want to add, edit, or retire.",
      nextStep: "Save your change and the resource becomes available to link from templates and documents."
    }
  },
  {
    pattern: "/admin/mentorship/gr/templates",
    title: "G&R Templates — Admin",
    content: {
      purpose: "This page creates and manages the Goals & Responsibilities templates that seed each mentee role's document.",
      firstStep: "Pick the template that matches the role you want to update, or start a new one.",
      nextStep: "Open a template to edit its goals, success criteria, and resources before it is assigned to mentees."
    }
  },
  {
    pattern: "/admin/mentorship/gr/templates/[id]",
    title: "Edit G&R Template — Admin",
    content: {
      purpose: "This page edits one Goals & Responsibilities template — its goals, KPI definitions, success criteria, and linked resources.",
      firstStep: "Review the current goals and success criteria, then adjust what mentees in this role should focus on.",
      nextStep: "Publish your changes; existing documents follow the bulk-update policy you choose so nothing breaks unexpectedly."
    }
  },
  {
    pattern: "/admin/mentorship-program",
    title: "Mentorship Command Center — Admin",
    content: {
      purpose: "This page gives you a clear view of the mentorship command center — admin so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/admin/mentorship-program/gr-assignments",
    title: "G&R Assignments — Admin",
    content: {
      purpose: "This legacy route redirects to the canonical G&R assignments page under the admin mentorship command center.",
      firstStep: "You'll land on /admin/mentorship/gr/assignments automatically.",
      nextStep: "Assign documents and resolve goal-change proposals from the canonical page so context stays together."
    }
  },
  {
    pattern: "/admin/mentorship-program/gr-resources",
    title: "G&R Resources — Admin",
    content: {
      purpose: "This legacy route redirects to the canonical G&R resource library under the admin mentorship command center.",
      firstStep: "You'll land on /admin/mentorship/gr/resources automatically.",
      nextStep: "Manage shared resources from the canonical page so links and uploads stay in one place."
    }
  },
  {
    pattern: "/admin/mentorship-program/gr-templates",
    title: "G&R Templates — Admin",
    content: {
      purpose: "This legacy route redirects to the canonical G&R templates page under the admin mentorship command center.",
      firstStep: "You'll land on /admin/mentorship/gr/templates automatically.",
      nextStep: "Create or edit templates from the canonical page so versions and assignments stay aligned."
    }
  },
  {
    pattern: "/admin/mentorship-program/gr-templates/[id]",
    title: "Edit G&R Template — Admin",
    content: {
      purpose: "This legacy route redirects to the canonical G&R template editor under the admin mentorship command center.",
      firstStep: "You'll land on /admin/mentorship/gr/templates/[id] automatically.",
      nextStep: "Edit the template's goals, criteria, and resources from the canonical page."
    }
  },
  {
    pattern: "/admin/parent-approvals",
    title: "Parent Link Approval Queue",
    content: {
      purpose: "This page helps you review the parent link approval queue and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/admin/parent-feedback",
    title: "Admin Parent Feedback",
    content: {
      purpose: "This page helps you review the admin parent feedback and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/admin/passions",
    title: "Passion Taxonomy",
    content: {
      purpose: "This page helps you manage the passion taxonomy and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/pathway-tracking",
    title: "Pathway Tracking",
    content: {
      purpose: "This page gives you a clear view of the pathway tracking so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/admin/pathways",
    title: "Chapter-Run Pathways",
    content: {
      purpose: "This page helps you manage the chapter-run pathways and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/portal-rollout",
    title: "Portal Rollout Command Center",
    content: {
      purpose: "This page gives you a clear view of the portal rollout command center so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/admin/positions/new",
    title: "New Position",
    content: {
      purpose: "This page walks you through working through the new position in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/admin/programs",
    title: "Manage Special Programs",
    content: {
      purpose: "This page helps you manage the special programs and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/recruiting",
    title: "Recruiting Command Center",
    content: {
      purpose: "This page gives you a clear view of the recruiting command center so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/admin/recruiting/new",
    title: "New Recruiting",
    content: {
      purpose: "This page walks you through working through the new recruiting in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/admin/recruiting/positions/new",
    title: "Create Opening",
    content: {
      purpose: "This page walks you through creating an opening in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/admin/reflection-forms",
    title: "Manage Monthly Self-Reflection Forms",
    content: {
      purpose: "This page helps you manage the monthly self-reflection forms and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/reflections",
    title: "Monthly Self-Reflections",
    content: {
      purpose: "This page helps you manage the monthly self-reflections and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/reminders",
    title: "Automated Reminders",
    content: {
      purpose: "This page helps you manage the automated reminders and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/resource-library",
    title: "Resource Library Management",
    content: {
      purpose: "This page helps you browse the resource library management and open the resource that fits your next task.",
      firstStep: "Start with the most relevant section, filter, or card so you can narrow the list before opening anything.",
      nextStep: "Once you find the right resource, open it and use the linked workspace or material to keep moving forward."
    }
  },
  {
    pattern: "/admin/role-matrix",
    title: "Role Matrix Audit",
    content: {
      purpose: "This page helps you manage the role matrix audit and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/rollout-comms",
    title: "Rollout Communications Hub",
    content: {
      purpose: "This page helps you manage the rollout communications hub and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/scholarships",
    title: "Scholarship Portal Management",
    content: {
      purpose: "This page helps you manage the scholarship portal management and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/scholarships/create",
    title: "Create Scholarship",
    content: {
      purpose: "This page walks you through creating a scholarship in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/admin/showcases",
    title: "Manage Showcases",
    content: {
      purpose: "This page helps you manage the showcases and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/staff",
    title: "Staff Reflections",
    content: {
      purpose: "This page helps you manage the staff reflections and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/stories",
    title: "Manage Success Stories",
    content: {
      purpose: "This page helps you manage the success stories and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/student-of-month",
    title: "Manage Student of the Month",
    content: {
      purpose: "This page helps you manage the student of the month and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/students",
    title: "All Students",
    content: {
      purpose: "This page helps you manage the all students and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/students/[id]",
    title: "Student Record",
    content: {
      purpose: "This record shows one student's full picture — advisor relationship and check-in state, enrolled classes with attendance, mentor and family links, and open work.",
      firstStep: "Check the advisor section first: who advises this student, when the last check-in happened, and whether the next one is overdue.",
      nextStep: "Act on the next-step card (assign an advisor, log a check-in, or resolve the follow-up), then review classes and open actions below."
    }
  },
  {
    pattern: "/admin/training",
    title: "Training Module Management",
    content: {
      purpose: "This page helps you manage the training module management and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/unlock-approvals",
    title: "Access Denied",
    content: {
      purpose: "This page helps you review the access denied and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/admin/volunteer-hours",
    title: "Volunteer Hour Tracking",
    content: {
      purpose: "This page helps you manage the volunteer hour tracking and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/waitlist",
    title: "Waitlist Automation",
    content: {
      purpose: "This page helps you manage the waitlist automation and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/wall-of-fame",
    title: "Manage Wall of Fame",
    content: {
      purpose: "This page helps you manage the wall of fame and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/advisor-dashboard",
    title: "Advisor Dashboard",
    content: {
      purpose: "This page gives you a clear view of the advisor dashboard so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/alumni",
    title: "Alumni Directory",
    content: {
      purpose: "This page brings together the main tools and details for the alumni directory.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/alumni-network",
    title: "Alumni Network",
    content: {
      purpose: "This page brings together the main tools and details for the alumni network.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/alumni-network/browse",
    title: "Browse Alumni",
    content: {
      purpose: "This page brings together the main tools and details for the browse alumni.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/alumni-network/events",
    title: "Alumni Panel Events",
    content: {
      purpose: "This page brings together the main tools and details for the alumni panel events.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/alumni/events",
    title: "Alumni Events",
    content: {
      purpose: "This page brings together the main tools and details for the alumni events.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/analytics",
    title: "Analytics Dashboard",
    content: {
      purpose: "This page gives you a clear view of the analytics dashboard so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/analytics/predictions",
    title: "Progress Predictions",
    content: {
      purpose: "This page gives you a clear view of the progress predictions so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/announcements",
    title: "Announcements",
    content: {
      purpose: "This page brings together the main tools and details for the announcements.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/application-status",
    title: "Your Applications",
    hidden: true,
    content: {
      purpose: "",
      firstStep: "",
      nextStep: ""
    }
  },
  {
    pattern: "/applications",
    title: "Application Status",
    content: {
      purpose: "This page helps you review the application status and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/applications/[id]",
    title: "Application Workspace",
    content: {
      purpose: "This page helps you review the application workspace and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/ask-alum",
    title: "Ask an Alum",
    content: {
      purpose: "This page brings together the main tools and details for the ask an alum.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/ask-alum/new",
    title: "Ask a Question",
    content: {
      purpose: "This page walks you through working through the ask a question in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/attendance",
    title: "Attendance",
    content: {
      purpose: "This page brings together the main tools and details for the attendance.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/attendance/[sessionId]",
    title: "Attendance Details",
    content: {
      purpose: "This page shows the full details for the attendance details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/awards",
    title: "Awards & Achievements",
    content: {
      purpose: "This page brings together the main tools and details for the awards & achievements.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/badges",
    title: "Skill Badges",
    content: {
      purpose: "This page brings together the main tools and details for the skill badges.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/badges/[id]",
    title: "badges Details",
    content: {
      purpose: "This page shows the full details for the badges details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/calendar",
    title: "Visual Calendar",
    content: {
      purpose: "This page helps you see and plan the visual calendar in one place.",
      firstStep: "Look at the upcoming items first so you can spot the next date, deadline, or meeting that matters most.",
      nextStep: "After you open an event or schedule item, use the linked details to prepare, join, or follow up on time."
    }
  },
  {
    pattern: "/certificates",
    title: "My Certificates",
    content: {
      purpose: "This page brings together the main tools and details for my certificates.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/certificates/[id]",
    title: "certificates Details",
    content: {
      purpose: "This page shows the full details for the certificates details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/challenges",
    title: "Challenges",
    content: {
      purpose: "This page brings together the main tools and details for the challenges.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/challenges/[id]",
    title: "Challenge Details",
    content: {
      purpose: "This page shows the full details for the challenge details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/challenges/daily",
    title: "Daily Challenges",
    content: {
      purpose: "This page brings together the main tools and details for the daily challenges.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/challenges/nominate",
    title: "Student-Nominated Challenges",
    content: {
      purpose: "This page walks you through working through the student-nominated challenges in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/challenges/nominate/submit",
    title: "Challenge Nominated!",
    content: {
      purpose: "This page walks you through working through the challenge nominated! in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/challenges/passport",
    title: "Passion Passport",
    content: {
      purpose: "This page brings together the main tools and details for the passion passport.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/challenges/streaks",
    title: "Achievement Streaks",
    content: {
      purpose: "This page gives you a clear view of the achievement streaks so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/challenges/weekly",
    title: "Weekly Challenges",
    content: {
      purpose: "This page brings together the main tools and details for the weekly challenges.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/chapter",
    title: "Chapter",
    content: {
      purpose: "This page brings together the main tools and details for the chapter.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/chapter-lead/dashboard",
    title: "My Chapter Dashboard",
    content: {
      purpose: "This page gives you a clear view of my chapter dashboard so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/chapter-lead/instructor-applicants",
    title: "Instructor Applicants",
    content: {
      purpose: "This page helps you review the instructor applicants and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/chapter-lead/instructor-readiness",
    title: "Instructor Readiness",
    content: {
      purpose: "This page brings together the main tools and details for the instructor readiness.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/chapter-lead/portal-rollout",
    title: "Chapter Rollout Command Center",
    content: {
      purpose: "This page gives you a clear view of the chapter rollout command center so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/chapter/achievements",
    title: "Chapter Achievements",
    content: {
      purpose: "This page brings together the main tools and details for the chapter achievements.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/chapter/applicants",
    title: "Chapter Applicants",
    content: {
      purpose: "This page helps you review the chapter applicants and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/chapter/apply",
    title: "Apply for Chapter President",
    content: {
      purpose: "This page walks you through applying for the for chapter president in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/chapter/calendar",
    title: "Calendar",
    content: {
      purpose: "This page helps you see and plan the calendar in one place.",
      firstStep: "Look at the upcoming items first so you can spot the next date, deadline, or meeting that matters most.",
      nextStep: "After you open an event or schedule item, use the linked details to prepare, join, or follow up on time."
    }
  },
  {
    pattern: "/chapter/channels",
    title: "Chapter Channels",
    content: {
      purpose: "This page brings together the main tools and details for the chapter channels.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/chapter/channels/[channelId]",
    title: "Channel Details",
    content: {
      purpose: "This page shows the full details for the channel details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/chapter/instructors",
    title: "Chapter Instructors",
    content: {
      purpose: "This page brings together the main tools and details for the chapter instructors.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/chapter/instructors/[id]",
    title: "Instructor Details",
    content: {
      purpose: "This page shows the full details for the instructor details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/chapter/invites",
    title: "Invite Links",
    content: {
      purpose: "This page brings together the main tools and details for the invite links.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/chapter/leaderboard",
    title: "Chapter Leaderboard",
    content: {
      purpose: "This page gives you a clear view of the chapter presidenterboard so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/chapter/marketing",
    title: "Marketing Dashboard",
    content: {
      purpose: "This page gives you a clear view of the marketing dashboard so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/chapter/members",
    title: "Chapter Members",
    content: {
      purpose: "This page brings together the main tools and details for the chapter members.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/chapter/onboarding",
    title: "Chapter President Onboarding",
    content: {
      purpose: "This page brings together the main tools and details for the chapter president onboarding.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/chapter/pathway-fallbacks",
    title: "Pathway fallback requests",
    content: {
      purpose: "This page brings together the main tools and details for the pathway fallback requests.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/chapter/president",
    title: "Your Chapter President",
    content: {
      purpose: "This page brings together the main tools and details for your chapter president.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/chapter/propose",
    title: "Propose Chapter",
    content: {
      purpose: "This page walks you through working through the propose chapter in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/chapter/recruiting",
    title: "Chapter Recruiting Command Center",
    content: {
      purpose: "This page gives you a clear view of the chapter recruiting command center so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/chapter/recruiting/positions/[id]/edit",
    title: "Edit Opening",
    content: {
      purpose: "This page walks you through editing the opening in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/chapter/recruiting/positions/new",
    title: "New Opening",
    content: {
      purpose: "This page walks you through working through the new opening in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/chapter/settings",
    title: "Chapter Settings",
    content: {
      purpose: "This page lets you review and update the chapter settings without leaving the portal.",
      firstStep: "Read the current settings carefully so you know what is already saved before you change anything.",
      nextStep: "After you save an update, the new settings take effect in the part of the portal they control."
    }
  },
  {
    pattern: "/chapter/settings/onboarding",
    title: "Onboarding Steps",
    content: {
      purpose: "This page lets you review and update the onboarding steps without leaving the portal.",
      firstStep: "Read the current settings carefully so you know what is already saved before you change anything.",
      nextStep: "After you save an update, the new settings take effect in the part of the portal they control."
    }
  },
  {
    pattern: "/chapter/student-intake",
    title: "Student Intake Board",
    content: {
      purpose: "This page brings together the main tools and details for the student intake board.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/chapter/students",
    title: "Chapter Students",
    content: {
      purpose: "This page brings together the main tools and details for the chapter students.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/chapter/updates",
    title: "Chapter Updates",
    content: {
      purpose: "This page brings together the main tools and details for the chapter updates.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/chapter/welcome",
    title: "Welcome",
    content: {
      purpose: "This page brings together the main tools and details for the welcome.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/chapters",
    title: "Find Your Chapter",
    content: {
      purpose: "This page brings together the main tools and details for the find your chapter.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/chapters/[slug]",
    title: "Chapter Details",
    content: {
      purpose: "This page shows the full details for the chapter details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/chapters/leaderboard",
    title: "Chapter Leaderboard",
    content: {
      purpose: "This page gives you a clear view of the chapter presidenterboard so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/chapters/propose",
    title: "Propose Chapter",
    content: {
      purpose: "This page walks you through working through the propose chapter in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/check-in",
    title: "Check-In",
    content: {
      purpose: "This page brings together the main tools and details for the check-in.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/college-advisor",
    title: "College Advisor",
    content: {
      purpose: "This page brings together the main tools and details for the college advisor.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/college-advisor/activities",
    title: "Activities Builder",
    content: {
      purpose: "This page brings together the main tools and details for the activities builder.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/college-advisor/advisor-settings",
    title: "Advisor Settings",
    content: {
      purpose: "This page lets you review and update the advisor settings without leaving the portal.",
      firstStep: "Read the current settings carefully so you know what is already saved before you change anything.",
      nextStep: "After you save an update, the new settings take effect in the part of the portal they control."
    }
  },
  {
    pattern: "/college-advisor/meetings",
    title: "Meeting History — College Advisor",
    content: {
      purpose: "This page helps you see and plan the meeting history — college advisor in one place.",
      firstStep: "Look at the upcoming items first so you can spot the next date, deadline, or meeting that matters most.",
      nextStep: "After you open an event or schedule item, use the linked details to prepare, join, or follow up on time."
    }
  },
  {
    pattern: "/college-advisor/resources",
    title: "Resource Library — College Advisor",
    content: {
      purpose: "This page helps you browse the resource library — college advisor and open the resource that fits your next task.",
      firstStep: "Start with the most relevant section, filter, or card so you can narrow the list before opening anything.",
      nextStep: "Once you find the right resource, open it and use the linked workspace or material to keep moving forward."
    }
  },
  {
    pattern: "/college-advisor/roadmap",
    title: "College Readiness Roadmap",
    content: {
      purpose: "This page brings together the main tools and details for the college readiness roadmap.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/college-advisor/schedule",
    title: "Meeting Requested!",
    content: {
      purpose: "This page helps you see and plan the meeting requested! in one place.",
      firstStep: "Look at the upcoming items first so you can spot the next date, deadline, or meeting that matters most.",
      nextStep: "After you open an event or schedule item, use the linked details to prepare, join, or follow up on time."
    }
  },
  {
    pattern: "/community/chat",
    title: "Chat",
    content: {
      purpose: "This page keeps the chat organized so you can respond without missing the next important update.",
      firstStep: "Open the newest unread item first so you can handle the message, alert, or conversation that needs attention now.",
      nextStep: "After you reply or mark the item complete, the list updates so the next item is easier to find."
    }
  },
  {
    pattern: "/community/feed",
    title: "Recognition Feed",
    content: {
      purpose: "This page brings together the main tools and details for the recognition feed.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/community/recognize",
    title: "Give Recognition",
    content: {
      purpose: "This page brings together the main tools and details for the give recognition.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/competitions",
    title: "Seasonal Competitions",
    content: {
      purpose: "This page brings together the main tools and details for the seasonal competitions.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/competitions/checklist",
    title: "Competition Checklists",
    content: {
      purpose: "This page brings together the main tools and details for the competition checklists.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/courses",
    title: "Courses",
    content: {
      purpose: "This page brings together the main tools and details for the courses.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/courses/[id]",
    title: "Cours Details",
    content: {
      purpose: "This page shows the full details for the cours details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/courses/[id]/assignments",
    title: "Assignments",
    content: {
      purpose: "This page shows the full details for the assignments so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/courses/[id]/assignments/[assignmentId]",
    title: "Assignment Details",
    content: {
      purpose: "This page shows the full details for the assignment details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/courses/[id]/assignments/create",
    title: "Create Assignment",
    content: {
      purpose: "This page walks you through creating an assignment in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/courses/[id]/reviews",
    title: "Reviews",
    content: {
      purpose: "This page helps you review the reviews and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/courses/propose",
    title: "Course Proposals",
    content: {
      purpose: "This page walks you through working through the course proposals in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/courses/propose/new",
    title: "Propose New Course",
    content: {
      purpose: "This page walks you through working through the propose new course in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/courses/recommended",
    title: "Recommended",
    content: {
      purpose: "This page brings together the main tools and details for the recommended.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/curriculum",
    title: "Curriculum Catalog",
    content: {
      purpose: "This page brings together the main tools and details for the curriculum catalog.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/curriculum/[id]",
    title: "Class Not Found",
    content: {
      purpose: "This page shows the full details for the class not found so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/curriculum/[id]/assignments",
    title: "Assignments",
    content: {
      purpose: "This page shows the full details for the assignments so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/curriculum/[id]/assignments/[assignmentId]",
    title: "Assignment Details",
    content: {
      purpose: "This page shows the full details for the assignment details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/curriculum/[id]/assignments/[assignmentId]/feedback",
    title: "Give Feedback",
    content: {
      purpose: "This page helps you review the give feedback and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/curriculum/[id]/assignments/[assignmentId]/groups",
    title: "Group Projects",
    content: {
      purpose: "This page shows the full details for the group projects so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/curriculum/[id]/assignments/create",
    title: "Create Assignment",
    content: {
      purpose: "This page walks you through creating an assignment in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/curriculum/recommended",
    title: "Recommended",
    content: {
      purpose: "This page brings together the main tools and details for the recommended.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/curriculum/schedule",
    title: "Semester Planner",
    content: {
      purpose: "This page helps you see and plan the semester planner in one place.",
      firstStep: "Look at the upcoming items first so you can spot the next date, deadline, or meeting that matters most.",
      nextStep: "After you open an event or schedule item, use the linked details to prepare, join, or follow up on time."
    }
  },
  {
    pattern: "/discover/quiz",
    title: "🎉 Your Passion Profile!",
    content: {
      purpose: "This page brings together the main tools and details for the 🎉 your passion profile!.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/discover/try-it",
    title: "Try-It Sessions",
    content: {
      purpose: "This page brings together the main tools and details for the try-it sessions.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/discover/try-it/[id]",
    title: "Try-It Session Not Found",
    content: {
      purpose: "This page shows the full details for the try-it session not found so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/events",
    title: "Festivals, Showcases, & Competitions",
    content: {
      purpose: "This page brings together the main tools and details for the festivals, showcases, & competitions.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/events/map",
    title: "Chapter Events Map",
    content: {
      purpose: "This page brings together the main tools and details for the chapter events map.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/feedback/[token]",
    title: "Thank You for Your Feedback!",
    content: {
      purpose: "This page helps you review the thank you for your feedback! and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/feedback/anonymous",
    title: "Anonymous Feedback",
    content: {
      purpose: "This page helps you review the anonymous feedback and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/forgot-password",
    title: "Forgot Password",
    content: {
      purpose: "This page helps you start a secure password reset when you cannot sign in with your current password.",
      firstStep: "Enter the email address tied to your portal account so the reset message goes to the right place.",
      nextStep: "After you submit, check your email and use the reset link to choose a new password."
    }
  },
  {
    pattern: "/goals",
    title: "My Goals",
    content: {
      purpose: "This page brings together the main tools and details for my goals.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/goals/custom",
    title: "Custom Goals",
    content: {
      purpose: "This page brings together the main tools and details for the custom goals.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/goals/custom/new",
    title: "Create Custom Goal",
    content: {
      purpose: "This page walks you through creating a custom goal in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/home",
    title: "Home",
    content: {
      purpose: "This page gives you a clear view of the home so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/incubator",
    title: "Passion Project Incubator",
    content: {
      purpose: "This page brings together the main tools and details for the passion project incubator.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/incubator/apply",
    title: "Apply to Incubator",
    content: {
      purpose: "This page walks you through applying for the to incubator in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/incubator/launches",
    title: "Launches",
    content: {
      purpose: "This page brings together the main tools and details for the launches.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/incubator/launches/[slug]",
    title: "Launche Details",
    content: {
      purpose: "This page shows the full details for the launche details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/incubator/project/[id]",
    title: "Project Not Found",
    content: {
      purpose: "This page shows the full details for the project not found so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/instructor-training",
    title: "Instructor Training Academy",
    content: {
      purpose: "This page brings together the main tools and details for the instructor training academy.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/instructor/analytics/attendance/[courseId]",
    title: "Attendance Analytics",
    content: {
      purpose: "This page gives you a clear view of the attendance analytics so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/instructor/certification-pathway",
    title: "Certification Pathway",
    content: {
      purpose: "This page brings together the main tools and details for the certification pathway.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/instructor/certifications",
    title: "My Readiness & History",
    content: {
      purpose: "This page gives you a clear view of my readiness & history so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/instructor/class-settings",
    title: "Class Settings",
    content: {
      purpose: "This page lets you review and update the class settings without leaving the portal.",
      firstStep: "Read the current settings carefully so you know what is already saved before you change anything.",
      nextStep: "After you save an update, the new settings take effect in the part of the portal they control."
    }
  },
  {
    pattern: "/instructor/competition-builder",
    title: "Competition Builder",
    content: {
      purpose: "This page brings together the main tools and details for the competition builder.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/instructor/competition-builder/submissions",
    title: "Submission Management",
    content: {
      purpose: "This page brings together the main tools and details for the submission management.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/instructor/course/[id]/co-instructors",
    title: "Co-Instructors",
    content: {
      purpose: "This page shows the full details for the co-instructors so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/instructor/curriculum-builder",
    title: "Curriculum Builder",
    content: {
      purpose: "This page brings together the main tools and details for the curriculum builder.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/instructor/curriculum-feedback",
    title: "Curriculum Feedback",
    content: {
      purpose: "This page helps you review the curriculum feedback and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/instructor/curriculum-feedback/new",
    title: "Submit Curriculum Feedback",
    content: {
      purpose: "This page walks you through submitting the curriculum feedback in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/instructor/duplicate-course/[courseId]",
    title: "Duplicate Course",
    content: {
      purpose: "This page shows the full details for the duplicate course so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/instructor/engagement/[courseId]",
    title: "Student Engagement",
    content: {
      purpose: "This page shows the full details for the student engagement so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/instructor/feedback-templates",
    title: "Feedback Templates",
    content: {
      purpose: "This page helps you review the feedback templates and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/instructor/feedback-templates/new",
    title: "Create Feedback Template",
    content: {
      purpose: "This page walks you through creating a feedback template in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/instructor/guide",
    title: "Guide",
    content: {
      purpose: "This page brings together the main tools and details for the guide.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/instructor/lesson-design-studio",
    title: "Lesson Design Studio",
    content: {
      purpose: "This page brings together the main tools and details for the lesson design studio.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/instructor/lesson-design-studio/print",
    title: "Lesson Design Studio Print View",
    content: {
      purpose: "This page brings together the main tools and details for the lesson design studio print view.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    },
    hidden: true
  },
  {
    pattern: "/instructor/lesson-plans/templates",
    title: "Lesson Plan Templates",
    content: {
      purpose: "This page helps you browse the lesson plan templates and open the resource that fits your next task.",
      firstStep: "Start with the most relevant section, filter, or card so you can narrow the list before opening anything.",
      nextStep: "Once you find the right resource, open it and use the linked workspace or material to keep moving forward."
    }
  },
  {
    pattern: "/instructor/mentee-health",
    title: "Mentee Health Dashboard",
    content: {
      purpose: "This page gives you a clear view of the mentee health dashboard so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/instructor/parent-feedback",
    title: "Parent Feedback",
    content: {
      purpose: "This page helps you review the parent feedback and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/instructor/parent-messages",
    title: "Parent Messages",
    content: {
      purpose: "This page keeps the parent messages organized so you can respond without missing the next important update.",
      firstStep: "Open the newest unread item first so you can handle the message, alert, or conversation that needs attention now.",
      nextStep: "After you reply or mark the item complete, the list updates so the next item is easier to find."
    }
  },
  {
    pattern: "/instructor/passion-lab-builder",
    title: "Passion Lab Builder",
    content: {
      purpose: "This page brings together the main tools and details for the passion lab builder.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/instructor/passion-lab-builder/progress",
    title: "Student Progress",
    content: {
      purpose: "This page gives you a clear view of the student progress so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/instructor/passion-lab-builder/templates",
    title: "Passion Lab Templates",
    content: {
      purpose: "This page helps you browse the passion lab templates and open the resource that fits your next task.",
      firstStep: "Start with the most relevant section, filter, or card so you can narrow the list before opening anything.",
      nextStep: "Once you find the right resource, open it and use the linked workspace or material to keep moving forward."
    }
  },
  {
    pattern: "/instructor/peer-observation",
    title: "Peer Observation",
    content: {
      purpose: "This page brings together the main tools and details for the peer observation.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/instructor/professional-development",
    title: "Professional Development",
    content: {
      purpose: "This page brings together the main tools and details for the professional development.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/instructor/resources/share",
    title: "Share Resource",
    content: {
      purpose: "This page walks you through sharing the resource in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/instructor/resources/shared",
    title: "Shared Resources",
    content: {
      purpose: "This page helps you browse the shared resources and open the resource that fits your next task.",
      firstStep: "Start with the most relevant section, filter, or card so you can narrow the list before opening anything.",
      nextStep: "Once you find the right resource, open it and use the linked workspace or material to keep moving forward."
    }
  },
  {
    pattern: "/instructor/sequence-builder",
    title: "Sequence Builder",
    content: {
      purpose: "This page brings together the main tools and details for the sequence builder.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/instructor/session-recap/[sessionId]",
    title: "Session Recap",
    content: {
      purpose: "This page shows the full details for the session recap so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/instructor/student-spotlight",
    title: "Student Spotlight",
    content: {
      purpose: "This page brings together the main tools and details for the student spotlight.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/instructor/student-spotlight/nominate",
    title: "Nominate Student for Spotlight",
    content: {
      purpose: "This page walks you through working through the nominate student for spotlight in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/instructor/substitute-request",
    title: "Substitute Requests",
    content: {
      purpose: "This page brings together the main tools and details for the substitute requests.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/instructor/substitute-request/new",
    title: "Request Substitute",
    content: {
      purpose: "This page walks you through requesting the substitute in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/instructor/training-progress",
    title: "Training Progress",
    content: {
      purpose: "This page brings together the main tools and details for the training progress.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/instructor/workspace",
    title: "Instructor Workspace",
    content: {
      purpose: "This page brings together the main tools and details for the instructor workspace.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/internships",
    title: "Internship & Opportunity Board",
    content: {
      purpose: "This page brings together the main tools and details for the internship & opportunity board.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/internships/[id]",
    title: "Internship Details",
    content: {
      purpose: "This page shows the full details for the internship details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/interviews",
    title: "Interview Command Center",
    content: {
      purpose: "This page gives you a clear view of the interview command center so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/interviews/schedule",
    title: "Interview Scheduling",
    content: {
      purpose: "This page helps you see and plan the interview scheduling in one place.",
      firstStep: "Look at the upcoming items first so you can spot the next date, deadline, or meeting that matters most.",
      nextStep: "After you open an event or schedule item, use the linked details to prepare, join, or follow up on time."
    }
  },
  {
    pattern: "/invite/[code]",
    title: "Invite Details",
    content: {
      purpose: "This page shows the full details for the invite details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/join-chapter",
    title: "Join a Chapter",
    content: {
      purpose: "This page brings together the main tools and details for the join a chapter.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/leaderboards",
    title: "Leaderboards",
    content: {
      purpose: "This page gives you a clear view of the leaderboards so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/leadership-pathway",
    title: "Leadership Pathway",
    content: {
      purpose: "This page explains the YPP instructor pathway — what each role means, who mentors whom, and what growth looks like at every stage.",
      firstStep: "Start at the stage ribbon — find where you are today and read the role-detail card for your current stage.",
      nextStep: "Open your G&R or My Mentor page when you're ready to act on the growth areas the rubric calls out."
    }
  },
  {
    pattern: "/learn",
    title: "Self-Paced Learning",
    content: {
      purpose: "This page brings together the main tools and details for the self-paced learning.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/learn/challenges",
    title: "Skill Challenges",
    content: {
      purpose: "This page brings together the main tools and details for the skill challenges.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/learn/modules",
    title: "Learning Modules",
    content: {
      purpose: "This page brings together the main tools and details for the learning modules.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/learn/modules/[id]",
    title: "Module Details",
    content: {
      purpose: "This page shows the full details for the module details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/learn/path-generator",
    title: "Learning Path Generator",
    content: {
      purpose: "This page brings together the main tools and details for the learning path generator.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/learn/practice",
    title: "Practice",
    content: {
      purpose: "This page brings together the main tools and details for the practice.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/learn/progress",
    title: "My Learning Progress",
    content: {
      purpose: "This page gives you a clear view of my learning progress so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/learn/style-quiz",
    title: "Style Quiz",
    content: {
      purpose: "This page brings together the main tools and details for the style quiz.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/learn/workshops",
    title: "Workshop Series",
    content: {
      purpose: "This page brings together the main tools and details for the workshop series.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/lesson-plans",
    title: "Lesson Plan Builder",
    content: {
      purpose: "This page brings together the main tools and details for the lesson plan builder.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/login",
    title: "Login",
    content: {
      purpose: "This page helps you sign in to the portal safely so you can reach your saved work and next actions.",
      firstStep: "Enter your email and password carefully, or choose the sign-in option that matches the account you already use.",
      nextStep: "After you sign in successfully, the portal sends you to the right workspace based on your access and progress."
    }
  },
  {
    pattern: "/magic-link",
    title: "Magic Link",
    content: {
      purpose: "This page handles sign-in through a one-time email link when you are not using a password.",
      firstStep: "Open the most recent magic link from your email and use it before it expires.",
      nextStep: "When the link is accepted, the portal signs you in and sends you to the right workspace automatically."
    }
  },
  {
    pattern: "/mentor/ask",
    title: "Ask a Mentor",
    content: {
      purpose: "This page brings together the main tools and details for the ask a mentor.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/mentor/feedback",
    title: "Feedback Portal",
    content: {
      purpose: "This page helps you review the feedback portal and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/mentor/incubator",
    title: "Mentor Incubator Workspace",
    content: {
      purpose: "This page brings together the main tools and details for the mentor incubator workspace.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/mentor/resources",
    title: "Resource Commons",
    content: {
      purpose: "This page helps you browse the resource commons and open the resource that fits your next task.",
      firstStep: "Start with the most relevant section, filter, or card so you can narrow the list before opening anything.",
      nextStep: "Once you find the right resource, open it and use the linked workspace or material to keep moving forward."
    }
  },
  {
    pattern: "/mentorship",
    title: "Mentorship",
    content: {
      purpose: "This page brings together the main tools and details for the mentorship.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/mentorship/dashboard",
    title: "Mentor Dashboard",
    content: {
      purpose: "This dashboard shows who you mentor, what each mentee needs, your suggested next action for them, and whether you are at capacity.",
      firstStep: "Scan your mentees and their suggested next actions, then open the one that needs you most.",
      nextStep: "Keep your expertise and capacity current so new mentees are matched to you well."
    }
  },
  {
    pattern: "/mentorship/ask",
    title: "Ask a Mentor",
    content: {
      purpose: "This page helps mentors answer shared questions and surface reusable support.",
      firstStep: "Search first, then open the question that needs a useful mentor response.",
      nextStep: "After you answer, promote strong reusable guidance into resources when it can help more people."
    }
  },
  {
    pattern: "/mentorship/awards",
    title: "Mentorship Awards",
    content: {
      purpose: "This page helps mentors and admins manage award nominations using the existing point and tier system.",
      firstStep: "Review eligible mentees and pending nominations before opening the next decision.",
      nextStep: "Submit or approve the nomination so achievement progress stays connected to the mentorship record."
    }
  },
  {
    pattern: "/mentorship/chair",
    title: "Chair Queue",
    content: {
      purpose: "This page shows reviews waiting for chair approval before they are released to mentees.",
      firstStep: "Open the oldest or highest-concern review first so the mentee receives timely next steps.",
      nextStep: "Approve the review or return it with clear changes for the mentor."
    }
  },
  {
    pattern: "/mentorship/chair/[reviewId]",
    title: "Approve Review",
    content: {
      purpose: "This page lets a chair review the mentor's submitted ratings, comments, and plan before release.",
      firstStep: "Read the self-reflection, goal ratings, and mentor plan together before making a decision.",
      nextStep: "Approve when it is ready for the mentee, or request changes with specific guidance."
    }
  },
  {
    pattern: "/mentorship/chair/prep-packet",
    title: "Committee Prep Packet",
    content: {
      purpose: "This page gathers mentorship context for committee review without exposing private chair notes to the mentee.",
      firstStep: "Review the profile, points, recent reviews, and notes before the committee discussion.",
      nextStep: "Use the packet to prepare the chair conversation, then return to the chair queue for decisions."
    }
  },
  {
    pattern: "/mentorship/feedback",
    title: "Feedback Portal",
    content: {
      purpose: "This page helps mentors respond to private feedback requests on mentee work.",
      firstStep: "Open the newest or most urgent request and review the attached context.",
      nextStep: "Send a clear response, attach a resource if useful, and close the loop with the mentee."
    }
  },
  {
    pattern: "/mentorship/mentees/[id]/gr",
    title: "Mentee Goals & Resources",
    content: {
      purpose: "This page helps mentors review a mentee's active goals, resources, and released review context.",
      firstStep: "Scan current monthly goals and recent released feedback before proposing changes.",
      nextStep: "Suggest updates through the G&R change flow so admin review remains intact."
    }
  },
  {
    pattern: "/mentorship/quarterly/[reviewId]",
    title: "Quarterly Review",
    content: {
      purpose: "This page compares the approved reviews in a quarterly cycle and gathers stakeholder feedback.",
      firstStep: "Review the side-by-side monthly summaries and confirm the quarterly context.",
      nextStep: "Create or review stakeholder feedback requests before the committee finalizes the cycle."
    }
  },
  {
    pattern: "/mentorship/resources",
    title: "Resource Commons",
    content: {
      purpose: "This page stores reusable mentorship resources, templates, links, and playbooks.",
      firstStep: "Search before adding anything new so mentors can reuse what already exists.",
      nextStep: "Open, publish, or feature the resource that best supports the current mentoring need."
    }
  },
  {
    pattern: "/mentorship/schedule",
    title: "Mentor Schedule",
    content: {
      purpose: "This page helps mentors manage availability and session requests with mentees.",
      firstStep: "Review upcoming and pending sessions before changing availability.",
      nextStep: "Confirm, reschedule, or follow up so the next check-in stays clear."
    }
  },
  {
    pattern: "/mentorship-program",
    title: "Mentorship Program",
    content: {
      purpose: "This page brings together the main tools and details for the mentorship program.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/mentorship-program/awards",
    title: "Achievement Awards — Mentorship Program",
    content: {
      purpose: "This page brings together the main tools and details for the achievement awards — mentorship program.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/mentorship-program/chair",
    title: "Chair Queue — Mentorship Program",
    content: {
      purpose: "This page brings together the main tools and details for the chair queue — mentorship program.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/mentorship-program/chair/[reviewId]",
    title: "Approve Review — Mentorship Program",
    content: {
      purpose: "This page helps you review the approve review — mentorship program and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/mentorship-program/chair/prep-packet",
    title: "Committee Prep Packet",
    content: {
      purpose: "This page brings together the main tools and details for the committee prep packet.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/mentorship-program/quarterly/[reviewId]",
    title: "Quarterly Review",
    content: {
      purpose: "This page helps you review the quarterly review and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/mentorship-program/reviews",
    title: "Review Queue — Mentorship Program",
    content: {
      purpose: "This page helps you review the review queue — mentorship program and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/mentorship-program/reviews/[reflectionId]",
    title: "Write Review — Mentorship Program",
    content: {
      purpose: "This page helps you review the write review — mentorship program and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/mentorship-program/schedule",
    title: "Meeting Requests — Mentorship Program",
    content: {
      purpose: "This page helps you see and plan the meeting requests — mentorship program in one place.",
      firstStep: "Look at the upcoming items first so you can spot the next date, deadline, or meeting that matters most.",
      nextStep: "After you open an event or schedule item, use the linked details to prepare, join, or follow up on time."
    }
  },
  {
    pattern: "/mentorship/calendar",
    title: "Mentorship Calendar",
    content: {
      purpose: "This page helps you see and plan the mentorship calendar in one place.",
      firstStep: "Look at the upcoming items first so you can spot the next date, deadline, or meeting that matters most.",
      nextStep: "After you open an event or schedule item, use the linked details to prepare, join, or follow up on time."
    }
  },
  {
    pattern: "/mentorship/feedback/[menteeId]",
    title: "feedback Details",
    content: {
      purpose: "This page helps you review the feedback details and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/mentorship/mentees",
    title: "My Mentees",
    content: {
      purpose: "This page brings together the main tools and details for my mentees.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/mentorship/mentees/[id]",
    title: "Mentee Details",
    content: {
      purpose: "This page shows the full details for the mentee details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/mentorship/reviews",
    title: "Chair Review Queue",
    content: {
      purpose: "This page helps you review the chair review queue and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/mentorship/reviews/[menteeId]",
    title: "Write Monthly Review",
    content: {
      purpose: "This page helps you review the write monthly review and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/mentorship/unlock-sections",
    title: "Access Denied",
    content: {
      purpose: "This page brings together the main tools and details for the access denied.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/messages",
    title: "Messages",
    content: {
      purpose: "This page is your direct-message inbox for one-to-one and small-group conversations.",
      firstStep: "Open an unread conversation or start a new message to the specific person who needs the update.",
      nextStep: "Replies stay in the inbox and urgent message tasks also appear back on your home page."
    }
  },
  {
    pattern: "/messages/[conversationId]",
    title: "Message Details",
    content: {
      purpose: "This page keeps the message details organized so you can respond without missing the next important update.",
      firstStep: "Open the newest unread item first so you can handle the message, alert, or conversation that needs attention now.",
      nextStep: "After you reply or mark the item complete, the list updates so the next item is easier to find."
    }
  },
  {
    pattern: "/moments",
    title: "Breakthrough Moments",
    content: {
      purpose: "This page brings together the main tools and details for the breakthrough moments.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/motivation",
    title: "Motivation Boost",
    content: {
      purpose: "This page brings together the main tools and details for the motivation boost.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/my-chapter",
    title: "My Chapter",
    content: {
      purpose: "This page brings together the main tools and details for my chapter.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/my-chapter/calendar",
    title: "Calendar",
    content: {
      purpose: "This page helps you see and plan the calendar in one place.",
      firstStep: "Look at the upcoming items first so you can spot the next date, deadline, or meeting that matters most.",
      nextStep: "After you open an event or schedule item, use the linked details to prepare, join, or follow up on time."
    }
  },
  {
    pattern: "/my-advisees",
    title: "My Advisees",
    content: {
      purpose: "This page lists the students assigned to you as Student Advisor, with their advising status, follow-up flags, and last check-in.",
      firstStep: "Open the student with a follow-up flag or the longest gap since their last check-in.",
      nextStep: "After you log a check-in or recommend a next step, the caseload list and your leadership record update automatically."
    }
  },
  {
    pattern: "/my-advisees/[id]",
    title: "Advising Workspace",
    content: {
      purpose: "This workspace shows one advisee's interests, classes, and history, with tools to log check-ins, set next steps, flag follow-up, and recommend opportunities.",
      firstStep: "Review the student snapshot and the most recent notes, then log what you learned in your latest check-in.",
      nextStep: "After you save a note or recommendation, it appears on the student's profile and counts toward your advising record."
    }
  },
  {
    pattern: "/my-classes",
    title: "My Classes",
    content: {
      purpose: "This page brings together the main tools and details for my classes.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/my-courses",
    title: "My Courses",
    content: {
      purpose: "This page brings together the main tools and details for my courses.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/my-courses/[id]",
    title: "My Cours Details",
    content: {
      purpose: "This page shows the full details for my cours details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/my-courses/[id]/feedback",
    title: "My Cours Feedback",
    content: {
      purpose: "This page helps you review my cours feedback and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/my-leadership",
    title: "My Leadership",
    content: {
      purpose: "This page shows your leadership roles and contributions beyond teaching, your Senior/Lead expectation progress, and the review evidence your work generates.",
      firstStep: "Check your current roles and log any recent activity — check-ins, completed reviews, interviews, or committee work.",
      nextStep: "After you log activity or complete a role, your review evidence and Senior/Lead progress update automatically."
    }
  },
  {
    pattern: "/my-mentor",
    title: "My Mentor",
    content: {
      purpose: "This page brings together the main tools and details for my mentor.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/my-mentor/goals",
    title: "My Goals & Resources",
    content: {
      purpose: "This page shows the goals you and your mentor set together, plus the resources picked to help you reach them.",
      firstStep: "Read your current priorities first, then check any status colors — they show where to focus next, not a grade.",
      nextStep: "Work on a goal or open a recommended resource; new feedback appears here after each monthly review is shared with you."
    }
  },
  {
    pattern: "/my-mentor/resources",
    title: "My Resources",
    content: {
      purpose: "This page collects the materials your mentor recommends for where you are right now.",
      firstStep: "Open the resource that matches what you're working on this week.",
      nextStep: "If you need something specific that isn't here, ask for it on the Get Help page and your mentor can add it."
    }
  },
  {
    pattern: "/my-mentor/progress",
    title: "My Progress",
    content: {
      purpose: "This page shows how your goals are trending over time and the encouragement your mentor has shared with you.",
      firstStep: "Look at your goal trajectory to see how each goal has moved across recent reviews.",
      nextStep: "Read the released feedback and your next steps, then bring any questions to your mentor or the Get Help page."
    }
  },
  {
    pattern: "/my-mentor/awards",
    title: "My Recognition & Awards",
    content: {
      purpose: "This page celebrates your recognition points and award tiers — it's a picture of your consistency and growth, not a grade.",
      firstStep: "See how many points you've earned and how close you are to the next award tier.",
      nextStep: "Keep your reflection and check-ins up to date each cycle — that's the surest way to keep growing toward the next award."
    }
  },
  {
    pattern: "/my-mentor/reflection",
    title: "Monthly Reflection",
    content: {
      purpose: "This page walks you through your monthly self-reflection so your mentor can support you well before your review.",
      firstStep: "Answer each goal prompt honestly — note what went well and what was hard.",
      nextStep: "After you submit, your mentor reads it and completes your monthly review, which is then shared back with you."
    }
  },
  {
    pattern: "/my-mentor/schedule",
    title: "Schedule",
    content: {
      purpose: "This page helps you book and track check-in meetings with your mentor.",
      firstStep: "Pick an available slot or request a time that works for you.",
      nextStep: "Once your mentor confirms, the meeting shows here with its status so you always know what's coming up."
    }
  },
  {
    pattern: "/my-mentor/help",
    title: "Get Help",
    content: {
      purpose: "This page is where you reach out when you're stuck — asking early is a sign of a strong instructor.",
      firstStep: "Use a quick link to schedule time or review goals, or send your mentor a private question.",
      nextStep: "Your mentor (and admins, if it needs escalation) will follow up — it's never shown to other instructors or students."
    }
  },
  {
    pattern: "/my-program",
    title: "My Program",
    content: {
      purpose: "This page brings together the main tools and details for my program.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/my-program/achievement-journey",
    title: "Achievement Journey",
    content: {
      purpose: "This page brings together the main tools and details for the achievement journey.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/my-program/awards",
    title: "My Awards",
    content: {
      purpose: "This legacy route redirects to your canonical recognition & awards page under My Mentorship.",
      firstStep: "You'll land on /my-mentor/awards automatically.",
      nextStep: "Track your points, tier progress, and recognition from your mentee home."
    }
  },
  {
    pattern: "/my-program/certificate",
    title: "My Certificate",
    content: {
      purpose: "This page brings together the main tools and details for my certificate.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/my-program/gr",
    title: "My G&R — Goals & Responsibilities",
    content: {
      purpose: "This page brings together the main tools and details for my g&r — goals & responsibilities.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/my-program/reflect",
    title: "Submit Reflection — My Program",
    content: {
      purpose: "This page walks you through submitting the reflection — my program in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/my-program/reflect/[reflectionId]",
    title: "Reflection — My Program",
    content: {
      purpose: "This page shows the full details for the reflection — my program so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/my-program/schedule",
    title: "Schedule Meeting",
    content: {
      purpose: "This page helps you see and plan the schedule meeting in one place.",
      firstStep: "Look at the upcoming items first so you can spot the next date, deadline, or meeting that matters most.",
      nextStep: "After you open an event or schedule item, use the linked details to prepare, join, or follow up on time."
    }
  },
  {
    pattern: "/notes",
    title: "Learning Notes",
    content: {
      purpose: "This page brings together the main tools and details for the learning notes.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/notes/[id]",
    title: "Note Details",
    content: {
      purpose: "This page shows the full details for the note details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/notes/new",
    title: "New Note",
    content: {
      purpose: "This page walks you through working through the new note in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/notifications",
    title: "Notifications",
    content: {
      purpose: "This page keeps a dated record of your portal alerts and the delivery rules behind them.",
      firstStep: "Read the unread items first, especially anything tied to hiring, reviews, or deadlines.",
      nextStep: "After you clear an alert, the archive stays here while your home page returns to the next active item."
    }
  },
  {
    pattern: "/office-hours",
    title: "Office Hours",
    content: {
      purpose: "This page helps you see and plan the office hours in one place.",
      firstStep: "Look at the upcoming items first so you can spot the next date, deadline, or meeting that matters most.",
      nextStep: "After you open an event or schedule item, use the linked details to prepare, join, or follow up on time."
    }
  },
  {
    pattern: "/office-hours/manage",
    title: "Manage Office Hours",
    content: {
      purpose: "This page helps you see and plan the office hours in one place.",
      firstStep: "Look at the upcoming items first so you can spot the next date, deadline, or meeting that matters most.",
      nextStep: "After you open an event or schedule item, use the linked details to prepare, join, or follow up on time."
    }
  },
  {
    pattern: "/onboarding",
    title: "Onboarding",
    content: {
      purpose: "This page walks you through the setup steps you need before the rest of the portal opens up.",
      firstStep: "Work through the current step from top to bottom and save each answer before moving on.",
      nextStep: "When you finish the required steps, the portal marks onboarding complete and sends you to your next workspace."
    },
    roleOverrides: {
      STUDENT: {
        purpose: "This page helps you set up your student profile, interests, and first direction inside the portal.",
        firstStep: "Complete the current student step carefully so your profile and recommendations start in the right place.",
        nextStep: "After you finish onboarding, the portal unlocks your next student actions and sends you to your main workspace."
      },
      INSTRUCTOR: {
        purpose: "This page helps you finish instructor setup so your teaching tools and readiness steps open correctly.",
        firstStep: "Complete the current setup step and double-check anything tied to your class, chapter, or readiness work.",
        nextStep: "Once onboarding is complete, your instructor workspace and next required actions are ready to use."
      },
      ADMIN: {
        purpose: "This page helps you complete the required setup before you start using admin workflows in the portal.",
        firstStep: "Move through each onboarding step in order so your access and setup information are complete.",
        nextStep: "When the final step is saved, the portal sends you into the admin workflow with the right access already in place."
      }
    }
  },
  {
    pattern: "/parent",
    title: "Parent Dashboard",
    content: {
      purpose: "This page gives you a clear view of the parent dashboard so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/parent/[studentId]",
    title: "Parent Details",
    content: {
      purpose: "This page shows the full details for the parent details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/parent/[studentId]/messages",
    title: "Parent Messages",
    content: {
      purpose: "This page keeps the parent messages organized so you can respond without missing the next important update.",
      firstStep: "Open the newest unread item first so you can handle the message, alert, or conversation that needs attention now.",
      nextStep: "After you reply or mark the item complete, the list updates so the next item is easier to find."
    }
  },
  {
    pattern: "/parent/connect",
    title: "Manage Connections",
    content: {
      purpose: "This page walks you through working through the connections in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/parent/dashboard",
    title: "Student Overview",
    content: {
      purpose: "This page gives you a clear view of the student overview so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/parent/messages",
    title: "Messages",
    content: {
      purpose: "This page keeps the messages organized so you can respond without missing the next important update.",
      firstStep: "Open the newest unread item first so you can handle the message, alert, or conversation that needs attention now.",
      nextStep: "After you reply or mark the item complete, the list updates so the next item is easier to find."
    }
  },
  {
    pattern: "/parent/reports",
    title: "Progress Reports",
    content: {
      purpose: "This page gives you a clear view of the progress reports so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/parent/resources",
    title: "Resources for Parents",
    content: {
      purpose: "This page helps you browse the resources for parents and open the resource that fits your next task.",
      firstStep: "Start with the most relevant section, filter, or card so you can narrow the list before opening anything.",
      nextStep: "Once you find the right resource, open it and use the linked workspace or material to keep moving forward."
    }
  },
  {
    pattern: "/parent/student-intake/[id]",
    title: "Student Intake Details",
    content: {
      purpose: "This page shows the full details for the student intake details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/parent/student-intake/new",
    title: "Start Student Journey",
    content: {
      purpose: "This page walks you through working through the start student journey in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/partners",
    title: "Partner Database",
    content: {
      purpose: "The master partner database: every organization YPP works with, who owns the relationship, the primary contact, open requests, agreements, and the next step. Clicking a row opens the partner's 360 preview without leaving the page.",
      firstStep: "Use the stat tiles or view chips to jump to what needs attention (needs follow-up, open requests, no relationship lead), or search by partner, contact, or lead name.",
      nextStep: "From a preview, open the full partner profile to log touchpoints, manage contacts and requests, or schedule a meeting."
    }
  },
  {
    pattern: "/pathways",
    title: "Pathways Library",
    content: {
      purpose: "This page brings together the main tools and details for the pathways library.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/pathways/[id]",
    title: "Pathway Details",
    content: {
      purpose: "This page shows the full details for the pathway details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/pathways/[id]/certificate",
    title: "Certificate",
    content: {
      purpose: "This page shows the full details for the certificate so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/pathways/[id]/events",
    title: "Pathway Events",
    content: {
      purpose: "This page shows the full details for the pathway events so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/pathways/[id]/journal",
    title: "My Reflections",
    content: {
      purpose: "This page shows the full details for my reflections so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/pathways/[id]/leaderboard",
    title: "Leaderboard",
    content: {
      purpose: "This page gives you a clear view of the leaderboard so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/pathways/[id]/mentors",
    title: "Find a Mentor",
    content: {
      purpose: "This page shows the full details for the find a mentor so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/pathways/[id]/share",
    title: "Share My Progress",
    content: {
      purpose: "This page walks you through sharing my progress in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/pathways/progress",
    title: "Pathway Progress Dashboard",
    content: {
      purpose: "This page gives you a clear view of the pathway progress dashboard so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/people",
    title: "People Database",
    content: {
      purpose: "The master people database: every student, instructor, mentor, advisor, applicant, and leader in one searchable directory, with advisor state and concrete attention flags on each row. Clicking a row opens the person's 360 preview without leaving the page.",
      firstStep: "Search by name or email, or use the stat tiles and role chips to filter — students without advisors and overdue check-ins are one click.",
      nextStep: "From a preview, open the full profile for the complete history, or jump to a connected class, mentor, or advisor from the chips."
    }
  },
  {
    pattern: "/people/performance",
    title: "People & Performance",
    content: {
      purpose: "The Leadership/Board people view: every member with a people-strategy footprint in one table — active work split Lead vs Executing, quarterly review placement, monthly check-in dots, and concrete workload/trend/succession signals.",
      firstStep: "Use the stat tiles or filter chips to focus on members needing a check-in, pending feedback, or a review due this quarter.",
      nextStep: "Click Request feedback on a member to review the suggested collaborators (with the shared work that makes each relevant), preview the email, and send — responses stay Leadership/Board-confidential."
    }
  },
  {
    pattern: "/peer-recognition",
    title: "Peer Recognition",
    content: {
      purpose: "This page brings together the main tools and details for the peer recognition.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/portfolio",
    title: "Portfolio Builder",
    content: {
      purpose: "This page brings together the main tools and details for the portfolio builder.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/portfolio/templates",
    title: "Portfolio Templates",
    content: {
      purpose: "This page helps you browse the portfolio templates and open the resource that fits your next task.",
      firstStep: "Start with the most relevant section, filter, or card so you can narrow the list before opening anything.",
      nextStep: "Once you find the right resource, open it and use the linked workspace or material to keep moving forward."
    }
  },
  {
    pattern: "/positions",
    title: "Open Positions",
    content: {
      purpose: "This page brings together the main tools and details for the open positions.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/positions/[id]",
    title: "Position Details",
    content: {
      purpose: "This page shows the full details for the position details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/positions/new",
    title: "New Position",
    content: {
      purpose: "This page walks you through working through the new position in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/profile",
    title: "My Profile",
    content: {
      purpose: "This page brings together the main tools and details for my profile.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/profile/certifications",
    title: "My Certifications",
    content: {
      purpose: "This page brings together the main tools and details for my certifications.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/profile/progress-gallery",
    title: "Progress Gallery",
    content: {
      purpose: "This page gives you a clear view of the progress gallery so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/profile/timeline",
    title: "My Learning Journey",
    content: {
      purpose: "This page brings together the main tools and details for my learning journey.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/profile/xp",
    title: "My Progress",
    content: {
      purpose: "This page brings together the main tools and details for my progress.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/programs",
    title: "Special Programs",
    content: {
      purpose: "This page brings together the main tools and details for the special programs.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/programs/[id]",
    title: "Program Details",
    content: {
      purpose: "This page shows the full details for the program details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/programs/my",
    title: "My Programs",
    content: {
      purpose: "This page brings together the main tools and details for my programs.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/projects/feedback",
    title: "Project Feedback",
    content: {
      purpose: "This page helps you review the project feedback and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
    }
  },
  {
    pattern: "/projects/resources",
    title: "Resource Requests",
    content: {
      purpose: "This page helps you browse the resource requests and open the resource that fits your next task.",
      firstStep: "Start with the most relevant section, filter, or card so you can narrow the list before opening anything.",
      nextStep: "Once you find the right resource, open it and use the linked workspace or material to keep moving forward."
    }
  },
  {
    pattern: "/projects/tracker",
    title: "My Projects",
    content: {
      purpose: "This page brings together the main tools and details for my projects.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/reflection",
    title: "Monthly Self-Reflection",
    content: {
      purpose: "This page brings together the main tools and details for the monthly self-reflection.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/reflection/history",
    title: "Monthly Self-Reflection History",
    content: {
      purpose: "This page gives you a clear view of the monthly self-reflection history so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/reflections/streaks",
    title: "Reflection Streaks",
    content: {
      purpose: "This page gives you a clear view of the reflection streaks so you can spot what needs attention first.",
      firstStep: "Scan the top summary or first section, then open the item with the closest deadline or biggest blocker.",
      nextStep: "After you review the current status, move into the matching record or workspace and take the next action from there."
    }
  },
  {
    pattern: "/reset-password",
    title: "Reset Password",
    content: {
      purpose: "This page lets you set a new password after you open a valid reset link from your email.",
      firstStep: "Type the new password carefully and confirm it so both fields match before you submit.",
      nextStep: "Once the reset is complete, you can sign in again with the new password."
    }
  },
  {
    pattern: "/resource-exchange",
    title: "Resource Exchange",
    content: {
      purpose: "This page helps you browse the resource exchange and open the resource that fits your next task.",
      firstStep: "Start with the most relevant section, filter, or card so you can narrow the list before opening anything.",
      nextStep: "Once you find the right resource, open it and use the linked workspace or material to keep moving forward."
    }
  },
  {
    pattern: "/resources/bookmarks",
    title: "Bookmarked Resources",
    content: {
      purpose: "This page helps you browse the bookmarked resources and open the resource that fits your next task.",
      firstStep: "Start with the most relevant section, filter, or card so you can narrow the list before opening anything.",
      nextStep: "Once you find the right resource, open it and use the linked workspace or material to keep moving forward."
    }
  },
  {
    pattern: "/rewards",
    title: "Rewards",
    content: {
      purpose: "This page brings together the main tools and details for the rewards.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/service-projects",
    title: "Service Projects",
    content: {
      purpose: "This page brings together the main tools and details for the service projects.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/service-projects/[id]",
    title: "Service Project Details",
    content: {
      purpose: "This page shows the full details for the service project details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/scheduling",
    title: "Scheduling Hub",
    content: {
      purpose: "This hub brings your interview, mentorship, and college-advisor scheduling work into one place.",
      firstStep: "Start with the card that shows the most urgent scheduling work, blocked availability, or next booked session.",
      nextStep: "Open the matching scheduler to book, review, or follow up, then come back here to move to the next track."
    }
  },
  {
    pattern: "/settings/personalization",
    title: "Profile & Settings",
    content: {
      purpose: "This page lets you review and update the personalization without leaving the portal.",
      firstStep: "Read the current settings carefully so you know what is already saved before you change anything.",
      nextStep: "After you save an update, the new settings take effect in the part of the portal they control."
    }
  },
  {
    pattern: "/settings/security",
    title: "Security Settings",
    content: {
      purpose: "This page lets you review and update the security settings without leaving the portal.",
      firstStep: "Read the current settings carefully so you know what is already saved before you change anything.",
      nextStep: "After you save an update, the new settings take effect in the part of the portal they control."
    }
  },
  {
    pattern: "/showcase",
    title: "Student Showcase",
    content: {
      purpose: "This page brings together the main tools and details for the student showcase.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/showcase/[id]",
    title: "Not Found",
    content: {
      purpose: "This page shows the full details for the not found so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/showcase/submit",
    title: "Content Submitted!",
    content: {
      purpose: "This page walks you through working through the content submitted! in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/showcases",
    title: "Seasonal Events",
    content: {
      purpose: "This page brings together the main tools and details for the seasonal events.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/signup",
    title: "Sign Up",
    content: {
      purpose: "This page helps you start your application or account setup in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check your contact information before you continue.",
      nextStep: "After you submit, the portal saves your information and shows the next step for verification or review."
    }
  },
  {
    pattern: "/signup/parent",
    title: "Parent Sign Up",
    content: {
      purpose: "This page helps a parent or guardian create the right account connection for family access in the portal.",
      firstStep: "Enter the family details carefully so the portal can connect the right student and parent records.",
      nextStep: "After you submit, the portal saves the parent signup and guides you to the next verification step."
    }
  },
  {
    pattern: "/signup/instructor",
    title: "Instructor Application Signup",
    content: {
      purpose: "This page is the public application form for people who want to become YPP instructors.",
      firstStep: "Complete the account fields first, then work through the teaching application sections from top to bottom.",
      nextStep: "After you submit, your account is created, the application goes to review, and you can sign in later to track status."
    }
  },
  {
    pattern: "/stories",
    title: "Success Stories",
    content: {
      purpose: "This page brings together the main tools and details for the success stories.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/student-of-month",
    title: "Student of the Month",
    content: {
      purpose: "This page brings together the main tools and details for the student of the month.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/student-training",
    title: "Training Academy",
    content: {
      purpose: "This page brings together the main tools and details for the training academy.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/study-groups",
    title: "Study Groups",
    content: {
      purpose: "This page brings together the main tools and details for the study groups.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/study-groups/[id]",
    title: "Study Group Details",
    content: {
      purpose: "This page shows the full details for the study group details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/study-groups/create",
    title: "Create Study Group",
    content: {
      purpose: "This page walks you through creating a study group in the format the portal expects.",
      firstStep: "Fill in the required fields from top to bottom and double-check names, dates, and links before you continue.",
      nextStep: "After you submit, the portal saves the entry and routes it to the next step, review, or destination automatically."
    }
  },
  {
    pattern: "/training/[id]",
    title: "Training Details",
    content: {
      purpose: "This page shows the full details for the training details so you can review the current state and act with context.",
      firstStep: "Read the top summary first so you understand the current status, owner, and most important details before taking action.",
      nextStep: "After you finish the next step on this record, the updated status stays attached to the same detail page for follow-up."
    }
  },
  {
    pattern: "/verify-email",
    title: "Verify Email",
    content: {
      purpose: "This page confirms whether your email verification link worked and what you should do next.",
      firstStep: "Read the verification result carefully so you know whether the address was confirmed or needs another try.",
      nextStep: "After verification succeeds, return to sign in or continue the next account step the page shows."
    }
  },
  {
    pattern: "/wall-of-fame",
    title: "Wall of Fame",
    content: {
      purpose: "This page brings together the main tools and details for the wall of fame.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    }
  },
  {
    pattern: "/world",
    title: "Passion World",
    content: {
      purpose: "This page brings together the main tools and details for the passion world.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
    },
    placement: "bottom-left"
  },
  // ---------------------------------------------------------------------
  // Workshop pathway (Summer Workshop Instructor)
  // ---------------------------------------------------------------------
  {
    pattern: "/instructor/workshop-design-studio",
    title: "Workshop Design Studio",
    content: {
      purpose:
        "This page lets Summer Workshop applicants choose between designing their own workshop or picking one from the approved library.",
      firstStep:
        "Pick the path that fits — design your own if you have an idea, or open the library to browse approved templates.",
      nextStep:
        "After picking a path, you'll author or select a workshop, finish the reflection, and submit it for reviewer approval."
    }
  },
  {
    pattern: "/instructor/workshop-design-studio/design",
    title: "Design Your Workshop",
    content: {
      purpose:
        "This page is the authoring form for your custom workshop outline — title, audience, hook, activity, wrap-up, and backup plan.",
      firstStep:
        "Fill in title, target age, length, and category first; the rest of the form unlocks once those are in place.",
      nextStep:
        "When the live blocker list is empty, head to the review and submit page to send it for review."
    }
  },
  {
    pattern: "/instructor/workshop-design-studio/library",
    title: "Approved Workshop Library",
    content: {
      purpose:
        "This page is the searchable, filterable library of admin-approved workshops you can pick instead of designing your own.",
      firstStep:
        "Use the search and filters to narrow the list, then open a workshop's preview to read the full plan before picking it.",
      nextStep:
        "After picking a workshop, you'll answer four reflection questions and submit it for reviewer approval."
    }
  },
  {
    pattern: "/instructor/workshop-design-studio/library/[templateId]",
    title: "Workshop Preview",
    content: {
      purpose:
        "This page shows the full plan for an approved workshop you're considering — description, objectives, activity plan, and materials.",
      firstStep:
        "Read the full plan and confirm you'd be comfortable teaching it before clicking 'Pick this workshop'.",
      nextStep:
        "Picking the workshop sets it as your submission and routes you to the reflection form."
    }
  },
  {
    pattern: "/instructor/workshop-design-studio/review",
    title: "Workshop Review & Submit",
    content: {
      purpose:
        "This page is the final review and reflection form before you submit your workshop proposal for reviewer approval.",
      firstStep:
        "Skim your design (or selected template) and answer the four reflection questions in detail.",
      nextStep:
        "When validation clears, click Submit. Reviewers will see your workshop and reflection and either approve, request changes, or reject."
    }
  },
  {
    pattern: "/admin/workshop-library",
    title: "Workshop Library",
    content: {
      purpose:
        "This admin page curates the workshop templates that Summer Workshop applicants can pick from. Only Approved templates appear in the applicant library.",
      firstStep:
        "Open an existing draft to keep iterating, or click 'New workshop' to start a fresh template.",
      nextStep:
        "Move a template to Approved when it's ready for applicants. Archived templates are hidden but preserve applicant selections."
    }
  },
  {
    pattern: "/admin/workshop-library/new",
    title: "New Workshop Template",
    content: {
      purpose:
        "This admin page creates a new workshop template that Summer Workshop applicants can pick from.",
      firstStep:
        "Save as Draft while you iterate; switch the status to Approved when the template is publish-ready.",
      nextStep:
        "Once approved, the template appears in the applicant library and applicants can pick it."
    }
  },
  {
    pattern: "/admin/workshop-library/[id]",
    title: "Edit Workshop Template",
    content: {
      purpose:
        "This admin page edits a workshop template and shows which applicants have picked it.",
      firstStep:
        "Update the template fields, or use the status actions to publish, archive, or restore it.",
      nextStep:
        "Open an applicant selection from the sidebar to jump to that submission's review page."
    }
  },
  {
    pattern: "/admin/workshop-reviews",
    title: "Workshop Reviews",
    content: {
      purpose:
        "This reviewer page is the queue of Summer Workshop Instructor proposals awaiting review or already decided.",
      firstStep:
        "Open the leftmost column ('New submissions') and click into the oldest submission first.",
      nextStep:
        "On the detail page, score the six rubric axes and commit a recommendation — Approve, Request changes, or Reject."
    }
  },
  {
    pattern: "/admin/workshop-reviews/[submissionId]",
    title: "Workshop Submission Review",
    content: {
      purpose:
        "This reviewer page shows a single workshop submission — the full proposal, the applicant's reflection, training context, and the review form.",
      firstStep:
        "Click 'Start review' on a new submission to lock the applicant's edits and signal to other reviewers that you're on it.",
      nextStep:
        "Score each axis 1–5, write applicant-facing feedback, and commit a recommendation. The decision sets the submission's status and frees the applicant if changes are requested."
    }
  },
  // ---------------------------------------------------------------------
  // Pre-existing pages missing from the registry (housekeeping)
  // ---------------------------------------------------------------------
  {
    pattern: "/help",
    title: "Help",
    content: {
      purpose: "This page collects in-product help and quick reference links.",
      firstStep: "Skim the help index to find the topic that matches what you're trying to do.",
      nextStep: "Follow the linked workspace or article for step-by-step instructions."
    }
  },
  {
    pattern: "/help-agent",
    title: "YPP Help Agent",
    content: {
      purpose: "The portal-wide search and command layer: find any person, partner, class, meeting, action, or initiative, and open its 360 preview without leaving the page. Deterministic search — not a chatbot.",
      firstStep: "Type a name or pick a suggested search. Use ↑↓ and Enter to open a result's 360 preview; ⌘+Enter opens its full page.",
      nextStep: "Press ⌘K (Ctrl+K) on any page to open the same search as a palette without navigating here."
    }
  },
  {
    pattern: "/not-rolled-out",
    title: "Not Rolled Out",
    content: {
      purpose: "This page shows when a feature isn't enabled for your account or chapter yet.",
      firstStep: "Read the explanation so you know whether the feature is coming or simply not in your tier.",
      nextStep: "Follow the suggested action — return to your dashboard or check back when the rollout reaches you."
    }
  },
  {
    pattern: "/admin/instructor-applicants/[id]",
    title: "Application Record",
    content: {
      purpose: "This decision-first record shows one instructor application end to end: stage, what's missing, what reviewers said, and what the chair can do next.",
      firstStep: "Check the next-step card and the decision-readiness checklist \u2014 they name exactly what is blocking a decision.",
      nextStep: "Open the full application for materials and assignment tools, or the decision cockpit when the application is in chair review."
    }
  },
  {
    pattern: "/admin/instructor-applicants/[id]/review",
    title: "Instructor Applicant Review",
    content: {
      purpose: "This admin page is the structured review workspace for an instructor applicant.",
      firstStep: "Open the applicant's materials, then walk through the rubric scoring section by section.",
      nextStep: "Save your scores and notes; the chair queue picks up applicants ready for a decision."
    }
  },
  {
    pattern: "/admin/instructor-applicants/chair-settings",
    title: "Chair Assignment",
    content: {
      purpose: "This admin page designates the single active Chair — the only person who can submit or change a final applicant decision.",
      firstStep: "Review the current Chair, then search the eligible Admins and Hiring Chairs to pick a replacement.",
      nextStep: "Confirm the change to instantly transfer decision authority; every reassignment is recorded in the change history."
    }
  },
  {
    pattern: "/admin/instructor-applicants/chair-queue",
    title: "Chair Decision Queue",
    content: {
      purpose: "This admin page is the chair's queue of instructor applicants awaiting a final decision.",
      firstStep: "Sort by status or due date and pick up the oldest item that's ready for a decision.",
      nextStep: "Open an applicant to draft and commit a chair decision, which closes their application file."
    }
  },
  {
    pattern: "/admin/instructor-applicants/chair-queue/[applicationId]",
    title: "Chair Decision Redirect",
    content: {
      purpose: "This old chair decision URL redirects to the final review cockpit.",
      firstStep: "Let the redirect finish so the current cockpit can load the applicant.",
      nextStep: "Use the final review cockpit to draft and commit the chair decision."
    }
  },
  {
    pattern: "/admin/mentorship",
    title: "Mentorship Admin",
    content: {
      purpose: "This admin page manages mentorships, pairings, and program-wide signals.",
      firstStep: "Use the filters or KPI cards to find pairings that need attention right now.",
      nextStep: "Open a mentorship to adjust the pair, log a signal, or follow up on a check-in."
    }
  },
  {
    pattern: "/applications/instructor/[id]",
    title: "Instructor Application Detail",
    content: {
      purpose: "This page shows the full detail of a single instructor application.",
      firstStep: "Skim the applicant's materials, scores, and timeline before deciding what to do next.",
      nextStep: "Use the inline actions or the linked review/interview workspaces to advance the application."
    }
  },
  {
    pattern: "/applications/instructor/new",
    title: "Re-apply as an Instructor",
    content: {
      purpose: "This page lets a previous applicant submit a new instructor application after a prior outcome.",
      firstStep: "Review what changed since your last application — coursework, teaching practice, or mentor support.",
      nextStep: "Fill in the updated form and submit; the review team will see this is a re-application."
    }
  },
  {
    pattern: "/applications/instructor/[id]/interview",
    title: "Applicant Interview",
    content: {
      purpose: "This page is the interview workspace for a specific applicant.",
      firstStep: "Open the structured prompts and use them to guide the conversation as you take notes.",
      nextStep: "Save your notes and recommendation; the chair queue picks the applicant up next."
    }
  },
  {
    pattern: "/applications/summer-workshop",
    title: "Summer Workshop Applications",
    content: {
      purpose: "This page lists Summer Workshop Instructor applications and their status.",
      firstStep: "Skim the queue and pick an applicant whose materials are ready.",
      nextStep: "Open an applicant to review materials, schedule an interview, or record a decision."
    }
  },
  {
    pattern: "/chapter/hub",
    title: "Chapter Hub",
    content: {
      purpose: "This page is the chapter's at-a-glance overview of leadership, programs, and key signals.",
      firstStep: "Skim the hub cards to spot anything that needs attention before opening a deeper workspace.",
      nextStep: "Click into a card or linked tool to take the action it surfaces."
    }
  },
  {
    pattern: "/instructor/lesson-design-studio/[draftId]/[step]",
    title: "Lesson Design Studio Step",
    content: {
      purpose: "This page is one step of the guided Lesson Design Studio flow for a curriculum draft.",
      firstStep: "Finish the inputs on this step before moving forward; the studio shows live blockers as you type.",
      nextStep: "When the step's inputs look complete, the studio routes you to the next phase automatically."
    }
  },
  {
    pattern: "/instructor-growth",
    title: "Instructor Growth",
    content: {
      purpose: "This page surfaces growth signals, recent reviews, and recommended next steps for the instructor.",
      firstStep: "Skim the growth summary and reviews list to see what reviewers are noticing.",
      nextStep: "Pick the recommended next step or jump into a related workspace to act on it."
    }
  },
  {
    pattern: "/instructor-growth/[instructorId]",
    title: "Instructor Growth Profile",
    content: {
      purpose: "This page shows another instructor's growth profile — useful for reviewers and chapter leads.",
      firstStep: "Skim the growth summary and signal history to understand the instructor's trajectory.",
      nextStep: "If you spot a follow-up, link out to the relevant review, mentorship, or training workspace."
    }
  },
  {
    pattern: "/instructor-growth/review",
    title: "Instructor Growth Review",
    content: {
      purpose: "This reviewer page coordinates instructor growth reviews — signals, recommendations, and decisions.",
      firstStep: "Pick the instructor at the top of the queue and open their profile alongside the review form.",
      nextStep: "Commit your review and any signals; the system routes the next reviewer or closes the cycle."
    }
  },
  {
    pattern: "/my-classes/assignments",
    title: "My Class Assignments",
    content: {
      purpose: "This page lists assignments across your active classes so you can grade or follow up in one place.",
      firstStep: "Sort or filter to find the assignments closest to a deadline.",
      nextStep: "Open an assignment to grade, leave feedback, or send a reminder."
    }
  },
  {
    pattern: "/actions/all",
    title: "Action Tracker",
    content: {
      purpose: "Every leadership action across YPP in one place — each card shows its owner, due date, the YPP area and entity it is about, and the meeting it came from.",
      firstStep: "Use the filters to narrow by area, source (from a meeting vs. created manually), owner, or status, or pick a one-click lens like Overdue or Unassigned.",
      nextStep: "Open an action to see its connected work — the source meeting, the linked entity, and other actions on the same entity — then assign an owner or due date."
    }
  },
  {
    pattern: "/actions",
    title: "My Actions",
    content: {
      purpose: "Your action items — what you lead, are executing, or have been asked for input on — with the meeting and YPP area each one connects to.",
      firstStep: "Work top-down: overdue and due-soon items are surfaced first.",
      nextStep: "Open an action to update its status, add a comment, or jump to its source meeting and related portal context."
    }
  },
  {
    pattern: "/work",
    title: "Work",
    content: {
      purpose: "Work shows actions, meeting follow-ups, blockers, and next steps across YPP in one calm queue.",
      firstStep: "Start with Needs attention. It shows the items most likely to need a leader today.",
      nextStep: "Use My work for your own queue, Meetings for follow-ups, and the row action or preview to make the next move."
    }
  },
  {
    pattern: "/actions/command-center",
    title: "Command Center (moved)",
    content: {
      purpose: "The People Strategy Command Center has been absorbed into Work — one simpler place for actions, follow-ups, meetings, and attention items.",
      firstStep: "You will land on Work automatically.",
      nextStep: "Start with Needs attention, then use My work, Actions, or Meetings when you need a narrower view."
    }
  },
  {
    pattern: "/actions/responsibility",
    title: "Responsibility Map",
    content: {
      purpose: "This map shows who owns what, who is overloaded or has capacity, and where each person sits on the growth pipeline, plus the People Risk Radar.",
      firstStep: "Scan the People Risk Radar for anyone who needs attention before it becomes urgent.",
      nextStep: "Tag people with growth signals (ready for more, needs training, at risk) to keep the radar and pipeline current."
    }
  },
  {
    pattern: "/actions/meetings",
    title: "Meetings",
    content: {
      purpose: "Meetings shows upcoming meetings, open follow-ups, recent decisions, and actions created from meetings.",
      firstStep: "Start with Upcoming or Needs follow-up.",
      nextStep: "Open a meeting to log decisions and follow-ups, then create actions for anything that needs an owner and due date."
    }
  },
  {
    pattern: "/actions/meetings/[id]",
    title: "Meeting Workspace",
    content: {
      purpose: "This meeting workspace holds everything about one meeting — agenda, notes, decisions, follow-ups, and the action items it generated.",
      firstStep: "Work through the agenda, marking items discussed or deferred and logging any decisions made.",
      nextStep: "Add follow-ups with owners and due dates, then convert the important ones into tracked Action Tracker items."
    }
  },
  {
    pattern: "/operations",
    title: "Operations",
    content: {
      purpose: "This is the entry point to the YPP Leadership OS. Initiatives are the big goals, meetings create decisions, decisions create actions, actions move initiatives forward, and Weekly Execution keeps everything from getting lost.",
      firstStep: "Officers: open the Command Center to see what matters right now. Everyone else: review your open actions and support below.",
      nextStep: "Use Weekly Execution to run the officer meeting, Initiatives for the big goals, Actions for the detailed work, and Meetings for decisions and follow-ups."
    }
  },
  {
    pattern: "/operations/command-center",
    title: "Leadership Command Center",
    content: {
      purpose: "This is the main 360 view of the leadership OS: what needs attention, what happens this week, what was recently decided, and which initiatives are at risk — all from one shared operations summary.",
      firstStep: "Scan the top snapshot, then work 'Needs attention' from the top — each card explains why it surfaced and links straight to the place to act.",
      nextStep: "Open Weekly Execution to run the officer meeting, or Initiatives to review the big goals."
    }
  },
  {
    pattern: "/operations/data-360",
    title: "Data 360",
    content: {
      purpose: "This is the connected-data control center: one executive snapshot across every tracker, a Needs Attention queue that also watches partners, applicants, mentorships, and class setup, one board of all the work, a unified timeline, and an explorer where every person, class, partner, and initiative opens its 360 panel in place.",
      firstStep: "Scan the executive snapshot, then work 'Needs attention' from the top — every card explains in plain language why it matters.",
      nextStep: "Use the All Work board to triage by lane, and the Connected Data explorer to open any entity's 360 panel without leaving the page."
    }
  },
  {
    pattern: "/operations/weekly-review",
    title: "Weekly Review (moved)",
    content: {
      purpose: "The guided Weekly Review has been folded into Weekly Execution — one weekly workflow instead of two. This route now redirects there.",
      firstStep: "You will land on Weekly Execution automatically.",
      nextStep: "Use Weekly Execution's four stages: build agenda, capture meeting, resolve follow-ups, draft recap."
    }
  },
  {
    pattern: "/operations/weekly-execution",
    title: "Weekly Execution OS",
    content: {
      purpose: "This is the weekly officer meeting workspace: build the agenda, capture meeting notes, close follow-ups, track communication needed, and draft the weekly recap from real action, meeting, and initiative data.",
      firstStep: "Start with the snapshot and Agenda tab so you can see urgent blockers, due-this-week actions, unresolved follow-ups, and initiatives needing leadership attention.",
      nextStep: "During the meeting, capture decisions and follow-ups, then use Follow-ups and Weekly Recap before leaving so every owner, action, and communication is clear."
    }
  },
  {
    pattern: "/operations/initiatives",
    title: "Strategic Initiatives",
    content: {
      purpose: "This is the portfolio of YPP's major goals, programs, and campaigns — each initiative with its derived health, momentum, progress, and the single next move, so you see initiatives instead of hundreds of disconnected actions.",
      firstStep: "Scan the portfolio stats, then work the 'Needs attention' initiatives first — every card shows health, progress, and what to do next.",
      nextStep: "Open any initiative for its full command center, or open the Strategic Map to see the whole portfolio top-down."
    }
  },
  {
    pattern: "/operations/initiatives/[initiativeId]",
    title: "Initiative Command Center",
    content: {
      purpose: "This is one initiative's full command center: its health and why, momentum, progress, milestones, the strategic timeline of how it got here, its risks and ownership, and the recommended next moves — all derived from real execution data.",
      firstStep: "Read the executive summary and health headline, then work the recommended next moves from the top.",
      nextStep: "Check the milestones and timeline to see what's done and what's slipping, and create a linked action for the next push."
    }
  },
  {
    pattern: "/operations/strategic-map",
    title: "Strategic Map",
    content: {
      purpose: "This is the executive visualization of the whole portfolio: YPP → operating areas → initiatives → milestones, each node carrying its rolled-up health and progress.",
      firstStep: "The most-concerning areas are listed first; expand an area to see its initiatives and each initiative to see its milestones.",
      nextStep: "Click any node to drill straight into its command center and act."
    }
  },
  {
    pattern: "/operations/portfolio",
    title: "Initiative Portfolio",
    content: {
      purpose: "This is the executive layer: the whole organization from one page — the most important, highest-impact, fastest-growing, highest-risk, most resource-intensive, understaffed, and blocked initiatives, plus where leadership should focus, the strategic opportunities, and the cross-initiative dependency graph.",
      firstStep: "Scan the portfolio board to see which initiatives matter most and which need help, then read the dependency engine to see what is actually holding the portfolio back.",
      nextStep: "Open any initiative for its full command center, or open the Strategic Map to see the portfolio top-down."
    }
  },
  {
    pattern: "/operations/projects",
    title: "Strategic Projects",
    content: {
      purpose: "This is the working portfolio of strategic projects — the concrete bodies of work that move each initiative forward, each with derived health, confidence, blockers, ownership, momentum, and the next move.",
      firstStep: "Scan the project stats, then work the 'Needs attention' and 'Blocked' projects first — every card shows health, confidence, the blocker, and what to do next.",
      nextStep: "Open any project for its full command center, or create a linked action to move it forward."
    }
  },
  {
    pattern: "/operations/projects/[projectId]",
    title: "Project Command Center",
    content: {
      purpose: "This is one project's full command center: its brief (what it is, why it matters, scope), the execution spine, the touchpoint timeline of how it got here, action / decision / meeting intelligence, dependencies, and a weekly review card — all derived from real execution data.",
      firstStep: "Read the header and brief, then work the recommended next moves from the top — each links straight to where to act.",
      nextStep: "Check the timeline and action intelligence to see what's moving and what's stuck, and create a linked action for the next push."
    }
  }
];
