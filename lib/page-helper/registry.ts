import type { PageHelperEntry } from "@/lib/page-helper/types";

export const PAGE_HELP_ENTRIES: PageHelperEntry[] = [
  {
    pattern: "/",
    title: "Portal Home",
    content: {
      purpose: "This home page is your role-based command center for assigned work and recent alerts.",
      firstStep: "Open the first next action with the nearest due date or the item that is already assigned to you.",
      nextStep: "When you finish an action, the workflow record updates and the next owner or next stage appears automatically."
    },
    roleOverrides: {
      ADMIN: {
        purpose: "This home page is your admin command center for queues, approvals, and the items that need attention first.",
        firstStep: "Start with the highest-priority queue card or overdue workflow item at the top of the page.",
        nextStep: "After you move work forward, the next owner, next stage, or refreshed count appears automatically."
      },
      INSTRUCTOR: {
        purpose: "This home page is your teaching command center for follow-up tasks, alerts, and student-facing work.",
        firstStep: "Open the next teaching or follow-up item with the closest deadline or the clearest blocker.",
        nextStep: "After you finish a task, the page updates so the next class, learner, or workflow step can surface."
      },
      STUDENT: {
        purpose: "This home page is your student command center for progress, reminders, and the next step in your portal journey.",
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
    title: "Create Content",
    content: {
      purpose: "This workspace is only for approved content and structured setup tasks that belong in the portal.",
      firstStep: "Pick the content type you need from the dropdown so the page only shows the fields for that one task.",
      nextStep: "After you submit, the new content is created and the matching portal area is revalidated automatically."
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
    pattern: "/admin/mentor-match",
    title: "Mentor Match",
    content: {
      purpose: "This page helps you manage the mentor match and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
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
      purpose: "This page helps you manage the g&r assignments — admin and keep the portal data or workflow organized.",
      firstStep: "Review the current list, board, or settings first so you can decide which item needs action right now.",
      nextStep: "After you save a change, the page refreshes the managed content so the next task is easier to track."
    }
  },
  {
    pattern: "/admin/mentorship-program/gr-resources",
    title: "G&R Resources — Admin",
    content: {
      purpose: "This page helps you browse the g&r resources — admin and open the resource that fits your next task.",
      firstStep: "Start with the most relevant section, filter, or card so you can narrow the list before opening anything.",
      nextStep: "Once you find the right resource, open it and use the linked workspace or material to keep moving forward."
    }
  },
  {
    pattern: "/admin/mentorship-program/gr-templates",
    title: "G&R Templates — Admin",
    content: {
      purpose: "This page helps you browse the g&r templates — admin and open the resource that fits your next task.",
      firstStep: "Start with the most relevant section, filter, or card so you can narrow the list before opening anything.",
      nextStep: "Once you find the right resource, open it and use the linked workspace or material to keep moving forward."
    }
  },
  {
    pattern: "/admin/mentorship-program/gr-templates/[id]",
    title: "Edit G&R Template — Admin",
    content: {
      purpose: "This page helps you browse the g&r template — admin and open the resource that fits your next task.",
      firstStep: "Start with the most relevant section, filter, or card so you can narrow the list before opening anything.",
      nextStep: "Once you find the right resource, open it and use the linked workspace or material to keep moving forward."
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
    content: {
      purpose: "This page helps you review your applications and move each item to the right next step.",
      firstStep: "Open the item that is newest, overdue, or blocked so you can confirm the current status before changing anything.",
      nextStep: "After you approve, return, score, or update the record, the workflow reflects the change for the next person automatically."
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
    title: "Chapter Presidenterboard",
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
    title: "Chapter Presidenterboard",
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
    pattern: "/my-mentor",
    title: "My Mentor",
    content: {
      purpose: "This page brings together the main tools and details for my mentor.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
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
    title: "My Awards — My Program",
    content: {
      purpose: "This page brings together the main tools and details for my awards — my program.",
      firstStep: "Start with the top section or first card so you can understand what is available before opening a deeper workspace.",
      nextStep: "Once you choose an item, use the linked page or tool to finish the next step and then return here if you need another option."
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
  }
];
