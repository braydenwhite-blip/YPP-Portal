import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommentSidebar } from "@/app/(app)/instructor/lesson-design-studio/components/comment-sidebar";

describe("CommentSidebar", () => {
  it("locks body scroll and closes on Escape when open", () => {
    const onClose = vi.fn();

    const { unmount } = render(
      <CommentSidebar
        open
        comments={[]}
        currentUserId="user-1"
        canComment
        canResolveComments={false}
        activeAnchor={null}
        onClose={onClose}
        onClearAnchorFocus={() => undefined}
        onCreateComment={() => Promise.resolve()}
        onResolveComment={() => Promise.resolve()}
        onDeleteComment={() => Promise.resolve()}
        resolveAnchorLabel={() => ({
          anchorType: "COURSE",
          anchorId: null,
          anchorField: null,
          label: "Course title",
        })}
      />
    );

    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
