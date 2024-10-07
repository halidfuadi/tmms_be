module.exports = {
    base64UrlDecode: (base64Url) => {
        // Replace URL-safe characters with Base64 characters
        let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

        // Add padding if necessary
        while (base64.length % 4) {
            base64 += "=";
        }

        // Decode the Base64 string
        return atob(base64) || undefined;
    },
    paginationRequest: (req) => {
        const limit = req.query.limit ? parseInt(req.query.limit) : null; // Default limit is 10
        const page = req.query.page ? parseInt(req.query.page) : null; // Default page is 1
        const offset = limit && page ? (page - 1) * limit : null;

        if(limit && page){
            return {
                limit,
                page,
                offset
            };
        }

        return null;
    }
}
