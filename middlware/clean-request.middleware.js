module.exports = (req, res, next) => {
    const castNull = (obj) => {
        Object.keys(obj).forEach((key) => {
            if (obj[key] === 'null') {
                obj[key] = null;
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                castNull(obj[key]);
            }
        });
    };

    if (req.body) castNull(req.body);
    if (req.params) castNull(req.params);
    if (req.query) castNull(req.query);

    next();
}