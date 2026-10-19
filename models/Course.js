import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Course = sequelize.define(
  "Course",
  {
    slug: { type: DataTypes.STRING, allowNull: false, unique: true },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    level: { type: DataTypes.STRING },
    coverImageUrl: { type: DataTypes.TEXT },
    durationHours: { type: DataTypes.INTEGER },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { 
    timestamps: true,
    tableName: "courses",
    freezeTableName: true,
  }
);

export default Course;