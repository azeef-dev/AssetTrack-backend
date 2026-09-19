import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import Asset from '../models/Asset.js';
import History from '../models/History.js';
import { generateAssetCode } from '../utils/generateCode.js';
import { generateQRCodeDataUrl, buildPublicAssetUrl } from '../utils/qrGenerator.js';
import logHistory from '../utils/logHistory.js';

const VALID_STATUSES = ['Operational', 'Issue Reported', 'Under Inspection', 'Under Maintenance', 'Out of Service', 'Retired'];

export const createAsset = asyncHandler(async (req, res) => {
    const {
        name, category, location, description, model, serialNumber, manufacturer,
        condition, purchaseDate, warrantyExpiry, lastServiceDate, nextServiceDate,
        assignedTechnician, image, notes, assetCode: customCode,
    } = req.body;

    if (!name || !category || !location) throw new ApiError(400, 'Name, category and location are required');

    let assetCode = customCode ? customCode.trim().toUpperCase() : await generateAssetCode();
    const exists = await Asset.findOne({ assetCode });
    if (exists) throw new ApiError(409, `Asset code '${assetCode}' already exists`);

    const asset = await Asset.create({
        assetCode, name, category, location, description, model, serialNumber, manufacturer,
        condition, purchaseDate, warrantyExpiry, lastServiceDate, nextServiceDate,
        assignedTechnician: assignedTechnician || undefined, image, notes,
        createdBy: req.user._id,
    });

    const publicUrl = buildPublicAssetUrl(asset.assetCode);
    asset.qrCodeDataUrl = await generateQRCodeDataUrl(publicUrl);
    await asset.save();

    await logHistory({
        asset: asset._id, actor: req.user._id, action: 'Asset Registered',
        details: `Asset "${asset.name}" (${asset.assetCode}) was registered.`,
    });

    res.status(201).json(new ApiResponse(201, asset, 'Asset created successfully'));
});

export const getAssets = asyncHandler(async (req, res) => {
    const { search, status, category, location, technician, condition, page = 1, limit = 20, sort = '-createdAt' } = req.query;
    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;
    if (location) query.location = { $regex: location, $options: 'i' };
    if (technician) query.assignedTechnician = technician;
    if (condition) query.condition = condition;
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { assetCode: { $regex: search, $options: 'i' } },
            { category: { $regex: search, $options: 'i' } },
            { location: { $regex: search, $options: 'i' } },
        ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [assets, total] = await Promise.all([
        Asset.find(query).populate('assignedTechnician', 'name email phone').sort(sort).skip(skip).limit(Number(limit)),
        Asset.countDocuments(query),
    ]);

    res.status(200).json(new ApiResponse(200, { assets, total, page: Number(page), pages: Math.ceil(total / limit) || 1 }));
});

export const getAssetById = asyncHandler(async (req, res) => {
    const asset = await Asset.findById(req.params.id)
        .populate('assignedTechnician', 'name email phone')
        .populate('createdBy', 'name email');
    if (!asset) throw new ApiError(404, 'Asset not found');
    res.status(200).json(new ApiResponse(200, asset));
});

export const getPublicAsset = asyncHandler(async (req, res) => {
    const asset = await Asset.findOne({ assetCode: req.params.assetCode.toUpperCase() });
    if (!asset) throw new ApiError(404, 'Asset not found. Please check the QR code or link.');

    const recentHistory = await History.find({ asset: asset._id })
        .sort('-createdAt')
        .limit(10)
        .select('action createdAt');

    const safeAsset = {
        _id: asset._id,
        assetCode: asset.assetCode,
        name: asset.name,
        category: asset.category,
        location: asset.location,
        condition: asset.condition,
        status: asset.status,
        lastServiceDate: asset.lastServiceDate,
        nextServiceDate: asset.nextServiceDate,
        image: asset.image,
        isRetired: asset.isRetired || asset.status === 'Retired',
        recentActivity: recentHistory.map((h) => ({ action: h.action, date: h.createdAt })),
    };

    res.status(200).json(new ApiResponse(200, safeAsset));
});

export const updateAsset = asyncHandler(async (req, res) => {
    const asset = await Asset.findById(req.params.id);
    if (!asset) throw new ApiError(404, 'Asset not found');

    const fields = [
        'name', 'category', 'location', 'description', 'model', 'serialNumber', 'manufacturer',
        'condition', 'purchaseDate', 'warrantyExpiry', 'lastServiceDate', 'nextServiceDate',
        'assignedTechnician', 'image', 'notes',
    ];

    const changes = [];
    fields.forEach((f) => {
        if (req.body[f] !== undefined && String(asset[f] ?? '') !== String(req.body[f] ?? '')) {
            changes.push(f);
            asset[f] = req.body[f] === '' ? undefined : req.body[f];
        }
    });

    if (req.body.status !== undefined && req.body.status !== asset.status) {
        if (!VALID_STATUSES.includes(req.body.status)) throw new ApiError(400, 'Invalid asset status');
        changes.push('status');
        asset.status = req.body.status;
        if (req.body.status === 'Retired') asset.isRetired = true;
    }

    await asset.save();

    if (changes.length) {
        await logHistory({
            asset: asset._id, actor: req.user._id, action: 'Asset Updated',
            details: `Fields updated: ${changes.join(', ')}`,
        });
    }

    res.status(200).json(new ApiResponse(200, asset, 'Asset updated successfully'));
});

export const retireAsset = asyncHandler(async (req, res) => {
    const asset = await Asset.findById(req.params.id);
    if (!asset) throw new ApiError(404, 'Asset not found');
    asset.status = 'Retired';
    asset.isRetired = true;
    await asset.save();
    await logHistory({
        asset: asset._id, actor: req.user._id, action: 'Asset Retired',
        details: `Asset "${asset.name}" was retired.`,
    });
    res.status(200).json(new ApiResponse(200, null, 'Asset retired successfully'));
});

export const regenerateQRCode = asyncHandler(async (req, res) => {
    const asset = await Asset.findById(req.params.id);
    if (!asset) throw new ApiError(404, 'Asset not found');
    const publicUrl = buildPublicAssetUrl(asset.assetCode);
    asset.qrCodeDataUrl = await generateQRCodeDataUrl(publicUrl);
    await asset.save();
    res.status(200).json(new ApiResponse(200, { qrCodeDataUrl: asset.qrCodeDataUrl, publicUrl }, 'QR code regenerated'));
});

export const getAssetHistory = asyncHandler(async (req, res) => {
    const history = await History.find({ asset: req.params.id })
        .populate('actor', 'name role')
        .populate('issue', 'issueNumber title')
        .sort('-createdAt');
    res.status(200).json(new ApiResponse(200, history));
});

export const getBulkQRCodes = asyncHandler(async (req, res) => {
    const { assetIds } = req.body;
    if (!Array.isArray(assetIds) || !assetIds.length) throw new ApiError(400, 'assetIds array is required');
    const assets = await Asset.find({ _id: { $in: assetIds } }).select('assetCode name location qrCodeDataUrl');
    res.status(200).json(new ApiResponse(200, assets));
});