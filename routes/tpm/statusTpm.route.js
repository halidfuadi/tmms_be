var express = require('express');
const { statusTpm, statusTpmOpt } = require('../../controllers/tpm/statusTpm.controller');
var router = express.Router();

router.get('/search', statusTpm)
router.post('/view', statusTpmOpt)

module.exports = router