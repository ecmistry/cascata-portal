import "dotenv/config";
import bcrypt from "bcrypt";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema.js";

const EMAIL = "admin";
const PASSWORD = "Gr@v1t33r0ck$";
const NAME = "Admin";
const OPEN_ID = `simple-login-${EMAIL}`;

async function createUser() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    const db = drizzle(process.env.DATABASE_URL);
    
    // Hash password
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    
    // First, try to find and update existing user with old email
    const oldEmail = "elesh.mistry@graviteesource.com";
    const oldUserResult = await db.select().from(users).where(eq(users.email, oldEmail)).limit(1);
    
    if (oldUserResult.length > 0) {
      // Update existing user to use new email/username
      const oldUser = oldUserResult[0];
      await db.update(users)
        .set({
          email: EMAIL,
          openId: OPEN_ID,
          name: NAME,
          passwordHash: passwordHash,
          loginMethod: "simple",
          role: "admin",
          lastSignedIn: new Date(),
        })
        .where(eq(users.id, oldUser.id));
      console.log(`✓ Updated existing user from "${oldEmail}" to "${EMAIL}"`);
    } else {
      // Check if admin user already exists
      const adminUserResult = await db.select().from(users).where(eq(users.email, EMAIL)).limit(1);
      
      if (adminUserResult.length > 0) {
        // Update existing admin user
        const adminUser = adminUserResult[0];
        await db.update(users)
          .set({
            openId: OPEN_ID,
            name: NAME,
            passwordHash: passwordHash,
            loginMethod: "simple",
            role: "admin",
            lastSignedIn: new Date(),
          })
          .where(eq(users.id, adminUser.id));
        console.log(`✓ Updated existing admin user`);
      } else {
        // Create new user
        await db.insert(users).values({
          openId: OPEN_ID,
          email: EMAIL,
          name: NAME,
          passwordHash: passwordHash,
          loginMethod: "simple",
          role: "admin",
          lastSignedIn: new Date(),
        });
        console.log(`✓ User created successfully!`);
      }
    }
    
    console.log(`\n✓ Login credentials:`);
    console.log(`  Username: ${EMAIL}`);
    console.log(`  Password: ${PASSWORD}`);
    console.log(`  Role: admin`);
    console.log(`\nYou can now log in at: /login`);
    process.exit(0);
  } catch (error: any) {
    console.error("Error creating user:", error.message);
    if (error.message.includes("passwordHash") || error.message.includes("column")) {
      console.log("\n⚠️  The passwordHash column may not exist in the database yet.");
      console.log("Please run: pnpm db:push");
      console.log("\nOr manually add the column:");
      console.log("ALTER TABLE users ADD COLUMN passwordHash VARCHAR(255) NULL;");
    }
    process.exit(1);
  }
}

createUser();

