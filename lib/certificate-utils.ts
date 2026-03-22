// Certificate utility functions — no "use server" (pure, shared between server and client)

export const CERTIFICATE_TIER_CONFIG: Record<string, {
  label: string;
  color: string;
  accentColor: string;
  emoji: string;
  description: string;
  volunteerHours: number;
}> = {
  BRONZE: {
    label: "Bronze",
    color: "#cd7f32",
    accentColor: "#92400e",
    emoji: "🥉",
    description: "Emerging Leader",
    volunteerHours: 5,
  },
  SILVER: {
    label: "Silver",
    color: "#9ca3af",
    accentColor: "#374151",
    emoji: "🥈",
    description: "Dedicated Achiever",
    volunteerHours: 10,
  },
  GOLD: {
    label: "Gold",
    color: "#f59e0b",
    accentColor: "#92400e",
    emoji: "🥇",
    description: "Excellence Award",
    volunteerHours: 20,
  },
  LIFETIME: {
    label: "Lifetime",
    color: "#7c3aed",
    accentColor: "#4c1d95",
    emoji: "👑",
    description: "Lifetime Achievement",
    volunteerHours: 40,
  },
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function generateCertificateSvg(params: {
  recipientName: string;
  tier: string;
  issuedDate: string;
  mentorName?: string | null;
  chapterName?: string | null;
}): string {
  const { recipientName, tier, issuedDate, mentorName, chapterName } = params;
  const cfg = CERTIFICATE_TIER_CONFIG[tier] ?? CERTIFICATE_TIER_CONFIG.BRONZE;

  const formattedDate = new Date(issuedDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560" width="800" height="560" font-family="Georgia, serif">
  <!-- Background -->
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#faf9ff"/>
      <stop offset="100%" stop-color="#f3f0ff"/>
    </linearGradient>
    <linearGradient id="tierGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${cfg.color}"/>
      <stop offset="100%" stop-color="${cfg.accentColor}"/>
    </linearGradient>
  </defs>

  <!-- Border frame -->
  <rect width="800" height="560" fill="url(#bg)" rx="12"/>
  <rect x="12" y="12" width="776" height="536" fill="none" stroke="${cfg.color}" stroke-width="3" rx="8"/>
  <rect x="20" y="20" width="760" height="520" fill="none" stroke="${cfg.color}" stroke-width="1" opacity="0.4" rx="6"/>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="800" height="8" fill="url(#tierGrad)" rx="12"/>

  <!-- YPP Logo area -->
  <text x="400" y="68" text-anchor="middle" font-size="13" fill="${cfg.accentColor}" letter-spacing="4" font-family="Arial, sans-serif" font-weight="700">YOUNG PROFESSIONALS PROGRAM</text>
  <line x1="200" y1="78" x2="600" y2="78" stroke="${cfg.color}" stroke-width="1" opacity="0.5"/>

  <!-- Certificate title -->
  <text x="400" y="120" text-anchor="middle" font-size="36" fill="#1e1b4b" font-style="italic">Certificate of Achievement</text>

  <!-- Tier badge -->
  <rect x="320" y="138" width="160" height="36" fill="url(#tierGrad)" rx="18"/>
  <text x="400" y="162" text-anchor="middle" font-size="16" fill="white" font-family="Arial, sans-serif" font-weight="700" letter-spacing="2">${cfg.emoji} ${cfg.label.toUpperCase()}</text>

  <!-- "This certifies that" -->
  <text x="400" y="218" text-anchor="middle" font-size="14" fill="#6b7280" font-family="Arial, sans-serif" font-style="italic">This certifies that</text>

  <!-- Recipient name -->
  <text x="400" y="268" text-anchor="middle" font-size="42" fill="#1e1b4b" font-weight="bold">${escapeXml(recipientName)}</text>
  <line x1="180" y1="280" x2="620" y2="280" stroke="${cfg.color}" stroke-width="1.5"/>

  <!-- Achievement description -->
  <text x="400" y="316" text-anchor="middle" font-size="14" fill="#374151" font-family="Arial, sans-serif">
    has earned the <tspan font-weight="700" fill="${cfg.accentColor}">${cfg.label} Tier — ${cfg.description}</tspan> award
  </text>
  <text x="400" y="338" text-anchor="middle" font-size="14" fill="#374151" font-family="Arial, sans-serif">in the YPP Mentorship Achievement Program</text>

  ${mentorName ? `<text x="400" y="366" text-anchor="middle" font-size="13" fill="#6b7280" font-family="Arial, sans-serif">Mentored by ${escapeXml(mentorName)}${chapterName ? ` · ${escapeXml(chapterName)} Chapter` : ""}</text>` : ""}

  <!-- Decorative stars -->
  <text x="160" y="270" text-anchor="middle" font-size="28" fill="${cfg.color}" opacity="0.6">✦</text>
  <text x="640" y="270" text-anchor="middle" font-size="28" fill="${cfg.color}" opacity="0.6">✦</text>
  <text x="100" y="200" text-anchor="middle" font-size="18" fill="${cfg.color}" opacity="0.3">✦</text>
  <text x="700" y="200" text-anchor="middle" font-size="18" fill="${cfg.color}" opacity="0.3">✦</text>

  <!-- Date and signature area -->
  <line x1="100" y1="470" x2="300" y2="470" stroke="#d1d5db" stroke-width="1"/>
  <text x="200" y="488" text-anchor="middle" font-size="11" fill="#9ca3af" font-family="Arial, sans-serif">Date of Issue</text>
  <text x="200" y="504" text-anchor="middle" font-size="13" fill="#374151" font-family="Arial, sans-serif">${formattedDate}</text>

  <line x1="500" y1="470" x2="700" y2="470" stroke="#d1d5db" stroke-width="1"/>
  <text x="600" y="488" text-anchor="middle" font-size="11" fill="#9ca3af" font-family="Arial, sans-serif">Program Director</text>
  <text x="600" y="504" text-anchor="middle" font-size="13" fill="#374151" font-family="Arial, sans-serif" font-style="italic">Young Professionals Program</text>

  <!-- Bottom watermark -->
  <text x="400" y="540" text-anchor="middle" font-size="10" fill="#d1d5db" font-family="Arial, sans-serif" letter-spacing="1">YPP · ACHIEVEMENT PROGRAM · ${new Date(issuedDate).getFullYear()}</text>
</svg>`;
}
