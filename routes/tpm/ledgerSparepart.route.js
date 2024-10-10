const express = require('express');
const {
    ledgerSparepartGet,
    ledgerSparepartGetSingle,
    ledgerSparepartCreate,
    ledgerSparepartDelete,
} = require('../../controllers/tpm/ledgerSparepart.controllers');
const router = express.Router();

router.get('/get', ledgerSparepartGet);
router.get('/get/:uuid', ledgerSparepartGetSingle);
router.post('/create', ledgerSparepartCreate);
router.delete('/delete/:uuid', ledgerSparepartDelete);

module.exports = router