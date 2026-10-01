import type { Agent } from "./types";

export const sampleAgents: Agent[] = [
  { id:"1", name:"Michelle Diemer", stage:"Contracting", subStage:"Carrier Requests", daysInStage:9, owner:"Dani", blocker:"Waiting for state appointment", blockerType:"State Delay", missingFields:["Discord","PDB"], licenseExpiry:"2026-10-08", hierarchyVerified:true, carrierSummary:"2 / 4 RTS" },
  { id:"2", name:"James Carter", stage:"Pre-Contracting", subStage:"AHIP", daysInStage:12, owner:"Joslyn", blocker:"AHIP incomplete", blockerType:"Agent Action Required", missingFields:["AHIP"], licenseExpiry:"2026-12-14", hierarchyVerified:false, carrierSummary:"0 / 4 RTS" },
  { id:"3", name:"Tasha Green", stage:"Exam", subStage:"Exam Scheduled", daysInStage:4, owner:"Christina", missingFields:[], licenseExpiry:"2027-03-10", hierarchyVerified:false, carrierSummary:"0 / 4 RTS" },
  { id:"4", name:"Olujimi Adeyemi", stage:"RTS", subStage:"Partial RTS", daysInStage:3, owner:"Dani", blocker:"Cigna pending", blockerType:"Carrier Delay", missingFields:[], licenseExpiry:"2026-10-21", hierarchyVerified:true, carrierSummary:"3 / 4 RTS" },
  { id:"5", name:"Sarah Williams", stage:"Pre-Licensing", subStage:"Course In Progress", daysInStage:6, owner:"Joslyn", missingFields:["DOB"], licenseExpiry:"2027-08-02", hierarchyVerified:false, carrierSummary:"0 / 4 RTS" },
  { id:"6", name:"Marco Reyes", stage:"Contracting", subStage:"Hierarchy Verification", daysInStage:15, owner:"Dani", blocker:"Upline mismatch", blockerType:"Internal Action Required", missingFields:["Upline Cert"], licenseExpiry:"2026-10-04", hierarchyVerified:false, carrierSummary:"1 / 4 RTS" }
];
