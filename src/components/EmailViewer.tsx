'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Calendar, User, Paperclip } from 'lucide-react';
import { ParsedEmail } from '@/lib/emailParser';

interface EmailViewerProps {
  emailData: ParsedEmail;
}

export default function EmailViewer({ emailData }: EmailViewerProps) {
  const [showHtml, setShowHtml] = useState(true);

  // Format date
  const formatDate = (date?: Date) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleString();
  };

  return (
    <div className="flex flex-col h-full space-y-4 overflow-auto p-4">
      {/* Email Headers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Subject */}
          <div>
            <label className="text-sm font-semibold text-gray-700">Subject:</label>
            <p className="text-gray-900">{emailData.subject || '(No Subject)'}</p>
          </div>

          {/* From */}
          <div className="flex items-start gap-2">
            <User className="h-4 w-4 text-gray-500 mt-0.5" />
            <div className="flex-1">
              <label className="text-sm font-semibold text-gray-700">From:</label>
              <p className="text-gray-900">{emailData.from || 'Unknown'}</p>
            </div>
          </div>

          {/* To */}
          {emailData.to && emailData.to.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-gray-700">To:</label>
              <p className="text-gray-900">{emailData.to.join(', ')}</p>
            </div>
          )}

          {/* CC */}
          {emailData.cc && emailData.cc.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-gray-700">CC:</label>
              <p className="text-gray-900">{emailData.cc.join(', ')}</p>
            </div>
          )}

          {/* Date */}
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-gray-500 mt-0.5" />
            <div className="flex-1">
              <label className="text-sm font-semibold text-gray-700">Date:</label>
              <p className="text-gray-900">{formatDate(emailData.date)}</p>
            </div>
          </div>

          {/* Attachments */}
          {emailData.attachments && emailData.attachments.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                <Paperclip className="h-4 w-4" />
                Attachments ({emailData.attachments.length}):
              </label>
              <div className="space-y-1">
                {emailData.attachments.map((att, index) => (
                  <div
                    key={index}
                    className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded border border-gray-200"
                  >
                    <span className="font-medium">{att.filename || 'Unnamed'}</span>
                    {att.size && (
                      <span className="text-gray-500 ml-2">
                        ({(att.size / 1024).toFixed(1)} KB)
                      </span>
                    )}
                    {att.contentType && (
                      <span className="text-gray-500 text-xs ml-2">
                        {att.contentType}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Body */}
      <Card className="flex-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Message Body</CardTitle>
            {emailData.html && emailData.text && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowHtml(true)}
                  className={`text-sm px-3 py-1 rounded ${
                    showHtml
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  HTML
                </button>
                <button
                  onClick={() => setShowHtml(false)}
                  className={`text-sm px-3 py-1 rounded ${
                    !showHtml
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Plain Text
                </button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {showHtml && emailData.html ? (
            <iframe
              id="email-html-viewer"
              className="w-full min-h-[400px] border border-gray-200 rounded"
              sandbox="allow-same-origin"
              srcDoc={emailData.html}
            />
          ) : emailData.text ? (
            <pre className="whitespace-pre-wrap text-sm text-gray-900 font-sans bg-gray-50 p-4 rounded border border-gray-200">
              {emailData.text}
            </pre>
          ) : (
            <p className="text-gray-500 italic">No message body available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
