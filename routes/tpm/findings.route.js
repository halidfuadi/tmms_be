var express = require('express');
const { getFindings, editFinding } = require('../../controllers/tpm/findings.controllers');
var router = express.Router();

router.get('/search', getFindings)
router.put('/edit/:finding_id', editFinding)

module.exports = router