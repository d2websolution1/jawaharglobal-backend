import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import sequelize from "../config/db.js";
import AdminUser from "../models/AdminUser.js";

dotenv.config();

const ADMIN_USERNAME = "admin";
const ADMIN_EMAIL = "admin@jawaharglobalfoundation.in";
const ADMIN_PASSWORD = "jhawaharglobal@123"; // login ke baad ise change kar lena

const run = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const [admin, created] = await AdminUser.findOrCreate({
      where: { email: ADMIN_EMAIL },
      defaults: {
        username: ADMIN_USERNAME,
        email: ADMIN_EMAIL,
        passwordHash,
        role: "admin",
        isActive: true,
      },
    });

    if (!created) {
      // Agar pehle se exist karta hai, to password reset kar do
      admin.passwordHash = passwordHash;
      admin.isActive = true;
      await admin.save();
      console.log("Existing admin found — password reset.");
    } else {
      console.log("New admin created.");
    }

    console.log("Username:", ADMIN_USERNAME);
    console.log("Email:", ADMIN_EMAIL);
    console.log("Password:", ADMIN_PASSWORD);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();