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
    }
}
