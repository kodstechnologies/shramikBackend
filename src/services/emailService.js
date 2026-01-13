import nodemailer from "nodemailer";

/**
 * Email Service using Nodemailer
 * Supports Gmail, SMTP, and other transports
 */
class EmailService {
    constructor() {
        this.transporter = null;
        this.isConfigured = false;
    }

    /**
     * Initialize the email transporter
     * Call this once during app startup
     */
    initialize() {
        const emailUser = process.env.EMAIL_USER;
        const emailPass = process.env.EMAIL_PASS;
        const emailHost = process.env.EMAIL_HOST || "smtp.gmail.com";
        const emailPort = parseInt(process.env.EMAIL_PORT) || 587;

        if (!emailUser || !emailPass) {
            console.warn("⚠️ Email service not configured: EMAIL_USER or EMAIL_PASS missing");
            this.isConfigured = false;
            return;
        }

        this.transporter = nodemailer.createTransport({
            host: emailHost,
            port: emailPort,
            secure: emailPort === 465, // true for 465, false for other ports
            auth: {
                user: emailUser,
                pass: emailPass,
            },
        });

        this.isConfigured = true;
        console.log("✅ Email service initialized");
    }

    /**
     * Send a single email
     */
    async sendEmail({ to, subject, html, text, from }) {
        if (!this.isConfigured) {
            throw new Error("Email service not configured");
        }

        const mailOptions = {
            from: from || `"Shramik" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
            text: text || this.stripHtml(html),
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`📧 Email sent to ${to}: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error(`❌ Failed to send email to ${to}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send bulk emails with rate limiting
     * @param {Array} recipients - Array of { email, name, userId, userType }
     * @param {Object} emailData - { subject, html, text }
     * @param {Function} onProgress - Callback for progress updates
     */
    async sendBulkEmails(recipients, emailData, onProgress) {
        if (!this.isConfigured) {
            throw new Error("Email service not configured");
        }

        const results = {
            total: recipients.length,
            sent: 0,
            failed: 0,
            details: [],
        };

        const batchSize = 10; // Send 10 emails at a time
        const delayBetweenBatches = 1000; // 1 second delay between batches

        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);

            const promises = batch.map(async (recipient) => {
                try {
                    // Personalize email if needed
                    const personalizedHtml = this.personalizeContent(
                        emailData.html,
                        recipient
                    );

                    const result = await this.sendEmail({
                        to: recipient.email,
                        subject: emailData.subject,
                        html: personalizedHtml,
                    });

                    if (result.success) {
                        results.sent++;
                        results.details.push({
                            userId: recipient.userId,
                            email: recipient.email,
                            status: "sent",
                            messageId: result.messageId,
                        });
                    } else {
                        results.failed++;
                        results.details.push({
                            userId: recipient.userId,
                            email: recipient.email,
                            status: "failed",
                            error: result.error,
                        });
                    }
                } catch (error) {
                    results.failed++;
                    results.details.push({
                        userId: recipient.userId,
                        email: recipient.email,
                        status: "failed",
                        error: error.message,
                    });
                }
            });

            await Promise.all(promises);

            // Report progress
            if (onProgress) {
                onProgress({
                    processed: Math.min(i + batchSize, recipients.length),
                    total: recipients.length,
                    sent: results.sent,
                    failed: results.failed,
                });
            }

            // Delay between batches to avoid rate limiting
            if (i + batchSize < recipients.length) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
            }
        }

        return results;
    }

    /**
     * Replace placeholders in email content with recipient data
     */
    personalizeContent(html, recipient) {
        return html
            .replace(/{{name}}/g, recipient.name || "Valued Member")
            .replace(/{{email}}/g, recipient.email || "")
            .replace(/{{userId}}/g, recipient.userId || "");
    }

    /**
     * Strip HTML tags to create plain text version
     */
    stripHtml(html) {
        return html
            .replace(/<[^>]*>/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    /**
     * Render email from template content
     */
    renderEmailTemplate(content) {
        const { title, body, highlights, ctaText, ctaLink, footer } = content;

        const highlightsList = highlights && highlights.length > 0
            ? `<ul style="margin: 20px 0; padding-left: 20px;">
          ${highlights.map(h => `<li style="margin: 8px 0; color: #374151;">${h}</li>`).join("")}
        </ul>`
            : "";

        const ctaButton = ctaText && ctaLink
            ? `<div style="text-align: center; margin: 30px 0;">
          <a href="${ctaLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            ${ctaText}
          </a>
        </div>`
            : "";

        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title || "Shramik"}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${process.env.EMAIL_LOGO_URL || (process.env.API_URL && !process.env.API_URL.includes('localhost') ? process.env.API_URL + '/ShramikLogo.jpeg' : 'https://placehold.co/200x50/2563eb/ffffff?text=Shramik')}" alt="Shramik" style="height: 50px;">
          </div>
          
          <!-- Main Card -->
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
            <!-- Badge -->
            <div style="display: inline-block; background: #EEF2FF; color: #4F46E5; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 20px; text-transform: uppercase;">
              New Feature Update
            </div>
            
            <!-- Title -->
            ${title ? `<h1 style="color: #1F2937; font-size: 24px; margin: 0 0 20px 0; font-weight: 600;">${title}</h1>` : ""}
            
            <!-- Body -->
            ${body ? `<p style="color: #4B5563; font-size: 16px; line-height: 1.7; margin: 0 0 20px 0;">${body}</p>` : ""}
            
            <!-- Highlights -->
            ${highlightsList}
            
            <!-- CTA Button -->
            ${ctaButton}
            
            <!-- Footer Message -->
            ${footer ? `<p style="color: #6B7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">${footer}</p>` : ""}
          </div>
          
          <!-- Email Footer -->
          <div style="text-align: center; margin-top: 30px; color: #9CA3AF; font-size: 12px;">
            <p style="margin: 0 0 10px 0;">© ${new Date().getFullYear()} Shramik. All rights reserved.</p>
            <p style="margin: 0;">
              <a href="https://shramik.com/unsubscribe" style="color: #9CA3AF; text-decoration: underline;">Unsubscribe</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    }

    /**
     * Verify email Configuration
     */
    async verifyConnection() {
        if (!this.transporter) {
            return { success: false, error: "Transporter not initialized" };
        }

        try {
            await this.transporter.verify();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
