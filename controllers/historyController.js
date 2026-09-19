import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import History from '../models/History.js';

export const getAssetHistory = asyncHandler(async (req, res) => {
    const history = await History.find({ asset: req.params.assetId })
        .populate('actor', 'name role')
        .populate('issue', 'issueNumber title status')
        .sort('-createdAt');
    res.status(200).json(new ApiResponse(200, history));
});

export const getAllHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 30 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [history, total] = await Promise.all([
        History.find()
            .populate('actor', 'name role')
            .populate('asset', 'name assetCode')
            .populate('issue', 'issueNumber title')
            .sort('-createdAt').skip(skip).limit(Number(limit)),
        History.countDocuments(),
    ]);
    res.status(200).json(new ApiResponse(200, { history, total, page: Number(page), pages: Math.ceil(total / limit) || 1 }));
});