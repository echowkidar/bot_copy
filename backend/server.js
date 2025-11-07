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
//const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://agent.echowkidar.in/webhook-test/e77397ab-fe1b-407b-9afe-77edab1dd92d';

// for single url - working fine
//const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://agent.echowkidar.in/webhook/e77397ab-fe1b-407b-9afe-77edab1dd92d';

//console.log(`n8n Webhook URL set to: ${N8N_WEBHOOK_URL}`);
// end
//multiple urls start
const N8N_WEBHOOK_URLS = [
    process.env.N8N_WEBHOOK_URL_1 || 'https://agent.echowkidar.in/webhook-test/e77397ab-fe1b-407b-9afe-77edab1dd92d',
    process.env.N8N_WEBHOOK_URL_2 || 'https://agent.echowkidar.in/webhook/e77397ab-fe1b-407b-9afe-77edab1dd92d'
];

console.log('Webhook URLs configured:', N8N_WEBHOOK_URLS);
//end

// --- WPPConnect Initialization ---
let client; // This will hold your WPPConnect client instance
let qrCodeData = null; // To store the QR code data

/**
 * Function to initialize WPPConnect.
 * This will attempt to create a WhatsApp Web session.
 * It handles QR code generation for authentication and monitors connection status.
 */

//start que system
// --- Media Queue ---
let mediaQueue = [];
let isProcessingQueue = false;

// Delay helper
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Process queue sequentially with 5s delay
async function processMediaQueue() {
    if (isProcessingQueue) return; // Already processing
    isProcessingQueue = true;

    while (mediaQueue.length > 0) {
        const { payload, urls } = mediaQueue.shift();

        for (const url of urls) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    console.log(`Media successfully forwarded to: ${url}`);
                } else {
                    const errorText = await response.text();
                    console.error(`Failed to forward media to ${url}:`, errorText);
                }
            } catch (err) {
                console.error(`Error sending media to ${url}:`, err);
            }
        }

        // Wait 5 seconds before sending next media
        console.log("Waiting 5 seconds before sending next media...");
        await delay(15000);
    }

    isProcessingQueue = false;
}

//end que system


