function queryHandler(query, likeKey = null) {
    const keyExists = Object.keys(query).length > 0
    if (!keyExists) {
        return []
    }
    let containerFilter = []
    for (let key in query) {
        if (key.includes('limit') || key.includes('page')) {
            continue;
        }

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
        if (
            key.includes('limit')
            || key.includes('page')
            || key.includes('group_by')
        ) {
            continue;
        }

        let value = query[key]
        if (value !== 'null' && value && value != -1) {
            if (typeof likeKey === 'string' && key.toLowerCase().includes(likeKey)) {
                containerFilter.push(`lower(${key}) like '%${typeof value === 'string' ? value.toLowerCase() : value}%'`);
            } else {
                containerFilter.push(`${key} = '${value}'`);
            }
        }
        if (value == '0') containerFilter.push(`${key} = '${value}'`)
    }
    return containerFilter
}

module.exports = queryHandler