import { z } from "zod";

/**
 * Password validation schema
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

/**
 * Email/Username validation schema
 */
export const emailOrUsernameSchema = z.string()
  .min(1, "Email or username is required")
  .max(320, "Email or username is too long");

/**
 * Company name validation schema
 */
export const companyNameSchema = z.string()
  .min(1, "Company name is required")
  .max(255, "Company name is too long")
  .trim();

/**
 * Description validation schema
 */
export const descriptionSchema = z.string()
  .max(5000, "Description is too long")
  .optional();

