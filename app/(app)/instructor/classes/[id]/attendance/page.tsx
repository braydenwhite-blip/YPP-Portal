import { InstructorAttendanceWorkspace } from "../../../../chapter/operations-workspace-ui";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <InstructorAttendanceWorkspace classId={id} />; }
