// server.js
const express = require('express');
const cors = require('cors');
// WPPConnect library import
const wppconnect = require('@wppconnect-team/wppconnect');

// If you decide to save media files locally, uncomment these:
// const path = require('path');
// const fs = require('fs');

const app = express();
const port = process.env.PORT || 3002; // Use environment port or default to 3002

// Middleware
app.use(cors()); // Enable CORS for frontend communication
app.use(express.json()); // Parse JSON request bodies

// If serving static media files, uncomment this and create a 'media' directory:
// app.use('/media', express.static(path.join(__dirname, 'media')));


// --- Configuration for n8n Integration ---
// IMPORTANT: Replace this with the actual URL of your n8n Webhook WhatsApp node.
// You can find this URL in your n8n workflow's Webhook node settings.

// Test url
// const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook-test/e77397ab-fe1b-407b-9afe-77edab1dd92d';

// Production url
//const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/e77397ab-fe1b-407b-9afe-77edab1dd92d';


// Production url agent.echowkidar.in
//const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://agent.echowkidar.in/webhook-test/e77397ab-fe1b-407b-9afe-77edab1dd92d';

//const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://agent.echowkidar.in/webhook/e77397ab-fe1b-407b-9afe-77edab1dd92d';
//const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/e77397ab-fe1b-407b-9afe-77edab1dd92d';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://agent.echowkidar.in/webhook-test/e77397ab-fe1b-407b-9afe-77edab1dd92d';
console.log(`n8n Webhook URL set to: ${N8N_WEBHOOK_URL}`);

// --- WPPConnect Initialization ---
let client; // This will hold your WPPConnect client instance
let qrCodeData = null; // To store the QR code data

/**
 * Function to initialize WPPConnect.
 * This will attempt to create a WhatsApp Web session.
 * It handles QR code generation for authentication and monitors connection status.
 */
