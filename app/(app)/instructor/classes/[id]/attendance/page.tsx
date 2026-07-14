import { InstructorAttendanceWorkspace } from "@/components/operations/workspaces";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <InstructorAttendanceWorkspace classId={id} />; }
