"use client";

import { useEffect, useMemo, useState } from "react";

import {
  YPP_APPLY_HELPER,
  YPP_APPLY_HR,
  YPP_APPLY_SECTION_STYLE,
} from "@/components/signup/ypp-apply-shell";
import { COUNTRY_OPTIONS } from "@/lib/countries";

const HEAR_ABOUT_OPTIONS = [
  "Word of mouth",
  "TikTok",
  "Instagram",
  "A YPP staff member",
  "A YPP student",
  "Other",
] as const;

/**
 * Shared applicant questions used on every hiring apply form
 * (account, personal details, location & school) — role-specific
 * sections render after this block.
 */
export function SharedApplyFields({
  emailRef,
  passwordRef,
  showChapter = true,
}: {
  emailRef?: { current: string };
  passwordRef?: { current: string };
  showChapter?: boolean;
}) {
  const [chapters, setChapters] = useState<Array<{ id: string; name: string }>>([]);
  const [hearAbout, setHearAbout] = useState("");
  const [hearAboutDetail, setHearAboutDetail] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/chapters");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setChapters(data);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hearAboutNeedsName =
    hearAbout === "A YPP staff member" || hearAbout === "A YPP student";
  const hearAboutNeedsDetail = hearAbout === "Other";
  const hearAboutCombined = useMemo(() => {
    if (!hearAbout) return "";
    if ((hearAboutNeedsName || hearAboutNeedsDetail) && hearAboutDetail.trim()) {
      return `${hearAbout}: ${hearAboutDetail.trim()}`;
    }
    return hearAbout;
  }, [hearAbout, hearAboutDetail, hearAboutNeedsName, hearAboutNeedsDetail]);

  return (
    <>
      <input type="hidden" name="hearAboutYPP" value={hearAboutCombined} />

      <div>
        <div style={YPP_APPLY_SECTION_STYLE}>Account</div>
        <label className="form-label" style={{ marginTop: 0 }}>
          Preferred name *
          <input
            className="input"
            name="name"
            placeholder="What you'd like reviewers to call you"
            required
          />
          <span style={YPP_APPLY_HELPER}>
            This is the name we use across the portal.
          </span>
        </label>
        <label className="form-label">
          Email *
          <input
            className="input"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            onInput={(e) => {
              if (emailRef) emailRef.current = (e.target as HTMLInputElement).value;
            }}
          />
        </label>
        <label className="form-label">
          Password *
          <input
            className="input"
            name="password"
            type="password"
            placeholder="Min 8 characters, letter + number"
            required
            onInput={(e) => {
              if (passwordRef) passwordRef.current = (e.target as HTMLInputElement).value;
            }}
          />
        </label>
        {showChapter ? (
          <label className="form-label">
            Chapter
            <select className="input" name="chapterId" defaultValue="">
              <option value="">Select a chapter (optional)</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <hr style={YPP_APPLY_HR} />

      <div>
        <div style={YPP_APPLY_SECTION_STYLE}>Personal details</div>
        <div className="grid two">
          <label className="form-label" style={{ marginTop: 0 }}>
            Preferred first name *
            <input
              className="input"
              name="preferredFirstName"
              placeholder="What should we call you?"
              required
            />
          </label>
          <label className="form-label" style={{ marginTop: 0 }}>
            Last name *
            <input className="input" name="lastName" placeholder="Your last name" required />
          </label>
        </div>
        <div className="grid two">
          <label className="form-label">
            Phone number *
            <input
              className="input"
              name="phoneNumber"
              type="tel"
              placeholder="(555) 123-4567"
              required
            />
          </label>
          <label className="form-label">
            Date of birth
            <input className="input" name="dateOfBirth" type="date" />
          </label>
        </div>
        <label className="form-label">
          How did you hear about YPP?
          <select
            className="input"
            name="hearAboutYPPOption"
            value={hearAbout}
            onChange={(e) => {
              setHearAbout(e.target.value);
              setHearAboutDetail("");
            }}
          >
            <option value="">Select one (optional)</option>
            {HEAR_ABOUT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {hearAboutNeedsName || hearAboutNeedsDetail ? (
            <input
              className="input"
              name="hearAboutYPPDetail"
              style={{ marginTop: 6 }}
              placeholder={hearAboutNeedsName ? "Enter their name" : "Please specify"}
              value={hearAboutDetail}
              onChange={(e) => setHearAboutDetail(e.target.value)}
            />
          ) : null}
        </label>
      </div>

      <hr style={YPP_APPLY_HR} />

      <div>
        <div style={YPP_APPLY_SECTION_STYLE}>Location and school</div>
        <div className="grid two">
          <label className="form-label" style={{ marginTop: 0 }}>
            City *
            <input className="input" name="city" placeholder="e.g. Phoenix" required />
          </label>
          <label className="form-label" style={{ marginTop: 0 }}>
            State or province *
            <input className="input" name="stateProvince" placeholder="e.g. Arizona" required />
          </label>
        </div>
        <label className="form-label">
          Country *
          <select className="input" name="country" defaultValue="United States" required>
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label">
          High school name *
          <input className="input" name="schoolName" placeholder="Your school" required />
        </label>
        <label className="form-label">
          Graduation year *
          <input
            className="input"
            name="graduationYear"
            type="number"
            min={2025}
            max={2035}
            placeholder="e.g. 2028"
            required
          />
        </label>
      </div>
    </>
  );
}
