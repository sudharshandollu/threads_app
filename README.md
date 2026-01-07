def build_html_email(params, status):
    is_success = status.lower() == "success"

    title = "Deployment Successful" if is_success else "Deployment Failed"
    title_color = "#2e7d32" if is_success else "#c62828"
    status_color = "green" if is_success else "red"

    error_section = ""
    if not is_success:
        error_section = f"""
        <h4>Error Summary</h4>
        <p style="color: {title_color};">{params.get('error_summary')}</p>

        <h4>Error Details</h4>
        <pre style="background: #f5f5f5; padding: 10px; border: 1px solid #ccc;">
{params.get('error_details')}
        </pre>
        """

    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: {title_color};">{title}</h2>

        <p>Hello <strong>{params.get('user_name')}</strong>,</p>

        <p>
            The auto configuration deployment has
            <strong>{'completed successfully' if is_success else 'failed'}</strong>.
        </p>

        <table cellpadding="8" cellspacing="0" border="1" style="border-collapse: collapse;">
            <tr><td><strong>Configuration Name</strong></td><td>{params.get('config_name')}</td></tr>
            <tr><td><strong>Environment</strong></td><td>{params.get('environment')}</td></tr>
            <tr><td><strong>Deployment ID</strong></td><td>{params.get('deployment_id')}</td></tr>
            <tr><td><strong>Start Time</strong></td><td>{params.get('start_time')}</td></tr>
            <tr><td><strong>{'Completion Time' if is_success else 'Failure Time'}</strong></td>
                <td>{params.get('end_time') if is_success else params.get('failure_time')}</td>
            </tr>
            <tr>
                <td><strong>Status</strong></td>
                <td style="color: {status_color};"><strong>{status.upper()}</strong></td>
            </tr>
        </table>

        {error_section}

        <p style="margin-top: 20px;">
            {'The configuration is now active.' if is_success else
            'Please fix the issue and retry. If the problem persists, contact support with the Deployment ID.'}
        </p>

        <p style="margin-top: 30px;">
            Regards,<br>
            <strong>Auto Deployment System</strong>
        </p>
    </body>
    </html>
    """
    return html




def notify_deployment(status, user_email, support_email, params):
    subject = f"Auto Configuration Deployment {status.capitalize()} – {params['config_name']}"
    html_body = build_html_email(params, status)

    if status.lower() == "success":
        send_email(
            subject=subject,
            html_body=html_body,
            to_emails=[user_email],
            cc_emails=[support_email]
        )
    else:
        send_email(
            subject=subject,
            html_body=html_body,
            to_emails=[user_email]
        )






params = {
    "user_name": "John Doe",
    "config_name": "AutoConfig-DB",
    "environment": "Production",
    "deployment_id": "DEP-55678",
    "start_time": "2026-01-07 10:00:00",
    "end_time": "2026-01-07 10:04:20",
    "failure_time": "2026-01-07 10:02:11",
    "error_summary": "Database timeout",
    "error_details": "Unable to connect after 3 retries"
}

# SUCCESS
notify_deployment(
    status="success",
    user_email="john.doe@company.com",
    support_email="support@company.com",
    params=params
)

# FAILURE
notify_deployment(
    status="failure",
    user_email="john.doe@company.com",
    support_email="support@company.com",
    params=params
)
