html = f"""
<div style="font-family:Segoe UI, Arial, sans-serif;
            background:#f5f7fa;
            padding:30px;">

  <div style="max-width:600px;
              margin:auto;
              background:#ffffff;
              border-radius:8px;
              overflow:hidden;
              box-shadow:0 2px 8px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="padding:20px;
                background:{'#2e7d32' if is_success else '#c62828'};
                color:#ffffff;">
      <h2 style="margin:0; font-size:18px;">
        {'Deployment Successful' if is_success else 'Deployment Failed'}
      </h2>
    </div>

    <!-- Body -->
    <div style="padding:25px; color:#333; font-size:14px;">

      <p style="margin-top:0;">
        <strong>{config}</strong> control config file deployment has
        { 'been completed successfully'
          if is_success
          else 'failed. Please check the failure reason below for more details.' }
      </p>

      <div style="margin-top:20px;
                  border:1px solid #e0e0e0;
                  border-radius:6px;
                  overflow:hidden;">

        <table style="width:100%; border-collapse:collapse;">
          <tr style="background:#f9fafb;">
            <td style="padding:10px 14px; font-weight:bold; width:40%;">Control Name</td>
            <td style="padding:10px 14px;">{config}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px; font-weight:bold;">Run Environment</td>
            <td style="padding:10px 14px;">{run_env}</td>
          </tr>
          <tr style="background:#f9fafb;">
            <td style="padding:10px 14px; font-weight:bold;">Triggered By</td>
            <td style="padding:10px 14px;">{user_email}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px; font-weight:bold;">Timestamp</td>
            <td style="padding:10px 14px;">{time_stamp}</td>
          </tr>
          <tr style="background:#f9fafb;">
            <td style="padding:10px 14px; font-weight:bold;">Status</td>
            <td style="padding:10px 14px;
                       font-weight:bold;
                       color:{'#2e7d32' if is_success else '#c62828'};">
              {status}
            </td>
          </tr>
        </table>
      </div>

      {""
      if is_success else
      f'''
      <div style="margin-top:25px;
                  padding:16px;
                  background:#fdecea;
                  border-left:6px solid #d93025;
                  border-radius:4px;">
        <div style="font-weight:bold;
                    color:#b71c1c;
                    margin-bottom:6px;">
          Failure Reason
        </div>
        <div style="font-family:monospace;
                    font-size:13px;
                    color:#5f2120;
                    white-space:pre-wrap;">
          {error_message}
        </div>
      </div>
      '''
      }

    </div>

    <!-- Footer -->
    <div style="padding:12px 20px;
                background:#f0f2f5;
                font-size:12px;
                color:#777;
                text-align:center;">
      Automated message • Do not reply
    </div>

  </div>
</div>
"""
