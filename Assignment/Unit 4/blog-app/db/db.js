import mongoose from "mongoose";
import "dotenv/config"

export default async function dbConnect() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("Database connected ✅");
  } catch (error) {
    console.log(error);
  }
}
