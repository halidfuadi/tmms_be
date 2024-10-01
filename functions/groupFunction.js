module.exports = {
    groupFunction: async(data, keyParam) => {
        return data.reduce((group, schedule) => {
            const key = schedule[keyParam];
            // console.log(schedule[schedule_id]);
            group[key] = group[key] ?? [];
            schedule.day_idx = +schedule.day_idx // convert string to number
            schedule.day_idx_act = +schedule.day_idx_act // convert string to number
            group[key].push(schedule);
            return group;
        }, {});
    }
}