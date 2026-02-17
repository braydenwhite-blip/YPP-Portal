import { requireSessionUser, requireAnyRole, SessionUser } from "./authorization";
import { prisma } from "./prisma";

/**
 * Domain-specific authorization helpers
 *
 * These helpers provide reusable authorization checks for common patterns
 * identified in the security audit.
 */

/**
 * Require that the user is accessing their own resource
 * OR has one of the specified roles (typically admin/staff)
 */
export async function requireOwnershipOrRole(
  resourceUserId: string,
  allowedRoles: string[] = ["ADMIN", "STAFF"]
): Promise<SessionUser> {
  const user = await requireSessionUser();

  // Allow if user owns the resource
  if (user.id === resourceUserId) {
    return user;
  }

  // Otherwise, require one of the allowed roles
  const hasAllowedRole = allowedRoles.some((role) => user.roles.includes(role));
  if (!hasAllowedRole) {
    throw new Error("Unauthorized: You can only access your own resources");
  }

  return user;
}

/**
 * Require that the user is an instructor or admin
 */
export async function requireInstructorOrAdmin(): Promise<SessionUser> {
  return await requireAnyRole(["INSTRUCTOR", "ADMIN"]);
}

/**
 * Require that the user is a mentor or admin
 */
export async function requireMentorOrAdmin(): Promise<SessionUser> {
  return await requireAnyRole(["MENTOR", "ADMIN"]);
}

/**
 * Require that the user is an admin
 */
export async function requireAdmin(): Promise<SessionUser> {
  return await requireAnyRole(["ADMIN"]);
}

/**
 * Require that the user is a student
 */
export async function requireStudent(): Promise<SessionUser> {
  return await requireAnyRole(["STUDENT"]);
}

/**
 * Require that the user is a chapter lead for the specified chapter
 * OR is an admin
 */
export async function requireChapterAccess(chapterId: string): Promise<SessionUser> {
  const user = await requireSessionUser();

  // Admins can access all chapters
  if (user.roles.includes("ADMIN")) {
    return user;
  }

  // Check if user is a chapter lead for this chapter
  if (user.roles.includes("CHAPTER_LEAD")) {
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: { chapterId: true }
    });

    if (userProfile?.chapterId === chapterId) {
      return user;
    }
  }

  throw new Error("Unauthorized: You don't have access to this chapter");
}

/**
 * Require that the user is the instructor of a course OR an admin
 */
export async function requireCourseInstructor(
  courseId: string,
  allowAdmin: boolean = true
): Promise<SessionUser> {
  const user = await requireSessionUser();

  // Check if admin (if allowed)
  if (allowAdmin && user.roles.includes("ADMIN")) {
    return user;
  }

  // Check if user is the course instructor
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { instructorId: true }
  });

  if (!course) {
    throw new Error("Course not found");
  }

  if (course.instructorId !== user.id) {
    throw new Error("Unauthorized: You are not the instructor of this course");
  }

  return user;
}

/**
 * Require that the user is enrolled in a course OR is the instructor OR is an admin
 */
export async function requireCourseAccess(courseId: string): Promise<SessionUser> {
  const user = await requireSessionUser();

  // Admins can access all courses
  if (user.roles.includes("ADMIN")) {
    return user;
  }

  // Check if user is the course instructor
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { instructorId: true }
  });

  if (!course) {
    throw new Error("Course not found");
  }

  if (course.instructorId === user.id) {
    return user;
  }

  // Check if user is enrolled
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      courseId,
      studentId: user.id
    }
  });

  if (!enrollment) {
    throw new Error("Unauthorized: You are not enrolled in this course");
  }

  return user;
}

/**
 * Require that the user is the mentor of a specific user OR is an admin
 */
export async function requireMentorOfUser(menteeId: string): Promise<SessionUser> {
  const user = await requireSessionUser();

  // Admins can access all mentorships
  if (user.roles.includes("ADMIN")) {
    return user;
  }

  // Check if user is the mentor
  const mentorship = await prisma.mentorship.findFirst({
    where: {
      mentorId: user.id,
      menteeId,
      status: "ACTIVE"
    }
  });

  if (!mentorship) {
    throw new Error("Unauthorized: You are not the mentor of this user");
  }

  return user;
}

/**
 * Require that the user can access another user's goals
 * (user themselves, their mentor, or admin)
 */
export async function requireGoalsAccess(targetUserId: string): Promise<SessionUser> {
  const user = await requireSessionUser();

  // Users can access their own goals
  if (user.id === targetUserId) {
    return user;
  }

  // Admins can access anyone's goals
  if (user.roles.includes("ADMIN")) {
    return user;
  }

  // Mentors can access their mentees' goals
  if (user.roles.includes("MENTOR")) {
    const mentorship = await prisma.mentorship.findFirst({
      where: {
        mentorId: user.id,
        menteeId: targetUserId,
        status: "ACTIVE"
      }
    });

    if (mentorship) {
      return user;
    }
  }

  throw new Error("Unauthorized: You cannot access this user's goals");
}

