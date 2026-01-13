import { EmailTemplate } from "../../../models/email/emailTemplate.model.js";
import { EmailCampaign } from "../../../models/email/emailCampaign.model.js";
import { JobSeeker } from "../../../models/jobSeeker/jobSeeker.model.js";
import { Recruiter } from "../../../models/recruiter/recruiter.model.js";
import { emailService } from "../../../services/emailService.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

/**
 * Get recipient count based on filters
 * Helps admin preview how many people will receive the email
 */
export const getRecipientCount = asyncHandler(async (req, res) => {
    const { recipientType, category, status, state, city } = req.query;

    let jobSeekerCount = 0;
    let recruiterCount = 0;

    // Build query for job seekers
    if (recipientType === "job-seeker" || recipientType === "all") {
        const jsQuery = { email: { $exists: true, $ne: "" } };
        if (category) jsQuery.category = category;
        if (status) jsQuery.status = status;
        if (state) jsQuery.state = state;
        if (city) jsQuery.city = city;

        jobSeekerCount = await JobSeeker.countDocuments(jsQuery);
    }

    // Build query for recruiters
    if (recipientType === "recruiter" || recipientType === "all") {
        const recQuery = { email: { $exists: true, $ne: "" } };
        if (status) recQuery.status = status;
        if (state) recQuery.state = state;
        if (city) recQuery.city = city;

        recruiterCount = await Recruiter.countDocuments(recQuery);
    }

    return res.status(200).json(
        ApiResponse.success(
            {
                jobSeekerCount,
                recruiterCount,
                totalCount: jobSeekerCount + recruiterCount,
            },
            "Recipient count fetched successfully"
        )
    );
});

/**
 * Preview email before sending
 * Returns rendered HTML for preview
 */
export const previewEmail = asyncHandler(async (req, res) => {
    const { subject, content, templateId } = req.body;

    let emailContent = content;

    // If templateId provided, use template content
    if (templateId) {
        const template = await EmailTemplate.findById(templateId);
        if (!template) {
            return res.status(404).json(
                ApiResponse.error("Template not found")
            );
        }
        emailContent = template.content;
    }

    // Render HTML
    const html = emailService.renderEmailTemplate(emailContent);

    return res.status(200).json(
        ApiResponse.success(
            {
                subject: subject || "Preview",
                html,
            },
            "Email preview generated"
        )
    );
});

/**
 * Send bulk email campaign
 */
export const sendBulkEmail = asyncHandler(async (req, res) => {
    const {
        name,
        subject,
        content,
        templateId,
        recipientType,
        customEmails,
        filters = {},
        scheduledAt
    } = req.body;

    // Validate required fields
    if (!subject || !recipientType) {
        return res.status(400).json(
            ApiResponse.error("Subject and recipientType are required")
        );
    }

    // Validate custom emails if recipientType is 'custom'
    if (recipientType === 'custom') {
        if (!customEmails || !Array.isArray(customEmails) || customEmails.length === 0) {
            return res.status(400).json(
                ApiResponse.error("customEmails array is required when recipientType is 'custom'")
            );
        }
    }

    let emailContent = content;

    // If templateId, get template content
    if (templateId) {
        const template = await EmailTemplate.findById(templateId);
        if (!template) {
            return res.status(404).json(
                ApiResponse.error("Template not found")
            );
        }
        emailContent = template.content;
    }

    // Get recipients
    let recipients;
    if (recipientType === 'custom') {
        // Use custom emails directly
        recipients = customEmails.map(email => ({
            email: email.toLowerCase().trim(),
            name: email.split('@')[0], // Use email prefix as name
            userType: 'custom',
            _id: null,
        }));
    } else {
        recipients = await getRecipients(recipientType, filters);
    }

    if (recipients.length === 0) {
        return res.status(400).json(
            ApiResponse.error("No recipients found with the given filters")
        );
    }

    // Render HTML
    const html = emailService.renderEmailTemplate(emailContent);

    // Create campaign record
    const campaign = await EmailCampaign.create({
        name: name || `Campaign ${new Date().toISOString()}`,
        template: templateId,
        subject,
        content: emailContent,
        htmlContent: html,
        recipientType,
        filters,
        recipients: recipients.map(r => ({
            email: r.email,
            userId: r._id,
            userType: r.userType,
            name: r.name,
            status: "pending",
        })),
        stats: {
            totalRecipients: recipients.length,
        },
        status: scheduledAt ? "scheduled" : "sending",
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        createdBy: req.user._id,
    });

    // If scheduled, just save and return
    if (scheduledAt) {
        return res.status(201).json(
            ApiResponse.success(
                { campaign: { _id: campaign._id, status: campaign.status } },
                `Email scheduled for ${recipients.length} recipients`
            )
        );
    }

    // Send emails immediately (in background)
    sendCampaignEmails(campaign._id).catch(err => {
        console.error("Campaign send error:", err);
    });

    return res.status(201).json(
        ApiResponse.success(
            {
                campaign: {
                    _id: campaign._id,
                    status: "sending",
                    totalRecipients: recipients.length,
                }
            },
            `Sending email to ${recipients.length} recipients`
        )
    );
});

