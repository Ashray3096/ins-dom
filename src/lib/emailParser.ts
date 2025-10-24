import { simpleParser, ParsedMail } from 'mailparser';
import MsgReader from '@kenjiuno/msgreader';

export interface ParsedEmail {
  from?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  date?: Date;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename?: string;
    contentType?: string;
    size?: number;
  }>;
}

/**
 * Parse .eml file (standard MIME email format)
 */
export async function parseEmlFile(file: File): Promise<ParsedEmail> {
  const buffer = await file.arrayBuffer();
  const parsed: ParsedMail = await simpleParser(Buffer.from(buffer));

  return {
    from: parsed.from?.text || undefined,
    to: parsed.to?.value.map((addr) => addr.address || '') || [],
    cc: parsed.cc?.value.map((addr) => addr.address || '') || [],
    bcc: parsed.bcc?.value.map((addr) => addr.address || '') || [],
    subject: parsed.subject || undefined,
    date: parsed.date || undefined,
    html: parsed.html ? String(parsed.html) : undefined,
    text: parsed.text || undefined,
    attachments: parsed.attachments?.map((att) => ({
      filename: att.filename,
      contentType: att.contentType,
      size: att.size,
    })) || [],
  };
}

/**
 * Parse .msg file (Outlook format)
 */
export async function parseMsgFile(file: File): Promise<ParsedEmail> {
  const arrayBuffer = await file.arrayBuffer();
  const msgReader = new MsgReader(arrayBuffer);
  const fileData = msgReader.getFileData();

  return {
    from: fileData.senderName || fileData.senderEmail || undefined,
    to: fileData.recipients ? [fileData.recipients] : [],
    cc: [],
    bcc: [],
    subject: fileData.subject || undefined,
    date: fileData.creationTime ? new Date(fileData.creationTime) : undefined,
    html: fileData.bodyHTML || undefined,
    text: fileData.body || undefined,
    attachments: fileData.attachments?.map((att: any) => ({
      filename: att.fileName || att.name,
      contentType: att.mimeType,
      size: att.content?.length,
    })) || [],
  };
}

/**
 * Parse email file based on extension
 */
export async function parseEmailFile(file: File): Promise<ParsedEmail> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.eml')) {
    return parseEmlFile(file);
  } else if (fileName.endsWith('.msg')) {
    return parseMsgFile(file);
  } else {
    throw new Error('Unsupported email file format. Only .eml and .msg are supported.');
  }
}

/**
 * Parse email from text content (for already uploaded files)
 */
export async function parseEmailFromText(content: string, fileType: 'eml' | 'msg'): Promise<ParsedEmail> {
  if (fileType === 'eml') {
    const parsed: ParsedMail = await simpleParser(content);

    return {
      from: parsed.from?.text || undefined,
      to: parsed.to?.value.map((addr) => addr.address || '') || [],
      cc: parsed.cc?.value.map((addr) => addr.address || '') || [],
      bcc: parsed.bcc?.value.map((addr) => addr.address || '') || [],
      subject: parsed.subject || undefined,
      date: parsed.date || undefined,
      html: parsed.html ? String(parsed.html) : undefined,
      text: parsed.text || undefined,
      attachments: parsed.attachments?.map((att) => ({
        filename: att.filename,
        contentType: att.contentType,
        size: att.size,
      })) || [],
    };
  } else if (fileType === 'msg') {
    // For .msg, we need binary data, not text
    throw new Error('.msg files require binary parsing');
  } else {
    throw new Error('Unsupported email file type');
  }
}