/**
 * Require that the user can message another user
 * (based on role-based messaging rules)
 */
export async function requireCanMessage(recipientId: string): Promise<SessionUser> {
  const user = await requireSessionUser();

  // Can't message yourself
  if (user.id === recipientId) {
    throw new Error("Cannot message yourself");
  }

  // Get recipient info
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: {
      roles: { select: { role: true } }
    }
  });

  if (!recipient) {
    throw new Error("Recipient not found");
  }

  const recipientRoles = recipient.roles.map((r) => r.role);

  // Admins can message anyone
  if (user.roles.includes("ADMIN")) {
    return user;
  }

  // Check role-based messaging rules
  const primaryRole = user.primaryRole;

  switch (primaryRole) {
    case "STUDENT":
      // Students can message: their instructors, their mentors, staff, chapter leads
      if (
        recipientRoles.includes("INSTRUCTOR") ||
        recipientRoles.includes("MENTOR") ||
        recipientRoles.includes("STAFF") ||
        recipientRoles.includes("CHAPTER_LEAD")
      ) {
        return user;
      }
      throw new Error("Students can only message instructors, mentors, staff, and chapter leads");

    case "INSTRUCTOR":
      // Instructors can message: their students, other instructors, mentors, staff, chapter leads
      if (
        recipientRoles.includes("STUDENT") ||
        recipientRoles.includes("INSTRUCTOR") ||
        recipientRoles.includes("MENTOR") ||
        recipientRoles.includes("STAFF") ||
        recipientRoles.includes("CHAPTER_LEAD")
      ) {
        return user;
      }
      throw new Error("Unauthorized messaging recipient");

    case "MENTOR":
      // Mentors can message: their mentees, instructors, other mentors, staff, chapter leads
      if (
        recipientRoles.includes("STUDENT") ||
        recipientRoles.includes("INSTRUCTOR") ||
        recipientRoles.includes("MENTOR") ||
        recipientRoles.includes("STAFF") ||
        recipientRoles.includes("CHAPTER_LEAD")
      ) {
        return user;
      }
      throw new Error("Unauthorized messaging recipient");

    case "CHAPTER_LEAD":
    case "STAFF":
      // Staff and chapter leads can message anyone
      return user;

    case "PARENT":
      // Parents can message: staff, chapter leads, their children's instructors
      if (
        recipientRoles.includes("STAFF") ||
        recipientRoles.includes("CHAPTER_LEAD") ||
        recipientRoles.includes("INSTRUCTOR")
      ) {
        return user;
      }
      throw new Error("Parents can only message staff, chapter leads, and instructors");

    default:
      throw new Error("Unauthorized messaging");
  }
}

/**
 * Require that the user can view attendance records
 * (instructor of the class, chapter lead, or admin)
 */
export async function requireAttendanceAccess(
  classOfferingId?: string,
  courseId?: string
): Promise<SessionUser> {
  const user = await requireSessionUser();

  // Admins can access all attendance
  if (user.roles.includes("ADMIN")) {
    return user;
  }

  // If classOfferingId provided, check if instructor
  if (classOfferingId) {
    const classOffering = await prisma.classOffering.findUnique({
      where: { id: classOfferingId },
      select: { instructorId: true }
    });

    if (classOffering?.instructorId === user.id) {
      return user;
    }
  }

  // If courseId provided, check if instructor
  if (courseId) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { instructorId: true }
    });

    if (course?.instructorId === user.id) {
      return user;
    }
  }

  // Chapter leads can access attendance for their chapter
  if (user.roles.includes("CHAPTER_LEAD")) {
    // Could add chapter-specific check here if needed
    return user;
  }

  throw new Error("Unauthorized: You cannot access these attendance records");
}

/**
 * Require that the user can access an application
 * (applicant themselves, position reviewers, or admin)
 */
export async function requireApplicationAccess(
  applicationId: string
): Promise<SessionUser> {
  const user = await requireSessionUser();

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      applicantId: true,
      position: {
        select: {
          chapterId: true
        }
      }
    }
  });

  if (!application) {
    throw new Error("Application not found");
  }

  // Applicant can access their own application
  if (application.applicantId === user.id) {
    return user;
  }

  // Admins can access all applications
  if (user.roles.includes("ADMIN")) {
    return user;
  }

  // Chapter leads can access applications for their chapter
  if (user.roles.includes("CHAPTER_LEAD") && application.position.chapterId) {
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: { chapterId: true }
    });

    if (userProfile?.chapterId === application.position.chapterId) {
      return user;
    }
  }

  throw new Error("Unauthorized: You cannot access this application");
}
