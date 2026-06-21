/**
 * Branded outer shell for all portal emails.
 *
 * This wraps the inner body (the editable part of a template) in the YPP
 * header/footer chrome. It is applied server-side at render time and is NEVER
 * user-editable, so deliverability and branding can't be broken by template
 * customization.
 *
 * Extracted from `lib/email.ts` so the render layer and the legacy send
 * functions share a single definition.
 */
export const emailShell = (body: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1c1917; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #5a1da8 0%, #6b21c8 45%, #8b3fe8 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Youth Passion Project</h1>
  </div>
  <div style="background: #ffffff; padding: 32px; border: 1px solid #e7e5e4; border-top: none; border-radius: 0 0 16px 16px;">
    ${body}
  </div>
  <p style="text-align: center; color: #78716c; font-size: 12px; margin-top: 24px;">Youth Passion Project · This is an automated notification.</p>
</body>
</html>`;
