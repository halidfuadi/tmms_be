require("dotenv").config();
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const cors = require("cors");
const cron = require("node-cron");

var routerV1 = require("./routes/v1/index");
const { database } = require("./config/database");
database.connect();

// Middleware for logging API requests
function logAPIMessages(req, res, next) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] API Request: ${req.method} ${req.originalUrl}`);

  // Handle success or failure
  res.on("finish", () => {
    const statusCode = res.statusCode;
    const statusMessage = statusCode >= 400 ? "Failed" : "Success";
    console.log(
      `[${timestamp}] API Response: ${statusCode} - ${statusMessage}`
    );
  });

  next();
}

// NEED CRON TO MAKE SCHEDULE AUTOMATICALY DAILY FETCH
const {
  cronGeneratorSchedule,
  // cronGeneratorDaily,
} = require("./functions/cronGeneratorSchedule");
const cronCheckDelayStatus = require("./functions/cronCheckDelayStatus");

async function init_start() {
  console.log("Running cronGeneratorSchedule()....");
  try {
    // await cronGeneratorSchedule();
    console.log("Finished cronGeneratorSchedule()....");
  } catch (error) {
    console.error("Error in cronGeneratorSchedule:", error);
  }

  console.log("Running cronGeneratorDaily()....");
  try {
    // await cronGeneratorDaily();
    console.log("Finished cronGeneratorDaily()....");
  } catch (error) {
    console.error("Error in cronGeneratorDaily:", error);
  }

  console.log("Running cronCheckDelayStatus()....");
  try {
    await cronCheckDelayStatus();
    console.log("Finished cronCheckDelayStatus()....");
  } catch (error) {
    console.error("Error in cronCheckDelayStatus:", error);
  }
}

const { cronCounterLedger, cronEstimationDate } = require("./functions/cronCounterLedger");
async function counter(){
    // await cronCounterLedger();
    await cronEstimationDate();
}

cron.schedule("59 23 * * *", init_start);
cron.schedule("59 23 * * * *", counter);

console.log("Cron job scheduled. Waiting for the day to change...");

var app = express();
app.use(cors());
// init_start();
counter()

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(logAPIMessages);

app.use("/", routerV1);

// Mulai server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;