async function initializeWPPConnect() {
    console.log('Attempting to initialize WPPConnect...');
    try {
        client = await wppconnect.create({
            session: 'n8n-whatsapp-bot', // A unique session name for this integration
            headless: true,
            useChrome: true,
            browserArgs: ['--no-sandbox', '--disable-setuid-sandbox'], // ✅ Add this line
            catchQR: (base64Qrimg, asciiQR, attempts, urlCode) => {
                // This callback is triggered when a QR code is generated.
                console.log('QR Code received!');
                console.log('Scan this QR code with your WhatsApp app:');
                console.log(asciiQR); // Log ASCII QR to terminal

                qrCodeData = {
                    base64: base64Qrimg, // Base64 image data of the QR code
                    ascii: asciiQR,      // ASCII representation of the QR code
                    url: urlCode,        // URL code (data-ref)
                    attempts: attempts   // Number of attempts
                };
            },
            statusFind: (statusSession, session) => {
                // This callback is triggered on session status changes.
                console.log('Session Status:', statusSession, 'Session Name:', session);
                if (statusSession === 'isLogged') {
                    console.log('WPPConnect client is now logged in!');
                    // You might want to clear qrCodeData here as it's no longer needed
                    qrCodeData = null;
                } else if (statusSession === 'notLogged' || statusSession === 'browserClose' || statusSession === 'qrReadError') {
                    console.log('WPPConnect client is not logged in or session closed. QR code may be needed again.');
                    // You might want to re-trigger QR code generation or notify frontend.
                }
            },
            headless: true, // Set to 'true' to run Chrome in headless mode (no GUI), 'false' for GUI.
            devtools: false, // Open devtools by default.
            useChrome: true, // If false will use Chromium instance.
            debug: false, // Opens a debug session.
            logQR: true, // Logs QR automatically in terminal.
            autoClose: 60000, // Automatically closes wppconnect if QR not scanned in 60 seconds (set to 0 or false to disable).
            tokenStore: 'file', // Define how to store tokens (e.g., 'file', 'db', or custom interface).
            folderNameToken: './tokens', // Folder name for storing session tokens if tokenStore is 'file'.
        });
        console.log('WPPConnect client initialized.');

        // --- Listen for incoming messages from WhatsApp ---
        client.onMessage(async (message) => {
            console.log('Received message from WhatsApp:', message.from, message.body, 'Type:', message.type);

            // Ignore messages from self, group messages, or protocol messages
            if (message.fromMe || message.isGroupMsg || message.type === 'protocol' || message.type === 'notification_code') {
                return;
            }

            let n8nPayload = {
                from: message.from,
                id: message.id,
                type: message.type, // Include message type for n8n to differentiate
                timestamp: message.timestamp,
            };

            try {
                // Handle different message types
                if (message.type === 'chat' || message.type === 'ptt' || message.type === 'vcard' || message.type === 'location' || message.type === 'sticker') {
                    // For text messages and other non-media types where body holds content
                    n8nPayload.body = message.body;
                    console.log('Sending non-media message to n8n');
                } else if (message.type === 'image' || message.type === 'video' || message.type === 'document' || message.type === 'audio') {
                    console.log(`Received ${message.type} message. Attempting to download media...`);
                    try {
                        const buffer = await client.decryptFile(message); // Get the media data as a Buffer

                        // --- Option 1: Send Media as Base64 (Good for smaller files) ---
                        // Be aware of payload size limits for very large files.
                        const base64Media = buffer.toString('base64');
                        n8nPayload.mediaBase64 = base64Media;
                        n8nPayload.mediaMimeType = message.mimetype;
                        n8nPayload.fileName = message.filename || `media_file.${message.mimetype.split('/')[1] || 'dat'}`;
                        n8nPayload.caption = message.body || ''; // Caption for media, if any

                        console.log(`Media (${message.mimetype}) downloaded and converted to base64 for n8n.`);

                        // --- Option 2: Save Media Locally and Send URL (Recommended for larger files) ---
                        // Uncomment the 'path' and 'fs' imports at the top
                        // Uncomment the express.static middleware setup
                        // and create a 'media' directory in your project root.

                        // const mediaDir = path.join(__dirname, 'media');
                        // if (!fs.existsSync(mediaDir)) {
                        //     fs.mkdirSync(mediaDir);
                        // }
                        // const filename = `${message.id}.${message.mimetype.split('/')[1] || 'dat'}`;
                        // const filePath = path.join(mediaDir, filename);
                        // fs.writeFileSync(filePath, buffer);
                        // n8nPayload.mediaUrl = `http://localhost:${port}/media/${filename}`; // Or your public server URL
                        // n8nPayload.mediaMimeType = message.mimetype;
                        // n8nPayload.fileName = message.filename || filename;
                        // n8nPayload.caption = message.body || ''; // Caption for media, if any
                        // console.log(`Media saved locally and URL provided to n8n: ${n8nPayload.mediaUrl}`);

                    } catch (mediaError) {
                        console.error('Error downloading or processing media:', mediaError);
                        // If media download fails, send the original message body (which might be empty or just a caption)
                        n8nPayload.body = message.body || 'Media download failed.';
                    }
                } else {
                    console.log(`Received unhandled message type: ${message.type}. Sending original body if available.`);
                    n8nPayload.body = message.body || `Unhandled message type: ${message.type}`;
                }

                console.log('Forwarding payload to n8n:', JSON.stringify(n8nPayload, null, 2)); // Log pretty JSON
                const response = await fetch(N8N_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(n8nPayload)
                });

                if (response.ok) {
                    console.log('Message successfully forwarded to n8n.');
                    // n8n will process this and call our /api/n8n-reply endpoint with the response.
                } else {
                    const errorText = await response.text();
                    console.error('Failed to forward message to n8n:', response.status, response.statusText, 'Response Body:', errorText);
                }
            } catch (error) {
                console.error('Error processing or forwarding message to n8n:', error);
            }
        });

    } catch (error) {
        console.error('Error initializing WPPConnect:', error);
        qrCodeData = null; // Clear QR data on error
    }
}

// Call the initialization function when the server starts
initializeWPPConnect();

// --- API Endpoints ---

/**
 * GET /api/qr-code
 * Returns the current QR code data for authentication.
 * Frontend polls this to display the QR code.
 */
