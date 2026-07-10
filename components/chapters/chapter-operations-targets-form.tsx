import { saveChapterOperationsTargets } from "@/lib/chapters/operations-actions";

export function ChapterOperationsTargetsForm({ chapterId, targets }: { chapterId: string; targets: { activeStudentsTarget: number; activeInstructorsTarget: number; instructorPipelineTarget: number; activePartnersTarget: number; classesRunningTarget: number } }) {
  const fields = [
    ["activeStudentsTarget", "Active students"], ["activeInstructorsTarget", "Active instructors"], ["instructorPipelineTarget", "Instructor pipeline"], ["activePartnersTarget", "Active partners"], ["classesRunningTarget", "Classes running"],
  ] as const;
  return <section id="operations-targets" className="card"><h3>Chapter Operations targets</h3><p style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>These targets drive the live scorecard and reports. Changing one updates every Chapter Operations view.</p><form action={saveChapterOperationsTargets} style={{ marginTop: 16, display: "grid", gap: 12 }}><input type="hidden" name="chapterId" value={chapterId} />{fields.map(([name, label]) => <label key={name} className="form-label">{label}<input className="input" name={name} type="number" min="0" max="100000" required defaultValue={targets[name]} style={{ marginTop: 4 }} /></label>)}<button type="submit" className="button">Save operations targets</button></form></section>;
}
