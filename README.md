html = f"""
<div style="font-family:Arial, sans-serif; font-size:14px; color:#333;">

  <p>
    <strong>{config}</strong> control config file deployment has been
    <span style="color:{'#2e7d32' if is_success else '#c62828'}; font-weight:bold;">
      {"Successfully" if is_success else "Unsuccessfully"}
    </span>
    deployed by <strong>{user_email}</strong>.
  </p>

  <table style="border-collapse:collapse; margin-top:15px;">
    <tr>
      <td style="padding:6px 12px; font-weight:bold;">Control Name</td>
      <td style="padding:6px 12px;">{config}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px; font-weight:bold;">Run Environment</td>
      <td style="padding:6px 12px;">{run_env}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px; font-weight:bold;">Timestamp</td>
      <td style="padding:6px 12px;">{time_stamp}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px; font-weight:bold;">Status</td>
      <td style="padding:6px 12px;">
        <span style="font-weight:bold; color:{'#2e7d32' if is_success else '#c62828'};">
          {status}
        </span>
      </td>
    </tr>
  </table>

  {""
  if is_success else
  f'''
  <div style="margin-top:20px;
              padding:15px;
              background:#fdecea;
              border-left:5px solid #d93025;
              border-radius:4px;">
    <div style="font-weight:bold; color:#b71c1c; margin-bottom:6px;">
      Failure Reason
    </div>
    <div style="font-family:monospace; font-size:13px; color:#5f2120;">
      {error_message}
    </div>
  </div>
  '''
  }

  <p style="margin-top:25px; font-size:12px; color:#777;">
    Automated message — Do not reply
  </p>

</div>
"""
