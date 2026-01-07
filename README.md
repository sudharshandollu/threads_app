<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Deployment Status</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:20px;">
  <tr>
    <td align="center">

      <!-- Container -->
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="padding:20px;
                     background-color:{{STATUS_COLOR}};
                     color:#ffffff;
                     text-align:center;
                     font-size:22px;
                     font-weight:bold;">
            {{STATUS_ICON}} Deployment {{STATUS_TEXT}}
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:25px;color:#333333;">

            <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="font-weight:bold;width:160px;">Control Name</td>
                <td>{{CONTROL_NAME}}</td>
              </tr>
              <tr>
                <td style="font-weight:bold;">Run Environment</td>
                <td>{{RUN_ENV}}</td>
              </tr>
              <tr>
                <td style="font-weight:bold;">Timestamp</td>
                <td>{{TIMESTAMP}}</td>
              </tr>
              <tr>
                <td style="font-weight:bold;">Status</td>
                <td>
                  <span style="color:{{STATUS_COLOR}};font-weight:bold;">
                    {{STATUS_TEXT}}
                  </span>
                </td>
              </tr>
            </table>

            <!-- Failure Section (Render ONLY if failed) -->
            {{#IF_FAILURE}}
            <div style="margin-top:20px;
                        padding:15px;
                        background:#fdecea;
                        border-left:5px solid #d93025;
                        border-radius:4px;">
              <div style="font-weight:bold;color:#b71c1c;margin-bottom:6px;">
                Failure Reason
              </div>
              <div style="color:#5f2120;font-family:monospace;font-size:13px;">
                {{ERROR_REASON}}
              </div>
            </div>
            {{/IF_FAILURE}}

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:15px;
                     text-align:center;
                     font-size:12px;
                     color:#777777;
                     background:#fafafa;">
            Automated message · Do not reply
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>
