import * as admin from "firebase-admin";
import {Collection} from "../constants/Collection";
import {Timestamp} from "firebase-admin/firestore";

export const isProjectCreator = async (
  userId: string,
  projectId: string,
): Promise<boolean> => {
  const doc = await admin
    .firestore()
    .collection(Collection.PROJECTS)
    .doc(projectId)
    .get();

  if (!doc.exists) return false;

  const projectData = doc.data();
  return projectData?.createdBy === userId;
};

export const isProjectMemberOrCreator = async (
  userId: string,
  projectId: string,
): Promise<boolean> => {
  const projectDoc = await admin
    .firestore()
    .collection(Collection.PROJECTS)
    .doc(projectId)
    .get();

  if (!projectDoc.exists) {
    return false;
  }

  const projectData = projectDoc.data();
  const isCreator = projectData?.createdBy === userId;
  const isMember = Array.isArray(projectData?.members) ?
    projectData.members.some((member) => member?.id === userId) :
    false;

  return isCreator || isMember;
};

export type ProjectMemberMetric = {
  memberId: string;
  name: string;
  photoUrl: string;
  ambagCount: number;
  totalAmount: number;
  percentage: number;
};

export type MonthlyAmbagMetric = {
  month: string;
  ambagCount: number;
  totalAmount: number;
};

export const roundToTwo = (value: number): number =>
  Math.round(value * 100) / 100;

export const extractTargetAmount = (
  projectData: Record<string, unknown> | undefined,
): number | null => {
  if (!projectData) {
    return null;
  }

  const candidateKeys = ["targetAmount", "target", "goalAmount", "goal"];

  for (const key of candidateKeys) {
    const value = projectData[key];

    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
};

const getMonthKey = (value: unknown): string | null => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString().slice(0, 7);
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 7);
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as {toDate?: unknown}).toDate === "function"
  ) {
    const date = (value as {toDate: () => Date}).toDate();
    return date.toISOString().slice(0, 7);
  }

  return null;
};

export const buildProjectMetrics = (
  ambags: Record<string, unknown>[],
  projectData: Record<string, unknown> | undefined,
) => {
  const totalAmount = ambags.reduce((sum, ambag) => {
    const amount = ambag.amount;
    return sum + (typeof amount === "number" ? amount : 0);
  }, 0);

  const targetAmount = extractTargetAmount(projectData);
  const completionRate =
    targetAmount && targetAmount > 0 ?
      roundToTwo((totalAmount / targetAmount) * 100) :
      null;

  const memberTotals = new Map<string, ProjectMemberMetric>();
  const monthlyTotals = new Map<string, MonthlyAmbagMetric>();

  ambags.forEach((ambag) => {
    const amount = typeof ambag.amount === "number" ? ambag.amount : 0;
    const memberId =
      typeof ambag.createdBy === "string" && ambag.createdBy.trim() ?
        ambag.createdBy :
        "unknown";

    const contributor =
      typeof ambag.contributor === "object" && ambag.contributor !== null ?
        (ambag.contributor as Record<string, unknown>) :
        undefined;

    const currentMemberMetric = memberTotals.get(memberId) || {
      memberId,
      name:
        typeof contributor?.name === "string" ?
          contributor.name :
          "Unknown member",
      photoUrl:
        typeof contributor?.photoUrl === "string" ? contributor.photoUrl : "",
      ambagCount: 0,
      totalAmount: 0,
      percentage: 0,
    };

    currentMemberMetric.ambagCount += 1;
    currentMemberMetric.totalAmount += amount;
    memberTotals.set(memberId, currentMemberMetric);

    const monthKey = getMonthKey(ambag.createdAt);
    if (monthKey) {
      const currentMonthMetric = monthlyTotals.get(monthKey) || {
        month: monthKey,
        ambagCount: 0,
        totalAmount: 0,
      };

      currentMonthMetric.ambagCount += 1;
      currentMonthMetric.totalAmount += amount;
      monthlyTotals.set(monthKey, currentMonthMetric);
    }
  });

  const ambagShareByMember = Array
    .from(memberTotals.values())
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .map((metric) => ({
      ...metric,
      totalAmount: roundToTwo(metric.totalAmount),
      percentage:
        totalAmount > 0 ?
          roundToTwo((metric.totalAmount / totalAmount) * 100) :
          0,
    }));

  const monthlyAmbagCounts = Array
    .from(monthlyTotals.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((metric) => ({
      ...metric,
      totalAmount: roundToTwo(metric.totalAmount),
    }));

  return {
    totalAmbags: ambags.length,
    totalAmount: roundToTwo(totalAmount),
    targetAmount,
    completionRate,
    ambagShareByMember,
    monthlyAmbagCounts,
  };
};
