import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import Issue from '../models/Issue.js';
import Asset from '../models/Asset.js';
import User from '../models/User.js';
import MaintenanceRecord from '../models/MaintenanceRecord.js';
import { generateIssueNumber } from '../utils/generateCode.js';
import logHistory from '../utils/logHistory.js';
import sendEmail from '../utils/sendEmail.js';

const STATUS_FLOW = {
    Reported: ['Assigned', 'Closed'],
    Assigned: ['Inspection Started', 'Reported'],
    'Inspection Started': ['Maintenance In Progress', 'Waiting for Parts'],
    'Maintenance In Progress': ['Waiting for Parts', 'Resolved'],
    'Waiting for Parts': ['Maintenance In Progress'],
    Resolved: ['Closed', 'Reopened'],
    Closed: ['Reopened'],
    Reopened: ['Assigned', 'Inspection Started'],
};

const ASSET_STATUS_MAP = {
    Reported: 'Issue Reported',
    Assigned: 'Issue Reported',
    'Inspection Started': 'Under Inspection',
    'Maintenance In Progress': 'Under Maintenance',
    'Waiting for Parts': 'Under Maintenance',
    Resolved: 'Operational',
    Reopened: 'Issue Reported',
};

export const createIssue = asyncHandler(async (req, res) => {
    const {
        assetId, assetCode, title, description, category, priority,
        guestName, guestEmail, guestPhone, aiSuggestion, aiWasEdited,
    } = req.body;

    if (!description) throw new ApiError(400, 'Issue description is required');
    if (!assetId && !assetCode) throw new ApiError(400, 'assetId or assetCode is required');

    const asset = assetId
        ? await Asset.findById(assetId)
        : await Asset.findOne({ assetCode: assetCode.toUpperCase() });
    if (!asset) throw new ApiError(404, 'Asset not found');
    if (asset.status === 'Retired') throw new ApiError(400, 'Cannot report issues for a retired asset');

    if (!req.user && (!guestName || !guestEmail)) {
        throw new ApiError(400, 'Name and email are required to report an issue');
    }

    let parsedAiSuggestion = aiSuggestion;
    if (typeof aiSuggestion === 'string' && aiSuggestion.trim()) {
        try {
            parsedAiSuggestion = JSON.parse(aiSuggestion);
        } catch {
            parsedAiSuggestion = undefined;
        }
    }

    const issueNumber = await generateIssueNumber();

    const issue = await Issue.create({
        issueNumber,
        asset: asset._id,
        title: title || description.slice(0, 80),
        description,
        category: category || 'General',
        priority: priority || 'Medium',
        reportedBy: req.user ? req.user._id : undefined,
        guestReporter: !req.user ? { name: guestName, email: guestEmail, phone: guestPhone } : undefined,
        evidence: req.files ? req.files.map((f) => `/uploads/${f.filename}`) : [],
        aiSuggestion: parsedAiSuggestion || undefined,
        aiWasEdited: !!aiWasEdited,
    });

    asset.status = 'Issue Reported';
    await asset.save();

    await logHistory({
        asset: asset._id,
        issue: issue._id,
        actor: req.user ? req.user._id : null,
        actorName: req.user ? req.user.name : guestName,
        action: 'Issue Reported',
        details: `Issue ${issue.issueNumber}: ${issue.title}`,
    });

    res.status(201).json(new ApiResponse(201, issue, 'Issue reported successfully'));
});

