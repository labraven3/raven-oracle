import { prisma } from "../lib/prisma.js";

/**
 * Alpha Duplicate Detection Service
 * 
 * Detects potential duplicate alpha submissions based on:
 * - Similar titles (case-insensitive, fuzzy matching)
 * - Same evidence URLs
 * - Same project
 * - Recent submissions (within last 30 days)
 */

interface DuplicateMatch {
  submissionId: string;
  title: string;
  similarity: "HIGH" | "MEDIUM";
  reason: string;
  createdAt: Date;
}

/**
 * Calculate similarity between two strings (simple implementation)
 * Returns 0.0 to 1.0 where 1.0 is identical
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8;
  }

  // Simple word-based similarity
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;

  return intersection.size / union.size;
}

/**
 * Check if two evidence link arrays have significant overlap
 */
function hasEvidenceOverlap(
  links1: unknown,
  links2: unknown
): boolean {
  if (!Array.isArray(links1) || !Array.isArray(links2)) {
    return false;
  }

  const set1 = new Set(
    links1.filter((item): item is string => typeof item === "string")
  );
  const set2 = new Set(
    links2.filter((item): item is string => typeof item === "string")
  );

  // If any evidence link is shared, consider it a duplicate
  for (const link of set1) {
    if (set2.has(link)) {
      return true;
    }
  }

  return false;
}

/**
 * Detect potential duplicates for a new alpha submission
 * 
 * @param title - Title of the new submission
 * @param evidenceLinks - Evidence links array
 * @param projectId - Optional project ID
 * @param submittedByUserId - User submitting the alpha
 * @returns Array of potential duplicate matches
 */
export async function detectDuplicateAlpha(
  title: string,
  evidenceLinks: unknown,
  projectId: string | null,
  submittedByUserId: string
): Promise<DuplicateMatch[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Fetch recent submissions
  const recentSubmissions = await prisma.alphaSubmission.findMany({
    where: {
      deletedAt: null,
      createdAt: {
        gte: thirtyDaysAgo,
      },
      status: {
        in: ["SUBMITTED", "UNDER_REVIEW", "VERIFIED"],
      },
      // Exclude user's own submissions
      NOT: {
        submittedByUserId,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  const matches: DuplicateMatch[] = [];

  for (const submission of recentSubmissions) {
    const reasons: string[] = [];
    let matchScore = 0;

    // Check title similarity
    const titleSimilarity = calculateStringSimilarity(
      title,
      submission.title
    );

    if (titleSimilarity >= 0.8) {
      reasons.push("Very similar title");
      matchScore += 3;
    } else if (titleSimilarity >= 0.6) {
      reasons.push("Similar title");
      matchScore += 2;
    }

    // Check evidence overlap
    if (hasEvidenceOverlap(evidenceLinks, submission.evidenceLinks)) {
      reasons.push("Shared evidence link");
      matchScore += 4;
    }

    // Check same project
    if (
      projectId &&
      submission.projectId &&
      projectId === submission.projectId
    ) {
      reasons.push("Same project");
      matchScore += 1;
    }

    // Only report if there's a meaningful match
    if (matchScore >= 3) {
      matches.push({
        submissionId: submission.id,
        title: submission.title,
        similarity: matchScore >= 5 ? "HIGH" : "MEDIUM",
        reason: reasons.join(", "),
        createdAt: submission.createdAt,
      });
    }
  }

  // Sort by match score (implicit in similarity) and recency
  return matches.sort((a, b) => {
    if (a.similarity !== b.similarity) {
      return a.similarity === "HIGH" ? -1 : 1;
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/**
 * Check for exact duplicate (same user submitting identical content)
 */
export async function checkExactDuplicate(
  title: string,
  evidenceLinks: unknown,
  submittedByUserId: string
): Promise<string | null> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const exactMatch = await prisma.alphaSubmission.findFirst({
    where: {
      submittedByUserId,
      title,
      deletedAt: null,
      createdAt: {
        gte: sevenDaysAgo,
      },
      status: {
        notIn: ["REJECTED", "ARCHIVED"],
      },
    },
    select: {
      id: true,
      evidenceLinks: true,
    },
  });

  if (!exactMatch) {
    return null;
  }

  // Check if evidence links match
  if (hasEvidenceOverlap(evidenceLinks, exactMatch.evidenceLinks)) {
    return exactMatch.id;
  }

  return null;
}
