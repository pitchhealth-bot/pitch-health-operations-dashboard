export type AirtableAttachment = {
  id?: string;
  url: string;
  filename: string;
  size?: number;
  type?: string;
};

export type PipelineStage =
  | "Pre-Licensing"
  | "Exam"
  | "Pre-Contracting"
  | "Contracting"
  | "RTS";

export type Agent = {
  id: string;
  name: string;
  email?: string;
  status?: string;
  role?: string;
  currentStage?: string;
  contractingDesignation?: string;
  startDate?: string;
  personalEmail?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  npn?: string;
  ahip2027?: AirtableAttachment[];
  stage: PipelineStage;
  subStage?: string;
  stageEnteredDate?: string;
  daysInStage: number;
  owner?: string;
  blocker?: string;
  blockerType?: string;
  missingFields: string[];
  licenseExpiry?: string;
  hierarchyVerified?: boolean;
  carrierSummary?: string;
  ceDueDate?: string;
  licensingStatus?: "Licensed" | "Non-licensed" | string;
};

export type DashboardData = {
  agents: Agent[];
  source: "airtable" | "sample" | "error";
  error?: string;
};
