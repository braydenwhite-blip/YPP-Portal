import { google } from "googleapis";

/**
 * Reads analytics data from the parent Google Sheets database
 * Spreadsheet ID: 1LyZEkUMEeNVi5OXZqYPo9qJHUET8CSeVn9wbA8LiAEs
 */

const SPREADSHEET_ID = "1LyZEkUMEeNVi5OXZqYPo9qJHUET8CSeVn9wbA8LiAEs";

export type GoogleSheetsAnalytics = {
  totalPeople: number;
  totalChapters: number;
  totalPrograms: number;
  totalEvents: number;
  lastUpdated: string;
  rawData: Record<string, any>;
};

export async function getGoogleSheetsAnalytics(): Promise<GoogleSheetsAnalytics> {
  try {
    // For public spreadsheets, we can use the API key method
    const auth = new google.auth.GoogleAuth({
      apiKey: process.env.GOOGLE_SHEETS_API_KEY,
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Read the first sheet (usually contains summary data)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A1:Z100", // Adjust range as needed
    });

    const rows = response.data.values || [];
    
    // Parse the data based on your spreadsheet structure
    const analytics: GoogleSheetsAnalytics = {
      totalPeople: 0,
      totalChapters: 0,
      totalPrograms: 0,
      totalEvents: 0,
      lastUpdated: new Date().toISOString(),
      rawData: {},
    };

    // Try to find specific columns (adjust based on your sheet structure)
    if (rows.length > 0) {
      const headers = rows[0] as string[];
      const dataRows = rows.slice(1) as string[][];

      // Count non-empty rows
      analytics.totalPeople = dataRows.filter((row: string[]) => row.some((cell: string) => cell && cell.toString().trim())).length;

      // Look for specific columns
      const chapterIndex = headers.findIndex((h: string) => h.toLowerCase().includes("chapter"));
      const programIndex = headers.findIndex((h: string) => h.toLowerCase().includes("program") || h.toLowerCase().includes("course"));
      const eventIndex = headers.findIndex((h: string) => h.toLowerCase().includes("event"));

      if (chapterIndex >= 0) {
        analytics.totalChapters = new Set(dataRows.map((row: string[]) => row[chapterIndex]).filter(Boolean)).size;
      }
      if (programIndex >= 0) {
        analytics.totalPrograms = new Set(dataRows.map((row: string[]) => row[programIndex]).filter(Boolean)).size;
      }
      if (eventIndex >= 0) {
        analytics.totalEvents = new Set(dataRows.map((row: string[]) => row[eventIndex]).filter(Boolean)).size;
      }

      // Store raw data for display
      analytics.rawData = {
        headers,
        rowCount: dataRows.length,
        sampleRows: dataRows.slice(0, 5), // First 5 rows for preview
      };
    }

    return analytics;
  } catch (error) {
    // Silently return fallback data if API is not configured
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Only log if it's not a credentials error (which is expected in dev)
    if (!errorMessage.includes("Could not load the default credentials")) {
      console.error("Error reading Google Sheets:", error);
    }
    
    return {
      totalPeople: 0,
      totalChapters: 0,
      totalPrograms: 0,
      totalEvents: 0,
      lastUpdated: new Date().toISOString(),
      rawData: {
        error: errorMessage,
        note: "Google Sheets API not configured - add GOOGLE_SHEETS_API_KEY to .env",
      },
    };
  }
}
