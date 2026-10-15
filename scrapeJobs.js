/**
 * scrapeJobs.js — TinyFish API integration for JobScout
 *
 * All TinyFish API calls live in this single file.
 * Uses the Agent API (POST /v1/automation/run) to scrape live job listings
 * from public job boards using natural-language goals.
 *
 * Endpoint:  https://agent.tinyfish.ai/v1/automation/run  (sync)
 * Auth:      X-API-Key header
 * Docs:      https://docs.tinyfish.ai/agent-api/reference
 */

const TINYFISH_BASE = "https://agent.tinyfish.ai";
const AGENT_ENDPOINT = `${TINYFISH_BASE}/v1/automation/run`;

// ─── Job board targets ───────────────────────────────────────────────
// Each entry defines a starting URL and a goal template.
// The agent will navigate, search, and extract structured results.
const JOB_BOARDS = [
  {
    name: "LinkedIn Jobs",
    urlTemplate: (query, location) =>
      `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}${location ? `&location=${encodeURIComponent(location)}` : ""}`,
  },
  {
    name: "Indeed",
    urlTemplate: (query, location) =>
      `https://www.indeed.com/jobs?q=${encodeURIComponent(query)}${location ? `&l=${encodeURIComponent(location)}` : ""}`,
  },
  {
    name: "Internshala",
    urlTemplate: (query, _location) =>
      `https://internshala.com/internships/keywords-${encodeURIComponent(query.replace(/\s+/g, "-"))}`,
  },
];

// ─── Structured output schema ────────────────────────────────────────
// TinyFish supports output_schema to get clean JSON back from the agent.
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    jobs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          company: { type: "string" },
          location: { type: "string" },
          type: { type: "string" },
          link: { type: "string" },
          description: { type: "string" },
        },
        required: ["title", "company"],
      },
    },
  },
  required: ["jobs"],
};

// ─── Keyword extraction ──────────────────────────────────────────────
/**
 * Simple keyword extraction from raw profile text.
 * Pulls out known tech/business keywords, a likely role title, and
 * falls back to the most frequent meaningful words.
 */
function extractKeywords(rawText) {
  const text = rawText.toLowerCase();

  // Common skills & domains to look for
  const knownKeywords = [
    "javascript", "typescript", "python", "java", "c++", "c#", "ruby", "go",
    "rust", "swift", "kotlin", "php", "sql", "html", "css", "react", "angular",
    "vue", "node", "express", "django", "flask", "spring", "rails",
    "machine learning", "deep learning", "data science", "data analysis",
    "artificial intelligence", "ai", "ml", "nlp", "computer vision",
    "cloud", "aws", "azure", "gcp", "docker", "kubernetes", "devops",
    "frontend", "backend", "full stack", "fullstack", "mobile",
    "ios", "android", "react native", "flutter",
    "product management", "project management", "marketing", "design",
    "ui/ux", "ux", "ui", "graphic design", "figma", "photoshop",
    "finance", "accounting", "consulting", "sales", "business development",
    "cybersecurity", "security", "networking", "blockchain", "web3",
    "content writing", "copywriting", "seo", "social media",
  ];

  const found = knownKeywords.filter((kw) => text.includes(kw));

  // Common role-title patterns
  const rolePatterns = [
    "software engineer", "software developer", "web developer",
    "frontend developer", "backend developer", "full stack developer",
    "data scientist", "data analyst", "data engineer",
    "machine learning engineer", "ml engineer", "ai engineer",
    "product manager", "project manager", "business analyst",
    "ux designer", "ui designer", "graphic designer",
    "devops engineer", "cloud engineer", "site reliability engineer",
    "mobile developer", "ios developer", "android developer",
    "marketing manager", "content writer", "copywriter",
    "financial analyst", "consultant", "sales executive",
    "cyber security analyst", "network engineer",
  ];

  const roleTitle = rolePatterns.find((r) => text.includes(r)) || null;

  // Build a search query from the top keywords
  const topKeywords = found.slice(0, 5);
  const searchQuery = roleTitle
    ? roleTitle
    : topKeywords.length > 0
      ? topKeywords.join(" ")
      : rawText.split(/\s+/).slice(0, 5).join(" "); // fallback: first 5 words

  return { searchQuery, roleTitle, keywords: found };
}

// ─── Parse unstructured text ─────────────────────────────────────────
/**
 * If TinyFish returns unstructured text instead of JSON,
 * attempt to parse it into job objects.
 */
