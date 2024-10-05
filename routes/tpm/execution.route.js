var express = require('express');
const {getExecHistory, addTpmExecution} = require('../../controllers/tpm/execution.controllers');
var router = express.Router();

const upload = require('../../helpers/upload');

router.get('/search', getExecHistory)
router.post('/add', upload.single('finding_image'), addTpmExecution)

module.exports = router