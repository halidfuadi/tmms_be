const multer = require("multer");

const path = require("path");
const { response } = require("../app");

const checkFileType = function(file, cb) { //Allowed file extensions
    const fileTypes = /jpeg|jpg|png|gif|pdf|heif|hevc/;
    console.log(file);

    //check extension names

    const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());


    const mimeType = fileTypes.test(file.mimetype);


    if (mimeType && extName) { return cb(null, true); } else {
        cb("Error: You can Only Upload Images & PDF!!");
    }
};

//Setting storage engine
const storageEngine = multer.diskStorage({  
    destination: function(req, file, cb) {
        console.log(file);
        cb(null, `./uploads`)
            // cb(null, ".\uploads\")
    },
    filename: (req, file, cb) => {
        cb(null, `${new Date().getTime()}|${req.body.sub_group_activity_id}-${req.body.step_nm}-${file.originalname}`);
    },
});

//initializing multer
const upload = multer({  
    storage: storageEngine,
    limits: { fileSize: 10000000 }, // 10 MB Max
    fileFilter: (req, file, cb) => {     checkFileType(file, cb);   },
});


module.exports = upload