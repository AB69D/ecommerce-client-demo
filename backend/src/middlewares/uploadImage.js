import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import { ApiError } from "../lib/ApiError.js";

// 1. Configure multer to use memory storage instead of uploading directly.
//    Bound every upload: cap file size and count (memoryStorage buffers the
//    whole file in RAM, so unbounded uploads are a DoS vector) and reject any
//    non-image MIME type up front before it ever reaches Cloudinary.
const storage = multer.memoryStorage();
// SVG is included deliberately — the branding UI invites vector logo uploads
// (crisp at any size), and processAndUploadImages below stores SVGs natively
// instead of forcing the webp raster conversion applied to everything else.
const IMAGE_MIME = /^image\/(jpe?g|png|webp|gif|avif|heic|heif|svg\+xml)$/i;
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB per file
const cloudinary_upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_BYTES, files: 12 },
    fileFilter: (req, file, cb) => {
        if (IMAGE_MIME.test(file.mimetype)) cb(null, true);
        else cb(ApiError.badRequest(`Unsupported file type "${file.mimetype}". Please upload an image (JPEG, PNG, WebP, GIF, AVIF, SVG).`));
    },
});

// 2. Upload middleware
export const processAndUploadImages = async (req, res, next) => {
    try {
        const uploadStream = (buffer, isSvg) => {
            return new Promise((resolve, reject) => {
                // SVG is vector — forcing the usual webp conversion would rasterize
                // it at Cloudinary's default canvas size and lose the whole point of
                // uploading a scalable logo. Store it as-is instead.
                const options = isSvg
                    ? { folder: "Ab9dEcommerce" }
                    : { folder: "Ab9dEcommerce", format: "webp" };
                const stream = cloudinary.uploader.upload_stream(
                    options,
                    (error, result) => {
                        if (result) resolve(result);
                        else reject(error);
                    }
                );
                stream.end(buffer);
            });
        };

        const processFile = async (file) => {
            const result = await uploadStream(file.buffer, file.mimetype === "image/svg+xml");
            
            // Mutate the file object so the controllers can continue cleanly
            // They expect 'file.path' to contain the Cloudinary URL.
            file.path = result.secure_url;
            return file;
        };

        if (req.file) {
            await processFile(req.file);
        } else if (req.files) {
            // Handle object format from cloudinary_upload.fields()
            if (Array.isArray(req.files)) {
                await Promise.all(req.files.map(file => processFile(file)));
            } else {
                // Handle object with field names as keys
                const fileArrays = Object.values(req.files);
                const allFiles = fileArrays.flat();
                await Promise.all(allFiles.map(file => processFile(file)));
            }
        }

        next();
    } catch (error) {
        console.error("Image Processing Error:", error);
        return res.status(500).json({
            message: "Failed to upload image",
            error: true,
            success: false
        });
    }
};

export default cloudinary_upload;