export const getIssues = asyncHandler(async (req, res) => {
    const { status, priority, asset, technician, category, search, page = 1, limit = 20, sort = '-createdAt' } = req.query;
    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (asset) query.asset = asset;
    if (category) query.category = category;
    if (technician) query.assignedTo = technician;
    if (search) {
        query.$or = [
            { issueNumber: { $regex: search, $options: 'i' } },
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
        ];
    }

    if (req.user.role === 'technician' && !req.query.all) {
        query.assignedTo = req.user._id;
    }
    if (req.user.role === 'user') {
        query.reportedBy = req.user._id;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [issues, total] = await Promise.all([
        Issue.find(query)
            .populate('asset', 'name assetCode location category')
            .populate('assignedTo', 'name email')
            .populate('reportedBy', 'name email')
            .sort(sort).skip(skip).limit(Number(limit)),
        Issue.countDocuments(query),
    ]);

    res.status(200).json(new ApiResponse(200, { issues, total, page: Number(page), pages: Math.ceil(total / limit) || 1 }));
});

export const getIssueById = asyncHandler(async (req, res) => {
    const issue = await Issue.findById(req.params.id)
        .populate('asset')
        .populate('assignedTo', 'name email phone')
        .populate('reportedBy', 'name email phone');
    if (!issue) throw new ApiError(404, 'Issue not found');
    res.status(200).json(new ApiResponse(200, issue));
});

export const trackIssue = asyncHandler(async (req, res) => {
    const issue = await Issue.findOne({ issueNumber: req.params.issueNumber })
        .populate('asset', 'name assetCode')
        .select('issueNumber title status priority createdAt resolvedAt closedAt asset');
    if (!issue) throw new ApiError(404, 'Issue not found. Please check your issue number.');
    res.status(200).json(new ApiResponse(200, issue));
});

export const assignIssue = asyncHandler(async (req, res) => {
    const { technicianId } = req.body;
    if (!technicianId) throw new ApiError(400, 'technicianId is required');

    const technician = await User.findById(technicianId);
    if (!technician || technician.role !== 'technician') throw new ApiError(400, 'Invalid technician');

    const issue = await Issue.findById(req.params.id).populate('asset');
    if (!issue) throw new ApiError(404, 'Issue not found');
    if (issue.status === 'Closed') throw new ApiError(400, 'Cannot assign a closed issue');

    issue.assignedTo = technician._id;
    issue.status = 'Assigned';
    await issue.save();

    issue.asset.assignedTechnician = technician._id;
    await issue.asset.save();

    await logHistory({
        asset: issue.asset._id, issue: issue._id, actor: req.user._id,
        action: 'Issue Assigned', details: `Issue ${issue.issueNumber} assigned to ${technician.name}`,
    });

    sendEmail({
        to: technician.email,
        subject: `New Issue Assigned: ${issue.issueNumber}`,
        html: `<p>Hi ${technician.name},</p><p>You have been assigned issue <strong>${issue.issueNumber}</strong> - ${issue.title} on asset <strong>${issue.asset.name}</strong>.</p>`,
    }).catch(() => { });

    res.status(200).json(new ApiResponse(200, issue, 'Issue assigned successfully'));
});

export const updateIssueStatus = asyncHandler(async (req, res) => {
    const { status, note } = req.body;
    if (!status) throw new ApiError(400, 'status is required');

    const issue = await Issue.findById(req.params.id).populate('asset');
    if (!issue) throw new ApiError(404, 'Issue not found');

    if (req.user.role === 'technician' && String(issue.assignedTo) !== String(req.user._id)) {
        throw new ApiError(403, 'You can only update issues assigned to you');
    }

    const allowedNext = STATUS_FLOW[issue.status] || [];
    if (!allowedNext.includes(status)) {
        throw new ApiError(400, `Cannot move issue from "${issue.status}" to "${status}". Allowed: ${allowedNext.join(', ') || 'none'}`);
    }

    if (status === 'Resolved') {
        const hasMaintenance = await MaintenanceRecord.exists({ issue: issue._id });
        if (!hasMaintenance) throw new ApiError(400, 'A maintenance record is required before resolving this issue');
        issue.resolvedAt = new Date();
    }
    if (status === 'Closed') issue.closedAt = new Date();
    if (status === 'Reopened') {
        issue.reopenCount += 1;
        issue.resolvedAt = undefined;
        issue.closedAt = undefined;
    }

    issue.status = status;
    await issue.save();

    if (ASSET_STATUS_MAP[status]) {
        issue.asset.status = ASSET_STATUS_MAP[status];
        if (status === 'Resolved') issue.asset.lastServiceDate = new Date();
        await issue.asset.save();
    }

    await logHistory({
        asset: issue.asset._id, issue: issue._id, actor: req.user._id,
        action: `Issue status changed to ${status}`, details: note || '',
    });

    res.status(200).json(new ApiResponse(200, issue, `Issue status updated to ${status}`));
});

export const reopenIssue = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const issue = await Issue.findById(req.params.id).populate('asset');
    if (!issue) throw new ApiError(404, 'Issue not found');
    if (!['Resolved', 'Closed'].includes(issue.status)) throw new ApiError(400, 'Only resolved or closed issues can be reopened');

    issue.status = 'Reopened';
    issue.reopenCount += 1;
    issue.resolvedAt = undefined;
    issue.closedAt = undefined;
    await issue.save();

    issue.asset.status = 'Issue Reported';
    await issue.asset.save();

    await logHistory({
        asset: issue.asset._id, issue: issue._id, actor: req.user._id,
        action: 'Issue Reopened', details: reason || '',
    });

    res.status(200).json(new ApiResponse(200, issue, 'Issue reopened'));
});

export const getCriticalIssues = asyncHandler(async (req, res) => {
    const issues = await Issue.find({ priority: 'Critical', status: { $nin: ['Resolved', 'Closed'] } })
        .populate('asset', 'name assetCode location')
        .sort('-createdAt');
    res.status(200).json(new ApiResponse(200, issues));
});