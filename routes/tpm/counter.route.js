var express = require('express');
const { getCounter, getDetail, postExecute } = require('../../controllers/tpm/tpmCounter.controller');
var router = express.Router();

router.get('/getCounter', getCounter)
router.get('/getDetail/search', getDetail)
router.post('/upload-execute', postExecute)

module.exports = router