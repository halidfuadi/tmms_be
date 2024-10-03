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

const fs = require('fs');
const {base64UrlDecode} = require("../../helpers/uri.helper");
router.get('/file', (req, res) => {
  if (fs.existsSync(req.query.path)) {
    if(req.query.path.includes('pdf')) {
      res.contentType("application/pdf");
    }
    fs.createReadStream(req.query.path).pipe(res)
  } else {
    res.status(500)
    console.log('File not found')
    res.send('File not found')
  }
});


module.exports = router;
