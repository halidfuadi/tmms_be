var express = require('express');
const schedulesControllers = require('../../controllers/tpm/schedules.controllers');
var router = express.Router();

router.get('/search', schedulesControllers.getSchedule)
router.post('/today-activities', schedulesControllers.getTodayActivities)
router.post('/visualization', schedulesControllers.getVisualize)
router.post('/visualization-status', schedulesControllers.getVisualizeStatus)
router.post('/visualization-item', schedulesControllers.getVisualizeLine)
router.post('/add/pic', schedulesControllers.addPlanPic)
router.post('/edit/plandate', schedulesControllers.editPlanDate)
router.post('/visualization-item-yearly', schedulesControllers.getVusualizeYearly)
router.get('/getDelayed', schedulesControllers.getDelayedItem)
router.get('/visualization-trend', schedulesControllers.getVisualTrendMH)

module.exports = router