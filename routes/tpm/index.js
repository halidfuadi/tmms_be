var express = require('express');
var router = express.Router();
const schedules = require('./schedules.route')
const ledgers = require('./ledgers.route')
const statusTpm = require('./statusTpm.route')
const execution = require('./execution.route')
const findings = require('./findings.route')
const history = require('./history.route')
const filter = require('./filter.route')
const itemcheckStd_master = require('./itemcheckStd_master.route')
const itemcheck = require('./itemcheck.route')
const users = require('./users')
const spareparts = require('./sparepart.route')
const itemcheckParts = require('./itemcheckSpareparts.route')
const counter = require('./counter.route')

const lines = require('./lines.route')
router.use('/lines', lines)

const machines = require('./machines.route')
router.use('/machines', machines)

const status = require('./status.route')
router.use('/status', status)

router.use('/schedules', schedules)
router.use('/ledgers', ledgers)
router.use('/execution', execution)
router.use('/findings', findings)
router.use('/statusTpm', statusTpm)
router.use('/filter', filter)
router.use('/history', history)
router.use('/counter', counter)

router.use('/itemcheck-std', itemcheckStd_master)
router.use('/itemchecks', itemcheck)
router.use('/spareparts', spareparts)
router.use('/itemcheck-parts', itemcheckParts)

router.use('/users', users)

module.exports = router