/**
 * Helper: Get recipients based on type and filters
 */
async function getRecipients(recipientType, filters) {
    const recipients = [];
    const { category, status, state, city } = filters;

    // Get job seekers
    if (recipientType === "job-seeker" || recipientType === "all") {
        const jsQuery = { email: { $exists: true, $ne: "" } };
        if (category) jsQuery.category = category;
        if (status) jsQuery.status = status;
        if (state) jsQuery.state = state;
        if (city) jsQuery.city = city;

        const jobSeekers = await JobSeeker.find(jsQuery)
            .select("email name _id")
            .lean();

        recipients.push(...jobSeekers.map(js => ({
            ...js,
            userType: "job-seeker",
        })));
    }

    // Get recruiters
    if (recipientType === "recruiter" || recipientType === "all") {
        const recQuery = { email: { $exists: true, $ne: "" } };
        if (status) recQuery.status = status;
        if (state) recQuery.state = state;
        if (city) recQuery.city = city;

        const recruiters = await Recruiter.find(recQuery)
            .select("email name companyName _id")
            .lean();

        recipients.push(...recruiters.map(r => ({
            ...r,
            name: r.name || r.companyName,
            userType: "recruiter",
        })));
    }

    return recipients;
}

/**
 * Helper: Send campaign emails in background
 */
async function sendCampaignEmails(campaignId) {
    const campaign = await EmailCampaign.findById(campaignId);
    if (!campaign) return;

    campaign.status = "sending";
    campaign.startedAt = new Date();
    await campaign.save();

    const recipients = campaign.recipients.map(r => ({
        email: r.email,
        name: r.name,
        userId: r.userId,
    }));

    const results = await emailService.sendBulkEmails(
        recipients,
        { subject: campaign.subject, html: campaign.htmlContent },
        async (progress) => {
            // Update campaign stats periodically
            await EmailCampaign.findByIdAndUpdate(campaignId, {
                "stats.sentCount": progress.sent,
                "stats.failedCount": progress.failed,
            });
        }
    );

    // Update final stats
    campaign.stats.sentCount = results.sent;
    campaign.stats.failedCount = results.failed;
    campaign.status = "completed";
    campaign.completedAt = new Date();

    // Update individual recipient statuses
    results.details.forEach(detail => {
        const recipient = campaign.recipients.find(
            r => r.userId?.toString() === detail.userId?.toString()
        );
        if (recipient) {
            recipient.status = detail.status;
            recipient.sentAt = detail.status === "sent" ? new Date() : null;
            recipient.errorMessage = detail.error || null;
        }
    });

    await campaign.save();
    console.log(`✅ Campaign ${campaignId} completed: ${results.sent} sent, ${results.failed} failed`);
}

/**
 * Get campaign history
 */
