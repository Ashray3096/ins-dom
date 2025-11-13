/**
 * Email Parser Utility
 *
 * Parse RFC822/MIME email format and extract structured data
 */

import { simpleParser, ParsedMail, AddressObject } from 'mailparser';

export interface ParsedEmail {
  headers: {
    from: string;
    fromName: string;
    fromEmail: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    date: Date | null;
    messageId?: string;
  };
  body: {
    html?: string;
    text: string;
    textAsHtml?: string;
  };
  attachments: Array<{
    filename?: string;
    contentType: string;
    size: number;
  }>;
}

/**
 * Parse raw email content (RFC822 format)
 */
export async function parseEmailContent(rawEmail: string | Buffer): Promise<ParsedEmail> {
  const parsed: ParsedMail = await simpleParser(rawEmail);

  // Extract from address details
  const fromAddress = parsed.from?.value?.[0];
  const fromEmail = fromAddress?.address || '';
  const fromName = fromAddress?.name || fromEmail;

  return {
    headers: {
      from: parsed.from?.text || '',
      fromName,
      fromEmail,
      to: parsed.to?.text || '',
      cc: parsed.cc?.text,
      bcc: parsed.bcc?.text,
      subject: parsed.subject || '',
      date: parsed.date || null,
      messageId: parsed.messageId,
    },
    body: {
      html: parsed.html ? String(parsed.html) : undefined,
      text: parsed.text || '',
      textAsHtml: parsed.textAsHtml,
    },
    attachments: (parsed.attachments || []).map(att => ({
      filename: att.filename,
      contentType: att.contentType,
      size: att.size,
    })),
  };
}

/**
 * Get email body as readable text (prefer HTML, fallback to plain)
 */
export function getEmailBody(parsed: ParsedEmail): string {
  if (parsed.body.html) {
    return parsed.body.html;
  }
  if (parsed.body.textAsHtml) {
    return parsed.body.textAsHtml;
  }
  return parsed.body.text;
}

/**
 * Get email body as plain text only
 */
export function getEmailPlainText(parsed: ParsedEmail): string {
  return parsed.body.text;
}
