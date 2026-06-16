/**
 * Command Center OS — client workspaces + the local Calm / Executive mode. The
 * server pages load data, run the deterministic adapters in `@/lib/command-center`,
 * and hand the view-models to these workspaces.
 */
export {
  CommandModeProvider,
  CommandModeToggle,
  useCommandMode,
  useIsExecutive,
  ExecutiveOnly,
  CalmOnly,
  CalmCollapse,
  type CommandMode,
} from "./command-mode";
export { CcIcon, type CcIconName } from "./icons";
export {
  PrimaryFocusCard,
  SimpleRow,
  SimpleListCard,
  SimpleActionStrip,
  SimpleSurface,
  EmptySimpleState,
  type SimpleAction,
} from "./simple";
export { TodayWorkspace } from "./today-workspace";
export { DecideWorkspace } from "./decide-workspace";
export { MeetWorkspace } from "./meet-workspace";
export { DelegateWorkspace } from "./delegate-workspace";
export { ReviewWorkspace } from "./review-workspace";
export { FollowUpWorkspace } from "./follow-up-workspace";
