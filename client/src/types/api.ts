/**
 * Type definitions for tRPC API responses
 * These types match the server-side schema types
 */

export interface Company {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  bigqueryEnabled: boolean;
  bigqueryProjectId: string | null;
  bigqueryDatasetId: string | null;
  bigqueryCredentials: string | null;
  bigquerySqlHistoryTable: string | null;
  bigqueryConversionRatesTable: string | null;
  bigqueryActualsTable: string | null;
  bigqueryLastSync: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Forecast {
  id: number;
  companyId: number;
  regionId: number;
  sqlTypeId: number;
  year: number;
  quarter: number;
  predictedSqls: number;
  predictedOpps: number; // Stored as integer (multiply by 100 for precision)
  predictedRevenueNew: number; // Revenue in cents
  predictedRevenueUpsell: number; // Revenue in cents
  createdAt: Date;
  updatedAt: Date;
}

export interface Region {
  id: number;
  companyId: number;
  name: string;
  displayName: string;
  enabled: boolean;
  createdAt: Date;
}

export interface SqlType {
  id: number;
  companyId: number;
  name: string;
  displayName: string;
  enabled: boolean;
  createdAt: Date;
}

