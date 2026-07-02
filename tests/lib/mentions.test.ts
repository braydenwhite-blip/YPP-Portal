import { describe, expect, it } from "vitest";

import {
  extractMentionHandles,
  filterMentionableUsers,
  resolveMentionedUserIds,
  userMentionHandle,
} from "@/lib/mentions";

describe("mentions", () => {
  const users = [
    { id: "u1", name: "Jane Doe", email: "jane.doe@example.com" },
    { id: "u2", name: null, email: "alex@example.com" },
  ];

  it("builds stable mention handles", () => {
    expect(userMentionHandle(users[0])).toBe("janedoe");
    expect(userMentionHandle(users[1])).toBe("alex");
  });

  it("extracts unique handles from comment text", () => {
    expect(extractMentionHandles("Hey @janedoe and @alex please review")).toEqual([
      "janedoe",
      "alex",
    ]);
  });

  it("resolves tagged users from the candidate list", () => {
    const ids = resolveMentionedUserIds("Ping @janedoe for feedback", users);
    expect(ids).toEqual(["u1"]);
  });

  it("filters mention suggestions by query", () => {
    const matches = filterMentionableUsers(users, "jane");
    expect(matches.map((user) => user.id)).toEqual(["u1"]);
  });
});
