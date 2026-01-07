export const getEmailTemplate = (title: string, content: string) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 0;
      background-color: #f9fafb;
      color: #334155;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .header {
      background: linear-gradient(to right, #2563eb, #4f46e5);
      padding: 30px;
      text-align: center;
    }
    .logo {
      color: white;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0;
      text-decoration: none;
    }
    .content {
      padding: 40px 30px;
      text-align: center;
    }
    .otp-box {
      background-color: #f1f5f9;
      border-radius: 8px;
      padding: 20px;
      margin: 30px 0;
      text-align: center;
    }
    .otp-code {
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 8px;
      color: #1e293b;
      margin: 0;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
    .button {
      display: inline-block;
      background-color: #2563eb;
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">EvidentlyAEO</div>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} EvidentlyAEO. All rights reserved.</p>
      <p>This is an automated message, please do not reply.</p>
    </div>
  </div>
</body>
</html>
  `;
};

export const getOTPTemplate = (otp: string, type: 'signup' | 'reset') => {
  const title = type === 'signup' ? 'Verify your email' : 'Reset your password';
  const message = type === 'signup' 
    ? 'Welcome to EvidentlyAEO! To complete your registration, please enter the verification code below:'
    : 'We received a request to reset your password. Use the code below to proceed:';
  
  const content = `
    <h2 style="color: #1e293b; margin-top: 0;">${title}</h2>
    <p style="font-size: 16px; color: #475569;">${message}</p>
    
    <div class="otp-box">
      <h1 class="otp-code">${otp}</h1>
    </div>
    
    <p style="font-size: 14px; color: #64748b;">This code is valid for 10 minutes.</p>
    <p style="font-size: 14px; color: #64748b;">If you didn't request this, you can safely ignore this email.</p>
  `;

  return getEmailTemplate(title, content);
};
