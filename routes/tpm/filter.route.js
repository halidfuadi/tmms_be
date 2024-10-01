var express = require('express');
const { inchargeTpmOpt, machineTpmOpt, lineTpmOpt, itemcheckTpmOpt } = require('../../helpers/filterHelper.controller');
var router = express.Router();


router.post('/incharge', inchargeTpmOpt)
router.post('/machine', machineTpmOpt)
router.post('/line', lineTpmOpt)
router.post('/itemcheck', itemcheckTpmOpt)

module.exports = router