var express = require('express');
const { getExecHistory, addTpmExecution } = require('../../controllers/tpm/execution.controllers');
var router = express.Router();

router.get('/search', getExecHistory)
router.post('/add', addTpmExecution)

module.exports = router