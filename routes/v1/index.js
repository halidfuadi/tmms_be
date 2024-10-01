var express = require("express");
var router = express.Router();
const login = require("../auth/login");
const tpm = require("../tpm/index");

router.get("/", function (req, res) {
  console.log("Endpoint /test diakses");
  res.send({ status: 200, message: "Welcome to server" });
});

router.use("/login", login);
router.use("/tpm", tpm);

module.exports = router;
