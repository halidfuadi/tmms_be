const moment = require('moment')
const { queryGET, queryPOST } = require('../helpers/query')
const table = require('../config/table')
const getLastIdData = require('../helpers/getLastIdData')
const { v4 } = require('uuid');
async function scheduleGeneratorNewItem(data) {
    console.log(data);
    const timemilisecOffset = 1000 * 60 * 60 * 24
    const forecaseSubsOneMonth = timemilisecOffset * 30
    let period_type 
    if(data.period_id == 0){
        period_type = 1
    }else if(data.period_id == 1){
        period_type = 30
    }else if(data.period_id == 2){
        period_type = 365
    }
    console.log(period_type);
    let offsettime = new Date(data.plan_check_dt).getTime() + (timemilisecOffset * data.val_period * period_type)
    console.log(offsettime);
    let timeLastCheck = new Date().getTime() - forecaseSubsOneMonth
    const isDateGB = offsettime >= timeLastCheck
    console.log(moment(offsettime).startOf('day').fromNow());
    if(isDateGB){
        const formattedDate = moment(offsettime).format('YYYY-MM-DD')
        console.log(formattedDate);
        
    }
}

module.exports = scheduleGeneratorNewItem