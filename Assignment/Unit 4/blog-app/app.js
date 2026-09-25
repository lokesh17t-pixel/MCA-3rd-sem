import express from "express";
import cookieParser from "cookie-parser";
import userRoutes from "./routes/userRoutes.js"
import blogRoutes from "./routes/blogRoutes.js"
import dbConnect from "./db/db.js";
import "dotenv/config"


const app = express();
const PORT = process.env.PORT || 8000

app.use(express.static("view")) // SSR

app.use(express.json());
app.use(cookieParser(process.env.SECRET_KEY))


// database
dbConnect()

// Routes
app.use("/users"  ,userRoutes )
app.use("/blogs" , blogRoutes)

app.listen(PORT, '0.0.0.0',() => {
  console.log(`Server started at http://localhost:${PORT}`);
});


