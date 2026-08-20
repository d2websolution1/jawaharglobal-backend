import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

// Supabase Postgres configuration
// Required env variables in `backend/.env`:
//   DB_DIALECT=postgres
//   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
const dialect = process.env.DB_DIALECT || "postgres";

const options = {
  dialect,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // Supabase pooler ke liye zaroori
    },
  },
};

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  options
);

export default sequelize;