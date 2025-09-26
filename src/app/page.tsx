'use client';

import { useState } from 'react';

const sampleEmails = [
  "Hi! Can we schedule a meeting for next Tuesday to discuss the project timeline?",
  "Your order #12345 has been shipped and will arrive in 2-3 business days.",
  "🎉 Black Friday Sale! Get 50% off everything in our store this weekend only!",
  "I need your help with this complex legal matter. The contract terms are confusing.",
  "Weekly Newsletter: Top 10 AI developments this week"
];

export default function Home() {
  const [emailContent, setEmailContent] = useState(sampleEmails[0]);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [structuredResponse, setStructuredResponse] = useState<any>(null);
  const [loading, setLoading] = useState<{ raw: boolean; structured: boolean }>({
    raw: false,
    structured: false
  });

  const classifyRaw = async () => {
    setLoading(prev => ({ ...prev, raw: true }));
    setRawResponse(null);

    try {
      const response = await fetch('/api/classify-raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailContent }),
      });
      const data = await response.json();
      setRawResponse(data);
    } catch (error) {
      setRawResponse({ success: false, error: 'Request failed' });
    } finally {
      setLoading(prev => ({ ...prev, raw: false }));
    }
  };

  const classifyStructured = async () => {
    setLoading(prev => ({ ...prev, structured: true }));
    setStructuredResponse(null);

    try {
      const response = await fetch('/api/classify-structured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailContent }),
      });
      const data = await response.json();
      setStructuredResponse(data);
    } catch (error) {
      setStructuredResponse({ success: false, error: 'Request failed' });
    } finally {
      setLoading(prev => ({ ...prev, structured: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            AI SDK Demo: Raw vs Structured Output
          </h1>
          <p className="text-lg text-gray-600">
            See the difference between unpredictable raw AI responses and reliable structured output
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Content
          </label>
          <textarea
            value={emailContent}
            onChange={(e) => setEmailContent(e.target.value)}
            className="w-full h-24 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter email content to classify..."
          />

          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">Quick examples:</p>
            <div className="flex flex-wrap gap-2">
              {sampleEmails.map((email, index) => (
                <button
                  key={index}
                  onClick={() => setEmailContent(email)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700"
                >
                  Example {index + 1}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Raw Response */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-red-600">
                ❌ Raw AI Response
              </h2>
              <button
                onClick={classifyRaw}
                disabled={loading.raw}
                className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-md"
              >
                {loading.raw ? 'Processing...' : 'Classify (Raw)'}
              </button>
            </div>

            <div className="bg-red-50 p-3 rounded border-l-4 border-red-400 mb-4">
              <p className="text-sm text-red-700">
                <strong>The Problem:</strong> Unpredictable format, hard to parse, brittle in production
              </p>
            </div>

            {rawResponse && (
              <div className="bg-gray-100 p-4 rounded-md">
                <h3 className="font-medium mb-2">Response:</h3>
                <pre className="text-sm overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(rawResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Structured Response */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-green-600">
                ✅ Structured Output
              </h2>
              <button
                onClick={classifyStructured}
                disabled={loading.structured}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-md"
              >
                {loading.structured ? 'Processing...' : 'Classify (Structured)'}
              </button>
            </div>

            <div className="bg-green-50 p-3 rounded border-l-4 border-green-400 mb-4">
              <p className="text-sm text-green-700">
                <strong>The Solution:</strong> Predictable structure, type-safe, production-ready
              </p>
            </div>

            {structuredResponse && (
              <div className="bg-gray-100 p-4 rounded-md">
                <h3 className="font-medium mb-2">Response:</h3>
                <pre className="text-sm overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(structuredResponse, null, 2)}
                </pre>

                {structuredResponse.success && (
                  <div className="mt-4 p-3 bg-green-50 rounded">
                    <h4 className="font-medium text-green-800 mb-2">Type-Safe Usage:</h4>
                    <code className="text-sm text-green-700">
                      intent: "{structuredResponse.response.intent}" <br/>
                      emailType: "{structuredResponse.response.emailType}" <br/>
                      confidence: {structuredResponse.response.confidence}
                    </code>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 bg-blue-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-800 mb-3">
            Key Differences
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-red-600 mb-2">Raw Response Issues:</h4>
              <ul className="space-y-1 text-red-700">
                <li>• Inconsistent format</li>
                <li>• May include extra text</li>
                <li>• Requires parsing logic</li>
                <li>• Prone to JSON errors</li>
                <li>• No type safety</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-green-600 mb-2">Structured Benefits:</h4>
              <ul className="space-y-1 text-green-700">
                <li>• Always valid JSON</li>
                <li>• Guaranteed structure</li>
                <li>• Type-safe in TypeScript</li>
                <li>• Validated data</li>
                <li>• Production-ready</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}