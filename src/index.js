import express from "express";
import "dotenv/config";
import routes from "./routes/index.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(express.json());
app.use(routes);


app.use((req, res) => {
  res.status(404).json({ error: "Không tìm thấy" });
});


app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Lỗi hệ thống" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

