"use client";

import { useState } from "react";
import { updateChapterProfile } from "@/lib/chapter-settings-actions";

type Settings = {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  region: string | null;
  description: string | null;
  tagline: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  isPublic: boolean;
  joinPolicy: string;
};

export function ChapterSettingsForm({ settings }: { settings: Settings }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const formData = new FormData(e.currentTarget);
      await updateChapterProfile(formData);
      setMessage({ type: "success", text: "Saved" });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Could not save",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-[20px] border border-[#dadce0] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.06)]"
    >
      <div className="border-b border-[#f1f3f4] px-5 py-4">
        <h2 className="m-0 text-[16px] font-semibold text-[#202124]">About your chapter</h2>
        <p className="m-0 mt-1 text-[13px] text-[#5f6368]">
          {settings.name}
          {settings.city ? ` · ${settings.city}` : ""}
          {settings.region ? `, ${settings.region}` : ""}
        </p>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5">
        {message ? (
          <p
            role="status"
            className={[
              "m-0 rounded-lg px-3 py-2 text-[13px]",
              message.type === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-red-200 bg-red-50 text-red-800",
            ].join(" ")}
          >
            {message.text}
          </p>
        ) : null}

        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-semibold text-[#202124]">Short tagline</span>
          <input
            type="text"
            name="tagline"
            defaultValue={settings.tagline ?? ""}
            placeholder="One line about your chapter"
            maxLength={100}
            className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-[13.5px] text-[#202124]"
          />
        </label>

        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-semibold text-[#202124]">Description</span>
          <textarea
            name="description"
            defaultValue={settings.description ?? ""}
            placeholder="What should new members know?"
            rows={3}
            maxLength={1000}
            className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-[13.5px] text-[#202124]"
          />
        </label>

        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-semibold text-[#202124]">Who can join?</span>
          <select
            name="joinPolicy"
            defaultValue={settings.joinPolicy}
            className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-[13.5px] text-[#202124]"
          >
            <option value="OPEN">Anyone can join</option>
            <option value="APPROVAL">I approve each request</option>
            <option value="INVITE_ONLY">Invite only</option>
          </select>
        </label>

        {/* Keep slug for the server action; hide from the simple UI */}
        <input type="hidden" name="slug" value={settings.slug ?? ""} />

        <label className="flex items-center gap-2 text-[13.5px] text-[#202124]">
          <input
            type="checkbox"
            name="isPublic"
            value="true"
            defaultChecked={settings.isPublic}
            className="h-4 w-4"
          />
          Show this chapter in the public directory
        </label>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex w-fit cursor-pointer items-center justify-center rounded-full border-0 bg-brand-600 px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
