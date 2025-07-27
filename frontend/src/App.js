import React, { useState, useEffect } from 'react';

// Main App component
const App = () => {
  // State variables for input fields and messages
  const [phoneNumber, setPhoneNumber] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false); // For simulating API calls
  const [qrCodeImage, setQrCodeImage] = useState(null); // To store QR code image
  const [qrCodeStatus, setQrCodeStatus] = useState('Waiting for QR code...'); // Status of QR code

  const API_BASE_URL = 'http://localhost:3002'; // Your backend server URL

  // Effect to fetch QR code periodically until authenticated
  useEffect(() => {
    let qrCodeInterval;

    const fetchQrCode = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/qr-code`);
        const data = await res.json();

        if (data.success && data.qrCode && data.qrCode.base64) {
          // Prepend the data URI scheme for base64 images
          // Check if it's already a data URI or a URL
          const imageUrl = data.qrCode.base64.startsWith('data:image')
            ? data.qrCode.base64
            : `data:image/png;base64,${data.qrCode.base64}`; // Assume PNG if not specified

          setQrCodeImage(imageUrl);
          setQrCodeStatus('Scan this QR code with your WhatsApp app:');
          // In a real app, you'd then poll for 'isLogged' status and stop displaying QR once logged in.
        } else {
          setQrCodeStatus(data.message || 'Still waiting for QR code...');
        }
      } catch (error) {
        console.error('Error fetching QR code:', error);
        setQrCodeStatus('Failed to connect to backend or fetch QR code. Check backend console for errors.');
      }
    };

    // Start polling for QR code
    qrCodeInterval = setInterval(fetchQrCode, 3000); // Poll every 3 seconds

    // Cleanup interval on component unmount
    return () => clearInterval(qrCodeInterval);
  }, []); // Run once on component mount

  /**
   * Handles sending a message via the backend.
   */
  const handleSendMessage = async () => {
    if (!phoneNumber || !messageContent) {
      setResponse('Please enter both a phone number and message content.');
      return;
    }

    setLoading(true);
    setResponse('Sending message via backend...');

    try {
      const res = await fetch(`${API_BASE_URL}/api/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to: phoneNumber, message: messageContent }),
      });
      const data = await res.json();
      if (data.success) {
        setResponse(`Message sent successfully: ${data.message}`);
        setMessageContent(''); // Clear message content after sending
      } else {
        setResponse(`Failed to send message: ${data.message}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setResponse('An error occurred while sending message.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles sending media via the backend.
   * Note: For actual file uploads, you'd need a more complex form and backend handling.
   * This currently sends a placeholder 'filePath'.
   */
  const handleSendMedia = async () => {
    if (!phoneNumber) {
      setResponse('Please enter a phone number to send media.');
      return;
    }

    setLoading(true);
    setResponse('Sending media via backend...');

    try {
      const res = await fetch(`${API_BASE_URL}/api/send-media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // In a real app, you'd send actual file data here, e.g., using FormData
        body: JSON.stringify({ to: phoneNumber, filePath: 'path/to/your/image.jpg', caption: 'Sent from WPPConnect App' }),
      });
      const data = await res.json();
      if (data.success) {
        setResponse(`Media sent successfully: ${data.message}`);
      } else {
        setResponse(`Failed to send media: ${data.message}`);
      }
    } catch (error) {
      console.error('Error sending media:', error);
      setResponse('An error occurred while sending media.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Simulates an AI-powered response based on a user's query.
   * In a real application, this would involve sending the message content
   * to an AI model via the backend.
   */
  const handleSimulateAIResponse = async () => {
    if (!messageContent) {
      setResponse('Please enter some text in the message content field for AI simulation.');
      return;
    }

    setLoading(true);
    setResponse('Simulating AI thinking...');

    try {
      // Construct the prompt for the AI model
      const prompt = `Based on the following user message, provide a concise, helpful, and friendly AI response, like a customer service bot: "${messageContent}"`;

      // Prepare the payload for the Gemini API call
      const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
      const payload = { contents: chatHistory };

      // API key is left empty as Canvas will provide it at runtime
      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      // Make the fetch call to the Gemini API
      const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await apiResponse.json();

      // Check if the response structure is as expected
      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const aiText = result.candidates[0].content.parts[0].text;
        setResponse(`AI Response (Simulated): ${aiText}`);
      } else {
        setResponse('AI Response: Could not generate a response. (Simulated)');
      }
    } catch (error) {
      console.error('Error simulating AI response:', error);
      setResponse('An error occurred during AI simulation. (Simulated)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-4 sm:p-8 flex items-center justify-center font-sans">
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl max-w-2xl w-full border border-gray-200">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-indigo-700 mb-6">
          WPPConnect Concept App
        </h1>

        <p className="text-gray-700 text-center mb-6 leading-relaxed">
          This application conceptually demonstrates the capabilities of <span className="font-semibold text-indigo-600">WPPConnect</span>.
          WPPConnect is a powerful Node.js library that allows developers to interact with WhatsApp Web,
          enabling automation for tasks like sending messages, managing contacts, and integrating with AI.
          <br /><br />
          <span className="font-medium">Please note:</span> This is a frontend simulation. In a real-world scenario,
          these actions would be handled by a Node.js backend server running WPPConnect.
        </p>

        {/* QR Code Display Section */}
        <div className="mt-6 mb-6 p-4 bg-gray-100 rounded-lg border border-gray-300 text-center">
            <h3 className="font-semibold text-gray-900 mb-2">WhatsApp Web Connection:</h3>
            <p className="text-gray-700 mb-4">{qrCodeStatus}</p>
            {qrCodeImage ? (
                <img src={qrCodeImage} alt="QR Code" className="mx-auto w-48 h-48 border border-gray-400 rounded-lg p-2 bg-white" />
            ) : (
                <div className="w-48 h-48 mx-auto flex items-center justify-center bg-gray-200 rounded-lg text-gray-500">
                    Loading QR...
                </div>
            )}
            <p className="text-xs text-gray-600 mt-2">
                (This QR code is generated by the backend using WPPConnect. Scan it with your phone.)
            </p>
        </div>


        <div className="space-y-4">
          <div>
            <label htmlFor="phoneNumber" className="block text-gray-700 text-sm font-medium mb-1">
              Recipient Phone Number (e.g., +1234567890)
            </label>
            <input
              type="text"
              id="phoneNumber"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition duration-200 ease-in-out"
              placeholder="Enter phone number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              aria-label="Recipient Phone Number"
            />
          </div>

          <div>
            <label htmlFor="messageContent" className="block text-gray-700 text-sm font-medium mb-1">
              Message Content / AI Query
            </label>
            <textarea
              id="messageContent"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition duration-200 ease-in-out h-28 resize-y"
              placeholder="Type your message or query here..."
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              aria-label="Message Content or AI Query"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSendMessage}
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white p-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200 ease-in-out shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              aria-label="Send Message"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : 'Send Message (via Backend)'}
            </button>

            <button
              onClick={handleSendMedia}
              disabled={loading}
              className="flex-1 bg-green-600 text-white p-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200 ease-in-out shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              aria-label="Send Media"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : 'Send Media (via Backend)'}
            </button>
          </div>

          <button
            onClick={handleSimulateAIResponse}
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 ease-in-out shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            aria-label="Simulate AI Response"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : 'Simulate AI Response (uses Gemini API)'}
          </button>

          {response && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 text-gray-800 text-sm">
              <h3 className="font-semibold text-gray-900 mb-2">Output:</h3>
              <p className="whitespace-pre-wrap">{response}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
