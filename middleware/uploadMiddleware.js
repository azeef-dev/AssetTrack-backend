import multer from 'multer';
import path from 'path';
import ApiError from '../utils/ApiError.js';
import cloudinary from '../config/cloudinary.js';

const allowedTypes = /jpeg|jpg|png|webp|gif|mp4|mov|webm/;

const fileFilter = (req, file, cb) => {
    const extOk = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowedTypes.test(file.mimetype);
    if (extOk && mimeOk) return cb(null, true);
    cb(new ApiError(400, 'Only image/video files are allowed (jpg, png, webp, gif, mp4, mov, webm)'));
};

// Files are held in memory just long enough to stream to Cloudinary.
// Nothing ever touches local disk, so this works fine on Vercel's
// read-only filesystem.
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // 10MB per file, max 5 files
});

// Chain this AFTER upload.array()/.single(). It uploads every file multer
// parsed into req.files to Cloudinary, then rewrites req.files so each
// entry has a `path` pointing at the Cloudinary secure URL — controllers
// just read `.path`, same shape as before.
export const uploadToCloudinary = (folder = 'maintainiq') => async (req, res, next) => {
    const files = req.files || (req.file ? [req.file] : []);
    if (files.length === 0) return next();

    try {
        const uploaded = await Promise.all(
            files.map(
                (file) =>
                    new Promise((resolve, reject) => {
                        const stream = cloudinary.uploader.upload_stream(
                            { folder, resource_type: 'auto' },
                            (err, result) => {
                                if (err) return reject(err);
                                resolve({ ...file, path: result.secure_url, filename: result.public_id });
                            }
                        );
                        stream.end(file.buffer);
                    })
            )
        );
        if (req.files) req.files = uploaded;
        if (req.file) req.file = uploaded[0];
        next();
    } catch (err) {
        next(new ApiError(502, `Evidence upload failed: ${err.message}`));
    }
};

export default upload;