<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Deployment Status</title>
</head>

<body style="margin:0;padding:0;background:#eef1f5;font-family:Segoe UI,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;">
  <tr>
    <td align="center">

      <!-- Card -->
      <table width="620" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:10px;
                    box-shadow:0 10px 30px rgba(0,0,0,0.08);
                    overflow:hidden;">

        <!-- STATUS STRIP (Immediate Signal) -->
        <tr>
          <td style="background:{{STATUS_COLOR}};
                     padding:18px 30px;
                     text-align:center;">
            <div style="font-size:26px;
                        font-weight:800;
                        letter-spacing:1px;
                        color:#ffffff;">
              {{STATUS_ICON}} {{STATUS_TEXT}}
            </div>
          </td>
        </tr>

        <!-- MESSAGE -->
        <tr>
          <td style="padding:26px 30px 10px 30px;color:#333;">
            <div style="font-size:16px;line-height:1.6;">
              <strong>{{CONTROL_NAME}}</strong> control configuration
              has
              <strong style="color:{{STATUS_COLOR}};">
                {{STATUS_VERB}}
              </strong>
              by <strong>{{USER_EMAIL}}</strong>
              at <strong>{{TIMESTAMP}}</strong>.
            </div>
          </td>
        </tr>

        <!-- DETAILS -->
        <tr>
          <td style="padding:10px 30px 25px 30px;">
            <table width="100%" cellpadding="10" cellspacing="0"
                   style="background:#f8f9fb;border-radius:6px;font-size:14px;">
              <tr>
                <td style="font-weight:600;width:180px;">Control Name</td>
                <td>{{CONTROL_NAME}}</td>
              </tr>
              <tr>
                <td style="font-weight:600;">Run Environment</td>
                <td>{{RUN_ENV}}</td>
              </tr>
              <tr>
                <td style="font-weight:600;">Executed By</td>
                <td>{{USER_EMAIL}}</td>
              </tr>
              <tr>
                <td style="font-weight:600;">Timestamp</td>
                <td>{{TIMESTAMP}}</td>
              </tr>
              <tr>
                <td style="font-weight:600;">Status</td>
                <td style="font-weight:700;color:{{STATUS_COLOR}};">
                  {{STATUS_TEXT}}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FAILURE REASON -->
        {{#IF_FAILURE}}
        <tr>
          <td style="padding:0 30px 25px 30px;">
            <div style="background:#fdecea;
                        border-left:6px solid #d93025;
                        border-radius:6px;
                        padding:16px;">
              <div style="font-weight:700;color:#b71c1c;margin-bottom:6px;">
                ❗ Deployment Failed – Reason
              </div>
              <div style="font-family:Consolas,monospace;
                          font-size:13px;
                          color:#5f2120;
                          white-space:pre-wrap;">
                {{ERROR_REASON}}
              </div>
            </div>
          </td>
        </tr>
        {{/IF_FAILURE}}

        <!-- FOOTER -->
        <tr>
          <td style="background:#fafafa;
                     padding:15px;
                     text-align:center;
                     font-size:12px;
                     color:#777;">
            Automated deployment notification · Do not reply
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>
