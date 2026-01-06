import "dotenv/config";
import bcrypt from "bcrypt";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema.js";

const EMAIL = "admin";
const NEW_PASSWORD = '[p5]U"g&lU\'9MxuY.Jh;';

async function updatePassword() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    const db = drizzle(process.env.DATABASE_URL);
    
    // Find admin user
    const adminUserResult = await db.select().from(users).where(eq(users.email, EMAIL)).limit(1);
    
    if (adminUserResult.length === 0) {
      throw new Error(`User with email "${EMAIL}" not found`);
    }
    
    // Hash new password
    const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);
    
    // Update password
    await db.update(users)
      .set({
        passwordHash: passwordHash,
        lastSignedIn: new Date(),
      })
      .where(eq(users.email, EMAIL));
    
    console.log(`✓ Password updated successfully for user: ${EMAIL}`);
    console.log(`\nNew login credentials:`);
    console.log(`  Username: ${EMAIL}`);
    console.log(`  Password: ${NEW_PASSWORD}`);
    console.log(`\nYou can now log in at: /login`);
    process.exit(0);
  } catch (error: any) {
    console.error("Error updating password:", error.message);
    process.exit(1);
  }
}

updatePassword();