export const getCampaigns = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalCount = await EmailCampaign.countDocuments();
    const totalPages = Math.ceil(totalCount / limit);

    const campaigns = await EmailCampaign.find()
        .select("name subject recipientType stats status createdAt completedAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    return res.status(200).json(
        ApiResponse.success(
            { campaigns },
            "Campaigns fetched successfully",
            {
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCount,
                    limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                },
            }
        )
    );
});

/**
 * Get single campaign details
 */
export const getCampaignById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const campaign = await EmailCampaign.findById(id)
        .populate("template", "name category")
        .populate("createdBy", "name email")
        .lean();

    if (!campaign) {
        return res.status(404).json(
            ApiResponse.error("Campaign not found")
        );
    }

    return res.status(200).json(
        ApiResponse.success(
            { campaign },
            "Campaign fetched successfully"
        )
    );
});

// ==================== TEMPLATE CRUD ====================

/**
 * Create email template
 */
export const createTemplate = asyncHandler(async (req, res) => {
    const { name, category, subject, preheader, content, targetAudience } = req.body;

    if (!name || !subject) {
        return res.status(400).json(
            ApiResponse.error("Name and subject are required")
        );
    }

    const template = await EmailTemplate.create({
        name,
        category,
        subject,
        preheader,
        content,
        targetAudience,
        createdBy: req.user._id,
    });

    return res.status(201).json(
        ApiResponse.success(
            { template },
            "Template created successfully"
        )
    );
});

/**
 * Get all templates
 */
export const getTemplates = asyncHandler(async (req, res) => {
    const { category, targetAudience, isActive } = req.query;

    const query = {};
    if (category) query.category = category;
    if (targetAudience) query.targetAudience = targetAudience;
    if (isActive !== undefined) query.isActive = isActive === "true";

    const templates = await EmailTemplate.find(query)
        .select("name category subject targetAudience isActive createdAt")
        .sort({ createdAt: -1 })
        .lean();

    return res.status(200).json(
        ApiResponse.success(
            { templates },
            "Templates fetched successfully"
        )
    );
});

/**
 * Get template by ID
 */
export const getTemplateById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const template = await EmailTemplate.findById(id).lean();

    if (!template) {
        return res.status(404).json(
            ApiResponse.error("Template not found")
        );
    }

    return res.status(200).json(
        ApiResponse.success(
            { template },
            "Template fetched successfully"
        )
    );
});

/**
 * Update template
 */
export const updateTemplate = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const template = await EmailTemplate.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
    );

    if (!template) {
        return res.status(404).json(
            ApiResponse.error("Template not found")
        );
    }

    return res.status(200).json(
        ApiResponse.success(
            { template },
            "Template updated successfully"
        )
    );
});

/**
 * Delete template
 */
export const deleteTemplate = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const template = await EmailTemplate.findByIdAndDelete(id);

    if (!template) {
        return res.status(404).json(
            ApiResponse.error("Template not found")
        );
    }

    return res.status(200).json(
        ApiResponse.success(
            null,
            "Template deleted successfully"
        )
    );
});

/**
 * Get pre-built template categories
 */
export const getTemplateCategories = asyncHandler(async (req, res) => {
    const categories = [
        { value: "job-alert", label: "Job Alerts", description: "Notify about new job opportunities" },
        { value: "platform-update", label: "Platform Updates", description: "Announce new features" },
        { value: "profile-reminder", label: "Profile Reminders", description: "Encourage profile completion" },
        { value: "promotional", label: "Promotions", description: "Special offers and discounts" },
        { value: "greeting", label: "Greetings", description: "Festival and holiday wishes" },
        { value: "policy-update", label: "Policy Updates", description: "Terms and conditions changes" },
        { value: "security", label: "Security", description: "Security alerts and tips" },
        { value: "maintenance", label: "Maintenance", description: "Scheduled maintenance notices" },
        { value: "custom", label: "Custom", description: "Custom email content" },
    ];

    return res.status(200).json(
        ApiResponse.success(
            { categories },
            "Categories fetched successfully"
        )
    );
});
