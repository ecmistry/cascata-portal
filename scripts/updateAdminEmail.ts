import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema.js";

const OLD_EMAIL = "admin";
const NEW_EMAIL = "elesh@cascata.ai";
const NEW_NAME = "Elesh";

async function updateEmail() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    const db = drizzle(process.env.DATABASE_URL);
    
    // Find admin user
    const adminUserResult = await db.select().from(users).where(eq(users.email, OLD_EMAIL)).limit(1);
    
    if (adminUserResult.length === 0) {
      throw new Error(`User with email "${OLD_EMAIL}" not found`);
    }
    
    const adminUser = adminUserResult[0];
    const newOpenId = `simple-login-${NEW_EMAIL}`;
    
    // Update email, name, and openId
    await db.update(users)
      .set({
        email: NEW_EMAIL,
        name: NEW_NAME,
        openId: newOpenId,
        lastSignedIn: new Date(),
      })
      .where(eq(users.email, OLD_EMAIL));
    
    console.log(`✓ Email updated successfully!`);
    console.log(`\nUpdated login credentials:`);
    console.log(`  Username/Email: ${NEW_EMAIL}`);
    console.log(`  Password: [p5]U"g&lU'9MxuY.Jh;`);
    console.log(`  Name: ${NEW_NAME}`);
    console.log(`  Role: admin`);
    console.log(`\nYou can now log in at: /login`);
    process.exit(0);
  } catch (error: any) {
    console.error("Error updating email:", error.message);
    process.exit(1);
  }
}

updateEmail();