app.get('/api/qr-code', (req, res) => {
    if (qrCodeData) {
        res.json({ success: true, qrCode: qrCodeData });
    } else {
        res.status(202).json({ success: false, message: 'QR code not yet available or session not started.' });
    }
});

/**
 * POST /api/send-message
 * Sends a text message using WPPConnect.
 * This endpoint is for your frontend to send messages directly.
 * Requires 'to' (phone number) and 'message' in the request body.
 */
app.post('/api/send-message', async (req, res) => {
    const { to, message } = req.body;

    if (!to || !message) {
        return res.status(400).json({ success: false, message: 'Phone number and message are required.' });
    }

    if (!client || !(await client.isConnected())) { // Use isConnected for better check
        return res.status(401).json({ success: false, message: 'WPPConnect client not authenticated or not ready.' });
    }

    console.log(`Attempting to send message to ${to}: "${message}"`);
    try {
        const result = await client.sendText(to, message);
        console.log('Message sent result:', result);
        res.json({ success: true, message: 'Message sent successfully.', result: result });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, message: `Failed to send message: ${error.message}` });
    }
});

/**
 * POST /api/send-media
 * Sends media (e.g., an image or file) using WPPConnect.
 * This endpoint is for your frontend to send media directly.
 * Requires 'to' (phone number) and 'filePath' (path to media file on server) in the request body.
 */
app.post('/api/send-media', async (req, res) => {
    const { to, filePath, caption } = req.body;

    if (!to || !filePath) {
        return res.status(400).json({ success: false, message: 'Phone number and file path are required.' });
    }

    if (!client || !(await client.isConnected())) {
        return res.status(401).json({ success: false, message: 'WPPConnect client not authenticated or not ready.' });
    }

    console.log(`Attempting to send media ${filePath} to ${to} with caption: "${caption || ''}"`);
    try {
        // filePath should be a local path on the server where this Node.js app is running
        // Or a URL to the file if it's publicly accessible
        const result = await client.sendFile(to, filePath, 'media_file', caption);
        console.log('Media sent result:', result);
        res.json({ success: true, message: 'Media sent successfully.', result: result });
    } catch (error) {
        console.error('Error sending media:', error);
        res.status(500).json({ success: false, message: `Failed to send media: ${error.message}` });
    }
});

/**
 * POST /api/n8n-reply
 * New endpoint for n8n to send AI-generated replies back to WhatsApp.
 * Requires 'to' (recipient's WhatsApp ID, e.g., '919319338997@c.us') and 'reply' (AI message)
 * in the request body.
 */
app.post('/api/n8n-reply', async (req, res) => {
    const { to, reply } = req.body;

    if (!to || !reply) {
        return res.status(400).json({ success: false, message: 'Recipient (to) and reply message are required.' });
    }

    if (!client || !(await client.isConnected())) {
        return res.status(401).json({ success: false, message: 'WPPConnect client not authenticated or not ready to send reply.' });
    }

    console.log(`Received AI reply from n8n for ${to}: "${reply}"`);
    try {
        const result = await client.sendText(to, reply);
        console.log('AI reply sent via WhatsApp:', result);
        res.json({ success: true, message: 'AI reply sent successfully via WhatsApp.', result: result });
    } catch (error) {
        console.error('Error sending AI reply via WhatsApp:', error);
        res.status(500).json({ success: false, message: `Failed to send AI reply via WhatsApp: ${error.message}` });
    }
});


// Start the server
app.listen(port, () => {
    console.log(`WPPConnect Backend server listening at http://localhost:${port}`);
    console.log('--- IMPORTANT ---');
    console.log(`Ensure your n8n Webhook WhatsApp node is configured to receive POST requests at: ${N8N_WEBHOOK_URL}`);
    console.log(`Configure your n8n workflow to send AI replies to this server's endpoint: http://localhost:${port}/api/n8n-reply`);
    console.log('This server needs to be run on your local machine or a server environment that can launch a browser (Puppeteer).');
    console.log('Scan the QR code that appears in this terminal or on your frontend (if connected) with your WhatsApp app.');
});