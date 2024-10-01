var express = require('express');
const { sparepartAdd, sparepartsGet, sparepartEdit, sparepartDelete, sparepartsGetDetail, sparepartItemcheck, itemSparepartAdd } = require('../../controllers/master/spareparts.controller');
var router = express.Router();

router.get('/get-sparepart/search', sparepartsGet)
router.get('/get-sparepart-detail/search', sparepartsGetDetail)
router.get('/get-sparepart-itemcheck/search', sparepartItemcheck)
router.post('/add-part', sparepartAdd)
router.put('/edit-part', sparepartEdit)
router.delete('/delete-part', sparepartDelete)
router.post('/add-sparepart-itemcheck', itemSparepartAdd)

module.exports = router