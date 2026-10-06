import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const certificate = sequelize.define(
  "certificate",
  {
    courseSlug: { type: DataTypes.STRING, allowNull: false },
    fullName: { type: DataTypes.STRING, allowNull: false },
    visitorId: { type: DataTypes.STRING, allowNull: false },
    certificateNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    diplomaNumber: { type: DataTypes.STRING, allowNull: true },
    issuedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    meta: { type: DataTypes.JSON },
  },
  {
    timestamps: true,
    tableName: "certificates",
    freezeTableName: true,
  }
);

export default certificate;