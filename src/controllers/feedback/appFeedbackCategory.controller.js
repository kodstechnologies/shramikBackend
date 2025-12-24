export const getAppFeedbackCategories = async (req, res) => {
    console.log("📂 [AppFeedbackCategory] Fetch categories from ENUM");

    const categories = [
        { key: "APP_PERFORMANCE", label: "App Performance" },
        { key: "UI_UX", label: "UI / UX Issue" },
        { key: "JOB_SEARCH", label: "Job Search & Filters" },
        { key: "JOB_APPLY_ISSUE", label: "Job Apply Issue" },
        { key: "PAYMENT", label: "Payment / Subscription" },
        { key: "NOTIFICATION_ISSUE", label: "Notification Issue" },
        { key: "BUG_REPORT", label: "Bug Report" },
        { key: "FEATURE_REQUEST", label: "Feature Request" },
        { key: "TRUST_SAFETY", label: "Trust & Safety" },
        { key: "OTHER", label: "Other" },
    ];

    console.log(
        `[AppFeedbackCategory] ${categories.length} enum categories returned`
    );

    res.status(200).json({
        success: true,
        source: "ENUM",
        data: categories,
    });
};
