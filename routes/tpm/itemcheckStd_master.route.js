var express = require('express');
const itemcheckStdCont = require('../../controllers/master/itemcheck_std.controller');
var router = express.Router();

router.get('/search', itemcheckStdCont.getData)

module.exports = router