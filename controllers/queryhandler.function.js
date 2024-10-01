function queryHandler(query) {
    const keyExists = Object.keys(query).length > 0
    if (!keyExists) {
        return []
    }
    let containerFilter = []
    for (let key in query) {
        if (key == 'month') {
            key = `(EXTRACT(month from  plan_check_dt), EXTRACT('year' from plan_check_dt))=(${+query['month'].split('-')[1]},${+query['month'].split('-')[0]})`
            containerFilter.push(`${key}`)
        } else if (key == 'yearonly') {
            key = `EXTRACT('year' from plan_check_dt)=${+query['yearonly']}`
            containerFilter.push(`${key}`)
        } else if (key == 'date') {
            key = `plan_check_dt = '${query['date']}'`
            containerFilter.push(`${key}`)
        }
    }
    delete query.month
    delete query.year
    delete query.yearonly
    delete query.date
    for (const key in query) {
        let value = query[key]
        if (value !== 'null' && value && value != -1) containerFilter.push(`${key} = '${value}'`)
        if (value == '0') containerFilter.push(`${key} = '${value}'`)
    }
    return containerFilter
}

module.exports = queryHandler