function parseUnstructuredResult(text) {
  if (!text || typeof text !== "string") return [];

  const jobs = [];
  // Try splitting by numbered items or dashes
  const blocks = text.split(/\n(?=\d+[\.\)]\s|[-•]\s)/);

  for (const block of blocks) {
    if (block.trim().length < 10) continue;

    const titleMatch = block.match(/(?:title|position|role)[:\s]*(.+)/i);
    const companyMatch = block.match(/(?:company|organization|employer)[:\s]*(.+)/i);
    const locationMatch = block.match(/(?:location|city|place)[:\s]*(.+)/i);
    const linkMatch = block.match(/(https?:\/\/[^\s,)]+)/i);

    if (titleMatch || companyMatch) {
      jobs.push({
        title: titleMatch ? titleMatch[1].trim() : "Untitled Position",
        company: companyMatch ? companyMatch[1].trim() : "Unknown Company",
        location: locationMatch ? locationMatch[1].trim() : "Not specified",
        type: "Job",
        link: linkMatch ? linkMatch[1].trim() : "#",
        description: block.trim().substring(0, 200),
      });
    }
  }

  return jobs;
}

// ─── Normalize results ───────────────────────────────────────────────
/**
 * Takes raw TinyFish result and normalizes into clean card data.
 */
function normalizeJobs(result, source, jobType) {
  let jobs = [];

  if (!result) return jobs;

  // If result has a .jobs array (structured output)
  if (result.jobs && Array.isArray(result.jobs)) {
    jobs = result.jobs;
  }
  // If result is itself an array
  else if (Array.isArray(result)) {
    jobs = result;
  }
  // If result is a string (unstructured)
  else if (typeof result === "string") {
    jobs = parseUnstructuredResult(result);
  }
  // If result is an object with a string result field
  else if (typeof result.result === "string") {
    jobs = parseUnstructuredResult(result.result);
  }

  return jobs.map((job) => ({
    title: job.title || "Untitled Position",
    company: job.company || "Unknown Company",
    location: job.location || "Not specified",
    type: job.type || jobType || "Job",
    link: job.link || job.url || "#",
    description:
      job.description || job.summary || job.snippet || "No description available.",
    source: source,
  }));
}

// ─── Main scrape function ────────────────────────────────────────────
/**
 * Scrapes jobs from multiple boards using TinyFish Agent API.
 *
 * @param {string} rawProfile  - User's raw profile text
 * @param {string} jobType     - "Internship", "Full-time", or "Both"
 * @param {string} location    - Preferred location (may be empty)
 * @param {boolean} remote     - Whether remote is preferred
 * @returns {Promise<object>}  - { jobs: [...], meta: {...} }
 */
async function scrapeJobs(rawProfile, jobType = "Both", location = "", remote = false) {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    throw new Error("TINYFISH_API_KEY is not set in .env");
  }

  // 1. Extract search terms from the profile
  const { searchQuery, roleTitle, keywords } = extractKeywords(rawProfile);

  // Build the search query string
  let query = searchQuery;
  if (jobType === "Internship") query += " internship";
  if (remote) query += " remote";

  // Build location string
  let locationStr = location || "";
  if (remote && !locationStr) locationStr = "Remote";

  // Build the goal (natural-language instruction for TinyFish)
  const typeLabel =
    jobType === "Both" ? "jobs and internships" : jobType === "Internship" ? "internships" : "jobs";
  const goal = `Search for ${typeLabel} matching "${query}"${locationStr ? ` in ${locationStr}` : ""}. Extract the first 8-10 listings visible on the page. For each listing, extract: title, company, location, type (Internship or Job or Full-time), link (the URL to apply or view the full listing), and a short description (1-2 sentences). Return as a JSON object with a "jobs" array.`;

  // 2. Scrape from multiple boards in parallel
  //    We pick relevant boards based on job type
  const boards =
    jobType === "Internship"
      ? JOB_BOARDS // include Internshala for internships
      : JOB_BOARDS.filter((b) => b.name !== "Internshala");

  const promises = boards.map(async (board) => {
    const url = board.urlTemplate(query, locationStr);

    try {
      const response = await fetch(AGENT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          url,
          goal,
          output_schema: OUTPUT_SCHEMA,
        }),
        signal: AbortSignal.timeout(120_000), // 120s timeout per docs
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`[${board.name}] API error ${response.status}: ${errBody}`);
        return [];
      }

      const data = await response.json();

      if (data.status === "COMPLETED" && data.result) {
        return normalizeJobs(data.result, board.name, jobType);
      } else {
        console.warn(`[${board.name}] Run status: ${data.status}`, data.error || "");
        return [];
      }
    } catch (err) {
      console.error(`[${board.name}] Request failed:`, err.message);
      return [];
    }
  });

  const resultsArrays = await Promise.allSettled(promises);
  const allJobs = resultsArrays.flatMap((r) =>
    r.status === "fulfilled" ? r.value : []
  );

  // Deduplicate by title + company
  const seen = new Set();
  const unique = allJobs.filter((j) => {
    const key = `${j.title.toLowerCase()}|${j.company.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    jobs: unique,
    meta: {
      query,
      roleTitle,
      keywords,
      location: locationStr,
      boardsSearched: boards.map((b) => b.name),
      totalResults: unique.length,
    },
  };
}

module.exports = { scrapeJobs, extractKeywords };
