import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import MaintenanceRecord from '../models/MaintenanceRecord.js';
import Issue from '../models/Issue.js';
import logHistory from '../utils/logHistory.js';

export const createMaintenanceRecord = asyncHandler(async (req, res) => {
    const {
        issueId, inspectionFindings, actionsPerformed, partsUsed,
        timeSpentMinutes, conditionAfter, nextServiceDate, notes,
    } = req.body;
    if (!issueId) throw new ApiError(400, 'issueId is required');

    const issue = await Issue.findById(issueId).populate('asset');
    if (!issue) throw new ApiError(404, 'Issue not found');

    if (req.user.role === 'technician' && String(issue.assignedTo) !== String(req.user._id)) {
        throw new ApiError(403, 'You can only add maintenance records for issues assigned to you');
    }

    let parsedParts = partsUsed;
    if (typeof partsUsed === 'string') {
        try { parsedParts = JSON.parse(partsUsed); } catch { parsedParts = []; }
    }

    const record = await MaintenanceRecord.create({
        issue: issue._id,
        asset: issue.asset._id,
        technician: req.user._id,
        inspectionFindings,
        actionsPerformed,
        partsUsed: parsedParts || [],
        timeSpentMinutes,
        conditionAfter,
        nextServiceDate,
        notes,
        evidence: req.files ? req.files.map((f) => `/uploads/${f.filename}`) : [],
    });

    if (conditionAfter) issue.asset.condition = conditionAfter;
    if (nextServiceDate) issue.asset.nextServiceDate = nextServiceDate;
    await issue.asset.save();

    await logHistory({
        asset: issue.asset._id, issue: issue._id, actor: req.user._id,
        action: 'Maintenance Record Added', details: actionsPerformed || 'Maintenance work logged',
    });

    res.status(201).json(new ApiResponse(201, record, 'Maintenance record created'));
});

export const getMaintenanceByIssue = asyncHandler(async (req, res) => {
    const records = await MaintenanceRecord.find({ issue: req.params.issueId })
        .populate('technician', 'name email')
        .sort('-createdAt');
    res.status(200).json(new ApiResponse(200, records));
});

export const getMaintenanceById = asyncHandler(async (req, res) => {
    const record = await MaintenanceRecord.findById(req.params.id)
        .populate('technician', 'name email')
        .populate('asset', 'name assetCode')
        .populate('issue', 'issueNumber title');
    if (!record) throw new ApiError(404, 'Maintenance record not found');
    res.status(200).json(new ApiResponse(200, record));
});

export const updateMaintenanceRecord = asyncHandler(async (req, res) => {
    const record = await MaintenanceRecord.findById(req.params.id);
    if (!record) throw new ApiError(404, 'Maintenance record not found');

    if (req.user.role === 'technician' && String(record.technician) !== String(req.user._id)) {
        throw new ApiError(403, 'You can only edit your own maintenance records');
    }

    const fields = ['inspectionFindings', 'actionsPerformed', 'partsUsed', 'timeSpentMinutes', 'conditionAfter', 'nextServiceDate', 'notes'];
    fields.forEach((f) => {
        if (req.body[f] !== undefined) record[f] = req.body[f];
    });
    await record.save();

    res.status(200).json(new ApiResponse(200, record, 'Maintenance record updated'));
});

export const getAllMaintenanceRecords = asyncHandler(async (req, res) => {
    const { technician, asset, page = 1, limit = 20 } = req.query;
    const query = {};
    if (technician) query.technician = technician;
    if (asset) query.asset = asset;
    const skip = (Number(page) - 1) * Number(limit);
    const [records, total] = await Promise.all([
        MaintenanceRecord.find(query)
            .populate('technician', 'name email')
            .populate('asset', 'name assetCode')
            .populate('issue', 'issueNumber title')
            .sort('-createdAt').skip(skip).limit(Number(limit)),
        MaintenanceRecord.countDocuments(query),
    ]);
    res.status(200).json(new ApiResponse(200, { records, total, page: Number(page), pages: Math.ceil(total / limit) || 1 }));
});