async function initializeWPPConnect() {
    console.log('Attempting to initialize WPPConnect...');
    try {
        client = await wppconnect.create({
            session: 'n8n-whatsapp-bot',
            headless: 'new', // ✅ Change to 'new' for better Puppeteer compatibility
            useChrome: true,
            browserArgs: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ],
            puppeteerOptions: {
                headless: 'new', // ✅ Explicitly set for Puppeteer
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            },
            logQR: true, // ✅ Keep only one logQR
            catchQR: (base64Qrimg, asciiQR, attempts, urlCode) => {
                console.log('\n========================');
                console.log('QR CODE RECEIVED!');
                console.log('========================');
                console.log('Scan this QR code with your WhatsApp app:');
                console.log('\n');
                console.log(asciiQR); // ASCII QR terminal mein
                console.log('\n');
                console.log(`Attempt: ${attempts}`);
                console.log('========================\n');

                qrCodeData = {
                    base64: base64Qrimg,
                    ascii: asciiQR,
                    url: urlCode,
                    attempts: attempts
                };
            },
            statusFind: (statusSession, session) => {
                console.log('\n--- Session Status Update ---');
                console.log('Status:', statusSession);
                console.log('Session:', session);
                console.log('----------------------------\n');
                
                if (statusSession === 'isLogged') {
                    console.log('✅ WPPConnect client is now logged in!');
                    qrCodeData = null;
                } else if (statusSession === 'notLogged') {
                    console.log('⚠️ Client is not logged in. QR code needed.');
                } else if (statusSession === 'browserClose') {
                    console.log('❌ Browser closed. Reinitializing...');
                    qrCodeData = null;
                    // Optional: Auto-restart
                    setTimeout(() => initializeWPPConnect(), 5000);
                } else if (statusSession === 'qrReadError') {
                    console.log('❌ QR code read error. Retrying...');
                }
            },
            devtools: false,
            debug: false,
            autoClose: 60000,
            tokenStore: 'file',
            folderNameToken: './tokens',
            disableWelcome: false, // ✅ Welcome message show hoga
            updatesLog: true // ✅ Updates log enable
        });
        
        console.log('✅ WPPConnect client initialized successfully.');

        // --- Listen for incoming messages from WhatsApp ---
        // --- Listen for incoming messages from WhatsApp ---
client.onMessage(async (message) => {
    console.log('Received message from WhatsApp:', message.from, message.body, 'Type:', message.type);

    // Ignore messages from self, group messages, or protocol messages
    if (message.fromMe || message.isGroupMsg || message.type === 'protocol' || message.type === 'notification_code') {
        return;
    }

    // --- Build base payload ---
    let n8nPayload = {
        from: message.from,
        id: message.id,
        type: message.type, // Include message type for n8n to differentiate
        timestamp: message.timestamp,
    };

    try {
        // --- For text messages and other non-media types ---
        if (message.type === 'chat' || message.type === 'ptt' || message.type === 'vcard' || message.type === 'location' || message.type === 'sticker') {
            n8nPayload.body = message.body;
            console.log('Sending non-media message to n8n instantly');

            // Send instantly to all webhooks
            for (const url of N8N_WEBHOOK_URLS) {
                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(n8nPayload)
                    });
                    if (response.ok) {
                        console.log(`Non-media message sent to: ${url}`);
                    } else {
                        const errorText = await response.text();
                        console.error(`Failed to send non-media message to ${url}:`, errorText);
                    }
                } catch (err) {
                    console.error(`Error sending non-media message to ${url}:`, err);
                }
            }
            return; // Stop here for non-media
        }

        // --- For media types (delay queue) ---
        if (message.type === 'image' || message.type === 'video' || message.type === 'document' || message.type === 'audio') {
            console.log(`Received ${message.type} message. Attempting to download media...`);
            try {
                const buffer = await client.decryptFile(message); // Get the media data as a Buffer
                const base64Media = buffer.toString('base64');
                n8nPayload.mediaBase64 = base64Media;
                n8nPayload.mediaMimeType = message.mimetype;
                n8nPayload.fileName = message.filename || `media_file.${message.mimetype.split('/')[1] || 'dat'}`;
                n8nPayload.caption = message.body || ''; // Caption for media, if any

                console.log(`Media (${message.mimetype}) downloaded and queued for delayed sending.`);
            } catch (mediaError) {
                console.error('Error downloading or processing media:', mediaError);
                n8nPayload.body = message.body || 'Media download failed.';
            }

            // Push media into queue and process with delay
            mediaQueue.push({ payload: n8nPayload, urls: N8N_WEBHOOK_URLS });
            processMediaQueue();
            return; // Don't send instantly
        }

        // --- For unhandled message types ---
        console.log(`Received unhandled message type: ${message.type}. Sending original body if available.`);
        n8nPayload.body = message.body || `Unhandled message type: ${message.type}`;

        for (const url of N8N_WEBHOOK_URLS) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(n8nPayload)
                });
                if (response.ok) {
                    console.log(`Unhandled type message sent to: ${url}`);
                } else {
                    const errorText = await response.text();
                    console.error(`Failed to send unhandled type message to ${url}:`, errorText);
                }
            } catch (err) {
                console.error(`Error sending unhandled type message to ${url}:`, err);
            }
        }

    } catch (error) {
        console.error('Error processing or forwarding message to n8n:', error);
    }
});
;

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
    //single url
    //console.log(`Ensure your n8n Webhook WhatsApp node is configured to receive POST requests at: ${N8N_WEBHOOK_URL}`);
    //multiple urls
    console.log('Ensure your n8n Webhook WhatsApp nodes are configured to receive POST requests at:'); N8N_WEBHOOK_URLS.forEach(url => console.log(` - ${url}`));
    //end
    console.log(`Configure your n8n workflow to send AI replies to this server's endpoint: http://localhost:${port}/api/n8n-reply`);
    console.log('This server needs to be run on your local machine or a server environment that can launch a browser (Puppeteer).');
    console.log('Scan the QR code that appears in this terminal or on your frontend (if connected) with your WhatsApp app.');
});
